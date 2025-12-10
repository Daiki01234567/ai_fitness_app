/**
 * 同意履歴 API
 *
 * ユーザーの同意変更履歴を取得
 * GDPR Article 7（同意の条件）およびArticle 15（アクセス権）に準拠
 *
 * 参照: docs/common/tickets/020-gdpr-consent-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuth } from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import { logger } from "../../utils/logger";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 同意履歴リクエスト
 */
interface GetHistoryRequest {
  startDate?: string;
  endDate?: string;
  consentType?: "tos" | "privacy_policy" | "marketing" | "all";
  limit?: number;
  offset?: number;
}

/**
 * 同意履歴レスポンス
 */
interface ConsentHistoryItem {
  consentId: string;
  consentType: string;
  documentVersion: string | null;
  action: string;
  timestamp: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface GetHistoryResponse {
  success: true;
  data: {
    history: ConsentHistoryItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * 同意履歴一覧を取得
 *
 * ユーザー本人の同意変更履歴を時系列で取得（GDPR Article 15対応）
 */
export const consent_getHistory = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request: CallableRequest<GetHistoryRequest>): Promise<GetHistoryResponse> => {
    const startTime = Date.now();

    // Authentication check (own data only)
    const auth = await requireAuth(request);
    const userId = auth.uid;

    const data = request.data || {};

    // Rate limiting
    await rateLimiter.check("CONSENT_HISTORY", userId);

    // Validate and set defaults
    const limit = Math.min(data.limit || 20, 100); // Max 100
    const offset = data.offset || 0;

    logger.info("Getting consent history", { userId, limit, offset });

    try {
      // Build query
      let query: FirebaseFirestore.Query = db
        .collection("consents")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc");

      // Filter by consent type
      if (data.consentType && data.consentType !== "all") {
        query = query.where("consentType", "==", data.consentType);
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

      // Get total count for pagination
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Get paginated results
      const snapshot = await query.offset(offset).limit(limit + 1).get();
      const hasMore = snapshot.docs.length > limit;
      const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

      // Transform to response format
      const history: ConsentHistoryItem[] = docs.map((doc) => {
        const consentData = doc.data();
        return {
          consentId: doc.id,
          consentType: consentData.consentType,
          documentVersion: consentData.documentVersion || null,
          action: consentData.action || "accept",
          timestamp: consentData.createdAt?.toDate?.()?.toISOString() || null,
          ipAddress: consentData.consentDetails?.ipAddress || null,
          userAgent: consentData.consentDetails?.userAgent || null,
        };
      });

      logger.info("Consent history retrieved", {
        userId,
        count: history.length,
        total,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          history,
          total,
          limit,
          offset,
          hasMore,
        },
      };
    } catch (error) {
      logger.error("Failed to get consent history", error as Error, { userId });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "同意履歴の取得に失敗しました");
    }
  },
);
