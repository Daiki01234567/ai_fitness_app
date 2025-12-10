/**
 * 同意監査ログ API
 *
 * 管理者向けの監査ログ検索機能
 * GDPR監査対応・コンプライアンス用途
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
 * 監査ログ検索リクエスト
 */
interface SearchAuditLogsRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  action?: "accept" | "revoke" | "all";
  consentType?: "tos" | "privacy_policy" | "marketing" | "all";
  limit?: number;
  offset?: number;
}

/**
 * 監査ログエントリ
 */
interface AuditLogEntry {
  consentId: string;
  userId: string;
  consentType: string;
  documentVersion: string | null;
  action: string;
  timestamp: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SearchAuditLogsResponse {
  success: true;
  data: {
    logs: AuditLogEntry[];
    total: number;
    limit: number;
    offset: number;
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
 * 監査ログ検索（管理者専用）
 *
 * 管理者向けの監査ログ複合検索（GDPR監査対応）
 */
export const consent_searchAuditLogs = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<SearchAuditLogsRequest>): Promise<SearchAuditLogsResponse> => {
    const startTime = Date.now();

    // Admin permission check
    await requireAdmin(request);

    const adminUid = request.auth!.uid;
    const data = request.data || {};

    // Rate limiting for admin
    await rateLimiter.check("ADMIN_CONSENT_AUDIT", adminUid);

    // Validate and set defaults
    const limit = Math.min(data.limit || 50, 500); // Max 500
    const offset = data.offset || 0;

    logger.info("Searching consent audit logs", {
      adminUid,
      filters: {
        userId: data.userId,
        startDate: data.startDate,
        endDate: data.endDate,
        action: data.action,
        consentType: data.consentType,
      },
    });

    try {
      // Build query
      let query: FirebaseFirestore.Query = db
        .collection("consents")
        .orderBy("createdAt", "desc");

      // Filter by user ID
      if (data.userId) {
        query = query.where("userId", "==", data.userId);
      }

      // Filter by consent type
      if (data.consentType && data.consentType !== "all") {
        query = query.where("consentType", "==", data.consentType);
      }

      // Filter by action
      if (data.action && data.action !== "all") {
        query = query.where("action", "==", data.action);
      }

      // Filter by date range
      if (data.startDate) {
        const startTimestamp = Timestamp.fromDate(new Date(data.startDate));
        query = query.where("createdAt", ">=", startTimestamp);
      }

      if (data.endDate) {
        const endTimestamp = Timestamp.fromDate(new Date(data.endDate));
        query = query.where("createdAt", "<=", endTimestamp);
      }

      // Get total count
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Get paginated results
      const snapshot = await query.offset(offset).limit(limit).get();

      // Transform to response format
      const logs: AuditLogEntry[] = snapshot.docs.map((doc) => {
        const logData = doc.data();
        return {
          consentId: doc.id,
          userId: logData.userId,
          consentType: logData.consentType,
          documentVersion: logData.documentVersion || null,
          action: logData.action || "accept",
          timestamp: logData.createdAt?.toDate?.()?.toISOString() || null,
          ipAddress: logData.consentDetails?.ipAddress || null,
          userAgent: logData.consentDetails?.userAgent || null,
        };
      });

      logger.info("Consent audit logs search completed", {
        adminUid,
        total,
        returnedCount: logs.length,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          logs,
          total,
          limit,
          offset,
        },
      };
    } catch (error) {
      logger.error("Failed to search consent audit logs", error as Error, {
        adminUid,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "監査ログの検索に失敗しました");
    }
  },
);
