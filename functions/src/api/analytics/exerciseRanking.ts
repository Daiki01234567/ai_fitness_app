/**
 * 種目別ランキングAPI
 *
 * 全ユーザーの種目別統計とランキング情報を取得
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション7.1.2
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BigQuery } from "@google-cloud/bigquery";

import { logger } from "../../utils/logger";

// BigQuery設定
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "tokyo-list-478804-e5";
const DATASET_ID = "fitness_analytics";

const bigquery = new BigQuery({ projectId: PROJECT_ID });

/**
 * 種目統計レスポンス型
 */
interface ExerciseStatsResponse {
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    totalSessions: number;
    totalUsers: number;
    averageScore: number;
    averageReps: number;
    averageDurationMinutes: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * 種目別統計を取得
 *
 * 集計テーブルを使用してコスト効率を最大化
 */
export const analytics_getExerciseStats = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<ExerciseStatsResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const { days = 30 } = request.data as { days?: number };

    // 期間の制限（最大365日）
    const periodDays = Math.min(Math.max(days, 1), 365);

    logger.info("Getting exercise stats", {
      userId: request.auth.uid,
      periodDays,
    });

    try {
      // 集計テーブルを使用したクエリ（コスト削減99%）
      const query = `
        SELECT
          ast.exercise_id,
          COALESCE(ed.exercise_name_ja, ast.exercise_id) as exercise_name,
          SUM(ast.total_sessions) as total_sessions,
          SUM(ast.total_users) as total_users,
          AVG(ast.average_score) as average_score,
          AVG(ast.average_rep_count) as average_reps,
          SAFE_DIVIDE(SUM(ast.total_duration_seconds), SUM(ast.total_sessions)) / 60.0 as avg_duration_minutes
        FROM \`${PROJECT_ID}.${DATASET_ID}.aggregated_stats\` ast
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.exercise_definitions\` ed
          ON ast.exercise_id = ed.exercise_id
        WHERE ast.stat_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @period_days DAY)
        GROUP BY ast.exercise_id, ed.exercise_name_ja
        ORDER BY total_sessions DESC
      `;

      const [rows] = await bigquery.query({
        query,
        params: { period_days: periodDays },
      });

      // 期間の計算
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      return {
        exercises: (
          rows as Array<{
            exercise_id: string;
            exercise_name: string;
            total_sessions: number;
            total_users: number;
            average_score: number;
            average_reps: number;
            avg_duration_minutes: number;
          }>
        ).map((row) => ({
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          totalSessions: Number(row.total_sessions) || 0,
          totalUsers: Number(row.total_users) || 0,
          averageScore: Number(row.average_score) || 0,
          averageReps: Number(row.average_reps) || 0,
          averageDurationMinutes: Number(row.avg_duration_minutes) || 0,
        })),
        period: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
      };
    } catch (error) {
      logger.error("Failed to get exercise stats", error as Error);
      throw new HttpsError("internal", "種目統計の取得に失敗しました");
    }
  },
);

/**
 * スコア分布レスポンス型
 */
interface ScoreDistributionResponse {
  exerciseId: string;
  distribution: Array<{
    scoreRange: string;
    count: number;
    percentage: number;
  }>;
  totalSessions: number;
}

/**
 * 種目別スコア分布を取得
 */
export const analytics_getScoreDistribution = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<ScoreDistributionResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const { exerciseId, days = 30 } = request.data as {
      exerciseId: string;
      days?: number;
    };

    if (!exerciseId) {
      throw new HttpsError("invalid-argument", "exerciseIdは必須です");
    }

    const periodDays = Math.min(Math.max(days, 1), 365);

    logger.info("Getting score distribution", {
      userId: request.auth.uid,
      exerciseId,
      periodDays,
    });

    try {
      const query = `
        SELECT
          CASE
            WHEN average_score >= 90 THEN '90-100'
            WHEN average_score >= 80 THEN '80-89'
            WHEN average_score >= 70 THEN '70-79'
            WHEN average_score >= 60 THEN '60-69'
            ELSE '0-59'
          END as score_range,
          COUNT(*) as session_count
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE is_deleted = FALSE
          AND average_score IS NOT NULL
          AND exercise_id = @exercise_id
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @period_days DAY)
        GROUP BY score_range
        ORDER BY score_range DESC
      `;

      const [rows] = await bigquery.query({
        query,
        params: {
          exercise_id: exerciseId,
          period_days: periodDays,
        },
      });

      const distribution = rows as Array<{
        score_range: string;
        session_count: number;
      }>;

      const totalSessions = distribution.reduce(
        (sum, row) => sum + Number(row.session_count),
        0,
      );

      return {
        exerciseId,
        distribution: distribution.map((row) => ({
          scoreRange: row.score_range,
          count: Number(row.session_count),
          percentage:
            totalSessions > 0
              ? Math.round(
                  (Number(row.session_count) / totalSessions) * 100 * 10,
                ) / 10
              : 0,
        })),
        totalSessions,
      };
    } catch (error) {
      logger.error("Failed to get score distribution", error as Error, {
        exerciseId,
      });
      throw new HttpsError("internal", "スコア分布の取得に失敗しました");
    }
  },
);
