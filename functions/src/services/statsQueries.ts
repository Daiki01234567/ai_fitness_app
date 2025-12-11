/**
 * 統計API用BigQueryクエリサービス
 *
 * DAU/MAU、トレーニング統計、継続率などの統計クエリを提供
 *
 * 参照: docs/common/specs/05_BigQuery設計書_v1_0.md
 * 参照: docs/common/tickets/045-usage-statistics-api.md
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import { BigQuery } from "@google-cloud/bigquery";
import * as admin from "firebase-admin";

import {
  ActiveUsersStats,
  AdminUserStats,
  DAUQueryResult,
  DailyTrainingQueryResult,
  ExerciseStatsQueryResult,
  MAUQueryResult,
  PreviousMAUQueryResult,
  RetentionQueryResult,
  RetentionStats,
  StatsPeriod,
  STATS_CONSTANTS,
  TrainingStats,
  TrainingTotalQueryResult,
} from "../types/admin";
import { getFirestore } from "../utils/firestore";
import { logger } from "../utils/logger";

// BigQuery設定
const PROJECT_ID = STATS_CONSTANTS.BIGQUERY_PROJECT_ID;
const DATASET_ID = STATS_CONSTANTS.BIGQUERY_DATASET;
const SESSIONS_TABLE = STATS_CONSTANTS.BIGQUERY_SESSIONS_TABLE;
const FULL_TABLE_ID = `\`${PROJECT_ID}.${DATASET_ID}.${SESSIONS_TABLE}\``;

/**
 * 統計クエリサービスクラス
 */
export class StatsQueryService {
  private bigquery: BigQuery;

  constructor() {
    this.bigquery = new BigQuery({ projectId: PROJECT_ID });
  }

  /**
   * 期間を日数に変換
   */
  private periodToDays(period: StatsPeriod): number {
    return STATS_CONSTANTS.PERIOD_TO_DAYS[period];
  }

  // ==========================================================================
  // DAU/MAU統計
  // ==========================================================================

  /**
   * DAU/MAU統計を取得
   *
   * @param period - 集計期間（7d, 30d, 90d）
   * @returns DAU/MAU統計
   */
  async getActiveUsersStats(period: StatsPeriod): Promise<ActiveUsersStats> {
    const days = this.periodToDays(period);

    logger.info("Fetching active users stats", { period, days });

    try {
      // DAU、MAU、前期間MAUを並列で取得
      const [dauResult, mauResult, previousMauResult] = await Promise.all([
        this.queryDAU(days),
        this.queryMAU(),
        this.queryPreviousMAU(days),
      ]);

      // 増減率を計算
      const changeRate = previousMauResult > 0
        ? ((mauResult - previousMauResult) / previousMauResult) * 100
        : 0;

      return {
        dau: dauResult,
        mau: mauResult,
        previousMAU: previousMauResult,
        changeRate: Math.round(changeRate * 100) / 100,
        period,
      };
    } catch (error) {
      logger.error("Failed to fetch active users stats", error as Error, { period });
      throw error;
    }
  }

  /**
   * DAUクエリを実行
   */
  private async queryDAU(days: number): Promise<{ date: string; count: number }[]> {
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT user_hash) as dau
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY date
      ORDER BY date DESC
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as DAUQueryResult[];

    return typedRows.map((row) => ({
      date: typeof row.date === "object" && row.date.value ? row.date.value : String(row.date),
      count: row.dau,
    }));
  }

  /**
   * MAUクエリを実行（過去30日）
   */
  private async queryMAU(): Promise<number> {
    const query = `
      SELECT
        COUNT(DISTINCT user_hash) as mau
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as MAUQueryResult[];
    return typedRows[0]?.mau || 0;
  }

  /**
   * 前期間のMAUクエリを実行
   */
  private async queryPreviousMAU(days: number): Promise<number> {
    const query = `
      SELECT
        COUNT(DISTINCT user_hash) as previous_mau
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
        AND created_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as PreviousMAUQueryResult[];
    return typedRows[0]?.previous_mau || 0;
  }

  // ==========================================================================
  // トレーニング統計
  // ==========================================================================

  /**
   * トレーニング統計を取得
   *
   * @param period - 集計期間（7d, 30d, 90d）
   * @returns トレーニング統計
   */
  async getTrainingStats(period: StatsPeriod): Promise<TrainingStats> {
    const days = this.periodToDays(period);

    logger.info("Fetching training stats", { period, days });

    try {
      // 総計、種目別、日別を並列で取得
      const [totalResult, exerciseResult, dailyResult] = await Promise.all([
        this.queryTrainingTotal(days),
        this.queryExerciseStats(days),
        this.queryDailyTraining(days),
      ]);

      return {
        total: totalResult,
        byExercise: exerciseResult,
        daily: dailyResult,
        period,
      };
    } catch (error) {
      logger.error("Failed to fetch training stats", error as Error, { period });
      throw error;
    }
  }

  /**
   * トレーニング総計クエリを実行
   */
  private async queryTrainingTotal(days: number): Promise<{
    sessions: number;
    avgDuration: number;
    avgScore: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_sessions,
        AVG(duration_seconds) as avg_duration,
        AVG(average_score) as avg_score
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as TrainingTotalQueryResult[];
    const row = typedRows[0];

    return {
      sessions: row?.total_sessions || 0,
      avgDuration: Math.round(row?.avg_duration || 0),
      avgScore: Math.round((row?.avg_score || 0) * 100) / 100,
    };
  }

  /**
   * 種目別統計クエリを実行
   */
  private async queryExerciseStats(days: number): Promise<{
    exerciseType: string;
    count: number;
    avgScore: number;
  }[]> {
    const query = `
      SELECT
        exercise_type,
        COUNT(*) as count,
        AVG(average_score) as avg_score
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY exercise_type
      ORDER BY count DESC
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as ExerciseStatsQueryResult[];

    return typedRows.map((row) => ({
      exerciseType: row.exercise_type,
      count: row.count,
      avgScore: Math.round((row.avg_score || 0) * 100) / 100,
    }));
  }

  /**
   * 日別トレーニング数クエリを実行
   */
  private async queryDailyTraining(days: number): Promise<{
    date: string;
    count: number;
  }[]> {
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM ${FULL_TABLE_ID}
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY date
      ORDER BY date DESC
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as DailyTrainingQueryResult[];

    return typedRows.map((row) => ({
      date: typeof row.date === "object" && row.date.value ? row.date.value : String(row.date),
      count: row.count,
    }));
  }

  // ==========================================================================
  // ユーザー統計（Firestore集計）
  // ==========================================================================

  /**
   * ユーザー統計を取得（Firestoreから集計）
   *
   * @param period - 集計期間（7d, 30d, 90d）
   * @returns ユーザー統計
   */
  async getUserStats(period: StatsPeriod): Promise<AdminUserStats> {
    const days = this.periodToDays(period);
    const db = getFirestore();

    logger.info("Fetching user stats from Firestore", { period, days });

    try {
      const now = admin.firestore.Timestamp.now();
      const periodAgo = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - days * 24 * 60 * 60 * 1000,
      );

      // 並列でカウントを取得
      const [
        totalSnapshot,
        newSnapshot,
        premiumSnapshot,
        deletionScheduledSnapshot,
        disabledSnapshot,
      ] = await Promise.all([
        db.collection("users").count().get(),
        db.collection("users").where("createdAt", ">=", periodAgo).count().get(),
        db.collection("users").where("subscriptionStatus", "==", "premium").count().get(),
        db.collection("users").where("deletionScheduled", "==", true).count().get(),
        db.collection("users").where("disabled", "==", true).count().get(),
      ]);

      const total = totalSnapshot.data().count;
      const newUsers = newSnapshot.data().count;
      const premium = premiumSnapshot.data().count;
      const deletionScheduled = deletionScheduledSnapshot.data().count;
      const disabled = disabledSnapshot.data().count;

      return {
        total,
        new: newUsers,
        byPlan: {
          free: total - premium,
          premium,
        },
        deletionScheduled,
        disabled,
        period,
      };
    } catch (error) {
      logger.error("Failed to fetch user stats", error as Error, { period });
      throw error;
    }
  }

  // ==========================================================================
  // 継続率統計
  // ==========================================================================

  /**
   * 継続率統計を取得（コホート分析）
   *
   * @returns 継続率統計（7日間、30日間）
   */
  async getRetentionStats(): Promise<RetentionStats> {
    logger.info("Fetching retention stats");

    try {
      // 7日間と30日間の継続率を並列で取得
      const [retention7d, retention30d] = await Promise.all([
        this.queryRetention(7),
        this.queryRetention(30),
      ]);

      return {
        retention7d,
        retention30d,
      };
    } catch (error) {
      logger.error("Failed to fetch retention stats", error as Error);
      throw error;
    }
  }

  /**
   * 継続率クエリを実行（コホート分析）
   *
   * @param retentionDays - 継続日数（7または30）
   * @returns 継続率詳細
   */
  private async queryRetention(retentionDays: number): Promise<{
    totalUsers: number;
    returningUsers: number;
    rate: number;
  }> {
    // コホート分析期間：継続日数の2倍+追加7日間を分析
    const lookbackDays = retentionDays === 7 ? 30 : 60;

    const query = `
      WITH user_first_session AS (
        SELECT
          user_hash,
          MIN(DATE(created_at)) as first_date
        FROM ${FULL_TABLE_ID}
        WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${lookbackDays} DAY)
        GROUP BY user_hash
      ),
      returning_users AS (
        SELECT DISTINCT
          u.user_hash
        FROM user_first_session u
        JOIN ${FULL_TABLE_ID} s
          ON u.user_hash = s.user_hash
        WHERE DATE(s.created_at) >= DATE_ADD(u.first_date, INTERVAL ${retentionDays} DAY)
          AND DATE(s.created_at) < DATE_ADD(u.first_date, INTERVAL ${retentionDays + 7} DAY)
      )
      SELECT
        COUNT(DISTINCT u.user_hash) as total_users,
        COUNT(DISTINCT r.user_hash) as returning_users,
        SAFE_DIVIDE(COUNT(DISTINCT r.user_hash), COUNT(DISTINCT u.user_hash)) * 100 as retention_rate
      FROM user_first_session u
      LEFT JOIN returning_users r ON u.user_hash = r.user_hash
    `;

    const [rows] = await this.bigquery.query({ query });
    const typedRows = rows as RetentionQueryResult[];
    const row = typedRows[0];

    return {
      totalUsers: row?.total_users || 0,
      returningUsers: row?.returning_users || 0,
      rate: Math.round((row?.retention_rate || 0) * 100) / 100,
    };
  }
}

// シングルトンインスタンスをエクスポート
export const statsQueryService = new StatsQueryService();
