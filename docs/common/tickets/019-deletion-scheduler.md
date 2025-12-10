# 019 データ削除スケジューラ

## 概要

30日間の猶予期間が経過したアカウントを自動的に削除するスケジューラを実装するチケットです。Cloud Schedulerを使用して毎日定期実行し、削除予定日を過ぎたユーザーの全データ（Firestore、BigQuery、Firebase Authentication）を完全削除します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 018: GDPRデータ削除リクエストAPI

## 要件

### 機能要件

- FR-036: スケジュール削除機能

### 非機能要件

- NFR-015: Cloud Tasksによる非同期処理
- NFR-027: バックアップ・復旧機構

## 受け入れ条件（Todo）

- [ ] Cloud Scheduler設定（毎日午前4時UTC実行）
- [x] `gdpr_executeScheduledDeletions` Scheduled Functionを実装
- [x] 削除予定日を過ぎたユーザーの検索実装
- [x] Firestoreからユーザーデータ完全削除実装（サブコレクション含む）
- [x] BigQueryから仮名化データ削除実装
- [x] Firebase Authenticationからアカウント削除実装
- [x] DataDeletionRequestsのステータス更新実装（'completed'）
- [x] 削除失敗時のリトライ機構実装
- [x] 削除処理のログ出力実装（監査用）
- [ ] ユニットテスト実装（カバレッジ80%以上）
- [ ] ステージング環境でのテスト実行

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション9.2（データ削除スケジューラ）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション11（データ保持ポリシー）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-036
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠

## 技術詳細

### Cloud Scheduler設定

```yaml
# functions/src/index.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const gdpr_executeScheduledDeletions = onSchedule({
  schedule: '0 4 * * *',  // 毎日午前4時UTC（日本時間13時）
  timeZone: 'UTC',
  memory: '512MiB',
  timeoutSeconds: 540,  // 9分（最大処理時間）
}, async (event) => {
  await executeScheduledDeletions();
});
```

### 実装例

```typescript
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { BigQuery } from '@google-cloud/bigquery';
import * as admin from 'firebase-admin';

const db = getFirestore();
const auth = getAuth();
const bigquery = new BigQuery();

/**
 * 削除予定日を過ぎたユーザーを検索
 */
async function findUsersToDelete(): Promise<string[]> {
  const now = admin.firestore.Timestamp.now();

  const snapshot = await db.collection('dataDeletionRequests')
    .where('status', '==', 'pending')
    .where('scheduledDeletionDate', '<=', now)
    .get();

  return snapshot.docs.map(doc => doc.data().userId);
}

/**
 * ユーザーデータを完全削除
 */
async function deleteUserDataCompletely(userId: string): Promise<void> {
  console.log(`Starting complete deletion for userId=${userId}`);

  // 1. Firestoreからサブコレクションを削除
  await deleteSubcollections(userId);

  // 2. Firestoreからユーザードキュメントを削除
  await db.collection('users').doc(userId).delete();

  // 3. BigQueryから仮名化データを削除
  await deleteBigQueryData(userId);

  // 4. Firebase Authenticationからアカウント削除
  await auth.deleteUser(userId);

  // 5. DataDeletionRequestsのステータスを更新
  await updateDeletionRequestStatus(userId, 'completed');

  console.log(`Complete deletion finished for userId=${userId}`);
}

/**
 * Firestoreサブコレクションを削除
 */
async function deleteSubcollections(userId: string): Promise<void> {
  const batch = db.batch();

  // sessionsサブコレクション
  const sessionsSnapshot = await db.collection('users').doc(userId).collection('sessions').get();
  for (const doc of sessionsSnapshot.docs) {
    // framesサブコレクション
    const framesSnapshot = await doc.ref.collection('frames').get();
    framesSnapshot.docs.forEach(frameDoc => batch.delete(frameDoc.ref));

    batch.delete(doc.ref);
  }

  // subscriptionsサブコレクション
  const subscriptionsSnapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
  subscriptionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
  console.log(`Subcollections deleted for userId=${userId}`);
}

/**
 * BigQueryから仮名化データを削除
 */
async function deleteBigQueryData(userId: string): Promise<void> {
  const userIdHash = pseudonymizeUserId(userId);

  // sessionsテーブルから削除
  await bigquery.query({
    query: `
      DELETE FROM \`ai-fitness-app.analytics_production.sessions\`
      WHERE user_id_hash = @userIdHash
    `,
    params: { userIdHash }
  });

  // framesテーブルから削除
  await bigquery.query({
    query: `
      DELETE FROM \`ai-fitness-app.analytics_production.frames\`
      WHERE user_id_hash = @userIdHash
    `,
    params: { userIdHash }
  });

  // user_aggregatesテーブルから削除
  await bigquery.query({
    query: `
      DELETE FROM \`ai-fitness-app.analytics_production.user_aggregates\`
      WHERE user_id_hash = @userIdHash
    `,
    params: { userIdHash }
  });

  console.log(`BigQuery data deleted for userId=${userId}`);
}

/**
 * DataDeletionRequestsのステータスを更新
 */
async function updateDeletionRequestStatus(userId: string, status: string): Promise<void> {
  const snapshot = await db.collection('dataDeletionRequests')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      status,
      completedAt: FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
}

/**
 * メイン処理: スケジュール削除の実行
 */
async function executeScheduledDeletions(): Promise<void> {
  console.log('Starting scheduled deletions...');

  const usersToDelete = await findUsersToDelete();

  console.log(`Found ${usersToDelete.length} users to delete`);

  for (const userId of usersToDelete) {
    try {
      await deleteUserDataCompletely(userId);
      console.log(`Successfully deleted userId=${userId}`);
    } catch (error) {
      console.error(`Failed to delete userId=${userId}`, error);

      // 失敗した場合はステータスを'failed'に更新
      await updateDeletionRequestStatus(userId, 'failed');
    }
  }

  console.log('Scheduled deletions completed');
}
```

### エラーハンドリング

#### リトライ戦略

- **Firestore削除失敗**: 次回の実行時に再試行
- **BigQuery削除失敗**: ログに記録し、手動対応
- **Firebase Auth削除失敗**: ログに記録し、手動対応

#### ログ出力

```typescript
// 削除成功
console.log(`AUDIT: User deleted - userId=${userId}, timestamp=${new Date().toISOString()}`);

// 削除失敗
console.error(`AUDIT: Deletion failed - userId=${userId}, error=${error.message}, timestamp=${new Date().toISOString()}`);
```

### Cloud Schedulerのデプロイ

```bash
# gcloud CLIでスケジューラを作成
gcloud scheduler jobs create http gdpr-scheduled-deletions \
  --schedule="0 4 * * *" \
  --uri="https://asia-northeast1-ai-fitness-app.cloudfunctions.net/gdpr_executeScheduledDeletions" \
  --http-method=POST \
  --time-zone="UTC" \
  --oidc-service-account-email="ai-fitness-app@appspot.gserviceaccount.com"
```

### モニタリング

#### Cloud Loggingでの監視

```
severity="INFO"
jsonPayload.message=~"AUDIT: User deleted"
```

#### アラート設定

- 削除失敗が3回連続で発生した場合
- 1日の削除数が100件を超えた場合

### パフォーマンス考慮事項

#### バッチ処理の最適化

- 1回の実行で最大100ユーザーまで処理
- 100ユーザーを超える場合は次回の実行に持ち越し

```typescript
async function executeScheduledDeletions(): Promise<void> {
  const usersToDelete = await findUsersToDelete();
  const batchSize = 100;
  const usersBatch = usersToDelete.slice(0, batchSize);

  for (const userId of usersBatch) {
    // 削除処理...
  }
}
```

## 見積もり

- 工数: 2日
- 難易度: 高

## 進捗

- [x] 完了（スケジューラ設定・テスト以外）

## 完了日

2025-12-10（Cloud Tasksによる削除処理実装完了、スケジューラ設定除く）

## 備考

- 削除前にバックアップを取得する仕組みは別途検討（チケット030）
- Stripe顧客情報の削除はWebhook経由で実施（課金機能実装時に対応）
- 削除処理の監査ログはCloud Loggingに永続保存
- 現在の実装はCloud Tasksベースで、gdpr_processDataDeletionがタスクとして実行される
- Storage削除、BigQuery削除、削除証明書生成まで含む完全な削除処理を実装済み
- scheduled/index.ts ではまだコメントアウト状態（Cloud Scheduler設定待ち）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | データ削除処理実装完了（Cloud Tasks版、Storage・BigQuery・Auth削除含む） |
