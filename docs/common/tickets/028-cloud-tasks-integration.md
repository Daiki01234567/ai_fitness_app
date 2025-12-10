# 028 CloudTasks統合

## 概要

Cloud Tasksを使用して、非同期タスクキューを実装するチケットです。BigQueryへのデータ同期、メール送信、長時間かかる処理など、時間のかかるタスクを非同期で実行する仕組みを構築します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築

## 要件

### 機能要件

- なし（非機能要件のみ）

### 非機能要件

- NFR-015: 非同期処理（Cloud Tasksとの統合）
- NFR-004: イベント駆動アーキテクチャ

## 受け入れ条件（Todo）

- [x] Cloud Tasksのキューを作成（`bigquery-sync`, `data-export`, `data-deletion`, `notifications`）
- [x] タスクエンキュー関数を実装（`CloudTasksService.createTask`）
- [x] タスクハンドラー関数を実装（HTTP Function）
- [x] リトライ戦略を設定（最大5回、指数バックオフ）
- [x] Dead Letter Queue（DLQ）を実装
- [x] タスクの優先度設定機能を実装
- [x] タスクのスケジューリング機能を実装（遅延実行）
- [x] タスクの監視とログ記録
- [x] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認（オプション）

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-015, NFR-004
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - エラーハンドリング

## 技術詳細

### Cloud Tasksのキュー設定

```yaml
# queue.yaml（Cloud Tasksキュー設定）
queue:
  - name: bigquery-sync-queue
    rate: 100/s  # 秒間100リクエスト
    retryConfig:
      maxAttempts: 10
      maxBackoff: 300s
      minBackoff: 1s
      maxDoublings: 5

  - name: notification-queue
    rate: 50/s  # 秒間50リクエスト
    retryConfig:
      maxAttempts: 5
      maxBackoff: 60s
      minBackoff: 1s
      maxDoublings: 3

  - name: email-queue
    rate: 10/s  # 秒間10リクエスト
    retryConfig:
      maxAttempts: 3
      maxBackoff: 120s
      minBackoff: 5s
```

### 実装例: タスクエンキュー関数

```typescript
import { CloudTasksClient } from '@google-cloud/tasks';

const tasksClient = new CloudTasksClient();
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = 'asia-northeast1';

interface EnqueueTaskParams {
  queueName: string;
  functionName: string;
  payload: any;
  scheduleDelaySeconds?: number;  // 遅延実行（秒）
}

async function enqueueTask(params: EnqueueTaskParams): Promise<string> {
  const { queueName, functionName, payload, scheduleDelaySeconds } = params;

  const parent = tasksClient.queuePath(project!, location, queueName);
  const url = `https://${location}-${project}.cloudfunctions.net/${functionName}`;

  const task: any = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

  // 遅延実行の設定
  if (scheduleDelaySeconds) {
    const scheduleTime = new Date();
    scheduleTime.setSeconds(scheduleTime.getSeconds() + scheduleDelaySeconds);
    task.scheduleTime = {
      seconds: Math.floor(scheduleTime.getTime() / 1000),
    };
  }

  const [response] = await tasksClient.createTask({ parent, task });

  logger.info('タスクをキューに追加', {
    taskName: response.name,
    queueName,
    functionName,
    scheduleDelaySeconds
  });

  return response.name!;
}
```

### 実装例: BigQuery同期タスクハンドラー

```typescript
import { onRequest } from 'firebase-functions/v2/https';

export const internal_syncToBigQuery = onRequest(async (req, res) => {
  // Cloud Tasksからのリクエストのみ許可
  if (!isCloudTaskRequest(req)) {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    const { tableName, data, retryCount } = req.body;

    logger.info('BigQuery同期タスク開始', { tableName, retryCount });

    // BigQueryにデータを挿入
    await insertToBigQuery(tableName, data);

    logger.info('BigQuery同期成功', { tableName });
    res.status(200).send('Success');
  } catch (error) {
    logger.error('BigQuery同期失敗', { error });

    // 最大リトライ回数を超えた場合、DLQに送信
    if (req.body.retryCount >= 10) {
      await saveToDLQ('bigquery_sync_failure', req.body);
      logger.error('DLQに保存', { data: req.body });
      res.status(200).send('Moved to DLQ');
      return;
    }

    // リトライ可能なエラーの場合、500を返してリトライさせる
    res.status(500).send('Retry');
  }
});

function isCloudTaskRequest(req: any): boolean {
  const taskName = req.headers['x-cloudtasks-taskname'];
  const queueName = req.headers['x-cloudtasks-queuename'];
  return !!taskName && !!queueName;
}

async function saveToDLQ(type: string, data: any): Promise<void> {
  await admin.firestore().collection('deadLetterQueue').add({
    type,
    data,
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    retryCount: data.retryCount || 0
  });
}
```

### 使用例: BigQuery同期でCloud Tasksを使用

```typescript
async function syncToBigQueryWithRetry(tableName: string, data: any): Promise<void> {
  try {
    // まず直接BigQueryに挿入を試みる
    await insertToBigQuery(tableName, data);
    logger.info('BigQuery同期成功（直接）', { tableName });
  } catch (error) {
    // 失敗した場合、Cloud Tasksに追加
    logger.warn('BigQuery同期失敗、タスクキューに追加', { tableName, error });

    await enqueueTask({
      queueName: 'bigquery-sync-queue',
      functionName: 'internal_syncToBigQuery',
      payload: {
        tableName,
        data,
        retryCount: 0
      }
    });
  }
}
```

### Dead Letter Queue（DLQ）の監視

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const maintenance_checkDLQ = onSchedule({
  schedule: 'every 1 hours',  // 1時間ごとにチェック
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  const dlqSnapshot = await admin.firestore()
    .collection('deadLetterQueue')
    .where('failedAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))  // 24時間以内
    .get();

  if (dlqSnapshot.size > 0) {
    logger.warn('DLQに失敗タスクがあります', { count: dlqSnapshot.size });

    // アラート通知（管理者向け）
    await sendAdminAlert({
      type: 'dlq_warning',
      message: `DLQに${dlqSnapshot.size}件の失敗タスクがあります`,
      severity: 'warning'
    });
  }
});
```

## テスト観点

- タスクがキューに正しく追加されること
- タスクハンドラーが正しく実行されること
- リトライが正しく動作すること（指数バックオフ）
- 最大リトライ回数を超えるとDLQに保存されること
- 遅延実行が正しく動作すること
- Cloud Tasks以外からのリクエストが拒否されること

## 見積もり

- 工数: 3日
- 難易度: 高

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装ファイル

- `functions/src/services/cloudTasks.ts` - Cloud Tasksサービス（エンキュー、キュー管理）
- `functions/src/utils/date.ts` - 指数バックオフ計算ユーティリティ

## 備考

- Cloud Tasksは、BigQuery同期（チケット015）や通知送信（チケット022）で使用されます
- Cloud Tasksの料金が発生します（月100万リクエストまで無料）
- DLQの監視は、Phase 4の管理者機能で強化します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
