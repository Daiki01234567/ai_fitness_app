/**
 * セッション取得 API
 *
 * 特定のトレーニングセッションの詳細データを取得
 * ユーザーが過去のトレーニング結果を確認するために使用
 *
 * @see docs/common/tickets/012-session-get-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md セクション6
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireAuth } from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import {
  TrainingGetSessionRequest,
  TrainingGetSessionResponse,
} from "../../types/training";
import { RateLimitError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Timestampを ISO 8601 文字列に変換
 */
function timestampToIsoString(timestamp: Timestamp | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  return timestamp.toDate().toISOString();
}

/**
 * トレーニングセッションを取得
 *
 * 認証が必要、本人確認あり
 * 削除予定ユーザーも読み取り可能（データエクスポート用）
 */
export const getSession = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<TrainingGetSessionResponse> => {
    const startTime = Date.now();

    // 認証チェック
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    const data = request.data as TrainingGetSessionRequest;

    logger.info("Getting session", {
      userId,
      sessionId: data.sessionId,
    });

    // Rate limiting: 50 requests per hour per user
    try {
      await rateLimiter.check("TRAINING_GET_SESSION", userId);
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
        logger.warn("Unauthorized session access attempt", {
          userId,
          sessionId: data.sessionId,
          sessionUserId: sessionData.userId,
        });
        throw new HttpsError("permission-denied", "他人のセッションにはアクセスできません");
      }

      const duration = Date.now() - startTime;
      logger.info("Session retrieved", {
        userId,
        sessionId: data.sessionId,
        duration,
      });

      // レスポンス
      return {
        success: true,
        data: {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          exerciseType: sessionData.exerciseType,
          startTime: timestampToIsoString(sessionData.startTime) || new Date().toISOString(),
          endTime: timestampToIsoString(sessionData.endTime),
          duration: sessionData.duration || null,
          status: sessionData.status,
          repCount: sessionData.repCount || 0,
          setCount: sessionData.setCount || 0,
          formFeedback: sessionData.formFeedback || null,
          cameraSettings: sessionData.cameraSettings,
          sessionMetadata: sessionData.sessionMetadata || null,
          createdAt: timestampToIsoString(sessionData.createdAt) || new Date().toISOString(),
          updatedAt: timestampToIsoString(sessionData.updatedAt) || new Date().toISOString(),
        },
      };
    } catch (error) {
      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to get session", error as Error, {
        userId,
        sessionId: data.sessionId,
      });
      throw new HttpsError(
        "internal",
        "セッションの取得に失敗しました",
      );
    }
  },
);
