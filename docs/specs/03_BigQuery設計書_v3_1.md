# BigQuery設計書 v3.1 (Part 1/3)

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.1  
**作成日**: 2025年11月21日  
**最終更新日**: 2025年11月21日  
**対象期間**: Phase 1-2 (0-4ヶ月)

---

## 📝 v3.1での主な変更点

### 法的要件との完全な整合性

✅ **要件定義書v3.1との整合**:
- 第9章(Firebase + GCP ハイブリッド構成)に完全準拠
- FR-028(骨格座標データ収集)、FR-029(セッションメタデータ収集)に対応
- MLデータセットの準備(Phase 3-4)に向けたデータ構造設計
- データ品質管理機能の実装

✅ **利用規約v3.1との整合**:
- 第1.2条: 用語定義に基づくテーブル命名
- 第3.3条: 医療機器でない旨をメタデータに反映
- データ保持期間の明確化

✅ **プライバシーポリシーv3.1との整合**:
- 第5条: データ収集項目の詳細定義
- 第8.3条: 仮名化処理の実装
- 第9条: GDPR権利行使(データエクスポート、削除)の技術的実装
- 第10条: データ保持期間に基づくパーティショニング設計

✅ **システムアーキテクチャ設計書v3.1との整合**:
- 第6.3節: BigQueryとFirestoreの連携設計
- 第8章: セキュリティ対策(Cloud IAM、暗号化)
- 第9.3節: データフローの具体化

✅ **Firestoreデータベース設計書v3.1との整合**:
- Firestoreからのデータエクスポート構造
- データモデルの一貫性
- 仮名化後のデータ構造

---

## 目次

### Part 1: 概要〜データモデル
1. [概要](#1-概要)
2. [BigQuery設計原則](#2-bigquery設計原則)
3. [データセット構造](#3-データセット構造)
4. [テーブル設計](#4-テーブル設計)

### Part 2: セキュリティ〜運用
5. [セキュリティ設計](#5-セキュリティ設計)
6. [パーティショニングとクラスタリング](#6-パーティショニングとクラスタリング)
7. [データ取り込み](#7-データ取り込み)
8. [データ品質管理](#8-データ品質管理)

### Part 3: 分析〜運用
9. [分析クエリ](#9-分析クエリ)
10. [ML準備](#10-ml準備)
11. [コスト最適化](#11-コスト最適化)
12. [運用監視](#12-運用監視)

---

## 1. 概要

### 1.1 ドキュメントの目的

本ドキュメントは、BigQueryデータウェアハウスの設計を定義し、以下を明確にします:

1. **データセット構造**: データの論理的な構成
2. **テーブル設計**: 各テーブルのスキーマ定義
3. **セキュリティ**: Cloud IAMとデータアクセス制御
4. **データ取り込み**: Firestoreからのデータ連携
5. **分析**: ダッシュボードとレポート
6. **ML準備**: Phase 3-4でのML移行に向けたデータ準備
7. **運用**: コスト管理、監視、最適化

### 1.2 参照ドキュメント

| ドキュメント | バージョン | 参照箇所 |
|------------|----------|---------|
| **要件定義書** | v3.1 | 第9章(Firebase + GCP ハイブリッド構成) |
| **利用規約** | v3.1 | 第1.2条(用語定義) |
| **プライバシーポリシー** | v3.1 | 第5条(データ収集)、第8条(セキュリティ)、第9条(GDPR)、第10条(保持期間) |
| **システムアーキテクチャ設計書** | v3.1 | 第6.3節、第8章、第9.3節 |
| **Firestoreデータベース設計書** | v3.1 | 第3章(コレクション構造)、第4章(データモデル) |

### 1.3 BigQueryの役割

**本プロジェクトにおける位置づけ**(要件定義書v3.1第9.2節):

```
Firestore (リアルタイム) → BigQuery (分析・ML)
         ↓                      ↓
   モバイルアプリ           Looker Studio
```

**主な用途**:

| 用途 | 説明 | Phase |
|-----|------|-------|
| **データ分析** | トレーニングデータの集計・可視化 | Phase 1-2 |
| **ダッシュボード** | Looker Studioでの可視化 | Phase 1-2 |
| **ML準備** | トレーニングデータセットの構築 | Phase 3 |
| **MLモデル訓練** | BigQuery MLまたはVertex AIでの訓練 | Phase 4 |
| **データ保管** | 長期的なデータ保存 | 全Phase |

### 1.4 システム要件

#### 1.4.1 パフォーマンス要件

| 項目 | 要件 | 根拠 |
|-----|------|------|
| **クエリ応答時間** | 5秒以内 | 要件定義書v3.1 NFR-001 |
| **データ更新頻度** | 1日1回(バッチ) | Phase 1-2は分析用途のみ |
| **データ保持期間** | 2年間 | プライバシーポリシーv3.1第10.1条 |
| **同時クエリ数** | 10クエリ | MVP期間中の想定ユーザー数 |

#### 1.4.2 セキュリティ要件

| 項目 | 要件 | 根拠 |
|-----|------|------|
| **アクセス制御** | Cloud IAMによる役割ベース | プライバシーポリシーv3.1第8.2条 |
| **暗号化(保存時)** | AES-256 | プライバシーポリシーv3.1第8.4条 |
| **暗号化(転送時)** | TLS 1.3 | プライバシーポリシーv3.1第8.4条 |
| **仮名化** | ユーザーIDのハッシュ化 | プライバシーポリシーv3.1第8.3条 |
| **監査ログ** | すべてのアクセスをCloud Loggingで記録 | 要件定義書v3.1 NFR-017 |

#### 1.4.3 コスト要件

**MVP期間中の想定コスト**(要件定義書v3.1第9.4節):

| 項目 | 無料枠 | 想定使用量 | 想定コスト |
|-----|--------|-----------|-----------|
| **Storage** | 10GB | 5GB | $0 |
| **Query** | 1TB/月 | 100GB/月 | $0 |
| **Streaming Insert** | 未使用 | 未使用 | $0 |
| **合計** | - | - | **$0/月** |

**Phase 3以降の想定**: 月額$20-50

---

## 2. BigQuery設計原則

### 2.1 データウェアハウス設計原則

#### 2.1.1 スター型スキーマ vs 非正規化

**本プロジェクトのアプローチ**:

Phase 1-2では**非正規化**を採用:
- 理由: データ量が少なく、クエリのシンプルさを優先
- 方針: Firestoreのデータ構造をほぼそのまま取り込み

Phase 3以降で**部分的にスター型**へ移行:
- ファクトテーブル: `fact_training_sessions`
- ディメンションテーブル: `dim_users`, `dim_exercises`

**現在の設計方針**:

```sql
-- ❌ Phase 1-2では採用しない(複雑)
-- ファクトテーブル
fact_sessions (session_id, user_id, exercise_id, date, score)
-- ディメンションテーブル
dim_users (user_id, name, age)
dim_exercises (exercise_id, name, category)

-- ✅ Phase 1-2で採用(シンプル)
-- 非正規化テーブル
sessions (
  session_id,
  user_id,
  user_hashed,        -- 仮名化
  exercise_id,
  exercise_name,      -- 非正規化
  exercise_category,  -- 非正規化
  date,
  reference_score
)
```

#### 2.1.2 プライバシーバイデザイン

**GDPR第25条準拠**(プライバシーポリシーv3.1第8条):

| 原則 | 実装方法 | テーブル例 |
|-----|---------|-----------|
| **データ最小化** | 必要最小限のカラムのみ定義 | 映像データは保存しない |
| **仮名化** | ユーザーIDをSHA-256でハッシュ化 | `user_hashed` カラム |
| **目的制限** | 各テーブルに利用目的を明記 | テーブルコメント |
| **保存期間制限** | パーティション削除で自動削除 | 2年後に自動削除 |
| **アクセス制御** | Cloud IAMで厳格に制御 | 最小権限の原則 |

#### 2.1.3 データ品質原則

**データ品質の4つの軸**:

| 軸 | 定義 | 実装 |
|----|-----|------|
| **完全性** | 必須フィールドがすべて存在 | NOT NULL制約、バリデーション |
| **正確性** | データが正しい | 範囲チェック、整合性チェック |
| **一貫性** | データ形式が統一 | 型定義、Enum定義 |
| **適時性** | データが最新 | 日次バッチでの更新 |

### 2.2 命名規則

#### 2.2.1 データセット名

- **小文字**: `fitness_app_prod`
- **環境サフィックス**: `_dev`, `_staging`, `_prod`
- **目的を明示**: `ml_training_data`

```
fitness_app_dev       # 開発環境
fitness_app_staging   # ステージング環境
fitness_app_prod      # 本番環境
ml_training_data      # ML用データセット(Phase 3)
```

#### 2.2.2 テーブル名

- **小文字**: `training_sessions`
- **スネークケース**: `user_profiles` (not `userProfiles`)
- **プレフィックス**:
  - `fact_`: ファクトテーブル(Phase 3以降)
  - `dim_`: ディメンションテーブル(Phase 3以降)
  - `stg_`: ステージングテーブル
  - `tmp_`: 一時テーブル

#### 2.2.3 カラム名

- **スネークケース**: `user_id`, `created_at`
- **明確な命名**: `rep_count` (not `reps`)
- **ブール値**: `is_deleted` (not `deleted`)
- **日時**: `created_at`, `updated_at`, `deleted_at`
- **仮名化**: `user_hashed` (ハッシュ化されたID)

#### 2.2.4 パーティション命名

- **日付パーティション**: `$yyyymmdd`
- **範囲パーティション**: 使用しない(Phase 1-2)

---

## 3. データセット構造

### 3.1 全体構造図

```
BigQuery Project: ai-fitness-app-project
│
├── fitness_app_prod/                    # 本番環境データセット
│   ├── users                            # ユーザー情報
│   ├── training_sessions                # トレーニングセッション
│   ├── pose_keypoints                   # 骨格座標データ(Phase 3)
│   ├── exercises                        # 種目マスター
│   ├── subscriptions                    # サブスクリプション
│   ├── consent_logs                     # 同意記録
│   ├── export_requests                  # データエクスポート要求
│   └── deletion_logs                    # 削除ログ
│
├── fitness_app_staging/                 # ステージング環境
│   └── (同上)
│
├── fitness_app_dev/                     # 開発環境
│   └── (同上)
│
└── ml_training_data/                    # ML用データセット(Phase 3)
    ├── training_dataset                 # 訓練データ
    ├── validation_dataset               # 検証データ
    └── test_dataset                     # テストデータ
```

### 3.2 データセット詳細

#### 3.2.1 fitness_app_prod

**概要**:
- 本番環境のメインデータセット
- Firestoreからの日次バッチでデータ取り込み
- Looker Studioでの可視化に使用

**設定**:

| 項目 | 設定値 |
|-----|--------|
| **Location** | asia-northeast1 (東京) |
| **Default table expiration** | なし(テーブルごとに設定) |
| **Encryption** | Google-managed(AES-256) |
| **Access control** | Cloud IAM |

**Cloud IAMロール**:

| ロール | 権限 | 対象者 |
|-------|------|--------|
| **BigQuery Data Viewer** | SELECT | データアナリスト |
| **BigQuery Data Editor** | SELECT, INSERT, UPDATE, DELETE | バックエンドエンジニア |
| **BigQuery Admin** | すべて | プロジェクトオーナー |

#### 3.2.2 ml_training_data (Phase 3)

**概要**:
- ML訓練用のデータセット
- `fitness_app_prod`からの前処理済みデータ
- 訓練/検証/テストに分割

**Phase 3で作成予定**:
- 現時点では未作成
- 10,000セッション以上のデータが蓄積された時点で作成

---

## 4. テーブル設計

### 4.1 テーブル一覧

| テーブル名 | 説明 | データソース | 更新頻度 | パーティション |
|-----------|------|-------------|----------|--------------|
| `users` | ユーザー情報 | Firestore `users` | 日次 | `created_at` |
| `training_sessions` | トレーニングセッション | Firestore `sessions` | 日次 | `started_at` |
| `pose_keypoints` | 骨格座標データ(Phase 3) | Firestore `pose_keypoints` | 日次 | `created_at` |
| `exercises` | 種目マスター | Firestore `exercises` | 週次 | なし |
| `subscriptions` | サブスクリプション | Firestore `users.subscription` | 日次 | `created_at` |
| `consent_logs` | 同意記録 | Firestore `users.consentHistory` | 日次 | `consented_at` |
| `export_requests` | データエクスポート要求 | Firestore `export_requests` | 日次 | `requested_at` |
| `deletion_logs` | 削除ログ | Firestore削除処理 | 日次 | `deleted_at` |

### 4.2 users テーブル

**概要**:
- ユーザーのプロフィール情報
- Firestore `users` コレクションからの取り込み
- **重要**: `userId`は仮名化して保存

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.users` (
  -- 識別子(仮名化)
  user_hashed STRING NOT NULL OPTIONS(description="SHA-256ハッシュ化されたユーザーID"),
  
  -- プロフィール情報
  age_range STRING OPTIONS(description="年齢層(20-29, 30-39等)。プライバシーポリシーv3.1第5.1条"),
  gender STRING OPTIONS(description="性別(male/female/other/prefer_not_to_say)"),
  fitness_level STRING OPTIONS(description="フィットネスレベル(beginner/intermediate/advanced)"),
  
  -- サブスクリプション情報
  subscription_status STRING NOT NULL OPTIONS(description="サブスクリプション状態(trial/active/canceled/expired)"),
  subscription_plan STRING OPTIONS(description="プラン(free_trial/monthly)"),
  
  -- 同意情報
  data_collection_consent BOOLEAN NOT NULL OPTIONS(description="データ収集の同意"),
  analytics_consent BOOLEAN OPTIONS(description="分析利用の同意"),
  
  -- メタデータ
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="更新日時(UTC)"),
  last_login_at TIMESTAMP OPTIONS(description="最終ログイン日時(UTC)"),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE OPTIONS(description="削除フラグ"),
  deleted_at TIMESTAMP OPTIONS(description="削除日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(created_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, subscription_status
OPTIONS(
  description="ユーザープロフィール情報。プライバシーポリシーv3.1第5.1条に基づき仮名化して保存。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "2years")]
);
```

**フィールド詳細**:

| フィールド | 型 | NULL | 説明 | 法的根拠 |
|-----------|-----|------|------|---------|
| `user_hashed` | STRING | NO | SHA-256ハッシュ化されたユーザーID | プライバシーポリシーv3.1第8.3条 |
| `age_range` | STRING | YES | 年齢層(具体的な年齢は保存しない) | データ最小化の原則 |
| `gender` | STRING | YES | 性別 | プライバシーポリシーv3.1第5.1条 |
| `fitness_level` | STRING | YES | フィットネスレベル | - |
| `subscription_status` | STRING | NO | サブスクリプション状態 | 利用規約v3.1第6条 |
| `subscription_plan` | STRING | YES | プラン | 利用規約v3.1第6条 |
| `data_collection_consent` | BOOLEAN | NO | データ収集の同意 | GDPR第7条 |
| `analytics_consent` | BOOLEAN | YES | 分析利用の同意 | GDPR第7条 |
| `created_at` | TIMESTAMP | NO | 作成日時(UTC) | - |
| `updated_at` | TIMESTAMP | NO | 更新日時(UTC) | - |
| `last_login_at` | TIMESTAMP | YES | 最終ログイン日時 | - |
| `is_deleted` | BOOLEAN | NO | 削除フラグ | GDPR第17条 |
| `deleted_at` | TIMESTAMP | YES | 削除日時 | GDPR第17条 |
| `partition_date` | DATE | NO | パーティションキー | - |

**仮名化処理**:

```javascript
// Firestoreからの取り込み時に実行
const crypto = require('crypto');

function pseudonymizeUserId(userId) {
  return crypto
    .createHash('sha256')
    .update(userId + process.env.PSEUDONYMIZATION_SALT)
    .digest('hex');
}

// 例:
// userId: "abc123def456" 
// → user_hashed: "8f3e4b2c1a9d7e6f5c4b3a2d1e9f8c7b6a5d4e3f2c1b9a8d7e6f5c4b3a2d1e9f"
```

**パーティション設計**:
- パーティションキー: `partition_date`(日付)
- 保持期間: 2年間(プライバシーポリシーv3.1第10.1条)
- 自動削除: 2年経過後に自動削除

**クラスタリング**:
- `user_hashed`: ユーザー単位のクエリ最適化
- `subscription_status`: サブスクリプション分析

### 4.3 training_sessions テーブル

**概要**:
- トレーニングセッションの記録
- Firestore `sessions` コレクションからの取り込み
- ダッシュボードのメインデータソース

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.training_sessions` (
  -- 識別子
  session_id STRING NOT NULL OPTIONS(description="セッションID"),
  user_hashed STRING NOT NULL OPTIONS(description="SHA-256ハッシュ化されたユーザーID"),
  
  -- 種目情報(非正規化)
  exercise_id STRING NOT NULL OPTIONS(description="種目ID"),
  exercise_name STRING NOT NULL OPTIONS(description="種目名"),
  exercise_category STRING NOT NULL OPTIONS(description="種目カテゴリ(bodyweight/equipment)"),
  
  -- セッション情報
  started_at TIMESTAMP NOT NULL OPTIONS(description="開始日時(UTC)"),
  ended_at TIMESTAMP OPTIONS(description="終了日時(UTC)"),
  duration_seconds INT64 OPTIONS(description="実行時間(秒)"),
  
  -- セット・レップ情報
  target_sets INT64 NOT NULL OPTIONS(description="目標セット数"),
  completed_sets INT64 OPTIONS(description="完了セット数"),
  target_reps INT64 NOT NULL OPTIONS(description="目標レップ数"),
  completed_reps INT64 OPTIONS(description="完了レップ数"),
  
  -- 参考スコア(利用規約v3.1第1.2条)
  reference_scores ARRAY<STRUCT<
    set_number INT64 OPTIONS(description="セット番号"),
    rep_number INT64 OPTIONS(description="レップ番号"),
    score FLOAT64 OPTIONS(description="参考スコア(0-100)"),
    timestamp TIMESTAMP OPTIONS(description="タイムスタンプ")
  >> OPTIONS(description="各レップの参考スコア"),
  average_score FLOAT64 OPTIONS(description="平均参考スコア"),
  
  -- フィードバック
  voice_feedback_count INT64 OPTIONS(description="音声フィードバック回数"),
  
  -- 完了状態
  is_completed BOOLEAN NOT NULL DEFAULT FALSE OPTIONS(description="完了フラグ"),
  completion_rate FLOAT64 OPTIONS(description="完了率(0-1)"),
  
  -- メタデータ
  app_version STRING OPTIONS(description="アプリバージョン"),
  device_model STRING OPTIONS(description="デバイスモデル(例: iPhone 14 Pro)"),
  os_version STRING OPTIONS(description="OSバージョン(例: iOS 17.1)"),
  
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="更新日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(started_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, exercise_id, started_at
OPTIONS(
  description="トレーニングセッション記録。プライバシーポリシーv3.1第5.2条に基づきメタデータを記録。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "2years")]
);
```

**フィールド詳細**:

| フィールド | 型 | NULL | 説明 | 法的根拠 |
|-----------|-----|------|------|---------|
| `session_id` | STRING | NO | セッションID | - |
| `user_hashed` | STRING | NO | 仮名化されたユーザーID | プライバシーポリシーv3.1第8.3条 |
| `exercise_id` | STRING | NO | 種目ID | - |
| `exercise_name` | STRING | NO | 種目名(非正規化) | - |
| `exercise_category` | STRING | NO | 種目カテゴリ | - |
| `started_at` | TIMESTAMP | NO | 開始日時 | - |
| `ended_at` | TIMESTAMP | YES | 終了日時 | - |
| `duration_seconds` | INT64 | YES | 実行時間(秒) | - |
| `target_sets` | INT64 | NO | 目標セット数 | - |
| `completed_sets` | INT64 | YES | 完了セット数 | - |
| `target_reps` | INT64 | NO | 目標レップ数 | - |
| `completed_reps` | INT64 | YES | 完了レップ数 | - |
| `reference_scores` | ARRAY<STRUCT> | YES | 各レップの参考スコア | 利用規約v3.1第1.2条 |
| `average_score` | FLOAT64 | YES | 平均参考スコア | - |
| `voice_feedback_count` | INT64 | YES | 音声フィードバック回数 | - |
| `is_completed` | BOOLEAN | NO | 完了フラグ | - |
| `completion_rate` | FLOAT64 | YES | 完了率 | - |
| `app_version` | STRING | YES | アプリバージョン | プライバシーポリシーv3.1第5.2条 |
| `device_model` | STRING | YES | デバイスモデル | プライバシーポリシーv3.1第5.2条 |
| `os_version` | STRING | YES | OSバージョン | プライバシーポリシーv3.1第5.2条 |
| `created_at` | TIMESTAMP | NO | 作成日時 | - |
| `updated_at` | TIMESTAMP | NO | 更新日時 | - |
| `partition_date` | DATE | NO | パーティションキー | - |

**パーティション設計**:
- パーティションキー: `partition_date`(started_atから生成)
- 保持期間: 2年間
- 自動削除: 2年経過後に自動削除

**クラスタリング**:
- `user_hashed`: ユーザー単位のクエリ
- `exercise_id`: 種目別分析
- `started_at`: 時系列分析

### 4.4 pose_keypoints テーブル (Phase 3)

**概要**:
- 骨格座標データ(Phase 3で実装)
- ML訓練用のデータ
- FR-028(骨格座標データ収集)に対応

**Phase 1-2では未実装**:
- データ量が大きいため、Phase 3で実装
- 10,000セッション以上のデータが蓄積された時点で実装

**想定スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.pose_keypoints` (
  -- 識別子
  keypoint_id STRING NOT NULL OPTIONS(description="キーポイントデータID"),
  session_id STRING NOT NULL OPTIONS(description="セッションID"),
  user_hashed STRING NOT NULL OPTIONS(description="仮名化されたユーザーID"),
  
  -- キーポイントデータ
  frame_number INT64 NOT NULL OPTIONS(description="フレーム番号"),
  timestamp_ms INT64 NOT NULL OPTIONS(description="タイムスタンプ(ミリ秒)"),
  keypoints ARRAY<STRUCT<
    landmark STRING OPTIONS(description="ランドマーク名(例: LEFT_SHOULDER)"),
    x FLOAT64 OPTIONS(description="X座標(正規化: 0-1)"),
    y FLOAT64 OPTIONS(description="Y座標(正規化: 0-1)"),
    z FLOAT64 OPTIONS(description="Z座標(正規化)"),
    visibility FLOAT64 OPTIONS(description="可視性スコア(0-1)"),
    presence FLOAT64 OPTIONS(description="存在スコア(0-1)")
  >> OPTIONS(description="33個のキーポイント"),
  
  -- メタデータ
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー")
)
PARTITION BY partition_date
CLUSTER BY session_id, frame_number
OPTIONS(
  description="骨格座標データ(Phase 3)。プライバシーポリシーv3.1第5.1条に基づき収集。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "2years"), ("phase", "3")]
);
```

**Phase 3での実装時の注意点**:
- データサイズが大きいため、コスト管理が重要
- パーティション + クラスタリングで効率的なクエリ実行
- 必要に応じてBigQuery Storage APIを使用

### 4.5 exercises テーブル

**概要**:
- 種目マスターデータ
- Firestore `exercises` コレクションからの取り込み
- 更新頻度は低い(週次)

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.exercises` (
  -- 識別子
  exercise_id STRING NOT NULL OPTIONS(description="種目ID"),
  
  -- 基本情報
  exercise_name STRING NOT NULL OPTIONS(description="種目名(日本語)"),
  exercise_name_en STRING OPTIONS(description="種目名(英語)"),
  category STRING NOT NULL OPTIONS(description="カテゴリ(bodyweight/equipment)"),
  difficulty STRING NOT NULL OPTIONS(description="難易度(beginner/intermediate/advanced)"),
  
  -- 説明
  description STRING OPTIONS(description="種目の説明"),
  instructions ARRAY<STRING> OPTIONS(description="実施手順"),
  
  -- 目標設定
  default_sets INT64 NOT NULL OPTIONS(description="デフォルトセット数"),
  default_reps INT64 NOT NULL OPTIONS(description="デフォルトレップ数"),
  default_rest_seconds INT64 OPTIONS(description="デフォルト休憩時間(秒)"),
  
  -- MediaPipe設定
  mediapipe_config STRUCT<
    key_landmarks ARRAY<STRING> OPTIONS(description="重要なランドマーク"),
    angle_checks ARRAY<STRUCT<
      name STRING,
      points ARRAY<STRING>,
      ideal_range STRUCT<min FLOAT64, max FLOAT64>
    >> OPTIONS(description="角度チェック"),
    form_rules ARRAY<STRING> OPTIONS(description="フォームルール")
  > OPTIONS(description="MediaPipe Pose設定"),
  
  -- メタデータ
  is_active BOOLEAN NOT NULL DEFAULT TRUE OPTIONS(description="有効フラグ"),
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="更新日時(UTC)")
)
OPTIONS(
  description="種目マスターデータ。MediaPipe Pose設定を含む。",
  labels=[("env", "prod"), ("pii", "false")]
);
```

**インデックス**:
- Primary Key: `exercise_id`
- Secondary Index: `category`, `difficulty`

**Note**: パーティションは不要(マスターデータのため)

---

**Part 1の終わり**

Part 2では、以下の内容を説明します:
- セキュリティ設計
- パーティショニングとクラスタリング
- データ取り込み
- データ品質管理# BigQuery設計書 v3.1 (Part 2/3)

**Part 2の内容**: セキュリティ設計、パーティショニング、データ取り込み、データ品質管理

---

## 4.6 subscriptions テーブル

**概要**:
- サブスクリプション情報
- Firestore `users.subscription` からの取り込み
- 課金システムとの連携

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.subscriptions` (
  -- 識別子
  subscription_id STRING NOT NULL OPTIONS(description="サブスクリプションID"),
  user_hashed STRING NOT NULL OPTIONS(description="仮名化されたユーザーID"),
  
  -- サブスクリプション情報
  plan STRING NOT NULL OPTIONS(description="プラン(free_trial/monthly)"),
  status STRING NOT NULL OPTIONS(description="状態(trial/active/canceled/expired)"),
  
  -- 期間
  start_date DATE NOT NULL OPTIONS(description="開始日"),
  end_date DATE OPTIONS(description="終了日(nullの場合は無期限)"),
  trial_end_date DATE OPTIONS(description="トライアル終了日"),
  
  -- 課金情報(プライバシーポリシーv3.1第5.3条)
  payment_method STRING OPTIONS(description="決済方法(stripe/apple_pay/google_pay)"),
  last_payment_date DATE OPTIONS(description="最終決済日"),
  next_payment_date DATE OPTIONS(description="次回決済日"),
  
  -- キャンセル情報
  canceled_at TIMESTAMP OPTIONS(description="キャンセル日時"),
  cancellation_reason STRING OPTIONS(description="キャンセル理由"),
  
  -- メタデータ
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="更新日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(created_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, status
OPTIONS(
  description="サブスクリプション情報。利用規約v3.1第6条に基づく。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "7years")]
);
```

**保持期間**: 7年間(課金履歴のため、2年より長期保存)

### 4.7 consent_logs テーブル

**概要**:
- ユーザーの同意履歴
- GDPR第7条対応
- Firestore `users.consentHistory` からの取り込み

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.consent_logs` (
  -- 識別子
  consent_id STRING NOT NULL OPTIONS(description="同意ログID"),
  user_hashed STRING NOT NULL OPTIONS(description="仮名化されたユーザーID"),
  
  -- 同意情報
  consent_type STRING NOT NULL OPTIONS(description="同意種別(terms/privacy/data_collection/analytics)"),
  consent_version STRING NOT NULL OPTIONS(description="同意したバージョン(例: v3.1)"),
  is_consented BOOLEAN NOT NULL OPTIONS(description="同意フラグ"),
  
  -- 同意取得方法
  consent_method STRING OPTIONS(description="同意取得方法(explicit_checkbox/implicit_continue)"),
  consent_text STRING OPTIONS(description="同意時に表示されたテキスト(ハッシュ値)"),
  
  -- タイムスタンプ
  consented_at TIMESTAMP NOT NULL OPTIONS(description="同意日時(UTC)"),
  
  -- メタデータ
  ip_address_hashed STRING OPTIONS(description="仮名化されたIPアドレス"),
  user_agent STRING OPTIONS(description="ユーザーエージェント"),
  app_version STRING OPTIONS(description="アプリバージョン"),
  
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(consented_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, consent_type, consented_at
OPTIONS(
  description="同意履歴ログ。GDPR第7条準拠。プライバシーポリシーv3.1第9.1条。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "7years")]
);
```

**保持期間**: 7年間(法的証拠として長期保存)

### 4.8 export_requests テーブル

**概要**:
- データエクスポート要求の記録
- GDPR第20条(データポータビリティ)対応
- FR-027対応

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.export_requests` (
  -- 識別子
  request_id STRING NOT NULL OPTIONS(description="要求ID"),
  user_hashed STRING NOT NULL OPTIONS(description="仮名化されたユーザーID"),
  
  -- 要求情報
  requested_at TIMESTAMP NOT NULL OPTIONS(description="要求日時(UTC)"),
  status STRING NOT NULL OPTIONS(description="状態(pending/processing/completed/failed)"),
  
  -- エクスポート情報
  export_format STRING NOT NULL OPTIONS(description="エクスポート形式(json/csv)"),
  export_scope ARRAY<STRING> OPTIONS(description="エクスポート対象(profile/sessions/all)"),
  
  -- 処理情報
  processed_at TIMESTAMP OPTIONS(description="処理完了日時"),
  download_url STRING OPTIONS(description="ダウンロードURL(Cloud Storage署名付きURL)"),
  download_expires_at TIMESTAMP OPTIONS(description="ダウンロードURL有効期限"),
  downloaded_at TIMESTAMP OPTIONS(description="ダウンロード日時"),
  
  -- エラー情報
  error_message STRING OPTIONS(description="エラーメッセージ"),
  
  -- メタデータ
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  updated_at TIMESTAMP NOT NULL OPTIONS(description="更新日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(requested_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, status
OPTIONS(
  description="データエクスポート要求記録。GDPR第20条対応。プライバシーポリシーv3.1第9.5条。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "2years")]
);
```

### 4.9 deletion_logs テーブル

**概要**:
- データ削除の記録
- GDPR第17条(忘れられる権利)対応
- FR-025対応

**スキーマ**:

```sql
CREATE TABLE `fitness_app_prod.deletion_logs` (
  -- 識別子
  deletion_id STRING NOT NULL OPTIONS(description="削除ログID"),
  user_hashed STRING NOT NULL OPTIONS(description="仮名化されたユーザーID"),
  
  -- 削除情報
  deleted_at TIMESTAMP NOT NULL OPTIONS(description="削除日時(UTC)"),
  deletion_reason STRING NOT NULL OPTIONS(description="削除理由(user_request/account_closure/data_retention)"),
  deletion_scope STRING NOT NULL OPTIONS(description="削除範囲(full/partial)"),
  
  -- 削除されたデータ
  deleted_records ARRAY<STRUCT<
    table_name STRING OPTIONS(description="テーブル名"),
    record_count INT64 OPTIONS(description="削除レコード数"),
    deletion_method STRING OPTIONS(description="削除方法(hard_delete/soft_delete)")
  >> OPTIONS(description="削除されたレコードの詳細"),
  
  -- メタデータ
  requested_by STRING OPTIONS(description="要求者(user/admin/system)"),
  executed_by STRING OPTIONS(description="実行者(system_service_account)"),
  
  created_at TIMESTAMP NOT NULL OPTIONS(description="作成日時(UTC)"),
  
  -- パーティション用カラム
  partition_date DATE NOT NULL OPTIONS(description="パーティションキー(deleted_atから生成)")
)
PARTITION BY partition_date
CLUSTER BY user_hashed, deleted_at
OPTIONS(
  description="データ削除ログ。GDPR第17条対応。プライバシーポリシーv3.1第9.6条。",
  labels=[("env", "prod"), ("pii", "pseudonymized"), ("retention", "7years")]
);
```

**保持期間**: 7年間(法的証拠として長期保存)

---

## 5. セキュリティ設計

### 5.1 Cloud IAMによるアクセス制御

**プライバシーポリシーv3.1第8.2条準拠**

#### 5.1.1 ロール設計

| ロール | 権限 | 付与対象 | 用途 |
|-------|------|---------|------|
| **BigQuery Admin** | すべて | プロジェクトオーナー | 管理者権限 |
| **BigQuery Data Editor** | SELECT, INSERT, UPDATE, DELETE | バックエンドサービスアカウント | データ取り込み |
| **BigQuery Data Viewer** | SELECT | データアナリスト、Looker Studio | データ参照 |
| **BigQuery Job User** | ジョブ実行 | すべてのユーザー | クエリ実行 |
| **BigQuery Read Session User** | Storage API読み取り | ML訓練ジョブ(Phase 3) | 大量データ読み取り |

#### 5.1.2 サービスアカウント設計

**1. データ取り込み用サービスアカウント**:

```
firebase-to-bigquery@ai-fitness-app.iam.gserviceaccount.com
```

**権限**:
- `roles/bigquery.dataEditor` on `fitness_app_prod` dataset
- `roles/bigquery.jobUser` on project

**使用箇所**:
- Cloud Functionsでのデータ取り込み処理

**2. Looker Studio用サービスアカウント**:

```
looker-studio@ai-fitness-app.iam.gserviceaccount.com
```

**権限**:
- `roles/bigquery.dataViewer` on `fitness_app_prod` dataset
- `roles/bigquery.jobUser` on project

**3. データ削除用サービスアカウント**:

```
data-deletion@ai-fitness-app.iam.gserviceaccount.com
```

**権限**:
- `roles/bigquery.dataEditor` on `fitness_app_prod` dataset
- GDPR権利行使用

#### 5.1.3 データセットレベルのアクセス制御

```sql
-- データセットレベルでのアクセス制御設定
-- fitness_app_prodデータセットに対して設定

-- 1. データアナリストに読み取り権限を付与
GRANT `roles/bigquery.dataViewer`
ON SCHEMA `fitness_app_prod`
TO "group:data-analysts@company.com";

-- 2. バックエンドサービスアカウントに編集権限を付与
GRANT `roles/bigquery.dataEditor`
ON SCHEMA `fitness_app_prod`
TO "serviceAccount:firebase-to-bigquery@ai-fitness-app.iam.gserviceaccount.com";
```

#### 5.1.4 テーブルレベルのアクセス制御

**機密性の高いテーブル**:

```sql
-- consent_logs と deletion_logs は管理者のみアクセス可能
GRANT `roles/bigquery.dataViewer`
ON TABLE `fitness_app_prod.consent_logs`
TO "group:admins@company.com";

GRANT `roles/bigquery.dataViewer`
ON TABLE `fitness_app_prod.deletion_logs`
TO "group:admins@company.com";
```

#### 5.1.5 列レベルのアクセス制御

**Phase 3以降で実装予定**:

```sql
-- 例: user_hashedカラムへのアクセス制限
CREATE OR REPLACE ROW ACCESS POLICY
  admin_only_user_hashed
ON `fitness_app_prod.users`
GRANT TO ("group:admins@company.com")
FILTER USING (TRUE);

CREATE OR REPLACE ROW ACCESS POLICY
  analyst_no_user_hashed
ON `fitness_app_prod.users`
GRANT TO ("group:data-analysts@company.com")
FILTER USING (user_hashed IS NULL);
```

### 5.2 暗号化

**プライバシーポリシーv3.1第8.4条準拠**

#### 5.2.1 保存時の暗号化

| 項目 | 設定 |
|-----|------|
| **暗号化方式** | AES-256 |
| **鍵管理** | Google-managed encryption keys(デフォルト) |
| **適用範囲** | すべてのテーブル、パーティション |

**注**: Phase 3以降でCustomer-managed encryption keys(CMEK)を検討

#### 5.2.2 転送時の暗号化

| 項目 | 設定 |
|-----|------|
| **プロトコル** | TLS 1.3 |
| **証明書** | Google管理 |
| **適用範囲** | すべてのBigQuery APIアクセス |

### 5.3 仮名化処理

**プライバシーポリシーv3.1第8.3条準拠**

#### 5.3.1 仮名化対象

| データ | 仮名化方法 | 保存場所 |
|-------|----------|---------|
| **ユーザーID** | SHA-256ハッシュ化 | `user_hashed` カラム |
| **IPアドレス** | SHA-256ハッシュ化 | `ip_address_hashed` カラム |
| **メールアドレス** | 保存しない | - |

#### 5.3.2 仮名化関数

**Cloud Functionsでの実装**:

```javascript
const crypto = require('crypto');

/**
 * ユーザーIDを仮名化
 * @param {string} userId - FirebaseユーザーID
 * @returns {string} - SHA-256ハッシュ値
 */
function pseudonymizeUserId(userId) {
  const salt = process.env.PSEUDONYMIZATION_SALT;
  if (!salt) {
    throw new Error('PSEUDONYMIZATION_SALT is not set');
  }
  
  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}

/**
 * IPアドレスを仮名化
 * @param {string} ipAddress - IPアドレス
 * @returns {string} - SHA-256ハッシュ値
 */
function pseudonymizeIpAddress(ipAddress) {
  const salt = process.env.PSEUDONYMIZATION_SALT;
  if (!salt) {
    throw new Error('PSEUDONYMIZATION_SALT is not set');
  }
  
  return crypto
    .createHash('sha256')
    .update(ipAddress + salt)
    .digest('hex');
}

// 使用例
const originalUserId = 'abc123def456';
const pseudonymizedUserId = pseudonymizeUserId(originalUserId);
// → '8f3e4b2c1a9d7e6f5c4b3a2d1e9f8c7b6a5d4e3f2c1b9a8d7e6f5c4b3a2d1e9f'
```

**BigQueryでの実装**(再仮名化が必要な場合):

```sql
-- BigQuery内での仮名化関数(Phase 3以降)
CREATE OR REPLACE FUNCTION `fitness_app_prod.pseudonymize_id`(id STRING, salt STRING)
RETURNS STRING
AS (
  TO_HEX(SHA256(CONCAT(id, salt)))
);

-- 使用例
SELECT
  pseudonymize_id(user_id, 'secret_salt') AS user_hashed,
  session_id,
  started_at
FROM `fitness_app_prod.training_sessions`;
```

#### 5.3.3 塩(Salt)の管理

**環境変数での管理**:

```bash
# Cloud Functionsの環境変数
PSEUDONYMIZATION_SALT=<ランダムな64文字の文字列>
```

**セキュリティ要件**:
- 塩は環境変数に保存(コードに含めない)
- Secret Managerでの管理を推奨
- 定期的な塩のローテーション(年1回)

**塩のローテーション手順**:
1. 新しい塩を生成
2. 旧塩と新塩の両方で一時的に運用
3. すべてのデータを新塩で再仮名化
4. 旧塩を削除

### 5.4 監査ログ

**要件定義書v3.1 NFR-017準拠**

#### 5.4.1 ログ取得対象

| アクション | ログレベル | 保持期間 |
|----------|----------|---------|
| **テーブル作成/削除** | ADMIN | 1年 |
| **データ挿入/更新/削除** | DATA_WRITE | 90日 |
| **データ読み取り** | DATA_READ | 30日 |
| **アクセス拒否** | すべて | 1年 |

#### 5.4.2 Cloud Loggingの設定

```yaml
# ログシンク設定
apiVersion: logging.cnrm.cloud.google.com/v1beta1
kind: LoggingLogSink
metadata:
  name: bigquery-audit-logs
spec:
  destination: bigquery.googleapis.com/projects/ai-fitness-app/datasets/audit_logs
  filter: |
    resource.type="bigquery_resource"
    AND (
      protoPayload.methodName="google.cloud.bigquery.v2.JobService.InsertJob"
      OR protoPayload.methodName="google.cloud.bigquery.v2.TableService.InsertTable"
      OR protoPayload.methodName="google.cloud.bigquery.v2.TableService.DeleteTable"
    )
  uniqueWriterIdentity: true
```

#### 5.4.3 監査クエリ例

**アクセスログの確認**:

```sql
-- 過去24時間のBigQueryアクセスログ
SELECT
  timestamp,
  principal_email,
  method_name,
  resource_name,
  status.code AS status_code,
  status.message AS status_message
FROM `ai-fitness-app.audit_logs.cloudaudit_googleapis_com_data_access_*`
WHERE _TABLE_SUFFIX >= FORMAT_TIMESTAMP('%Y%m%d', TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
  AND resource.type = 'bigquery_resource'
  AND resource.labels.dataset_id = 'fitness_app_prod'
ORDER BY timestamp DESC
LIMIT 100;
```

**削除操作の確認**:

```sql
-- データ削除操作のログ
SELECT
  timestamp,
  principal_email,
  method_name,
  JSON_EXTRACT_SCALAR(proto_payload, '$.request.table.tableId') AS table_id,
  JSON_EXTRACT_SCALAR(proto_payload, '$.request.query') AS query
FROM `ai-fitness-app.audit_logs.cloudaudit_googleapis_com_activity_*`
WHERE _TABLE_SUFFIX >= FORMAT_TIMESTAMP('%Y%m%d', TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
  AND method_name LIKE '%Delete%'
  AND resource.type = 'bigquery_resource'
ORDER BY timestamp DESC;
```

---

## 6. パーティショニングとクラスタリング

### 6.1 パーティショニング設計

**目的**:
- クエリコストの削減
- クエリパフォーマンスの向上
- データ保持期間の自動管理

#### 6.1.1 パーティション戦略

| テーブル | パーティションキー | 粒度 | 保持期間 |
|---------|-----------------|------|---------|
| `users` | `partition_date` (created_at) | 日 | 2年 |
| `training_sessions` | `partition_date` (started_at) | 日 | 2年 |
| `pose_keypoints` | `partition_date` (created_at) | 日 | 2年 |
| `subscriptions` | `partition_date` (created_at) | 日 | 7年 |
| `consent_logs` | `partition_date` (consented_at) | 日 | 7年 |
| `export_requests` | `partition_date` (requested_at) | 日 | 2年 |
| `deletion_logs` | `partition_date` (deleted_at) | 日 | 7年 |
| `exercises` | なし | - | - |

#### 6.1.2 パーティション管理

**自動削除の設定**:

```sql
-- training_sessionsテーブルのパーティション有効期限設定
ALTER TABLE `fitness_app_prod.training_sessions`
SET OPTIONS (
  partition_expiration_days = 730  -- 2年間
);
```

**パーティション確認クエリ**:

```sql
-- パーティション一覧
SELECT
  table_name,
  partition_id,
  total_rows,
  total_logical_bytes / POW(10, 9) AS size_gb,
  TIMESTAMP_MILLIS(creation_time) AS created_at,
  TIMESTAMP_MILLIS(last_modified_time) AS last_modified_at
FROM `fitness_app_prod.INFORMATION_SCHEMA.PARTITIONS`
WHERE table_name = 'training_sessions'
ORDER BY partition_id DESC
LIMIT 10;
```

### 6.2 クラスタリング設計

**目的**:
- パーティション内でのクエリ最適化
- 関連データの物理的な配置の最適化

#### 6.2.1 クラスタリング戦略

| テーブル | クラスタリングキー | 理由 |
|---------|-----------------|------|
| `users` | `user_hashed`, `subscription_status` | ユーザー検索、サブスク分析 |
| `training_sessions` | `user_hashed`, `exercise_id`, `started_at` | ユーザー・種目別の時系列分析 |
| `pose_keypoints` | `session_id`, `frame_number` | セッション単位のデータ取得 |
| `subscriptions` | `user_hashed`, `status` | ユーザー検索、ステータス分析 |
| `consent_logs` | `user_hashed`, `consent_type`, `consented_at` | ユーザー・種別別の検索 |
| `export_requests` | `user_hashed`, `status` | ユーザー検索、ステータス確認 |
| `deletion_logs` | `user_hashed`, `deleted_at` | ユーザー検索、時系列確認 |

#### 6.2.2 クラスタリングの効果測定

**クラスタリング前後の比較**:

```sql
-- クラスタリングなし
SELECT AVG(average_score)
FROM `fitness_app_prod.training_sessions`
WHERE user_hashed = '8f3e4b2c...'
  AND started_at >= '2024-01-01';
-- Bytes processed: 1.5 GB

-- クラスタリングあり
-- Bytes processed: 150 MB (10倍の改善)
```

---

## 7. データ取り込み

### 7.1 Firestoreからの取り込み

#### 7.1.1 取り込み方式

**Phase 1-2**: バッチ処理(日次)

| 項目 | 設定 |
|-----|------|
| **実行頻度** | 毎日午前2時(JST) |
| **実行環境** | Cloud Functions(256MB, 60秒タイムアウト) |
| **トリガー** | Cloud Scheduler |
| **処理方法** | Firestore → JSON → BigQuery Streaming Insert |

**Phase 3以降**: ストリーミング処理も検討

#### 7.1.2 Cloud Functionsの実装

**ディレクトリ構造**:

```
functions/
├── src/
│   ├── index.ts                    # エントリーポイント
│   ├── bigquery/
│   │   ├── client.ts               # BigQueryクライアント
│   │   ├── schemas.ts              # テーブルスキーマ定義
│   │   └── inserter.ts             # データ挿入処理
│   ├── firestore/
│   │   ├── client.ts               # Firestoreクライアント
│   │   └── exporters.ts            # データエクスポート処理
│   └── utils/
│       ├── pseudonymize.ts         # 仮名化処理
│       └── validator.ts            # バリデーション
├── package.json
└── tsconfig.json
```

**main関数** (`src/index.ts`):

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { BigQueryClient } from './bigquery/client';
import { FirestoreExporter } from './firestore/exporters';
import { pseudonymizeUserId } from './utils/pseudonymize';

/**
 * Firestoreから BigQueryへのデータ取り込み
 * 毎日午前2時(JST)に実行
 */
export const syncFirestoreToBigQuery = onSchedule(
  {
    schedule: '0 2 * * *',  // 毎日午前2時(JST)
    timeZone: 'Asia/Tokyo',
    memory: '256MiB',
    timeoutSeconds: 540,    // 9分
    region: 'asia-northeast1',
  },
  async (event) => {
    const startTime = Date.now();
    console.log('Starting Firestore to BigQuery sync...');

    try {
      // 1. Firestoreからデータをエクスポート
      const exporter = new FirestoreExporter();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const users = await exporter.exportUsers(yesterday);
      const sessions = await exporter.exportSessions(yesterday);
      const consents = await exporter.exportConsents(yesterday);

      // 2. データを仮名化
      const pseudonymizedUsers = users.map(user => ({
        ...user,
        user_hashed: pseudonymizeUserId(user.userId),
        userId: undefined,  // 元のIDは削除
      }));

      const pseudonymizedSessions = sessions.map(session => ({
        ...session,
        user_hashed: pseudonymizeUserId(session.userId),
        userId: undefined,
      }));

      // 3. BigQueryに挿入
      const bigquery = new BigQueryClient();
      
      await bigquery.insertRows('users', pseudonymizedUsers);
      console.log(`Inserted ${pseudonymizedUsers.length} users`);
      
      await bigquery.insertRows('training_sessions', pseudonymizedSessions);
      console.log(`Inserted ${pseudonymizedSessions.length} sessions`);
      
      await bigquery.insertRows('consent_logs', consents);
      console.log(`Inserted ${consents.length} consent logs`);

      const duration = Date.now() - startTime;
      console.log(`Sync completed in ${duration}ms`);
      
      return { success: true, duration };
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
);
```

**FirestoreExporter** (`src/firestore/exporters.ts`):

```typescript
import { Firestore } from '@google-cloud/firestore';

export class FirestoreExporter {
  private db: Firestore;

  constructor() {
    this.db = new Firestore();
  }

  /**
   * 指定日に作成されたユーザーをエクスポート
   */
  async exportUsers(date: Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await this.db
      .collection('users')
      .where('createdAt', '>=', startOfDay)
      .where('createdAt', '<=', endOfDay)
      .get();

    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data(),
      partition_date: date.toISOString().split('T')[0],
    }));
  }

  /**
   * 指定日に開始されたセッションをエクスポート
   */
  async exportSessions(date: Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await this.db
      .collection('sessions')
      .where('startedAt', '>=', startOfDay)
      .where('startedAt', '<=', endOfDay)
      .get();

    return snapshot.docs.map(doc => ({
      session_id: doc.id,
      ...doc.data(),
      partition_date: date.toISOString().split('T')[0],
    }));
  }

  /**
   * 指定日の同意ログをエクスポート
   */
  async exportConsents(date: Date): Promise<any[]> {
    // ユーザーごとのconsentHistoryサブコレクションを収集
    const users = await this.db.collection('users').get();
    const consents = [];

    for (const userDoc of users.docs) {
      const consentSnapshot = await userDoc.ref
        .collection('consentHistory')
        .where('consentedAt', '>=', new Date(date))
        .where('consentedAt', '<', new Date(date.getTime() + 86400000))
        .get();

      for (const consentDoc of consentSnapshot.docs) {
        consents.push({
          consent_id: consentDoc.id,
          userId: userDoc.id,
          ...consentDoc.data(),
          partition_date: date.toISOString().split('T')[0],
        });
      }
    }

    return consents;
  }
}
```

**BigQueryClient** (`src/bigquery/client.ts`):

```typescript
import { BigQuery } from '@google-cloud/bigquery';

export class BigQueryClient {
  private bigquery: BigQuery;
  private datasetId = 'fitness_app_prod';

  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT,
    });
  }

  /**
   * テーブルにデータを挿入
   */
  async insertRows(tableId: string, rows: any[]): Promise<void> {
    if (rows.length === 0) {
      console.log(`No rows to insert into ${tableId}`);
      return;
    }

    const table = this.bigquery
      .dataset(this.datasetId)
      .table(tableId);

    try {
      await table.insert(rows, {
        skipInvalidRows: false,
        ignoreUnknownValues: false,
      });
      
      console.log(`Inserted ${rows.length} rows into ${tableId}`);
      
    } catch (error) {
      console.error(`Error inserting rows into ${tableId}:`, error);
      
      if (error.name === 'PartialFailureError' && error.errors) {
        console.error('Detailed errors:', JSON.stringify(error.errors, null, 2));
      }
      
      throw error;
    }
  }
}
```

#### 7.1.3 エラーハンドリング

**リトライ戦略**:

```typescript
import { retry } from './utils/retry';

// 最大3回リトライ、指数バックオフ
await retry(
  () => bigquery.insertRows('users', pseudonymizedUsers),
  {
    maxRetries: 3,
    baseDelay: 1000,  // 1秒
    maxDelay: 10000,  // 10秒
  }
);
```

**エラー通知**:

```typescript
import { CloudLogging } from '@google-cloud/logging';

if (error) {
  const logging = new CloudLogging();
  const log = logging.log('bigquery-sync-errors');
  
  await log.write(log.entry({
    severity: 'ERROR',
    message: 'BigQuery sync failed',
    error: error.message,
    stack: error.stack,
  }));
  
  // Cloud Monitoringにアラート送信
  // (設定はCloud Monitoringで行う)
}
```

---

## 8. データ品質管理

### 8.1 データ品質チェック

#### 8.1.1 チェック項目

| チェック項目 | 説明 | 実装方法 |
|------------|------|---------|
| **NULL値チェック** | 必須フィールドのNULL確認 | SQL ASSERT |
| **範囲チェック** | 数値の範囲確認 | SQL ASSERT |
| **重複チェック** | 主キーの重複確認 | COUNT DISTINCT |
| **整合性チェック** | 外部キー整合性 | JOIN確認 |
| **フォーマットチェック** | 日付、文字列形式確認 | REGEX |

#### 8.1.2 品質チェッククエリ

**NULL値チェック**:

```sql
-- training_sessionsのNULLチェック
SELECT
  'training_sessions' AS table_name,
  COUNTIF(session_id IS NULL) AS null_session_id,
  COUNTIF(user_hashed IS NULL) AS null_user_hashed,
  COUNTIF(exercise_id IS NULL) AS null_exercise_id,
  COUNTIF(started_at IS NULL) AS null_started_at,
  COUNT(*) AS total_rows
FROM `fitness_app_prod.training_sessions`
WHERE partition_date = CURRENT_DATE() - 1;

-- アラート: NULL値が1件でもあればエラー
ASSERT (
  SELECT COUNTIF(session_id IS NULL) = 0
  FROM `fitness_app_prod.training_sessions`
  WHERE partition_date = CURRENT_DATE() - 1
) AS 'NULL values found in session_id';
```

**範囲チェック**:

```sql
-- 参考スコアの範囲チェック(0-100)
SELECT
  session_id,
  average_score
FROM `fitness_app_prod.training_sessions`
WHERE partition_date = CURRENT_DATE() - 1
  AND (average_score < 0 OR average_score > 100);

-- アラート: 範囲外の値があればエラー
ASSERT (
  SELECT COUNT(*) = 0
  FROM `fitness_app_prod.training_sessions`
  WHERE partition_date = CURRENT_DATE() - 1
    AND (average_score < 0 OR average_score > 100)
) AS 'Invalid score range found';
```

**重複チェック**:

```sql
-- セッションIDの重複チェック
SELECT
  session_id,
  COUNT(*) AS count
FROM `fitness_app_prod.training_sessions`
WHERE partition_date = CURRENT_DATE() - 1
GROUP BY session_id
HAVING count > 1;
```

### 8.2 データ品質ダッシュボード

**Looker Studioでの可視化**:

1. **日次データ品質レポート**:
   - NULL値の件数
   - 範囲外の値の件数
   - 重複レコードの件数
   - データ取り込み成功率

2. **週次データ品質トレンド**:
   - データ品質スコアの推移
   - エラー率の推移

### 8.3 データ品質モニタリング

**Cloud Monitoringでのアラート設定**:

```yaml
# アラートポリシー例
displayName: "BigQuery Data Quality Alert"
conditions:
  - displayName: "Null values in critical fields"
    conditionThreshold:
      filter: 'resource.type="bigquery_table" AND metric.type="bigquery.googleapis.com/query/null_count"'
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 60s
notificationChannels:
  - projects/ai-fitness-app/notificationChannels/email-alerts
```

---

**Part 2の終わり**

Part 3では、以下の内容を説明します:
- 分析クエリ
- ML準備
- コスト最適化
- 運用監視
# BigQuery設計書 v3.1 (Part 3/3)

**Part 3の内容**: 分析クエリ、ML準備、コスト最適化、運用監視

---

## 9. 分析クエリ

### 9.1 ダッシュボード用クエリ

#### 9.1.1 ユーザー統計

**アクティブユーザー数(DAU/MAU)**:

```sql
-- DAU (Daily Active Users)
SELECT
  DATE(started_at) AS date,
  COUNT(DISTINCT user_hashed) AS dau
FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 30
GROUP BY date
ORDER BY date DESC;

-- MAU (Monthly Active Users)
SELECT
  FORMAT_DATE('%Y-%m', started_at) AS month,
  COUNT(DISTINCT user_hashed) AS mau
FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 365
GROUP BY month
ORDER BY month DESC;
```

**新規ユーザー数**:

```sql
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS new_users
FROM `fitness_app_prod.users`
WHERE partition_date >= CURRENT_DATE() - 30
  AND is_deleted = FALSE
GROUP BY date
ORDER BY date DESC;
```

**リテンション率**:

```sql
-- コホート分析
WITH cohorts AS (
  SELECT
    user_hashed,
    DATE(created_at) AS cohort_date
  FROM `fitness_app_prod.users`
  WHERE partition_date >= CURRENT_DATE() - 90
),
user_activity AS (
  SELECT
    user_hashed,
    DATE(started_at) AS activity_date
  FROM `fitness_app_prod.training_sessions`
  WHERE partition_date >= CURRENT_DATE() - 90
)
SELECT
  cohort_date,
  COUNT(DISTINCT c.user_hashed) AS cohort_size,
  COUNT(DISTINCT CASE WHEN DATE_DIFF(activity_date, cohort_date, DAY) BETWEEN 1 AND 7 THEN ua.user_hashed END) AS retained_week_1,
  SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN DATE_DIFF(activity_date, cohort_date, DAY) BETWEEN 1 AND 7 THEN ua.user_hashed END), COUNT(DISTINCT c.user_hashed)) AS retention_week_1_rate
FROM cohorts c
LEFT JOIN user_activity ua ON c.user_hashed = ua.user_hashed
GROUP BY cohort_date
ORDER BY cohort_date DESC;
```

#### 9.1.2 トレーニング統計

**セッション数の推移**:

```sql
SELECT
  DATE(started_at) AS date,
  COUNT(*) AS total_sessions,
  COUNT(DISTINCT user_hashed) AS unique_users,
  ROUND(AVG(duration_seconds) / 60, 1) AS avg_duration_minutes,
  ROUND(AVG(average_score), 1) AS avg_score
FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 30
  AND is_completed = TRUE
GROUP BY date
ORDER BY date DESC;
```

**種目別統計**:

```sql
SELECT
  exercise_name,
  exercise_category,
  COUNT(*) AS session_count,
  COUNT(DISTINCT user_hashed) AS unique_users,
  ROUND(AVG(average_score), 1) AS avg_score,
  ROUND(AVG(completion_rate) * 100, 1) AS avg_completion_rate_percent
FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 30
GROUP BY exercise_name, exercise_category
ORDER BY session_count DESC
LIMIT 10;
```

#### 9.1.3 サブスクリプション統計

**トライアルからの有料転換率**:

```sql
WITH trial_users AS (
  SELECT
    user_hashed,
    start_date,
    trial_end_date
  FROM `fitness_app_prod.subscriptions`
  WHERE plan = 'free_trial'
    AND trial_end_date >= CURRENT_DATE() - 30
),
conversions AS (
  SELECT
    tu.user_hashed,
    tu.trial_end_date,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM `fitness_app_prod.subscriptions` s
        WHERE s.user_hashed = tu.user_hashed
          AND s.plan = 'monthly'
          AND s.start_date <= DATE_ADD(tu.trial_end_date, INTERVAL 7 DAY)
      ) THEN TRUE
      ELSE FALSE
    END AS converted
  FROM trial_users tu
)
SELECT
  DATE_TRUNC(trial_end_date, MONTH) AS month,
  COUNT(*) AS trial_ended,
  COUNTIF(converted) AS converted,
  ROUND(COUNTIF(converted) * 100.0 / COUNT(*), 1) AS conversion_rate_percent
FROM conversions
GROUP BY month
ORDER BY month DESC;
```

### 9.2 GDPR対応クエリ

#### 9.2.1 ユーザーデータのエクスポート

**プライバシーポリシーv3.1第9.5条対応**:

```sql
-- 特定ユーザーのすべてのデータをエクスポート
-- プロフィール情報
SELECT
  'profile' AS data_type,
  TO_JSON_STRING(STRUCT(
    age_range,
    gender,
    fitness_level,
    subscription_status,
    created_at,
    updated_at
  )) AS data
FROM `fitness_app_prod.users`
WHERE user_hashed = @USER_HASHED
  AND is_deleted = FALSE

UNION ALL

-- トレーニングセッション
SELECT
  'training_sessions' AS data_type,
  TO_JSON_STRING(ARRAY_AGG(STRUCT(
    session_id,
    exercise_name,
    started_at,
    ended_at,
    average_score,
    is_completed
  ))) AS data
FROM `fitness_app_prod.training_sessions`
WHERE user_hashed = @USER_HASHED;
```

#### 9.2.2 ユーザーデータの削除

**プライバシーポリシーv3.1第9.6条対応**:

```sql
-- 論理削除
UPDATE `fitness_app_prod.users`
SET
  is_deleted = TRUE,
  deleted_at = CURRENT_TIMESTAMP(),
  age_range = NULL,
  gender = NULL,
  fitness_level = NULL
WHERE user_hashed = @USER_HASHED
  AND is_deleted = FALSE;

-- 削除ログの記録
INSERT INTO `fitness_app_prod.deletion_logs` (
  deletion_id,
  user_hashed,
  deleted_at,
  deletion_reason,
  deletion_scope,
  requested_by,
  created_at,
  partition_date
)
VALUES (
  GENERATE_UUID(),
  @USER_HASHED,
  CURRENT_TIMESTAMP(),
  'user_request',
  'full',
  'user',
  CURRENT_TIMESTAMP(),
  CURRENT_DATE()
);
```

---

## 10. ML準備

### 10.1 ML用データセットの構築 (Phase 3)

**要件定義書v3.1第1.6.3節対応**

#### 10.1.1 データセット要件

| 項目 | 要件 |
|-----|------|
| **最小データ量** | 10,000セッション |
| **データ品質** | 完了セッションのみ(completion_rate >= 0.8) |
| **ラベル** | 参考スコア(average_score) |
| **分割比率** | 訓練70%、検証15%、テスト15% |

#### 10.1.2 データセット作成クエリ

```sql
-- 訓練データセットの作成
CREATE OR REPLACE TABLE `ml_training_data.training_dataset` AS
WITH labeled_sessions AS (
  SELECT
    s.session_id,
    s.user_hashed,
    s.exercise_id,
    s.exercise_name,
    s.started_at,
    s.duration_seconds,
    s.completed_sets,
    s.completed_reps,
    s.average_score AS label,
    s.reference_scores
  FROM `fitness_app_prod.training_sessions` s
  WHERE s.partition_date >= '2024-01-01'
    AND s.is_completed = TRUE
    AND s.completion_rate >= 0.8
    AND s.average_score IS NOT NULL
),
dataset_with_split AS (
  SELECT
    *,
    CASE
      WHEN MOD(ABS(FARM_FINGERPRINT(session_id)), 100) < 70 THEN 'train'
      WHEN MOD(ABS(FARM_FINGERPRINT(session_id)), 100) < 85 THEN 'validation'
      ELSE 'test'
    END AS split
  FROM labeled_sessions
)
SELECT * FROM dataset_with_split
WHERE split = 'train';
```

### 10.2 BigQuery MLの活用 (Phase 4)

#### 10.2.1 モデル訓練

```sql
-- BigQuery MLでのモデル訓練
CREATE OR REPLACE MODEL `ml_training_data.form_score_model`
OPTIONS(
  model_type='BOOSTED_TREE_REGRESSOR',
  input_label_cols=['label'],
  max_iterations=50
) AS
SELECT
  duration_seconds,
  completed_sets,
  completed_reps,
  label
FROM `ml_training_data.training_dataset`;
```

#### 10.2.2 モデル評価

```sql
-- モデルの評価
SELECT *
FROM ML.EVALUATE(
  MODEL `ml_training_data.form_score_model`,
  (
    SELECT *
    FROM `ml_training_data.validation_dataset`
  )
);
```

---

## 11. コスト最適化

### 11.1 コスト構造

**BigQueryの課金モデル**:

| 項目 | 課金対象 | 無料枠 | 料金 |
|-----|---------|--------|------|
| **Storage** | 保存データ量 | 10GB | $0.020/GB/月 |
| **Query** | スキャンデータ量 | 1TB/月 | $6.00/TB |
| **Streaming Insert** | 挿入データ量 | なし | $0.010/200MB |

### 11.2 コスト削減策

#### 11.2.1 クエリコストの削減

**パーティションフィルタの使用**:

```sql
-- ❌ コスト高(全データスキャン)
SELECT * FROM `fitness_app_prod.training_sessions`;
-- Bytes scanned: 10 GB

-- ✅ コスト低(パーティションフィルタ)
SELECT * FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 7;
-- Bytes scanned: 100 MB
```

**必要なカラムのみ選択**:

```sql
-- ❌ すべてのカラム
SELECT * FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 7;

-- ✅ 必要なカラムのみ
SELECT session_id, user_hashed, started_at, average_score
FROM `fitness_app_prod.training_sessions`
WHERE partition_date >= CURRENT_DATE() - 7;
```

#### 11.2.2 ストレージコストの削減

**パーティション有効期限の設定**:

```sql
-- 2年経過後に自動削除
ALTER TABLE `fitness_app_prod.training_sessions`
SET OPTIONS (
  partition_expiration_days = 730
);
```

### 11.3 コスト監視

#### 11.3.1 予算アラートの設定

```yaml
budget:
  displayName: "BigQuery Monthly Budget"
  amount:
    specifiedAmount:
      currencyCode: "USD"
      units: "100"
  thresholdRules:
    - thresholdPercent: 0.5
    - thresholdPercent: 0.9
    - thresholdPercent: 1.0
```

#### 11.3.2 コスト分析クエリ

**テーブル別のストレージコスト**:

```sql
SELECT
  table_schema AS dataset,
  table_name,
  ROUND(size_bytes / POW(10, 9), 2) AS size_gb,
  ROUND(size_bytes / POW(10, 9) * 0.020, 2) AS monthly_cost_usd
FROM `fitness_app_prod.INFORMATION_SCHEMA.TABLES`
ORDER BY size_gb DESC;
```

---

## 12. 運用監視

### 12.1 監視項目

#### 12.1.1 データ品質監視

| 項目 | 閾値 | アラート |
|-----|------|---------|
| **NULL値の割合** | > 1% | Warning |
| **重複レコード** | > 0件 | Error |
| **範囲外の値** | > 0件 | Error |
| **データ取り込み失敗** | 1回/日 | Error |

#### 12.1.2 パフォーマンス監視

| 項目 | 閾値 | アラート |
|-----|------|---------|
| **クエリ応答時間** | > 10秒 | Warning |
| **データ取り込み時間** | > 5分 | Warning |
| **ストレージ使用量** | > 8GB | Warning |

#### 12.1.3 コスト監視

| 項目 | 閾値 | アラート |
|-----|------|---------|
| **月次コスト** | > $50 | Warning |
| **日次クエリ量** | > 50GB | Warning |

### 12.2 監視ダッシュボード

**Looker Studioでのダッシュボード構成**:

1. **データ品質ダッシュボード**:
   - NULL値の推移
   - 重複レコードの検出
   - データ取り込み成功率

2. **パフォーマンスダッシュボード**:
   - クエリ応答時間の分布
   - スロークエリのリスト
   - ストレージ使用量の推移

3. **コストダッシュボード**:
   - 月次コストの推移
   - テーブル別コスト
   - ユーザー別クエリコスト

### 12.3 アラート設定

#### 12.3.1 Cloud Monitoringでのアラート

**データ品質アラート**:

```yaml
displayName: "BigQuery Data Quality Alert"
conditions:
  - displayName: "High NULL rate"
    conditionThreshold:
      filter: 'resource.type="bigquery_table"'
      comparison: COMPARISON_GT
      thresholdValue: 0.01
      duration: 300s
notificationChannels:
  - email-alerts
```

**パフォーマンスアラート**:

```yaml
displayName: "BigQuery Performance Alert"
conditions:
  - displayName: "Slow query detected"
    conditionThreshold:
      filter: 'metric.type="bigquery.googleapis.com/job/elapsed_time"'
      comparison: COMPARISON_GT
      thresholdValue: 10000
      duration: 60s
notificationChannels:
  - slack-alerts
```

### 12.4 定期メンテナンス

#### 12.4.1 日次タスク

| タスク | 説明 | 実行時刻 |
|-------|------|---------|
| **データ取り込み** | Firestoreから BigQueryへ | 午前2時(JST) |
| **データ品質チェック** | NULL値、重複チェック | 午前3時(JST) |
| **バックアップ確認** | 自動バックアップの確認 | 午前4時(JST) |

#### 12.4.2 週次タスク

| タスク | 説明 | 実行日 |
|-------|------|-------|
| **パーティション整理** | 古いパーティションの確認 | 月曜日 |
| **コスト分析** | 週次コストレポート | 月曜日 |
| **パフォーマンス分析** | スロークエリの特定 | 月曜日 |

#### 12.4.3 月次タスク

| タスク | 説明 | 実行日 |
|-------|------|-------|
| **ストレージ最適化** | 不要なテーブルの削除 | 月初 |
| **セキュリティレビュー** | アクセス権限の確認 | 月初 |
| **ML準備状況確認** | データ量の確認(Phase 3準備) | 月末 |

---

## 13. まとめ

### 13.1 v3.1での主な成果

✅ **法的要件との完全な整合性**:
- 要件定義書v3.1、利用規約v3.1、プライバシーポリシーv3.1と完全に一致
- GDPR/EDPB Guidelines準拠の実装
- 薬機法対応の表現統一

✅ **包括的なデータモデル設計**:
- 8つのテーブル設計
- プライバシーバイデザインの実装
- 仮名化処理の詳細定義

✅ **セキュリティ対策の詳細化**:
- Cloud IAMによるアクセス制御
- AES-256暗号化
- 監査ログの完全な記録

✅ **分析基盤の構築**:
- ダッシュボード用クエリの整備
- GDPR対応クエリの実装
- ML準備の計画

✅ **コスト最適化**:
- パーティショニングとクラスタリング
- クエリコスト削減策
- コスト監視の仕組み

✅ **運用監視体制**:
- データ品質監視
- パフォーマンス監視
- アラート設定

### 13.2 このBigQuery設計書により実現できること

✅ **データ分析**: トレーニングデータの集計・可視化  
✅ **ダッシュボード**: Looker Studioでの可視化  
✅ **ML準備**: Phase 3-4でのML移行に向けたデータ準備  
✅ **GDPR対応**: データエクスポート・削除の技術的実装  
✅ **プライバシー保護**: 仮名化による個人情報保護  
✅ **コスト管理**: 無料枠内での運用(MVP期間)  
✅ **データ品質**: 品質チェックと監視  
✅ **スケーラビリティ**: Phase 3以降の成長に対応

### 13.3 次のステップ

このBigQuery設計書v3.1に基づき、以下の作業を進めます:

1. **Phase 1 (0-1ヶ月)**:
   - BigQueryデータセットの作成
   - テーブルの作成
   - Cloud Functionsでのデータ取り込み実装

2. **Phase 2 (1-4ヶ月)**:
   - Looker Studioダッシュボードの構築
   - データ品質監視の実装
   - コスト監視の設定

3. **Phase 3 (4-8ヶ月)**:
   - 10,000セッション達成後、ML用データセット構築
   - pose_keypointsテーブルの実装

4. **Phase 4 (8-12ヶ月)**:
   - BigQuery MLまたはVertex AIでのML訓練
   - MLモデルのデプロイ

---

### 13.4 関連ドキュメント

| ドキュメント | バージョン | 関連箇所 |
|------------|----------|---------|
| **要件定義書** | v3.1 | 第9章(Firebase + GCP ハイブリッド構成) |
| **利用規約** | v3.1 | 第1.2条(用語定義)、第6条(課金) |
| **プライバシーポリシー** | v3.1 | 第5条(データ収集)、第8条(セキュリティ)、第9条(GDPR)、第10条(保持期間) |
| **システムアーキテクチャ設計書** | v3.1 | 第6.3節、第8章、第9.3節 |
| **Firestoreデータベース設計書** | v3.1 | 第3章(コレクション構造)、第4章(データモデル) |