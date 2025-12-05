# BigQueryパイプライン セットアップガイド

AIフィットネスアプリのBigQueryデータパイプラインを本番環境にデプロイするための手順書です。

**最終更新日**: 2025-12-05
**対象チケット**: #014 BigQueryデータパイプライン構築
**関連仕様書**: `docs/specs/04_BigQuery設計書_v3_3.md`

---

## 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [セットアップ手順](#3-セットアップ手順)
4. [動作確認](#4-動作確認)
5. [トラブルシューティング](#5-トラブルシューティング)
6. [デプロイ前チェックリスト](#6-デプロイ前チェックリスト)

---

## 1. 概要

### 1.1 パイプラインの目的

- Firestoreのトレーニングセッションデータを BigQuery に連携
- GDPR準拠のデータ仮名化処理
- 日次/週次の集計処理による分析データ生成
- ユーザー統計・ランキング・トレンド分析APIの提供

### 1.2 アーキテクチャ

```
Flutter App
    │
    ▼ (セッションデータ保存)
Firestore
    │
    ▼ (onCreate/onUpdate トリガー)
Cloud Functions (Firestore Triggers)
    │
    ▼ (メッセージ発行)
Pub/Sub (training-sessions-stream)
    │
    ▼ (メッセージ処理)
Cloud Functions (Pub/Sub Processor)
    │
    ├─► BigQuery (仮名化データ挿入)
    │
    └─► DLQ (training-sessions-dlq) ※エラー時
```

### 1.3 作成されるリソース

| リソース種別 | 名前 | 用途 |
|-------------|------|------|
| Pub/Sub Topic | `training-sessions-stream` | セッションデータストリーム |
| Pub/Sub Topic | `training-sessions-dlq` | Dead Letter Queue |
| Pub/Sub Subscription | `training-sessions-dlq-sub` | DLQ処理用 |
| BigQuery Dataset | `fitness_analytics` | 本番データセット |
| BigQuery Table | `training_sessions` | セッションデータ（730日保持） |
| BigQuery Table | `user_metadata` | ユーザーメタデータ（730日保持） |
| BigQuery Table | `aggregated_stats` | 集計統計 |
| BigQuery Table | `exercise_definitions` | 種目マスタ |
| BigQuery Table | `pseudonymization_log` | 仮名化監査ログ（90日保持） |
| Secret Manager | `ANONYMIZATION_SALT` | 仮名化用ソルト値 |

---

## 2. 前提条件

### 2.1 必要な権限

作業を行うGoogleアカウントに以下の権限が必要です：

| 権限 | 説明 |
|------|------|
| `roles/owner` または `roles/editor` | プロジェクト全体の編集権限 |
| `roles/iam.securityAdmin` | IAMロール付与権限 |
| `roles/bigquery.admin` | BigQuery管理権限 |
| `roles/pubsub.admin` | Pub/Sub管理権限 |
| `roles/secretmanager.admin` | Secret Manager管理権限 |

### 2.2 必須要件

- [ ] **Blazeプラン（従量課金）** に切り替え済み
  - Firebase Console: https://console.firebase.google.com/project/ai-fitness-c38f0/usage/details
  - Sparkプラン（無料）では Cloud Functions のデプロイができません

- [ ] **gcloud CLI** がインストール済み
  ```bash
  # インストール確認
  gcloud --version

  # 未インストールの場合
  # https://cloud.google.com/sdk/docs/install
  ```

- [ ] **Firebase CLI** がインストール済み
  ```bash
  # インストール確認
  firebase --version

  # 未インストールの場合
  npm install -g firebase-tools
  ```

- [ ] **適切なプロジェクトに認証済み**
  ```bash
  # ログイン
  gcloud auth login

  # プロジェクト設定
  gcloud config set project ai-fitness-c38f0

  # Firebase ログイン
  firebase login
  firebase use ai-fitness-c38f0
  ```

- [ ] **BigQuery API が有効化済み**
  ```bash
  # 有効化
  gcloud services enable bigquery.googleapis.com
  ```

- [ ] **Pub/Sub API が有効化済み**
  ```bash
  gcloud services enable pubsub.googleapis.com
  ```

- [ ] **Secret Manager API が有効化済み**
  ```bash
  gcloud services enable secretmanager.googleapis.com
  ```

### 2.3 所要時間目安

| ステップ | 所要時間 |
|---------|---------|
| Pub/Sub設定 | 約5分 |
| Secret Manager設定 | 約5分 |
| IAM権限設定 | 約10分 |
| BigQueryテーブル作成 | 約10分 |
| Cloud Functionsデプロイ | 約15分 |
| 動作確認 | 約15分 |
| **合計** | **約60分** |

---

## 3. セットアップ手順

### 3.1 Pub/Subトピック・サブスクリプション作成

**所要時間**: 約5分

#### ステップ1: メイントピック作成

```bash
gcloud pubsub topics create training-sessions-stream \
  --project=ai-fitness-c38f0 \
  --labels=env=prod,component=bigquery-pipeline
```

**期待される出力**:
```
Created topic [projects/ai-fitness-c38f0/topics/training-sessions-stream].
```

#### ステップ2: DLQトピック作成

```bash
gcloud pubsub topics create training-sessions-dlq \
  --project=ai-fitness-c38f0 \
  --labels=env=prod,component=bigquery-pipeline,type=dlq
```

**期待される出力**:
```
Created topic [projects/ai-fitness-c38f0/topics/training-sessions-dlq].
```

#### ステップ3: DLQサブスクリプション作成

```bash
gcloud pubsub subscriptions create training-sessions-dlq-sub \
  --topic=training-sessions-dlq \
  --project=ai-fitness-c38f0 \
  --ack-deadline=60 \
  --message-retention-duration=7d \
  --labels=env=prod,component=bigquery-pipeline,type=dlq
```

**期待される出力**:
```
Created subscription [projects/ai-fitness-c38f0/subscriptions/training-sessions-dlq-sub].
```

#### 確認

```bash
# トピック一覧を確認
gcloud pubsub topics list --project=ai-fitness-c38f0 --filter="labels.component:bigquery-pipeline"

# サブスクリプション一覧を確認
gcloud pubsub subscriptions list --project=ai-fitness-c38f0 --filter="labels.component:bigquery-pipeline"
```

---

### 3.2 Secret Manager設定（ANONYMIZATION_SALT）

**所要時間**: 約5分

仮名化処理で使用するソルト値を Secret Manager に登録します。

#### ステップ1: ソルト値の生成

```bash
# 32文字以上のランダムな文字列を生成
openssl rand -base64 32
```

**出力例**:
```
K7x9Qm3Fp2LsN8vR5wE1yT6oU4iA0zXc=
```

この値をメモしておきます（再生成すると仮名化の整合性が失われます）。

#### ステップ2: Firebase CLI でシークレット設定

```bash
cd functions
firebase functions:secrets:set ANONYMIZATION_SALT
```

プロンプトが表示されたら、ステップ1で生成したソルト値を入力します。

**期待される出力**:
```
? Enter a value for ANONYMIZATION_SALT [hidden]
i  Created a new secret version projects/ai-fitness-c38f0/secrets/ANONYMIZATION_SALT/versions/1
```

#### 確認

```bash
# シークレットの存在確認（値は表示されません）
gcloud secrets list --project=ai-fitness-c38f0 --filter="name:ANONYMIZATION_SALT"
```

**重要**: ソルト値は安全な場所にバックアップしてください。紛失すると仮名化の逆引きができなくなります。

---

### 3.3 IAM権限設定

**所要時間**: 約10分

Cloud Functions のサービスアカウントに必要な権限を付与します。

#### ステップ1: サービスアカウントの確認

```bash
# デフォルトサービスアカウントの確認
gcloud iam service-accounts list --project=ai-fitness-c38f0 --filter="email:appspot.gserviceaccount.com"
```

サービスアカウント: `ai-fitness-c38f0@appspot.gserviceaccount.com`

#### ステップ2: BigQuery権限の付与

```bash
# BigQuery データ編集権限
gcloud projects add-iam-policy-binding ai-fitness-c38f0 \
  --member="serviceAccount:ai-fitness-c38f0@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# BigQuery ジョブ実行権限
gcloud projects add-iam-policy-binding ai-fitness-c38f0 \
  --member="serviceAccount:ai-fitness-c38f0@appspot.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

#### ステップ3: Pub/Sub権限の付与

```bash
# Pub/Sub パブリッシャー権限
gcloud projects add-iam-policy-binding ai-fitness-c38f0 \
  --member="serviceAccount:ai-fitness-c38f0@appspot.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# Pub/Sub サブスクライバー権限
gcloud projects add-iam-policy-binding ai-fitness-c38f0 \
  --member="serviceAccount:ai-fitness-c38f0@appspot.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

#### 確認

GCP Console で権限を確認:
- https://console.cloud.google.com/iam-admin/iam?project=ai-fitness-c38f0

または CLI で確認:

```bash
gcloud projects get-iam-policy ai-fitness-c38f0 \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:ai-fitness-c38f0@appspot.gserviceaccount.com"
```

**期待される権限一覧**:

| ロール | 説明 |
|-------|------|
| `roles/bigquery.dataEditor` | BigQueryデータ編集 |
| `roles/bigquery.jobUser` | BigQueryジョブ実行 |
| `roles/pubsub.publisher` | Pub/Subメッセージ発行 |
| `roles/pubsub.subscriber` | Pub/Subメッセージ購読 |

---

### 3.4 BigQueryデータセット・テーブル作成

**所要時間**: 約10分

#### ステップ1: データセット作成

```bash
# 本番データセット作成
bq mk --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ分析データセット（本番）" \
  --default_table_expiration=0 \
  --label=env:prod \
  ai-fitness-c38f0:fitness_analytics

# 開発データセット作成（オプション）
bq mk --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ分析データセット（開発）" \
  --default_table_expiration=7776000 \
  --label=env:dev \
  ai-fitness-c38f0:fitness_analytics_dev
```

**期待される出力**:
```
Dataset 'ai-fitness-c38f0:fitness_analytics' successfully created.
```

#### ステップ2: テーブル作成スクリプトの実行

プロジェクトルートに移動して実行します：

**Linux/macOS**:
```bash
cd scripts/bigquery
chmod +x create_tables.sh
./create_tables.sh prod
```

**Windows（Git Bash または WSL）**:
```bash
cd scripts/bigquery
bash create_tables.sh prod
```

**期待される出力**:
```
本番環境にテーブルを作成します...
プロジェクト: ai-fitness-c38f0
データセット: fitness_analytics

1. training_sessions テーブルを作成中...
Table 'ai-fitness-c38f0:fitness_analytics.training_sessions' successfully created.
2. user_metadata テーブルを作成中...
Table 'ai-fitness-c38f0:fitness_analytics.user_metadata' successfully created.
3. aggregated_stats テーブルを作成中...
Table 'ai-fitness-c38f0:fitness_analytics.aggregated_stats' successfully created.
4. pseudonymization_log テーブルを作成中...
Table 'ai-fitness-c38f0:fitness_analytics.pseudonymization_log' successfully created.
5. exercise_definitions テーブルを作成中...
Table 'ai-fitness-c38f0:fitness_analytics.exercise_definitions' successfully created.

テーブル作成が完了しました。

作成されたテーブル:
           tableId           Type    Labels   Time Partitioning
 ------------------------- ------- ---------- -------------------
  training_sessions         TABLE   env:prod   DAY (field: created_at)
  user_metadata             TABLE   env:prod   DAY (field: updated_at)
  aggregated_stats          TABLE   env:prod   DAY (field: stat_date)
  pseudonymization_log      TABLE   env:prod   DAY (field: created_at)
  exercise_definitions      TABLE   env:prod
```

#### ステップ3: マスタデータ投入

種目マスタデータを投入します：

```bash
bq query --use_legacy_sql=false < scripts/bigquery/seed_exercise_definitions.sql
```

**期待される出力**:
```
Waiting on bqjob_r... (0s) Current status: DONE
+----------------+----------------------+----------+------------------+-----------+
|  exercise_id   |   exercise_name_ja   | category | difficulty_level | is_active |
+----------------+----------------------+----------+------------------+-----------+
| squat          | スクワット           | strength | beginner         |      true |
| push_up        | プッシュアップ       | strength | beginner         |      true |
| bicep_curl     | アームカール         | strength | beginner         |      true |
| lateral_raise  | サイドレイズ         | strength | beginner         |      true |
| shoulder_press | ショルダープレス     | strength | intermediate     |      true |
| plank          | プランク             | strength | beginner         |     false |
| lunge          | ランジ               | strength | intermediate     |     false |
| glute_bridge   | グルートブリッジ     | strength | beginner         |     false |
+----------------+----------------------+----------+------------------+-----------+
```

#### 確認

```bash
# テーブル一覧を確認
bq ls ai-fitness-c38f0:fitness_analytics

# テーブルスキーマを確認
bq show --schema --format=prettyjson ai-fitness-c38f0:fitness_analytics.training_sessions
```

---

### 3.5 Cloud Functionsデプロイ

**所要時間**: 約15分

#### ステップ1: 依存関係のインストール

```bash
cd functions
npm install
npm run build
```

#### ステップ2: デプロイ実行

```bash
# プロジェクトルートから実行
firebase deploy --only functions
```

**期待される出力**:
```
=== Deploying to 'ai-fitness-c38f0'...

i  deploying functions
i  functions: preparing codebase default for deployment
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
...
+  functions[asia-northeast1-onSessionCreated]: Successful create operation.
+  functions[asia-northeast1-onSessionUpdated]: Successful create operation.
+  functions[asia-northeast1-processTrainingSession]: Successful create operation.
+  functions[asia-northeast1-scheduled_dailyAggregation]: Successful create operation.
+  functions[asia-northeast1-scheduled_weeklyAggregation]: Successful create operation.
+  functions[asia-northeast1-scheduled_processBigQueryDlq]: Successful create operation.
+  functions[asia-northeast1-analytics_getUserStats]: Successful create operation.
+  functions[asia-northeast1-analytics_getExerciseRanking]: Successful create operation.
+  functions[asia-northeast1-analytics_getTrends]: Successful create operation.

+  Deploy complete!
```

#### デプロイされる関数一覧

| 関数名 | トリガー | 用途 |
|-------|---------|------|
| `onSessionCreated` | Firestore onCreate | セッション作成時のPub/Sub発行 |
| `onSessionUpdated` | Firestore onUpdate | セッション更新時のPub/Sub発行 |
| `processTrainingSession` | Pub/Sub | BigQueryへのデータ挿入 |
| `scheduled_dailyAggregation` | Cloud Scheduler (2:00 JST) | 日次集計 |
| `scheduled_weeklyAggregation` | Cloud Scheduler (月曜 3:00 JST) | 週次集計 |
| `scheduled_processBigQueryDlq` | Cloud Scheduler (5:00 JST) | DLQ処理 |
| `analytics_getUserStats` | HTTPS Callable | ユーザー統計API |
| `analytics_getExerciseRanking` | HTTPS Callable | ランキングAPI |
| `analytics_getTrends` | HTTPS Callable | トレンド分析API |

#### 確認

```bash
# デプロイされた関数一覧
firebase functions:list

# または GCP Console
# https://console.cloud.google.com/functions/list?project=ai-fitness-c38f0
```

---

## 4. 動作確認

### 4.1 Firestoreトリガーテスト

**所要時間**: 約5分

#### テストデータの作成

Firebase Console または Firestore エミュレータでテストセッションを作成します。

**Firebase Console**:
- https://console.firebase.google.com/project/ai-fitness-c38f0/firestore

**テストドキュメント作成**:
```
コレクション: users/{testUserId}/sessions
ドキュメントID: test-session-001

フィールド:
{
  "exerciseType": "squat",
  "startedAt": (現在時刻),
  "endedAt": (現在時刻 + 30分),
  "totalReps": 15,
  "averageScore": 85.5,
  "status": "completed"
}
```

#### ログの確認

```bash
# Cloud Functions のログを確認
gcloud functions logs read onSessionCreated \
  --project=ai-fitness-c38f0 \
  --region=asia-northeast1 \
  --limit=10
```

**期待されるログ**:
```
2025-12-05T10:00:00.000Z onSessionCreated: Session created: test-session-001
2025-12-05T10:00:00.100Z onSessionCreated: Published to training-sessions-stream
```

### 4.2 BigQuery挿入確認

**所要時間**: 約5分

#### データの確認

```bash
bq query --use_legacy_sql=false \
  "SELECT * FROM \`ai-fitness-c38f0.fitness_analytics.training_sessions\`
   ORDER BY created_at DESC LIMIT 5"
```

**期待される出力**:
```
+-----------------+---------------+----------------+------------+---------------+
| session_id      | user_id_hash  | exercise_id    | total_reps | average_score |
+-----------------+---------------+----------------+------------+---------------+
| test-session-001| a1b2c3...     | squat          |         15 |          85.5 |
+-----------------+---------------+----------------+------------+---------------+
```

### 4.3 仮名化ログ確認

```bash
bq query --use_legacy_sql=false \
  "SELECT * FROM \`ai-fitness-c38f0.fitness_analytics.pseudonymization_log\`
   ORDER BY created_at DESC LIMIT 5"
```

### 4.4 分析APIテスト

#### ユーザー統計API

```bash
# Firebase Functions の URL を取得
firebase functions:list

# curl でテスト（認証トークンが必要）
curl -X POST \
  "https://asia-northeast1-ai-fitness-c38f0.cloudfunctions.net/analytics_getUserStats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -d '{"data": {"userId": "testUserId", "period": "30d"}}'
```

### 4.5 日次集計テスト（手動実行）

Cloud Scheduler のジョブを手動でトリガー:

```bash
gcloud scheduler jobs run scheduled_dailyAggregation \
  --project=ai-fitness-c38f0 \
  --location=asia-northeast1
```

**確認**:
```bash
bq query --use_legacy_sql=false \
  "SELECT * FROM \`ai-fitness-c38f0.fitness_analytics.aggregated_stats\`
   ORDER BY stat_date DESC LIMIT 5"
```

---

## 5. トラブルシューティング

### 5.1 よくある問題と解決策

#### Pub/Subトピックが見つからない

**エラー**:
```
Error: Topic projects/ai-fitness-c38f0/topics/training-sessions-stream not found
```

**解決策**:
```bash
# トピックが存在するか確認
gcloud pubsub topics list --project=ai-fitness-c38f0

# 存在しない場合は作成
gcloud pubsub topics create training-sessions-stream --project=ai-fitness-c38f0
```

#### BigQuery権限エラー

**エラー**:
```
Access Denied: Table ai-fitness-c38f0:fitness_analytics.training_sessions: User does not have permission
```

**解決策**:
```bash
# サービスアカウントに権限を付与
gcloud projects add-iam-policy-binding ai-fitness-c38f0 \
  --member="serviceAccount:ai-fitness-c38f0@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
```

#### Secret Managerアクセスエラー

**エラー**:
```
Error: Secret ANONYMIZATION_SALT not found
```

**解決策**:
```bash
# シークレットの存在確認
gcloud secrets list --project=ai-fitness-c38f0

# 存在しない場合は作成
firebase functions:secrets:set ANONYMIZATION_SALT
```

#### Cloud Functionsデプロイ失敗

**エラー**:
```
Error: Blaze plan required
```

**解決策**:
Firebase Console で Blaze プラン（従量課金）に切り替え:
- https://console.firebase.google.com/project/ai-fitness-c38f0/usage/details

#### BigQueryテーブル作成失敗

**エラー**:
```
BigQuery error: Dataset fitness_analytics does not exist
```

**解決策**:
```bash
# データセットを作成
bq mk --dataset \
  --location=asia-northeast1 \
  ai-fitness-c38f0:fitness_analytics
```

### 5.2 ログの確認方法

#### Cloud Functions ログ

```bash
# 特定の関数のログ
gcloud functions logs read [FUNCTION_NAME] \
  --project=ai-fitness-c38f0 \
  --region=asia-northeast1 \
  --limit=50

# エラーログのみ
gcloud functions logs read \
  --project=ai-fitness-c38f0 \
  --region=asia-northeast1 \
  --severity=ERROR \
  --limit=20
```

#### Cloud Logging（GCP Console）

- https://console.cloud.google.com/logs/query?project=ai-fitness-c38f0

**フィルタ例**:
```
resource.type="cloud_function"
resource.labels.function_name="onSessionCreated"
severity>=ERROR
```

### 5.3 DLQの確認・再処理

```bash
# DLQメッセージ数の確認
gcloud pubsub subscriptions describe training-sessions-dlq-sub \
  --project=ai-fitness-c38f0

# 手動でDLQ処理ジョブを実行
gcloud scheduler jobs run scheduled_processBigQueryDlq \
  --project=ai-fitness-c38f0 \
  --location=asia-northeast1
```

---

## 6. デプロイ前チェックリスト

すべての項目を確認してからデプロイを完了してください。

### 6.1 前提条件

- [ ] Blazeプラン（従量課金）に切り替え済み
- [ ] gcloud CLI インストール・認証済み
- [ ] Firebase CLI インストール・認証済み
- [ ] 必要なAPIが有効化済み（BigQuery, Pub/Sub, Secret Manager）

### 6.2 リソース作成

- [ ] Pub/Subトピック `training-sessions-stream` 作成完了
- [ ] Pub/Subトピック `training-sessions-dlq` 作成完了
- [ ] Pub/Subサブスクリプション `training-sessions-dlq-sub` 作成完了
- [ ] Secret Manager `ANONYMIZATION_SALT` 設定完了
- [ ] ソルト値のバックアップ保存完了

### 6.3 IAM権限

- [ ] `roles/bigquery.dataEditor` 付与完了
- [ ] `roles/bigquery.jobUser` 付与完了
- [ ] `roles/pubsub.publisher` 付与完了
- [ ] `roles/pubsub.subscriber` 付与完了

### 6.4 BigQuery

- [ ] データセット `fitness_analytics` 作成完了
- [ ] テーブル `training_sessions` 作成完了
- [ ] テーブル `user_metadata` 作成完了
- [ ] テーブル `aggregated_stats` 作成完了
- [ ] テーブル `exercise_definitions` 作成完了
- [ ] テーブル `pseudonymization_log` 作成完了
- [ ] 種目マスタデータ投入完了

### 6.5 Cloud Functions

- [ ] `firebase deploy --only functions` 成功
- [ ] 全関数のデプロイ完了確認

### 6.6 動作確認

- [ ] Firestoreトリガーテスト完了
- [ ] Pub/Subメッセージ発行確認
- [ ] BigQueryデータ挿入確認
- [ ] 仮名化ログ確認
- [ ] 分析APIテスト完了

---

## 7. 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `docs/specs/04_BigQuery設計書_v3_3.md` | BigQuery詳細設計仕様 |
| `docs/bigquery/MONITORING_DESIGN.md` | 監視・ロギング設計 |
| `docs/bigquery/ALERT_RUNBOOK.md` | アラート対応手順書 |
| `docs/tickets/014_bigquery_pipeline.md` | チケット詳細 |

---

## 8. サポート

問題が解決しない場合は、以下の情報を添えて報告してください：

1. 実行したコマンドと出力
2. エラーメッセージ全文
3. Cloud Functions ログ（該当部分）
4. 実行日時とタイムゾーン

---

**作成者**: Documentation Engineer
**作成日**: 2025-12-05
