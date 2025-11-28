/**
 * User Registration API (auth_signUp)
 *
 * Creates a new user account with Firebase Authentication and Firestore.
 *
 * Based on:
 * - docs/specs/03_API設計書_Firebase_Functions_v3_3.md Section 4.1
 * - docs/specs/00_要件定義書_v3_3.md FR-001
 *
 * @version 1.0.0
 * @date 2025-11-26
 */

import * as crypto from "crypto";

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { Consent } from "../../types/firestore";
import { ValidationError, handleError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import {
  validateEmail,
  validateNickname,
  validateBirthYear,
  validateRequired,
} from "../../utils/validation";

// =============================================================================
// Types
// =============================================================================

/**
 * Sign up request interface
 * Based on API設計書 Section 4.1.2
 */
interface SignUpRequest {
  email: string;
  password: string;
  nickname: string;
  birthYear?: number;
  tosAccepted: boolean;
  ppAccepted: boolean;
}

/**
 * Sign up response interface
 * Based on API設計書 Section 4.1.3
 */
interface SignUpResponse {
  success: boolean;
  data: {
    userId: string;
    email: string;
    nickname: string;
    createdAt: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

/** Current Terms of Service version */
const TOS_VERSION = "3.1";

/** Current Privacy Policy version */
const PP_VERSION = "3.1";

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/** Minimum age requirement (Japan) */
const MIN_AGE_JAPAN = 13;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate password meets requirements
 * - Minimum 8 characters
 * - At least one letter and one number
 */
function validatePassword(password: unknown): string {
  validateRequired(password, "パスワード");

  if (typeof password !== "string") {
    throw ValidationError.invalidType("パスワード", "文字列");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`,
      {
        field: "password",
        constraint: `minLength:${MIN_PASSWORD_LENGTH}`,
      },
    );
  }

  // Check for at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    throw new ValidationError(
      "パスワードには英字と数字の両方を含めてください",
      {
        field: "password",
        constraint: "pattern:letterAndNumber",
      },
    );
  }

  return password;
}

/**
 * Validate consent is accepted
 */
function validateConsent(value: unknown, fieldName: string): boolean {
  if (value !== true) {
    throw new ValidationError(`${fieldName}への同意が必要です`, {
      field: fieldName === "利用規約" ? "tosAccepted" : "ppAccepted",
      constraint: "required:true",
    });
  }
  return true;
}

/**
 * Validate age requirement based on birth year
 */
function validateAgeRequirement(birthYear: number | undefined): void {
  if (birthYear === undefined) {
    return; // Birth year is optional
  }

  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  if (age < MIN_AGE_JAPAN) {
    throw new ValidationError(
      `${MIN_AGE_JAPAN}歳以上のユーザーのみ登録できます`,
      {
        field: "birthYear",
        constraint: `minAge:${MIN_AGE_JAPAN}`,
      },
    );
  }
}

/**
 * Validate the entire sign up request
 */
function validateSignUpRequest(data: unknown): SignUpRequest {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("リクエストデータが不正です", {
      field: "request",
      constraint: "object",
    });
  }

  const request = data as Record<string, unknown>;

  // Validate required fields
  const email = validateEmail(request.email);
  const password = validatePassword(request.password);
  const nickname = validateNickname(request.nickname);
  const birthYear = validateBirthYear(request.birthYear);

  // Validate consents
  validateConsent(request.tosAccepted, "利用規約");
  validateConsent(request.ppAccepted, "プライバシーポリシー");

  // Validate age requirement
  validateAgeRequirement(birthYear);

  return {
    email,
    password,
    nickname,
    birthYear,
    tosAccepted: true,
    ppAccepted: true,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create consent record in Firestore
 */
async function createConsentRecord(
  userId: string,
  documentType: "tos" | "pp",
  documentVersion: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const consentData: Omit<Consent, "timestamp"> & { timestamp: FieldValue } = {
    userId,
    action: "accept",
    documentType,
    documentVersion,
    ipAddress: ipAddress ? hashIpAddress(ipAddress) : undefined,
    userAgent,
    timestamp: FieldValue.serverTimestamp(),
  };

  await admin.firestore().collection("consents").add(consentData);
}

/**
 * Hash IP address for privacy
 * Simple hash for audit purposes
 */
function hashIpAddress(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);
}

/**
 * Get client IP from request
 */
function getClientIp(rawRequest: unknown): string | undefined {
  if (!rawRequest || typeof rawRequest !== "object") {
    return undefined;
  }

  const req = rawRequest as Record<string, unknown>;

  // Check common IP headers
  const xForwardedFor = req["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = req["x-real-ip"];
  if (typeof xRealIp === "string") {
    return xRealIp;
  }

  return undefined;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * authSignUp - User Registration
 *
 * Creates a new user with:
 * 1. Firebase Authentication account
 * 2. Firestore user document
 * 3. Consent records for TOS and Privacy Policy
 *
 * @throws INVALID_ARGUMENT - Invalid input data
 * @throws ALREADY_EXISTS - Email already registered
 * @throws FAILED_PRECONDITION - Age requirement not met
 * @throws INTERNAL - Unexpected error
 */
// eslint-disable-next-line camelcase
export const auth_signUp = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true, // Enable CORS for web clients
    // Note: minInstances will be set to 1 in production (Phase 3+)
    // Currently 0 for cost optimization
  },
  async (request): Promise<SignUpResponse> => {
    const startTime = Date.now();

    try {
      // CSRF Protection
      requireCsrfProtection(request);

      // Validate request data
      const validatedData = validateSignUpRequest(request.data);

      logger.info("Processing signup request", {
        email: validatedData.email.substring(0, 3) + "***", // Partial email for logs
      });

      // Create Firebase Auth user
      let userRecord: admin.auth.UserRecord;
      try {
        userRecord = await admin.auth().createUser({
          email: validatedData.email,
          password: validatedData.password,
          displayName: validatedData.nickname,
          emailVerified: false,
        });
      } catch (authError) {
        const error = authError as { code?: string; message?: string };
        if (error.code === "auth/email-already-exists") {
          throw new HttpsError(
            "already-exists",
            "このメールアドレスは既に登録されています",
          );
        }
        if (error.code === "auth/invalid-email") {
          throw new HttpsError(
            "invalid-argument",
            "有効なメールアドレスを入力してください",
          );
        }
        if (error.code === "auth/weak-password") {
          throw new HttpsError(
            "invalid-argument",
            "パスワードが弱すぎます。より強力なパスワードを設定してください",
          );
        }
        logger.error("Firebase Auth createUser failed", authError as Error, {
          errorCode: error.code,
        });
        throw new HttpsError("internal", "ユーザー登録に失敗しました");
      }

      const uid = userRecord.uid;
      const now = FieldValue.serverTimestamp();

      // Create user document in Firestore
      const userData = {
        // Profile
        nickname: validatedData.nickname,
        email: validatedData.email,
        birthYear: validatedData.birthYear,

        // Consent flags
        tosAccepted: true,
        tosAcceptedAt: now,
        tosVersion: TOS_VERSION,
        ppAccepted: true,
        ppAcceptedAt: now,
        ppVersion: PP_VERSION,

        // Account status
        deletionScheduled: false,

        // Timestamps
        createdAt: now,
        updatedAt: now,
      };

      await admin.firestore().collection("users").doc(uid).set(userData);

      // Create consent records for audit trail
      const clientIp = getClientIp(request.rawRequest);
      const rawReq = request.rawRequest as unknown as Record<string, unknown> | undefined;
      const userAgent = rawReq?.["user-agent"] as string | undefined;

      await Promise.all([
        createConsentRecord(uid, "tos", TOS_VERSION, clientIp, userAgent),
        createConsentRecord(uid, "pp", PP_VERSION, clientIp, userAgent),
      ]);

      // Send email verification
      try {
        await admin.auth().generateEmailVerificationLink(validatedData.email);

        logger.info("Email verification link generated", {
          userId: uid,
          // Note: In production, send this via email service
          // For now, just log that it was generated
        });
      } catch (emailError) {
        // Log but don't fail registration
        logger.warn("Failed to generate email verification link", {
          userId: uid,
          error:
            emailError instanceof Error ? emailError.message : String(emailError),
        });
      }

      const duration = Date.now() - startTime;
      logger.info("User signup completed", {
        userId: uid,
        duration,
      });

      return {
        success: true,
        data: {
          userId: uid,
          email: validatedData.email,
          nickname: validatedData.nickname,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      handleError(error);
    }
  },
);
