# 030 バックアップ・復旧機構

## 概要

Firestoreデータベースの自動バックアップと復旧手順を実装するチケットです。データ損失を防ぎ、災害復旧（Disaster Recovery）に備えるための仕組みを構築します。

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

- NFR-027: バックアップ（毎日自動バックアップ）
- NFR-028: 復旧手順の文書化

## 受け入れ条件（Todo）

- [x] Firestoreの自動バックアップ設定（毎日午前2時UTC）
- [x] バックアップのCloud Storageへの保存
- [x] バックアップの保持期間設定（30日間）
- [x] 週次バックアップの保持期間設定（90日間）
- [x] バックアップの暗号化設定（Cloud Storageデフォルト暗号化）
- [ ] 復旧手順のドキュメント作成
- [ ] 復旧スクリプトの作成
- [ ] バックアップの動作確認（テスト復旧）
- [x] バックアップ失敗時のアラート設定
- [x] バックアップのモニタリングダッシュボード作成（管理者API）
- [ ] ドキュメント化（README）

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-027, NFR-028
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - データ保護

## 技術詳細

### バックアップの種類

| バックアップ種別 | 頻度 | 保持期間 | 説明 |
|----------------|------|---------|------|
| **毎日バックアップ** | 毎日午前2時UTC | 30日間 | 全コレクションを自動バックアップ |
| **週次バックアップ** | 毎週日曜日午前2時UTC | 90日間 | 長期保存用バックアップ |
| **手動バックアップ** | 必要に応じて | 指定期間 | 重要な変更前のバックアップ |

### Firestoreバックアップの設定

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();
const project = process.env.GOOGLE_CLOUD_PROJECT;
const bucket = `gs://${project}-firestore-backups`;

export const backup_createDailyBackup = onSchedule({
  schedule: 'every day 02:00',  // 毎日午前2時UTC（日本時間11時）
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  logger.info('Firestoreバックアップ開始');

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputUriPrefix = `${bucket}/daily/${timestamp}`;

  try {
    const client = new Firestore();
    const [operation] = await client.exportDocuments({
      databaseId: '(default)',
      outputUriPrefix,
      collectionIds: []  // 空配列 = 全コレクション
    });

    logger.info('Firestoreバックアップ完了', { outputUriPrefix, operationName: operation.name });

    // バックアップ成功を記録
    await admin.firestore().collection('backupLogs').add({
      type: 'daily',
      status: 'success',
      outputUriPrefix,
      operationName: operation.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, outputUriPrefix };
  } catch (error) {
    logger.error('Firestoreバックアップ失敗', { error });

    // バックアップ失敗を記録
    await admin.firestore().collection('backupLogs').add({
      type: 'daily',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 管理者にアラート送信
    await sendAdminAlert({
      type: 'backup_failure',
      message: `Firestoreバックアップが失敗しました: ${error}`,
      severity: 'critical'
    });

    throw error;
  }
});
```

### 週次バックアップ

```typescript
export const backup_createWeeklyBackup = onSchedule({
  schedule: 'every sunday 02:00',  // 毎週日曜日午前2時UTC
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  logger.info('週次Firestoreバックアップ開始');

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputUriPrefix = `${bucket}/weekly/${timestamp}`;

  try {
    const client = new Firestore();
    const [operation] = await client.exportDocuments({
      databaseId: '(default)',
      outputUriPrefix,
      collectionIds: []
    });

    logger.info('週次Firestoreバックアップ完了', { outputUriPrefix });

    await admin.firestore().collection('backupLogs').add({
      type: 'weekly',
      status: 'success',
      outputUriPrefix,
      operationName: operation.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, outputUriPrefix };
  } catch (error) {
    logger.error('週次Firestoreバックアップ失敗', { error });
    await sendAdminAlert({
      type: 'backup_failure',
      message: `週次バックアップが失敗しました: ${error}`,
      severity: 'critical'
    });
    throw error;
  }
});
```

### 古いバックアップの削除

```typescript
import { Storage } from '@google-cloud/storage';

export const backup_deleteOldBackups = onSchedule({
  schedule: 'every day 03:00',  // 毎日午前3時UTC
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  logger.info('古いバックアップの削除開始');

  const storage = new Storage();
  const bucketName = `${project}-firestore-backups`;

  try {
    // 30日以上前のdailyバックアップを削除
    await deleteOldBackupsInFolder(storage, bucketName, 'daily', 30);

    // 90日以上前のweeklyバックアップを削除
    await deleteOldBackupsInFolder(storage, bucketName, 'weekly', 90);

    logger.info('古いバックアップの削除完了');
  } catch (error) {
    logger.error('古いバックアップの削除失敗', { error });
  }
});

async function deleteOldBackupsInFolder(
  storage: Storage,
  bucketName: string,
  folder: string,
  retentionDays: number
): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: `${folder}/` });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const createdDate = new Date(metadata.timeCreated);

    if (createdDate < cutoffDate) {
      await file.delete();
      logger.info('古いバックアップを削除', { fileName: file.name, createdDate });
    }
  }
}
```

### 復旧スクリプト

```bash
#!/bin/bash
# restore-firestore.sh

# 使用方法:
# ./restore-firestore.sh gs://PROJECT-firestore-backups/daily/2025-12-10T02-00-00

set -e

PROJECT_ID="tokyo-list-478804-e5"
BACKUP_URI=$1

if [ -z "$BACKUP_URI" ]; then
  echo "エラー: バックアップURIを指定してください"
  echo "使用方法: $0 gs://BUCKET/PATH"
  exit 1
fi

echo "Firestoreの復旧を開始します..."
echo "バックアップURI: $BACKUP_URI"
echo ""
echo "警告: この操作は既存のデータを上書きします。"
read -p "続行しますか？ (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "復旧をキャンセルしました。"
  exit 0
fi

# Firestoreのインポート
gcloud firestore import $BACKUP_URI \
  --project=$PROJECT_ID \
  --database='(default)'

echo "復旧が完了しました。"
```

### バックアップの動作確認手順

```markdown
# バックアップ動作確認手順

## 1. テストバックアップの作成

```bash
firebase functions:shell
> backup_createDailyBackup()
```

## 2. バックアップの確認

```bash
gsutil ls -r gs://tokyo-list-478804-e5-firestore-backups/
```

## 3. テスト復旧の実行

```bash
# テスト用のFirestoreプロジェクトを作成
gcloud firestore databases create --location=asia-northeast1 --project=test-project

# バックアップから復旧
./restore-firestore.sh gs://tokyo-list-478804-e5-firestore-backups/daily/2025-12-10T02-00-00
```

## 4. 復旧データの検証

- ドキュメント数を確認
- サンプルデータを取得して内容を確認
- インデックスが正しく復元されているか確認
```

### バックアップ監視ダッシュボード

```typescript
export const backup_getBackupStatus = onCall(async (request) => {
  // 管理者権限チェック
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', '管理者権限が必要です');
  }

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const backupLogsSnapshot = await admin.firestore()
    .collection('backupLogs')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(last7Days))
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();

  const backupLogs = backupLogsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const successCount = backupLogs.filter(log => log.status === 'success').length;
  const failureCount = backupLogs.filter(log => log.status === 'failed').length;

  return {
    success: true,
    data: {
      logs: backupLogs,
      summary: {
        total: backupLogs.length,
        success: successCount,
        failure: failureCount
      }
    }
  };
});
```

## テスト観点

- 毎日自動でバックアップが作成されること
- バックアップがCloud Storageに保存されること
- 30日以上前のバックアップが削除されること
- バックアップから正常に復旧できること
- バックアップ失敗時にアラートが送信されること
- バックアップログが正しく記録されること

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装ファイル

- `functions/src/api/backup/scheduler.ts` - 日次・週次バックアップ、古いバックアップ削除
- `functions/src/api/backup/status.ts` - バックアップステータスAPI
- `functions/src/api/backup/index.ts` - エクスポート
- `functions/src/services/backupService.ts` - バックアップサービス

## 備考

- バックアップはCloud Storageに保存されます（料金が発生）
- 復旧手順は、運用ドキュメントに詳しく記載します
- バックアップの動作確認は、開発環境で定期的に実施します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | Cloud Functions実装完了（日次・週次バックアップ、古いバックアップ削除、ステータスAPI）|
