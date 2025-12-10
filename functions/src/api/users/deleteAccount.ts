/**
 * アカウント削除リクエスト API
 *
 * GDPR 第17条（削除権）に基づくアカウント削除リクエスト
 * 30日間の猶予期間を設け、期間内であればキャンセル可能
 *
 * @version 1.0.0
 * @date 2025-12-10
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md
 * @see docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireStrictCsrfProtection } from "../../middleware/csrf";
import { logSecurityEvent } from "../../services/auditLog";
import {
  CancelAccountDeletionResponse,
  RequestAccountDeletionRequest,
  RequestAccountDeletionResponse,
  SuccessResponse,
} from "../../types/api";
import { logger } from "../../utils/logger";
import { isNonEmptyString } from "../../utils/validation";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Delete grace period in days (GDPR requirement)
 */
const DELETION_GRACE_PERIOD_DAYS = 30;

/**
 * Calculate scheduled deletion date
 */
function calculateScheduledDeletionDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + DELETION_GRACE_PERIOD_DAYS);
  return date;
}

/**
 * Extract client IP from request
 */
function getClientIp(rawRequest: unknown): string | undefined {
  if (!rawRequest || typeof rawRequest !== "object") {
    return undefined;
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  const xForwardedFor = headers?.["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = headers?.["x-real-ip"];
  if (typeof xRealIp === "string") {
    return xRealIp;
  }

  return undefined;
}

/**
 * Extract user agent from request
 */
function getUserAgent(rawRequest: unknown): string | undefined {
  if (!rawRequest || typeof rawRequest !== "object") {
    return undefined;
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  return headers?.["user-agent"];
}

/**
 * Validate deletion reason
 */
function validateReason(reason: unknown): string | undefined {
  if (reason === undefined || reason === null || reason === "") {
    return undefined;
  }

  if (!isNonEmptyString(reason)) {
    throw new HttpsError("invalid-argument", "削除理由の形式が不正です");
  }

  if (reason.length > 500) {
    throw new HttpsError("invalid-argument", "削除理由は500文字以内で入力してください");
  }

  return reason.trim();
}

/**
 * アカウント削除リクエスト
 *
 * ユーザーのアカウント削除をスケジュール
 * 30日間の猶予期間後に自動削除される
 *
 * @returns 削除リクエスト情報
 * @throws HttpsError - 認証エラーまたは既に削除予定の場合
 */
export const requestAccountDeletion = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<RequestAccountDeletionResponse>> => {
    // Strict CSRF protection for sensitive operation
    requireStrictCsrfProtection(request);

    // Authentication check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data as RequestAccountDeletionRequest;

    // Extract request metadata for audit
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);

    logger.info("Account deletion requested", { userId });

    try {
      // Validate input
      const reason = validateReason(data?.reason);
      const exportData = data?.exportData === true;

      // Get current user document
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // Check if already scheduled for deletion
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "既にアカウント削除が予定されています",
        );
      }

      // Calculate scheduled deletion date
      const scheduledDeletionDate = calculateScheduledDeletionDate();

      // Create deletion request document
      const deletionRequestRef = db.collection("dataDeletionRequests").doc();
      const requestId = deletionRequestRef.id;

      // Use transaction for consistency
      await db.runTransaction(async (transaction) => {
        // Update user document
        transaction.update(userRef, {
          deletionScheduled: true,
          deletionScheduledAt: FieldValue.serverTimestamp(),
          scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Create deletion request document
        transaction.set(deletionRequestRef, {
          userId,
          status: "pending",
          requestedAt: FieldValue.serverTimestamp(),
          scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
          reason: reason || null,
          exportRequested: exportData,
          exportCompletedAt: null,
          completedAt: null,
          cancelledAt: null,
        });
      });

      // Log security event for audit (non-blocking)
      logSecurityEvent({
        userId,
        eventType: "account_deletion_requested",
        severity: "high",
        details: {
          requestId,
          scheduledDeletionDate: scheduledDeletionDate.toISOString(),
          exportRequested: exportData,
          hasReason: !!reason,
        },
        ipAddress: clientIp,
        userAgent,
      }).catch((error) => {
        logger.warn("Failed to log account deletion security event", { error });
      });

      logger.info("Account deletion scheduled", {
        userId,
        requestId,
        scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      });

      return {
        success: true,
        data: {
          requestId,
          scheduledDeletionDate: scheduledDeletionDate.toISOString(),
          exportRequested: exportData,
          message: `アカウントは${DELETION_GRACE_PERIOD_DAYS}日後に削除されます。削除をキャンセルするには期間内にお手続きください。`,
        },
      };
    } catch (error) {
      // Re-throw HttpsError as is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Log and wrap other errors
      logger.error("Failed to request account deletion", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "アカウント削除リクエストに失敗しました",
      );
    }
  },
);

/**
 * アカウント削除キャンセル
 *
 * 予定されているアカウント削除をキャンセル
 * 30日間の猶予期間内であればキャンセル可能
 *
 * @returns キャンセル結果
 * @throws HttpsError - 認証エラーまたは削除が予定されていない場合
 */
export const cancelAccountDeletion = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<CancelAccountDeletionResponse>> => {
    // Strict CSRF protection for sensitive operation
    requireStrictCsrfProtection(request);

    // Authentication check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;

    // Extract request metadata for audit
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);

    logger.info("Account deletion cancellation requested", { userId });

    try {
      // Get current user document
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // Check if deletion is scheduled
      if (!userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されていません",
        );
      }

      // Find the pending deletion request
      const deletionRequestsQuery = await db
        .collection("dataDeletionRequests")
        .where("userId", "==", userId)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      let requestId = "";

      // Use transaction for consistency
      await db.runTransaction(async (transaction) => {
        // Update user document
        transaction.update(userRef, {
          deletionScheduled: false,
          deletionScheduledAt: null,
          scheduledDeletionDate: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update deletion request if exists
        if (!deletionRequestsQuery.empty) {
          const deletionRequestDoc = deletionRequestsQuery.docs[0];
          requestId = deletionRequestDoc.id;
          transaction.update(deletionRequestDoc.ref, {
            status: "cancelled",
            cancelledAt: FieldValue.serverTimestamp(),
          });
        }
      });

      // Log security event for audit (non-blocking)
      logSecurityEvent({
        userId,
        eventType: "account_deletion_cancelled",
        severity: "medium",
        details: {
          requestId: requestId || "unknown",
        },
        ipAddress: clientIp,
        userAgent,
      }).catch((error) => {
        logger.warn("Failed to log account deletion cancellation security event", { error });
      });

      logger.info("Account deletion cancelled", {
        userId,
        requestId,
      });

      return {
        success: true,
        data: {
          requestId: requestId || "unknown",
          status: "cancelled",
          message: "アカウント削除がキャンセルされました。",
        },
      };
    } catch (error) {
      // Re-throw HttpsError as is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Log and wrap other errors
      logger.error("Failed to cancel account deletion", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "アカウント削除のキャンセルに失敗しました",
      );
    }
  },
);
