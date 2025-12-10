/**
 * ユーザープロフィール取得 API
 *
 * 認証済みユーザーのプロフィール情報を取得
 * 削除予定ユーザーでも読み取り専用でアクセス可能
 *
 * @version 1.0.0
 * @date 2025-12-10
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { GetProfileResponse, SuccessResponse } from "../../types/api";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * ユーザープロフィールを取得
 *
 * 認証済みユーザーの Firestore ドキュメントからプロフィール情報を取得
 * 削除予定ユーザーでも取得可能（読み取り専用モード）
 *
 * @returns プロフィール情報を含むレスポンス
 * @throws HttpsError - 認証エラーまたはユーザーが見つからない場合
 */
export const getProfile = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetProfileResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Authentication check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;

    logger.info("Getting user profile", { userId });

    try {
      // Fetch user document from Firestore
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      if (!userData) {
        throw new HttpsError("not-found", "ユーザーデータが見つかりません");
      }

      // Calculate birthYear from profile.birthday if available
      let birthYear: number | undefined = userData.birthYear;
      if (!birthYear && userData.profile?.birthday) {
        try {
          birthYear = new Date(userData.profile.birthday).getFullYear();
        } catch {
          // Invalid date format, ignore
        }
      }

      // Build response
      const response: GetProfileResponse = {
        userId,
        nickname: userData.nickname || userData.displayName || "",
        email: userData.email || "",
        photoURL: userData.photoURL || undefined,
        birthYear,
        gender: userData.gender || userData.profile?.gender || undefined,
        height: userData.height || userData.profile?.height || undefined,
        weight: userData.weight || userData.profile?.weight || undefined,
        fitnessLevel: userData.fitnessLevel || userData.profile?.fitnessLevel || undefined,
        tosAccepted: userData.tosAccepted || false,
        ppAccepted: userData.ppAccepted || false,
        deletionScheduled: userData.deletionScheduled || false,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: userData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };

      // Log if user is in deletion scheduled state
      if (userData.deletionScheduled) {
        logger.info("Profile retrieved for deletion-scheduled user", {
          userId,
          scheduledDeletionDate: userData.scheduledDeletionDate?.toDate?.()?.toISOString(),
        });
      }

      logger.info("Profile retrieved successfully", { userId });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      // Re-throw HttpsError as is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Log and wrap other errors
      logger.error("Failed to get profile", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "プロフィールの取得に失敗しました",
      );
    }
  },
);
