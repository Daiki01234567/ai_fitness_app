# 045 利用統計API

## 概要

管理者がアプリの利用状況を把握するための統計データAPIを実装するチケットです。DAU/MAU、トレーニング回数、種目別の人気度、継続率などの指標を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築
- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-027: 統計データ表示（管理者向け）
- FR-ADM-002: 利用状況集計

### 非機能要件

- NFR-038: 管理者認証
- NFR-042: 管理画面レスポンス（3秒以内）

## 受け入れ条件（Todo）

### DAU/MAU統計API

- [x] 日次アクティブユーザー数（DAU）を取得するAPIを実装
- [x] 月次アクティブユーザー数（MAU）を取得するAPIを実装
- [x] 期間指定での集計機能を実装（過去7日、30日、90日）
- [x] 前期間との比較データを含める（増減率）

### トレーニング統計API

- [x] 総トレーニング回数を取得するAPIを実装
- [x] 期間別のトレーニング回数を取得
- [x] 種目別のトレーニング回数を取得
- [x] 平均トレーニング時間を取得

### ユーザー統計API

- [x] 総ユーザー数を取得するAPIを実装
- [x] 新規登録ユーザー数（期間別）を取得
- [x] プラン別ユーザー数（Free/Premium）を取得
- [x] 削除ユーザー数を取得

### 継続率統計API

- [x] 7日間継続率を計算するAPIを実装
- [x] 30日間継続率を計算するAPIを実装
- [x] コホート分析データを取得するAPIを実装
- [ ] チャーン率（解約率）を計算するAPIを実装（将来対応）

### テスト

- [x] DAU/MAU統計のユニットテストを作成
- [x] トレーニング統計のユニットテストを作成
- [x] ユーザー統計のユニットテストを作成
- [x] 継続率統計のユニットテストを作成
- [x] 権限チェックのテストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - 管理者機能（セクション14）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 管理者機能向け要件（セクション15）
- `docs/common/specs/05_BigQuery設計書_v1_0.md` - BigQuery分析基盤

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| DAU/MAU統計取得 | GET | /admin/stats/active-users | admin以上 |
| トレーニング統計取得 | GET | /admin/stats/training | admin以上 |
| ユーザー統計取得 | GET | /admin/stats/users | admin以上 |
| 継続率統計取得 | GET | /admin/stats/retention | admin以上 |
| ダッシュボード統計取得 | GET | /admin/stats/dashboard | admin以上 |

### DAU/MAU統計取得API

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BigQuery } from "@google-cloud/bigquery";
import * as admin from "firebase-admin";

/**
 * DAU/MAU統計を取得する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（7d, 30d, 90d）
 */
export const getActiveUsersStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "30d" } = request.data;

  // 期間を日数に変換
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  // BigQueryでDAU/MAUを集計
  const bigquery = new BigQuery();

  // DAUクエリ
  const dauQuery = `
    SELECT
      DATE(session_started_at) as date,
      COUNT(DISTINCT user_id) as dau
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    GROUP BY date
    ORDER BY date DESC
  `;

  const [dauRows] = await bigquery.query(dauQuery);

  // MAUクエリ
  const mauQuery = `
    SELECT
      COUNT(DISTINCT user_id) as mau
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  `;

  const [mauRows] = await bigquery.query(mauQuery);

  // 前期間との比較
  const previousPeriodQuery = `
    SELECT
      COUNT(DISTINCT user_id) as previous_mau
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
      AND session_started_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
  `;

  const [previousRows] = await bigquery.query(previousPeriodQuery);

  const currentMAU = mauRows[0]?.mau || 0;
  const previousMAU = previousRows[0]?.previous_mau || 0;
  const changeRate = previousMAU > 0
    ? ((currentMAU - previousMAU) / previousMAU) * 100
    : 0;

  return {
    dau: dauRows.map((row) => ({
      date: row.date.value,
      count: row.dau,
    })),
    mau: currentMAU,
    previousMAU: previousMAU,
    changeRate: Math.round(changeRate * 100) / 100,
    period: period,
  };
});
```

### トレーニング統計取得API

```typescript
/**
 * トレーニング統計を取得する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（7d, 30d, 90d）
 */
export const getTrainingStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "30d" } = request.data;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const bigquery = new BigQuery();

  // 総トレーニング回数
  const totalQuery = `
    SELECT
      COUNT(*) as total_sessions,
      AVG(duration_seconds) as avg_duration,
      AVG(score) as avg_score
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
  `;

  const [totalRows] = await bigquery.query(totalQuery);

  // 種目別のトレーニング回数
  const exerciseQuery = `
    SELECT
      exercise_type,
      COUNT(*) as count,
      AVG(score) as avg_score
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    GROUP BY exercise_type
    ORDER BY count DESC
  `;

  const [exerciseRows] = await bigquery.query(exerciseQuery);

  // 日別のトレーニング回数
  const dailyQuery = `
    SELECT
      DATE(session_started_at) as date,
      COUNT(*) as count
    FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
    WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    GROUP BY date
    ORDER BY date DESC
  `;

  const [dailyRows] = await bigquery.query(dailyQuery);

  return {
    total: {
      sessions: totalRows[0]?.total_sessions || 0,
      avgDuration: Math.round(totalRows[0]?.avg_duration || 0),
      avgScore: Math.round((totalRows[0]?.avg_score || 0) * 100) / 100,
    },
    byExercise: exerciseRows.map((row) => ({
      exerciseType: row.exercise_type,
      count: row.count,
      avgScore: Math.round(row.avg_score * 100) / 100,
    })),
    daily: dailyRows.map((row) => ({
      date: row.date.value,
      count: row.count,
    })),
    period: period,
  };
});
```

### ユーザー統計取得API

```typescript
/**
 * ユーザー統計を取得する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（7d, 30d, 90d）
 */
export const getUserStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "30d" } = request.data;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  // Firestoreで集計
  const now = admin.firestore.Timestamp.now();
  const periodAgo = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - days * 24 * 60 * 60 * 1000
  );

  // 総ユーザー数
  const totalUsersSnapshot = await admin
    .firestore()
    .collection("users")
    .count()
    .get();
  const totalUsers = totalUsersSnapshot.data().count;

  // 新規登録ユーザー数
  const newUsersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("createdAt", ">=", periodAgo)
    .count()
    .get();
  const newUsers = newUsersSnapshot.data().count;

  // プラン別ユーザー数
  const premiumUsersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("subscriptionStatus", "==", "premium")
    .count()
    .get();
  const premiumUsers = premiumUsersSnapshot.data().count;

  // 削除予定ユーザー数
  const deletionScheduledSnapshot = await admin
    .firestore()
    .collection("users")
    .where("deletionScheduled", "==", true)
    .count()
    .get();
  const deletionScheduled = deletionScheduledSnapshot.data().count;

  // 停止中ユーザー数
  const disabledUsersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("disabled", "==", true)
    .count()
    .get();
  const disabledUsers = disabledUsersSnapshot.data().count;

  return {
    total: totalUsers,
    new: newUsers,
    byPlan: {
      free: totalUsers - premiumUsers,
      premium: premiumUsers,
    },
    deletionScheduled: deletionScheduled,
    disabled: disabledUsers,
    period: period,
  };
});
```

### 継続率統計取得API

```typescript
/**
 * 継続率統計を取得する（管理者専用）
 *
 * コホート分析により、ユーザーの継続率を計算します。
 */
export const getRetentionStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const bigquery = new BigQuery();

  // 7日間継続率
  const retention7Query = `
    WITH user_first_session AS (
      SELECT
        user_id,
        MIN(DATE(session_started_at)) as first_date
      FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
      WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY user_id
    ),
    returning_users AS (
      SELECT DISTINCT
        u.user_id
      FROM user_first_session u
      JOIN \`tokyo-list-478804-e5.fitness_analytics.sessions\` s
        ON u.user_id = s.user_id
      WHERE DATE(s.session_started_at) >= DATE_ADD(u.first_date, INTERVAL 7 DAY)
        AND DATE(s.session_started_at) < DATE_ADD(u.first_date, INTERVAL 14 DAY)
    )
    SELECT
      COUNT(DISTINCT u.user_id) as total_users,
      COUNT(DISTINCT r.user_id) as returning_users,
      SAFE_DIVIDE(COUNT(DISTINCT r.user_id), COUNT(DISTINCT u.user_id)) * 100 as retention_rate
    FROM user_first_session u
    LEFT JOIN returning_users r ON u.user_id = r.user_id
  `;

  const [retention7Rows] = await bigquery.query(retention7Query);

  // 30日間継続率
  const retention30Query = `
    WITH user_first_session AS (
      SELECT
        user_id,
        MIN(DATE(session_started_at)) as first_date
      FROM \`tokyo-list-478804-e5.fitness_analytics.sessions\`
      WHERE session_started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
      GROUP BY user_id
    ),
    returning_users AS (
      SELECT DISTINCT
        u.user_id
      FROM user_first_session u
      JOIN \`tokyo-list-478804-e5.fitness_analytics.sessions\` s
        ON u.user_id = s.user_id
      WHERE DATE(s.session_started_at) >= DATE_ADD(u.first_date, INTERVAL 30 DAY)
        AND DATE(s.session_started_at) < DATE_ADD(u.first_date, INTERVAL 37 DAY)
    )
    SELECT
      COUNT(DISTINCT u.user_id) as total_users,
      COUNT(DISTINCT r.user_id) as returning_users,
      SAFE_DIVIDE(COUNT(DISTINCT r.user_id), COUNT(DISTINCT u.user_id)) * 100 as retention_rate
    FROM user_first_session u
    LEFT JOIN returning_users r ON u.user_id = r.user_id
  `;

  const [retention30Rows] = await bigquery.query(retention30Query);

  return {
    retention7d: {
      totalUsers: retention7Rows[0]?.total_users || 0,
      returningUsers: retention7Rows[0]?.returning_users || 0,
      rate: Math.round((retention7Rows[0]?.retention_rate || 0) * 100) / 100,
    },
    retention30d: {
      totalUsers: retention30Rows[0]?.total_users || 0,
      returningUsers: retention30Rows[0]?.returning_users || 0,
      rate: Math.round((retention30Rows[0]?.retention_rate || 0) * 100) / 100,
    },
  };
});
```

### ダッシュボード統計取得API

```typescript
/**
 * ダッシュボード用の統計サマリーを取得する（管理者専用）
 *
 * 複数の統計APIをまとめて呼び出し、ダッシュボード表示用のデータを返します。
 */
export const getDashboardStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "30d" } = request.data;

  // 並列で各統計を取得
  const [activeUsers, training, users, retention] = await Promise.all([
    getActiveUsersStats(request),
    getTrainingStats(request),
    getUserStats(request),
    getRetentionStats(request),
  ]);

  return {
    activeUsers,
    training,
    users,
    retention,
    period,
    generatedAt: new Date().toISOString(),
  };
});
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [x] 完了（チャーン率APIを除く）

## 完了日

2025-12-11

## 備考

- BigQueryを使用した集計のため、リアルタイム性は保証されません（通常1分程度の遅延）
- 大量データの集計には時間がかかる場合があるため、キャッシュの導入を検討してください
- ダッシュボード統計APIは複数のAPIを並列で呼び出すため、レスポンス時間が長くなる可能性があります
- コホート分析は計算コストが高いため、定期的にバッチ処理で事前計算することを推奨します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了（チャーン率APIを除く） |
