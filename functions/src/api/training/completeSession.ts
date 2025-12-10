/**
 * トレーニングセッション完了 API
 *
 * トレーニング終了時に結果データを保存
 * フォーム評価結果、メタデータ、パフォーマンス情報を含む
 *
 * @see docs/common/tickets/011-session-save-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md セクション6
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireAuth } from "../../middleware/auth";
import {
  TrainingCompleteSessionRequest,
  TrainingCompleteSessionResponse,
  FormFeedback,
  TrainingSessionMetadata,
} from "../../types/training";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * フォームフィードバックをバリデート
 */
function validateFormFeedback(formFeedback: unknown): FormFeedback {
  if (!formFeedback || typeof formFeedback !== "object") {
    throw new HttpsError("invalid-argument", "フォーム評価データが無効です");
  }

  const feedback = formFeedback as Record<string, unknown>;

  // overallScore
  if (typeof feedback.overallScore !== "number" || !Number.isInteger(feedback.overallScore)) {
    throw new HttpsError("invalid-argument", "総合スコアは整数である必要があります");
  }
  if (feedback.overallScore < 0 || feedback.overallScore > 100) {
    throw new HttpsError("invalid-argument", "総合スコアは0〜100の範囲である必要があります");
  }

  // フレームカウント
  const frameFields = ["goodFrames", "warningFrames", "errorFrames"];
  for (const field of frameFields) {
    if (typeof feedback[field] !== "number" || !Number.isInteger(feedback[field])) {
      throw new HttpsError("invalid-argument", `${field}は整数である必要があります`);
    }
    const value = feedback[field];
    if (typeof value === "number" && value < 0) {
      throw new HttpsError("invalid-argument", `${field}は0以上である必要があります`);
    }
  }

  // warnings
  if (!Array.isArray(feedback.warnings)) {
    throw new HttpsError("invalid-argument", "警告リストは配列である必要があります");
  }

  for (const warning of feedback.warnings) {
    if (!warning || typeof warning !== "object") {
      throw new HttpsError("invalid-argument", "警告データが無効です");
    }
    const w = warning as Record<string, unknown>;

    if (typeof w.type !== "string") {
      throw new HttpsError("invalid-argument", "警告タイプは文字列である必要があります");
    }
    if (typeof w.count !== "number" || !Number.isInteger(w.count) || w.count < 0) {
      throw new HttpsError("invalid-argument", "警告回数は0以上の整数である必要があります");
    }
    if (!["low", "medium", "high"].includes(w.severity as string)) {
      throw new HttpsError("invalid-argument", "警告レベルは low, medium, high のいずれかである必要があります");
    }
  }

  return feedback as unknown as FormFeedback;
}

/**
 * セッションメタデータをバリデート
 */
function validateSessionMetadata(sessionMetadata: unknown): TrainingSessionMetadata {
  if (!sessionMetadata || typeof sessionMetadata !== "object") {
    throw new HttpsError("invalid-argument", "セッションメタデータが無効です");
  }

  const metadata = sessionMetadata as Record<string, unknown>;

  // 数値フィールドのバリデーション
  const numberFields = ["totalFrames", "processedFrames", "frameDropCount"];
  for (const field of numberFields) {
    if (typeof metadata[field] !== "number" || !Number.isInteger(metadata[field])) {
      throw new HttpsError("invalid-argument", `${field}は整数である必要があります`);
    }
    const value = metadata[field];
    if (typeof value === "number" && value < 0) {
      throw new HttpsError("invalid-argument", `${field}は0以上である必要があります`);
    }
  }

  // 浮動小数点フィールド
  const floatFields = ["averageFps", "averageConfidence"];
  for (const field of floatFields) {
    const floatValue = metadata[field];
    if (typeof floatValue !== "number" || floatValue < 0) {
      throw new HttpsError("invalid-argument", `${field}は0以上の数値である必要があります`);
    }
  }

  // averageConfidence は 0-1 の範囲
  const avgConfidence = metadata.averageConfidence;
  if (typeof avgConfidence === "number" && avgConfidence > 1) {
    throw new HttpsError("invalid-argument", "平均信頼度は0〜1の範囲である必要があります");
  }

  // mediapipePerformance
  if (!metadata.mediapipePerformance || typeof metadata.mediapipePerformance !== "object") {
    throw new HttpsError("invalid-argument", "MediaPipeパフォーマンス情報が無効です");
  }

  const perf = metadata.mediapipePerformance as Record<string, unknown>;
  const perfFields = ["averageInferenceTime", "maxInferenceTime", "minInferenceTime"];
  for (const field of perfFields) {
    const perfValue = perf[field];
    if (typeof perfValue !== "number" || perfValue < 0) {
      throw new HttpsError("invalid-argument", `${field}は0以上の数値である必要があります`);
    }
  }

  // deviceInfo
  if (!metadata.deviceInfo || typeof metadata.deviceInfo !== "object") {
    throw new HttpsError("invalid-argument", "デバイス情報が無効です");
  }

  const device = metadata.deviceInfo as Record<string, unknown>;
  if (!["iOS", "Android"].includes(device.platform as string)) {
    throw new HttpsError("invalid-argument", "プラットフォームは iOS または Android である必要があります");
  }
  if (typeof device.osVersion !== "string") {
    throw new HttpsError("invalid-argument", "OSバージョンは文字列である必要があります");
  }
  if (typeof device.deviceModel !== "string") {
    throw new HttpsError("invalid-argument", "デバイスモデルは文字列である必要があります");
  }
  const deviceMem = device.deviceMemory;
  if (deviceMem !== null && (typeof deviceMem !== "number" || deviceMem < 0)) {
    throw new HttpsError("invalid-argument", "デバイスメモリは0以上の数値またはnullである必要があります");
  }

  return metadata as unknown as TrainingSessionMetadata;
}

/**
 * トレーニングセッションを完了
 *
 * 認証が必要、本人確認あり
 */
export const completeSession = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<TrainingCompleteSessionResponse> => {
    const startTime = Date.now();

    // 認証チェック
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    const data = request.data as TrainingCompleteSessionRequest;

    logger.info("Completing session", {
      userId,
      sessionId: data.sessionId,
    });

    try {
      // バリデーション
      if (!data.sessionId || typeof data.sessionId !== "string") {
        throw new HttpsError("invalid-argument", "セッションIDが無効です");
      }

      if (typeof data.repCount !== "number" || !Number.isInteger(data.repCount) || data.repCount < 0) {
        throw new HttpsError("invalid-argument", "回数は0以上の整数である必要があります");
      }

      if (typeof data.setCount !== "number" || !Number.isInteger(data.setCount) || data.setCount < 1) {
        throw new HttpsError("invalid-argument", "セット数は1以上の整数である必要があります");
      }

      const formFeedback = validateFormFeedback(data.formFeedback);
      const sessionMetadata = validateSessionMetadata(data.sessionMetadata);

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
        logger.warn("Unauthorized session completion attempt", {
          userId,
          sessionId: data.sessionId,
          sessionUserId: sessionData.userId,
        });
        throw new HttpsError("permission-denied", "他人のセッションは完了できません");
      }

      // 既に完了している場合はエラー
      if (sessionData.status === "completed") {
        throw new HttpsError("failed-precondition", "セッションは既に完了しています");
      }

      // 期間を計算
      const endTime = new Date();
      const startTimeData = sessionData.startTime as Timestamp;
      const startDate = startTimeData.toDate();
      const duration = Math.floor((endTime.getTime() - startDate.getTime()) / 1000);

      // セッション更新
      await sessionRef.update({
        endTime: FieldValue.serverTimestamp(),
        duration,
        status: "completed",
        repCount: data.repCount,
        setCount: data.setCount,
        formFeedback,
        sessionMetadata,
        bigquerySyncStatus: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const processingDuration = Date.now() - startTime;
      logger.info("Session completed", {
        userId,
        sessionId: data.sessionId,
        repCount: data.repCount,
        overallScore: formFeedback.overallScore,
        duration: processingDuration,
      });

      return {
        success: true,
        data: {
          sessionId: data.sessionId,
          userId,
          status: "completed",
          repCount: data.repCount,
          overallScore: formFeedback.overallScore,
          completedAt: endTime.toISOString(),
        },
        message: "トレーニングセッションを保存しました",
      };
    } catch (error) {
      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to complete session", error as Error, {
        userId,
        sessionId: data.sessionId,
      });
      throw new HttpsError(
        "internal",
        "セッションの完了に失敗しました",
      );
    }
  },
);
