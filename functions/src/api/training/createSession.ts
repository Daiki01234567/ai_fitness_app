/**
 * トレーニングセッション作成 API
 *
 * MediaPipeでトレーニングを開始する際に呼び出される
 * セッションの基本情報とカメラ設定を保存
 *
 * @see docs/common/tickets/011-session-save-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md セクション6
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireAuthWithWritePermission } from "../../middleware/auth";
import {
  TrainingCreateSessionRequest,
  TrainingCreateSessionResponse,
  TrainingExerciseType,
} from "../../types/training";
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
 * 種目タイプをバリデート
 */
function validateExerciseType(exerciseType: unknown): TrainingExerciseType {
  if (typeof exerciseType !== "string") {
    throw new HttpsError("invalid-argument", "種目タイプは文字列である必要があります");
  }

  if (!VALID_EXERCISE_TYPES.includes(exerciseType as TrainingExerciseType)) {
    throw new HttpsError(
      "invalid-argument",
      `無効な種目です。有効な種目: ${VALID_EXERCISE_TYPES.join(", ")}`,
    );
  }

  return exerciseType as TrainingExerciseType;
}

/**
 * カメラ設定をバリデート
 */
function validateCameraSettings(cameraSettings: unknown): {
  position: "front" | "side";
  resolution: string;
  fps: number;
} {
  if (!cameraSettings || typeof cameraSettings !== "object") {
    throw new HttpsError("invalid-argument", "カメラ設定が無効です");
  }

  const settings = cameraSettings as Record<string, unknown>;

  // position
  if (!settings.position || typeof settings.position !== "string") {
    throw new HttpsError("invalid-argument", "カメラ位置が無効です");
  }
  if (settings.position !== "front" && settings.position !== "side") {
    throw new HttpsError(
      "invalid-argument",
      "カメラ位置は 'front' または 'side' である必要があります",
    );
  }

  // resolution
  if (!settings.resolution || typeof settings.resolution !== "string") {
    throw new HttpsError("invalid-argument", "解像度が無効です");
  }
  // 解像度フォーマットチェック（例: "1280x720"）
  if (!/^\d+x\d+$/.test(settings.resolution)) {
    throw new HttpsError(
      "invalid-argument",
      "解像度は 'WIDTHxHEIGHT' の形式である必要があります（例: 1280x720）",
    );
  }

  // fps
  if (typeof settings.fps !== "number" || !Number.isInteger(settings.fps)) {
    throw new HttpsError("invalid-argument", "FPSは整数である必要があります");
  }
  if (settings.fps < 1) {
    throw new HttpsError("invalid-argument", "FPSは1以上である必要があります");
  }

  return {
    position: settings.position as "front" | "side",
    resolution: settings.resolution,
    fps: settings.fps,
  };
}

/**
 * トレーニングセッションを作成
 *
 * 認証が必要、削除予定ユーザーは作成不可
 */
export const createSession = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<TrainingCreateSessionResponse> => {
    const startTime = Date.now();

    // 認証チェック + 削除予定ユーザーチェック
    const authContext = await requireAuthWithWritePermission(request);
    const userId = authContext.uid;

    const data = request.data as TrainingCreateSessionRequest;

    logger.info("Creating session", {
      userId,
      exerciseType: data.exerciseType,
    });

    try {
      // バリデーション
      const exerciseType = validateExerciseType(data.exerciseType);
      const cameraSettings = validateCameraSettings(data.cameraSettings);

      // Firestoreにセッション作成
      const sessionRef = db
        .collection("users")
        .doc(userId)
        .collection("sessions")
        .doc();

      const now = new Date();
      const sessionData = {
        sessionId: sessionRef.id,
        userId,
        exerciseType,
        startTime: FieldValue.serverTimestamp(),
        endTime: null,
        duration: null,
        status: "active",
        repCount: 0,
        setCount: 0,
        formFeedback: null,
        cameraSettings,
        sessionMetadata: null,
        bigquerySyncStatus: "pending",
        bigquerySyncedAt: null,
        bigquerySyncError: null,
        bigquerySyncRetryCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        // データ保持期限は3年後
        dataRetentionDate: admin.firestore.Timestamp.fromDate(
          new Date(now.getTime() + 3 * 365 * 24 * 60 * 60 * 1000),
        ),
      };

      await sessionRef.set(sessionData);

      const duration = Date.now() - startTime;
      logger.info("Session created", {
        userId,
        sessionId: sessionRef.id,
        exerciseType,
        duration,
      });

      return {
        success: true,
        data: {
          sessionId: sessionRef.id,
          userId,
          exerciseType,
          startTime: now.toISOString(),
          status: "active",
        },
      };
    } catch (error) {
      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 他のエラーはログ出力してラップ
      logger.error("Failed to create session", error as Error, { userId });
      throw new HttpsError(
        "internal",
        "セッションの作成に失敗しました",
      );
    }
  },
);
