/**
 * ユーザー登録 API (auth_signUp)
 *
 * Firebase Authentication と Firestore で新規ユーザーアカウントを作成
 *
 * 参照:
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
// 型定義
// =============================================================================

/**
 * サインアップリクエストインターフェース
 * API設計書 Section 4.1.2 に基づく
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
 * サインアップレスポンスインターフェース
 * API設計書 Section 4.1.3 に基づく
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
// 定数
// =============================================================================

/** 現在の利用規約バージョン */
const TOS_VERSION = "3.1";

/** 現在のプライバシーポリシーバージョン */
const PP_VERSION = "3.1";

/** パスワード最小文字数 */
const MIN_PASSWORD_LENGTH = 8;

/** 最低年齢要件（日本） */
const MIN_AGE_JAPAN = 13;

// =============================================================================
// バリデーション関数
// =============================================================================

/**
 * パスワードが要件を満たしているかバリデート
 * - 8文字以上
 * - 少なくとも1つの英字と1つの数字
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

  // 少なくとも1つの英字と1つの数字をチェック
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
 * 同意が受け入れられたかバリデート
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
 * 生年に基づく年齢要件をバリデート
 */
function validateAgeRequirement(birthYear: number | undefined): void {
  if (birthYear === undefined) {
    return; // 生年はオプション
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
 * サインアップリクエスト全体をバリデート
 */
function validateSignUpRequest(data: unknown): SignUpRequest {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("リクエストデータが不正です", {
      field: "request",
      constraint: "object",
    });
  }

  const request = data as Record<string, unknown>;

  // 必須フィールドをバリデート
  const email = validateEmail(request.email);
  const password = validatePassword(request.password);
  const nickname = validateNickname(request.nickname);
  const birthYear = validateBirthYear(request.birthYear);

  // 同意をバリデート
  validateConsent(request.tosAccepted, "利用規約");
  validateConsent(request.ppAccepted, "プライバシーポリシー");

  // 年齢要件をバリデート
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
// ヘルパー関数
// =============================================================================

/**
 * Firestore に同意レコードを作成
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
 * プライバシーのために IP アドレスをハッシュ化
 * 監査目的のシンプルなハッシュ
 */
function hashIpAddress(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);
}

/**
 * リクエストからクライアント IP を取得
 */
function getClientIp(rawRequest: unknown): string | undefined {
  if (!rawRequest || typeof rawRequest !== "object") {
    return undefined;
  }

  const req = rawRequest as Record<string, unknown>;

  // 一般的な IP ヘッダーをチェック
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
// メイン関数
// =============================================================================

/**
 * authSignUp - ユーザー登録
 *
 * 以下を含む新規ユーザーを作成:
 * 1. Firebase Authentication アカウント
 * 2. Firestore ユーザードキュメント
 * 3. 利用規約とプライバシーポリシーの同意レコード
 *
 * @throws INVALID_ARGUMENT - 無効な入力データ
 * @throws ALREADY_EXISTS - メールアドレスが既に登録済み
 * @throws FAILED_PRECONDITION - 年齢要件を満たしていない
 * @throws INTERNAL - 予期しないエラー
 */
// eslint-disable-next-line camelcase
export const auth_signUp = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true, // Web クライアント用に CORS を有効化
    // 注: minInstances は本番環境（Phase 3+）で 1 に設定される
    // 現在はコスト最適化のため 0
  },
  async (request): Promise<SignUpResponse> => {
    const startTime = Date.now();

    try {
      // CSRF 保護
      requireCsrfProtection(request);

      // リクエストデータをバリデート
      const validatedData = validateSignUpRequest(request.data);

      logger.info("Processing signup request", {
        email: validatedData.email.substring(0, 3) + "***", // ログ用に部分メールアドレス
      });

      // Firebase Auth ユーザーを作成
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

      // Firestore にユーザードキュメントを作成
      const userData = {
        // プロフィール
        nickname: validatedData.nickname,
        email: validatedData.email,
        birthYear: validatedData.birthYear,

        // 同意フラグ
        tosAccepted: true,
        tosAcceptedAt: now,
        tosVersion: TOS_VERSION,
        ppAccepted: true,
        ppAcceptedAt: now,
        ppVersion: PP_VERSION,

        // アカウント状態
        deletionScheduled: false,

        // タイムスタンプ
        createdAt: now,
        updatedAt: now,
      };

      await admin.firestore().collection("users").doc(uid).set(userData);

      // 監査証跡用に同意レコードを作成
      const clientIp = getClientIp(request.rawRequest);
      const rawReq = request.rawRequest as unknown as Record<string, unknown> | undefined;
      const userAgent = rawReq?.["user-agent"] as string | undefined;

      await Promise.all([
        createConsentRecord(uid, "tos", TOS_VERSION, clientIp, userAgent),
        createConsentRecord(uid, "pp", PP_VERSION, clientIp, userAgent),
      ]);

      // メール認証を送信
      try {
        await admin.auth().generateEmailVerificationLink(validatedData.email);

        logger.info("Email verification link generated", {
          userId: uid,
          // 注: 本番環境ではメールサービス経由で送信
          // 現時点では生成されたことをログに記録
        });
      } catch (emailError) {
        // ログ出力するが登録は失敗させない
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
