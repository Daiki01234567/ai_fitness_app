# 014 リトライ処理・DLQ実装

## 概要

データ同期が失敗したときに自動で再試行（リトライ）する仕組みと、何度試しても失敗するデータを保管するDLQ（Dead Letter Queue）を実装します。

ネットワークエラーなど一時的な問題でデータ送信が失敗しても、自動でやり直してデータを失わないようにする機能です。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/013: データ同期関数

## 要件

### Cloud Tasksリトライ設定

1. **タスクキュー作成**: BigQuery同期用のキューを作成
2. **リトライ回数**: 最大10回まで再試行
3. **バックオフ設定**: 失敗するたびに待ち時間を増やす

### 指数バックオフ実装

1回目の失敗後: 1秒待機
2回目の失敗後: 2秒待機
3回目の失敗後: 4秒待機
4回目の失敗後: 8秒待機
...（2倍ずつ増加）
10回目の失敗後: DLQへ

### Dead Letter Queue設定

1. **失敗データの保管**: 10回リトライしても失敗したデータを保存
2. **管理者への通知**: DLQにデータが入ったらアラート送信
3. **手動リトライ機能**: 管理者がDLQのデータを再処理できる

### 失敗時アラート

1. **Cloud Monitoring**: DLQにデータが入ったらアラート
2. **Slack/Email通知**: 開発チームに自動通知

## 受け入れ条件

- [ ] Cloud Tasksキューが作成されている
- [ ] 失敗時に自動でリトライされる
- [ ] 指数バックオフで待ち時間が増加する
- [ ] 10回失敗したらDLQに入る
- [ ] DLQのデータが確認できる
- [ ] アラートが通知される
- [ ] 手動でDLQから再処理できる

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション10.2（Cloud TasksによるBigQuery同期）
- `docs/common/specs/05_BigQuery設計書_v1_0.md` - セクション6.2（リトライ処理）

## 技術詳細

### リトライ戦略

| エラーカテゴリ | リトライ回数 | バックオフ | 説明 |
|--------------|------------|-----------|------|
| 一時的なエラー | 10回 | 指数バックオフ | ネットワークエラー、タイムアウト |
| レート制限 | 3回 | 固定遅延（10秒） | 429エラー |
| 認証エラー | 0回 | なし | 401/403エラー（リトライ不要） |
| データ不正 | 0回 | なし | 400エラー（リトライしても同じ結果） |

### Cloud Tasks タスク登録の実装

```typescript
import { CloudTasksClient } from '@google-cloud/tasks';

/**
 * リトライタスクをCloud Tasksに登録する
 *
 * Cloud Tasksは、Googleのタスクキューサービスです。
 * 失敗したタスクを後で再実行するために使います。
 */
async function enqueueRetryTask(taskData: {
  userId: string;
  sessionId: string;
  tableName: string;
  retryCount: number;
}) {
  const tasksClient = new CloudTasksClient();

  // キューのパス
  const parent = tasksClient.queuePath(
    process.env.GOOGLE_CLOUD_PROJECT!,
    'asia-northeast1',
    'bigquery-sync-queue'  // キュー名
  );

  // バックオフ計算（2のretryCount乗 秒）
  const delaySeconds = Math.pow(2, taskData.retryCount);
  const scheduledTime = Date.now() + (delaySeconds * 1000);

  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `https://asia-northeast1-${process.env.GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/internal_syncToBigQuery`,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify(taskData)).toString('base64'),
    },
    scheduleTime: {
      seconds: Math.floor(scheduledTime / 1000),
    },
  };

  await tasksClient.createTask({ parent, task });
  console.log(`Retry task enqueued. Attempt: ${taskData.retryCount + 1}, Delay: ${delaySeconds}s`);
}
```

### DLQ（Dead Letter Queue）の実装

```typescript
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore();

/**
 * 最大リトライ回数を超えたデータをDLQに保存
 */
async function moveToDeadLetterQueue(taskData: any, error: Error) {
  await db.collection('bigquerySyncFailures').add({
    originalData: taskData,
    error: {
      message: error.message,
      stack: error.stack,
    },
    retryCount: taskData.retryCount,
    createdAt: Firestore.FieldValue.serverTimestamp(),
    status: 'failed',  // failed, retrying, resolved
    resolvedAt: null,
  });

  // アラートを送信
  await sendAlert({
    type: 'bigquery_sync_failure',
    message: `BigQuery同期が10回失敗しました: session=${taskData.sessionId}`,
    data: taskData,
  });
}
```

### Firestoreコレクション構造

```
bigquerySyncFailures/
└── {failureId}/
    ├── originalData: { ... }     // 元のデータ
    ├── error: {                  // エラー情報
    │     message: "...",
    │     stack: "..."
    │   }
    ├── retryCount: 10            // 試行回数
    ├── createdAt: Timestamp      // 発生日時
    ├── status: "failed"          // ステータス
    └── resolvedAt: null          // 解決日時（手動解決時に更新）
```

### なぜDLQが必要？

1. **データを失わない**: 何度試しても失敗するデータを捨てずに保管
2. **原因調査**: 後からエラーの原因を調べられる
3. **手動対応**: 問題を解決したら、手動で再処理できる

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| NFR-037 | 障害時のリトライ処理 |
| NFR-001 | 可用性99.9% |

## 見積もり

3日

## 進捗

- [ ] 未着手
