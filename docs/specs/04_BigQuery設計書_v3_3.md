# BigQuery設計書 v3.3 (Part 1/3)

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.3 (MVP)  
**作成日**: 2025年11月23日  
**最終更新日**: 2025年11月24日  
**対象期間**: Phase 1-2 (0-4ヶ月)  
**ステータス**: Draft

---

## 📝 v3.3での主な変更点

### プロジェクト懸念点分析v1.0に基づく重要な更新

✅ **コスト予測の現実化と監視強化 (懸念点#8対応)**:
- ストリーミング挿入コストの再評価(10,000セッション/日で$15-30/月の可能性)
- 日次コストアラートの設定($5/日を超えたら通知)
- クエリごとのコスト追跡機能の追加
- 四半期ごとのコスト見直しプロセスを明記

✅ **BigQueryの仮名化処理の耐障害性向上 (懸念点#4対応)**:
- Cloud Functions障害時のリトライロジック実装
- Dead Letter Queue(DLQ)による失敗データの保持
- 仮名化失敗時のアラート通知設計
- 手動リカバリ手順の文書化

✅ **パーティショニングとクラスタリングの最適化**:
- パーティション有効期限の自動管理(730日)
- クラスタリングキーの最適化(user_id_hash, exercise_id, DATE(created_at))
- 集計テーブルの活用によるコスト99%削減戦略

✅ **データ保持期間の詳細管理**:
- GDPR準拠の2年間保持ポリシー
- 論理削除から物理削除までの30日猶予期間管理
- 長期ストレージへの自動移行(90日経過後)

✅ **IAMとセキュリティの強化**:
- 最小権限の原則に基づくロール設計
- データエンジニア、データアナリスト、MLエンジニア別のアクセス権限
- 監査ログの有効化とアラート設定
- CMEK(顧客管理暗号鍵)の実装計画

✅ **ML移行準備の具体化 (懸念点#6, #11対応)**:
- MediaPipe 33関節点データの詳細記録
- 10,000セッション達成後のデータ品質評価基準
- アノテーション作業計画のフレームワーク
- Phase 4カスタムML移行のロードマップ

✅ **バックアップとDR計画の追加 (懸念点#16対応)**:
- BigQueryスナップショットの日次自動取得
- RTO 24時間以内のリストア手順
- クロスリージョンバックアップの設定

---

## 目次

### Part 1: 概要〜テーブル設計
1. [ドキュメント概要](#1-ドキュメント概要)
2. [BigQuery利用目的](#2-bigquery利用目的)
3. [データセット設計](#3-データセット設計)
4. [テーブル設計](#4-テーブル設計)

### Part 2: データパイプライン〜クエリ
5. [データパイプライン設計](#5-データパイプライン設計)
6. [プライバシーとコンプライアンス](#6-プライバシーとコンプライアンス)
7. [分析用クエリ](#7-分析用クエリ)
8. [パフォーマンス最適化](#8-パフォーマンス最適化)

### Part 3: 運用〜付録
9. [コスト管理](#9-コスト管理)
10. [監視とアラート](#10-監視とアラート)
11. [データライフサイクル管理](#11-データライフサイクル管理)
12. [セキュリティ](#12-セキュリティ)
13. [運用手順](#13-運用手順)
14. [付録](#14-付録)

---

## 1. ドキュメント概要

### 1.1 目的

本ドキュメントは、AIフィットネスアプリ(仮称)のBigQuery設計を定義します。以下の要件を満たすデータウェアハウス設計を提供します:

- **データ分析**: トレーニングデータの統計分析
- **ML学習準備**: 将来のカスタムMLモデル開発のためのデータ蓄積(Phase 4以降)
- **サービス改善**: ユーザー行動分析によるサービス最適化
- **GDPR準拠**: プライバシーポリシーv3.1に完全準拠
- **コスト最適化**: MVP期における費用対効果の最大化
- **耐障害性**: 仮名化処理の失敗に対する自動リトライとリカバリ

### 1.2 想定読者

- バックエンドエンジニア
- データエンジニア
- MLエンジニア(Phase 4以降)
- プロジェクトマネージャー
- データアナリスト
- セキュリティエンジニア

### 1.3 参照ドキュメント

| ドキュメント名 | バージョン | 参照目的 |
|--------------|-----------|---------|
| 要件定義書 | v3.3 | 機能要件・非機能要件の詳細 |
| プロジェクト懸念点分析 | v1.0 | リスク対策とコスト最適化 |
| システムアーキテクチャ設計書 | v3.2 | 全体アーキテクチャとの整合性 |
| Firestoreデータベース設計書 | v3.3 | データソースの構造理解 |
| プライバシーポリシー | v3.1 | データ保存期間・法的根拠 |
| 利用規約 | v3.2 | サービス定義・制限事項 |
| セキュリティポリシー | v1.0 | セキュリティ要件 |
| データ処理記録(ROPA) | v1.0 | GDPR準拠の処理活動記録 |

### 1.4 用語定義

| 用語 | 定義 |
|-----|------|
| **データセット** | BigQuery内のテーブルを論理的にグループ化する単位 |
| **テーブル** | 構造化データを格納する単位 |
| **パーティション** | テーブルを日付や時刻で分割する機能 |
| **クラスタリング** | テーブル内のデータを特定のカラムで整理する機能 |
| **仮名化** | ユーザーIDをハッシュ化し、個人を直接特定できないようにする処理 |
| **匿名化** | 個人を特定できる情報を完全に削除する処理 |
| **Data Transfer Service** | FirestoreからBigQueryへ自動的にデータを転送するサービス |
| **Pub/Sub** | メッセージングサービス。リアルタイムデータ処理に使用 |
| **Dead Letter Queue(DLQ)** | 処理失敗したメッセージを保持する仕組み |
| **CMEK** | Customer-Managed Encryption Keys。顧客管理の暗号鍵 |
| **IAM** | Identity and Access Management。アクセス制御システム |
| **RTO** | Recovery Time Objective。目標復旧時間 |
| **RPO** | Recovery Point Objective。目標復旧時点 |

---

## 2. BigQuery利用目的

### 2.1 データ分析基盤

**目的**: トレーニングデータの統計分析とビジネスインサイトの抽出

**主な分析内容**:
- DAU/WAU/MAU(アクティブユーザー数)
- リテンション率(7日後、30日後)
- 種目別セッション数とスコア分布
- ユーザーセグメント別の行動分析
- デバイス別・リージョン別の利用状況

**想定利用者**: データアナリスト、プロジェクトマネージャー

### 2.2 ML学習データ蓄積(Phase 4以降)

**目的**: カスタムMLモデル開発のための学習データ準備

**データ蓄積戦略**:
- MediaPipe 33関節点データの完全記録
- フレーム単位(30fps)での骨格座標保存
- セッションメタデータ(デバイス、OS、アプリバージョン)の記録
- 10,000セッション達成後のデータ品質評価

**想定利用者**: MLエンジニア(Phase 4以降)

**ML移行計画**(プロジェクト懸念点#6, #11対応):
1. **Phase 2後半**: データ品質評価フレームワークの構築
2. **Phase 3**: アノテーション作業計画の策定
3. **Phase 4**: MLエンジニア採用とPoC実施
4. **Phase 5**: カスタムMLモデルの段階的展開

### 2.3 サービス改善

**目的**: ユーザーフィードバックとデータに基づくサービス最適化

**改善領域**:
- フォーム確認補助ロジックの精度向上
- ユーザー体験の改善(レスポンス時間、UI/UX)
- 種目別の難易度調整
- パーソナライズ機能の開発(Phase 3以降)

**想定利用者**: プロダクトマネージャー、バックエンドエンジニア

### 2.4 法的要件への準拠

**目的**: GDPR、プライバシーポリシーv3.1への完全準拠

**準拠事項**:
- データ保存期間の自動管理(2年間)
- 仮名化処理による個人データ保護
- データ削除権の実装(30日猶予期間)
- データアクセス権とポータビリティ権の実装
- 監査ログによる処理活動の記録

**法的根拠**:
- GDPR第6条1項(a): ユーザーの同意
- GDPR第6条1項(f): 正当な利益(サービス改善)
- プライバシーポリシーv3.1第5.1条、第5.2条

---

## 3. データセット設計

### 3.1 データセット一覧

| データセット名 | 目的 | ロケーション | Phase |
|-------------|------|------------|-------|
| **fitness_analytics** | 本番データ分析用 | asia-northeast1(東京) | Phase 1 |
| **fitness_analytics_dev** | 開発・テスト用 | asia-northeast1(東京) | Phase 1 |
| **fitness_analytics_backup** | バックアップ用 | asia-northeast2(大阪) | Phase 2 |

### 3.2 fitness_analyticsデータセット(本番)

#### 3.2.1 基本設定

```bash
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 本番分析データ" \
  --default_table_expiration=63072000 \
  --default_partition_expiration=63072000 \
  fitness-app-prod:fitness_analytics
```

**設定値の説明**:
- **location**: `asia-northeast1`(東京リージョン)
- **default_table_expiration**: 63,072,000秒(730日 = 2年)
- **default_partition_expiration**: 63,072,000秒(730日 = 2年)

**GDPR準拠**: プライバシーポリシーv3.1第5.1条に基づく2年間の保存期間

#### 3.2.2 データ暗号化

**デフォルト暗号化**: Google管理の暗号鍵(AES-256)

**Phase 2以降**: CMEK(顧客管理暗号鍵)への移行を検討

```bash
# CMEK設定例(Phase 2以降)
bq update \
  --default_kms_key_name=projects/PROJECT_ID/locations/asia-northeast1/keyRings/KEYRING/cryptoKeys/KEY \
  fitness-app-prod:fitness_analytics
```

### 3.3 fitness_analytics_devデータセット(開発)

#### 3.3.1 基本設定

```bash
bq mk \
  --dataset \
  --location=asia-northeast1 \
  --description="AIフィットネスアプリ 開発・テスト用データ" \
  --default_table_expiration=2592000 \
  fitness-app-dev:fitness_analytics_dev
```

**設定値の説明**:
- **default_table_expiration**: 2,592,000秒(30日)
- 開発環境のデータは30日で自動削除

#### 3.3.2 アクセス制限

**原則**: 開発環境には個人を特定できるデータを含めない

**データ生成方法**:
- 合成データ(Synthetic Data)の使用
- 本番データの匿名化バージョン(個人情報完全削除)

### 3.4 fitness_analytics_backupデータセット(バックアップ)

#### 3.4.1 基本設定

```bash
bq mk \
  --dataset \
  --location=asia-northeast2 \
  --description="AIフィットネスアプリ バックアップデータ(クロスリージョン)" \
  fitness-app-prod:fitness_analytics_backup
```

**設定値の説明**:
- **location**: `asia-northeast2`(大阪リージョン)
- クロスリージョンバックアップによるDR対策

**バックアップ戦略**(プロジェクト懸念点#16対応):
- 日次自動スナップショット取得
- RTO: 24時間以内
- RPO: 1日以内
- 詳細は「11. データライフサイクル管理」を参照

---

## 4. テーブル設計

### 4.1 テーブル一覧

| テーブル名 | 目的 | Phase | 更新頻度 | データ保持期間 |
|----------|------|-------|---------|-------------|
| **training_sessions** | トレーニングセッション記録 | Phase 1 | リアルタイム | 2年間 |
| **user_metadata** | ユーザーメタデータ(仮名化) | Phase 1 | 日次 | 2年間 |
| **exercise_definitions** | トレーニング種目定義 | Phase 1 | 手動 | 無期限 |
| **aggregated_stats** | 集計統計データ | Phase 1 | 日次 | 2年間 |
| **pseudonymization_log** | 仮名化処理ログ | Phase 1 | リアルタイム | 90日間 |

### 4.2 training_sessions テーブル

#### 4.2.1 概要

**目的**: トレーニングセッションの詳細データを保存

**データソース**: Firestore `users/{userId}/sessions/{sessionId}`

**更新頻度**: リアルタイム(Pub/Sub経由で即時反映)

**法的根拠**: 
- GDPR第6条1項(a) 同意
- プライバシーポリシーv3.1第5.1条

**データ保持期間**: 2年間(自動削除)

#### 4.2.2 スキーマ定義

```sql
CREATE TABLE `fitness_analytics.training_sessions` (
  -- 基本情報
  session_id STRING NOT NULL OPTIONS(description="セッションID(UUIDv4形式)"),
  user_id_hash STRING NOT NULL OPTIONS(description="ユーザーIDのSHA-256ハッシュ値"),
  exercise_id STRING NOT NULL OPTIONS(description="トレーニング種目ID"),
  
  -- タイムスタンプ
  start_time TIMESTAMP NOT NULL OPTIONS(description="セッション開始時刻(UTC)"),
  end_time TIMESTAMP NOT NULL OPTIONS(description="セッション終了時刻(UTC)"),
  duration_seconds INT64 NOT NULL OPTIONS(description="セッション時間(秒)"),
  created_at TIMESTAMP NOT NULL OPTIONS(description="レコード作成日時(UTC)"),
  
  -- セッション結果
  rep_count INT64 OPTIONS(description="回数(レップ数)"),
  set_count INT64 OPTIONS(description="セット数"),
  average_score FLOAT64 OPTIONS(description="平均スコア(0-100)"),
  max_score FLOAT64 OPTIONS(description="最大スコア(0-100)"),
  min_score FLOAT64 OPTIONS(description="最小スコア(0-100)"),
  
  -- 骨格座標データ (FR-028: カスタムML移行準備)
  landmarks ARRAY<STRUCT<
    timestamp TIMESTAMP OPTIONS(description="フレームのタイムスタンプ"),
    frame_number INT64 OPTIONS(description="フレーム番号(0から開始)"),
    keypoints ARRAY<STRUCT<
      landmark_id INT64 OPTIONS(description="MediaPipe Pose ランドマークID(0-32)"),
      x FLOAT64 OPTIONS(description="X座標(正規化: 0.0-1.0)"),
      y FLOAT64 OPTIONS(description="Y座標(正規化: 0.0-1.0)"),
      z FLOAT64 OPTIONS(description="Z座標(深度、正規化)"),
      visibility FLOAT64 OPTIONS(description="可視性スコア(0.0-1.0)")
    >> OPTIONS(description="MediaPipe 33関節点の座標")
  >> OPTIONS(description="フレーム単位の骨格座標データ(30fps想定)"),
  
  -- デバイス情報 (FR-029: セッションメタデータ収集)
  device_info STRUCT<
    os STRING OPTIONS(description="OS種別(iOS/Android)"),
    os_version STRING OPTIONS(description="OSバージョン"),
    device_model STRING OPTIONS(description="デバイスモデル名"),
    app_version STRING OPTIONS(description="アプリバージョン")
  > OPTIONS(description="デバイス情報(ML移行時の分析用)"),
  
  -- メタデータ
  region STRING OPTIONS(description="リージョンコード(ISO 3166-1 alpha-2)"),
  
  -- 削除フラグ (論理削除用)
  is_deleted BOOL DEFAULT FALSE OPTIONS(description="論理削除フラグ"),
  deleted_at TIMESTAMP OPTIONS(description="論理削除日時")
)
PARTITION BY DATE(created_at)
CLUSTER BY user_id_hash, exercise_id, DATE(created_at)
OPTIONS(
  description="トレーニングセッション記録(GDPR準拠: 2年間保持)",
  require_partition_filter=TRUE,
  partition_expiration_days=730,
  labels=[("env", "production"), ("data_classification", "pseudonymized")]
);
```

#### 4.2.3 パーティショニング戦略

**パーティションキー**: `DATE(created_at)`

**理由**:
- クエリコストの削減(日付範囲指定で必要なパーティションのみスキャン)
- データ保存期間の自動管理(730日で自動削除)
- 時系列分析の高速化

**パーティション有効期限**: 730日(2年間)

**GDPR準拠**: プライバシーポリシーv3.1第5.1条に基づく自動削除

**パーティション例**:
```
training_sessions$20251123  -- 2025年11月23日のデータ
training_sessions$20251124  -- 2025年11月24日のデータ
...
training_sessions$20271123  -- 2027年11月23日に自動削除
```

#### 4.2.4 クラスタリング戦略

**クラスタリングキー**: `user_id_hash, exercise_id, DATE(created_at)`

**理由**:
- ユーザー別の分析が高速化(最大90%のスキャン量削減)
- 種目別の分析が高速化
- 日付範囲指定との組み合わせで最適化
- クエリコスト削減: パーティショニングと組み合わせて95%削減

**効果**(プロジェクト懸念点#8対応):
- スキャンデータ量: 最大90%削減
- クエリ実行時間: 最大70%短縮
- 月間クエリコスト: $0.50 → $0.05

#### 4.2.5 データサイズ見積もり

**1セッションあたりのデータサイズ**:
- 基本情報: 約500バイト
- landmarks配列: 約300KB(30fps × 60秒 × 33関節 × 5フィールド)
- **合計**: 約300.5KB/セッション

**MVP期の見積もり**(DAU 100人、1日平均2セッション):
```
日次データ量: 100人 × 2セッション × 300.5KB = 60.1MB/日
月間データ量: 60.1MB × 30日 = 1.8GB/月
年間データ量: 1.8GB × 12ヶ月 = 21.6GB/年
```

**Phase 3以降**(DAU 10,000人、1日平均3セッション):
```
日次データ量: 10,000人 × 3セッション × 300.5KB = 9GB/日
月間データ量: 9GB × 30日 = 270GB/月
年間データ量: 270GB × 12ヶ月 = 3.24TB/年
```

#### 4.2.6 制約とバリデーション

| カラム | 制約 | 説明 |
|-------|------|------|
| `session_id` | NOT NULL, UUIDv4形式 | セッションの一意識別子 |
| `user_id_hash` | NOT NULL, 64文字 | SHA-256ハッシュ値 |
| `exercise_id` | NOT NULL, IN ('squat', 'push_up', 'plank', 'lunge', 'glute_bridge') | 定義済み種目のみ |
| `start_time` | NOT NULL, < end_time | 開始時刻は終了時刻より前 |
| `duration_seconds` | > 0, <= 7200 | 2時間以内 |
| `rep_count` | >= 0, <= 1000 | 現実的な範囲 |
| `set_count` | >= 0, <= 100 | 現実的な範囲 |
| `average_score` | >= 0, <= 100 | スコアは0-100 |
| `landmarks[].keypoints[].landmark_id` | 0-32 | MediaPipe Pose 33関節 |
| `landmarks[].keypoints[].x, y` | 0.0-1.0 | 正規化座標 |
| `landmarks[].keypoints[].visibility` | 0.0-1.0 | 可視性スコア |

#### 4.2.7 サンプルデータ

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id_hash": "5f4dcc3b5aa765d61d8327deb882cf99abc123def456",
  "exercise_id": "squat",
  "start_time": "2025-11-24T10:00:00Z",
  "end_time": "2025-11-24T10:15:00Z",
  "duration_seconds": 900,
  "created_at": "2025-11-24T10:15:05Z",
  "rep_count": 30,
  "set_count": 3,
  "average_score": 85.5,
  "max_score": 95.0,
  "min_score": 75.0,
  "landmarks": [
    {
      "timestamp": "2025-11-24T10:00:00.000Z",
      "frame_number": 0,
      "keypoints": [
        {
          "landmark_id": 0,
          "x": 0.5,
          "y": 0.3,
          "z": -0.1,
          "visibility": 0.99
        },
        {
          "landmark_id": 1,
          "x": 0.48,
          "y": 0.28,
          "z": -0.09,
          "visibility": 0.98
        }
        // ... 残り31個の関節データ
      ]
    }
    // ... 900秒 × 30fps = 27,000フレーム分のデータ
  ],
  "device_info": {
    "os": "iOS",
    "os_version": "17.0",
    "device_model": "iPhone 13",
    "app_version": "1.0.0"
  },
  "region": "JP",
  "is_deleted": false,
  "deleted_at": null
}
```

### 4.3 user_metadata テーブル

#### 4.3.1 概要

**目的**: ユーザーのメタデータ(仮名化済み)を保存

**データソース**: Firestore `users/{userId}`

**更新頻度**: 日次バッチ処理

**法的根拠**: 
- GDPR第6条1項(f) 正当な利益(サービス改善、統計分析)
- プライバシーポリシーv3.1第5.2条

**データ保持期間**: 2年間(自動削除)

#### 4.3.2 スキーマ定義

```sql
CREATE TABLE `fitness_analytics.user_metadata` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL OPTIONS(description="ユーザーIDのSHA-256ハッシュ値"),
  
  -- タイムスタンプ
  account_created_at TIMESTAMP NOT NULL OPTIONS(description="アカウント作成日時"),
  last_active_at TIMESTAMP OPTIONS(description="最終アクティブ日時"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="レコード更新日時"),
  
  -- ユーザー統計 (個人を特定できない情報のみ)
  total_sessions INT64 DEFAULT 0 OPTIONS(description="累計セッション数"),
  total_duration_seconds INT64 DEFAULT 0 OPTIONS(description="累計トレーニング時間(秒)"),
  average_session_score FLOAT64 OPTIONS(description="平均セッションスコア(0-100)"),
  
  -- 年齢層 (個人特定を避けるため範囲で保存)
  age_group STRING OPTIONS(description="年齢層: 18-25, 26-35, 36-45, 46+"),
  
  -- リージョン (国レベルのみ)
  country_code STRING OPTIONS(description="国コード(ISO 3166-1 alpha-2)"),
  
  -- プランタイプ
  subscription_plan STRING OPTIONS(description="サブスクリプションプラン: free, premium"),
  
  -- 削除フラグ
  is_deleted BOOL DEFAULT FALSE OPTIONS(description="論理削除フラグ"),
  deleted_at TIMESTAMP OPTIONS(description="論理削除日時")
)
PARTITION BY DATE(updated_at)
CLUSTER BY user_id_hash, country_code
OPTIONS(
  description="ユーザーメタデータ(仮名化済み、個人特定不可)",
  require_partition_filter=FALSE,
  partition_expiration_days=730,
  labels=[("env", "production"), ("data_classification", "pseudonymized")]
);
```

#### 4.3.3 プライバシー保護

**個人を特定できる情報は含まない**:
- ❌ 名前
- ❌ メールアドレス
- ❌ 電話番号
- ❌ 正確な生年月日(年齢層のみ)
- ❌ 住所
- ❌ IPアドレス
- ❌ 正確な位置情報(国レベルのみ)

**含まれる情報**:
- ✅ ユーザーIDのハッシュ値(SHA-256)
- ✅ 年齢層(範囲: 18-25, 26-35, 36-45, 46+)
- ✅ 国コード(国レベルのみ)
- ✅ 統計情報(セッション数、スコア)

**GDPR準拠**:
- 仮名化処理により、GDPR第4条5項の「仮名化されたデータ」に該当
- 追加情報なしでは個人を特定不可

#### 4.3.4 サンプルデータ

```json
{
  "user_id_hash": "5f4dcc3b5aa765d61d8327deb882cf99abc123def456",
  "account_created_at": "2025-11-01T00:00:00Z",
  "last_active_at": "2025-11-24T10:15:00Z",
  "updated_at": "2025-11-24T23:00:00Z",
  "total_sessions": 45,
  "total_duration_seconds": 40500,
  "average_session_score": 82.3,
  "age_group": "26-35",
  "country_code": "JP",
  "subscription_plan": "premium",
  "is_deleted": false,
  "deleted_at": null
}
```

### 4.4 exercise_definitions テーブル

#### 4.4.1 概要

**目的**: トレーニング種目の定義を保存(マスターデータ)

**データソース**: 手動管理

**更新頻度**: 手動(種目追加・変更時)

**データ保持期間**: 無期限(マスターデータ)

#### 4.4.2 スキーマ定義

```sql
CREATE TABLE `fitness_analytics.exercise_definitions` (
  -- 基本情報
  exercise_id STRING NOT NULL OPTIONS(description="種目ID(ユニーク)"),
  exercise_name_en STRING NOT NULL OPTIONS(description="種目名(英語)"),
  exercise_name_ja STRING NOT NULL OPTIONS(description="種目名(日本語)"),
  category STRING NOT NULL OPTIONS(description="カテゴリ: strength, cardio, flexibility"),
  
  -- 詳細
  description STRING OPTIONS(description="種目の説明"),
  difficulty_level STRING OPTIONS(description="難易度: beginner, intermediate, advanced"),
  
  -- MediaPipe設定
  required_landmarks ARRAY<INT64> OPTIONS(description="必要な関節ID(MediaPipe Pose 0-32)"),
  
  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL OPTIONS(description="レコード作成日時"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="レコード更新日時"),
  
  -- 無効化フラグ
  is_active BOOL DEFAULT TRUE OPTIONS(description="種目の有効/無効")
)
OPTIONS(
  description="トレーニング種目マスターデータ",
  labels=[("env", "production"), ("data_type", "master")]
);
```

#### 4.4.3 初期データ (MVP 5種目)

```sql
INSERT INTO `fitness_analytics.exercise_definitions` 
(exercise_id, exercise_name_en, exercise_name_ja, category, description, difficulty_level, required_landmarks, created_at, updated_at, is_active)
VALUES
  ('squat', 'Squat', 'スクワット', 'strength',
   'Lower body compound exercise', 'beginner',
   [23, 24, 25, 26, 27, 28],  -- 腰、膝、足首の関節
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),
  
  ('push_up', 'Push-up', 'プッシュアップ', 'strength',
   'Upper body compound exercise', 'beginner',
   [11, 12, 13, 14, 15, 16],  -- 肩、肘、手首の関節
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),
  
  ('plank', 'Plank', 'プランク', 'strength',
   'Core stabilization exercise', 'beginner',
   [11, 12, 23, 24],  -- 肩と腰の関節
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),
  
  ('lunge', 'Lunge', 'ランジ', 'strength',
   'Lower body unilateral exercise', 'intermediate',
   [23, 24, 25, 26, 27, 28],  -- 腰、膝、足首の関節
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),
  
  ('glute_bridge', 'Glute Bridge', 'グルートブリッジ', 'strength',
   'Hip extension exercise', 'beginner',
   [23, 24, 25, 26],  -- 腰と膝の関節
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE);
```

### 4.5 aggregated_stats テーブル

#### 4.5.1 概要

**目的**: 事前集計された統計データを保存(クエリコスト削減)

**データソース**: 日次バッチ処理で生成

**更新頻度**: 日次(午前2時実行)

**データ保持期間**: 2年間(自動削除)

**コスト削減効果**(プロジェクト懸念点#8対応):
- リアルタイムクエリと比較して99%のコスト削減
- 定期レポート生成に最適

#### 4.5.2 スキーマ定義

```sql
CREATE TABLE `fitness_analytics.aggregated_stats` (
  -- 集計キー
  stat_date DATE NOT NULL OPTIONS(description="統計日付"),
  exercise_id STRING OPTIONS(description="種目ID(NULLは全体統計)"),
  age_group STRING OPTIONS(description="年齢層"),
  country_code STRING OPTIONS(description="国コード"),
  
  -- 集計値
  total_sessions INT64 OPTIONS(description="セッション数"),
  total_users INT64 OPTIONS(description="ユニークユーザー数"),
  total_duration_seconds INT64 OPTIONS(description="合計トレーニング時間(秒)"),
  average_score FLOAT64 OPTIONS(description="平均スコア"),
  average_rep_count FLOAT64 OPTIONS(description="平均回数"),
  
  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL OPTIONS(description="レコード作成日時")
)
PARTITION BY stat_date
CLUSTER BY exercise_id, country_code
OPTIONS(
  description="事前集計統計データ(コスト削減のため)",
  require_partition_filter=TRUE,
  partition_expiration_days=730,
  labels=[("env", "production"), ("data_type", "aggregated")]
);
```

#### 4.5.3 サンプルデータ

```json
{
  "stat_date": "2025-11-24",
  "exercise_id": "squat",
  "age_group": "26-35",
  "country_code": "JP",
  "total_sessions": 1250,
  "total_users": 350,
  "total_duration_seconds": 112500,
  "average_score": 83.2,
  "average_rep_count": 28.5,
  "created_at": "2025-11-25T02:00:00Z"
}
```

### 4.6 pseudonymization_log テーブル (新規追加)

#### 4.6.1 概要

**目的**: 仮名化処理のログを記録(障害対応とコンプライアンス)

**データソース**: Cloud Functions(仮名化処理)

**更新頻度**: リアルタイム

**データ保持期間**: 90日間(監査用)

**懸念点対応**: プロジェクト懸念点#4「BigQueryの仮名化処理がFunctions障害時に失敗」への対応

#### 4.6.2 スキーマ定義

```sql
CREATE TABLE `fitness_analytics.pseudonymization_log` (
  -- ログID
  log_id STRING NOT NULL OPTIONS(description="ログID(UUIDv4形式)"),
  
  -- 処理情報
  source_collection STRING NOT NULL OPTIONS(description="ソースコレクション(Firestore)"),
  source_document_id STRING NOT NULL OPTIONS(description="ソースドキュメントID"),
  target_table STRING NOT NULL OPTIONS(description="ターゲットテーブル(BigQuery)"),
  
  -- 処理結果
  status STRING NOT NULL OPTIONS(description="処理ステータス: success, failed, retrying"),
  error_message STRING OPTIONS(description="エラーメッセージ"),
  retry_count INT64 DEFAULT 0 OPTIONS(description="リトライ回数"),
  
  -- タイムスタンプ
  processing_started_at TIMESTAMP NOT NULL OPTIONS(description="処理開始時刻"),
  processing_completed_at TIMESTAMP OPTIONS(description="処理完了時刻"),
  created_at TIMESTAMP NOT NULL OPTIONS(description="ログ作成日時")
)
PARTITION BY DATE(created_at)
CLUSTER BY status, source_collection
OPTIONS(
  description="仮名化処理ログ(障害対応と監査用)",
  require_partition_filter=TRUE,
  partition_expiration_days=90,
  labels=[("env", "production"), ("data_type", "audit_log")]
);
```

#### 4.6.3 サンプルデータ

```json
{
  "log_id": "a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6",
  "source_collection": "users/{userId}/sessions",
  "source_document_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_table": "training_sessions",
  "status": "success",
  "error_message": null,
  "retry_count": 0,
  "processing_started_at": "2025-11-24T10:15:05.123Z",
  "processing_completed_at": "2025-11-24T10:15:05.456Z",
  "created_at": "2025-11-24T10:15:05.500Z"
}
```

**失敗例**:
```json
{
  "log_id": "b2c3d4e5-f6g7-48h9-i0j1-k2l3m4n5o6p7",
  "source_collection": "users/{userId}/sessions",
  "source_document_id": "660f9511-f3ac-52e5-b827-557766551111",
  "target_table": "training_sessions",
  "status": "failed",
  "error_message": "BigQuery streaming insert failed: Connection timeout",
  "retry_count": 3,
  "processing_started_at": "2025-11-24T11:20:10.000Z",
  "processing_completed_at": "2025-11-24T11:20:25.000Z",
  "created_at": "2025-11-24T11:20:25.500Z"
}
```

---

**Part 1 完了**

次のファイル(Part 2)には以下を含めます:
- データパイプライン設計(耐障害性の向上)
- プライバシーとコンプライアンス
- 分析用クエリ
- パフォーマンス最適化
# BigQuery設計書 v3.3 (Part 2/3)

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.3 (MVP)

---

## 5. データパイプライン設計

### 5.1 全体アーキテクチャ

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Firestore  │─────▶│   Pub/Sub    │─────▶│   Cloud     │
│   (RTDB)    │      │   (Stream)   │      │  Functions  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  仮名化処理  │
                                            │ (SHA-256)    │
                                            └──────────────┘
                                                    │
                                      ┌─────────────┼─────────────┐
                                      ▼             ▼             ▼
                              ┌──────────┐  ┌──────────┐  ┌──────────┐
                              │ BigQuery │  │   DLQ    │  │ Log Table│
                              │ (成功)   │  │  (失敗)  │  │ (監査)   │
                              └──────────┘  └──────────┘  └──────────┘
```

### 5.2 リアルタイムデータパイプライン

#### 5.2.1 Firestore → Pub/Sub (トリガー)

**トリガー設定**:

```javascript
// Firestore Document Create/Update トリガー
exports.onSessionCreate = functions
  .region('asia-northeast1')
  .firestore
  .document('users/{userId}/sessions/{sessionId}')
  .onCreate(async (snap, context) => {
    const sessionData = snap.data();
    const userId = context.params.userId;
    const sessionId = context.params.sessionId;
    
    try {
      // Pub/Subにメッセージを発行
      await pubsub.topic('training-sessions-stream').publishJSON({
        userId: userId,
        sessionId: sessionId,
        data: sessionData,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Session published to Pub/Sub: ${sessionId}`);
      
    } catch (error) {
      console.error('Error publishing to Pub/Sub:', error);
      // Pub/Sub発行失敗は自動リトライされる(Firestoreトリガーのデフォルト動作)
    }
  });
```

**設定値**:
- **region**: `asia-northeast1`(東京リージョン)
- **自動リトライ**: 有効(Firestoreトリガーのデフォルト)
- **リトライ期間**: 7日間

#### 5.2.2 Pub/Sub → Cloud Functions (仮名化処理)

**懸念点#4対応**: 仮名化処理の耐障害性向上

**実装例**(リトライロジック + DLQ):

```javascript
const { BigQuery } = require('@google-cloud/bigquery');
const { PubSub } = require('@google-cloud/pubsub');
const crypto = require('crypto');

const bigquery = new BigQuery();
const pubsub = new PubSub();

// 設定
const MAX_RETRY_COUNT = 3;
const DLQ_TOPIC = 'training-sessions-dlq';
const LOG_TABLE = 'fitness_analytics.pseudonymization_log';

/**
 * Pub/Subトリガー: トレーニングセッションの仮名化とBigQuery挿入
 */
exports.processSession = functions
  .region('asia-northeast1')
  .pubsub
  .topic('training-sessions-stream')
  .onPublish(async (message, context) => {
    const logId = generateUUID();
    const startTime = new Date();
    
    try {
      // メッセージデータの取得
      const data = message.json;
      const { userId, sessionId, data: sessionData, timestamp } = data;
      
      // メタデータ取得(リトライ回数)
      const retryCount = message.attributes?.retryCount 
        ? parseInt(message.attributes.retryCount) 
        : 0;
      
      console.log(`Processing session: ${sessionId}, retry: ${retryCount}`);
      
      // 1. ユーザーIDの仮名化
      const userIdHash = hashUserId(userId);
      
      // 2. BigQuery挿入用データの作成
      const bigqueryRow = {
        session_id: sessionId,
        user_id_hash: userIdHash,
        exercise_id: sessionData.exerciseId,
        start_time: sessionData.startTime,
        end_time: sessionData.endTime,
        duration_seconds: sessionData.durationSeconds,
        created_at: new Date().toISOString(),
        rep_count: sessionData.repCount,
        set_count: sessionData.setCount,
        average_score: sessionData.averageScore,
        max_score: sessionData.maxScore,
        min_score: sessionData.minScore,
        landmarks: sessionData.landmarks,
        device_info: sessionData.deviceInfo,
        region: sessionData.region,
        is_deleted: false,
        deleted_at: null
      };
      
      // 3. BigQueryへのストリーミング挿入
      await bigquery
        .dataset('fitness_analytics')
        .table('training_sessions')
        .insert([bigqueryRow]);
      
      console.log(`Session inserted to BigQuery: ${sessionId}`);
      
      // 4. 成功ログの記録
      await logPseudonymization({
        logId,
        sourceCollection: 'users/{userId}/sessions',
        sourceDocumentId: sessionId,
        targetTable: 'training_sessions',
        status: 'success',
        errorMessage: null,
        retryCount,
        processingStartedAt: startTime,
        processingCompletedAt: new Date()
      });
      
    } catch (error) {
      console.error(`Error processing session:`, error);
      
      // リトライ可能なエラーかチェック
      if (isRetryableError(error)) {
        const retryCount = message.attributes?.retryCount 
          ? parseInt(message.attributes.retryCount) 
          : 0;
        
        if (retryCount < MAX_RETRY_COUNT) {
          // リトライ: 指数バックオフで再発行
          const delay = Math.pow(2, retryCount) * 1000; // 1秒, 2秒, 4秒
          
          console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_COUNT})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Pub/Subに再発行
          await pubsub.topic('training-sessions-stream').publishJSON(
            message.json,
            {
              retryCount: (retryCount + 1).toString()
            }
          );
          
          // リトライログの記録
          await logPseudonymization({
            logId,
            sourceCollection: 'users/{userId}/sessions',
            sourceDocumentId: message.json.sessionId,
            targetTable: 'training_sessions',
            status: 'retrying',
            errorMessage: error.message,
            retryCount: retryCount + 1,
            processingStartedAt: startTime,
            processingCompletedAt: new Date()
          });
          
        } else {
          // 最大リトライ回数に到達: DLQへ送信
          console.error(`Max retry count reached. Sending to DLQ.`);
          
          await pubsub.topic(DLQ_TOPIC).publishJSON({
            ...message.json,
            error: error.message,
            failedAt: new Date().toISOString(),
            retryCount: MAX_RETRY_COUNT
          });
          
          // 失敗ログの記録
          await logPseudonymization({
            logId,
            sourceCollection: 'users/{userId}/sessions',
            sourceDocumentId: message.json.sessionId,
            targetTable: 'training_sessions',
            status: 'failed',
            errorMessage: `Max retry count reached: ${error.message}`,
            retryCount: MAX_RETRY_COUNT,
            processingStartedAt: startTime,
            processingCompletedAt: new Date()
          });
          
          // Slackアラート送信
          await sendSlackAlert({
            level: 'error',
            title: 'BigQuery仮名化処理失敗',
            message: `セッション ${message.json.sessionId} の処理に失敗しました。`,
            error: error.message
          });
        }
      } else {
        // リトライ不可能なエラー: 即座にDLQへ送信
        console.error(`Non-retryable error. Sending to DLQ immediately.`);
        
        await pubsub.topic(DLQ_TOPIC).publishJSON({
          ...message.json,
          error: error.message,
          failedAt: new Date().toISOString(),
          retryCount: 0
        });
        
        // 失敗ログの記録
        await logPseudonymization({
          logId,
          sourceCollection: 'users/{userId}/sessions',
          sourceDocumentId: message.json.sessionId,
          targetTable: 'training_sessions',
          status: 'failed',
          errorMessage: `Non-retryable error: ${error.message}`,
          retryCount: 0,
          processingStartedAt: startTime,
          processingCompletedAt: new Date()
        });
      }
    }
  });

/**
 * ユーザーIDのSHA-256ハッシュ化
 */
function hashUserId(userId) {
  return crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex');
}

/**
 * リトライ可能なエラーかチェック
 */
function isRetryableError(error) {
  // BigQueryのAPI一時エラー
  if (error.code === 503) return true; // Service Unavailable
  if (error.code === 500) return true; // Internal Server Error
  if (error.code === 429) return true; // Too Many Requests
  
  // ネットワークエラー
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNRESET') return true;
  
  return false;
}

/**
 * 仮名化ログの記録
 */
async function logPseudonymization(logData) {
  try {
    await bigquery
      .dataset('fitness_analytics')
      .table('pseudonymization_log')
      .insert([{
        log_id: logData.logId,
        source_collection: logData.sourceCollection,
        source_document_id: logData.sourceDocumentId,
        target_table: logData.targetTable,
        status: logData.status,
        error_message: logData.errorMessage,
        retry_count: logData.retryCount,
        processing_started_at: logData.processingStartedAt.toISOString(),
        processing_completed_at: logData.processingCompletedAt.toISOString(),
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    // ログ記録の失敗は致命的ではないため、エラーログのみ出力
    console.error('Failed to log pseudonymization:', error);
  }
}

/**
 * Slackアラート送信
 */
async function sendSlackAlert(alert) {
  // Slack Webhook URLの実装は省略
  console.log('Slack Alert:', alert);
}

/**
 * UUID生成
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

#### 5.2.3 Dead Letter Queue (DLQ) 処理

**DLQからの手動リカバリ**:

```javascript
/**
 * DLQ処理: 手動リカバリ用
 */
exports.processDLQ = functions
  .region('asia-northeast1')
  .https
  .onCall(async (data, context) => {
    // 管理者権限チェック
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '管理者権限が必要です'
      );
    }
    
    const { sessionId } = data;
    
    try {
      // DLQからメッセージを取得
      const subscription = pubsub.subscription('training-sessions-dlq-sub');
      const [messages] = await subscription.pull({ maxMessages: 100 });
      
      const targetMessage = messages.find(m => 
        m.data && JSON.parse(m.data.toString()).sessionId === sessionId
      );
      
      if (!targetMessage) {
        throw new functions.https.HttpsError(
          'not-found',
          `セッション ${sessionId} がDLQに見つかりません`
        );
      }
      
      // メッセージを再処理
      const messageData = JSON.parse(targetMessage.data.toString());
      
      // Pub/Subに再発行(リトライカウントをリセット)
      await pubsub.topic('training-sessions-stream').publishJSON(messageData, {
        retryCount: '0',
        manualRecovery: 'true'
      });
      
      // DLQからメッセージを削除
      await subscription.acknowledge([targetMessage.ackId]);
      
      console.log(`Session ${sessionId} recovered from DLQ`);
      
      return {
        success: true,
        message: `セッション ${sessionId} をDLQから回復しました`
      };
      
    } catch (error) {
      console.error('Error processing DLQ:', error);
      throw new functions.https.HttpsError(
        'internal',
        `DLQ処理エラー: ${error.message}`
      );
    }
  });
```

### 5.3 バッチデータパイプライン

#### 5.3.1 日次集計処理

**aggregated_statsテーブルの生成**:

```javascript
exports.dailyAggregation = functions
  .region('asia-northeast1')
  .pubsub
  .schedule('0 2 * * *') // 毎日午前2時(JST)
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const statDate = yesterday.toISOString().split('T')[0];
      
      console.log(`Starting daily aggregation for ${statDate}`);
      
      // 集計クエリの実行
      const query = `
        INSERT INTO \`fitness_analytics.aggregated_stats\`
        (stat_date, exercise_id, age_group, country_code, 
         total_sessions, total_users, total_duration_seconds, 
         average_score, average_rep_count, created_at)
        SELECT
          DATE(@stat_date) as stat_date,
          ts.exercise_id,
          um.age_group,
          um.country_code,
          COUNT(*) as total_sessions,
          COUNT(DISTINCT ts.user_id_hash) as total_users,
          SUM(ts.duration_seconds) as total_duration_seconds,
          AVG(ts.average_score) as average_score,
          AVG(ts.rep_count) as average_rep_count,
          CURRENT_TIMESTAMP() as created_at
        FROM \`fitness_analytics.training_sessions\` ts
        LEFT JOIN \`fitness_analytics.user_metadata\` um
          ON ts.user_id_hash = um.user_id_hash
        WHERE DATE(ts.created_at) = DATE(@stat_date)
          AND ts.is_deleted = FALSE
        GROUP BY ts.exercise_id, um.age_group, um.country_code;
      `;
      
      await bigquery.query({
        query: query,
        params: { stat_date: statDate }
      });
      
      console.log(`Daily aggregation completed for ${statDate}`);
      
      // Slackに成功通知
      await sendSlackNotification({
        text: `✅ 日次集計処理完了: ${statDate}`
      });
      
    } catch (error) {
      console.error('Error in daily aggregation:', error);
      
      // Slackにエラー通知
      await sendSlackAlert({
        level: 'error',
        title: '日次集計処理失敗',
        message: `日次集計処理でエラーが発生しました。`,
        error: error.message
      });
      
      throw error;
    }
  });
```

#### 5.3.2 user_metadataの更新

```javascript
exports.updateUserMetadata = functions
  .region('asia-northeast1')
  .pubsub
  .schedule('0 3 * * *') // 毎日午前3時(JST)
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      console.log('Starting user metadata update');
      
      // ユーザーメタデータの更新クエリ
      const query = `
        MERGE \`fitness_analytics.user_metadata\` AS target
        USING (
          SELECT
            user_id_hash,
            COUNT(*) as total_sessions,
            SUM(duration_seconds) as total_duration_seconds,
            AVG(average_score) as average_session_score,
            MAX(created_at) as last_active_at,
            CURRENT_TIMESTAMP() as updated_at
          FROM \`fitness_analytics.training_sessions\`
          WHERE is_deleted = FALSE
          GROUP BY user_id_hash
        ) AS source
        ON target.user_id_hash = source.user_id_hash
        WHEN MATCHED THEN
          UPDATE SET
            total_sessions = source.total_sessions,
            total_duration_seconds = source.total_duration_seconds,
            average_session_score = source.average_session_score,
            last_active_at = source.last_active_at,
            updated_at = source.updated_at
        WHEN NOT MATCHED THEN
          INSERT (user_id_hash, total_sessions, total_duration_seconds,
                  average_session_score, last_active_at, updated_at,
                  account_created_at, is_deleted)
          VALUES (source.user_id_hash, source.total_sessions,
                  source.total_duration_seconds, source.average_session_score,
                  source.last_active_at, source.updated_at,
                  CURRENT_TIMESTAMP(), FALSE);
      `;
      
      await bigquery.query(query);
      
      console.log('User metadata update completed');
      
    } catch (error) {
      console.error('Error updating user metadata:', error);
      throw error;
    }
  });
```

### 5.4 データ削除パイプライン

#### 5.4.1 論理削除(即時)

```javascript
/**
 * ユーザーデータ削除リクエスト
 */
exports.user_deleteData = functions
  .region('asia-northeast1')
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '認証が必要です'
      );
    }
    
    const uid = context.auth.uid;
    const userIdHash = hashUserId(uid);
    
    try {
      // 1. BigQueryでの論理削除
      const query = `
        UPDATE \`fitness_analytics.training_sessions\`
        SET is_deleted = TRUE,
            deleted_at = CURRENT_TIMESTAMP()
        WHERE user_id_hash = @user_id_hash
          AND is_deleted = FALSE;
      `;
      
      await bigquery.query({
        query: query,
        params: { user_id_hash: userIdHash }
      });
      
      // 2. user_metadataの論理削除
      const metadataQuery = `
        UPDATE \`fitness_analytics.user_metadata\`
        SET is_deleted = TRUE,
            deleted_at = CURRENT_TIMESTAMP()
        WHERE user_id_hash = @user_id_hash;
      `;
      
      await bigquery.query({
        query: metadataQuery,
        params: { user_id_hash: userIdHash }
      });
      
      console.log(`User data logically deleted: ${uid}`);
      
      return {
        success: true,
        message: 'データ削除リクエストを受け付けました。30日間の猶予期間後に完全削除されます。'
      };
      
    } catch (error) {
      console.error('Error deleting user data:', error);
      throw new functions.https.HttpsError(
        'internal',
        `データ削除エラー: ${error.message}`
      );
    }
  });
```

#### 5.4.2 物理削除(30日後)

```javascript
/**
 * 論理削除から30日経過したデータの物理削除
 */
exports.permanentlyDeleteData = functions
  .region('asia-northeast1')
  .pubsub
  .schedule('0 4 * * *') // 毎日午前4時(JST)
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      console.log('Starting permanent data deletion');
      
      // 30日前の日付
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // training_sessionsの物理削除
      const deleteQuery = `
        DELETE FROM \`fitness_analytics.training_sessions\`
        WHERE is_deleted = TRUE
          AND deleted_at < TIMESTAMP(@thirty_days_ago);
      `;
      
      const [job] = await bigquery.query({
        query: deleteQuery,
        params: { thirty_days_ago: thirtyDaysAgo.toISOString() }
      });
      
      const deletedRows = job.statistics.query.numDmlAffectedRows;
      
      console.log(`Permanently deleted ${deletedRows} rows`);
      
      // user_metadataの物理削除
      const deleteMetadataQuery = `
        DELETE FROM \`fitness_analytics.user_metadata\`
        WHERE is_deleted = TRUE
          AND deleted_at < TIMESTAMP(@thirty_days_ago);
      `;
      
      await bigquery.query({
        query: deleteMetadataQuery,
        params: { thirty_days_ago: thirtyDaysAgo.toISOString() }
      });
      
      // Slackに通知
      if (deletedRows > 0) {
        await sendSlackNotification({
          text: `🗑️ 物理削除完了: ${deletedRows}件のセッションデータを削除しました`
        });
      }
      
    } catch (error) {
      console.error('Error in permanent deletion:', error);
      throw error;
    }
  });
```

---

## 6. プライバシーとコンプライアンス

### 6.1 GDPR準拠の技術的実装

#### 6.1.1 仮名化処理の詳細

**使用アルゴリズム**: SHA-256ハッシュ

**実装例**:

```javascript
const crypto = require('crypto');

/**
 * ユーザーIDの仮名化
 * 
 * @param {string} userId - FirebaseユーザーID
 * @returns {string} - SHA-256ハッシュ値(64文字の16進数文字列)
 */
function hashUserId(userId) {
  return crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex');
}

// 使用例
const userId = 'abc123def456ghi789';
const userIdHash = hashUserId(userId);
// => "5f4dcc3b5aa765d61d8327deb882cf99abc123def456..."
```

**特性**:
- 一方向性: ハッシュから元のユーザーIDは復元不可
- 決定性: 同じユーザーIDは常に同じハッシュ値
- 衝突耐性: 異なるユーザーIDが同じハッシュになる確率は極めて低い

**GDPR準拠**:
- GDPR第4条5項「仮名化されたデータ」に該当
- 追加情報(ソルト)なしでは個人を特定不可

#### 6.1.2 データ最小化原則

**BigQueryに保存しないデータ**:
- 名前
- メールアドレス
- 電話番号
- 正確な生年月日(年齢層のみ)
- 住所
- IPアドレス
- 正確な位置情報(国レベルのみ)

**保存するデータ**:
- ユーザーIDのハッシュ値
- トレーニングセッションデータ
- 骨格座標データ(顔は含まない)
- デバイス情報
- 統計情報

### 6.2 データ保存期間の自動管理

#### 6.2.1 パーティション有効期限

**設定方法**:

```sql
-- テーブル作成時に設定
CREATE TABLE `fitness_analytics.training_sessions` (
  -- スキーマ定義
)
PARTITION BY DATE(created_at)
OPTIONS(
  partition_expiration_days=730  -- 2年間
);

-- 既存テーブルに設定
ALTER TABLE `fitness_analytics.training_sessions`
SET OPTIONS(
  partition_expiration_days=730
);
```

**動作**:
- パーティション作成から730日後に自動削除
- 手動操作不要
- GDPR第5条1項(e)「保存期間の制限」に準拠

#### 6.2.2 長期ストレージへの自動移行

**90日経過後のデータ**: アクティブストレージ($0.02/GB/月) → 長期ストレージ($0.01/GB/月)

**自動移行**: BigQueryが自動的に実行(設定不要)

**コスト削減効果**(プロジェクト懸念点#8対応):
```
90日以上のデータ: ストレージコスト50%削減
例: 100GB → $2/月 から $1/月 へ
```

### 6.3 データアクセス権とポータビリティ

#### 6.3.1 ユーザーデータのエクスポート

```javascript
/**
 * ユーザーデータのエクスポート(GDPR第15条、第20条)
 */
exports.user_exportData = functions
  .region('asia-northeast1')
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '認証が必要です'
      );
    }
    
    const uid = context.auth.uid;
    const userIdHash = hashUserId(uid);
    
    try {
      // BigQueryからユーザーデータを取得
      const query = `
        SELECT
          session_id,
          exercise_id,
          start_time,
          end_time,
          duration_seconds,
          rep_count,
          set_count,
          average_score,
          max_score,
          min_score,
          created_at
        FROM \`fitness_analytics.training_sessions\`
        WHERE user_id_hash = @user_id_hash
          AND is_deleted = FALSE
        ORDER BY created_at DESC;
      `;
      
      const [rows] = await bigquery.query({
        query: query,
        params: { user_id_hash: userIdHash }
      });
      
      // JSON形式でエクスポート
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: uid, // エクスポート時のみ元のユーザーIDを含める
        sessions: rows.map(row => ({
          sessionId: row.session_id,
          exerciseId: row.exercise_id,
          startTime: row.start_time,
          endTime: row.end_time,
          durationSeconds: row.duration_seconds,
          repCount: row.rep_count,
          setCount: row.set_count,
          averageScore: row.average_score,
          maxScore: row.max_score,
          minScore: row.min_score,
          createdAt: row.created_at
        }))
      };
      
      // Cloud Storageに一時保存
      const bucket = admin.storage().bucket();
      const fileName = `exports/${uid}_${Date.now()}.json`;
      const file = bucket.file(fileName);
      
      await file.save(JSON.stringify(exportData, null, 2), {
        contentType: 'application/json',
        metadata: {
          metadata: {
            userId: uid,
            exportDate: new Date().toISOString()
          }
        }
      });
      
      // 署名付きURL生成(24時間有効)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000
      });
      
      console.log(`User data exported: ${uid}`);
      
      return {
        success: true,
        downloadUrl: signedUrl,
        expiresIn: '24時間'
      };
      
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new functions.https.HttpsError(
        'internal',
        `データエクスポートエラー: ${error.message}`
      );
    }
  });
```

---

## 7. 分析用クエリ

### 7.1 基本統計クエリ

#### 7.1.1 全体統計

```sql
-- 全体の統計情報(過去30日間)
SELECT
  COUNT(DISTINCT user_id_hash) as total_users,
  COUNT(*) as total_sessions,
  SUM(duration_seconds) / 3600.0 as total_hours,
  AVG(average_score) as avg_score,
  AVG(rep_count) as avg_reps
FROM `fitness_analytics.training_sessions`
WHERE is_deleted = FALSE
  AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

**想定実行時間**: 1-2秒  
**想定スキャン量**: 1.8GB(30日分)  
**想定コスト**: $0.009

#### 7.1.2 種目別統計

```sql
-- 種目別の統計情報(集計テーブル使用でコスト削減)
SELECT
  ed.exercise_name_ja,
  SUM(ast.total_sessions) as session_count,
  SUM(ast.total_users) as user_count,
  AVG(ast.average_score) as avg_score,
  AVG(ast.average_rep_count) as avg_reps,
  SUM(ast.total_duration_seconds) / 60.0 / SUM(ast.total_sessions) as avg_duration_minutes
FROM `fitness_analytics.aggregated_stats` ast
JOIN `fitness_analytics.exercise_definitions` ed
  ON ast.exercise_id = ed.exercise_id
WHERE ast.stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY ed.exercise_name_ja
ORDER BY session_count DESC;
```

**想定実行時間**: < 1秒  
**想定スキャン量**: 10MB(集計テーブル)  
**想定コスト**: $0.00005  
**コスト削減効果**: 99%削減(元のクエリと比較)

#### 7.1.3 日別トレンド

```sql
-- 日別のセッション数推移
SELECT
  stat_date,
  SUM(total_sessions) as session_count,
  SUM(total_users) as active_users,
  AVG(average_score) as avg_score
FROM `fitness_analytics.aggregated_stats`
WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY stat_date
ORDER BY stat_date DESC;
```

### 7.2 ユーザー分析クエリ

#### 7.2.1 アクティブユーザー分析(DAU/WAU/MAU)

```sql
-- DAU, WAU, MAU
WITH daily_active AS (
  SELECT
    DATE(created_at) as activity_date,
    user_id_hash
  FROM `fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
    AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY activity_date, user_id_hash
)
SELECT
  activity_date,
  COUNT(DISTINCT user_id_hash) as dau
FROM daily_active
GROUP BY activity_date
ORDER BY activity_date DESC;
```

#### 7.2.2 リテンション分析

```sql
-- 7日後リテンション率
WITH first_session AS (
  SELECT
    user_id_hash,
    DATE(MIN(created_at)) as first_date
  FROM `fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
  GROUP BY user_id_hash
),
day7_activity AS (
  SELECT DISTINCT
    fs.user_id_hash,
    fs.first_date
  FROM first_session fs
  JOIN `fitness_analytics.training_sessions` ts
    ON fs.user_id_hash = ts.user_id_hash
  WHERE ts.is_deleted = FALSE
    AND DATE(ts.created_at) BETWEEN 
        DATE_ADD(fs.first_date, INTERVAL 7 DAY) AND 
        DATE_ADD(fs.first_date, INTERVAL 13 DAY)
)
SELECT
  fs.first_date as cohort_date,
  COUNT(DISTINCT fs.user_id_hash) as cohort_size,
  COUNT(DISTINCT d7.user_id_hash) as retained_users,
  ROUND(COUNT(DISTINCT d7.user_id_hash) * 100.0 / 
        COUNT(DISTINCT fs.user_id_hash), 2) as retention_rate
FROM first_session fs
LEFT JOIN day7_activity d7
  ON fs.user_id_hash = d7.user_id_hash
WHERE fs.first_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY cohort_date
ORDER BY cohort_date DESC;
```

### 7.3 高度な分析クエリ

#### 7.3.1 スコア分布分析

```sql
-- スコア分布のヒストグラム
SELECT
  exercise_id,
  CASE
    WHEN average_score >= 90 THEN '90-100'
    WHEN average_score >= 80 THEN '80-89'
    WHEN average_score >= 70 THEN '70-79'
    WHEN average_score >= 60 THEN '60-69'
    ELSE '0-59'
  END as score_range,
  COUNT(*) as session_count
FROM `fitness_analytics.training_sessions`
WHERE is_deleted = FALSE
  AND average_score IS NOT NULL
  AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY exercise_id, score_range
ORDER BY exercise_id, score_range DESC;
```

#### 7.3.2 ユーザーセグメント分析

```sql
-- ユーザーレベルのセグメント化
WITH user_activity AS (
  SELECT
    user_id_hash,
    COUNT(*) as total_sessions,
    AVG(average_score) as avg_score,
    MAX(DATE(created_at)) as last_active_date
  FROM `fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
  GROUP BY user_id_hash
)
SELECT
  CASE
    WHEN total_sessions >= 50 THEN 'Power User'
    WHEN total_sessions >= 20 THEN 'Regular User'
    WHEN total_sessions >= 5 THEN 'Casual User'
    ELSE 'New User'
  END as user_segment,
  COUNT(*) as user_count,
  AVG(total_sessions) as avg_sessions,
  AVG(avg_score) as avg_score
FROM user_activity
WHERE last_active_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY user_segment
ORDER BY 
  CASE user_segment
    WHEN 'Power User' THEN 1
    WHEN 'Regular User' THEN 2
    WHEN 'Casual User' THEN 3
    ELSE 4
  END;
```

---

## 8. パフォーマンス最適化

### 8.1 クエリ最適化

#### 8.1.1 パーティションフィルタの使用(必須)

```sql
-- ❌ 悪い例: パーティションフィルタなし
SELECT *
FROM `fitness_analytics.training_sessions`
WHERE user_id_hash = 'abc123';

-- ✅ 良い例: パーティションフィルタあり
SELECT *
FROM `fitness_analytics.training_sessions`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND user_id_hash = 'abc123';
```

**効果**(プロジェクト懸念点#8対応):
- スキャンデータ量: 95%削減
- クエリコスト: 95%削減
- 実行時間: 90%短縮

**コスト比較**:
```
パーティションフィルタなし: 全データスキャン(100GB) → $0.50
パーティションフィルタあり: 7日分のみ(5GB) → $0.025
```

#### 8.1.2 クラスタリングの活用

```sql
-- クラスタリングキー(user_id_hash, exercise_id)を使用
SELECT
  exercise_id,
  COUNT(*) as session_count,
  AVG(average_score) as avg_score
FROM `fitness_analytics.training_sessions`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND user_id_hash = 'abc123'
  AND exercise_id = 'squat'
GROUP BY exercise_id;
```

**効果**:
- スキャンデータ量: 最大90%削減
- クエリ実行時間: 最大70%短縮

#### 8.1.3 集計テーブルの活用(推奨)

```sql
-- aggregated_statsテーブルを使用
SELECT
  stat_date,
  exercise_id,
  total_sessions,
  average_score
FROM `fitness_analytics.aggregated_stats`
WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY stat_date DESC;
```

**メリット**:
- リアルタイムクエリより100倍高速
- コスト削減: 99%
- 定期的なレポート生成に最適

### 8.2 ストレージ最適化

#### 8.2.1 データ圧縮

**自動圧縮**: BigQueryは自動的にデータを圧縮(Capacitor形式)

**効果**:
- ストレージコスト: 約80%削減
- クエリパフォーマンス: 向上(圧縮データの読み込みが高速)

#### 8.2.2 不要データの削除

```sql
-- 論理削除されたデータの物理削除
DELETE FROM `fitness_analytics.training_sessions`
WHERE is_deleted = TRUE
  AND deleted_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);
```

**実行頻度**: 日次(午前4時)

### 8.3 コスト最適化

#### 8.3.1 クエリコストの見積もり

```bash
# dry_runオプションでコストを事前確認
bq query --dry_run --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `fitness_analytics.training_sessions` 
   WHERE DATE(created_at) = CURRENT_DATE()'
```

**出力例**:
```
Query successfully validated. Assuming the tables are not modified,
running this query will process 60 MB of data.

想定コスト: 60MB / 1000GB × $5 = $0.0003
```

#### 8.3.2 スロット予約(Phase 3以降)

**フラット料金プラン**: クエリ実行が多い場合に検討

**目安**:
- 月間スキャン量: 1TB以上
- 頻繁なクエリ実行: 100回/日以上

**Phase 3以降の検討項目**:
- 月額$2,000でフラット料金(100スロット)
- オンデマンド料金と比較して判断

---

**Part 2 完了**

次のファイル(Part 3)には以下を含めます:
- コスト管理(詳細なコスト見積もりと監視)
- 監視とアラート
- データライフサイクル管理(バックアップとDR)
- セキュリティ(IAM設計)
- 運用手順
- 付録
# BigQuery設計書 v3.3 (Part 3/3)

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.3 (MVP)

---

## 9. コスト管理

### 9.1 BigQueryの料金体系

#### 9.1.1 ストレージコスト

| タイプ | 料金 | 説明 |
|-------|------|------|
| **アクティブストレージ** | $0.02/GB/月 | 過去90日以内に編集されたデータ |
| **長期ストレージ** | $0.01/GB/月 | 90日以上編集されていないデータ(自動移行) |

**MVP期の見積もり**(DAU 100人):
```
月間データ量: 1.8GB
アクティブストレージ(0-90日): 1.8GB × 3ヶ月 = 5.4GB × $0.02 = $0.11/月
長期ストレージ(90日以降): なし(MVP期は3ヶ月想定)
合計ストレージコスト: $0.11/月
```

**Phase 3以降の見積もり**(DAU 10,000人):
```
月間データ量: 270GB
アクティブストレージ(0-90日): 270GB × 3ヶ月 = 810GB × $0.02 = $16.20/月
長期ストレージ(90-730日): 270GB × 21ヶ月 = 5,670GB × $0.01 = $56.70/月
合計ストレージコスト: $72.90/月
```

#### 9.1.2 クエリコスト

**オンデマンド料金**: $5/TB(月間1TB無料枠あり)

**MVP期の見積もり**:
```
想定クエリ:
- 日次集計: 1.8GB × 30日 = 54GB/月
- ユーザー分析: 5GB/月
- ダッシュボード: 10GB/月
合計スキャン量: 69GB/月

クエリコスト: 0.069TB × $5 = $0.35/月(無料枠内)
実質コスト: $0/月
```

**Phase 3以降の見積もり**:
```
合計スキャン量: 1.5TB/月(集計テーブル活用)

クエリコスト: (1.5TB - 1TB無料) × $5 = $2.50/月
```

#### 9.1.3 ストリーミング挿入コスト

**料金**: $0.01/200MB(最初の2TB/月は無料)

**MVP期の見積もり**(プロジェクト懸念点#8の再評価):
```
日次セッション数: 100人 × 2セッション = 200セッション
平均データサイズ: 300.5KB/セッション
日次データ量: 200 × 300.5KB = 60.1MB/日
月間データ量: 60.1MB × 30日 = 1.8GB/月

ストリーミングコスト: 1.8GB / 200MB × $0.01 = $0.09/月(無料枠内)
実質コスト: $0/月
```

**Phase 3以降の見積もり**(10,000セッション/日):
```
日次データ量: 10,000 × 300.5KB = 3.0GB/日
月間データ量: 3.0GB × 30日 = 90GB/月

ストリーミングコスト: (90GB - 2GB無料) / 0.2GB × $0.01 = $4.40/月
```

**懸念点#8への対応**:
当初予測($1-2/月)は楽観的でしたが、以下の対策により許容範囲内:
- パーティショニングとクラスタリングによるスキャン量95%削減
- 集計テーブル活用によるクエリコスト99%削減
- MVP期は無料枠内に収まる見込み
- Phase 3以降も月額$10以下で管理可能

### 9.2 コスト最適化戦略

#### 9.2.1 Phase 1-2 (MVP期: 0-4ヶ月)

| 施策 | 効果 | 実装優先度 | 削減率 |
|-----|------|----------|--------|
| **パーティション必須** | スキャン量削減 | 必須 | 95% |
| **クラスタリング** | スキャン量削減 | 必須 | 90% |
| **集計テーブル活用** | クエリコスト削減 | 必須 | 99% |
| **不要データ削除** | ストレージコスト削減 | 必須 | 10-20% |

**想定月額コスト**(修正後):
- ストレージ: $0.11/月
- クエリ: $0/月(無料枠内)
- ストリーミング: $0/月(無料枠内)
- **合計: $0.11/月**

#### 9.2.2 Phase 3以降 (拡大期: 4ヶ月以降)

| 施策 | 効果 | 実装時期 | 削減額 |
|-----|------|---------|--------|
| **スロット予約** | クエリコスト削減 | Phase 3 | 50% |
| **BI Engine** | クエリ高速化 | Phase 3 | - |
| **長期ストレージ活用** | ストレージコスト削減 | 自動 | 50% |
| **マテリアライズドビュー** | クエリコスト削減 | Phase 3 | 80% |

**想定月額コスト**(Phase 3):
- ストレージ: $72.90/月
- クエリ: $2.50/月
- ストリーミング: $4.40/月
- **合計: $79.80/月**

### 9.3 コスト監視と予算アラート

#### 9.3.1 Cloud Billing Budget設定

```bash
# 月次予算アラートの設定
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="BigQuery Monthly Budget" \
  --budget-amount=10 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --notification-channel-ids=NOTIFICATION_CHANNEL_ID
```

**アラート条件**:
- 50%($5): 警告メール送信
- 90%($9): 重大警告メール + Slack通知
- 100%($10): 緊急アラート + クエリ実行制限検討

**Phase 3以降**: 予算を$100/月に引き上げ

#### 9.3.2 日次コストレポート

**Cloud Functions実装**(プロジェクト懸念点#8対応):

```javascript
exports.dailyCostReport = functions
  .region('asia-northeast1')
  .pubsub
  .schedule('0 9 * * *') // 毎日午前9時(JST)
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      const bigquery = new BigQuery();
      
      // 昨日の日付
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      // 1. クエリコストの集計
      const queryQuery = `
        SELECT
          user_email,
          SUM(total_bytes_processed) / POW(10, 12) as total_tb_processed,
          SUM(total_bytes_processed) / POW(10, 12) * 5 as estimated_cost_usd,
          COUNT(*) as query_count
        FROM \`region-asia-northeast1\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
        WHERE DATE(creation_time) = @target_date
          AND job_type = 'QUERY'
          AND state = 'DONE'
        GROUP BY user_email
        ORDER BY total_tb_processed DESC
        LIMIT 10;
      `;
      
      const [queryRows] = await bigquery.query({
        query: queryQuery,
        params: { target_date: dateStr }
      });
      
      // 2. ストレージコストの取得
      const storageQuery = `
        SELECT
          table_schema,
          table_name,
          SUM(size_bytes) / POW(10, 9) as size_gb,
          SUM(size_bytes) / POW(10, 9) * 0.02 / 30 as daily_cost_usd
        FROM \`fitness_analytics\`.INFORMATION_SCHEMA.TABLE_STORAGE
        WHERE DATE(creation_time) <= @target_date
        GROUP BY table_schema, table_name
        ORDER BY size_gb DESC;
      `;
      
      const [storageRows] = await bigquery.query({
        query: storageQuery,
        params: { target_date: dateStr }
      });
      
      // 3. ストリーミング挿入コストの推定
      const streamingQuery = `
        SELECT
          COUNT(*) as row_count,
          COUNT(*) * 0.0003 as estimated_size_gb,
          COUNT(*) * 0.0003 / 0.2 * 0.01 as estimated_cost_usd
        FROM \`fitness_analytics.training_sessions\`
        WHERE DATE(created_at) = @target_date;
      `;
      
      const [streamingRows] = await bigquery.query({
        query: streamingQuery,
        params: { target_date: dateStr }
      });
      
      // 4. 合計コストの計算
      const totalQueryCost = queryRows.reduce((sum, row) => 
        sum + row.estimated_cost_usd, 0
      );
      const totalStorageCost = storageRows.reduce((sum, row) => 
        sum + row.daily_cost_usd, 0
      );
      const totalStreamingCost = streamingRows[0]?.estimated_cost_usd || 0;
      const totalCost = totalQueryCost + totalStorageCost + totalStreamingCost;
      
      // 5. Slackへ通知
      await sendSlackNotification({
        text: `📊 BigQuery Daily Cost Report (${dateStr})`,
        attachments: [{
          color: totalCost > 5 ? 'danger' : 'good',
          fields: [
            {
              title: '合計コスト',
              value: `$${totalCost.toFixed(2)}`,
              short: false
            },
            {
              title: 'クエリコスト',
              value: `$${totalQueryCost.toFixed(2)}`,
              short: true
            },
            {
              title: 'ストレージコスト',
              value: `$${totalStorageCost.toFixed(2)}`,
              short: true
            },
            {
              title: 'ストリーミングコスト',
              value: `$${totalStreamingCost.toFixed(2)}`,
              short: true
            },
            {
              title: '月間予測',
              value: `$${(totalCost * 30).toFixed(2)}`,
              short: true
            }
          ]
        }]
      });
      
      // 6. アラート判定
      if (totalCost > 5) {
        await sendSlackAlert({
          level: 'warning',
          title: 'BigQuery日次コストが予算超過',
          message: `日次コストが$5を超えました: $${totalCost.toFixed(2)}`,
          details: {
            date: dateStr,
            queryCost: `$${totalQueryCost.toFixed(2)}`,
            storageCost: `$${totalStorageCost.toFixed(2)}`,
            streamingCost: `$${totalStreamingCost.toFixed(2)}`
          }
        });
      }
      
    } catch (error) {
      console.error('Error in dailyCostReport:', error);
      
      await sendSlackAlert({
        level: 'error',
        title: 'BigQuery日次コストレポート失敗',
        message: 'コストレポートの生成でエラーが発生しました。',
        error: error.message
      });
    }
  });
```

#### 9.3.3 四半期コスト見直し

**実施時期**: Phase 1終了時、Phase 2終了時、Phase 3開始後3ヶ月

**見直し項目**:
1. 実際のコストと予測の比較
2. コスト最適化施策の効果測定
3. スロット予約への移行判断
4. データ保持期間の見直し

---

## 10. 監視とアラート

### 10.1 Cloud Monitoring設定

#### 10.1.1 監視指標

| 指標 | 説明 | アラート閾値 | 通知先 |
|-----|------|------------|--------|
| **クエリ実行時間** | クエリの平均実行時間 | > 30秒 | Slack |
| **クエリエラー率** | 失敗したクエリの割合 | > 5% | Slack + Email |
| **ストレージ使用量** | データセットのサイズ | > 90% of quota | Email |
| **日次コスト** | 1日あたりのコスト | > $5 | Slack + Email |
| **ストリーミング挿入エラー** | 挿入失敗の件数 | > 10件/時間 | Slack |
| **DLQメッセージ数** | 処理失敗メッセージ数 | > 0 | Slack + Email |

#### 10.1.2 アラートポリシー設定

```bash
# クエリエラー率のアラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="BigQuery Query Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="bigquery_project" AND metric.type="bigquery.googleapis.com/query/error_count"'

# ストリーミング挿入エラーのアラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="BigQuery Streaming Insert Errors" \
  --condition-display-name="Streaming errors > 10/hour" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=3600s \
  --condition-filter='resource.type="bigquery_dataset" AND metric.type="bigquery.googleapis.com/storage/streaming_insert_errors"'
```

### 10.2 監査ログ

#### 10.2.1 Cloud Audit Logs設定

**有効化するログ**:
- 管理アクティビティログ(Admin Activity Logs): デフォルトで有効
- データアクセスログ(Data Access Logs): 明示的に有効化

```bash
# データアクセスログの有効化
gcloud projects get-iam-policy PROJECT_ID > policy.yaml

# policy.yamlに以下を追加:
auditConfigs:
- auditLogConfigs:
  - logType: DATA_READ
  - logType: DATA_WRITE
  service: bigquery.googleapis.com
```

#### 10.2.2 監査ログの確認

```bash
# データアクセスログの確認
gcloud logging read "resource.type=bigquery_dataset AND protoPayload.methodName=jobservice.insert" \
  --limit 50 \
  --format json

# 特定ユーザーのクエリ履歴
gcloud logging read "resource.type=bigquery_dataset AND protoPayload.authenticationInfo.principalEmail=user@example.com" \
  --limit 50 \
  --format json
```

### 10.3 パフォーマンス監視

#### 10.3.1 スロークエリの検出

```sql
-- 実行時間が長いクエリを特定
SELECT
  user_email,
  query,
  total_slot_ms / 1000.0 as total_slot_seconds,
  total_bytes_processed / POW(10, 9) as gb_processed,
  creation_time,
  end_time,
  TIMESTAMP_DIFF(end_time, creation_time, SECOND) as execution_time_seconds
FROM `region-asia-northeast1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
  AND TIMESTAMP_DIFF(end_time, creation_time, SECOND) > 30
ORDER BY execution_time_seconds DESC
LIMIT 10;
```

#### 10.3.2 高コストクエリの検出

```sql
-- コストが高いクエリを特定
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) as tb_processed,
  total_bytes_processed / POW(10, 12) * 5 as estimated_cost_usd,
  creation_time
FROM `region-asia-northeast1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
  AND total_bytes_processed > 100 * POW(10, 9) -- 100GB以上
ORDER BY estimated_cost_usd DESC
LIMIT 10;
```

---

## 11. データライフサイクル管理

### 11.1 バックアップ戦略(プロジェクト懸念点#16対応)

#### 11.1.1 スナップショット取得

**日次スナップショット**:

```javascript
exports.dailySnapshot = functions
  .region('asia-northeast1')
  .pubsub
  .schedule('0 1 * * *') // 毎日午前1時(JST)
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      const bigquery = new BigQuery();
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      // バックアップ対象テーブル
      const tables = [
        'training_sessions',
        'user_metadata',
        'exercise_definitions',
        'aggregated_stats'
      ];
      
      for (const table of tables) {
        // スナップショットテーブル名
        const snapshotTable = `${table}_snapshot_${today}`;
        
        // スナップショットを作成(クロスリージョン)
        await bigquery.query(`
          CREATE SNAPSHOT TABLE \`fitness_analytics_backup.${snapshotTable}\`
          CLONE \`fitness_analytics.${table}\`
          OPTIONS(
            expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
          );
        `);
        
        console.log(`Snapshot created: ${snapshotTable}`);
      }
      
      // Slackに通知
      await sendSlackNotification({
        text: `✅ BigQuery日次スナップショット完了: ${today}`
      });
      
    } catch (error) {
      console.error('Error in dailySnapshot:', error);
      
      await sendSlackAlert({
        level: 'error',
        title: 'BigQueryスナップショット失敗',
        message: 'スナップショットの取得でエラーが発生しました。',
        error: error.message
      });
      
      throw error;
    }
  });
```

#### 11.1.2 リストア手順

**手動リストア**(RTO: 24時間以内):

```bash
# 1. 利用可能なスナップショットを確認
bq ls --max_results=100 fitness_analytics_backup

# 2. スナップショットからリストア
bq cp \
  --snapshot_epoch=1700000000000 \
  fitness_analytics_backup.training_sessions_snapshot_20251124 \
  fitness_analytics.training_sessions_restored

# 3. 検証
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `fitness_analytics.training_sessions_restored`'

# 4. 元のテーブルをバックアップ
bq cp fitness_analytics.training_sessions fitness_analytics.training_sessions_old

# 5. リストアしたテーブルを本番に切り替え
bq rm -f fitness_analytics.training_sessions
bq cp fitness_analytics.training_sessions_restored fitness_analytics.training_sessions
```

#### 11.1.3 RPO/RTOの保証

| 指標 | 目標値 | 実装方法 |
|-----|-------|---------|
| **RPO** | 24時間 | 日次スナップショット |
| **RTO** | 24時間 | 自動スナップショット + 手動リストア手順 |
| **データ整合性** | 99.99% | BigQueryの自動レプリケーション |

### 11.2 データ保持期間管理

#### 11.2.1 自動削除設定

**パーティション有効期限**:

```sql
-- 既存テーブルに設定
ALTER TABLE `fitness_analytics.training_sessions`
SET OPTIONS(
  partition_expiration_days=730  -- 2年間
);

-- 新規テーブル作成時に設定
CREATE TABLE `fitness_analytics.new_table` (
  -- schema
)
PARTITION BY DATE(created_at)
OPTIONS(
  partition_expiration_days=730
);
```

#### 11.2.2 スナップショットの保持期間

```sql
-- スナップショットの有効期限設定
CREATE SNAPSHOT TABLE `fitness_analytics_backup.training_sessions_snapshot_20251124`
CLONE `fitness_analytics.training_sessions`
OPTIONS(
  expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
);
```

**保持期間**:
- 日次スナップショット: 30日間
- 月次スナップショット(Phase 3以降): 12ヶ月間

### 11.3 データアーカイブ(Phase 3以降)

#### 11.3.1 Cloud Storageへのエクスポート

**長期アーカイブ用**(2年以上保持が必要な場合):

```bash
# BigQueryからCloud Storageへエクスポート
bq extract \
  --destination_format=AVRO \
  --compression=SNAPPY \
  'fitness_analytics.training_sessions$20230101' \
  'gs://fitness-app-archive/training_sessions/2023/01/01/*.avro'

# Archive Storage Classへ移行
gsutil rewrite -s ARCHIVE gs://fitness-app-archive/training_sessions/2023/01/01/*

# ストレージコスト: $0.0012/GB/月(Archiveクラス)
```

---

## 12. セキュリティ

### 12.1 IAM権限設計

#### 12.1.1 最小権限の原則

**ロール定義**:

| ロール | 対象者 | 権限 | 説明 |
|-------|--------|------|------|
| **BigQuery Data Viewer** | データアナリスト | データの読み取りのみ | ダッシュボード作成、分析クエリ実行 |
| **BigQuery Data Editor** | データエンジニア | データの読み書き | ETL処理、テーブル管理 |
| **BigQuery Admin** | システム管理者 | フルアクセス | データセット管理、権限管理 |
| **BigQuery Job User** | アプリケーション(Cloud Functions) | ジョブ実行 | クエリ実行、データ挿入 |

**IAM設定例**:

```bash
# データアナリストにData Viewer権限を付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:analyst@example.com" \
  --role="roles/bigquery.dataViewer"

# データエンジニアにData Editor権限を付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:engineer@example.com" \
  --role="roles/bigquery.dataEditor"

# Cloud FunctionsのサービスアカウントにJob User権限を付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:firebase-functions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

#### 12.1.2 データセットレベルの権限

```bash
# 特定データセットへのアクセス制限
bq update --source fitness_analytics \
  --add_access_role=roles/bigquery.dataViewer \
  --add_access_user=analyst@example.com

# テーブルレベルの権限設定
bq update --source fitness_analytics.training_sessions \
  --add_access_role=roles/bigquery.dataViewer \
  --add_access_user=ml-engineer@example.com
```

#### 12.1.3 サービスアカウント管理

**原則**:
- 各環境(dev, staging, prod)で異なるサービスアカウントを使用
- 定期的なキーローテーション(90日ごと)
- 未使用のサービスアカウントは削除

**サービスアカウント作成**:

```bash
# BigQuery専用サービスアカウント
gcloud iam service-accounts create bigquery-writer \
  --display-name="BigQuery Writer Service Account"

# 権限付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:bigquery-writer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
```

### 12.2 データ暗号化

#### 12.2.1 転送中の暗号化

**TLS 1.3**: すべてのBigQuery APIリクエストでTLS 1.3を使用(デフォルト)

**実装例**(Cloud Functions):

```javascript
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'fitness-app-prod',
  // TLS 1.3は自動的に使用される
});
```

#### 12.2.2 保存時の暗号化

**デフォルト暗号化**: Google管理の暗号鍵(AES-256)

**CMEK(Phase 2以降)**:

```bash
# Cloud KMS鍵の作成
gcloud kms keyrings create fitness-app-keyring \
  --location=asia-northeast1

gcloud kms keys create bigquery-key \
  --location=asia-northeast1 \
  --keyring=fitness-app-keyring \
  --purpose=encryption

# データセットにCMEKを適用
bq update \
  --default_kms_key_name=projects/PROJECT_ID/locations/asia-northeast1/keyRings/fitness-app-keyring/cryptoKeys/bigquery-key \
  fitness_analytics
```

**CMEK利用のメリット**:
- 暗号鍵の完全な管理権限
- 鍵のローテーション制御
- 監査証跡の強化

**CMEK利用のコスト**:
- Cloud KMS: $0.06/鍵バージョン/月
- 暗号化/復号化操作: $0.03/10,000操作

### 12.3 アクセス制御

#### 12.3.1 VPCサービスコントロール(Phase 3以降)

**目的**: BigQueryへのアクセスを特定のVPCネットワークに制限

```bash
# サービスペリメーターの作成
gcloud access-context-manager perimeters create fitness_app_perimeter \
  --title="Fitness App Perimeter" \
  --resources=projects/PROJECT_ID \
  --restricted-services=bigquery.googleapis.com \
  --access-levels=ACCESS_LEVEL_NAME
```

#### 12.3.2 監査ログによる不正アクセス検知

**検知クエリ**:

```sql
-- 異常なデータアクセスを検出
SELECT
  protoPayload.authenticationInfo.principalEmail as user_email,
  protoPayload.methodName as method,
  COUNT(*) as access_count,
  MIN(timestamp) as first_access,
  MAX(timestamp) as last_access
FROM `PROJECT_ID.cloudaudit_googleapis_com_data_access_*`
WHERE DATE(_TABLE_SUFFIX) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND resource.type = 'bigquery_dataset'
  AND protoPayload.methodName LIKE '%getData%'
GROUP BY user_email, method
HAVING access_count > 1000  -- 1日1000回以上のアクセス
ORDER BY access_count DESC;
```

---

## 13. 運用手順

### 13.1 日次運用タスク

#### 13.1.1 朝のチェックリスト(9:00)

- [ ] 日次コストレポートを確認(Slack通知)
- [ ] エラーログをチェック(pseudonymization_log)
- [ ] DLQメッセージがないか確認
- [ ] スロークエリがないか確認(INFORMATION_SCHEMA)
- [ ] ストレージ使用量を確認

**自動化済み**: dailyCostReport関数が自動実行

#### 13.1.2 夜のチェックリスト(17:00)

- [ ] 集計処理の完了確認
- [ ] バックアップの成功確認(Slack通知)
- [ ] 異常なアクセスパターンがないか確認

### 13.2 週次運用タスク

#### 13.2.1 日曜のチェックリスト(10:00)

- [ ] 先週のコスト集計
- [ ] パフォーマンストレンドの確認
- [ ] データ品質チェック
- [ ] 不要スナップショットの確認

**週次レポート**:

```sql
-- 先週の統計
SELECT
  DATE_TRUNC(DATE(created_at), WEEK) as week,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id_hash) as active_users,
  AVG(average_score) as avg_score,
  SUM(duration_seconds) / 3600.0 as total_hours
FROM `fitness_analytics.training_sessions`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND is_deleted = FALSE
GROUP BY week;
```

### 13.3 月次運用タスク

#### 13.3.1 月初のチェックリスト(1日 11:00)

- [ ] 先月のコスト分析
- [ ] ストレージ最適化(不要データ削除)
- [ ] アクセス権限レビュー
- [ ] バックアップの検証(リストアテスト)
- [ ] セキュリティ監査ログのレビュー

**月次コストレポート**:

```sql
-- 先月のコスト内訳
SELECT
  DATE_TRUNC(DATE(creation_time), MONTH) as month,
  SUM(total_bytes_processed) / POW(10, 12) as total_tb_processed,
  SUM(total_bytes_processed) / POW(10, 12) * 5 as query_cost_usd,
  COUNT(*) as query_count
FROM `region-asia-northeast1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
GROUP BY month;
```

### 13.4 トラブルシューティング

#### 13.4.1 よくある問題と解決方法

**問題1: クエリが遅い**

原因:
- パーティションフィルタが使われていない
- クラスタリングキーが活用されていない
- 全テーブルスキャンが発生

解決方法:
```sql
-- 改善前: 全テーブルスキャン
SELECT * FROM training_sessions WHERE user_id_hash = 'abc';

-- 改善後: パーティションフィルタ + クラスタリング
SELECT * 
FROM training_sessions 
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND user_id_hash = 'abc';
```

**問題2: ストリーミング挿入エラー**

原因:
- スキーマ不一致
- 必須フィールドの欠如
- BigQuery APIの一時障害

解決方法:
```javascript
// データのバリデーション強化
function validateData(data) {
  const required = ['session_id', 'user_id_hash', 'exercise_id'];
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // スキーマ検証
  if (!['squat', 'push_up', 'plank', 'lunge', 'glute_bridge'].includes(data.exercise_id)) {
    throw new Error(`Invalid exercise_id: ${data.exercise_id}`);
  }
  
  return true;
}
```

**問題3: コストが急増**

原因:
- 全テーブルスキャンのクエリ
- パーティションフィルタなしのクエリ
- 不要な大量クエリ実行

解決方法:
```sql
-- 高コストクエリを特定
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) as tb_processed,
  total_bytes_processed / POW(10, 12) * 5 as cost_usd
FROM `region-asia-northeast1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) = CURRENT_DATE()
  AND total_bytes_processed > 100 * POW(10, 9) -- 100GB以上
ORDER BY cost_usd DESC;
```

**問題4: DLQにメッセージが溜まる**

原因:
- 仮名化処理の継続的な失敗
- BigQuery APIの長時間障害
- データ形式の不正

解決方法:
```bash
# 1. DLQメッセージを確認
gcloud pubsub subscriptions pull training-sessions-dlq-sub --limit=10

# 2. エラー原因を特定
gcloud logging read "resource.type=cloud_function AND textPayload=~'Error processing session'" \
  --limit 50

# 3. 手動リカバリAPI実行
curl -X POST https://asia-northeast1-PROJECT_ID.cloudfunctions.net/processDLQ \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID"}'
```

---

## 14. 付録

### 14.1 MediaPipe Pose ランドマークID一覧

| ID | 関節名(英語) | 関節名(日本語) | 主な用途 |
|----|------------|-------------|---------|
| 0 | NOSE | 鼻 | 顔の向き検出 |
| 1-10 | 顔の特徴点 | 目、耳、口 | 顔検出(不使用) |
| 11 | LEFT_SHOULDER | 左肩 | 上半身姿勢 |
| 12 | RIGHT_SHOULDER | 右肩 | 上半身姿勢 |
| 13 | LEFT_ELBOW | 左肘 | 腕の角度 |
| 14 | RIGHT_ELBOW | 右肘 | 腕の角度 |
| 15 | LEFT_WRIST | 左手首 | 手の位置 |
| 16 | RIGHT_WRIST | 右手首 | 手の位置 |
| 17-22 | 手の特徴点 | 指 | 詳細な手の動き |
| 23 | LEFT_HIP | 左腰 | 下半身姿勢 |
| 24 | RIGHT_HIP | 右腰 | 下半身姿勢 |
| 25 | LEFT_KNEE | 左膝 | 脚の角度 |
| 26 | RIGHT_KNEE | 右膝 | 脚の角度 |
| 27 | LEFT_ANKLE | 左足首 | 足の位置 |
| 28 | RIGHT_ANKLE | 右足首 | 足の位置 |
| 29-32 | 足の特徴点 | かかと、指 | 詳細な足の動き |

**MVP 5種目で使用する主要関節**:
- スクワット: 11, 12, 23, 24, 25, 26, 27, 28(肩、腰、膝、足首)
- プッシュアップ: 11, 12, 13, 14, 15, 16(肩、肘、手首)
- プランク: 11, 12, 23, 24(肩、腰)
- ランジ: 23, 24, 25, 26, 27, 28(腰、膝、足首)
- グルートブリッジ: 23, 24, 25, 26(腰、膝)

### 14.2 スキーマ変更手順

#### 14.2.1 新しいカラムの追加

```bash
# スキーマ定義ファイルの作成
cat > new_schema.json << EOF
[
  {"name": "session_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "user_id_hash", "type": "STRING", "mode": "REQUIRED"},
  ...
  {"name": "new_column", "type": "STRING", "mode": "NULLABLE", 
   "description": "新しいカラム"}
]
EOF

# スキーマの更新
bq update fitness_analytics.training_sessions new_schema.json
```

#### 14.2.2 互換性のない変更

**警告**: BigQueryでは以下の変更は不可
- カラムの削除
- カラムのデータ型変更
- REQUIREDからNULLABLEへの変更(逆は可能)

**回避策**: 新しいテーブルを作成してデータを移行

```bash
# 1. 新テーブル作成
bq mk --table fitness_analytics.training_sessions_v2 new_schema.json

# 2. データ移行
bq query --use_legacy_sql=false \
  'INSERT INTO fitness_analytics.training_sessions_v2
   SELECT 
     session_id,
     user_id_hash,
     exercise_id,
     -- 新しいスキーマに合わせてフィールドをマッピング
     CAST(old_field AS STRING) as new_field
   FROM fitness_analytics.training_sessions'

# 3. 古いテーブル削除
bq rm -f -t fitness_analytics.training_sessions

# 4. テーブル名変更
bq cp fitness_analytics.training_sessions_v2 fitness_analytics.training_sessions
bq rm -f -t fitness_analytics.training_sessions_v2
```

### 14.3 参考リンク

#### 14.3.1 公式ドキュメント

- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [BigQuery Cost Optimization](https://cloud.google.com/bigquery/docs/best-practices-costs)
- [BigQuery Security](https://cloud.google.com/bigquery/docs/best-practices-security)
- [Cloud IAM Overview](https://cloud.google.com/iam/docs/overview)
- [Cloud KMS Documentation](https://cloud.google.com/kms/docs)

#### 14.3.2 GDPRコンプライアンス

- [GDPR Official Text](https://gdpr-info.eu/)
- [EDPB Guidelines](https://edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en)
- [Google Cloud GDPR Resource Center](https://cloud.google.com/privacy/gdpr)

#### 14.3.3 内部ドキュメント

- 要件定義書 v3.3
- プロジェクト懸念点分析 v1.0
- システムアーキテクチャ設計書 v3.2
- Firestoreデータベース設計書 v3.3
- プライバシーポリシー v3.1
- 利用規約 v3.2
- セキュリティポリシー v1.0
- データ処理記録(ROPA) v1.0

### 14.4 用語集

| 用語 | 説明 |
|-----|------|
| **GDPR** | 一般データ保護規則。EU域内の個人データ保護に関する法規制 |
| **EDPB** | 欧州データ保護会議。GDPR実施のためのガイドラインを発行 |
| **仮名化** | 個人データを直接特定できないように処理すること(GDPR第4条5項) |
| **匿名化** | 個人を特定できる情報を完全に削除すること |
| **パーティショニング** | テーブルを日付や時刻で分割する機能 |
| **クラスタリング** | テーブル内のデータを特定のカラムで整理する機能 |
| **DLQ** | Dead Letter Queue。処理失敗したメッセージを保持する仕組み |
| **CMEK** | Customer-Managed Encryption Keys。顧客管理の暗号鍵 |
| **IAM** | Identity and Access Management。アクセス制御システム |
| **RTO** | Recovery Time Objective。目標復旧時間 |
| **RPO** | Recovery Point Objective。目標復旧時点 |
| **DAU** | Daily Active Users。日次アクティブユーザー数 |
| **WAU** | Weekly Active Users。週次アクティブユーザー数 |
| **MAU** | Monthly Active Users。月次アクティブユーザー数 |

### 14.5 変更履歴

| バージョン | 日付 | 変更内容 | 担当者 |
|-----------|------|---------|--------|
| v3.3 | 2025-11-24 | プロジェクト懸念点分析v1.0に基づく更新 | Backend Engineer |
| - | - | コスト予測の現実化と監視強化(懸念点#8対応) | - |
| - | - | 仮名化処理の耐障害性向上(懸念点#4対応) | - |
| - | - | バックアップとDR計画の追加(懸念点#16対応) | - |
| - | - | IAMとセキュリティの強化 | - |
| - | - | pseudonymization_logテーブルの追加 | - |
| v3.2 | 2025-11-23 | 初版作成 | Backend Engineer |
| - | - | 要件定義書v3.2との整合性確保 | - |
| - | - | GDPRコンプライアンス設計追加 | - |
| - | - | データパイプライン設計詳細化 | - |

### 14.6 レビューチェックリスト

#### 14.6.1 機能要件の網羅性

- [x] FR-028: 骨格座標データ収集のテーブル設計完了
- [x] FR-029: セッションメタデータ収集のテーブル設計完了
- [x] FR-025: データ削除権の実装設計完了
- [x] FR-027: データアクセス権とポータビリティ権の実装設計完了

#### 14.6.2 法的要件の充足

- [x] GDPR第6条1項(a)(b)(f): 法的根拠の明確化
- [x] GDPR第5条1項(e): データ保存期間の自動管理設計
- [x] GDPR第17条: 削除権の実装設計(論理削除+物理削除)
- [x] GDPR第15条・20条: アクセス権・ポータビリティ権の実装設計
- [x] プライバシーポリシーv3.1との整合性確認

#### 14.6.3 セキュリティ要件

- [x] ユーザーIDの仮名化処理実装(SHA-256)
- [x] アクセス制御(IAM)の設計
- [x] データ暗号化(TLS 1.3, AES-256)
- [x] 監査ログの有効化
- [x] CMEK実装計画(Phase 2以降)

#### 14.6.4 パフォーマンス要件

- [x] パーティショニング戦略の設計
- [x] クラスタリング戦略の設計
- [x] 集計テーブルの設計
- [x] クエリ最適化ガイドラインの策定

#### 14.6.5 コスト要件

- [x] MVP期のコスト見積もり($0.11/月)
- [x] Phase 3のコスト見積もり($79.80/月)
- [x] コスト監視とアラートの設定
- [x] コスト最適化戦略の策定
- [x] 四半期ごとのコスト見直しプロセス

#### 14.6.6 懸念点対応

- [x] 懸念点#4: BigQuery仮名化処理の耐障害性向上(リトライ+DLQ)
- [x] 懸念点#8: コスト予測の現実化と監視強化
- [x] 懸念点#16: バックアップとDR計画の策定
- [x] 懸念点#6, #11: ML移行準備の具体化

---

## まとめ

### 実現できること

✅ **データ分析基盤**: トレーニングデータの統計分析と可視化  
✅ **ML学習準備**: 将来のカスタムMLモデル開発のためのデータ蓄積(Phase 4)  
✅ **GDPR完全準拠**: プライバシーポリシーv3.1に完全準拠した設計  
✅ **低コスト運用**: MVP期で月額$0.11の想定コスト  
✅ **耐障害性**: 仮名化処理の失敗に対する自動リトライとDLQ  
✅ **スケーラブル**: Phase 3以降の拡大に対応可能な設計  
✅ **セキュア**: 仮名化、暗号化、アクセス制御、監査ログの実装  
✅ **バックアップ**: 日次スナップショットとRTO 24時間のDR対策

### プロジェクト懸念点への対応

| 懸念点 | 対応内容 | 実装状況 |
|-------|---------|---------|
| #4: 仮名化処理の失敗 | リトライロジック + DLQ + pseudonymization_log | ✅ 設計完了 |
| #8: コスト予測の楽観性 | 現実的な見積もり + 日次監視 + アラート | ✅ 設計完了 |
| #16: DR計画未策定 | 日次スナップショット + リストア手順 | ✅ 設計完了 |
| #6, #11: ML移行準備 | 33関節点データの完全記録 + 品質評価計画 | ✅ 設計完了 |

### 次のステップ

1. **Phase 1開始前(1週間以内)**:
   - BigQueryデータセットの作成
   - IAM権限の設定
   - Cloud Monitoringアラートの設定

2. **Phase 1開発中(0-2ヶ月)**:
   - データパイプラインの実装
   - 仮名化処理の実装とテスト
   - バックアップスクリプトの実装

3. **Phase 2開発中(2-4ヶ月)**:
   - 集計テーブルの実装
   - コスト監視の強化
   - CMEK実装の検討開始

4. **Phase 3以降(4ヶ月以降)**:
   - スロット予約の検討
   - VPCサービスコントロールの実装
   - ML移行のPoC開始

---

**ドキュメント完了**

このBigQuery設計書v3.3は、プロジェクト懸念点分析v1.0で指摘された課題に対応し、スケーラブルで安全、かつGDPR準拠のデータウェアハウスを実現します。
