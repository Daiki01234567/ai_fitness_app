# BigQuery セットアップガイド

**対象者**: 初学者・開発者
**所要時間**: 約60分
**前提条件**:
- Google Cloudアカウント作成済み
- Firebase プロジェクト（`tokyo-list-478804-e5`）作成済み
- gcloud CLI インストール済み（推奨）

**参照仕様書**: `docs/specs/04_BigQuery設計書_v3_3.md`

---

## 目次

1. [BigQueryとは](#1-bigqueryとは)
2. [セットアップ準備](#2-セットアップ準備)
3. [データセット作成](#3-データセット作成)
4. [IAM権限設定](#4-iam権限設定)
5. [Pub/Subトピック作成](#5-pubsubトピック作成)
6. [予算アラート設定](#6-予算アラート設定オプション)
7. [次のステップ](#7-次のステップ)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. BigQueryとは

### 1.1 概要

**BigQuery**は、Google Cloudが提供する完全マネージド型のデータウェアハウスサービスです。大量のデータを高速に分析できます。

**このプロジェクトでの用途**:
- トレーニングセッションデータの長期保存
- ユーザー行動の統計分析（DAU/MAU計算など）
- 将来のカスタムMLモデル開発のためのデータ蓄積

### 1.2 なぜBigQueryが必要か

Firestoreは**リアルタイム性**に優れていますが、大規模な分析には向いていません。BigQueryは以下が得意です：

- 数百万件のデータを数秒でスキャン
- 複雑な集計クエリ（ユーザー統計、トレンド分析など）
- GDPR準拠のデータ保持期間管理（自動削除）

**データの流れ**:
```
Firestore（リアルタイムDB）
    ↓ Pub/Sub経由でストリーミング
Cloud Functions（仮名化処理）
    ↓ ユーザーIDをハッシュ化
BigQuery（分析基盤）
    ↓ 2年間保存後に自動削除（GDPR準拠）
```

---

## 2. セットアップ準備

### 2.1 Google Cloudコンソールにアクセス

1. ブラウザで [Google Cloud Console](https://console.cloud.google.com/) を開く
2. プロジェクト選択: `tokyo-list-478804-e5` を選択

### 2.2 BigQuery APIの有効化

**GUIでの操作**:
1. 左側メニュー「APIとサービス」→「ライブラリ」をクリック
2. 検索ボックスに「BigQuery API」と入力
3. 「BigQuery API」をクリック
4. 「有効にする」ボタンをクリック

**コマンドラインでの操作**:
```bash
# gcloud CLIで有効化
gcloud services enable bigquery.googleapis.com --project=tokyo-list-478804-e5
```

> **なぜ必要か**: APIを有効化しないとBigQueryを使用できません。最初に1回だけ実行します。

---

## 3. データセット作成

### 3.1 データセットとは

**データセット**は、BigQuery内でテーブルをグループ化する「フォルダ」のようなものです。

このプロジェクトでは3つのデータセットを作成します：

| データセット名 | 用途 | ロケーション |
|-------------|------|------------|
| `fitness_analytics` | 本番環境データ | 東京（asia-northeast1） |
| `fitness_analytics_dev` | 開発・テスト用 | 東京（asia-northeast1） |
| `fitness_analytics_backup` | バックアップ用 | 大阪（asia-northeast2） |

### 3.2 本番データセットの作成

#### 方法1: GUIでの作成（推奨：初学者向け）

1. Google Cloud Console左側メニュー「BigQuery」をクリック
2. SQLワークスペース画面が開きます
3. 左側のエクスプローラーで、プロジェクト名（`tokyo-list-478804-e5`）を探す
4. プロジェクト名の右側にある「︙」（縦三点メニュー）をクリック
5. 「データセットを作成」を選択

**設定項目**:
- **データセットID**: `fitness_analytics`
- **データのロケーション**: `asia-northeast1`（東京）
- **デフォルトのテーブル有効期限**: 63072000 秒（730日 = 2年間）
  - 理由: GDPR準拠のため2年間でデータを自動削除
- **デフォルトのパーティション有効期限**: 63072000 秒
- **暗号化**: Google管理の暗号鍵（デフォルト）

6. 「データセットを作成」ボタンをクリック

#### 方法2: コマンドラインでの作成

```bash
# 本番データセット作成
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 本番分析データ" \
  --default_table_expiration=63072000 \
  --default_partition_expiration=63072000 \
  tokyo-list-478804-e5:fitness_analytics
```

> **重要**: `63072000`は秒単位です。730日 × 24時間 × 60分 × 60秒 = 63,072,000秒です。

**確認方法**:
```bash
# データセットの一覧を表示
bq ls --project_id=tokyo-list-478804-e5

# 特定データセットの詳細を確認
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics
```

### 3.3 開発データセットの作成

**GUIでの作成**:
- データセットID: `fitness_analytics_dev`
- データのロケーション: `asia-northeast1`
- デフォルトのテーブル有効期限: 2592000 秒（30日）

**コマンドライン**:
```bash
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 開発・テスト用データ" \
  --default_table_expiration=2592000 \
  tokyo-list-478804-e5:fitness_analytics_dev
```

> **なぜ30日か**: 開発環境のデータは短期間で削除することでコストを削減します。

### 3.4 バックアップデータセットの作成

**GUIでの作成**:
- データセットID: `fitness_analytics_backup`
- データのロケーション: `asia-northeast2`（大阪）← **東京と異なる点に注意**

**コマンドライン**:
```bash
bq mk \
  --dataset \
  --location=asia-northeast2 \
  --description="AIフィットネスアプリ バックアップデータ(クロスリージョン)" \
  tokyo-list-478804-e5:fitness_analytics_backup
```

> **なぜ大阪リージョンか**: 東京リージョン障害時のディザスタリカバリ（災害復旧）のため、異なるリージョンにバックアップを配置します。

### 3.5 作成確認

```bash
# 全データセットの確認
bq ls --project_id=tokyo-list-478804-e5

# 期待される出力:
#  datasetId              location
# ---------------------- ---------------
#  fitness_analytics      asia-northeast1
#  fitness_analytics_dev  asia-northeast1
#  fitness_analytics_backup asia-northeast2
```

---

## 4. IAM権限設定

### 4.1 IAMとは

**IAM（Identity and Access Management）**は、「誰が」「何を」できるかを管理する仕組みです。

### 4.2 必要な権限

このプロジェクトでは以下の権限が必要です：

| 対象 | 必要な権限 | 理由 |
|-----|----------|------|
| Cloud Functions（本番） | BigQuery データ編集者 + ジョブユーザー | Firestoreからデータを書き込むため |
| 開発者（あなた） | BigQuery 管理者 | データセット・テーブル管理のため |
| データアナリスト（将来） | BigQuery データ閲覧者 | 分析クエリ実行のため |

### 4.3 Cloud Functionsサービスアカウントへの権限付与

#### 4.3.1 サービスアカウントの確認

**GUIでの確認**:
1. Google Cloud Console → 「IAMと管理」→「サービスアカウント」
2. `firebase-adminsdk-xxxxx@tokyo-list-478804-e5.iam.gserviceaccount.com` を探す

**コマンドラインでの確認**:
```bash
gcloud iam service-accounts list --project=tokyo-list-478804-e5
```

#### 4.3.2 権限の付与

**方法1: GUIでの付与**

1. Google Cloud Console → 「IAMと管理」→「IAM」
2. 「プリンシパルを追加」ボタンをクリック
3. 新しいプリンシパル欄に、上記のサービスアカウントメールアドレスを入力
4. 「ロールを選択」をクリック
5. 「BigQuery」→「BigQuery データ編集者」を選択
6. 「別のロールを追加」をクリック
7. 「BigQuery」→「BigQuery ジョブユーザー」を選択
8. 「保存」ボタンをクリック

**方法2: コマンドラインでの付与**

```bash
# Firebase Admin SDKのサービスアカウントメールアドレスを変数に設定
# 実際のメールアドレスに置き換えてください
SERVICE_ACCOUNT="firebase-adminsdk-xxxxx@tokyo-list-478804-e5.iam.gserviceaccount.com"

# BigQuery データ編集者権限
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.dataEditor"

# BigQuery ジョブユーザー権限
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.jobUser"
```

> **なぜ2つの権限が必要か**:
> - **データ編集者**: テーブルへのデータ挿入に必要
> - **ジョブユーザー**: クエリ実行に必要

#### 4.3.3 権限確認

```bash
# 付与された権限を確認
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:firebase-adminsdk-*"
```

### 4.4 開発者への権限付与（あなた自身）

**GUIでの付与**:
1. 「IAMと管理」→「IAM」
2. 自分のGoogleアカウントを探す
3. 「編集」（鉛筆アイコン）をクリック
4. 「BigQuery 管理者」ロールを追加

**コマンドライン**:
```bash
# 自分のメールアドレスに置き換えてください
YOUR_EMAIL="your-email@example.com"

gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/bigquery.admin"
```

---

## 5. Pub/Subトピック作成

### 5.1 Pub/Subとは

**Pub/Sub**は、Google Cloudのメッセージングサービスです。アプリケーション間でデータを非同期に送受信できます。

**このプロジェクトでの用途**:
```
Firestore（セッション作成）
    ↓ トリガー発火
Cloud Functions（トリガー関数）
    ↓ Pub/Subにメッセージ送信
Pub/Sub（キュー）
    ↓ メッセージ配信
Cloud Functions（仮名化処理）
    ↓ BigQueryに挿入
```

### 5.2 Pub/Sub APIの有効化

```bash
gcloud services enable pubsub.googleapis.com --project=tokyo-list-478804-e5
```

### 5.3 トピックの作成

#### 5.3.1 メイントピック（training-sessions-stream）

**GUIでの作成**:
1. Google Cloud Console → 「Pub/Sub」→「トピック」
2. 「トピックを作成」ボタンをクリック
3. トピックID: `training-sessions-stream`
4. 「デフォルトのサブスクリプションを追加する」にチェック
5. 「作成」ボタンをクリック

**コマンドライン**:
```bash
# トピック作成
gcloud pubsub topics create training-sessions-stream \
  --project=tokyo-list-478804-e5

# サブスクリプション作成
gcloud pubsub subscriptions create training-sessions-stream-sub \
  --topic=training-sessions-stream \
  --ack-deadline=60 \
  --project=tokyo-list-478804-e5
```

> **サブスクリプションとは**: トピックに送られたメッセージを受信するための「受信箱」のようなものです。

#### 5.3.2 Dead Letter Queue（DLQ）トピック

**DLQとは**: 処理に失敗したメッセージを保存する特別なキューです。

**コマンドライン**:
```bash
# DLQトピック作成
gcloud pubsub topics create training-sessions-dlq \
  --project=tokyo-list-478804-e5

# DLQサブスクリプション作成
gcloud pubsub subscriptions create training-sessions-dlq-sub \
  --topic=training-sessions-dlq \
  --ack-deadline=600 \
  --project=tokyo-list-478804-e5
```

> **なぜDLQが必要か**: BigQuery挿入に失敗したデータを保存し、後で手動リカバリできるようにするためです。

#### 5.3.3 DLQとメインサブスクリプションの連携設定

```bash
# メインサブスクリプションにDLQ設定を追加
gcloud pubsub subscriptions update training-sessions-stream-sub \
  --dead-letter-topic=training-sessions-dlq \
  --max-delivery-attempts=5 \
  --project=tokyo-list-478804-e5
```

> **max-delivery-attempts=5**: 5回失敗したらDLQに送る設定です。

### 5.4 作成確認

```bash
# トピック一覧
gcloud pubsub topics list --project=tokyo-list-478804-e5

# サブスクリプション一覧
gcloud pubsub subscriptions list --project=tokyo-list-478804-e5
```

---

## 6. 予算アラート設定（オプション）

### 6.1 なぜ予算アラートが必要か

BigQueryは**使った分だけ課金**されます。予期せぬ高額請求を防ぐため、予算アラートを設定します。

### 6.2 コスト見積もり（MVP期）

仕様書（04_BigQuery設計書_v3_3.md）によると、MVP期（DAU 100人）の想定コストは：

```
ストレージコスト: $0.11/月
クエリコスト: $0/月（無料枠内）
ストリーミング挿入: $0/月（無料枠内）
合計: 約$0.11/月（約15円/月）
```

### 6.3 予算の設定

#### 6.3.1 Cloud Billing APIの有効化

```bash
gcloud services enable cloudbilling.googleapis.com --project=tokyo-list-478804-e5
```

#### 6.3.2 請求アカウントIDの確認

```bash
# 請求アカウントの一覧
gcloud billing accounts list

# 出力例:
# ACCOUNT_ID            NAME                  OPEN  MASTER_ACCOUNT_ID
# 01XXXX-XXXXXX-XXXXXX  My Billing Account    True
```

#### 6.3.3 通知チャネルの作成（メール通知）

**GUIでの作成**:
1. Google Cloud Console → 「モニタリング」→「アラート」→「通知チャネル」
2. 「チャネルを追加」ボタンをクリック
3. 「Email」を選択
4. メールアドレスを入力
5. 「保存」ボタンをクリック

#### 6.3.4 予算アラートの作成

**GUIでの作成**（推奨）:
1. Google Cloud Console → 「課金」→「予算とアラート」
2. 「予算を作成」ボタンをクリック
3. **範囲の設定**:
   - プロジェクト: `tokyo-list-478804-e5`
   - サービス: `BigQuery`
4. **予算額の設定**:
   - 予算タイプ: 指定した金額
   - ターゲット金額: `10` USD/月
5. **アクションの設定**:
   - しきい値ルール:
     - 50%（$5）: 警告メール送信
     - 90%（$9）: 重大警告メール送信
     - 100%（$10）: 緊急アラート
   - 通知チャネル: 上記で作成したメールを選択
6. 「完了」ボタンをクリック

**コマンドライン**:
```bash
# 請求アカウントIDを設定（上記で確認したIDに置き換え）
BILLING_ACCOUNT_ID="01XXXX-XXXXXX-XXXXXX"

# 通知チャネルIDの確認（GUIで作成したチャネルのID）
gcloud alpha monitoring channels list --project=tokyo-list-478804-e5

# 予算アラートの作成
gcloud billing budgets create \
  --billing-account=${BILLING_ACCOUNT_ID} \
  --display-name="BigQuery Monthly Budget" \
  --budget-amount=10 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --notification-channel-ids=NOTIFICATION_CHANNEL_ID
```

> **ヒント**: `NOTIFICATION_CHANNEL_ID` は `gcloud alpha monitoring channels list` で確認できます。

---

## 7. 次のステップ

### 7.1 完了確認チェックリスト

以下の項目をすべて完了したか確認してください：

- [ ] BigQuery API有効化完了
- [ ] データセット `fitness_analytics` 作成完了
- [ ] データセット `fitness_analytics_dev` 作成完了
- [ ] データセット `fitness_analytics_backup` 作成完了
- [ ] Cloud Functionsサービスアカウントに権限付与完了
- [ ] 自分のアカウントにBigQuery管理者権限付与完了
- [ ] Pub/Subトピック `training-sessions-stream` 作成完了
- [ ] Pub/Subトピック `training-sessions-dlq` 作成完了
- [ ] 予算アラート設定完了（オプション）

### 7.2 開発者が行う次の作業

ユーザー（あなた）がここまで完了したら、開発者は以下の作業を行います：

1. **テーブル作成** (`training_sessions`, `user_metadata`など)
2. **Cloud Functions実装** (Firestore → Pub/Sub → BigQuery)
3. **仮名化処理の実装** (ユーザーIDのSHA-256ハッシュ化)
4. **エラーハンドリング** (DLQへのルーティング)
5. **日次集計処理** (aggregated_statsテーブル)

### 7.3 動作確認方法（開発者実装後）

開発者の実装完了後、以下のコマンドで動作確認できます：

```bash
# テーブルの一覧を確認
bq ls tokyo-list-478804-e5:fitness_analytics

# training_sessionsテーブルのデータ件数確認
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) as total_sessions FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`'

# 最新10件のセッションを確認
bq query --use_legacy_sql=false \
  'SELECT session_id, exercise_id, average_score, created_at
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   ORDER BY created_at DESC
   LIMIT 10'
```

---

## 8. トラブルシューティング

### 8.1 よくあるエラーと解決方法

#### エラー1: 「BigQuery API has not been used in project XXX」

**原因**: BigQuery APIが有効化されていません。

**解決方法**:
```bash
gcloud services enable bigquery.googleapis.com --project=tokyo-list-478804-e5
```

#### エラー2: 「Access Denied: BigQuery BigQuery: Permission denied」

**原因**: IAM権限が不足しています。

**解決方法**:
1. 自分のアカウントに「BigQuery 管理者」権限があるか確認
2. ない場合は、プロジェクトオーナーに権限付与を依頼

確認コマンド:
```bash
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:YOUR_EMAIL"
```

#### エラー3: 「Dataset 'tokyo-list-478804-e5:fitness_analytics' not found」

**原因**: データセットが作成されていません。

**解決方法**:
セクション3の手順を再実行してデータセットを作成してください。

#### エラー4: 「bq: command not found」

**原因**: gcloud CLIがインストールされていないか、bqコマンドがパスに含まれていません。

**解決方法**:
```bash
# gcloud CLIのインストール
# macOS
brew install --cask google-cloud-sdk

# Windows
# https://cloud.google.com/sdk/docs/install からインストーラーをダウンロード

# インストール後、初期化
gcloud init
```

#### エラー5: Pub/Subトピック作成時「Permission denied」

**原因**: Pub/Sub管理者権限が不足しています。

**解決方法**:
```bash
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
  --member="user:YOUR_EMAIL" \
  --role="roles/pubsub.admin"
```

### 8.2 データセットロケーション確認

データセットが正しいリージョンに作成されているか確認：

```bash
# fitness_analytics（東京）
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics | grep location

# 期待される出力: "location": "asia-northeast1"

# fitness_analytics_backup（大阪）
bq show --format=prettyjson tokyo-list-478804-e5:fitness_analytics_backup | grep location

# 期待される出力: "location": "asia-northeast2"
```

### 8.3 Pub/Subメッセージ送信テスト

Pub/Subトピックが正しく動作しているか確認：

```bash
# テストメッセージを送信
gcloud pubsub topics publish training-sessions-stream \
  --message='{"test": "message"}' \
  --project=tokyo-list-478804-e5

# サブスクリプションからメッセージを取得
gcloud pubsub subscriptions pull training-sessions-stream-sub \
  --limit=1 \
  --project=tokyo-list-478804-e5
```

### 8.4 ヘルプとサポート

**公式ドキュメント**:
- [BigQuery ドキュメント](https://cloud.google.com/bigquery/docs)
- [Pub/Sub ドキュメント](https://cloud.google.com/pubsub/docs)
- [IAM ドキュメント](https://cloud.google.com/iam/docs)

**プロジェクト内部ドキュメント**:
- `docs/specs/04_BigQuery設計書_v3_3.md` - 詳細な設計仕様
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` - 全体アーキテクチャ

**問題が解決しない場合**:
- プロジェクトのIssueトラッカーに報告
- チームの技術リードに相談

---

## 付録A: 用語集

| 用語 | 説明 |
|-----|------|
| **BigQuery** | Google Cloudのデータウェアハウスサービス。大量データの高速分析が可能 |
| **データセット** | BigQuery内でテーブルをグループ化する単位（フォルダのようなもの） |
| **テーブル** | 実際のデータを格納する単位（Excelのシートのようなもの） |
| **パーティション** | テーブルを日付で分割する機能。クエリコストを削減できる |
| **IAM** | Identity and Access Management。誰が何をできるかを管理 |
| **サービスアカウント** | アプリケーション用のGoogleアカウント。Cloud Functionsが使用 |
| **Pub/Sub** | メッセージングサービス。非同期でデータを送受信 |
| **トピック** | Pub/Subでメッセージを送信する宛先 |
| **サブスクリプション** | Pub/Subでメッセージを受信する受信箱 |
| **DLQ** | Dead Letter Queue。処理失敗したメッセージを保存するキュー |
| **仮名化** | ユーザーIDをハッシュ化し、個人を特定できないようにする処理 |
| **GDPR** | EU一般データ保護規則。個人データ保護に関する法律 |

---

## 付録B: コスト管理のヒント

### MVP期の想定コスト

```
月間コスト（DAU 100人）:
- ストレージ: $0.11/月
- クエリ: $0/月（無料枠内）
- ストリーミング挿入: $0/月（無料枠内）
合計: 約$0.11/月（約15円/月）
```

### コスト削減のベストプラクティス

1. **パーティションフィルタを必ず使う**
   ```sql
   -- ❌ 悪い例: 全データスキャン
   SELECT * FROM training_sessions WHERE user_id_hash = 'abc';

   -- ✅ 良い例: パーティションフィルタあり
   SELECT *
   FROM training_sessions
   WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
     AND user_id_hash = 'abc';
   ```

2. **不要なデータは早めに削除**
   - 開発データセット: 30日で自動削除
   - 本番データセット: 2年間で自動削除（GDPR準拠）

3. **集計テーブルを活用**
   - リアルタイムクエリより99%コスト削減
   - `aggregated_stats` テーブルを使う

4. **予算アラートで監視**
   - 月$10を超えたらアラート
   - Slackに通知を送る

---

**セットアップガイド完了**

質問や問題があれば、チームに相談してください。
