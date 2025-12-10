/**
 * フィードバック一覧取得 API
 *
 * ユーザー本人のフィードバック履歴を取得（ページネーション対応）
 *
 * 参照: docs/expo/tickets/024-user-feedback-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuth } from "../../middleware/auth";
import { requireCsrfProtection } from "../../middleware/csrf";
import { rateLimiter } from "../../middleware/rateLimiter";
import { getFirestore } from "../../utils/firestore";
import { logger } from "../../utils/logger";

import { FeedbackType, FeedbackDeviceInfo } from "./submit";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * List my feedbacks request
 */
export interface ListMyFeedbacksRequest {
  limit?: number;
  offset?: number;
  status?: "pending" | "in_review" | "resolved" | "closed" | "all";
  type?: FeedbackType | "all";
}

/**
 * Feedback item in response
 */
export interface FeedbackItem {
  feedbackId: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: "pending" | "in_review" | "resolved" | "closed";
  deviceInfo: FeedbackDeviceInfo;
  submittedAt: string | null;
  updatedAt: string | null;
}

/**
 * List my feedbacks response
 */
export interface ListMyFeedbacksResponse {
  feedbacks: FeedbackItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Firestore feedback document data shape
 */
interface FeedbackDocData {
  feedbackId?: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: "pending" | "in_review" | "resolved" | "closed";
  deviceInfo: FeedbackDeviceInfo;
  submittedAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * List user's own feedbacks
 *
 * Retrieves the authenticated user's feedback history with pagination.
 * Can filter by status and feedback type.
 *
 * @throws HttpsError - Authentication or query errors
 */
// eslint-disable-next-line camelcase
export const feedback_listMyFeedbacks = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (
    request: CallableRequest<ListMyFeedbacksRequest>,
  ): Promise<{ success: true; data: ListMyFeedbacksResponse }> => {
    const startTime = Date.now();

    // CSRF protection
    requireCsrfProtection(request);

    // Authentication check
    const auth = requireAuth(request);
    const userId = auth.uid;

    const data = request.data || {};

    // Rate limiting - reuse consent history rate limit as similar pattern
    await rateLimiter.check("CONSENT_HISTORY", userId);

    // Validate and set defaults
    const limit = Math.min(Math.max(data.limit || 20, 1), 100); // 1-100, default 20
    const offset = Math.max(data.offset || 0, 0);

    logger.info("Listing user feedbacks", {
      userId,
      limit,
      offset,
      status: data.status,
      type: data.type,
    });

    try {
      const db = getFirestore();

      // Build base query
      let query: FirebaseFirestore.Query = db
        .collection("feedbacks")
        .where("userId", "==", userId)
        .orderBy("submittedAt", "desc");

      // Filter by status
      if (data.status && data.status !== "all") {
        const validStatuses = ["pending", "in_review", "resolved", "closed"];
        if (!validStatuses.includes(data.status)) {
          throw new HttpsError(
            "invalid-argument",
            "ステータスが無効です。'pending', 'in_review', 'resolved', 'closed', 'all' のいずれかを指定してください",
          );
        }
        query = query.where("status", "==", data.status);
      }

      // Filter by type
      if (data.type && data.type !== "all") {
        const validTypes: FeedbackType[] = ["bug_report", "feature_request", "general_feedback", "other"];
        if (!validTypes.includes(data.type)) {
          throw new HttpsError(
            "invalid-argument",
            "フィードバックタイプが無効です",
          );
        }
        query = query.where("type", "==", data.type);
      }

      // Get total count for pagination
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Get paginated results (fetch one extra to check hasMore)
      const snapshot = await query.offset(offset).limit(limit + 1).get();
      const hasMore = snapshot.docs.length > limit;
      const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

      // Transform to response format
      const feedbacks: FeedbackItem[] = docs.map((doc) => {
        const feedbackData = doc.data() as FeedbackDocData;
        return {
          feedbackId: feedbackData.feedbackId || doc.id,
          type: feedbackData.type,
          subject: feedbackData.subject,
          message: feedbackData.message,
          status: feedbackData.status,
          deviceInfo: feedbackData.deviceInfo,
          submittedAt: feedbackData.submittedAt instanceof Timestamp
            ? feedbackData.submittedAt.toDate().toISOString()
            : null,
          updatedAt: feedbackData.updatedAt instanceof Timestamp
            ? feedbackData.updatedAt.toDate().toISOString()
            : null,
        };
      });

      logger.info("User feedbacks retrieved", {
        userId,
        count: feedbacks.length,
        total,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          feedbacks,
          total,
          limit,
          offset,
          hasMore,
        },
      };
    } catch (error) {
      // Re-throw HttpsError as is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to list feedbacks", error as Error, { userId });
      throw new HttpsError("internal", "フィードバック一覧の取得に失敗しました");
    }
  },
);
