# BigQueryセットアップガイド

**対象**: 中学生〜高校生・初心者プログラマー
**最終更新**: 2025年12月10日
**ステータス**: セットアップ完了

---

## このガイドについて

このガイドでは、AIフィットネスアプリの分析基盤である **BigQuery（ビッグクエリ）** の構成と確認方法を説明します。

**注意**: 本番環境のBigQueryは既にセットアップ済みです。このガイドは主に「確認・理解」のためのリファレンスとして使用してください。

BigQueryを使うと、アプリのトレーニングデータを集計・分析して、ユーザーの運動傾向やアプリの改善点を見つけることができます。

---

## 目次

1. [BigQueryとは](#1-bigqueryとは)
2. [現在の環境状況](#2-現在の環境状況)
3. [前提条件](#3-前提条件)
4. [Google Cloud Consoleへのアクセス](#4-google-cloud-consoleへのアクセス)
5. [BigQuery APIの有効化確認](#5-bigquery-apiの有効化確認)
6. [データセット構成](#6-データセット構成)
7. [テーブル構成](#7-テーブル構成)
8. [サービスアカウントの設定](#8-サービスアカウントの設定)
9. [Firestore to BigQuery 連携](#9-firestore-to-bigquery-連携)
10. [動作確認](#10-動作確認)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [参考情報](#12-参考情報)

---

## 1. BigQueryとは

### 1.1 BigQueryの概要

**BigQuery（ビッグクエリ）** は、Googleが提供するクラウドベースのデータウェアハウス（大規模データ分析サービス）です。

**身近な例えで説明すると:**

- **Firestore** = 本棚（本を1冊ずつ取り出すのに便利）
- **BigQuery** = 図書館の検索システム（大量の本から条件に合うものを一気に探せる）

つまり、BigQueryは「大量のデータを素早く検索・集計するための専用サービス」です。

### 1.2 なぜBigQueryを使うのか

| 目的 | 説明 |
|------|------|
| **大量データの分析** | 何百万件ものトレーニングデータを数秒で集計できる |
| **複雑な統計処理** | 平均スコア、ランキング、傾向分析などが簡単にできる |
| **コスト効率** | 必要なときだけ料金が発生する（使った分だけ払う） |
| **セキュリティ** | データは暗号化されて安全に保存される |

### 1.3 FirestoreとBigQueryの違い

| 項目 | Firestore | BigQuery |
|------|-----------|----------|
| **得意なこと** | 1件ずつのデータ読み書き | 大量データの一括分析 |
| **用途** | アプリのメイン機能（リアルタイムデータ） | 統計・レポート・ML学習データ |
| **料金体系** | 読み書き回数で課金 | スキャンしたデータ量で課金 |
| **レスポンス** | ミリ秒単位（超高速） | 秒〜分単位（データ量による） |

**このプロジェクトでの使い分け:**
- **Firestore**: ユーザーのトレーニング結果をリアルタイムで保存・表示
- **BigQuery**: 全ユーザーのデータを集計して、種目別の平均スコアやデバイス性能を分析

---

## 2. 現在の環境状況

### 2.1 セットアップ完了状況

本番環境のBigQueryは **セットアップ完了** です。以下の項目が既に構成されています:

| 項目 | ステータス | 備考 |
|------|-----------|------|
| BigQuery API | 有効化済み | - |
| 本番データセット | 作成済み | `fitness_analytics` |
| 開発データセット | 作成済み | `fitness_analytics_dev` |
| バックアップデータセット | 作成済み | `fitness_analytics_backup` |
| テーブル群 | 作成済み | 5テーブル |
| サービスアカウント権限 | 設定済み | - |

### 2.2 設計書との対応関係

実際の環境は、設計書（`docs/common/specs/05_BigQuery設計書_v1_0.md`）から一部変更されています:

| 項目 | 設計書 | 実際の構成 |
|-----|-------|----------|
| 本番データセット名 | `analytics_production` | `fitness_analytics` |
| 開発データセット名 | `analytics_development` | `fitness_analytics_dev` |
| バックアップデータセット | 記載なし | `fitness_analytics_backup` |
| セッションテーブル名 | `sessions` | `training_sessions` |
| フレームデータ | 別テーブル（`frames`） | `training_sessions`内の`landmarks`配列 |
| ユーザー集計 | `user_aggregates` | `user_metadata` |
| デバイス性能 | 別テーブル（`device_performance`） | `training_sessions`内の`device_info` |

---

## 3. 前提条件

### 3.1 必要なアカウント

1. **Googleアカウント**
   - GmailアドレスがあればOK
   - 持っていない場合: https://accounts.google.com/ で作成

2. **Firebaseプロジェクトへのアクセス権**
   - プロジェクトオーナーまたは編集者権限が必要
   - プロジェクトID: `tokyo-list-478804-e5`

### 3.2 必要なツール

#### Google Cloud SDK（gcloud CLI）

**gcloud CLI** とは、コマンドラインからGoogle Cloudを操作するためのツールです。

**インストール確認:**
```bash
gcloud --version
```

バージョン番号が表示されればOKです。

**インストールされていない場合:**

#### Windowsの場合

1. Google Cloud SDK インストーラーをダウンロード:
   - https://cloud.google.com/sdk/docs/install にアクセス
   - 「Windows」をクリック
   - 「Google Cloud CLI インストーラ」をダウンロード

2. インストーラーを実行:
   - ダウンロードしたファイルをダブルクリック
   - 画面の指示に従ってインストール

3. インストール完了後、コマンドプロンプトまたはPowerShellを開いて確認:
   ```bash
   gcloud --version
   ```

#### macOSの場合

1. ターミナルを開いて以下を実行:
   ```bash
   curl https://sdk.cloud.google.com | bash
   ```

2. ターミナルを再起動し、確認:
   ```bash
   gcloud --version
   ```

#### 初期設定

インストール後、以下のコマンドで初期設定を行います:

```bash
# gcloudの初期化
gcloud init

# Googleアカウントでログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project tokyo-list-478804-e5
```

---

## 4. Google Cloud Consoleへのアクセス

### 4.1 Google Cloud Consoleとは

**Google Cloud Console** は、Google Cloudの各種サービスを管理するためのWebサイトです。ブラウザから操作できます。

### 4.2 アクセス手順

1. ブラウザで以下のURLを開く:
   ```
   https://console.cloud.google.com/
   ```

2. Googleアカウントでログイン

3. 画面上部のプロジェクト選択ドロップダウンをクリック

4. **tokyo-list-478804-e5** を選択
   - 見つからない場合は、検索ボックスで検索

5. 選択後、画面上部に `tokyo-list-478804-e5` と表示されていることを確認

---

## 5. BigQuery APIの有効化確認

BigQuery APIは既に有効化済みですが、確認方法を説明します。

### 5.1 コンソールから確認する方法

1. Google Cloud Consoleの左側メニューから「**APIとサービス**」→「**有効なAPIとサービス**」をクリック

2. 検索ボックスに「**BigQuery**」と入力

3. 「**BigQuery API**」が一覧に表示されていれば有効化済み

### 5.2 gcloudコマンドで確認する方法

```bash
# 有効なAPIの一覧を表示
gcloud services list --enabled --project=tokyo-list-478804-e5

# 結果に以下が含まれていればOK:
# bigquery.googleapis.com
```

### 5.3 有効化が必要な場合

もしAPIが無効だった場合（通常は不要）:

```bash
# BigQuery APIを有効化
gcloud services enable bigquery.googleapis.com --project=tokyo-list-478804-e5
```

---

## 6. データセット構成

### 6.1 現在のデータセット一覧

本プロジェクトでは以下の3つのデータセットを使用しています:

| データセット名 | リージョン | 用途 |
|---------------|----------|------|
| `fitness_analytics` | asia-northeast1（東京） | 本番環境のデータ |
| `fitness_analytics_dev` | asia-northeast1（東京） | 開発環境のデータ |
| `fitness_analytics_backup` | asia-northeast2（大阪） | バックアップ |

### 6.2 データセットの確認方法

#### コンソールから確認

1. Google Cloud Consoleの左側メニューから「**BigQuery**」をクリック

2. 左側のエクスプローラーパネルでプロジェクト `tokyo-list-478804-e5` を展開

3. 3つのデータセットが表示されることを確認

#### gcloudコマンドで確認

```bash
# データセット一覧を表示
bq ls tokyo-list-478804-e5:

# 結果例:
#   datasetId
#   --------------------------
#   fitness_analytics
#   fitness_analytics_backup
#   fitness_analytics_dev
```

### 6.3 データセット新規作成（参考）

新しい環境を作成する必要がある場合（通常は不要）:

```bash
# 新しいデータセットの作成例
bq --location=asia-northeast1 mk \
  --dataset \
  --default_table_expiration=63072000 \
  --description="説明文" \
  tokyo-list-478804-e5:データセット名
```

**コマンドの説明:**
- `bq`: BigQueryのコマンドラインツール
- `--location=asia-northeast1`: 東京リージョンを指定
- `--default_table_expiration=63072000`: 730日（秒単位）後に自動削除
- `mk --dataset`: データセットを新規作成

---

## 7. テーブル構成

### 7.1 現在のテーブル一覧

`fitness_analytics`（本番データセット）には以下の5つのテーブルがあります:

| テーブル名 | 用途 | パーティション | クラスタリング |
|-----------|------|---------------|---------------|
| `training_sessions` | トレーニングセッションデータ | created_at（日別） | user_id_hash, exercise_id |
| `user_metadata` | ユーザーメタデータ | updated_at（日別） | user_id_hash, country_code |
| `aggregated_stats` | 集計統計データ | stat_date（日別） | exercise_id, country_code |
| `exercise_definitions` | 種目マスタデータ | なし | なし |
| `pseudonymization_log` | 仮名化ログ | created_at（日別） | status, source_collection |

### 7.2 training_sessions テーブルの詳細

メインのトレーニングデータを格納するテーブルです。

#### スキーマ

| カラム名 | 型 | 必須 | 説明 |
|---------|-----|------|------|
| `session_id` | STRING | 必須 | セッションの一意識別子 |
| `user_id_hash` | STRING | 必須 | 仮名化されたユーザーID（SHA-256） |
| `exercise_id` | STRING | 必須 | 種目ID（squat, pushup等） |
| `start_time` | TIMESTAMP | 必須 | セッション開始時刻 |
| `end_time` | TIMESTAMP | 必須 | セッション終了時刻 |
| `duration_seconds` | INTEGER | 必須 | セッション時間（秒） |
| `created_at` | TIMESTAMP | 必須 | レコード作成日時（パーティションキー） |
| `rep_count` | INTEGER | 任意 | レップ数 |
| `set_count` | INTEGER | 任意 | セット数 |
| `average_score` | FLOAT | 任意 | 平均スコア（0-100） |
| `max_score` | FLOAT | 任意 | 最高スコア |
| `min_score` | FLOAT | 任意 | 最低スコア |
| `landmarks` | RECORD（繰り返し） | 任意 | フレームと骨格データ |
| `device_info` | RECORD | 任意 | デバイス情報 |
| `region` | STRING | 任意 | 地域コード |
| `is_deleted` | BOOLEAN | 任意 | 論理削除フラグ |
| `deleted_at` | TIMESTAMP | 任意 | 削除日時 |

#### landmarks 構造

`landmarks` は繰り返しフィールドで、各フレームの骨格データを格納します:

```json
{
  "frame_number": 1,
  "timestamp_ms": 1000,
  "joints": [
    {"id": 0, "x": 0.5, "y": 0.3, "z": 0.1, "visibility": 0.95},
    {"id": 1, "x": 0.52, "y": 0.32, "z": 0.12, "visibility": 0.92}
    // ... 33関節分
  ]
}
```

#### device_info 構造

デバイス情報を格納するネストされたレコード:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `platform` | STRING | iOS / Android |
| `os_version` | STRING | OSバージョン |
| `device_model` | STRING | デバイスモデル名 |
| `device_memory` | FLOAT | メモリ容量（GB） |
| `average_fps` | FLOAT | 平均FPS |
| `average_inference_time` | FLOAT | 平均推論時間（ms） |

### 7.3 user_metadata テーブルの詳細

ユーザーの集計データを格納するテーブルです。

#### スキーマ

| カラム名 | 型 | 必須 | 説明 |
|---------|-----|------|------|
| `user_id_hash` | STRING | 必須 | 仮名化されたユーザーID |
| `account_created_at` | TIMESTAMP | 必須 | アカウント作成日時 |
| `last_active_at` | TIMESTAMP | 任意 | 最終アクティブ日時 |
| `updated_at` | TIMESTAMP | 必須 | 更新日時（パーティションキー） |
| `total_sessions` | INTEGER | 任意 | 総セッション数 |
| `total_duration_seconds` | INTEGER | 任意 | 総トレーニング時間（秒） |
| `average_session_score` | FLOAT | 任意 | 平均セッションスコア |
| `age_group` | STRING | 任意 | 年代グループ |
| `country_code` | STRING | 任意 | 国コード |
| `subscription_plan` | STRING | 任意 | サブスクリプションプラン |
| `is_deleted` | BOOLEAN | 任意 | 論理削除フラグ |
| `deleted_at` | TIMESTAMP | 任意 | 削除日時 |

### 7.4 その他のテーブル

#### aggregated_stats

日次・週次・月次の集計統計を格納します。ダッシュボードやレポート用のデータです。

- **有効期限**: 2年
- **パーティション**: stat_date（日別）
- **クラスタリング**: exercise_id, country_code

#### exercise_definitions

5種目のマスタデータを格納します:

- squat（スクワット）
- pushup（プッシュアップ）
- armcurl（アームカール）
- sidelateral（サイドレイズ）
- shoulderpress（ショルダープレス）

#### pseudonymization_log

仮名化処理のログを格納します。GDPR監査対応用です。

- **有効期限**: 90日
- **パーティション**: created_at（日別）
- **クラスタリング**: status, source_collection

### 7.5 テーブルの確認方法

```bash
# テーブル一覧を表示
bq ls tokyo-list-478804-e5:fitness_analytics

# 結果例:
#       tableId            Type    Labels   Time Partitioning   Clustered Fields
#  -------------------- ------- -------- ------------------- --------------------------
#   aggregated_stats     TABLE            DAY                 exercise_id, country_code
#   exercise_definitions TABLE            -                   -
#   pseudonymization_log TABLE            DAY                 status, source_collection
#   training_sessions    TABLE            DAY                 user_id_hash, exercise_id
#   user_metadata        TABLE            DAY                 user_id_hash, country_code

# 特定テーブルのスキーマを確認
bq show --schema --format=prettyjson tokyo-list-478804-e5:fitness_analytics.training_sessions
```

---

## 8. サービスアカウントの設定

### 8.1 サービスアカウントとは

**サービスアカウント** とは、人間ではなくプログラム（Cloud Functionsなど）がGoogle Cloudにアクセスするための専用アカウントです。

### 8.2 現在の設定状況

Cloud FunctionsからBigQueryへのアクセス権限は既に設定済みです。

| 権限（ロール） | 説明 | ステータス |
|---------------|------|-----------|
| `roles/bigquery.dataEditor` | テーブルへのデータ追加・更新 | 設定済み |
| `roles/bigquery.jobUser` | クエリジョブの実行 | 設定済み |

### 8.3 確認方法

```bash
# サービスアカウントの権限を確認
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --filter="bindings.members:tokyo-list-478804-e5@appspot.gserviceaccount.com" \
  --format="table(bindings.role)"
```

### 8.4 権限追加が必要な場合（参考）

通常は不要ですが、権限が不足している場合:

```bash
# BigQuery データ編集者の権限を付与
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:tokyo-list-478804-e5@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# BigQuery ジョブユーザーの権限を付与
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:tokyo-list-478804-e5@appspot.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

---

## 9. Firestore to BigQuery 連携

### 9.1 連携の仕組み

このプロジェクトでは、以下の流れでFirestoreのデータをBigQueryに送信します:

```
アプリ
  | トレーニング完了
Firestore
  | ドキュメント作成・更新（Trigger発火）
Cloud Functions
  | 仮名化処理（ユーザーIDをハッシュ化）
BigQuery
  | ストリーミングインサート
分析データとして保存
```

### 9.2 仮名化処理について

**仮名化** とは、個人を特定できないようにデータを変換することです。GDPR（欧州のプライバシー保護法）に準拠するために必要です。

**このプロジェクトでの仮名化:**
- ユーザーID → SHA-256でハッシュ化
- メールアドレス → 送信しない
- カメラ映像 → 送信しない（骨格座標のみ）

### 9.3 環境変数の設定

Cloud FunctionsでBigQueryを使用するには、環境変数の設定が必要です。

```bash
# functionsフォルダに移動
cd functions

# .envファイルを作成（存在しない場合）
# 以下の内容を追加
```

`.env` ファイルに追加:
```
PSEUDONYMIZATION_SALT=your-secret-salt-value-here
BIGQUERY_DATASET=fitness_analytics
```

**注意**: `PSEUDONYMIZATION_SALT` は秘密の値です。チーム内で共有されている値を使用してください。

---

## 10. 動作確認

### 10.1 BigQueryコンソールでのクエリ実行

1. Google Cloud Consoleで「**BigQuery**」を開く

2. 「**クエリを作成**」をクリック

3. 以下のサンプルクエリを貼り付けて「**実行**」をクリック:

```sql
-- テーブルの存在確認
SELECT table_name
FROM `tokyo-list-478804-e5.fitness_analytics.INFORMATION_SCHEMA.TABLES`;
```

4. 結果にテーブル名（training_sessions, user_metadata, aggregated_stats, exercise_definitions, pseudonymization_log）が表示されればOK

### 10.2 サンプルデータの挿入テスト（開発環境用）

テスト用にダミーデータを挿入してみましょう（開発環境を使用）:

```sql
-- テストデータの挿入（開発環境）
INSERT INTO `tokyo-list-478804-e5.fitness_analytics_dev.training_sessions` (
  session_id,
  user_id_hash,
  exercise_id,
  start_time,
  end_time,
  duration_seconds,
  created_at,
  rep_count,
  set_count,
  average_score,
  max_score,
  min_score,
  region
) VALUES (
  'test_session_001',
  'test_hash_12345abcdef',
  'squat',
  TIMESTAMP('2025-12-10 10:00:00'),
  TIMESTAMP('2025-12-10 10:05:00'),
  300,
  TIMESTAMP('2025-12-10 10:05:00'),
  30,
  3,
  85.5,
  92.0,
  78.0,
  'JP'
);
```

### 10.3 データの確認クエリ

挿入したデータを確認:

```sql
-- 挿入したデータの確認（開発環境）
SELECT
  session_id,
  exercise_id,
  rep_count,
  average_score,
  duration_seconds
FROM `tokyo-list-478804-e5.fitness_analytics_dev.training_sessions`
WHERE DATE(created_at) = '2025-12-10';
```

### 10.4 分析クエリの例

実際に使用する分析クエリの例:

#### 種目別平均スコア

```sql
SELECT
  exercise_id,
  COUNT(*) AS session_count,
  AVG(average_score) AS avg_score,
  MAX(max_score) AS best_score,
  SUM(rep_count) AS total_reps
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND is_deleted IS NOT TRUE
GROUP BY exercise_id
ORDER BY session_count DESC;
```

#### ユーザー活動サマリー

```sql
SELECT
  user_id_hash,
  total_sessions,
  total_duration_seconds / 3600 AS total_hours,
  average_session_score,
  subscription_plan
FROM `tokyo-list-478804-e5.fitness_analytics.user_metadata`
WHERE updated_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND is_deleted IS NOT TRUE
ORDER BY total_sessions DESC
LIMIT 100;
```

#### デバイス別パフォーマンス分析

```sql
SELECT
  device_info.platform,
  device_info.device_model,
  COUNT(*) AS session_count,
  AVG(device_info.average_fps) AS avg_fps,
  AVG(device_info.average_inference_time) AS avg_inference_ms
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND device_info IS NOT NULL
  AND is_deleted IS NOT TRUE
GROUP BY device_info.platform, device_info.device_model
HAVING session_count >= 10
ORDER BY avg_fps DESC
LIMIT 20;
```

#### 国別統計

```sql
SELECT
  country_code,
  COUNT(DISTINCT user_id_hash) AS unique_users,
  SUM(total_sessions) AS total_sessions,
  AVG(average_session_score) AS avg_score
FROM `tokyo-list-478804-e5.fitness_analytics.user_metadata`
WHERE updated_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND is_deleted IS NOT TRUE
GROUP BY country_code
ORDER BY unique_users DESC;
```

---

## 11. トラブルシューティング

### 11.1 よくあるエラーと対処法

#### エラー: `Access Denied: BigQuery BigQuery: Permission denied`

**原因**: サービスアカウントにBigQueryへのアクセス権限がない

**解決法**:
1. Google Cloud Consoleで「IAMと管理」→「IAM」を開く
2. サービスアカウントに以下のロールを追加:
   - `BigQuery データ編集者`
   - `BigQuery ジョブユーザー`

または、プロジェクト管理者に `roles/bigquery.admin` 権限を依頼

#### エラー: `Not found: Dataset`

**原因**: 指定したデータセットが存在しない

**解決法**:
1. データセット名のスペルを確認（`fitness_analytics` が正しい名前）
2. プロジェクトIDが正しいか確認
3. データセットが作成されているか確認:
```bash
bq ls tokyo-list-478804-e5:
```

#### エラー: `Not found: Table`

**原因**: 指定したテーブルが存在しない

**解決法**:
1. テーブル名のスペルを確認（`training_sessions` が正しい名前）
2. テーブルが作成されているか確認:
```bash
bq ls tokyo-list-478804-e5:fitness_analytics
```

#### エラー: `Cannot query over table without a filter over column(s) 'created_at'`

**原因**: パーティションフィルタが必要なテーブルにフィルタなしでクエリを実行した

**解決法**: WHERE句にパーティションキーのフィルタを追加:
```sql
WHERE created_at >= TIMESTAMP('2025-01-01')
-- または
WHERE DATE(created_at) = '2025-12-10'
```

#### エラー: `Quota exceeded`

**原因**: クエリの使用量制限を超えた

**解決法**:
1. クエリを最適化して、スキャンするデータ量を減らす
2. パーティションフィルタを使用する
3. 必要なカラムだけを選択する（`SELECT *` を避ける）

#### エラー: `Table already exists`

**原因**: テーブルが既に存在しています

**解決法**:
これは正常な動作です。再作成したい場合は、先にテーブルを削除してください:

```bash
bq rm -f tokyo-list-478804-e5:fitness_analytics.テーブル名
```

### 11.2 ログの確認方法

BigQueryのジョブログを確認するには:

1. Google Cloud Consoleで「**BigQuery**」を開く
2. 左側メニューの「**ジョブ履歴**」をクリック
3. エラーのあるジョブをクリックして詳細を確認

Cloud Functionsのログを確認するには:

1. Google Cloud Consoleで「**Cloud Functions**」を開く
2. 該当する関数をクリック
3. 「**ログ**」タブをクリック

---

## 12. 参考情報

### 12.1 公式ドキュメント

| ドキュメント | URL |
|------------|-----|
| BigQuery公式ドキュメント | https://cloud.google.com/bigquery/docs |
| BigQuery SQLリファレンス | https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax |
| gcloud CLIリファレンス | https://cloud.google.com/sdk/gcloud/reference/bq |
| IAMの概要 | https://cloud.google.com/iam/docs/overview |

### 12.2 プロジェクト内の関連ファイル

| ファイル | 説明 |
|---------|------|
| `docs/common/specs/05_BigQuery設計書_v1_0.md` | BigQueryの詳細設計（注：実環境とは一部異なる） |
| `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` | API設計（BigQuery連携含む） |
| `functions/src/services/bigquery/` | BigQuery連携のコード |

### 12.3 関連ガイド

| ガイド | 内容 |
|-------|------|
| `01_開発環境セットアップ.md` | 開発環境の構築手順 |
| `04_デプロイ方法.md` | 本番環境への公開方法 |
| `06_本番デプロイ前の確認事項.md` | デプロイ前チェックリスト |
| `08_Firebase_Emulator_Test_Guide.md` | ローカルテスト方法 |

---

## 用語集

| 用語 | 読み方 | 意味 |
|------|--------|------|
| **BigQuery** | ビッグクエリ | Googleの大規模データ分析サービス |
| **データセット** | - | テーブルをまとめるフォルダのようなもの |
| **テーブル** | - | データを行と列で保存する場所 |
| **スキーマ** | - | テーブルの列の定義（名前、型など） |
| **パーティション** | - | データを日付などで分割する仕組み |
| **クラスタリング** | - | データを特定の列でまとめて保存する仕組み |
| **サービスアカウント** | - | プログラム用のGoogleアカウント |
| **IAM** | アイアム | Identity and Access Management（アクセス権限管理） |
| **仮名化** | - | 個人を特定できないようにデータを変換すること |
| **ストリーミングインサート** | - | リアルタイムでデータを挿入する方法 |
| **gcloud CLI** | ジークラウド・シーエルアイ | Google Cloudをコマンドで操作するツール |
| **GDPR** | ジーディーピーアール | EU一般データ保護規則（プライバシー保護法） |

---

## 次のステップ

BigQueryのセットアップは完了しています。次のステップとして:

1. **Cloud Functionsの開発** - BigQuery連携コードの実装（`03_Cloud_Functionsの開発.md` 参照）
2. **分析クエリの作成** - ビジネス要件に応じた分析クエリの開発
3. **動作確認** - Firebaseエミュレータでテスト（`08_Firebase_Emulator_Test_Guide.md` 参照）

---

## 設定情報まとめ

| 項目 | 値 |
|------|-----|
| **プロジェクトID** | `tokyo-list-478804-e5` |
| **リージョン** | `asia-northeast1`（東京） |
| **本番データセット** | `fitness_analytics` |
| **開発データセット** | `fitness_analytics_dev` |
| **バックアップデータセット** | `fitness_analytics_backup`（大阪リージョン） |
| **メインテーブル** | `training_sessions` |
| **ユーザーデータテーブル** | `user_metadata` |
| **データ保存期間** | 730日（2年） |
| **サービスアカウント** | `tokyo-list-478804-e5@appspot.gserviceaccount.com` |

---

**セットアップは完了しています！**

このガイドは主に確認・参照用です。BigQueryを使ってアプリのトレーニングデータを分析する準備は整っています。
