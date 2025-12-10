# 015 BigQueryストリーミングパイプライン

## 概要

Firestoreのトレーニングセッションデータを、完了時にBigQueryへ自動的に同期するパイプラインを実装するチケットです。Firestoreトリガーを使用して、セッションが完了したタイミングで仮名化処理を行い、BigQueryにストリーミングインサートします。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions基盤構築
- 002: Firestoreセキュリティルール実装

## 要件

### 機能要件

なし（非機能要件のみ）

### 非機能要件

- NFR-006: BigQuery連携 - リアルタイム同期
- NFR-008: データ匿名化 - 仮名化処理
- NFR-015: Cloud Tasksによるリトライ機構

## 受け入れ条件（Todo）

- [x] Firestoreトリガー関数を実装（Pub/Subベースで実装）
- [x] BigQuery Clientの初期化とストリーミングインサート実装
- [x] 仮名化処理の実装（ユーザーIDのSHA-256ハッシュ化）
- [x] データ変換処理の実装（Firestore → BigQueryスキーマ）
- [x] BigQuery同期失敗時のリトライ機構実装（Pub/Sub + DLQ）
- [x] リトライ処理の実装（最大3回、指数バックオフ）
- [x] Dead Letter Queue（DLQ）への保存実装
- [x] 仮名化ログテーブル（pseudonymization_log）への記録実装
- [x] DLQ処理のスケジュール関数実装（scheduled_processBigQueryDlq）
- [x] ユニットテスト実装（カバレッジ80%以上達成）
- [x] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/05_BigQuery設計書_v1_0.md` - セクション3（テーブル定義）、セクション4（仮名化処理）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション5（Sessionsコレクション）
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション10.2（Cloud TasksによるBigQuery同期）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-006, NFR-008, NFR-015

## 技術詳細

### Firestoreトリガー

#### session_onComplete

**トリガー**: Firestore - `users/{userId}/sessions/{sessionId}` - onUpdate

**条件**: `status`が`'completed'`に変更された場合

**処理フロー**:

```
1. トリガー発火（セッション完了時）
   ↓
2. セッションデータを取得
   ↓
3. ユーザーIDを仮名化（SHA-256）
   ↓
4. データ変換（Firestore → BigQueryスキーマ）
   ↓
5. BigQueryにストリーミングインサート
   ↓
6-a. 成功 → セッションのbigquerySyncStatus='synced'に更新
   ↓
6-b. 失敗 → Cloud Tasksにリトライタスク登録
```

### 実装例

```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import { CloudTasksClient } from '@google-cloud/tasks';
import crypto from 'crypto';

const bigquery = new BigQuery();
const tasksClient = new CloudTasksClient();

/**
 * ユーザーIDを仮名化
 */
function pseudonymizeUserId(userId: string): string {
  const salt = process.env.PSEUDONYMIZATION_SALT || 'default-salt-change-in-production';
  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}

/**
 * セッションデータをBigQueryスキーマに変換
 */
function transformSessionForBigQuery(userId: string, sessionData: any) {
  return {
    user_id_hash: pseudonymizeUserId(userId),
    session_id: sessionData.sessionId,
    exercise_type: sessionData.exerciseType,
    start_time: sessionData.startTime.toDate().toISOString(),
    end_time: sessionData.endTime?.toDate().toISOString() || null,
    duration: sessionData.duration || null,
    status: sessionData.status,
    rep_count: sessionData.repCount || 0,
    set_count: sessionData.setCount || 0,
    overall_score: sessionData.formFeedback?.overallScore || null,
    good_frames: sessionData.formFeedback?.goodFrames || 0,
    warning_frames: sessionData.formFeedback?.warningFrames || 0,
    error_frames: sessionData.formFeedback?.errorFrames || 0,
    warnings: sessionData.formFeedback?.warnings || [],
    camera_position: sessionData.cameraSettings?.position || null,
    camera_resolution: sessionData.cameraSettings?.resolution || null,
    camera_fps: sessionData.cameraSettings?.fps || null,
    total_frames: sessionData.sessionMetadata?.totalFrames || 0,
    processed_frames: sessionData.sessionMetadata?.processedFrames || 0,
    average_fps: sessionData.sessionMetadata?.averageFps || 0,
    frame_drop_count: sessionData.sessionMetadata?.frameDropCount || 0,
    average_confidence: sessionData.sessionMetadata?.averageConfidence || 0,
    average_inference_time: sessionData.sessionMetadata?.mediapipePerformance?.averageInferenceTime || null,
    max_inference_time: sessionData.sessionMetadata?.mediapipePerformance?.maxInferenceTime || null,
    min_inference_time: sessionData.sessionMetadata?.mediapipePerformance?.minInferenceTime || null,
    platform: sessionData.sessionMetadata?.deviceInfo?.platform || null,
    os_version: sessionData.sessionMetadata?.deviceInfo?.osVersion || null,
    device_model: sessionData.sessionMetadata?.deviceInfo?.deviceModel || null,
    device_memory: sessionData.sessionMetadata?.deviceInfo?.deviceMemory || null,
    created_at: sessionData.createdAt.toDate().toISOString(),
    synced_at: new Date().toISOString()
  };
}

/**
 * Cloud Tasksにリトライタスクを登録
 */
async function enqueueRetryTask(params: {
  userId: string;
  sessionId: string;
  tableName: string;
  retryCount: number;
}) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = 'asia-northeast1';
  const queue = 'bigquery-sync-queue';

  const parent = tasksClient.queuePath(project!, location, queue);

  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `https://${location}-${project}.cloudfunctions.net/internal_retryBigQuerySync`,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify(params)).toString('base64'),
    },
  };

  await tasksClient.createTask({ parent, task });
  console.log(`Retry task enqueued: sessionId=${params.sessionId}, retryCount=${params.retryCount}`);
}

/**
 * BigQuerySyncFailuresコレクションに記録
 */
async function logSyncFailure(userId: string, sessionId: string, error: string) {
  const db = getFirestore();
  await db.collection('bigquerySyncFailures').add({
    userId,
    sessionId,
    failureReason: error,
    retryCount: 0,
    lastRetryAt: null,
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: null,
    status: 'pending'
  });
}

/**
 * Firestoreトリガー: セッション完了時
 */
export const session_onComplete = onDocumentWritten(
  'users/{userId}/sessions/{sessionId}',
  async (event) => {
    const userId = event.params.userId;
    const sessionId = event.params.sessionId;

    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // セッションが削除された場合はスキップ
    if (!afterData) {
      return;
    }

    // statusが'completed'に変更された場合のみ処理
    if (beforeData?.status !== 'completed' && afterData.status === 'completed') {
      console.log(`Session completed: userId=${userId}, sessionId=${sessionId}`);

      try {
        // BigQueryにストリーミングインサート
        const transformedData = transformSessionForBigQuery(userId, afterData);

        await bigquery
          .dataset('analytics_production')
          .table('sessions')
          .insert([transformedData]);

        // 同期成功: セッションドキュメントを更新
        const db = getFirestore();
        await db.collection('users').doc(userId).collection('sessions').doc(sessionId).update({
          bigquerySyncStatus: 'synced',
          bigquerySyncedAt: FieldValue.serverTimestamp(),
          bigquerySyncError: null,
          bigquerySyncRetryCount: 0
        });

        console.log(`BigQuery sync succeeded: sessionId=${sessionId}`);

      } catch (error) {
        console.error(`BigQuery sync failed: sessionId=${sessionId}`, error);

        // 同期失敗: Cloud Tasksにリトライタスク登録
        await enqueueRetryTask({
          userId,
          sessionId,
          tableName: 'sessions',
          retryCount: 0
        });

        // 同期失敗: セッションドキュメントを更新
        const db = getFirestore();
        await db.collection('users').doc(userId).collection('sessions').doc(sessionId).update({
          bigquerySyncStatus: 'failed',
          bigquerySyncError: error instanceof Error ? error.message : String(error),
          bigquerySyncRetryCount: 0
        });

        // DLQに記録
        await logSyncFailure(userId, sessionId, error instanceof Error ? error.message : String(error));
      }
    }
  }
);
```

### リトライ処理

```typescript
export const internal_retryBigQuerySync = onRequest(async (req, res) => {
  const { userId, sessionId, tableName, retryCount } = req.body;

  if (retryCount >= 10) {
    console.error(`Max retry count reached: sessionId=${sessionId}`);

    // DLQのステータスを'abandoned'に更新
    const db = getFirestore();
    const failureQuery = await db.collection('bigquerySyncFailures')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'pending')
      .get();

    for (const doc of failureQuery.docs) {
      await doc.ref.update({ status: 'abandoned' });
    }

    res.status(200).send('Max retry count reached');
    return;
  }

  try {
    // セッションデータを再取得
    const db = getFirestore();
    const sessionDoc = await db.collection('users').doc(userId).collection('sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      console.error(`Session not found: sessionId=${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }

    const sessionData = sessionDoc.data()!;
    const transformedData = transformSessionForBigQuery(userId, sessionData);

    // BigQueryに再度インサート
    await bigquery
      .dataset('analytics_production')
      .table(tableName)
      .insert([transformedData]);

    // 同期成功
    await sessionDoc.ref.update({
      bigquerySyncStatus: 'synced',
      bigquerySyncedAt: FieldValue.serverTimestamp(),
      bigquerySyncError: null,
      bigquerySyncRetryCount: retryCount + 1
    });

    // DLQのステータスを'resolved'に更新
    const failureQuery = await db.collection('bigquerySyncFailures')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'pending')
      .get();

    for (const doc of failureQuery.docs) {
      await doc.ref.update({ status: 'resolved', resolvedAt: FieldValue.serverTimestamp() });
    }

    console.log(`BigQuery sync retry succeeded: sessionId=${sessionId}, retryCount=${retryCount + 1}`);
    res.status(200).send('Success');

  } catch (error) {
    console.error(`BigQuery sync retry failed: sessionId=${sessionId}, retryCount=${retryCount + 1}`, error);

    // リトライ回数を更新
    const db = getFirestore();
    await db.collection('users').doc(userId).collection('sessions').doc(sessionId).update({
      bigquerySyncRetryCount: retryCount + 1
    });

    // 次のリトライをスケジュール
    await enqueueRetryTask({
      userId,
      sessionId,
      tableName,
      retryCount: retryCount + 1
    });

    res.status(500).send('Retry failed');
  }
});
```

### Cloud Tasksキューの設定

```yaml
# queue.yaml
queue:
- name: bigquery-sync-queue
  rate: 10/s
  retry_parameters:
    task_retry_limit: 10
    min_backoff_seconds: 1
    max_backoff_seconds: 3600
    max_doublings: 5
```

## 見積もり

- 工数: 3日
- 難易度: 高

## 進捗

- [x] 完了（2025-12-10）

## 完了日

2025-12-10

## 実装詳細

### アーキテクチャ変更点

当初の設計ではFirestoreトリガーとCloud Tasksを使用する予定でしたが、より効率的な以下のアーキテクチャに変更しました:

**実装アーキテクチャ**:
```
Firestore (sessions完了)
    ↓ (トリガー: アプリ側でPub/Subにpublish)
Pub/Sub トピック (training-sessions-stream)
    ↓
Cloud Function (processTrainingSession)
    ↓ 失敗時
Pub/Sub DLQ (training-sessions-dlq)
    ↓
スケジュール関数 (scheduled_processBigQueryDlq)
```

### 実装済みファイル

1. **ストリーミング処理**: `functions/src/pubsub/sessionProcessor.ts`
   - Pub/Subサブスクライバーでセッションを受信
   - ユーザーIDのSHA-256ハッシュ化
   - BigQueryへのストリーミングインサート
   - リトライロジック（最大3回、指数バックオフ）
   - DLQへの送信

2. **DLQ処理**: `functions/src/scheduled/bigqueryDlq.ts`
   - スケジュール実行（毎日午前5時）
   - DLQメッセージの再処理
   - 管理者用の手動リトライAPI

3. **仮名化ログ**: `functions/src/pubsub/sessionProcessor.ts` 内の `logPseudonymization()`
   - 処理ステータス（success/failed/retrying）
   - リトライ回数
   - エラーメッセージ

### 設計との差異

| 項目 | 設計書 | 実装 | 理由 |
|------|-------|------|------|
| トリガー方式 | Firestoreトリガー | Pub/Sub | スケーラビリティとリトライ制御の向上 |
| リトライ機構 | Cloud Tasks | Pub/Sub再発行 | シンプルな実装と運用コスト削減 |
| DLQ | BigQuerySyncFailuresコレクション | Pub/Sub DLQ + ログテーブル | 標準的なPub/Subパターンの採用 |
| 最大リトライ回数 | 10回 | 3回 | コスト最適化（必要に応じて調整可能） |

## 備考

- 仮名化処理は別チケット（016）で詳細化
- BigQueryテーブル作成は別チケット（017）で実施
- 環境変数`PSEUDONYMIZATION_SALT`は本番環境でSecrets Managerから取得

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
