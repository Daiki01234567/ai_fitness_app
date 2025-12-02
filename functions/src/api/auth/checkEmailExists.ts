/**
 * メールアドレス存在チェック API
 *
 * 新規登録時にメールアドレスの重複をチェックする。
 * 認証不要のエンドポイントだが、レート制限を適用して
 * 不正なメールアドレス列挙攻撃を防止する。
 *
 * @version 1.0.0
 * @date 2025-12-02
 */

import { getAuth } from "firebase-admin/auth";
import { onCall, CallableRequest } from "firebase-functions/v2/https";

import { rateLimiter } from "../../middleware/rateLimiter";
import { RateLimitError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * リクエストデータの型定義
 */
interface CheckEmailExistsRequest {
  email: string;
}

/**
 * レスポンスデータの型定義
 */
interface CheckEmailExistsResponse {
  exists: boolean;
  message?: string;
}

/**
 * メールアドレス存在チェック用のレート制限
 * セキュリティ考慮: 1分あたり10リクエストまで
 */
const EMAIL_CHECK_RATE_LIMIT = {
  maxRequests: 10,
  windowSeconds: 60, // 1分間
};

/**
 * メールアドレスのバリデーション
 */
function validateEmail(email: unknown): string {
  if (!email || typeof email !== "string") {
    throw ValidationError.required("email");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw ValidationError.field("email", "無効なメールアドレス形式です", "format");
  }

  // Length check
  if (trimmedEmail.length > 254) {
    throw ValidationError.field("email", "メールアドレスが長すぎます", "maxLength:254");
  }

  return trimmedEmail;
}

/**
 * クライアントIPアドレスを取得
 * Cloud Functions v2 では rawRequest から取得可能
 */
function getClientIp(request: CallableRequest<unknown>): string {
  // Prefer X-Forwarded-For header (set by load balancer)
  const forwardedFor = request.rawRequest?.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    // Multiple IPs may be present, take the first one (client IP)
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIp = ips.split(",")[0]?.trim();
    if (clientIp) {
      return clientIp;
    }
  }

  // Fallback to socket remote address
  const socketIp = request.rawRequest?.socket?.remoteAddress;
  if (socketIp) {
    return socketIp;
  }

  // Final fallback - use a hash of the request to create some uniqueness
  return "unknown-client";
}

/**
 * メールアドレス存在チェック Cloud Function
 *
 * Firebase Auth の fetchSignInMethodsForEmail を使用して
 * メールアドレスが既に登録されているかをチェックする。
 *
 * セキュリティ対策:
 * - レート制限（IPアドレスベース）: 1分あたり10リクエスト
 * - 詳細なエラーメッセージは返さない
 * - ログに重要な情報を記録しない（メールアドレスはマスク）
 */
// eslint-disable-next-line camelcase
export const auth_checkEmailExists = onCall<
  CheckEmailExistsRequest,
  Promise<CheckEmailExistsResponse>
>(
  {
    region: "asia-northeast1",
    maxInstances: 10,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request): Promise<CheckEmailExistsResponse> => {
    const startTime = Date.now();

    try {
      // Get client IP for rate limiting
      const clientIp = getClientIp(request);

      // Apply rate limiting based on IP
      try {
        await rateLimiter.checkLimit(
          `EMAIL_CHECK:${clientIp}`,
          EMAIL_CHECK_RATE_LIMIT,
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          logger.warn("Email check rate limit exceeded", {
            clientIp,
            duration: Date.now() - startTime,
          });
          throw error;
        }
        // If rate limit check fails for other reasons, continue
        // (fail open for rate limiting infrastructure issues)
      }

      // Validate email
      const email = validateEmail(request.data?.email);

      // Log masked email for debugging
      const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");
      logger.info("Checking email existence", {
        maskedEmail,
        clientIp,
      });

      // Check if email exists using Firebase Auth
      const auth = getAuth();

      try {
        // getUserByEmail throws an error if user does not exist
        // If it succeeds, the email is already registered
        await auth.getUserByEmail(email);

        // If we reach here, user exists
        logger.info("Email check completed", {
          maskedEmail,
          exists: true,
          duration: Date.now() - startTime,
        });

        return {
          exists: true,
          // Security: Provide generic message
          message: "このメールアドレスは既に登録されています",
        };
      } catch (authError: unknown) {
        // Check if the error is because user doesn't exist
        const errorCode = (authError as { code?: string })?.code;

        if (errorCode === "auth/user-not-found") {
          // User does not exist - email is available
          logger.info("Email check completed", {
            maskedEmail,
            exists: false,
            duration: Date.now() - startTime,
          });

          return {
            exists: false,
          };
        }

        // Firebase Auth may throw for various reasons
        // Log and return false to avoid leaking information
        logger.error("Firebase Auth error during email check", authError as Error, {
          maskedEmail,
          duration: Date.now() - startTime,
        });

        // Return false to avoid confirming/denying email existence on error
        return {
          exists: false,
        };
      }
    } catch (error) {
      // Rethrow validation and rate limit errors
      if (error instanceof ValidationError || error instanceof RateLimitError) {
        throw error;
      }

      // Log unexpected errors
      logger.error("Unexpected error in checkEmailExists", error as Error, {
        duration: Date.now() - startTime,
      });

      // Return generic response to avoid leaking information
      return {
        exists: false,
      };
    }
  },
);
