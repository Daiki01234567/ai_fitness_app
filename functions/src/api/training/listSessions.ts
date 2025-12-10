/**
 * トレーニング履歴一覧 API
 *
 * ユーザーのトレーニング履歴を一覧表示
 * ページネーション対応、日付順（新しい順）、種目フィルタリング機能
 *
 * @see docs/common/tickets/013-history-list-api.md
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
  TrainingExerciseType,
  TrainingListSessionsRequest,
  TrainingListSessionsResponse,
  TrainingSessionSummary,
} from "../../types/training";
import { RateLimitError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 有効な種目リスト（Expo版5種目）
 */
const VALID_EXERCISE_TYPES: TrainingExerciseType[] = [
  "squat",
  "pushup",
  "armcurl",
  "sidelateral",
  "shoulderpress",
];

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
 * トレーニング履歴を一覧取得
 *
 * 認証が必要、本人のみアクセス可能
 * 削除予定ユーザーも読み取り可能（データエクスポート用）
 */
export const listSessions = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<TrainingListSessionsResponse> => {
    const startTime = Date.now();

    // 認証チェック
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    const data = request.data as TrainingListSessionsRequest;

    logger.info("Listing sessions", {
      userId,
      limit: data.limit,
      exerciseType: data.exerciseType,
    });

    // Rate limiting: 50 requests per hour per user
    try {
      await rateLimiter.check("TRAINING_GET_SESSIONS", userId);
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
      const limit = data.limit || 20;
      if (limit < 1 || limit > 100) {
        throw new HttpsError("invalid-argument", "limitは1〜100の範囲で指定してください");
      }

      // 種目フィルタのバリデーション
      if (data.exerciseType !== undefined && data.exerciseType !== null) {
        if (!VALID_EXERCISE_TYPES.includes(data.exerciseType as TrainingExerciseType)) {
          throw new HttpsError(
            "invalid-argument",
            `無効な種目です。有効な種目: ${VALID_EXERCISE_TYPES.join(", ")}`,
          );
        }
      }

      // Firestoreクエリ構築
      let query = db
        .collection("users")
        .doc(userId)
        .collection("sessions")
        .orderBy("createdAt", "desc")
        .limit(limit + 1); // +1で次ページの有無を判定

      // 種目フィルタ
      if (data.exerciseType) {
        query = query.where("exerciseType", "==", data.exerciseType);
      }

      // ページネーション
      if (data.startAfter) {
        const startAfterDoc = await db
          .collection("users")
          .doc(userId)
          .collection("sessions")
          .doc(data.startAfter)
          .get();

        if (!startAfterDoc.exists) {
          throw new HttpsError("invalid-argument", "無効なカーソルです");
        }

        query = query.startAfter(startAfterDoc);
      }

      // データ取得
      const snapshot = await query.get();
      const docs = snapshot.docs.slice(0, limit);

      const sessions: TrainingSessionSummary[] = docs.map((doc) => {
        const sessionData = doc.data();
        return {
          sessionId: sessionData.sessionId,
          exerciseType: sessionData.exerciseType,
          startTime: timestampToIsoString(sessionData.startTime) || new Date().toISOString(),
          endTime: timestampToIsoString(sessionData.endTime),
          duration: sessionData.duration || null,
          status: sessionData.status,
          repCount: sessionData.repCount || 0,
          setCount: sessionData.setCount || 0,
          overallScore: sessionData.formFeedback?.overallScore || null,
          createdAt: timestampToIsoString(sessionData.createdAt) || new Date().toISOString(),
        };
      });

      const hasMore = snapshot.docs.length > limit;
      const nextCursor = hasMore && sessions.length > 0
        ? sessions[sessions.length - 1].sessionId
        : null;

      const duration = Date.now() - startTime;
      logger.info("Sessions listed", {
        userId,
        count: sessions.length,
        hasMore,
        duration,
      });

      return {
        success: true,
        data: {
          sessions,
          hasMore,
          nextCursor,
        },
      };
    } catch (error) {
      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to list sessions", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "セッションの一覧取得に失敗しました",
      );
    }
  },
);
