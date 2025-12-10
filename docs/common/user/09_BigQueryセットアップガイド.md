# BigQuery セットアップガイド

このガイドでは、AIフィットネスアプリのBigQuery分析基盤をセットアップする方法を説明します。

## 目次

1. [前提条件](#前提条件)
2. [Google Cloud SDKのインストール](#google-cloud-sdkのインストール)
3. [BigQueryのセットアップ](#bigqueryのセットアップ)
4. [テーブルの作成](#テーブルの作成)
5. [動作確認](#動作確認)
6. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

以下が必要です:

- Google Cloud プロジェクト（`tokyo-list-478804-e5`）へのアクセス権
- BigQuery APIが有効化されていること
- `bigquery.dataEditor` または `bigquery.admin` の権限

---

## Google Cloud SDKのインストール

### Windowsの場合

1. Google Cloud SDK インストーラーをダウンロード:
   - https://cloud.google.com/sdk/docs/install にアクセス
   - 「Windows」をクリック
   - 「Google Cloud CLI インストーラ」をダウンロード

2. インストーラーを実行:
   - ダウンロードしたファイルをダブルクリック
   - 画面の指示に従ってインストール

3. インストール完了後、ターミナル（コマンドプロンプト or PowerShell）を開いて確認:
   ```bash
   gcloud --version
   ```

### macOSの場合

1. ターミナルを開いて以下を実行:
   ```bash
   curl https://sdk.cloud.google.com | bash
   ```

2. ターミナルを再起動し、確認:
   ```bash
   gcloud --version
   ```

---

## BigQueryのセットアップ

### 1. Google Cloudにログイン

```bash
gcloud auth login
```

ブラウザが開くので、Googleアカウントでログインしてください。

### 2. プロジェクトを設定

```bash
gcloud config set project tokyo-list-478804-e5
```

### 3. BigQuery APIを有効化

```bash
gcloud services enable bigquery.googleapis.com
```

### 4. データセットを作成

#### 本番環境用

```bash
bq mk --dataset \
  --location=asia-northeast1 \
  --default_table_expiration=63072000 \
  --description="AIフィットネスアプリの本番分析データ" \
  tokyo-list-478804-e5:fitness_analytics
```

#### 開発環境用（オプション）

```bash
bq mk --dataset \
  --location=asia-northeast1 \
  --default_table_expiration=2592000 \
  --description="AIフィットネスアプリの開発分析データ" \
  tokyo-list-478804-e5:fitness_analytics_dev
```

---

## テーブルの作成

### 方法1: スクリプトを使用（推奨）

プロジェクトのルートディレクトリで以下を実行:

```bash
# 開発環境用
./scripts/bigquery/create_tables.sh dev

# 本番環境用
./scripts/bigquery/create_tables.sh prod
```

Windowsの場合は Git Bash を使用するか、以下の方法2を使用してください。

### 方法2: 手動で作成

各テーブルを個別に作成します。

#### training_sessions テーブル

```bash
bq mk --table \
  --schema bigquery_schemas/training_sessions.json \
  --time_partitioning_field created_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields user_id_hash,exercise_id \
  --require_partition_filter \
  --description "トレーニングセッション記録(GDPR準拠: 2年間保持)" \
  tokyo-list-478804-e5:fitness_analytics.training_sessions
```

#### user_metadata テーブル

```bash
bq mk --table \
  --schema bigquery_schemas/user_metadata.json \
  --time_partitioning_field updated_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields user_id_hash,country_code \
  --description "ユーザーメタデータ(仮名化済み)" \
  tokyo-list-478804-e5:fitness_analytics.user_metadata
```

#### aggregated_stats テーブル

```bash
bq mk --table \
  --schema bigquery_schemas/aggregated_stats.json \
  --time_partitioning_field stat_date \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields exercise_id,country_code \
  --require_partition_filter \
  --description "事前集計統計データ" \
  tokyo-list-478804-e5:fitness_analytics.aggregated_stats
```

#### pseudonymization_log テーブル

```bash
bq mk --table \
  --schema bigquery_schemas/pseudonymization_log.json \
  --time_partitioning_field created_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 7776000 \
  --clustering_fields status,source_collection \
  --require_partition_filter \
  --description "仮名化処理ログ(監査用)" \
  tokyo-list-478804-e5:fitness_analytics.pseudonymization_log
```

#### exercise_definitions テーブル

```bash
bq mk --table \
  --schema bigquery_schemas/exercise_definitions.json \
  --description "トレーニング種目マスターデータ" \
  tokyo-list-478804-e5:fitness_analytics.exercise_definitions
```

---

## 動作確認

### テーブル一覧を確認

```bash
bq ls tokyo-list-478804-e5:fitness_analytics
```

以下のようなテーブルが表示されれば成功です:

```
         tableId           Type
 ----------------------- -------
  aggregated_stats        TABLE
  exercise_definitions    TABLE
  pseudonymization_log    TABLE
  training_sessions       TABLE
  user_metadata           TABLE
```

### テーブルスキーマを確認

```bash
bq show --schema --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions
```

---

## Cloud FunctionsへのIAM権限設定

Cloud FunctionsがBigQueryにデータを書き込めるよう、権限を設定します:

```bash
# BigQuery データエディター権限を付与
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:tokyo-list-478804-e5@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# BigQuery ジョブユーザー権限を付与
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:tokyo-list-478804-e5@appspot.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

---

## Pub/Subトピックの作成

BigQueryストリーミングパイプラインに必要なPub/Subリソースを作成します:

```bash
# メイントピック
gcloud pubsub topics create training-sessions-stream

# Dead Letter Queueトピック
gcloud pubsub topics create training-sessions-dlq

# DLQサブスクリプション
gcloud pubsub subscriptions create training-sessions-dlq-sub \
  --topic=training-sessions-dlq \
  --ack-deadline=60 \
  --message-retention-duration=7d
```

---

## トラブルシューティング

### Q: 「Permission denied」エラーが出る

**原因**: 権限が不足しています

**解決方法**:
1. プロジェクト管理者に `roles/bigquery.admin` 権限を依頼
2. または、`roles/bigquery.dataEditor` と `roles/bigquery.jobUser` の権限を依頼

### Q: 「Dataset not found」エラーが出る

**原因**: データセットが作成されていません

**解決方法**:
「BigQueryのセットアップ」セクションの手順4を実行してください。

### Q: 「Table already exists」エラーが出る

**原因**: テーブルが既に存在しています

**解決方法**:
これは正常な動作です。スクリプトは既存テーブルをスキップします。
再作成したい場合は、先にテーブルを削除してください:

```bash
bq rm -f tokyo-list-478804-e5:fitness_analytics.training_sessions
```

### Q: Windows で `.sh` スクリプトが実行できない

**解決方法**:
1. Git Bash をインストール: https://git-scm.com/downloads
2. Git Bash を開いて、スクリプトを実行

または、「方法2: 手動で作成」の手順で個別にコマンドを実行してください。

---

## 次のステップ

BigQueryのセットアップが完了したら:

1. Cloud Functionsをデプロイ（`04_デプロイ方法.md` 参照）
2. Firebaseエミュレータで動作確認（`08_Firebase_Emulator_Test_Guide.md` 参照）
3. 本番環境へのデプロイ（`06_本番デプロイ前の確認事項.md` 参照）

---

## 関連ドキュメント

- [開発環境セットアップ](./01_開発環境セットアップ.md)
- [デプロイ方法](./04_デプロイ方法.md)
- [本番デプロイ前の確認事項](./06_本番デプロイ前の確認事項.md)
- [BigQuery設計書](../specs/05_BigQuery設計書_v1_0.md)
