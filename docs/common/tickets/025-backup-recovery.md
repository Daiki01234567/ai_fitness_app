# 025 バックアップ・リカバリ

## 概要

Firestoreデータのバックアップ設定と、障害発生時の復旧手順を整備するチケットです。ユーザーデータを守り、システム障害があっても迅速に復旧できるようにします。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/012（セッション取得API）

## 要件

### 機能要件

- なし（運用機能のため）

### 非機能要件

- NFR-001: 可用性 - 99.5%以上の稼働率
- NFR-027: バックアップ - データの定期バックアップと復旧手順

## 受け入れ条件（Todo）

### バックアップ設定

- [ ] Firestoreの自動バックアップを有効化
- [ ] バックアップスケジュールを設定（毎日1回）
- [ ] バックアップの保存期間を設定（30日間）
- [ ] バックアップ先のCloud Storageバケットを作成

### ポイントインタイムリカバリ（PITR）

- [ ] PITRを有効化（最大7日間）
- [ ] PITRの動作確認テスト
- [ ] PITR復旧手順のドキュメント化

### 手動バックアップ

- [ ] 手動バックアップ用のCloud Functionを作成
- [ ] 重要なデプロイ前にバックアップを取る運用ルール策定
- [ ] バックアップ完了通知の実装

### リカバリ手順

- [ ] 復旧手順書の作成
- [ ] 復旧テストの実施
- [ ] 復旧時間の計測（目標: 4時間以内）
- [ ] 復旧訓練の実施スケジュール策定

### 監視・アラート

- [ ] バックアップ失敗時のアラート設定
- [ ] バックアップ成功ログの確認方法を文書化
- [ ] ストレージ使用量のモニタリング設定

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-001、NFR-027
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - データ保護

## 技術詳細

### Firestoreバックアップの概要

Firestoreには2種類のバックアップ方法があります：

| 方法 | 説明 | 復旧ポイント | コスト |
|------|------|-------------|--------|
| **スケジュールバックアップ** | 定期的にデータをCloud Storageにエクスポート | バックアップ時点 | 低 |
| **PITR（ポイントインタイムリカバリ）** | 過去7日間の任意の時点に復旧可能 | 任意の時点（秒単位） | 中 |

### スケジュールバックアップの設定

```bash
# gcloud CLIでバックアップスケジュールを作成
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=2592000s \
  --project=tokyo-list-478804-e5

# 設定確認
gcloud firestore backups schedules list \
  --database='(default)' \
  --project=tokyo-list-478804-e5
```

### Cloud Storageバケットの設定

```bash
# バックアップ用バケットの作成
gsutil mb -l asia-northeast1 gs://tokyo-list-478804-e5-backups

# ライフサイクルルール（30日後に削除）
cat > lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }
  ]
}
EOF

gsutil lifecycle set lifecycle.json gs://tokyo-list-478804-e5-backups
```

### 手動バックアップ用Cloud Function

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();
const BACKUP_BUCKET = 'gs://tokyo-list-478804-e5-backups';

/**
 * 手動バックアップを実行する（管理者専用）
 */
export const admin_createBackup = onCall({
  region: 'asia-northeast1',
  timeoutSeconds: 540, // 9分
}, async (request) => {
  // 管理者権限チェック
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', '管理者権限が必要です');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${BACKUP_BUCKET}/manual/${timestamp}`;

  try {
    // バックアップの開始
    const [operation] = await firestore.exportDocuments({
      outputUriPrefix: backupPath,
      collectionIds: [] // 空配列 = 全コレクション
    });

    // バックアップの完了を待機
    const [response] = await operation.promise();

    console.log('バックアップ完了:', response.outputUriPrefix);

    // Slackに通知（オプション）
    await sendBackupNotification(backupPath, 'success');

    return {
      success: true,
      data: {
        backupPath: response.outputUriPrefix,
        timestamp
      },
      message: 'バックアップが完了しました'
    };
  } catch (error) {
    console.error('バックアップ失敗:', error);
    await sendBackupNotification(backupPath, 'failed');
    throw new HttpsError('internal', 'バックアップに失敗しました');
  }
});

async function sendBackupNotification(
  backupPath: string,
  status: 'success' | 'failed'
): Promise<void> {
  // Slack通知の実装（023-error-reportingを参照）
}
```

### PITRの有効化

```bash
# PITRの有効化
gcloud firestore databases update \
  --database='(default)' \
  --enable-pitr \
  --project=tokyo-list-478804-e5

# PITRの状態確認
gcloud firestore databases describe \
  --database='(default)' \
  --project=tokyo-list-478804-e5
```

### リカバリ手順書（テンプレート）

```markdown
# Firestoreリカバリ手順書

## 1. 障害の種類を特定

- [ ] 全データ消失
- [ ] 一部コレクションの破損
- [ ] 誤操作によるデータ削除
- [ ] アプリケーションバグによるデータ破損

## 2. 復旧方法の選択

### 2.1 PITR復旧（過去7日以内の場合）

```bash
# 復旧先データベースの作成
gcloud firestore databases create \
  --database='recovery-db' \
  --location=asia-northeast1 \
  --project=tokyo-list-478804-e5

# PITRで復旧
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='recovery-db' \
  --snapshot-time='2025-01-15T10:00:00Z' \
  --project=tokyo-list-478804-e5
```

### 2.2 バックアップからの復旧

```bash
# バックアップ一覧の確認
gsutil ls gs://tokyo-list-478804-e5-backups/

# インポート実行
gcloud firestore import \
  gs://tokyo-list-478804-e5-backups/manual/2025-01-15T00-00-00Z \
  --project=tokyo-list-478804-e5
```

## 3. 復旧後の確認

- [ ] データ件数の確認
- [ ] 主要コレクションのサンプル確認
- [ ] アプリケーションの動作確認
- [ ] ユーザー通知（必要な場合）

## 4. 報告

- [ ] 障害報告書の作成
- [ ] 再発防止策の検討
```

### バックアップ監視用Cloud Function

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BACKUP_BUCKET = 'tokyo-list-478804-e5-backups';

/**
 * 毎日バックアップの存在を確認
 */
export const maintenance_checkBackup = onSchedule({
  schedule: 'every day 06:00',
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async () => {
  const bucket = storage.bucket(BACKUP_BUCKET);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const [files] = await bucket.getFiles({
    prefix: `scheduled/${yesterday.toISOString().split('T')[0]}`
  });

  if (files.length === 0) {
    console.error('昨日のバックアップが見つかりません');
    // アラート送信
    await sendSlackAlert('バックアップ確認失敗: 昨日のバックアップが見つかりません');
  } else {
    console.log('バックアップ確認OK:', files.length, '件');
  }
});
```

### 復旧時間目標（RTO）と復旧ポイント目標（RPO）

| 指標 | 目標 | 説明 |
|------|------|------|
| **RTO（復旧時間目標）** | 4時間 | 障害発生から復旧完了までの時間 |
| **RPO（復旧ポイント目標）** | 24時間 | 最大で失う可能性のあるデータ量（日次バックアップの場合） |

PITRを使用する場合はRPOを数分まで短縮可能です。

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 本番環境のバックアップ設定は、本番環境構築時に実施
- 復旧訓練は四半期ごとに実施する予定
- BigQueryのバックアップは別途検討（BigQueryは自動的にスナップショットを保持）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
