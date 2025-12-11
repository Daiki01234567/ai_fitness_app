/**
 * BigQuery 日次集計ジョブ
 *
 * 日次でトレーニングセッションの統計を集計
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション5.3.1, 5.3.2
 */

import { BigQuery } from "@google-cloud/bigquery";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { logger } from "../utils/logger";

// BigQuery設定
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "tokyo-list-478804-e5";
const DATASET_ID = "fitness_analytics";

const bigquery = new BigQuery({ projectId: PROJECT_ID });

/**
 * 日次集計処理
 *
 * 毎日午前2時（JST）に前日のデータを集計
 */
export const scheduled_dailyAggregation = onSchedule(
  {
    schedule: "0 2 * * *", // 毎日午前2時（JST）
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540, // 9分
  },
  async () => {
    const startTime = Date.now();

    // 昨日の日付を取得
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const statDate = yesterday.toISOString().split("T")[0];

    logger.info(`Starting daily aggregation for ${statDate}`);

    try {
      // 1. aggregated_stats テーブルに集計データを挿入
      await runAggregationQuery(statDate);

      // 2. user_metadata テーブルを更新
      await updateUserMetadata(statDate);

      const duration = Date.now() - startTime;
      logger.info(`Daily aggregation completed for ${statDate}`, {
        durationMs: duration,
      });
    } catch (error) {
      logger.error("Daily aggregation failed", error as Error, {
        statDate,
      });
      throw error;
    }
  },
);

/**
 * 集計クエリを実行
 */
async function runAggregationQuery(statDate: string): Promise<void> {
  // 既存の集計データを削除（べき等性のため）
  const deleteQuery = `
    DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.aggregated_stats\`
    WHERE stat_date = DATE(@stat_date)
  `;

  await bigquery.query({
    query: deleteQuery,
    params: { stat_date: statDate },
  });

  logger.info("Deleted existing aggregation data", { statDate });

  // 集計クエリを実行
  const insertQuery = `
    INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.aggregated_stats\`
    (stat_date, exercise_id, age_group, country_code,
     total_sessions, total_users, total_duration_seconds,
     average_score, average_rep_count, created_at)
    SELECT
      DATE(@stat_date) as stat_date,
      ts.exercise_id,
      um.age_group,
      COALESCE(um.country_code, 'JP') as country_code,
      COUNT(*) as total_sessions,
      COUNT(DISTINCT ts.user_id_hash) as total_users,
      SUM(ts.duration_seconds) as total_duration_seconds,
      AVG(ts.average_score) as average_score,
      AVG(ts.rep_count) as average_rep_count,
      CURRENT_TIMESTAMP() as created_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
    LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.user_metadata\` um
      ON ts.user_id_hash = um.user_id_hash
    WHERE DATE(ts.created_at) = DATE(@stat_date)
      AND ts.is_deleted = FALSE
    GROUP BY ts.exercise_id, um.age_group, um.country_code
  `;

  const [job] = await bigquery.createQueryJob({
    query: insertQuery,
    params: { stat_date: statDate },
  });

  // ジョブ完了を待機
  const [rows] = await job.getQueryResults();

  logger.info("Aggregation query completed", {
    statDate,
    rowsAffected: rows.length,
  });
}

/**
 * user_metadata テーブルを更新
 *
 * セッションデータに基づいてユーザーの統計情報を更新
 */
async function updateUserMetadata(statDate: string): Promise<void> {
  // 新規ユーザーのメタデータを挿入
  const insertNewUsersQuery = `
    INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.user_metadata\`
    (user_id_hash, age_group, country_code, created_at, updated_at, is_deleted)
    SELECT DISTINCT
      ts.user_id_hash,
      'unknown' as age_group,
      'JP' as country_code,
      MIN(ts.created_at) as created_at,
      CURRENT_TIMESTAMP() as updated_at,
      FALSE as is_deleted
    FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
    LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.user_metadata\` um
      ON ts.user_id_hash = um.user_id_hash
    WHERE um.user_id_hash IS NULL
      AND DATE(ts.created_at) = DATE(@stat_date)
    GROUP BY ts.user_id_hash
  `;

  const [insertJob] = await bigquery.createQueryJob({
    query: insertNewUsersQuery,
    params: { stat_date: statDate },
  });

  await insertJob.getQueryResults();

  // 既存ユーザーの updated_at を更新
  const updateExistingQuery = `
    UPDATE \`${PROJECT_ID}.${DATASET_ID}.user_metadata\` um
    SET updated_at = CURRENT_TIMESTAMP()
    WHERE EXISTS (
      SELECT 1 FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
      WHERE ts.user_id_hash = um.user_id_hash
        AND DATE(ts.created_at) = DATE(@stat_date)
    )
  `;

  const [updateJob] = await bigquery.createQueryJob({
    query: updateExistingQuery,
    params: { stat_date: statDate },
  });

  await updateJob.getQueryResults();

  logger.info("User metadata updated", { statDate });
}

/**
 * 週次集計処理（オプション）
 *
 * 毎週月曜午前3時（JST）に実行
 */
export const scheduled_weeklyAggregation = onSchedule(
  {
    schedule: "0 3 * * 1", // 毎週月曜午前3時（JST）
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const startTime = Date.now();

    // 先週の日曜日を計算
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);

    const startDate = lastMonday.toISOString().split("T")[0];
    const endDate = lastSunday.toISOString().split("T")[0];

    logger.info(`Starting weekly aggregation for ${startDate} to ${endDate}`);

    try {
      // 週次の集計統計クエリ
      const weeklyQuery = `
        SELECT
          DATE_TRUNC(DATE(ts.created_at), WEEK) as week_start,
          ts.exercise_id,
          COUNT(*) as total_sessions,
          COUNT(DISTINCT ts.user_id_hash) as unique_users,
          AVG(ts.average_score) as avg_score,
          SUM(ts.duration_seconds) as total_duration
        FROM \`${PROJECT_ID}.${DATASET_ID}.training_sessions\` ts
        WHERE DATE(ts.created_at) BETWEEN DATE(@start_date) AND DATE(@end_date)
          AND ts.is_deleted = FALSE
        GROUP BY week_start, ts.exercise_id
        ORDER BY week_start, ts.exercise_id
      `;

      const [rows] = await bigquery.query({
        query: weeklyQuery,
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      const duration = Date.now() - startTime;
      logger.info("Weekly aggregation completed", {
        startDate,
        endDate,
        rowCount: rows.length,
        durationMs: duration,
      });
    } catch (error) {
      logger.error("Weekly aggregation failed", error as Error);
      throw error;
    }
  },
);
