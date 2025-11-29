/**
 * GDPR アカウント復元 API
 *
 * 削除予定のアカウントを復元するための機能
 * - 復元コードのリクエスト
 * - 復元コードの検証
 * - アカウント復元の実行
 *
 * セキュリティ考慮事項:
 * - 6桁数字コード（総当り攻撃対策で試行回数制限）
 * - 有効期限24時間
 * - 試行回数5回まで（超過でコード無効化）
 * - 復元完了後はコード削除
 * - 全操作を監査ログに記録
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

import { rateLimiter } from "../../middleware/rateLimiter";
import { createAuditLog } from "../../services/auditLog";
import {
  generateRecoveryCode,
  findScheduledDeletionByEmail,
  saveRecoveryCode,
  verifyRecoveryCode,
  executeAccountRecovery,
  sendRecoveryEmail,
} from "../../services/gdprService";
import {
  RecoveryCodeRequest,
  RecoveryCodeResponse,
  VerifyCodeRequest,
  VerifyCodeResponse,
  RecoverAccountRequest,
  RecoverAccountResponse,
} from "../../types/gdpr";
import { ValidationError } from "../../utils/errors";
import { timestampToISOString } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate email format
 */
function validateEmail(email?: string): string {
  if (!email || typeof email !== "string") {
    throw new ValidationError("メールアドレスは必須です");
  }

  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    throw new ValidationError("有効なメールアドレスを入力してください");
  }

  return trimmedEmail;
}

/**
 * Validate recovery code format
 */
function validateRecoveryCode(code?: string): string {
  if (!code || typeof code !== "string") {
    throw new ValidationError("復元コードは必須です");
  }

  const trimmedCode = code.trim();

  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new ValidationError("復元コードは6桁の数字です");
  }

  return trimmedCode;
}

/**
 * Calculate days remaining until deletion
 */
function calculateDaysRemaining(scheduledAt: admin.firestore.Timestamp): number {
  const now = Date.now();
  const scheduled = scheduledAt.toMillis();
  const diffMs = scheduled - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * Request recovery code
 *
 * @description
 * Generates and sends a 6-digit recovery code to the user's email.
 * Rate limited to 3 requests per hour.
 */
export const gdpr_requestRecoveryCode = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (
    request: CallableRequest<RecoveryCodeRequest>,
  ): Promise<RecoveryCodeResponse> => {
    const startTime = Date.now();
    const data = request.data || {};

    // Note: This endpoint does not require authentication
    // as the user may be logged out during deletion period

    try {
      // Validate email
      const email = validateEmail(data.email);

      // Rate limit by email address
      await rateLimiter.check("GDPR_RECOVERY_CODE", email);

      logger.info("Recovery code request received", { email });

      // Find user with scheduled deletion
      const scheduledDeletion = await findScheduledDeletionByEmail(email);

      // Always return success message to prevent email enumeration attacks
      if (!scheduledDeletion) {
        logger.info("No scheduled deletion found for email", { email });
        return {
          success: true,
          message: "復元コードをメールアドレスに送信しました（該当するアカウントがある場合）。",
        };
      }

      const { userId, deletionRequest } = scheduledDeletion;

      // Generate recovery code
      const code = generateRecoveryCode();

      // Get IP address for security logging
      const ipAddress = request.rawRequest?.headers?.["x-forwarded-for"] as string | undefined;

      // Save recovery code
      const { expiresAt } = await saveRecoveryCode(
        userId,
        email,
        code,
        deletionRequest.requestId,
        ipAddress,
      );

      // Send recovery email
      sendRecoveryEmail(email, code, expiresAt);

      // Audit log
      await createAuditLog({
        userId,
        action: "security_event",
        resourceType: "recovery",
        newValues: {
          event: "recovery_code_requested",
          email,
        },
        success: true,
      });

      logger.info("Recovery code sent", {
        email,
        userId,
        expiresAt: expiresAt.toISOString(),
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        message: "復元コードをメールアドレスに送信しました。24時間以内に入力してください。",
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      logger.error("Recovery code request failed", error as Error, {
        email: data.email,
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }

      throw new HttpsError("internal", "復元コードの送信に失敗しました");
    }
  },
);

/**
 * Verify recovery code
 *
 * @description
 * Validates the recovery code and returns deletion information.
 * Does not perform the recovery - just validates the code.
 */
export const gdpr_verifyRecoveryCode = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<VerifyCodeRequest>,
  ): Promise<VerifyCodeResponse> => {
    const data = request.data || {};

    try {
      // Validate inputs
      const email = validateEmail(data.email);
      const code = validateRecoveryCode(data.code);

      // Rate limit by email address
      await rateLimiter.check("GDPR_RECOVERY_VERIFY", email);

      logger.info("Recovery code verification request", { email });

      // Verify the code
      const result = await verifyRecoveryCode(email, code);

      if (!result.valid) {
        logger.info("Recovery code verification failed", {
          email,
          remainingAttempts: result.remainingAttempts,
        });

        return {
          valid: false,
          remainingAttempts: result.remainingAttempts,
        };
      }

      // Get deletion info
      let deletionInfo: VerifyCodeResponse["deletionInfo"];
      if (result.deletionRequest) {
        deletionInfo = {
          requestId: result.deletionRequest.requestId,
          scheduledAt: timestampToISOString(result.deletionRequest.scheduledAt) || "",
          daysRemaining: calculateDaysRemaining(result.deletionRequest.scheduledAt),
        };
      }

      logger.info("Recovery code verified successfully", {
        email,
        hasDeleteionInfo: !!deletionInfo,
      });

      return {
        valid: true,
        deletionInfo,
      };
    } catch (error) {
      logger.error("Recovery code verification failed", error as Error, {
        email: data.email,
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }

      throw new HttpsError("internal", "コードの検証に失敗しました");
    }
  },
);

/**
 * Recover account
 *
 * @description
 * Executes account recovery after code verification.
 * - Clears deletionScheduled flag
 * - Updates deletion request to cancelled
 * - Sends recovery completion notification
 * - Records audit log
 */
export const gdpr_recoverAccount = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (
    request: CallableRequest<RecoverAccountRequest>,
  ): Promise<RecoverAccountResponse> => {
    const startTime = Date.now();
    const data = request.data || {};

    try {
      // Validate inputs
      const email = validateEmail(data.email);
      const code = validateRecoveryCode(data.code);

      // Rate limit by email address
      await rateLimiter.check("GDPR_RECOVER_ACCOUNT", email);

      logger.info("Account recovery request", { email });

      // Execute recovery
      const result = await executeAccountRecovery(email, code);

      if (!result.success) {
        logger.warn("Account recovery failed", { email, message: result.message });
        return {
          success: false,
          message: result.message,
        };
      }

      // Find user ID for audit log (recovery code should have this)
      const scheduledDeletion = await findScheduledDeletionByEmail(email);

      // Audit log - use placeholder if user not found (already recovered)
      await createAuditLog({
        userId: scheduledDeletion?.userId || "recovered_user",
        action: "account_deletion_cancel",
        resourceType: "recovery",
        newValues: {
          event: "account_recovered_via_code",
          email,
        },
        success: true,
      });

      // TODO: Send recovery completion notification email
      // await sendRecoveryCompletedEmail(email);

      logger.info("Account recovery completed", {
        email,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      logger.error("Account recovery failed", error as Error, {
        email: data.email,
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }

      throw new HttpsError("internal", "アカウント復元に失敗しました");
    }
  },
);
