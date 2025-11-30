/**
 * 再認証ミドルウェア
 *
 * 重要操作前にセッション再認証を要求
 * - 最終認証時刻の確認
 * - ID トークンの検証
 * - パスワード再確認（オプション）
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as admin from "firebase-admin";
import { CallableRequest } from "firebase-functions/v2/https";

import { createAuditLog } from "../services/auditLog";
import {
  ReauthResponse,
  SensitiveOperationType,
  SECURITY_CONSTANTS,
} from "../types/security";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// 認証時刻チェック
// =============================================================================

/**
 * 最近の認証が有効かチェック
 *
 * @param userId ユーザー ID
 * @param maxAgeMinutes 最大経過時間（分）
 * @returns 認証が有効かどうか
 */
export async function requireRecentAuth(
  userId: string,
  maxAgeMinutes: number = SECURITY_CONSTANTS.REAUTH_MAX_AGE_MINUTES,
): Promise<ReauthResponse> {
  try {
    // Firebase Auth からユーザー情報を取得
    const userRecord = await admin.auth().getUser(userId);

    if (!userRecord.tokensValidAfterTime) {
      // トークン検証時間が設定されていない場合は再認証を要求
      return {
        valid: false,
        message: "再認証が必要です",
        requiresReauth: true,
      };
    }

    // metadata から最終認証時刻を取得
    const lastSignInTime = userRecord.metadata.lastSignInTime;
    if (!lastSignInTime) {
      return {
        valid: false,
        message: "認証情報が見つかりません。再ログインしてください。",
        requiresReauth: true,
      };
    }

    const lastAuthDate = new Date(lastSignInTime);
    const now = new Date();
    const ageMs = now.getTime() - lastAuthDate.getTime();
    const ageMinutes = ageMs / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
      logger.info("Recent auth check failed - session too old", {
        userId,
        ageMinutes: Math.round(ageMinutes),
        maxAgeMinutes,
      });

      return {
        valid: false,
        message: `セッションが${maxAgeMinutes}分以上経過しています。再認証が必要です。`,
        lastAuthTime: lastAuthDate.toISOString(),
        requiresReauth: true,
      };
    }

    return {
      valid: true,
      lastAuthTime: lastAuthDate.toISOString(),
      requiresReauth: false,
    };
  } catch (error) {
    logger.error("Recent auth check failed", error as Error, { userId });

    return {
      valid: false,
      message: "認証情報の確認に失敗しました",
      requiresReauth: true,
    };
  }
}

/**
 * ID トークンから認証時刻をチェック
 *
 * @param request Callable リクエスト
 * @param maxAgeMinutes 最大経過時間（分）
 * @returns 認証が有効かどうか
 */
export function checkTokenAuthTime(
  request: CallableRequest,
  maxAgeMinutes: number = SECURITY_CONSTANTS.REAUTH_MAX_AGE_MINUTES,
): ReauthResponse {
  if (!request.auth) {
    return {
      valid: false,
      message: "認証が必要です",
      requiresReauth: true,
    };
  }

  const token = request.auth.token;
  const authTime = token.auth_time;

  if (!authTime) {
    return {
      valid: false,
      message: "認証時刻が取得できません。再ログインしてください。",
      requiresReauth: true,
    };
  }

  const authDate = new Date(authTime * 1000);
  const now = new Date();
  const ageMs = now.getTime() - authDate.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  if (ageMinutes > maxAgeMinutes) {
    logger.info("Token auth time check failed", {
      userId: request.auth.uid,
      ageMinutes: Math.round(ageMinutes),
      maxAgeMinutes,
    });

    return {
      valid: false,
      message: `認証から${maxAgeMinutes}分以上経過しています。再認証が必要です。`,
      lastAuthTime: authDate.toISOString(),
      requiresReauth: true,
    };
  }

  return {
    valid: true,
    lastAuthTime: authDate.toISOString(),
    requiresReauth: false,
  };
}

// =============================================================================
// 重要操作用再認証
// =============================================================================

/**
 * 重要操作用に再認証を要求
 *
 * @param request Callable リクエスト
 * @param operation 操作タイプ
 * @throws 再認証が必要な場合は AuthenticationError をスロー
 */
export async function requireReauthForSensitiveOp(
  request: CallableRequest,
  operation: SensitiveOperationType,
): Promise<void> {
  if (!request.auth) {
    throw new AuthenticationError("認証が必要です");
  }

  const userId = request.auth.uid;
  const maxAgeMinutes = SECURITY_CONSTANTS.SENSITIVE_OP_MAX_AGE_MINUTES;

  const result = await checkTokenAuthTime(request, maxAgeMinutes);

  if (!result.valid) {
    // 監査ログを記録
    await createAuditLog({
      userId,
      action: "security_event",
      resourceType: "sensitive_operation",
      metadata: {
        operation,
        reason: "reauth_required",
        lastAuthTime: result.lastAuthTime,
      },
      success: false,
      errorMessage: result.message,
    });

    throw new AuthorizationError(
      result.message || "この操作を行うには再認証が必要です",
    );
  }

  logger.info("Sensitive operation reauth check passed", {
    userId,
    operation,
    lastAuthTime: result.lastAuthTime,
  });
}

/**
 * 再認証が必要かどうかをチェック（例外をスローしない）
 *
 * @param request Callable リクエスト
 * @param _operation 操作タイプ（将来的に操作別の時間制限に使用）
 * @returns 再認証レスポンス
 */
export async function checkReauthRequired(
  request: CallableRequest,
  _operation: SensitiveOperationType,
): Promise<ReauthResponse> {
  if (!request.auth) {
    return {
      valid: false,
      message: "認証が必要です",
      requiresReauth: true,
    };
  }

  const maxAgeMinutes = SECURITY_CONSTANTS.SENSITIVE_OP_MAX_AGE_MINUTES;
  return checkTokenAuthTime(request, maxAgeMinutes);
}

// =============================================================================
// メール確認チェック
// =============================================================================

/**
 * メール確認済みかチェック
 *
 * @param request Callable リクエスト
 * @throws メール未確認の場合は AuthorizationError をスロー
 */
export function requireEmailVerified(request: CallableRequest): void {
  if (!request.auth) {
    throw new AuthenticationError("認証が必要です");
  }

  const emailVerified = request.auth.token.email_verified;

  if (!emailVerified) {
    logger.warn("Email verification required", { userId: request.auth.uid });

    throw new AuthorizationError(
      "この操作を行うにはメールアドレスの確認が必要です",
    );
  }
}

/**
 * メール確認済みかチェック（例外をスローしない）
 *
 * @param request Callable リクエスト
 * @returns メール確認済みかどうか
 */
export function isEmailVerified(request: CallableRequest): boolean {
  if (!request.auth) {
    return false;
  }

  return request.auth.token.email_verified === true;
}

// =============================================================================
// 2段階認証チェック
// =============================================================================

/**
 * 2段階認証（MFA）が有効かチェック
 *
 * 注意: Firebase Auth の MFA 機能を使用する場合にのみ有効
 *
 * @param userId ユーザー ID
 * @returns MFA が有効かどうか
 */
export async function isMfaEnabled(userId: string): Promise<boolean> {
  try {
    const userRecord = await admin.auth().getUser(userId);

    // multiFactor プロパティをチェック
    const mfaInfo = userRecord.multiFactor;
    if (!mfaInfo || !mfaInfo.enrolledFactors) {
      return false;
    }

    return mfaInfo.enrolledFactors.length > 0;
  } catch (error) {
    logger.error("MFA check failed", error as Error, { userId });
    return false;
  }
}

/**
 * 2段階認証を要求
 *
 * @param request Callable リクエスト
 * @throws MFA が未設定の場合は AuthorizationError をスロー
 */
export async function requireMfa(request: CallableRequest): Promise<void> {
  if (!request.auth) {
    throw new AuthenticationError("認証が必要です");
  }

  const userId = request.auth.uid;
  const mfaEnabled = await isMfaEnabled(userId);

  if (!mfaEnabled) {
    logger.warn("MFA required but not enabled", { userId });

    throw new AuthorizationError(
      "この操作を行うには2段階認証の設定が必要です",
    );
  }

  // トークンに MFA 認証済みフラグがあるかチェック
  // 注意: これは Firebase Auth の実装に依存する
  const token = request.auth.token;
  if (token.firebase?.sign_in_second_factor !== "totp" &&
      token.firebase?.sign_in_second_factor !== "phone") {
    logger.warn("MFA verification required", { userId });

    throw new AuthorizationError(
      "2段階認証での再ログインが必要です",
    );
  }
}

// =============================================================================
// セッション検証
// =============================================================================

/**
 * セッションが有効かチェック
 *
 * @param request Callable リクエスト
 * @returns セッションが有効かどうか
 */
export async function isSessionValid(request: CallableRequest): Promise<boolean> {
  if (!request.auth) {
    return false;
  }

  try {
    const userId = request.auth.uid;
    const userRecord = await admin.auth().getUser(userId);

    // ユーザーが無効化されていないかチェック
    if (userRecord.disabled) {
      logger.warn("User account is disabled", { userId });
      return false;
    }

    // トークンの有効期限チェック
    const tokensValidAfterTime = userRecord.tokensValidAfterTime;
    if (tokensValidAfterTime) {
      const tokenIssuedAt = request.auth.token.iat;
      const tokensValidAfter = new Date(tokensValidAfterTime).getTime() / 1000;

      if (tokenIssuedAt && tokenIssuedAt < tokensValidAfter) {
        logger.warn("Token was issued before token revocation", { userId });
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error("Session validation failed", error as Error);
    return false;
  }
}

/**
 * 有効なセッションを要求
 *
 * @param request Callable リクエスト
 * @throws セッションが無効な場合は AuthenticationError をスロー
 */
export async function requireValidSession(request: CallableRequest): Promise<void> {
  const isValid = await isSessionValid(request);

  if (!isValid) {
    throw AuthenticationError.sessionRevoked();
  }
}
