/**
 * ユーザープロフィール更新 API
 *
 * Firestore のユーザープロフィール情報を更新
 * 登録ステップ 2 後またはプロフィール設定から呼び出される
 *
 * @version 1.1.0
 * @date 2025-11-26
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { logProfileUpdate } from "../../services/auditLog";
import { logger } from "../../utils/logger";
import {
  validateNickname,
  validateHeight,
  validateWeight,
  validateGender,
  validateFitnessLevel,
  isNonEmptyString,
} from "../../utils/validation";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * プロフィール更新リクエストデータ
 */
interface UpdateProfileRequest {
  displayName?: string;
  dateOfBirth?: string; // ISO 8601 format: YYYY-MM-DD
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  height?: number; // cm
  weight?: number; // kg
  fitnessGoal?: string;
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
}

/**
 * 生年月日をバリデート
 * 有効な日付文字列で、ユーザーは少なくとも13歳以上である必要がある（日本の規制）
 */
function validateDateOfBirth(dateOfBirth: unknown): Date | undefined {
  if (dateOfBirth === undefined || dateOfBirth === null || dateOfBirth === "") {
    return undefined;
  }

  if (!isNonEmptyString(dateOfBirth)) {
    throw new HttpsError("invalid-argument", "生年月日の形式が不正です");
  }

  // ISO 8601 日付形式をパース
  const date = new Date(dateOfBirth);
  if (isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "生年月日の形式が不正です（YYYY-MM-DD）");
  }

  // 最低年齢をチェック（日本は13歳）
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age--;
  }

  if (age < 13) {
    throw new HttpsError("invalid-argument", "13歳以上の方のみご利用いただけます");
  }

  if (age > 120) {
    throw new HttpsError("invalid-argument", "生年月日を確認してください");
  }

  return date;
}

/**
 * フィットネス目標をバリデート
 */
function validateFitnessGoal(goal: unknown): string | undefined {
  if (goal === undefined || goal === null || goal === "") {
    return undefined;
  }

  if (!isNonEmptyString(goal)) {
    throw new HttpsError("invalid-argument", "目標の形式が不正です");
  }

  // 最大長をバリデート
  if (goal.length > 100) {
    throw new HttpsError("invalid-argument", "目標は100文字以内で入力してください");
  }

  return goal.trim();
}

/**
 * リクエストからクライアント IP を抽出
 */
function getClientIp(rawRequest: unknown): string | undefined {
  if (!rawRequest || typeof rawRequest !== "object") {
    return undefined;
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  // 一般的な IP ヘッダーをチェック
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
 * リクエストからユーザーエージェントを抽出
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
 * ユーザープロフィールを更新
 *
 * Firestore でユーザープロフィールを更新する callable 関数
 * 認証が必要
 */
export const updateProfile = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Web クライアント用に CORS を有効化
  },
  async (request) => {
    // CSRF 保護
    requireCsrfProtection(request);

    // 認証をチェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data as UpdateProfileRequest;

    // 監査ログ用にリクエストメタデータを抽出
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);

    logger.info("Updating profile", {
      userId,
      hasDisplayName: !!data.displayName,
      hasDateOfBirth: !!data.dateOfBirth,
      hasGender: !!data.gender,
      hasHeight: !!data.height,
      hasWeight: !!data.weight,
      hasFitnessGoal: !!data.fitnessGoal,
    });

    try {
      // 入力データをバリデート
      const validatedData: Record<string, unknown> = {};

      // 表示名
      if (data.displayName !== undefined) {
        validatedData.displayName = validateNickname(data.displayName);
      }

      // 生年月日
      if (data.dateOfBirth !== undefined) {
        const dob = validateDateOfBirth(data.dateOfBirth);
        if (dob) {
          validatedData["profile.birthday"] = Timestamp.fromDate(dob);
        }
      }

      // 性別
      if (data.gender !== undefined) {
        const gender = validateGender(data.gender);
        if (gender) {
          validatedData["profile.gender"] = gender;
        }
      }

      // 身長
      if (data.height !== undefined) {
        const height = validateHeight(data.height);
        if (height !== undefined) {
          validatedData["profile.height"] = height;
        }
      }

      // 体重
      if (data.weight !== undefined) {
        const weight = validateWeight(data.weight);
        if (weight !== undefined) {
          validatedData["profile.weight"] = weight;
        }
      }

      // フィットネス目標
      if (data.fitnessGoal !== undefined) {
        const goal = validateFitnessGoal(data.fitnessGoal);
        if (goal) {
          validatedData["profile.goals"] = [goal];
        }
      }

      // フィットネスレベル
      if (data.fitnessLevel !== undefined) {
        const level = validateFitnessLevel(data.fitnessLevel);
        if (level) {
          validatedData["profile.fitnessLevel"] = level;
        }
      }

      // 更新するものがあるかチェック
      if (Object.keys(validatedData).length === 0) {
        throw new HttpsError("invalid-argument", "更新するデータがありません");
      }

      // タイムスタンプを追加
      validatedData.updatedAt = FieldValue.serverTimestamp();

      // Firestore を更新
      const userRef = db.collection("users").doc(userId);

      // ユーザードキュメントが存在するかチェックして以前の値を取得
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const previousData = userDoc.data() || {};

      // 削除予定かチェック
      if (previousData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されているため、プロフィールを更新できません",
        );
      }

      // 更新を実行
      await userRef.update(validatedData);

      // 監査ログを作成（非同期、レスポンスを遅延させないため await しない）
      logProfileUpdate({
        userId,
        previousValues: previousData,
        newValues: validatedData,
        ipAddress: clientIp,
        userAgent,
        success: true,
      }).catch((error) => {
        logger.warn("Failed to create audit log for profile update", { error });
      });

      logger.info("Profile updated successfully", {
        userId,
        updatedFields: Object.keys(validatedData),
      });

      return {
        success: true,
        message: "プロフィールを更新しました",
      };
    } catch (error) {
      // 失敗した更新の監査ログを作成
      logProfileUpdate({
        userId,
        newValues: data as Record<string, unknown>,
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch((auditError) => {
        logger.warn("Failed to create audit log for failed profile update", { auditError });
      });

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to update profile", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "プロフィールの更新に失敗しました",
      );
    }
  },
);
