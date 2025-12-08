# BigQuery パイプライン セットアップガイド

**対象読者**: 初学者～中級者
**最終更新日**: 2025-12-08
**所要時間（全体）**: 約2〜3時間
**関連仕様書**: `docs/specs/04_BigQuery設計書_v3_3.md`

---

## 目次

1. [概要と前提条件](#1-概要と前提条件)
2. [BigQueryデータセット作成](#2-bigqueryデータセット作成)
3. [BigQueryテーブル作成](#3-bigqueryテーブル作成)
4. [Pub/Subトピック・サブスクリプション作成](#4-pubsubトピックサブスクリプション作成)
5. [Secret Manager設定（ANONYMIZATION_SALT）](#5-secret-manager設定anonymization_salt)
6. [IAM権限設定](#6-iam権限設定)
7. [Cloud Functionsデプロイ](#7-cloud-functionsデプロイ)
8. [動作確認テスト](#8-動作確認テスト)
9. [Slack Webhook設定（オプション）](#9-slack-webhook設定オプション)
10. [Looker Studioダッシュボード（オプション）](#10-looker-studioダッシュボードオプション)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [デプロイ前チェックリスト](#12-デプロイ前チェックリスト)

---

## 1. 概要と前提条件

**推定所要時間**: 5分（確認のみ）

### 1.1 BigQueryパイプラインの目的

このパイプラインは、AIフィットネスアプリのトレーニングセッションデータを以下の目的で分析基盤に蓄積します：

- **データ分析**: DAU/WAU/MAU、リテンション率、種目別利用状況の把握
- **ML学習準備**: 将来のカスタムMLモデル開発のためのデータ蓄積（Phase 4以降）
- **サービス改善**: ユーザー行動分析によるUX最適化
- **GDPR準拠**: 仮名化処理と2年間のデータ保持期間管理

### 1.2 データフロー概要

```
┌──────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│  Flutter App     │      │  Firestore      │      │  Cloud Functions │
│  (セッション作成) │  →   │  (sessions)     │  →   │  (トリガー)      │
└──────────────────┘      └─────────────────┘      └────────┬─────────┘
                                                            │
                                                            ▼
┌──────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│  BigQuery        │  ←   │  Pub/Sub        │  ←   │  仮名化処理      │
│  (分析データ)    │      │  (メッセージ)   │      │  (user_id→hash)  │
└──────────────────┘      └─────────────────┘      └──────────────────┘
```

### 1.3 プロジェクト情報

| 項目 | 値 |
|------|-----|
| プロジェクトID | `tokyo-list-478804-e5` |
| リージョン | `asia-northeast1`（東京） |
| 本番データセット | `fitness_analytics` |
| 開発データセット | `fitness_analytics_dev` |
| サービスアカウント | `tokyo-list-478804-e5@appspot.gserviceaccount.com` |

### 1.4 前提条件

以下の項目が完了していることを確認してください：

| 項目 | 確認方法 | 状態 |
|------|---------|------|
| GCP Console へのアクセス権限 | [GCP Console](https://console.cloud.google.com/) にログイン可能 | ⬜ |
| Firebase Console へのアクセス権限 | [Firebase Console](https://console.firebase.google.com/) にログイン可能 | ⬜ |
| gcloud CLI インストール済み | ターミナルで `gcloud --version` を実行 | ⬜ |
| Firebase CLI インストール済み | ターミナルで `firebase --version` を実行 | ⬜ |
| Blazeプラン（従量課金）に切り替え済み | Firebase Console > プロジェクト設定 > 使用状況と請求 | ⬜ |
| BigQuery API 有効化済み | GCP Console > APIとサービス > BigQuery API | ⬜ |
| Pub/Sub API 有効化済み | GCP Console > APIとサービス > Pub/Sub API | ⬜ |

### 1.5 gcloud CLI の認証

まだ認証していない場合は、以下のコマンドを実行します：

```bash
# プロジェクトの設定
gcloud config set project tokyo-list-478804-e5

# 認証（ブラウザが開きます）
gcloud auth login

# アプリケーションデフォルト認証
gcloud auth application-default login

# 確認
gcloud config list
```

> **注意**: 認証情報は安全に管理し、他者と共有しないでください。

---

## 2. BigQueryデータセット作成

**推定所要時間**: 10分

### 2.1 概要

BigQueryにデータを格納するためのデータセットを作成します。本番環境と開発環境それぞれにデータセットを作成します。

### 2.2 GCP Consoleでの作成方法（初学者向け）

#### 手順1: BigQuery Consoleを開く

1. 以下のURLにアクセス：
   ```
   https://console.cloud.google.com/bigquery?project=tokyo-list-478804-e5
   ```

2. 左側のナビゲーションパネルで、プロジェクト名 `tokyo-list-478804-e5` を確認します。

#### 手順2: 本番データセットを作成

1. プロジェクト名の右側にある **3点メニュー（︙）** をクリック
2. **「データセットを作成」** を選択
3. 以下の情報を入力：

| フィールド | 値 |
|-----------|-----|
| データセットID | `fitness_analytics` |
| データのロケーション | `asia-northeast1（東京）` |
| デフォルトのテーブル有効期限 | `730日`（2年間、GDPR準拠） |
| 暗号化 | `Google管理の暗号化キー` |

4. **「データセットを作成」** ボタンをクリック

#### 手順3: 開発データセットを作成

同じ手順で開発用データセットも作成します：

| フィールド | 値 |
|-----------|-----|
| データセットID | `fitness_analytics_dev` |
| データのロケーション | `asia-northeast1（東京）` |
| デフォルトのテーブル有効期限 | `30日` |
| 暗号化 | `Google管理の暗号化キー` |

### 2.3 gcloudコマンドでの作成方法（上級者向け）

ターミナルで以下のコマンドを実行します：

```bash
# 本番データセット
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 本番分析データ" \
  --default_table_expiration=63072000 \
  tokyo-list-478804-e5:fitness_analytics

# 開発データセット
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 開発・テスト用データ" \
  --default_table_expiration=2592000 \
  tokyo-list-478804-e5:fitness_analytics_dev
```

> **補足**: `--default_table_expiration` は秒単位です。
> - 730日 = 63,072,000秒
> - 30日 = 2,592,000秒

### 2.4 確認方法

データセットが正しく作成されたか確認します：

```bash
bq ls tokyo-list-478804-e5:
```

出力例：
```
        datasetId
 -----------------------
  fitness_analytics
  fitness_analytics_dev
```

---

## 3. BigQueryテーブル作成

**推定所要時間**: 15分

### 3.1 概要

セットアップ用のシェルスクリプトを使用して、5つのテーブルを自動作成します。

### 3.2 作成されるテーブル一覧

| テーブル名 | 目的 | パーティション | 保持期間 |
|-----------|------|---------------|---------|
| `training_sessions` | トレーニングセッション記録 | `created_at`（日付） | 730日（2年） |
| `user_metadata` | ユーザーメタデータ（仮名化） | `updated_at`（日付） | 730日（2年） |
| `aggregated_stats` | 事前集計統計データ | `stat_date`（日付） | 730日（2年） |
| `pseudonymization_log` | 仮名化処理ログ | `created_at`（日付） | 90日 |
| `exercise_definitions` | トレーニング種目マスタ | なし | 無期限 |

### 3.3 スクリプトの実行手順

#### 手順1: プロジェクトルートに移動

```bash
cd C:\Users\236149\Desktop\ai_fitness_app
```

#### 手順2: スクリプトに実行権限を付与

```bash
chmod +x scripts/bigquery/create_tables.sh
```

#### 手順3: 開発環境のテーブル作成

まず開発環境でテストします：

```bash
./scripts/bigquery/create_tables.sh dev
```

出力例：
```
開発環境にテーブルを作成します...
プロジェクト: tokyo-list-478804-e5
データセット: fitness_analytics_dev

1. training_sessions テーブルを作成中...
2. user_metadata テーブルを作成中...
3. aggregated_stats テーブルを作成中...
4. pseudonymization_log テーブルを作成中...
5. exercise_definitions テーブルを作成中...

テーブル作成が完了しました。

作成されたテーブル:
        tableId               Type    Labels   Time Partitioning   Clustered Fields
 ---------------------- ------------ -------- ------------------- ------------------
  aggregated_stats       TABLE                DAY (field: stat_date)   exercise_id, country_code
  exercise_definitions   TABLE
  pseudonymization_log   TABLE                DAY (field: created_at)  status, source_collection
  training_sessions      TABLE                DAY (field: created_at)  user_id_hash, exercise_id
  user_metadata          TABLE                DAY (field: updated_at)  user_id_hash, country_code
```

#### 手順4: 本番環境のテーブル作成

開発環境で問題がなければ、本番環境も作成します：

```bash
./scripts/bigquery/create_tables.sh prod
```

### 3.4 マスタデータの投入（オプション）

`exercise_definitions` テーブルに初期データを投入する場合：

```bash
bq query --use_legacy_sql=false < scripts/bigquery/seed_exercise_definitions.sql
```

> **注意**: このコマンドは本番環境（`fitness_analytics`）に対して実行されます。開発環境に投入する場合は、SQLファイルのデータセット名を変更してください。

### 3.5 テーブルのスキーマ確認

作成されたテーブルのスキーマを確認できます：

```bash
# training_sessions テーブルの確認
bq show --schema --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions
```

---

## 4. Pub/Subトピック・サブスクリプション作成

**推定所要時間**: 10分

### 4.1 概要

Pub/Subは、FirestoreトリガーからBigQueryへデータを非同期で送信するためのメッセージングサービスです。以下の3つを作成します：

| 名前 | 種類 | 役割 |
|------|------|------|
| `training-sessions-stream` | トピック | セッションデータの送信先 |
| `training-sessions-dlq` | トピック | 処理失敗時のDead Letter Queue |
| `training-sessions-dlq-sub` | サブスクリプション | DLQメッセージの購読 |

### 4.2 GCP Consoleでの作成方法（初学者向け）

#### 手順1: Pub/Sub Consoleを開く

以下のURLにアクセス：
```
https://console.cloud.google.com/cloudpubsub/topic/list?project=tokyo-list-478804-e5
```

#### 手順2: メイントピックを作成

1. **「トピックを作成」** ボタンをクリック
2. トピックID: `training-sessions-stream` と入力
3. 他の設定はデフォルトのまま
4. **「作成」** をクリック

#### 手順3: DLQトピックを作成

1. **「トピックを作成」** ボタンをクリック
2. トピックID: `training-sessions-dlq` と入力
3. **「作成」** をクリック

#### 手順4: DLQサブスクリプションを作成

1. 作成した `training-sessions-dlq` トピックをクリック
2. **「サブスクリプションを作成」** をクリック
3. サブスクリプションID: `training-sessions-dlq-sub` と入力
4. 配信タイプ: `Pull` を選択
5. メッセージ保持期間: `7日間`
6. **「作成」** をクリック

### 4.3 gcloudコマンドでの作成方法

```bash
# メイントピック作成
gcloud pubsub topics create training-sessions-stream \
  --project=tokyo-list-478804-e5

# DLQトピック作成
gcloud pubsub topics create training-sessions-dlq \
  --project=tokyo-list-478804-e5

# DLQサブスクリプション作成
gcloud pubsub subscriptions create training-sessions-dlq-sub \
  --topic=training-sessions-dlq \
  --message-retention-duration=7d \
  --project=tokyo-list-478804-e5
```

### 4.4 確認方法

```bash
# トピック一覧
gcloud pubsub topics list --project=tokyo-list-478804-e5

# サブスクリプション一覧
gcloud pubsub subscriptions list --project=tokyo-list-478804-e5
```

---

## 5. Secret Manager設定（ANONYMIZATION_SALT）

**推定所要時間**: 10分

### 5.1 概要

`ANONYMIZATION_SALT` は、ユーザーIDを仮名化（ハッシュ化）する際に使用するソルト値です。これによりユーザーを直接特定できないようにしつつ、同一ユーザーのデータを紐付けることが可能になります。

### 5.2 ソルト値の生成

以下のコマンドでセキュアなランダム文字列を生成します：

```bash
openssl rand -base64 32
```

出力例：
```
K7x2mN9pQ3rS5tW8yA1cE4fG6hI0jL2nP5sU8wX1zA==
```

> **重要**: 生成された値は安全な場所に一時的に保存してください。以下の手順でSecret Managerに登録します。

### 5.3 Firebase CLIでの設定方法（推奨）

Firebase Functions v2では、シークレットは以下のコマンドで設定します：

```bash
# プロジェクトディレクトリに移動
cd C:\Users\236149\Desktop\ai_fitness_app

# シークレットを設定
firebase functions:secrets:set ANONYMIZATION_SALT
```

プロンプトが表示されたら、生成したソルト値を入力します：

```
? Enter a value for ANONYMIZATION_SALT [hidden]
```

### 5.4 GCP Secret Managerでの確認

設定が完了したら、以下のURLで確認できます：
```
https://console.cloud.google.com/security/secret-manager?project=tokyo-list-478804-e5
```

`ANONYMIZATION_SALT` というシークレットが作成されていることを確認してください。

### 5.5 セキュリティ上の注意事項

> **重要**:
> - ソルト値は絶対に公開リポジトリにコミットしないでください
> - ソルト値を変更すると、過去のハッシュ値と整合性が取れなくなります
> - 本番環境と開発環境で異なるソルト値を使用することを推奨します
> - ソルト値のバックアップを安全な場所に保管してください

---

## 6. IAM権限設定

**推定所要時間**: 15分

### 6.1 概要

Cloud FunctionsがBigQueryとPub/Subにアクセスするために必要な権限を設定します。

### 6.2 必要なロール一覧

サービスアカウント `tokyo-list-478804-e5@appspot.gserviceaccount.com` に以下のロールを付与します：

| ロール | 説明 | 用途 |
|--------|------|------|
| `roles/bigquery.dataEditor` | BigQueryデータ編集 | テーブルへのデータ挿入 |
| `roles/bigquery.jobUser` | BigQueryジョブ実行 | クエリ実行、集計ジョブ |
| `roles/pubsub.publisher` | Pub/Subパブリッシャー | トピックへのメッセージ発行 |
| `roles/pubsub.subscriber` | Pub/Subサブスクライバー | サブスクリプションからのメッセージ受信 |

### 6.3 GCP Consoleでの設定方法（初学者向け）

#### 手順1: IAM Consoleを開く

以下のURLにアクセス：
```
https://console.cloud.google.com/iam-admin/iam?project=tokyo-list-478804-e5
```

#### 手順2: サービスアカウントを検索

1. 検索ボックスに `tokyo-list-478804-e5@appspot.gserviceaccount.com` と入力
2. 該当するサービスアカウントの行を見つける
3. 右端の **鉛筆アイコン（編集）** をクリック

#### 手順3: ロールを追加

1. **「別のロールを追加」** をクリック
2. 以下のロールを一つずつ追加：
   - `BigQuery データ編集者`（roles/bigquery.dataEditor）
   - `BigQuery ジョブユーザー`（roles/bigquery.jobUser）
   - `Pub/Sub パブリッシャー`（roles/pubsub.publisher）
   - `Pub/Sub サブスクライバー`（roles/pubsub.subscriber）

3. **「保存」** をクリック

### 6.4 gcloudコマンドでの設定方法

```bash
# サービスアカウント
SERVICE_ACCOUNT="tokyo-list-478804-e5@appspot.gserviceaccount.com"
PROJECT_ID="tokyo-list-478804-e5"

# BigQuery データ編集者
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/bigquery.dataEditor"

# BigQuery ジョブユーザー
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/bigquery.jobUser"

# Pub/Sub パブリッシャー
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/pubsub.publisher"

# Pub/Sub サブスクライバー
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/pubsub.subscriber"
```

### 6.5 確認方法

```bash
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --flatten="bindings[].members" \
  --format='table(bindings.role)' \
  --filter="bindings.members:tokyo-list-478804-e5@appspot.gserviceaccount.com"
```

---

## 7. Cloud Functionsデプロイ

**推定所要時間**: 15分

### 7.1 概要

FirebaseにCloud Functionsをデプロイし、BigQueryパイプラインを稼働させます。

### 7.2 デプロイされる関数一覧

| 関数名 | トリガー | 役割 |
|--------|---------|------|
| `triggers_onSessionCreated` | Firestoreトリガー | セッション作成時にPub/Subへ発行 |
| `triggers_onSessionUpdated` | Firestoreトリガー | セッション完了時にPub/Subへ発行 |
| `pubsub_processTrainingSession` | Pub/Subトリガー | セッションを仮名化してBigQueryへ挿入 |
| `scheduled_dailyAggregation` | スケジュール（毎日2:00 JST） | 前日データの日次集計 |
| `scheduled_weeklyAggregation` | スケジュール（毎週月曜3:00 JST） | 週次集計 |
| `scheduled_processBigQueryDlq` | スケジュール（毎日5:00 JST） | DLQメッセージのリトライ |
| `analytics_getUserStats` | HTTPS Callable | ユーザー統計API |
| `analytics_getExerciseRanking` | HTTPS Callable | ランキングAPI |
| `analytics_getTrends` | HTTPS Callable | トレンド分析API |

### 7.3 デプロイ手順

#### 手順1: プロジェクトルートに移動

```bash
cd C:\Users\236149\Desktop\ai_fitness_app
```

#### 手順2: Firebaseプロジェクトを確認

```bash
firebase use
```

出力が `tokyo-list-478804-e5` であることを確認してください。

#### 手順3: 依存関係のインストール

```bash
cd functions
npm install
cd ..
```

#### 手順4: ビルド

```bash
cd functions
npm run build
cd ..
```

#### 手順5: デプロイ

```bash
firebase deploy --only functions
```

デプロイには数分かかります。完了すると以下のような出力が表示されます：

```
=== Deploying to 'tokyo-list-478804-e5'...

i  functions: preparing codebase default for deployment

...

+  Deploy complete!

Function URL (triggers_onSessionCreated): https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net/triggers_onSessionCreated
...
```

### 7.4 デプロイ後の確認

Firebase Consoleで確認します：
```
https://console.firebase.google.com/project/tokyo-list-478804-e5/functions
```

すべての関数が「Running」状態であることを確認してください。

### 7.5 特定の関数のみデプロイする場合

開発中に特定の関数のみデプロイしたい場合：

```bash
# Firestoreトリガーのみ
firebase deploy --only functions:triggers_onSessionCreated,functions:triggers_onSessionUpdated

# スケジュール関数のみ
firebase deploy --only functions:scheduled_dailyAggregation
```

---

## 8. 動作確認テスト

**推定所要時間**: 20分

### 8.1 概要

パイプライン全体が正しく動作しているか、エンドツーエンドでテストします。

### 8.2 テスト1: Firestoreトリガーの確認

#### 手順1: テストデータをFirestoreに作成

Firebase Consoleの Firestore データベースで、以下のドキュメントを作成：

```
コレクション: users/{テスト用ユーザーID}/sessions
ドキュメントID: test-session-001
```

フィールド：
```json
{
  "exerciseId": "squat",
  "startTime": "2025-12-08T10:00:00Z",
  "endTime": "2025-12-08T10:15:00Z",
  "durationSeconds": 900,
  "repCount": 30,
  "setCount": 3,
  "averageScore": 85.5,
  "status": "completed",
  "createdAt": "2025-12-08T10:15:05Z"
}
```

#### 手順2: Cloud Functionsログを確認

1. 以下のURLにアクセス：
   ```
   https://console.cloud.google.com/logs/query?project=tokyo-list-478804-e5
   ```

2. 以下のクエリでログをフィルタリング：
   ```
   resource.type="cloud_function"
   resource.labels.function_name="triggers_onSessionCreated"
   ```

3. 「Session created, publishing to Pub/Sub」というログが表示されることを確認

#### 手順3: Pub/Subメッセージを確認

1. 以下のURLにアクセス：
   ```
   https://console.cloud.google.com/cloudpubsub/topic/detail/training-sessions-stream?project=tokyo-list-478804-e5
   ```

2. 「メッセージをプル」をクリックし、メッセージが発行されていることを確認

### 8.3 テスト2: BigQueryへのデータ挿入確認

#### 手順1: BigQueryコンソールを開く

```
https://console.cloud.google.com/bigquery?project=tokyo-list-478804-e5
```

#### 手順2: クエリを実行

```sql
SELECT
  session_id,
  user_id_hash,
  exercise_id,
  average_score,
  created_at
FROM `tokyo-list-478804-e5.fitness_analytics_dev.training_sessions`
WHERE DATE(created_at) = CURRENT_DATE()
ORDER BY created_at DESC
LIMIT 10
```

テストデータが表示されることを確認します。

### 8.4 テスト3: 日次集計ジョブの確認

日次集計は毎日2:00 JST（UTC 17:00）に自動実行されます。手動でテストする場合：

```bash
# Cloud Scheduler Consoleで手動実行
https://console.cloud.google.com/cloudscheduler?project=tokyo-list-478804-e5
```

`scheduled_dailyAggregation` ジョブの「今すぐ実行」ボタンをクリック。

実行後、`aggregated_stats` テーブルを確認：

```sql
SELECT *
FROM `tokyo-list-478804-e5.fitness_analytics_dev.aggregated_stats`
ORDER BY stat_date DESC
LIMIT 10
```

### 8.5 テスト4: 分析APIの動作確認

Flutterアプリまたは `curl` コマンドでAPIを呼び出してテストします。

```bash
# 認証トークンを取得（Firebase Authが必要）
curl -X POST \
  "https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net/analytics_getUserStats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"data": {"userId": "テスト用ユーザーID"}}'
```

---

## 9. Slack Webhook設定（オプション）

**推定所要時間**: 15分

### 9.1 概要

アラート通知をSlackに送信するためのWebhook URLを設定します。

### 9.2 Slack Appの作成

#### 手順1: Slack Appを作成

1. https://api.slack.com/apps にアクセス
2. **「Create New App」** をクリック
3. **「From scratch」** を選択
4. アプリ名: `AI Fitness Alerts`
5. ワークスペースを選択
6. **「Create App」** をクリック

#### 手順2: Incoming Webhookを有効化

1. 左メニューの **「Incoming Webhooks」** をクリック
2. **「Activate Incoming Webhooks」** をONに切り替え
3. ページ下部の **「Add New Webhook to Workspace」** をクリック
4. 通知を送信するチャンネル（例: `#ai-fitness-alerts`）を選択
5. **「許可する」** をクリック

#### 手順3: Webhook URLをコピー

表示されるWebhook URLをコピーします。URLは以下の形式です：

```
https://hooks.slack.com/services/<WORKSPACE_ID>/<CHANNEL_ID>/<TOKEN>
```

> **注意**: `<WORKSPACE_ID>`、`<CHANNEL_ID>`、`<TOKEN>` は実際の値に置き換えてください。Webhook URLは機密情報として安全に管理してください。

### 9.3 Firebase環境変数への設定

```bash
firebase functions:config:set slack.webhook_url="YOUR_WEBHOOK_URL"
```

または Firebase Functions v2 の場合：

```bash
firebase functions:secrets:set SLACK_WEBHOOK_URL
```

### 9.4 動作確認

```bash
# Webhook URLのテスト
curl -X POST -H "Content-Type: application/json" \
  -d '{"text": "BigQueryパイプライン テスト通知"}' \
  YOUR_WEBHOOK_URL
```

Slackチャンネルにメッセージが届くことを確認します。

---

## 10. Looker Studioダッシュボード（オプション）

**推定所要時間**: 30分〜1時間

### 10.1 概要

Looker Studio（旧Google Data Studio）を使用して、BigQueryデータを可視化するダッシュボードを作成します。

### 10.2 Looker Studioへのアクセス

1. 以下のURLにアクセス：
   ```
   https://lookerstudio.google.com/
   ```

2. Googleアカウントでログイン

### 10.3 BigQueryデータソースの接続

#### 手順1: 新しいレポートを作成

1. **「+ 作成」** > **「レポート」** をクリック
2. **「空のレポート」** を選択

#### 手順2: BigQueryを接続

1. **「データに接続」** で **「BigQuery」** を選択
2. 以下を選択：
   - プロジェクト: `tokyo-list-478804-e5`
   - データセット: `fitness_analytics`
   - テーブル: `aggregated_stats`
3. **「追加」** をクリック

### 10.4 推奨ダッシュボード構成

#### 管理者ダッシュボード

| グラフタイプ | 内容 | データソース |
|-------------|------|-------------|
| スコアカード | 本日のセッション数 | `aggregated_stats` |
| スコアカード | アクティブユーザー数 | `aggregated_stats` |
| 折れ線グラフ | DAU推移（過去30日） | `aggregated_stats` |
| 円グラフ | 種目別セッション比率 | `aggregated_stats` |
| 棒グラフ | 平均スコア（種目別） | `aggregated_stats` |

#### カスタムSQLクエリ（DAU推移）

データソースで「カスタムクエリ」を選択し、以下のクエリを入力：

```sql
SELECT
  stat_date,
  SUM(total_users) as daily_active_users,
  SUM(total_sessions) as total_sessions
FROM `tokyo-list-478804-e5.fitness_analytics.aggregated_stats`
WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY stat_date
ORDER BY stat_date
```

### 10.5 共有設定

1. 右上の **「共有」** ボタンをクリック
2. 閲覧者/編集者を追加
3. 必要に応じて「リンクを持つ全員に公開」を設定

---

## 11. トラブルシューティング

### 11.1 よくあるエラーと解決方法

#### エラー1: BigQueryテーブル作成失敗

**症状**: `create_tables.sh` 実行時に権限エラー

**解決方法**:
```bash
# BigQuery Admin権限を確認
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="user:YOUR_EMAIL" \
  --role="roles/bigquery.admin"
```

#### エラー2: Pub/Sub発行失敗

**症状**: Cloud Functionsログに「Permission denied」

**解決方法**:
- サービスアカウントに `roles/pubsub.publisher` が付与されているか確認
- トピック名が正しいか確認（`training-sessions-stream`）

#### エラー3: 仮名化エラー

**症状**: 「ANONYMIZATION_SALT is not defined」

**解決方法**:
```bash
# シークレットが設定されているか確認
firebase functions:secrets:access ANONYMIZATION_SALT

# 設定されていない場合は再設定
firebase functions:secrets:set ANONYMIZATION_SALT
```

#### エラー4: BigQuery挿入エラー

**症状**: データがBigQueryテーブルに挿入されない

**解決方法**:
1. Cloud Functionsログでエラーを確認
2. スキーマの不一致がないか確認
3. DLQにメッセージがないか確認：
   ```bash
   gcloud pubsub subscriptions pull training-sessions-dlq-sub --limit=10
   ```

### 11.2 ログの確認方法

#### Cloud Functions ログ

```bash
# 最新のログを表示
gcloud functions logs read --project=tokyo-list-478804-e5 --limit=50

# 特定の関数のログ
gcloud functions logs read triggers_onSessionCreated --project=tokyo-list-478804-e5
```

#### Cloud Logging コンソール

```
https://console.cloud.google.com/logs/query?project=tokyo-list-478804-e5
```

便利なクエリ：

```
# エラーログのみ
severity>=ERROR

# 特定の関数のログ
resource.type="cloud_function"
resource.labels.function_name="pubsub_processTrainingSession"

# BigQuery関連のエラー
jsonPayload.message:"BigQuery"
severity>=ERROR
```

### 11.3 DLQメッセージの再処理

処理に失敗したメッセージは自動的にDLQに送られます。毎日5:00 JSTに自動リトライされますが、手動で再処理することも可能です：

```bash
# Cloud Scheduler Consoleから手動実行
https://console.cloud.google.com/cloudscheduler?project=tokyo-list-478804-e5
```

`scheduled_processBigQueryDlq` ジョブを手動で実行します。

---

## 12. デプロイ前チェックリスト

すべての項目が完了していることを確認してください：

### インフラ設定

- ⬜ Blazeプラン（従量課金）に切り替え済み
- ⬜ BigQuery API 有効化済み
- ⬜ Pub/Sub API 有効化済み
- ⬜ Secret Manager API 有効化済み

### BigQuery

- ⬜ `fitness_analytics` データセット作成完了（本番）
- ⬜ `fitness_analytics_dev` データセット作成完了（開発）
- ⬜ `training_sessions` テーブル作成完了
- ⬜ `user_metadata` テーブル作成完了
- ⬜ `aggregated_stats` テーブル作成完了
- ⬜ `pseudonymization_log` テーブル作成完了
- ⬜ `exercise_definitions` テーブル作成完了
- ⬜ マスタデータ投入完了（オプション）

### Pub/Sub

- ⬜ `training-sessions-stream` トピック作成完了
- ⬜ `training-sessions-dlq` トピック作成完了
- ⬜ `training-sessions-dlq-sub` サブスクリプション作成完了

### セキュリティ

- ⬜ `ANONYMIZATION_SALT` シークレット設定完了
- ⬜ サービスアカウントに `roles/bigquery.dataEditor` 付与
- ⬜ サービスアカウントに `roles/bigquery.jobUser` 付与
- ⬜ サービスアカウントに `roles/pubsub.publisher` 付与
- ⬜ サービスアカウントに `roles/pubsub.subscriber` 付与

### デプロイ

- ⬜ `npm run build` 成功
- ⬜ `firebase deploy --only functions` 成功
- ⬜ すべての関数が「Running」状態

### 動作確認

- ⬜ Firestoreトリガーテスト成功
- ⬜ Pub/Subメッセージ発行確認
- ⬜ BigQueryデータ挿入確認
- ⬜ 分析API動作確認

### オプション

- ⬜ Slack Webhook設定完了
- ⬜ Looker Studioダッシュボード作成完了

---

## 参考リンク

- [BigQuery ドキュメント](https://cloud.google.com/bigquery/docs)
- [Cloud Pub/Sub ドキュメント](https://cloud.google.com/pubsub/docs)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Looker Studio](https://lookerstudio.google.com/)
- [Cloud Logging クエリ言語](https://cloud.google.com/logging/docs/view/logging-query-language)

---

**作成者**: Documentation Engineer
**参照仕様**: `docs/specs/04_BigQuery設計書_v3_3.md`, `docs/tickets/014_bigquery_pipeline.md`
