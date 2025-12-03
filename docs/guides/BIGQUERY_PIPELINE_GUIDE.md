# BigQuery パイプライン構築ガイド

**対象者**: 開発者・データエンジニア
**所要時間**: 約90分
**前提条件**:
- `BIGQUERY_SETUP_GUIDE.md` の全ステップ完了
- Firebase プロジェクト（`tokyo-list-478804-e5`）作成済み
- Cloud Functions の基本的な知識
- TypeScript の基本的な知識

**参照仕様書**:
- `docs/specs/04_BigQuery設計書_v3_3.md`
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md`

---

## 目次

1. [パイプライン概要](#1-パイプライン概要)
2. [テーブルスキーマ作成](#2-テーブルスキーマ作成)
3. [仮名化処理の実装確認](#3-仮名化処理の実装確認)
4. [Pub/Subサブスクリプション設定](#4-pubsubサブスクリプション設定)
5. [Cloud Functionsからの連携テスト](#5-cloud-functionsからの連携テスト)
6. [データパイプラインの検証](#6-データパイプラインの検証)
7. [監視とアラート設定](#7-監視とアラート設定)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. パイプライン概要

### 1.1 データフロー全体像

```
┌─────────────────────────────────────────────────────────────────────┐
│                        データパイプライン                              │
└─────────────────────────────────────────────────────────────────────┘

  Firestore (sessions)
        │
        │ onCreate トリガー
        ▼
  Cloud Functions (onSessionCreate)
        │
        │ Pub/Sub メッセージ発行
        ▼
  Pub/Sub Topic (training-sessions-stream)
        │
        │ サブスクリプション
        ▼
  Cloud Functions (processSession)
        │
        ├─ ユーザーID仮名化 (SHA-256)
        ├─ データ変換
        └─ BigQuery挿入
              │
              ├─ 成功 → BigQuery (training_sessions)
              │
              └─ 失敗 → リトライ (最大3回)
                      │
                      └─ 最終失敗 → DLQ (training-sessions-dlq)
```

### 1.2 GDPR準拠とプライバシー保護

**仮名化処理**:
- ユーザーIDをSHA-256でハッシュ化
- 元のユーザーIDは BigQuery に保存されない
- 個人を直接特定できないデータのみ保存

**データ保持期間**:
- 2年間（730日）で自動削除
- GDPR第5条1項(e)に準拠

---

## 2. テーブルスキーマ作成

### 2.1 training_sessions テーブル

#### 2.1.1 スキーマ定義

このテーブルには、トレーニングセッションの詳細データ（骨格座標、スコア、デバイス情報）が保存されます。

**作成方法**:

**方法1: bq コマンドライン（推奨）**

```bash
# プロジェクトルートに移動
cd C:\Users\katos\Desktop\ai_fitness_app

# スキーマファイルを作成（後述）

# Linux/Mac用（複数行）:
bq mk \
  --table \
  --schema=bigquery_schemas/training_sessions.json \
  --time_partitioning_field=created_at \
  --time_partitioning_type=DAY \
  --time_partitioning_expiration=63072000 \
  --clustering_fields=user_id_hash,exercise_id \
  --description="トレーニングセッション記録(GDPR準拠: 2年間保持)" \
  --label=env:production \
  --label=data_classification:pseudonymized \
  tokyo-list-478804-e5:fitness_analytics.training_sessions

# Windows用（1行で実行）:
bq mk --table --schema=bigquery_schemas/training_sessions.json --time_partitioning_field=created_at --time_partitioning_type=DAY --time_partitioning_expiration=63072000 --clustering_fields=user_id_hash,exercise_id --description="トレーニングセッション記録(GDPR準拠: 2年間保持)" --label=env:production --label=data_classification:pseudonymized tokyo-list-478804-e5:fitness_analytics.training_sessions
```

**方法2: BigQuery Console GUI**

1. [BigQuery Console](https://console.cloud.google.com/bigquery) を開く
2. `fitness_analytics` データセットを選択
3. 「テーブルを作成」をクリック
4. 以下を設定:
   - **テーブル名**: `training_sessions`
   - **パーティション**: `created_at`（日単位）
   - **パーティション有効期限**: `63072000` 秒（730日）
   - **クラスタリング**: `user_id_hash, exercise_id`
5. 「スキーマ」タブで下記のスキーマを入力

#### 2.1.2 スキーマファイル

`bigquery_schemas/training_sessions.json` を作成:

```json
[
  {
    "name": "session_id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "セッションID(UUIDv4形式)"
  },
  {
    "name": "user_id_hash",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "ユーザーIDのSHA-256ハッシュ値"
  },
  {
    "name": "exercise_id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "トレーニング種目ID"
  },
  {
    "name": "start_time",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "セッション開始時刻(UTC)"
  },
  {
    "name": "end_time",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "セッション終了時刻(UTC)"
  },
  {
    "name": "duration_seconds",
    "type": "INT64",
    "mode": "REQUIRED",
    "description": "セッション時間(秒)"
  },
  {
    "name": "created_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "レコード作成日時(UTC)"
  },
  {
    "name": "rep_count",
    "type": "INT64",
    "mode": "NULLABLE",
    "description": "回数(レップ数)"
  },
  {
    "name": "set_count",
    "type": "INT64",
    "mode": "NULLABLE",
    "description": "セット数"
  },
  {
    "name": "average_score",
    "type": "FLOAT64",
    "mode": "NULLABLE",
    "description": "平均スコア(0-100)"
  },
  {
    "name": "max_score",
    "type": "FLOAT64",
    "mode": "NULLABLE",
    "description": "最大スコア(0-100)"
  },
  {
    "name": "min_score",
    "type": "FLOAT64",
    "mode": "NULLABLE",
    "description": "最小スコア(0-100)"
  },
  {
    "name": "landmarks",
    "type": "RECORD",
    "mode": "REPEATED",
    "description": "フレーム単位の骨格座標データ(30fps想定)",
    "fields": [
      {
        "name": "timestamp",
        "type": "TIMESTAMP",
        "mode": "NULLABLE",
        "description": "フレームのタイムスタンプ"
      },
      {
        "name": "frame_number",
        "type": "INT64",
        "mode": "NULLABLE",
        "description": "フレーム番号(0から開始)"
      },
      {
        "name": "keypoints",
        "type": "RECORD",
        "mode": "REPEATED",
        "description": "MediaPipe 33関節点の座標",
        "fields": [
          {
            "name": "landmark_id",
            "type": "INT64",
            "mode": "NULLABLE",
            "description": "MediaPipe Pose ランドマークID(0-32)"
          },
          {
            "name": "x",
            "type": "FLOAT64",
            "mode": "NULLABLE",
            "description": "X座標(正規化: 0.0-1.0)"
          },
          {
            "name": "y",
            "type": "FLOAT64",
            "mode": "NULLABLE",
            "description": "Y座標(正規化: 0.0-1.0)"
          },
          {
            "name": "z",
            "type": "FLOAT64",
            "mode": "NULLABLE",
            "description": "Z座標(深度、正規化)"
          },
          {
            "name": "visibility",
            "type": "FLOAT64",
            "mode": "NULLABLE",
            "description": "可視性スコア(0.0-1.0)"
          }
        ]
      }
    ]
  },
  {
    "name": "device_info",
    "type": "RECORD",
    "mode": "NULLABLE",
    "description": "デバイス情報(ML移行時の分析用)",
    "fields": [
      {
        "name": "os",
        "type": "STRING",
        "mode": "NULLABLE",
        "description": "OS種別(iOS/Android)"
      },
      {
        "name": "os_version",
        "type": "STRING",
        "mode": "NULLABLE",
        "description": "OSバージョン"
      },
      {
        "name": "device_model",
        "type": "STRING",
        "mode": "NULLABLE",
        "description": "デバイスモデル名"
      },
      {
        "name": "app_version",
        "type": "STRING",
        "mode": "NULLABLE",
        "description": "アプリバージョン"
      }
    ]
  },
  {
    "name": "region",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "リージョンコード(ISO 3166-1 alpha-2)"
  },
  {
    "name": "is_deleted",
    "type": "BOOL",
    "mode": "NULLABLE",
    "description": "論理削除フラグ"
  },
  {
    "name": "deleted_at",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "論理削除日時"
  }
]
```

#### 2.1.3 テーブル作成の確認

```bash
# テーブルの詳細を確認
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions

# パーティション設定の確認
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions | grep -A 5 "timePartitioning"

# 期待される出力:
# "timePartitioning": {
#   "expirationMs": "63072000000",
#   "field": "created_at",
#   "type": "DAY"
# }
```

### 2.2 user_metadata テーブル

#### 2.2.1 スキーマ定義

このテーブルには、ユーザーのメタデータ（仮名化済み）が保存されます。

**作成コマンド**:

```bash
# Linux/Mac用（複数行）:
bq mk \
  --table \
  --schema=bigquery_schemas/user_metadata.json \
  --time_partitioning_field=updated_at \
  --time_partitioning_type=DAY \
  --time_partitioning_expiration=63072000 \
  --clustering_fields=user_id_hash,country_code \
  --description="ユーザーメタデータ(仮名化済み、個人特定不可)" \
  --label=env:production \
  --label=data_classification:pseudonymized \
  tokyo-list-478804-e5:fitness_analytics.user_metadata

# Windows用（1行で実行）:
bq mk --table --schema=bigquery_schemas/user_metadata.json --time_partitioning_field=updated_at --time_partitioning_type=DAY --time_partitioning_expiration=63072000 --clustering_fields=user_id_hash,country_code --description="ユーザーメタデータ(仮名化済み、個人特定不可)" --label=env:production --label=data_classification:pseudonymized tokyo-list-478804-e5:fitness_analytics.user_metadata
```

#### 2.2.2 スキーマファイル

`bigquery_schemas/user_metadata.json` を作成:

```json
[
  {
    "name": "user_id_hash",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "ユーザーIDのSHA-256ハッシュ値"
  },
  {
    "name": "account_created_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "アカウント作成日時"
  },
  {
    "name": "last_active_at",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "最終アクティブ日時"
  },
  {
    "name": "updated_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "レコード更新日時"
  },
  {
    "name": "total_sessions",
    "type": "INT64",
    "mode": "NULLABLE",
    "description": "累計セッション数"
  },
  {
    "name": "total_duration_seconds",
    "type": "INT64",
    "mode": "NULLABLE",
    "description": "累計トレーニング時間(秒)"
  },
  {
    "name": "average_session_score",
    "type": "FLOAT64",
    "mode": "NULLABLE",
    "description": "平均セッションスコア(0-100)"
  },
  {
    "name": "age_group",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "年齢層: 18-25, 26-35, 36-45, 46+"
  },
  {
    "name": "country_code",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "国コード(ISO 3166-1 alpha-2)"
  },
  {
    "name": "subscription_plan",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "サブスクリプションプラン: free, premium"
  },
  {
    "name": "is_deleted",
    "type": "BOOL",
    "mode": "NULLABLE",
    "description": "論理削除フラグ"
  },
  {
    "name": "deleted_at",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "論理削除日時"
  }
]
```

### 2.3 aggregated_stats テーブル

#### 2.3.1 スキーマ定義

このテーブルには、日次集計データが保存されます。リアルタイムクエリのコスト削減に使用します。

**作成コマンド**:

```bash
# Linux/Mac用（複数行）:
bq mk \
  --table \
  --schema=bigquery_schemas/aggregated_stats.json \
  --time_partitioning_field=stat_date \
  --time_partitioning_type=DAY \
  --time_partitioning_expiration=63072000 \
  --clustering_fields=stat_type,region \
  --description="集計統計データ(日次バッチ処理)" \
  --label=env:production \
  --label=data_classification:aggregated \
  tokyo-list-478804-e5:fitness_analytics.aggregated_stats

# Windows用（1行で実行）:
bq mk --table --schema=bigquery_schemas/aggregated_stats.json --time_partitioning_field=stat_date --time_partitioning_type=DAY --time_partitioning_expiration=63072000 --clustering_fields=stat_type,region --description="集計統計データ(日次バッチ処理)" --label=env:production --label=data_classification:aggregated tokyo-list-478804-e5:fitness_analytics.aggregated_stats
```

#### 2.3.2 スキーマファイル

`bigquery_schemas/aggregated_stats.json` を作成:

```json
[
  {
    "name": "stat_date",
    "type": "DATE",
    "mode": "REQUIRED",
    "description": "統計日付"
  },
  {
    "name": "stat_type",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "統計種別: DAU, WAU, MAU, session_count, avg_score"
  },
  {
    "name": "metric_value",
    "type": "FLOAT64",
    "mode": "REQUIRED",
    "description": "統計値"
  },
  {
    "name": "region",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "リージョンコード(ISO 3166-1 alpha-2)"
  },
  {
    "name": "exercise_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "トレーニング種目ID（種目別統計の場合）"
  },
  {
    "name": "created_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "レコード作成日時"
  }
]
```

### 2.4 テーブル作成の全体確認

```bash
# 全テーブルの一覧を表示
bq ls tokyo-list-478804-e5:fitness_analytics

# 期待される出力:
#  tableId                    Type    Labels
# -------------------------- ------- --------
#  training_sessions          TABLE   env:production, data_classification:pseudonymized
#  user_metadata              TABLE   env:production, data_classification:pseudonymized
#  aggregated_stats           TABLE   env:production, data_classification:aggregated
```

---

## 3. 仮名化処理の実装確認

### 3.1 既存実装の確認

プロジェクトには既に `functions/src/services/bigquery.ts` に仮名化処理が実装されています。

**確認ポイント**:

```bash
# BigQueryサービスファイルを確認
cat C:\Users\katos\Desktop\ai_fitness_app\functions\src\services\bigquery.ts | grep -A 10 "hashData"
```

**期待される内容**:
```typescript
/**
 * 匿名化のために機密データをハッシュ化
 */
private hashData(data: string): string {
  return crypto
    .createHash("sha256")
    .update(data + (process.env.ANONYMIZATION_SALT ?? ""))
    .digest("hex")
    .substring(0, 16);
}
```

### 3.2 環境変数の設定

仮名化処理には `ANONYMIZATION_SALT` 環境変数が必要です。

**ローカル開発環境**:

`functions/.env.local` を作成:

```bash
# ランダムな64文字の文字列を生成（本番環境では安全な方法で管理）
ANONYMIZATION_SALT=your-secure-random-salt-here-64-characters-minimum
```

**本番環境**:

```bash
# Firebase Functions の環境変数を設定
firebase functions:config:set bigquery.anonymization_salt="your-secure-random-salt-here"

# 設定の確認
firebase functions:config:get
```

> **重要**: `ANONYMIZATION_SALT` は絶対に公開しないでください。この値が漏洩すると、仮名化の効果が失われます。

### 3.3 仮名化処理のテスト

**ローカルテスト**:

```bash
cd functions

# テストを実行
npm test -- bigquery.test.ts

# 期待される出力:
# PASS tests/services/bigquery.test.ts
#   BigQueryService
#     ✓ should hash user ID with salt (5ms)
#     ✓ should anonymize user data (3ms)
#     ✓ should transform session data (4ms)
```

---

## 4. Pub/Subサブスクリプション設定

### 4.1 サブスクリプションの詳細設定

`BIGQUERY_SETUP_GUIDE.md` で基本的なサブスクリプションを作成しましたが、ここでは詳細設定を行います。

#### 4.1.1 メインサブスクリプションの更新

```bash
# メインサブスクリプションの詳細設定
gcloud pubsub subscriptions update training-sessions-stream-sub \
  --ack-deadline=60 \
  --message-retention-duration=7d \
  --dead-letter-topic=training-sessions-dlq \
  --max-delivery-attempts=5 \
  --min-retry-delay=10s \
  --max-retry-delay=600s \
  --project=tokyo-list-478804-e5
```

**設定値の説明**:
- **ack-deadline**: 60秒（処理完了の確認期限）
- **message-retention-duration**: 7日間（未確認メッセージの保持期間）
- **max-delivery-attempts**: 5回（最大配信試行回数）
- **min-retry-delay**: 10秒（最小リトライ遅延）
- **max-retry-delay**: 600秒（最大リトライ遅延 = 10分）

#### 4.1.2 DLQサブスクリプションの設定

```bash
# DLQサブスクリプションの設定
gcloud pubsub subscriptions update training-sessions-dlq-sub \
  --ack-deadline=600 \
  --message-retention-duration=30d \
  --project=tokyo-list-478804-e5
```

**設定値の説明**:
- **ack-deadline**: 600秒（手動処理用に長め）
- **message-retention-duration**: 30日間（長期保存）

### 4.2 サブスクリプションの確認

```bash
# メインサブスクリプションの詳細を確認
gcloud pubsub subscriptions describe training-sessions-stream-sub \
  --project=tokyo-list-478804-e5

# DLQ設定が含まれているか確認
# 期待される出力:
# deadLetterPolicy:
#   deadLetterTopic: projects/tokyo-list-478804-e5/topics/training-sessions-dlq
#   maxDeliveryAttempts: 5
```

---

## 5. Cloud Functionsからの連携テスト

### 5.1 テストデータの準備

#### 5.1.1 開発用データセットの使用

本番データに影響を与えないよう、`fitness_analytics_dev` データセットでテストします。

```bash
# 開発用テーブルを作成

# Linux/Mac用（複数行）:
bq mk \
  --table \
  --schema=bigquery_schemas/training_sessions.json \
  --time_partitioning_field=created_at \
  --time_partitioning_type=DAY \
  --time_partitioning_expiration=2592000 \
  --clustering_fields=user_id_hash,exercise_id \
  --description="開発用トレーニングセッション記録（30日保持）" \
  tokyo-list-478804-e5:fitness_analytics_dev.training_sessions

# Windows用（1行で実行）:
bq mk --table --schema=bigquery_schemas/training_sessions.json --time_partitioning_field=created_at --time_partitioning_type=DAY --time_partitioning_expiration=2592000 --clustering_fields=user_id_hash,exercise_id --description="開発用トレーニングセッション記録（30日保持）" tokyo-list-478804-e5:fitness_analytics_dev.training_sessions
```

#### 5.1.2 環境変数の設定（開発環境）

`functions/.env.local` に追加:

```bash
BIGQUERY_DATASET=fitness_analytics_dev
```

### 5.2 エミュレータでのテスト

#### 5.2.1 Firebase Emulators の起動

```bash
# プロジェクトルートに移動
cd C:\Users\katos\Desktop\ai_fitness_app

# エミュレータ起動
firebase emulators:start

# 期待される出力:
# ✔  All emulators ready! It is now safe to connect your app.
# ┌─────────────────────────────────────────────────────────────┐
# │ ✔  All emulators started                                    │
# │ View Emulator UI at http://127.0.0.1:4000                   │
# └─────────────────────────────────────────────────────────────┘
```

#### 5.2.2 テストセッションの作成

**方法1: Emulator UI を使用**

1. ブラウザで `http://127.0.0.1:4000` を開く
2. 「Firestore」タブをクリック
3. 「Start collection」をクリック
4. コレクションID: `users`
5. ドキュメントID: `test_user_001`
6. 「Add document」をクリック
7. サブコレクション「sessions」を追加
8. 以下のデータを入力:

```json
{
  "exerciseType": "squat",
  "repCount": 10,
  "averageScore": 85.5,
  "totalScore": 855,
  "duration": 120,
  "sessionMetadata": {
    "averageFps": 30,
    "deviceInfo": {
      "platform": "iOS",
      "model": "iPhone 13"
    },
    "appVersion": "1.0.0"
  },
  "createdAt": "2025-11-24T10:00:00Z"
}
```

**方法2: REST API を使用**

```bash
# Firestore REST API エンドポイント（エミュレータ）
curl -X POST "http://127.0.0.1:8080/v1/projects/tokyo-list-478804-e5/databases/(default)/documents/users/test_user_001/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "exerciseType": {"stringValue": "squat"},
      "repCount": {"integerValue": "10"},
      "averageScore": {"doubleValue": 85.5},
      "totalScore": {"integerValue": "855"},
      "duration": {"integerValue": "120"},
      "createdAt": {"timestampValue": "2025-11-24T10:00:00Z"}
    }
  }'
```

### 5.3 本番環境でのテスト

> **警告**: 本番環境でのテストは、コストが発生します。慎重に実行してください。

#### 5.3.1 Cloud Functions のデプロイ

```bash
# Functions のビルド
cd functions
npm run build

# デプロイ
firebase deploy --only functions

# 期待される出力:
# ✔  functions: Finished running predeploy script.
# ✔  functions[...]: Successful create operation.
# ✔  Deploy complete!
```

#### 5.3.2 テストセッションの作成

Firestore Console で手動作成、またはモバイルアプリからセッションを作成します。

```bash
# Cloud Functions のログを確認
firebase functions:log --only processSession

# 期待されるログ:
# Processing session: <session_id>, retry: 0
# Session inserted to BigQuery: <session_id>
```

---

## 6. データパイプラインの検証

### 6.1 BigQueryでのデータ確認

#### 6.1.1 挿入されたデータの確認

```bash
# training_sessions テーブルのデータ件数を確認
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) as total_sessions
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`'

# 最新10件のセッションを確認
bq query --use_legacy_sql=false \
  'SELECT
     session_id,
     user_id_hash,
     exercise_id,
     average_score,
     created_at
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   ORDER BY created_at DESC
   LIMIT 10'
```

#### 6.1.2 仮名化の確認

```bash
# ユーザーIDがハッシュ化されているか確認
bq query --use_legacy_sql=false \
  'SELECT
     user_id_hash,
     COUNT(*) as session_count
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   GROUP BY user_id_hash
   ORDER BY session_count DESC
   LIMIT 10'

# 期待される出力: user_id_hash は64文字のSHA-256ハッシュ値
# user_id_hash                                                      | session_count
# -----------------------------------------------------------------|---------------
# 5f4dcc3b5aa765d61d8327deb882cf99abc123def456789012345678901234  | 5
```

### 6.2 パーティション設定の確認

```bash
# パーティション一覧を確認
bq query --use_legacy_sql=false \
  'SELECT
     _PARTITIONTIME as partition_date,
     COUNT(*) as row_count
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   GROUP BY partition_date
   ORDER BY partition_date DESC
   LIMIT 10'
```

### 6.3 クラスタリング効果の確認

```bash
# クラスタリングなしのクエリ（全パーティションスキャン）
bq query --use_legacy_sql=false --dry_run \
  'SELECT *
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   WHERE user_id_hash = "5f4dcc3b5aa765d61d8327deb882cf99"'

# 出力: Query will process X bytes
# (X はスキャンされるバイト数)

# クラスタリング + パーティションフィルタあり
bq query --use_legacy_sql=false --dry_run \
  'SELECT *
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
     AND user_id_hash = "5f4dcc3b5aa765d61d8327deb882cf99"'

# 出力: Query will process Y bytes
# (Y << X、クラスタリングにより大幅に削減)
```

### 6.4 DLQ (Dead Letter Queue) の確認

```bash
# DLQトピックのメッセージ数を確認
gcloud pubsub topics list-subscriptions training-sessions-dlq \
  --project=tokyo-list-478804-e5

# DLQサブスクリプションからメッセージを取得（確認のみ、Ackしない）
gcloud pubsub subscriptions pull training-sessions-dlq-sub \
  --limit=10 \
  --auto-ack=false \
  --project=tokyo-list-478804-e5

# DLQにメッセージがある場合、手動でリカバリ
```

**DLQメッセージのリカバリ手順**:

1. エラー原因を特定（ログを確認）
2. 原因を修正（スキーマ変更、バグ修正など）
3. Cloud Functions を再デプロイ
4. DLQメッセージを再送信:

```bash
# DLQメッセージをメイントピックに再送信
gcloud pubsub topics publish training-sessions-stream \
  --message='<DLQメッセージの内容>' \
  --project=tokyo-list-478804-e5
```

---

## 7. 監視とアラート設定

### 7.1 Cloud Monitoring ダッシュボード作成

#### 7.1.1 BigQuery 監視ダッシュボード

1. [Cloud Console](https://console.cloud.google.com/) → 「モニタリング」→「ダッシュボード」
2. 「ダッシュボードを作成」をクリック
3. ダッシュボード名: `BigQuery Pipeline Monitoring`
4. 以下のグラフを追加:

**グラフ1: ストリーミング挿入数**
- **リソースタイプ**: BigQuery Table
- **メトリック**: `bigquery.googleapis.com/streaming/row_count`
- **フィルタ**: `dataset_id="fitness_analytics"`

**グラフ2: ストリーミング挿入エラー数**
- **リソースタイプ**: BigQuery Table
- **メトリック**: `bigquery.googleapis.com/streaming/error_count`
- **フィルタ**: `dataset_id="fitness_analytics"`

**グラフ3: Pub/Sub メッセージ数**
- **リソースタイプ**: Pub/Sub Topic
- **メトリック**: `pubsub.googleapis.com/topic/send_message_operation_count`
- **フィルタ**: `topic_id="training-sessions-stream"`

**グラフ4: Cloud Functions 実行時間**
- **リソースタイプ**: Cloud Function
- **メトリック**: `cloudfunctions.googleapis.com/function/execution_times`
- **フィルタ**: `function_name="processSession"`

### 7.2 アラートポリシーの作成

#### 7.2.1 BigQuery挿入エラーアラート

```bash
# Cloud Monitoring API を有効化
gcloud services enable monitoring.googleapis.com --project=tokyo-list-478804-e5
```

**GUIでの作成**:

1. 「モニタリング」→「アラート」→「ポリシーを作成」
2. **条件**:
   - **ターゲット**: BigQuery Table
   - **メトリック**: `bigquery.googleapis.com/streaming/error_count`
   - **フィルタ**: `dataset_id="fitness_analytics"`
   - **しきい値**: `> 10`（10件以上のエラー）
   - **期間**: 5分間
3. **通知チャネル**: メール通知（事前に作成したもの）
4. **ドキュメント**:
   ```
   BigQueryストリーミング挿入でエラーが発生しています。

   対処方法:
   1. Cloud Functions のログを確認: firebase functions:log
   2. DLQを確認: gcloud pubsub subscriptions pull training-sessions-dlq-sub
   3. スキーマエラーの場合、テーブル定義を確認
   ```

#### 7.2.2 DLQメッセージ蓄積アラート

**条件**:
- **ターゲット**: Pub/Sub Subscription
- **メトリック**: `pubsub.googleapis.com/subscription/num_undelivered_messages`
- **フィルタ**: `subscription_id="training-sessions-dlq-sub"`
- **しきい値**: `> 100`（100件以上のDLQメッセージ）
- **期間**: 10分間

**通知ドキュメント**:
```
DLQに多数のメッセージが蓄積されています。データパイプラインに問題がある可能性があります。

対処方法:
1. DLQメッセージを確認
2. エラーログを分析
3. 原因を修正後、DLQメッセージを再処理
```

#### 7.2.3 コストアラート（日次）

**条件**:
- **ターゲット**: BigQuery Project
- **メトリック**: 請求コスト
- **しきい値**: `> $5/日`
- **期間**: 24時間

**通知ドキュメント**:
```
BigQueryの日次コストが$5を超えました。

確認事項:
1. 想定外のクエリが実行されていないか確認
2. パーティションフィルタが正しく使用されているか確認
3. 集計テーブル (aggregated_stats) を活用しているか確認
```

### 7.3 ログベースのメトリクス

#### 7.3.1 仮名化成功率の追跡

```bash
# Cloud Logging でログベースメトリクスを作成
gcloud logging metrics create pseudonymization_success_rate \
  --description="仮名化処理の成功率" \
  --log-filter='resource.type="cloud_function"
    AND resource.labels.function_name="processSession"
    AND jsonPayload.message="Session inserted to BigQuery"' \
  --project=tokyo-list-478804-e5

# 仮名化失敗率
gcloud logging metrics create pseudonymization_failure_rate \
  --description="仮名化処理の失敗率" \
  --log-filter='resource.type="cloud_function"
    AND resource.labels.function_name="processSession"
    AND severity="ERROR"
    AND jsonPayload.message=~"Error processing session"' \
  --project=tokyo-list-478804-e5
```

---

## 8. トラブルシューティング

### 8.1 よくあるエラーと解決方法

#### エラー1: 「Invalid schema update」

**原因**: テーブルスキーマと挿入データの型が一致していません。

**解決方法**:

```bash
# テーブルのスキーマを確認
bq show --schema --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions

# Cloud Functions のログを確認
firebase functions:log --only processSession

# スキーマエラーの詳細を確認
# 例: "Provided Schema does not match Table"
```

**対処**:
1. `bigquery_schemas/training_sessions.json` を修正
2. テーブルを再作成（開発環境で）
3. Cloud Functions を再デプロイ

#### エラー2: 「Quota exceeded」

**原因**: BigQueryのストリーミング挿入クォータを超えています。

**現在のクォータ**:
- 1秒あたり100,000行/テーブル
- 1秒あたり100MB/テーブル

**解決方法**:

```bash
# 挿入レートを確認
bq query --use_legacy_sql=false \
  'SELECT
     TIMESTAMP_TRUNC(created_at, SECOND) as second,
     COUNT(*) as rows_per_second
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
   GROUP BY second
   ORDER BY rows_per_second DESC
   LIMIT 10'
```

**対処**:
- バッチ挿入を使用（ストリーミングの代わり）
- Cloud Tasks でレート制限を実装
- クォータ引き上げをリクエスト

#### エラー3: 「Permission denied on BigQuery table」

**原因**: Cloud Functions サービスアカウントに権限がありません。

**解決方法**:

```bash
# サービスアカウントの権限を確認
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:firebase-adminsdk-*"

# 必要な権限を付与
SERVICE_ACCOUNT="firebase-adminsdk-xxxxx@tokyo-list-478804-e5.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.jobUser"
```

#### エラー4: Pub/Sub メッセージが処理されない

**原因**: サブスクリプション設定またはCloud Functions のトリガーに問題があります。

**確認手順**:

```bash
# サブスクリプションの未配信メッセージ数を確認
gcloud pubsub subscriptions describe training-sessions-stream-sub \
  --project=tokyo-list-478804-e5 \
  | grep numUndeliveredMessages

# Cloud Functions のトリガーを確認
firebase functions:list

# 期待される出力:
# processSession (asia-northeast1)
#   Trigger: projects/tokyo-list-478804-e5/topics/training-sessions-stream
```

**対処**:
1. Cloud Functions が正しくデプロイされているか確認
2. サブスクリプションのAck期限を延長
3. 手動でメッセージをプル（テスト用）:

```bash
gcloud pubsub subscriptions pull training-sessions-stream-sub \
  --limit=1 \
  --auto-ack=false \
  --project=tokyo-list-478804-e5
```

#### エラー5: パーティション有効期限が機能しない

**原因**: パーティション設定が正しくありません。

**確認手順**:

```bash
# パーティション設定を確認
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions \
  | grep -A 5 "timePartitioning"

# 期待される出力:
# "timePartitioning": {
#   "expirationMs": "63072000000",
#   "field": "created_at",
#   "type": "DAY"
# }
```

**対処**:
- `expirationMs` が正しいか確認（63072000000ミリ秒 = 730日）
- パーティションフィールドが `created_at` であるか確認

### 8.2 デバッグ用クエリ

#### デバッグ1: 最近の挿入エラーを確認

```sql
-- BigQuery でエラーログを確認
SELECT
  timestamp,
  severity,
  jsonPayload.message as error_message,
  jsonPayload.collection as collection,
  jsonPayload.documentId as document_id
FROM `tokyo-list-478804-e5.logs.cloudaudit_googleapis_com_data_access`
WHERE
  resource.type = "bigquery_table"
  AND resource.labels.dataset_id = "fitness_analytics"
  AND severity = "ERROR"
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC
LIMIT 100;
```

#### デバッグ2: セッションデータの整合性チェック

```sql
-- 異常なセッションデータを検出
SELECT
  session_id,
  user_id_hash,
  exercise_id,
  duration_seconds,
  rep_count,
  average_score,
  created_at
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE
  -- 異常に長いセッション
  duration_seconds > 7200
  OR
  -- 異常に多いレップ数
  rep_count > 1000
  OR
  -- 無効なスコア
  average_score < 0 OR average_score > 100
  OR
  -- 未来のタイムスタンプ
  created_at > CURRENT_TIMESTAMP()
ORDER BY created_at DESC;
```

#### デバッグ3: 仮名化処理のパフォーマンス

```sql
-- 仮名化処理の平均実行時間
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_executions,
  AVG(TIMESTAMP_DIFF(jsonPayload.processingCompletedAt, jsonPayload.processingStartedAt, MILLISECOND)) as avg_duration_ms,
  MAX(TIMESTAMP_DIFF(jsonPayload.processingCompletedAt, jsonPayload.processingStartedAt, MILLISECOND)) as max_duration_ms
FROM `tokyo-list-478804-e5.logs.cloudfunctions_googleapis_com_cloud_functions`
WHERE
  resource.labels.function_name = "processSession"
  AND jsonPayload.status = "success"
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC;
```

### 8.3 パフォーマンス最適化

#### 最適化1: クエリパフォーマンスの改善

```sql
-- ❌ 悪い例: パーティションフィルタなし（全データスキャン）
SELECT *
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE user_id_hash = '5f4dcc3b5aa765d61d8327deb882cf99';

-- ✅ 良い例: パーティションフィルタあり（必要なデータのみスキャン）
SELECT *
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE
  DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND user_id_hash = '5f4dcc3b5aa765d61d8327deb882cf99';
```

#### 最適化2: 集計テーブルの活用

```sql
-- ❌ 悪い例: リアルタイムクエリ（コスト高）
SELECT
  COUNT(DISTINCT user_id_hash) as dau
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE DATE(created_at) = CURRENT_DATE();

-- ✅ 良い例: 集計テーブルを使用（コスト99%削減）
SELECT metric_value as dau
FROM `tokyo-list-478804-e5.fitness_analytics.aggregated_stats`
WHERE
  stat_date = CURRENT_DATE()
  AND stat_type = 'DAU';
```

---

## 付録A: BigQueryコスト最適化チェックリスト

### コスト削減のベストプラクティス

- [ ] **パーティションフィルタを必ず使用**
  - すべてのクエリで `DATE(created_at) >= ...` を含める

- [ ] **集計テーブルを活用**
  - DAU/MAU計算は `aggregated_stats` テーブルを使用

- [ ] **SELECT * を避ける**
  - 必要なカラムのみ指定する

- [ ] **クエリコストを事前確認**
  - `--dry_run` オプションでスキャン量を確認

- [ ] **ストリーミング挿入を最小化**
  - バッチ処理可能なものはバッチで処理

- [ ] **予算アラートを設定**
  - 月$10を超えたらアラート

### コスト見積もり（MVP期）

```
想定: DAU 100人、1日平均2セッション

ストレージコスト:
- 月間データ量: 1.8GB
- コスト: $0.02/GB × 1.8GB = $0.036/月

クエリコスト:
- 集計テーブル使用: ほぼ$0（無料枠内）

ストリーミング挿入:
- 200セッション/日 × 30日 = 6,000セッション/月
- 無料枠: 200MB/月まで無料
- コスト: ほぼ$0（無料枠内）

合計: 約$0.04/月（約6円/月）
```

---

## 付録B: GDPR準拠チェックリスト

### データ保護要件

- [ ] **仮名化処理の実装**
  - ユーザーIDをSHA-256でハッシュ化

- [ ] **データ保持期間の設定**
  - 2年間（730日）で自動削除

- [ ] **データ削除権の実装**
  - `deleteUserData()` 関数の実装

- [ ] **データポータビリティ権の実装**
  - ユーザーデータのエクスポート機能

- [ ] **監査ログの記録**
  - 仮名化処理ログの記録

- [ ] **データ処理記録（ROPA）の維持**
  - `docs/specs/06_データ処理記録_ROPA_v1_0.md` の更新

---

## 次のステップ

### 完了確認チェックリスト

以下の項目をすべて完了したか確認してください：

- [ ] テーブルスキーマ作成完了（training_sessions, user_metadata, aggregated_stats）
- [ ] 仮名化処理の実装確認完了
- [ ] Pub/Subサブスクリプション設定完了
- [ ] Cloud Functionsからの連携テスト完了
- [ ] データパイプラインの検証完了（BigQueryにデータが正しく挿入されている）
- [ ] 監視ダッシュボード作成完了
- [ ] アラートポリシー設定完了
- [ ] DLQ処理の確認完了

### 今後の開発タスク

1. **日次集計処理の実装**（Phase 1後半）
   - Cloud Scheduler で毎日0:00に実行
   - `aggregated_stats` テーブルに集計結果を保存
   - DAU/WAU/MAU計算

2. **バックアップ自動化**（Phase 2）
   - BigQueryスナップショットの日次取得
   - クロスリージョンバックアップ

3. **データ品質監視**（Phase 2）
   - データ整合性チェック
   - 異常値検出

4. **ML移行準備**（Phase 4）
   - 10,000セッション達成後のデータ品質評価
   - アノテーション作業計画

---

## ヘルプとサポート

**公式ドキュメント**:
- [BigQuery ストリーミング挿入](https://cloud.google.com/bigquery/docs/streaming-data-into-bigquery)
- [BigQuery パーティション分割テーブル](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Pub/Sub トリガー](https://firebase.google.com/docs/functions/pubsub-events)

**プロジェクト内部ドキュメント**:
- `docs/specs/04_BigQuery設計書_v3_3.md` - 詳細な設計仕様
- `docs/guides/BIGQUERY_SETUP_GUIDE.md` - 初期セットアップガイド

**問題が解決しない場合**:
- プロジェクトのIssueトラッカーに報告
- チームの技術リードに相談

---

**パイプライン構築ガイド完了**

質問や問題があれば、チームに相談してください。
