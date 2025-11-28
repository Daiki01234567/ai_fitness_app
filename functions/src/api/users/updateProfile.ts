/**
 * Update User Profile API
 *
 * Updates user profile information in Firestore.
 * Called after registration Step 2 or from profile settings.
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

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Profile update request data
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
 * Validate date of birth
 * Must be a valid date string and user must be at least 13 years old (Japan regulation)
 */
function validateDateOfBirth(dateOfBirth: unknown): Date | undefined {
  if (dateOfBirth === undefined || dateOfBirth === null || dateOfBirth === "") {
    return undefined;
  }

  if (!isNonEmptyString(dateOfBirth)) {
    throw new HttpsError("invalid-argument", "生年月日の形式が不正です");
  }

  // Parse ISO 8601 date format
  const date = new Date(dateOfBirth);
  if (isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "生年月日の形式が不正です（YYYY-MM-DD）");
  }

  // Check minimum age (13 years for Japan)
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
 * Validate fitness goal
 */
function validateFitnessGoal(goal: unknown): string | undefined {
  if (goal === undefined || goal === null || goal === "") {
    return undefined;
  }

  if (!isNonEmptyString(goal)) {
    throw new HttpsError("invalid-argument", "目標の形式が不正です");
  }

  // Validate max length
  if (goal.length > 100) {
    throw new HttpsError("invalid-argument", "目標は100文字以内で入力してください");
  }

  return goal.trim();
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

  // Check common IP headers
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
 * Update user profile
 *
 * Callable function to update user profile in Firestore.
 * Requires authentication.
 */
export const updateProfile = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Enable CORS for web clients
  },
  async (request) => {
    // CSRF Protection
    requireCsrfProtection(request);

    // Check authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data as UpdateProfileRequest;

    // Extract request metadata for audit logging
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
      // Validate input data
      const validatedData: Record<string, unknown> = {};

      // Display name
      if (data.displayName !== undefined) {
        validatedData.displayName = validateNickname(data.displayName);
      }

      // Date of birth
      if (data.dateOfBirth !== undefined) {
        const dob = validateDateOfBirth(data.dateOfBirth);
        if (dob) {
          validatedData["profile.birthday"] = Timestamp.fromDate(dob);
        }
      }

      // Gender
      if (data.gender !== undefined) {
        const gender = validateGender(data.gender);
        if (gender) {
          validatedData["profile.gender"] = gender;
        }
      }

      // Height
      if (data.height !== undefined) {
        const height = validateHeight(data.height);
        if (height !== undefined) {
          validatedData["profile.height"] = height;
        }
      }

      // Weight
      if (data.weight !== undefined) {
        const weight = validateWeight(data.weight);
        if (weight !== undefined) {
          validatedData["profile.weight"] = weight;
        }
      }

      // Fitness goal
      if (data.fitnessGoal !== undefined) {
        const goal = validateFitnessGoal(data.fitnessGoal);
        if (goal) {
          validatedData["profile.goals"] = [goal];
        }
      }

      // Fitness level
      if (data.fitnessLevel !== undefined) {
        const level = validateFitnessLevel(data.fitnessLevel);
        if (level) {
          validatedData["profile.fitnessLevel"] = level;
        }
      }

      // Check if there's anything to update
      if (Object.keys(validatedData).length === 0) {
        throw new HttpsError("invalid-argument", "更新するデータがありません");
      }

      // Add timestamp
      validatedData.updatedAt = FieldValue.serverTimestamp();

      // Update Firestore
      const userRef = db.collection("users").doc(userId);

      // Check if user document exists and get previous values
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const previousData = userDoc.data() || {};

      // Check if deletion is scheduled
      if (previousData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されているため、プロフィールを更新できません",
        );
      }

      // Perform update
      await userRef.update(validatedData);

      // Create audit log (async, don't await to avoid slowing down response)
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
      // Create audit log for failed update
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

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Log and wrap other errors
      logger.error("Failed to update profile", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "プロフィールの更新に失敗しました",
      );
    }
  },
);
