#!/bin/bash
# BigQuery テーブル作成スクリプト
# 仕様書: docs/specs/04_BigQuery設計書_v3_3.md
#
# 使用方法:
#   ./scripts/bigquery/create_tables.sh [prod|dev]
#
# 前提条件:
#   - gcloud CLI がインストール済み
#   - 適切なプロジェクトに認証済み
#   - BigQuery API が有効化済み
#   - データセットが作成済み（fitness_analytics, fitness_analytics_dev）

set -e

# 環境設定
ENV=${1:-dev}

if [ "$ENV" = "prod" ]; then
  PROJECT_ID="tokyo-list-478804-e5"
  DATASET_ID="fitness_analytics"
  echo "本番環境にテーブルを作成します..."
elif [ "$ENV" = "dev" ]; then
  PROJECT_ID="tokyo-list-478804-e5"
  DATASET_ID="fitness_analytics_dev"
  echo "開発環境にテーブルを作成します..."
else
  echo "エラー: 環境は 'prod' または 'dev' を指定してください"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_DIR="$SCRIPT_DIR/../../bigquery_schemas"

echo "プロジェクト: $PROJECT_ID"
echo "データセット: $DATASET_ID"
echo ""

# training_sessions テーブル
echo "1. training_sessions テーブルを作成中..."
bq mk --table \
  --schema "$SCHEMA_DIR/training_sessions.json" \
  --time_partitioning_field created_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields user_id_hash,exercise_id \
  --require_partition_filter \
  --description "トレーニングセッション記録(GDPR準拠: 2年間保持)" \
  --label env:$ENV \
  --label data_classification:pseudonymized \
  "$PROJECT_ID:$DATASET_ID.training_sessions" || echo "テーブルは既に存在します"

# user_metadata テーブル
echo "2. user_metadata テーブルを作成中..."
bq mk --table \
  --schema "$SCHEMA_DIR/user_metadata.json" \
  --time_partitioning_field updated_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields user_id_hash,country_code \
  --description "ユーザーメタデータ(仮名化済み、個人特定不可)" \
  --label env:$ENV \
  --label data_classification:pseudonymized \
  "$PROJECT_ID:$DATASET_ID.user_metadata" || echo "テーブルは既に存在します"

# aggregated_stats テーブル
echo "3. aggregated_stats テーブルを作成中..."
bq mk --table \
  --schema "$SCHEMA_DIR/aggregated_stats.json" \
  --time_partitioning_field stat_date \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 63072000 \
  --clustering_fields exercise_id,country_code \
  --require_partition_filter \
  --description "事前集計統計データ(コスト削減のため)" \
  --label env:$ENV \
  --label data_type:aggregated \
  "$PROJECT_ID:$DATASET_ID.aggregated_stats" || echo "テーブルは既に存在します"

# pseudonymization_log テーブル
echo "4. pseudonymization_log テーブルを作成中..."
bq mk --table \
  --schema "$SCHEMA_DIR/pseudonymization_log.json" \
  --time_partitioning_field created_at \
  --time_partitioning_type DAY \
  --time_partitioning_expiration 7776000 \
  --clustering_fields status,source_collection \
  --require_partition_filter \
  --description "仮名化処理ログ(障害対応と監査用)" \
  --label env:$ENV \
  --label data_type:audit_log \
  "$PROJECT_ID:$DATASET_ID.pseudonymization_log" || echo "テーブルは既に存在します"

# exercise_definitions テーブル (マスターデータ、パーティションなし)
echo "5. exercise_definitions テーブルを作成中..."
bq mk --table \
  --schema "$SCHEMA_DIR/exercise_definitions.json" \
  --description "トレーニング種目マスターデータ" \
  --label env:$ENV \
  --label data_type:master \
  "$PROJECT_ID:$DATASET_ID.exercise_definitions" || echo "テーブルは既に存在します"

echo ""
echo "テーブル作成が完了しました。"
echo ""

# テーブル一覧を表示
echo "作成されたテーブル:"
bq ls "$PROJECT_ID:$DATASET_ID"
