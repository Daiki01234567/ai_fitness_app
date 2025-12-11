/**
 * 利用統計API
 *
 * 管理者向けの利用統計データを提供するAPI
 * - DAU/MAU統計
 * - トレーニング統計
 * - ユーザー統計
 * - 継続率統計
 * - ダッシュボード統計
 *
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md（FR-027: 統計データ表示）
 * 参照: docs/common/tickets/045-usage-statistics-api.md
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { getAdminLevel } from "../../middleware/adminAuth";
import { statsQueryService } from "../../services/statsQueries";
import {
  ActiveUsersStats,
  AdminUserStats,
  DashboardStats,
  RetentionStats,
  StatsPeriod,
  StatsRequest,
  STATS_CONSTANTS,
  TrainingStats,
} from "../../types/admin";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";

// =============================================================================
// 管理者権限チェックヘルパー
// =============================================================================

/**
 * 管理者権限をチェック（admin, super_admin, supportのいずれか）
 *
 * @param request - Callableリクエスト
 * @throws 権限がない場合はHttpsErrorをスロー
 */
function requireAdminOrSupport(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  // DecodedIdTokenを直接渡す
  const level = getAdminLevel(request.auth.token);

  if (!level) {
    logger.warn("Stats API access denied - not admin", { hasAuth: !!request.auth, uid: request.auth.uid });
    throw new HttpsError("permission-denied", "この操作には管理者権限が必要です");
  }
}

/**
 * 期間パラメータをバリデート
 *
 * @param period - 期間パラメータ
 * @returns 有効な期間
 */
function validatePeriod(period?: string): StatsPeriod {
  if (!period) {
    return STATS_CONSTANTS.DEFAULT_PERIOD;
  }

  if (period !== "7d" && period !== "30d" && period !== "90d") {
    throw new HttpsError(
      "invalid-argument",
      "periodは7d, 30d, 90dのいずれかを指定してください",
    );
  }

  return period;
}

// =============================================================================
// DAU/MAU統計API
// =============================================================================

/**
 * DAU/MAU統計を取得（管理者専用）
 *
 * 日次アクティブユーザー数と月次アクティブユーザー数を取得します。
 * 前期間との比較データも含まれます。
 *
 * @param request.data.period - 集計期間（7d, 30d, 90d）
 * @returns DAU/MAU統計
 */
export const admin_getActiveUsersStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getActiveUsersStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as StatsRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching active users stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // BigQueryから統計を取得
      const stats: ActiveUsersStats = await statsQueryService.getActiveUsersStats(validPeriod);

      logger.functionEnd("admin_getActiveUsersStats", Date.now() - startTime, {
        period: validPeriod,
        dauCount: stats.dau.length,
        mau: stats.mau,
      });

      return success(stats, "アクティブユーザー統計を取得しました");
    } catch (error) {
      logger.error("admin_getActiveUsersStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "アクティブユーザー統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// トレーニング統計API
// =============================================================================

/**
 * トレーニング統計を取得（管理者専用）
 *
 * 総トレーニング回数、種目別統計、日別統計を取得します。
 *
 * @param request.data.period - 集計期間（7d, 30d, 90d）
 * @returns トレーニング統計
 */
export const admin_getTrainingStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getTrainingStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as StatsRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching training stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // BigQueryから統計を取得
      const stats: TrainingStats = await statsQueryService.getTrainingStats(validPeriod);

      logger.functionEnd("admin_getTrainingStats", Date.now() - startTime, {
        period: validPeriod,
        totalSessions: stats.total.sessions,
        exerciseTypes: stats.byExercise.length,
      });

      return success(stats, "トレーニング統計を取得しました");
    } catch (error) {
      logger.error("admin_getTrainingStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "トレーニング統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// ユーザー統計API
// =============================================================================

/**
 * ユーザー統計を取得（管理者専用）
 *
 * 総ユーザー数、新規ユーザー数、プラン別ユーザー数などを取得します。
 *
 * @param request.data.period - 集計期間（7d, 30d, 90d）
 * @returns ユーザー統計
 */
export const admin_getUserStats = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getUserStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as StatsRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching user stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // Firestoreから統計を取得
      const stats: AdminUserStats = await statsQueryService.getUserStats(validPeriod);

      logger.functionEnd("admin_getUserStats", Date.now() - startTime, {
        period: validPeriod,
        totalUsers: stats.total,
        newUsers: stats.new,
      });

      return success(stats, "ユーザー統計を取得しました");
    } catch (error) {
      logger.error("admin_getUserStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "ユーザー統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// 継続率統計API
// =============================================================================

/**
 * 継続率統計を取得（管理者専用）
 *
 * 7日間継続率と30日間継続率をコホート分析で計算します。
 *
 * @returns 継続率統計
 */
export const admin_getRetentionStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 180, // コホート分析は時間がかかる
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getRetentionStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      logger.info("Fetching retention stats", {
        adminId: request.auth?.uid,
      });

      // BigQueryから継続率統計を取得
      const stats: RetentionStats = await statsQueryService.getRetentionStats();

      logger.functionEnd("admin_getRetentionStats", Date.now() - startTime, {
        retention7d: stats.retention7d.rate,
        retention30d: stats.retention30d.rate,
      });

      return success(stats, "継続率統計を取得しました");
    } catch (error) {
      logger.error("admin_getRetentionStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "継続率統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// ダッシュボード統計API
// =============================================================================

/**
 * ダッシュボード統計を取得（管理者専用）
 *
 * 全統計（アクティブユーザー、トレーニング、ユーザー、継続率）を
 * まとめて取得します。
 *
 * @param request.data.period - 集計期間（7d, 30d, 90d）
 * @returns ダッシュボード統計
 */
export const admin_getDashboardStats = onCall(
  {
    region: "asia-northeast1",
    memory: "1GiB",
    timeoutSeconds: 300, // 全統計を並列取得するため長めに設定
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getDashboardStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as StatsRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching dashboard stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // 全統計を並列で取得
      const [activeUsers, training, users, retention] = await Promise.all([
        statsQueryService.getActiveUsersStats(validPeriod),
        statsQueryService.getTrainingStats(validPeriod),
        statsQueryService.getUserStats(validPeriod),
        statsQueryService.getRetentionStats(),
      ]);

      const stats: DashboardStats = {
        activeUsers,
        training,
        users,
        retention,
        period: validPeriod,
        generatedAt: new Date().toISOString(),
      };

      logger.functionEnd("admin_getDashboardStats", Date.now() - startTime, {
        period: validPeriod,
        mau: stats.activeUsers.mau,
        totalSessions: stats.training.total.sessions,
        totalUsers: stats.users.total,
      });

      return success(stats, "ダッシュボード統計を取得しました");
    } catch (error) {
      logger.error("admin_getDashboardStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "ダッシュボード統計の取得に失敗しました",
      );
    }
  },
);
