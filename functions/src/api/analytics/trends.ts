/**
 * トレンド分析API
 *
 * 時系列データとユーザー行動分析
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション7.1.3, 7.2
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BigQuery } from "@google-cloud/bigquery";

import { logger } from "../../utils/logger";

// BigQuery設定
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "tokyo-list-478804-e5";
const DATASET_ID = "fitness_analytics";

const bigquery = new BigQuery({ projectId: PROJECT_ID });

/**
 * 日別トレンドレスポンス型
 */
interface DailyTrendResponse {
  trends: Array<{
    date: string;
    sessions: number;
    activeUsers: number;
    averageScore: number;
  }>;
  summary: {
    totalSessions: number;
    totalActiveUsers: number;
    averageScore: number;
    sessionGrowthRate: number;
  };
}

/**
 * 日別トレンドを取得
 */
export const analytics_getDailyTrends = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<DailyTrendResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const { days = 30 } = request.data as { days?: number };
    const periodDays = Math.min(Math.max(days, 1), 90);

    logger.info("Getting daily trends", {
      userId: request.auth.uid,
      periodDays,
    });

    try {
      const query = `
        SELECT
          stat_date,
          SUM(total_sessions) as sessions,
          SUM(total_users) as active_users,
          AVG(average_score) as avg_score
        FROM \`${PROJECT_ID}.${DATASET_ID}.aggregated_stats\`
        WHERE stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @period_days DAY)
        GROUP BY stat_date
        ORDER BY stat_date DESC
      `;

      const [rows] = await bigquery.query({
        query,
        params: { period_days: periodDays },
      });

      const trends = (
        rows as Array<{
          stat_date: { value: string };
          sessions: number;
          active_users: number;
          avg_score: number;
        }>
      ).map((row) => ({
        date: row.stat_date.value,
        sessions: Number(row.sessions) || 0,
        activeUsers: Number(row.active_users) || 0,
        averageScore: Number(row.avg_score) || 0,
      }));

      // サマリー計算
      const totalSessions = trends.reduce((sum, t) => sum + t.sessions, 0);
      const uniqueUsers = new Set(trends.map((t) => t.activeUsers));
      const totalActiveUsers = Math.max(...Array.from(uniqueUsers));
      const averageScore =
        trends.length > 0
          ? trends.reduce((sum, t) => sum + t.averageScore, 0) / trends.length
          : 0;

      // 成長率計算（先週と今週の比較）
      const midPoint = Math.floor(trends.length / 2);
      const recentSessions = trends
        .slice(0, midPoint)
        .reduce((sum, t) => sum + t.sessions, 0);
      const previousSessions = trends
        .slice(midPoint)
        .reduce((sum, t) => sum + t.sessions, 0);
      const sessionGrowthRate =
        previousSessions > 0
          ? Math.round(
              ((recentSessions - previousSessions) / previousSessions) * 100,
            )
          : 0;

      return {
        trends,
        summary: {
          totalSessions,
          totalActiveUsers,
          averageScore: Math.round(averageScore * 10) / 10,
          sessionGrowthRate,
        },
      };
    } catch (error) {
      logger.error("Failed to get daily trends", error as Error);
      throw new HttpsError("internal", "日別トレンドの取得に失敗しました");
    }
  },
);

/**
 * アクティブユーザー分析レスポンス型
 */
interface ActiveUsersResponse {
  dau: number;
  wau: number;
  mau: number;
  dauWauRatio: number;
  dauMauRatio: number;
  dailyActiveUsers: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * アクティブユーザー分析（DAU/WAU/MAU）
 */
export const analytics_getActiveUsers = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<ActiveUsersResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    logger.info("Getting active users analysis", {
      userId: request.auth.uid,
    });

    try {
      // DAU（今日）
      const dauQuery = `
        SELECT COUNT(DISTINCT user_id_hash) as dau
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND DATE(created_at) = CURRENT_DATE()
      `;

      // WAU（過去7日）
      const wauQuery = `
        SELECT COUNT(DISTINCT user_id_hash) as wau
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      `;

      // MAU（過去30日）
      const mauQuery = `
        SELECT COUNT(DISTINCT user_id_hash) as mau
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      `;

      // 日別DAU推移
      const dailyDauQuery = `
        SELECT
          DATE(created_at) as activity_date,
          COUNT(DISTINCT user_id_hash) as dau
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY activity_date
        ORDER BY activity_date DESC
      `;

      // 並列実行
      const [dauResult, wauResult, mauResult, dailyDauResult] =
        await Promise.all([
          bigquery.query({ query: dauQuery }),
          bigquery.query({ query: wauQuery }),
          bigquery.query({ query: mauQuery }),
          bigquery.query({ query: dailyDauQuery }),
        ]);

      const dau = Number((dauResult[0] as Array<{ dau: number }>)[0]?.dau) || 0;
      const wau = Number((wauResult[0] as Array<{ wau: number }>)[0]?.wau) || 0;
      const mau = Number((mauResult[0] as Array<{ mau: number }>)[0]?.mau) || 0;

      const dailyActiveUsers = (
        dailyDauResult[0] as Array<{
          activity_date: { value: string };
          dau: number;
        }>
      ).map((row) => ({
        date: row.activity_date.value,
        count: Number(row.dau) || 0,
      }));

      return {
        dau,
        wau,
        mau,
        dauWauRatio: wau > 0 ? Math.round((dau / wau) * 100) : 0,
        dauMauRatio: mau > 0 ? Math.round((dau / mau) * 100) : 0,
        dailyActiveUsers,
      };
    } catch (error) {
      logger.error("Failed to get active users analysis", error as Error);
      throw new HttpsError(
        "internal",
        "アクティブユーザー分析の取得に失敗しました",
      );
    }
  },
);

/**
 * リテンション分析レスポンス型
 */
interface RetentionResponse {
  cohorts: Array<{
    cohortDate: string;
    cohortSize: number;
    day7Retention: number;
    day30Retention: number;
  }>;
  averageDay7Retention: number;
  averageDay30Retention: number;
}

/**
 * リテンション分析
 */
export const analytics_getRetention = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<RetentionResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    logger.info("Getting retention analysis", {
      userId: request.auth.uid,
    });

    try {
      const query = `
        WITH first_session AS (
          SELECT
            user_id_hash,
            DATE(MIN(created_at)) as first_date
          FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
          WHERE is_deleted = FALSE
          GROUP BY user_id_hash
        ),
        day7_activity AS (
          SELECT DISTINCT
            fs.user_id_hash,
            fs.first_date
          FROM first_session fs
          JOIN \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
            ON fs.user_id_hash = ts.user_id_hash
          WHERE ts.is_deleted = FALSE
            AND DATE(ts.created_at) BETWEEN
                DATE_ADD(fs.first_date, INTERVAL 7 DAY) AND
                DATE_ADD(fs.first_date, INTERVAL 13 DAY)
        ),
        day30_activity AS (
          SELECT DISTINCT
            fs.user_id_hash,
            fs.first_date
          FROM first_session fs
          JOIN \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
            ON fs.user_id_hash = ts.user_id_hash
          WHERE ts.is_deleted = FALSE
            AND DATE(ts.created_at) BETWEEN
                DATE_ADD(fs.first_date, INTERVAL 30 DAY) AND
                DATE_ADD(fs.first_date, INTERVAL 36 DAY)
        )
        SELECT
          fs.first_date as cohort_date,
          COUNT(DISTINCT fs.user_id_hash) as cohort_size,
          COUNT(DISTINCT d7.user_id_hash) as day7_retained,
          COUNT(DISTINCT d30.user_id_hash) as day30_retained
        FROM first_session fs
        LEFT JOIN day7_activity d7
          ON fs.user_id_hash = d7.user_id_hash
        LEFT JOIN day30_activity d30
          ON fs.user_id_hash = d30.user_id_hash
        WHERE fs.first_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
          AND fs.first_date <= DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY)
        GROUP BY cohort_date
        ORDER BY cohort_date DESC
        LIMIT 10
      `;

      const [rows] = await bigquery.query({ query });

      const cohorts = (
        rows as Array<{
          cohort_date: { value: string };
          cohort_size: number;
          day7_retained: number;
          day30_retained: number;
        }>
      ).map((row) => {
        const cohortSize = Number(row.cohort_size) || 0;
        return {
          cohortDate: row.cohort_date.value,
          cohortSize,
          day7Retention:
            cohortSize > 0
              ? Math.round((Number(row.day7_retained) / cohortSize) * 100 * 10) /
                10
              : 0,
          day30Retention:
            cohortSize > 0
              ? Math.round(
                  (Number(row.day30_retained) / cohortSize) * 100 * 10,
                ) / 10
              : 0,
        };
      });

      const averageDay7Retention =
        cohorts.length > 0
          ? Math.round(
              (cohorts.reduce((sum, c) => sum + c.day7Retention, 0) /
                cohorts.length) *
                10,
            ) / 10
          : 0;

      const averageDay30Retention =
        cohorts.length > 0
          ? Math.round(
              (cohorts.reduce((sum, c) => sum + c.day30Retention, 0) /
                cohorts.length) *
                10,
            ) / 10
          : 0;

      return {
        cohorts,
        averageDay7Retention,
        averageDay30Retention,
      };
    } catch (error) {
      logger.error("Failed to get retention analysis", error as Error);
      throw new HttpsError("internal", "リテンション分析の取得に失敗しました");
    }
  },
);

/**
 * 全体統計レスポンス型
 */
interface OverallStatsResponse {
  totalUsers: number;
  totalSessions: number;
  totalHours: number;
  averageScore: number;
  averageReps: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * 全体統計を取得
 */
export const analytics_getOverallStats = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<OverallStatsResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const { days = 30 } = request.data as { days?: number };
    const periodDays = Math.min(Math.max(days, 1), 365);

    logger.info("Getting overall stats", {
      userId: request.auth.uid,
      periodDays,
    });

    try {
      const query = `
        SELECT
          COUNT(DISTINCT user_id_hash) as total_users,
          COUNT(*) as total_sessions,
          COALESCE(SUM(duration_seconds), 0) / 3600.0 as total_hours,
          AVG(average_score) as avg_score,
          AVG(rep_count) as avg_reps
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @period_days DAY)
      `;

      const [rows] = await bigquery.query({
        query,
        params: { period_days: periodDays },
      });

      const stats = (
        rows as Array<{
          total_users: number;
          total_sessions: number;
          total_hours: number;
          avg_score: number;
          avg_reps: number;
        }>
      )[0];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      return {
        totalUsers: Number(stats.total_users) || 0,
        totalSessions: Number(stats.total_sessions) || 0,
        totalHours: Math.round((Number(stats.total_hours) || 0) * 10) / 10,
        averageScore: Math.round((Number(stats.avg_score) || 0) * 10) / 10,
        averageReps: Math.round((Number(stats.avg_reps) || 0) * 10) / 10,
        period: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
      };
    } catch (error) {
      logger.error("Failed to get overall stats", error as Error);
      throw new HttpsError("internal", "全体統計の取得に失敗しました");
    }
  },
);
