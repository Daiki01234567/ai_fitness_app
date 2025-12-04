# Looker Studio 設定ガイド

**プロジェクト**: AI Fitness App
**Firebase Project ID**: `tokyo-list-478804-e5`
**最終更新**: 2025-12-04

---

## 1. 概要

このガイドでは、BigQueryに蓄積されたトレーニングデータをLooker Studio（旧Google Data Studio）で可視化するための設定手順を説明します。

### 1.1 前提条件

- Google Cloud Console へのアクセス権限
- BigQuery の `fitness_analytics` データセットへの読み取り権限
- Looker Studio へのアクセス権限

### 1.2 作成するダッシュボード

| ダッシュボード | 目的 | 対象者 |
|--------------|------|--------|
| **運用ダッシュボード** | 日次KPI監視、異常検知 | 運用チーム |
| **ビジネスダッシュボード** | MAU/DAU、リテンション分析 | プロダクトマネージャー |
| **種目分析ダッシュボード** | 種目別利用状況、スコア分布 | プロダクトチーム |

---

## 2. Looker Studio へのアクセス

### 2.1 初回アクセス

1. [Looker Studio](https://lookerstudio.google.com/) にアクセス
2. Google アカウントでサインイン
3. プロジェクト用のワークスペースを作成（推奨）

### 2.2 BigQuery 接続の設定

1. 「作成」→「データソース」を選択
2. コネクタ一覧から「BigQuery」を選択
3. 以下を選択:
   - **プロジェクト**: `tokyo-list-478804-e5`
   - **データセット**: `fitness_analytics`
   - **テーブル**: 接続するテーブルを選択

---

## 3. データソース設定

### 3.1 推奨データソース構成

各ダッシュボードに必要なデータソースを設定します。

#### 3.1.1 日次集計データソース（コスト効率重視）

```sql
-- aggregated_stats テーブルを使用（コスト削減99%）
SELECT
  stat_date,
  exercise_id,
  age_group,
  country_code,
  total_sessions,
  total_users,
  total_duration_seconds,
  average_score,
  average_rep_count
FROM `tokyo-list-478804-e5.fitness_analytics.aggregated_stats`
WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
```

**データソース設定**:
- **名前**: `日次集計データ`
- **更新頻度**: 毎日（自動更新）
- **キャッシュ**: 有効（12時間）

#### 3.1.2 種目マスターデータソース

```sql
SELECT
  exercise_id,
  exercise_name_ja,
  exercise_name_en,
  category,
  difficulty_level,
  is_active
FROM `tokyo-list-478804-e5.fitness_analytics.exercise_definitions`
WHERE is_active = TRUE
```

**データソース設定**:
- **名前**: `種目マスター`
- **更新頻度**: 週次
- **キャッシュ**: 有効（7日間）

#### 3.1.3 リアルタイムデータソース（必要時のみ）

```sql
-- 直近のセッションデータ（コスト注意）
SELECT
  session_id,
  user_id_hash,
  exercise_id,
  duration_seconds,
  rep_count,
  average_score,
  device_type,
  app_version,
  created_at
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
WHERE is_deleted = FALSE
  AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
```

**注意**: このデータソースはコストが高いため、必要最小限の使用を推奨します。

---

## 4. ダッシュボード設計

### 4.1 運用ダッシュボード

#### KPI カード

| 指標 | 計算式 | 目標値 |
|-----|--------|--------|
| 本日のセッション数 | `SUM(total_sessions) WHERE stat_date = TODAY` | - |
| 本日のアクティブユーザー | `SUM(total_users) WHERE stat_date = TODAY` | - |
| 平均スコア（7日間） | `AVG(average_score) WHERE stat_date >= TODAY - 7` | > 70 |
| 週次成長率 | `(今週 - 先週) / 先週 * 100` | > 5% |

#### グラフ

1. **日別セッション推移**（折れ線グラフ）
   - X軸: `stat_date`
   - Y軸: `SUM(total_sessions)`
   - 期間: 過去30日

2. **種目別利用率**（円グラフ）
   - ディメンション: `exercise_id`（種目マスターと結合）
   - 指標: `SUM(total_sessions)`

3. **時間帯別アクティビティ**（ヒートマップ）
   - カスタムクエリが必要

### 4.2 ビジネスダッシュボード

#### DAU/WAU/MAU 分析

```sql
-- カスタムクエリを使用
WITH daily_users AS (
  SELECT
    DATE(created_at) as activity_date,
    COUNT(DISTINCT user_id_hash) as dau
  FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
    AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY activity_date
),
weekly_users AS (
  SELECT
    DATE_TRUNC(DATE(created_at), WEEK) as week_start,
    COUNT(DISTINCT user_id_hash) as wau
  FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
    AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY week_start
)
SELECT * FROM daily_users
```

#### リテンション分析

コホート分析用のカスタムクエリ:

```sql
WITH first_session AS (
  SELECT
    user_id_hash,
    DATE(MIN(created_at)) as first_date
  FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
  WHERE is_deleted = FALSE
  GROUP BY user_id_hash
),
retention AS (
  SELECT
    fs.first_date as cohort_date,
    DATE_DIFF(DATE(ts.created_at), fs.first_date, DAY) as days_since_first,
    COUNT(DISTINCT ts.user_id_hash) as users
  FROM first_session fs
  JOIN `tokyo-list-478804-e5.fitness_analytics.training_sessions` ts
    ON fs.user_id_hash = ts.user_id_hash
  WHERE ts.is_deleted = FALSE
  GROUP BY cohort_date, days_since_first
)
SELECT
  cohort_date,
  days_since_first,
  users,
  FIRST_VALUE(users) OVER (PARTITION BY cohort_date ORDER BY days_since_first) as cohort_size
FROM retention
WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
ORDER BY cohort_date, days_since_first
```

### 4.3 種目分析ダッシュボード

#### スコア分布ヒストグラム

```sql
SELECT
  ed.exercise_name_ja,
  CASE
    WHEN ts.average_score >= 90 THEN '90-100'
    WHEN ts.average_score >= 80 THEN '80-89'
    WHEN ts.average_score >= 70 THEN '70-79'
    WHEN ts.average_score >= 60 THEN '60-69'
    ELSE '0-59'
  END as score_range,
  COUNT(*) as session_count
FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions` ts
LEFT JOIN `tokyo-list-478804-e5.fitness_analytics.exercise_definitions` ed
  ON ts.exercise_id = ed.exercise_id
WHERE ts.is_deleted = FALSE
  AND ts.average_score IS NOT NULL
  AND DATE(ts.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY ed.exercise_name_ja, score_range
ORDER BY ed.exercise_name_ja, score_range DESC
```

---

## 5. フィルターとコントロール

### 5.1 標準フィルター

各ダッシュボードに以下のフィルターを設置:

| フィルター | フィールド | タイプ |
|-----------|----------|--------|
| 期間選択 | `stat_date` | 日付範囲 |
| 種目選択 | `exercise_id` | ドロップダウン（複数選択） |
| 年齢層 | `age_group` | ドロップダウン |
| 国/地域 | `country_code` | ドロップダウン |

### 5.2 日付範囲プリセット

- 今日
- 昨日
- 過去7日間
- 過去30日間
- 過去90日間
- カスタム範囲

---

## 6. アラート設定

### 6.1 Cloud Monitoring との連携

BigQuery の監視には Cloud Monitoring を使用します。

#### 設定手順

1. Google Cloud Console → Monitoring → アラート
2. 「アラートポリシーを作成」
3. 以下の条件を設定:

**コストアラート**:
```
リソースタイプ: bigquery_project
指標: query/scanned_bytes
閾値: 1 TB/日
```

**エラーアラート**:
```
リソースタイプ: cloud_function
指標: function/execution_count
フィルタ: status = "error"
閾値: 10回/時間
```

### 6.2 Looker Studio 内アラート

1. ダッシュボード → 「共有」→「スケジュール配信」
2. 条件付き配信を設定:
   - KPI が閾値を下回った場合に通知
   - 日次/週次レポートの自動配信

---

## 7. アクセス権限管理

### 7.1 IAM ロール

| ロール | 権限 | 対象者 |
|-------|------|--------|
| `roles/bigquery.dataViewer` | データ読み取り | アナリスト |
| `roles/bigquery.jobUser` | クエリ実行 | アナリスト |
| `roles/bigquery.dataEditor` | データ編集 | データエンジニア |

### 7.2 Looker Studio 共有設定

1. ダッシュボード → 「共有」
2. アクセス権限を設定:
   - **閲覧者**: レポート閲覧のみ
   - **編集者**: レポート編集可能
   - **オーナー**: 全権限

### 7.3 行レベルセキュリティ（RLS）

必要に応じて、ユーザーごとにデータアクセスを制限:

```sql
-- RLS ポリシーの例
CREATE ROW ACCESS POLICY user_data_filter
ON `tokyo-list-478804-e5.fitness_analytics.training_sessions`
GRANT TO ("user:analyst@example.com")
FILTER USING (country_code = 'JP');
```

---

## 8. パフォーマンス最適化

### 8.1 クエリ最適化のベストプラクティス

1. **集計テーブルを優先使用**
   - `aggregated_stats` を使用してコスト99%削減
   - 生データ（`training_sessions`）は必要時のみ

2. **パーティションフィルタを必ず含める**
   ```sql
   -- 良い例
   WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)

   -- 悪い例（全テーブルスキャン）
   WHERE exercise_id = 'squat'
   ```

3. **SELECT * を避ける**
   ```sql
   -- 良い例
   SELECT stat_date, total_sessions, average_score

   -- 悪い例
   SELECT *
   ```

### 8.2 キャッシュ設定

| データソース | キャッシュ期間 | 理由 |
|-------------|--------------|------|
| 日次集計 | 12時間 | 日次更新のため |
| 種目マスター | 7日間 | 変更頻度が低い |
| リアルタイムデータ | 15分 | 最新性が必要 |

### 8.3 コスト監視

月次コスト目標: **$50以下**

| 項目 | 想定コスト |
|-----|----------|
| ストレージ | $5/月 |
| クエリ（集計テーブル経由） | $10/月 |
| クエリ（生データ直接） | $30/月（要削減） |

---

## 9. トラブルシューティング

### 9.1 よくある問題

#### データが表示されない

1. **権限確認**
   ```bash
   gcloud projects get-iam-policy tokyo-list-478804-e5 \
     --filter="bindings.members:user@example.com"
   ```

2. **データソース接続確認**
   - Looker Studio → データソース → 再接続

3. **パーティションフィルタ確認**
   - 日付範囲が正しいか確認

#### クエリが遅い

1. **クエリプランを確認**
   - BigQuery コンソール → クエリ履歴 → 実行詳細

2. **インデックス/クラスタリングの活用**
   - `user_id_hash`, `exercise_id`, `created_at` でクラスタリング済み

#### コストが高い

1. **クエリ監査**
   - BigQuery → 管理 → リソースの使用状況

2. **集計テーブル使用を確認**
   - 生データへの直接クエリを減らす

---

## 10. 次のステップ

### 10.1 ダッシュボード作成チェックリスト

```
[ ] Looker Studio ワークスペース作成
[ ] BigQuery データソース接続
[ ] 運用ダッシュボード作成
[ ] ビジネスダッシュボード作成
[ ] 種目分析ダッシュボード作成
[ ] アクセス権限設定
[ ] スケジュール配信設定
[ ] コストアラート設定
```

### 10.2 関連ドキュメント

- [BigQueryセットアップ完了レポート](./BIGQUERY_SETUP_STATUS.md)
- [BigQuery設計書](../specs/04_BigQuery設計書_v3_3.md)
- [Firebase セットアップ索引](./FIREBASE_SETUP_INDEX.md)

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|---------|------|----------|
| v1.0 | 2025-12-04 | 初版作成 |

---

**作成者**: Cloud Architect
**ステータス**: 初版
