/**
 * セッション削除 API
 *
 * トレーニングセッションを削除（論理削除）
 * ステータスを 'cancelled' に変更して、物理削除はしない
 *
 * @see docs/common/tickets/014-session-delete-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md セクション6
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireAuthWithWritePermission } from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import {
  TrainingDeleteSessionRequest,
  TrainingDeleteSessionResponse,
} from "../../types/training";
import { RateLimitError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * トレーニングセッションを削除（論理削除）
 *
 * 認証が必要、削除予定ユーザーは削除不可
 * 本人確認あり、物理削除ではなくステータスを 'cancelled' に変更
 */
export const deleteSession = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<TrainingDeleteSessionResponse> => {
    const startTime = Date.now();

    // 認証チェック + 削除予定ユーザーチェック
    const authContext = await requireAuthWithWritePermission(request);
    const userId = authContext.uid;

    const data = request.data as TrainingDeleteSessionRequest;

    logger.info("Deleting session", {
      userId,
      sessionId: data.sessionId,
    });

    // Rate limiting: 20 requests per hour per user
    try {
      await rateLimiter.check("TRAINING_DELETE_SESSION", userId);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new HttpsError(
          "resource-exhausted",
          "レート制限を超えました。しばらくしてからお試しください。",
        );
      }
      throw error;
    }

    try {
      // バリデーション
      if (!data.sessionId || typeof data.sessionId !== "string") {
        throw new HttpsError("invalid-argument", "セッションIDが無効です");
      }

      // Firestoreからセッション取得
      const sessionRef = db
        .collection("users")
        .doc(userId)
        .collection("sessions")
        .doc(data.sessionId);

      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "セッションが見つかりません");
      }

      const sessionData = sessionDoc.data();
      if (!sessionData) {
        throw new HttpsError("not-found", "セッションデータが見つかりません");
      }

      // 本人確認
      if (sessionData.userId !== userId) {
        logger.warn("Unauthorized session deletion attempt", {
          userId,
          sessionId: data.sessionId,
          sessionUserId: sessionData.userId,
        });
        throw new HttpsError("permission-denied", "他人のセッションは削除できません");
      }

      // 既に削除されている場合
      if (sessionData.status === "cancelled") {
        throw new HttpsError("failed-precondition", "セッションは既に削除されています");
      }

      // 論理削除（statusを'cancelled'に変更）
      await sessionRef.update({
        status: "cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const deletedAt = new Date();
      const duration = Date.now() - startTime;

      logger.info("Session deleted (logical)", {
        userId,
        sessionId: data.sessionId,
        duration,
      });

      return {
        success: true,
        data: {
          sessionId: data.sessionId,
          status: "cancelled",
          deletedAt: deletedAt.toISOString(),
        },
        message: "セッションを削除しました",
      };
    } catch (error) {
      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to delete session", error as Error, {
        userId,
        sessionId: data.sessionId,
      });
      throw new HttpsError(
        "internal",
        "セッションの削除に失敗しました",
      );
    }
  },
);
