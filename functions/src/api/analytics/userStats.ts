/**
 * ユーザー統計API
 *
 * 個人のトレーニング統計を取得
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション7
 */

import * as crypto from "crypto";

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BigQuery } from "@google-cloud/bigquery";

import { logger } from "../../utils/logger";

// BigQuery設定
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "tokyo-list-478804-e5";
const DATASET_ID = "fitness_analytics";

const bigquery = new BigQuery({ projectId: PROJECT_ID });

/**
 * ユーザーIDをハッシュ化
 */
function hashUserId(userId: string): string {
  const salt = process.env.ANONYMIZATION_SALT ?? "fitness-app-salt";
  return crypto
    .createHash("sha256")
    .update(userId + salt)
    .digest("hex");
}

/**
 * ユーザー統計レスポンス型
 */
interface UserStatsResponse {
  totalSessions: number;
  totalReps: number;
  totalDuration: number;
  averageScore: number;
  lastSessionDate: string | null;
  exerciseBreakdown: Array<{
    exerciseId: string;
    sessions: number;
    avgScore: number;
    totalReps: number;
  }>;
  weeklyProgress: Array<{
    weekStart: string;
    sessions: number;
    avgScore: number;
  }>;
}

/**
 * ユーザー統計を取得
 */
export const analytics_getUserStats = onCall(
  {
    region: "asia-northeast1",
  },
  async (request): Promise<UserStatsResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const userIdHash = hashUserId(userId);

    logger.info("Getting user stats", {
      userId,
      userIdHash: userIdHash.substring(0, 8) + "...",
    });

    try {
      // 基本統計クエリ
      const basicStatsQuery = `
        SELECT
          COUNT(*) as total_sessions,
          COALESCE(SUM(rep_count), 0) as total_reps,
          COALESCE(SUM(duration_seconds), 0) as total_duration,
          COALESCE(AVG(average_score), 0) as average_score,
          MAX(created_at) as last_session_date
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE user_id_hash = @user_id_hash
          AND is_deleted = FALSE
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 730 DAY)
      `;

      const [basicStats] = await bigquery.query({
        query: basicStatsQuery,
        params: { user_id_hash: userIdHash },
      });

      // 種目別内訳クエリ
      const exerciseBreakdownQuery = `
        SELECT
          exercise_id,
          COUNT(*) as sessions,
          AVG(average_score) as avg_score,
          SUM(rep_count) as total_reps
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE user_id_hash = @user_id_hash
          AND is_deleted = FALSE
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 730 DAY)
        GROUP BY exercise_id
        ORDER BY sessions DESC
      `;

      const [exerciseBreakdown] = await bigquery.query({
        query: exerciseBreakdownQuery,
        params: { user_id_hash: userIdHash },
      });

      // 週間進捗クエリ（過去12週）
      const weeklyProgressQuery = `
        SELECT
          DATE_TRUNC(DATE(created_at), WEEK) as week_start,
          COUNT(*) as sessions,
          AVG(average_score) as avg_score
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\`
        WHERE user_id_hash = @user_id_hash
          AND is_deleted = FALSE
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 84 DAY)
        GROUP BY week_start
        ORDER BY week_start DESC
        LIMIT 12
      `;

      const [weeklyProgress] = await bigquery.query({
        query: weeklyProgressQuery,
        params: { user_id_hash: userIdHash },
      });

      const stats = basicStats[0] as {
        total_sessions: number;
        total_reps: number;
        total_duration: number;
        average_score: number;
        last_session_date: { value: string } | null;
      };

      return {
        totalSessions: Number(stats.total_sessions) || 0,
        totalReps: Number(stats.total_reps) || 0,
        totalDuration: Number(stats.total_duration) || 0,
        averageScore: Number(stats.average_score) || 0,
        lastSessionDate: stats.last_session_date?.value ?? null,
        exerciseBreakdown: (
          exerciseBreakdown as Array<{
            exercise_id: string;
            sessions: number;
            avg_score: number;
            total_reps: number;
          }>
        ).map((row) => ({
          exerciseId: row.exercise_id,
          sessions: Number(row.sessions),
          avgScore: Number(row.avg_score),
          totalReps: Number(row.total_reps),
        })),
        weeklyProgress: (
          weeklyProgress as Array<{
            week_start: { value: string };
            sessions: number;
            avg_score: number;
          }>
        ).map((row) => ({
          weekStart: row.week_start.value,
          sessions: Number(row.sessions),
          avgScore: Number(row.avg_score),
        })),
      };
    } catch (error) {
      logger.error("Failed to get user stats", error as Error, { userId });
      throw new HttpsError("internal", "統計情報の取得に失敗しました");
    }
  },
);
