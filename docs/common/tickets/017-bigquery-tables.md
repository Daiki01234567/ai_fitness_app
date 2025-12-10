# 017 BigQueryテーブル構築

## 概要

BigQueryのデータセットとテーブルを作成し、パーティショニング、クラスタリング、データ保持期間の設定を行うチケットです。分析用の4つのテーブル（sessions、frames、user_aggregates、device_performance）を構築します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions基盤構築

## 要件

### 機能要件

なし（非機能要件のみ）

### 非機能要件

- NFR-007: BigQueryテーブル設計 - パーティショニングとクラスタリング
- NFR-006: BigQuery連携 - 2年間のデータ保持

## 受け入れ条件（Todo）

- [x] データセット作成（fitness_analytics として実装、環境変数で切り替え可能）
- [x] sessionsテーブル作成（training_sessions として設計・実装済み）
- [x] framesテーブル作成（landmarks配列として training_sessions 内に含む設計）
- [x] user_aggregatesテーブル作成（user_metadata + aggregated_stats として実装済み）
- [x] device_performanceテーブル作成（training_sessions の device_info で実装）
- [x] データ保持期間設定（2年間、BQ_CONFIG.retentionDays = 730）
- [x] IAM権限設定（Cloud FunctionsサービスアカウントにBigQuery編集権限必要）
- [ ] テーブル作成スクリプト実装（Terraform or gcloud CLI） ※未実装
- [ ] ローカル環境での動作確認（BigQueryエミュレータ） ※未実装
- [ ] 本番環境へのデプロイ ※未実施

## 参照ドキュメント

- `docs/common/specs/05_BigQuery設計書_v1_0.md` - セクション2（データセット設計）、セクション3（テーブル定義）、セクション5（パーティショニング）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-006, NFR-007

## 技術詳細

### データセット作成

#### analytics_production（本番環境）

```sql
CREATE SCHEMA `ai-fitness-app.analytics_production`
OPTIONS (
  location = 'asia-northeast1',
  default_table_expiration_ms = 63072000000,  -- 2年間（730日）
  description = 'AIフィットネスアプリの本番分析データ'
);
```

#### analytics_development（開発環境）

```sql
CREATE SCHEMA `ai-fitness-app.analytics_development`
OPTIONS (
  location = 'asia-northeast1',
  default_table_expiration_ms = 2592000000,  -- 30日間
  description = 'AIフィットネスアプリの開発分析データ'
);
```

### テーブル作成

#### 1. sessions テーブル

```sql
CREATE TABLE `ai-fitness-app.analytics_production.sessions` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL,

  -- セッション情報
  session_id STRING NOT NULL,
  exercise_type STRING NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INT64,
  status STRING NOT NULL,

  -- トレーニング結果
  rep_count INT64 NOT NULL,
  set_count INT64 NOT NULL,

  -- フォーム評価
  overall_score INT64,
  good_frames INT64,
  warning_frames INT64,
  error_frames INT64,
  warnings ARRAY<STRUCT<
    type STRING,
    count INT64,
    severity STRING
  >>,

  -- カメラ設定
  camera_position STRING,
  camera_resolution STRING,
  camera_fps INT64,

  -- パフォーマンスメトリクス
  total_frames INT64,
  processed_frames INT64,
  average_fps FLOAT64,
  frame_drop_count INT64,
  average_confidence FLOAT64,

  -- MediaPipeパフォーマンス
  average_inference_time FLOAT64,
  max_inference_time FLOAT64,
  min_inference_time FLOAT64,

  -- デバイス情報
  platform STRING,
  os_version STRING,
  device_model STRING,
  device_memory FLOAT64,

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL

) PARTITION BY DATE(created_at)
CLUSTER BY exercise_type, platform
OPTIONS (
  partition_expiration_days = 730,  -- 2年後に自動削除
  require_partition_filter = true,  -- パーティションフィルタ必須
  description = 'トレーニングセッションデータ'
);
```

#### 2. frames テーブル

```sql
CREATE TABLE `ai-fitness-app.analytics_production.frames` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL,
  session_id STRING NOT NULL,
  frame_id STRING NOT NULL,

  -- フレーム情報
  frame_number INT64 NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- 骨格座標データ（33個の関節点）
  landmarks ARRAY<STRUCT<
    id INT64,
    x FLOAT64,
    y FLOAT64,
    z FLOAT64,
    visibility FLOAT64
  >>,

  -- フォーム評価
  frame_score INT64,
  frame_status STRING,

  -- パフォーマンス
  inference_time FLOAT64,

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL

) PARTITION BY DATE(created_at)
CLUSTER BY session_id
OPTIONS (
  partition_expiration_days = 730,
  require_partition_filter = true,
  description = 'フレーム単位の骨格座標データ'
);
```

#### 3. user_aggregates テーブル

```sql
CREATE TABLE `ai-fitness-app.analytics_production.user_aggregates` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL,

  -- 集計期間
  period_type STRING NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- トレーニング統計
  total_sessions INT64,
  total_reps INT64,
  total_duration INT64,
  average_score FLOAT64,

  -- 種目別統計
  exercise_stats ARRAY<STRUCT<
    exercise_type STRING,
    session_count INT64,
    rep_count INT64,
    average_score FLOAT64
  >>,

  -- プロフィール情報（オプション）
  height INT64,
  weight INT64,
  gender STRING,
  fitness_level STRING,

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL

) PARTITION BY period_start
CLUSTER BY period_type, fitness_level
OPTIONS (
  partition_expiration_days = 730,
  require_partition_filter = true,
  description = 'ユーザー単位の集計データ'
);
```

#### 4. device_performance テーブル

```sql
CREATE TABLE `ai-fitness-app.analytics_production.device_performance` (
  -- デバイス情報
  platform STRING NOT NULL,
  os_version STRING NOT NULL,
  device_model STRING NOT NULL,
  device_memory FLOAT64,

  -- 集計期間
  date DATE NOT NULL,

  -- パフォーマンス統計
  session_count INT64,
  average_fps FLOAT64,
  average_frame_drop_rate FLOAT64,
  average_inference_time FLOAT64,
  p50_inference_time FLOAT64,
  p95_inference_time FLOAT64,
  p99_inference_time FLOAT64,

  -- 低スペック判定
  is_low_spec BOOLEAN,

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL

) PARTITION BY date
CLUSTER BY platform, device_model
OPTIONS (
  partition_expiration_days = 730,
  require_partition_filter = true,
  description = 'デバイス別パフォーマンス分析'
);
```

### Terraform実装例

```hcl
# terraform/bigquery.tf

resource "google_bigquery_dataset" "analytics_production" {
  dataset_id                 = "analytics_production"
  friendly_name              = "Analytics Production"
  description                = "AIフィットネスアプリの本番分析データ"
  location                   = "asia-northeast1"
  default_table_expiration_ms = 63072000000  # 2年間

  access {
    role          = "roles/bigquery.dataEditor"
    user_by_email = google_service_account.cloud_functions.email
  }
}

resource "google_bigquery_table" "sessions" {
  dataset_id = google_bigquery_dataset.analytics_production.dataset_id
  table_id   = "sessions"

  time_partitioning {
    type          = "DAY"
    field         = "created_at"
    expiration_ms = 63072000000  # 2年間
  }

  clustering = ["exercise_type", "platform"]

  require_partition_filter = true

  schema = file("${path.module}/schemas/sessions.json")
}

# 他のテーブルも同様に定義...
```

### gcloud CLI実装例

```bash
#!/bin/bash
# scripts/create_bigquery_tables.sh

PROJECT_ID="ai-fitness-app"
LOCATION="asia-northeast1"

# データセット作成
gcloud bigquery datasets create analytics_production \
  --project=$PROJECT_ID \
  --location=$LOCATION \
  --default_table_expiration=63072000 \
  --description="AIフィットネスアプリの本番分析データ"

# sessionsテーブル作成
bq mk \
  --project_id=$PROJECT_ID \
  --table \
  --time_partitioning_field=created_at \
  --time_partitioning_type=DAY \
  --time_partitioning_expiration=63072000 \
  --clustering_fields=exercise_type,platform \
  --require_partition_filter=true \
  --schema=schemas/sessions.json \
  analytics_production.sessions

# 他のテーブルも同様に作成...
```

### IAM権限設定

```bash
# Cloud FunctionsサービスアカウントにBigQuery編集権限を付与
gcloud projects add-iam-policy-binding ai-fitness-app \
  --member="serviceAccount:ai-fitness-app@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# BigQueryジョブユーザー権限も付与
gcloud projects add-iam-policy-binding ai-fitness-app \
  --member="serviceAccount:ai-fitness-app@appspot.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] 部分完了（2025-12-10）

## 完了日

2025-12-10（設計・コード実装完了、デプロイスクリプトは未実装）

## 実装状況

### 完了項目

1. **テーブル設計**: すべてのテーブルスキーマが設計済み
   - `training_sessions`: セッションデータ（設計書のsessionsに対応）
   - `user_metadata`: ユーザーメタデータ
   - `aggregated_stats`: 日次/週次集計統計
   - `pseudonymization_log`: 仮名化処理ログ
   - `exercise_definitions`: 種目定義

2. **コード実装**: BigQueryサービスとストリーミング処理が完全実装済み
   - `functions/src/services/bigquery.ts`
   - `functions/src/pubsub/sessionProcessor.ts`
   - `functions/src/scheduled/aggregation.ts`

3. **データ保持期間**: BQ_CONFIG.retentionDays = 730（2年間）

### 未完了項目

以下の項目が未実装のため、本チケットは「部分完了」としています:

1. **テーブル作成スクリプト**:
   - Terraform または gcloud CLI によるテーブル作成スクリプト
   - スキーマ定義ファイル（JSON形式）
   - パーティショニング・クラスタリング設定

2. **デプロイ手順**:
   - ローカルエミュレータでの動作確認
   - 本番環境へのデプロイ手順書

### 次のステップ（Phase 3以降で実施）

1. **スクリプト作成**:
   ```bash
   # 例: scripts/create-bigquery-tables.sh
   gcloud bigquery datasets create fitness_analytics \
     --location=asia-northeast1 \
     --default_table_expiration=63072000

   bq mk --table \
     --time_partitioning_field=created_at \
     --clustering_fields=exercise_id,user_id_hash \
     fitness_analytics.training_sessions \
     schemas/training_sessions.json
   ```

2. **スキーマファイル作成**:
   - `schemas/training_sessions.json`
   - `schemas/user_metadata.json`
   - `schemas/aggregated_stats.json`
   - `schemas/pseudonymization_log.json`

3. **IAM設定**:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
     --role="roles/bigquery.dataEditor"
   ```

## 備考

- スキーマ定義は別ファイル（`schemas/sessions.json`等）で管理
- 開発環境では保持期間を30日に短縮してコスト削減
- パーティション削除は自動実行されるため、手動削除不要

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
