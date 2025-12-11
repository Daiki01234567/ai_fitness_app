/**
 * 同意統計 API
 *
 * 管理者向けの同意率統計レポート
 * ダッシュボード用データ整形機能
 *
 * 参照: docs/common/tickets/020-gdpr-consent-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { rateLimiter } from "../../middleware/rateLimiter";
import { logger } from "../../utils/logger";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 統計リクエスト
 */
interface GetStatisticsRequest {
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  consentType?: "tos" | "privacy_policy" | "marketing" | "all";
}

/**
 * 期間別統計
 */
interface PeriodStatistics {
  date: string;
  totalUsers: number;
  acceptedCount: number;
  revokedCount: number;
  acceptanceRate: number;
}

/**
 * 統計サマリー
 */
interface StatisticsSummary {
  totalAccepted: number;
  totalRevoked: number;
  averageAcceptanceRate: number;
}

interface GetStatisticsResponse {
  success: true;
  data: {
    period: "daily" | "weekly" | "monthly";
    statistics: PeriodStatistics[];
    summary: StatisticsSummary;
  };
}

/**
 * 管理者権限をチェック
 */
async function requireAdmin(request: CallableRequest<unknown>): Promise<void> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const claims = request.auth.token;
  if (!claims.admin) {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }
}

/**
 * 日付から期間キーを生成
 *
 * @param date - 対象日付
 * @param period - 期間タイプ
 * @returns 期間キー文字列
 */
function getPeriodKey(date: Date, period: "daily" | "weekly" | "monthly"): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (period === "daily") {
    return `${year}-${month}-${day}`;
  } else if (period === "weekly") {
    // ISO週番号を計算
    const weekNumber = getISOWeek(date);
    return `${year}-W${String(weekNumber).padStart(2, "0")}`;
  } else {
    return `${year}-${month}`;
  }
}

/**
 * ISO週番号を計算
 *
 * @param date - 対象日付
 * @returns ISO週番号
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * 同意率統計（管理者専用）
 *
 * 管理者向けの同意率統計レポート
 */
export const consent_getStatistics = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request: CallableRequest<GetStatisticsRequest>): Promise<GetStatisticsResponse> => {
    const startTime = Date.now();

    // Admin permission check
    await requireAdmin(request);

    const adminUid = request.auth!.uid;
    const data = request.data;

    // Validate required fields
    if (!data?.period) {
      throw new HttpsError("invalid-argument", "期間タイプが必要です");
    }
    if (!data.startDate || !data.endDate) {
      throw new HttpsError("invalid-argument", "開始日と終了日が必要です");
    }

    // Rate limiting for admin
    await rateLimiter.check("ADMIN_CONSENT_STATS", adminUid);

    logger.info("Getting consent statistics", {
      adminUid,
      period: data.period,
      startDate: data.startDate,
      endDate: data.endDate,
      consentType: data.consentType,
    });

    try {
      const startTimestamp = Timestamp.fromDate(new Date(data.startDate));
      const endTimestamp = Timestamp.fromDate(new Date(data.endDate));

      // Build query
      let query: FirebaseFirestore.Query = db
        .collection("consents")
        .where("createdAt", ">=", startTimestamp)
        .where("createdAt", "<=", endTimestamp);

      // Filter by consent type
      if (data.consentType && data.consentType !== "all") {
        query = query.where("consentType", "==", data.consentType);
      }

      // Get all matching documents
      const snapshot = await query.get();

      // Aggregate by period
      const statsMap = new Map<string, { accepted: number; revoked: number }>();

      snapshot.docs.forEach((doc) => {
        const logData = doc.data();
        const timestamp = logData.createdAt?.toDate();
        if (!timestamp) {return;}

        const periodKey = getPeriodKey(timestamp, data.period);

        const stats = statsMap.get(periodKey) || { accepted: 0, revoked: 0 };
        if (logData.action === "accept") {
          stats.accepted++;
        } else if (logData.action === "revoke") {
          stats.revoked++;
        }
        statsMap.set(periodKey, stats);
      });

      // Transform to response format and sort by date
      const statistics: PeriodStatistics[] = Array.from(statsMap.entries())
        .map(([date, stats]) => {
          const total = stats.accepted + stats.revoked;
          return {
            date,
            totalUsers: total,
            acceptedCount: stats.accepted,
            revokedCount: stats.revoked,
            acceptanceRate: total > 0 ? (stats.accepted / total) * 100 : 0,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate summary
      const totalAccepted = statistics.reduce((sum, s) => sum + s.acceptedCount, 0);
      const totalRevoked = statistics.reduce((sum, s) => sum + s.revokedCount, 0);
      const total = totalAccepted + totalRevoked;
      const averageAcceptanceRate = total > 0 ? (totalAccepted / total) * 100 : 0;

      const summary: StatisticsSummary = {
        totalAccepted,
        totalRevoked,
        averageAcceptanceRate,
      };

      logger.info("Consent statistics retrieved", {
        adminUid,
        period: data.period,
        totalRecords: snapshot.size,
        periodCount: statistics.length,
        totalAccepted,
        totalRevoked,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          period: data.period,
          statistics,
          summary,
        },
      };
    } catch (error) {
      logger.error("Failed to get consent statistics", error as Error, { adminUid });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "統計の取得に失敗しました");
    }
  },
);
