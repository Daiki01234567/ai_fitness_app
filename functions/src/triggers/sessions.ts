/**
 * Firestore セッショントリガー
 *
 * トレーニングセッション完了時にBigQueryへのストリーミングをトリガー
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション5.2
 * - docs/specs/02_Firestoreデータベース設計書_v3_3.md - Sessions
 */

import { PubSub } from "@google-cloud/pubsub";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

import { Session } from "../types/firestore";
import { logger } from "../utils/logger";

const pubsub = new PubSub();

// Pub/Sub トピック名
const SESSION_STREAM_TOPIC = "training-sessions-stream";

/**
 * セッション作成トリガー
 *
 * セッションが作成されたときにPub/Subへメッセージを発行
 * (通常は status: "in_progress" で作成される)
 */
export const onSessionCreated = onDocumentCreated(
  {
    document: "users/{userId}/sessions/{sessionId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("Session created event with no data", {
        params: event.params,
      });
      return;
    }

    const sessionData = snapshot.data() as Session;
    const { userId, sessionId } = event.params;

    logger.info("Session created", {
      userId,
      sessionId,
      exerciseType: sessionData.exerciseType,
      status: sessionData.status,
    });

    // 完了したセッションのみBigQueryへ送信
    if (sessionData.status === "completed") {
      await publishSessionToPubSub(userId, sessionId, sessionData);
    }
  },
);

/**
 * セッション更新トリガー
 *
 * セッションが完了状態に更新されたときにPub/Subへメッセージを発行
 */
export const onSessionUpdated = onDocumentUpdated(
  {
    document: "users/{userId}/sessions/{sessionId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const beforeData = event.data?.before?.data() as Session | undefined;
    const afterData = event.data?.after?.data() as Session | undefined;

    if (!beforeData || !afterData) {
      logger.warn("Session updated event with missing data", {
        params: event.params,
      });
      return;
    }

    const { userId, sessionId } = event.params;

    // ステータスが "completed" に変更された場合のみ処理
    if (beforeData.status !== "completed" && afterData.status === "completed") {
      logger.info("Session completed", {
        userId,
        sessionId,
        exerciseType: afterData.exerciseType,
        repCount: afterData.repCount,
        averageScore: afterData.averageScore,
        duration: afterData.duration,
      });

      await publishSessionToPubSub(userId, sessionId, afterData);
    }
  },
);

/**
 * セッションデータをPub/Subに発行
 *
 * @param userId - ユーザーID
 * @param sessionId - セッションID
 * @param sessionData - セッションデータ
 */
async function publishSessionToPubSub(
  userId: string,
  sessionId: string,
  sessionData: Session,
): Promise<void> {
  try {
    const topic = pubsub.topic(SESSION_STREAM_TOPIC);

    // Timestamp を ISO 文字列に変換
    const message = {
      userId,
      sessionId,
      data: {
        exerciseType: sessionData.exerciseType,
        startTime: sessionData.startTime?.toDate?.()?.toISOString() ?? null,
        endTime: sessionData.endTime?.toDate?.()?.toISOString() ?? null,
        repCount: sessionData.repCount,
        totalScore: sessionData.totalScore,
        averageScore: sessionData.averageScore,
        duration: sessionData.duration,
        sessionMetadata: sessionData.sessionMetadata
          ? {
            deviceInfo: sessionData.sessionMetadata.deviceInfo
              ? {
                platform: sessionData.sessionMetadata.deviceInfo.platform,
                osVersion: sessionData.sessionMetadata.deviceInfo.osVersion,
                model: sessionData.sessionMetadata.deviceInfo.model,
              }
              : null,
            averageFps: sessionData.sessionMetadata.averageFps,
            appVersion: sessionData.sessionMetadata.appVersion,
          }
          : null,
        createdAt: sessionData.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    // メッセージを発行
    const messageId = await topic.publishMessage({
      json: message,
      attributes: {
        retryCount: "0",
        sourceCollection: "sessions",
        userId,
        sessionId,
      },
    });

    logger.info("Session published to Pub/Sub", {
      userId,
      sessionId,
      messageId,
      topic: SESSION_STREAM_TOPIC,
    });
  } catch (error) {
    // Pub/Sub発行失敗はFirestoreトリガーで自動リトライされる
    logger.error(
      "Failed to publish session to Pub/Sub",
      error as Error,
      {
        userId,
        sessionId,
        exerciseType: sessionData.exerciseType,
      },
    );
    throw error;
  }
}
