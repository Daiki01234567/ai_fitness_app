/**
 * Pub/Sub セッションプロセッサー
 *
 * トレーニングセッションデータを仮名化してBigQueryに挿入
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション5.2.2
 */

import * as crypto from "crypto";

import { BigQuery } from "@google-cloud/bigquery";
import { PubSub } from "@google-cloud/pubsub";
import { onMessagePublished } from "firebase-functions/v2/pubsub";

import { logger } from "../utils/logger";

// Pub/Sub トピック名
const SESSION_STREAM_TOPIC = "training-sessions-stream";
const DLQ_TOPIC = "training-sessions-dlq";

// 設定
const MAX_RETRY_COUNT = 3;
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "tokyo-list-478804-e5";
const DATASET_ID = "fitness_analytics";

// BigQuery クライアント
const bigquery = new BigQuery({ projectId: PROJECT_ID });
const pubsub = new PubSub({ projectId: PROJECT_ID });

/**
 * セッションメッセージの型定義
 */
interface SessionMessage {
  userId: string;
  sessionId: string;
  data: {
    exerciseType: string;
    startTime: string | null;
    endTime: string | null;
    repCount: number;
    totalScore: number;
    averageScore: number;
    duration: number;
    sessionMetadata: {
      deviceInfo: {
        platform: string;
        osVersion: string;
        model: string;
      } | null;
      averageFps: number;
      appVersion: string;
    } | null;
    createdAt: string;
  };
  timestamp: string;
}

/**
 * ユーザーIDをSHA-256でハッシュ化（仮名化）
 */
function hashUserId(userId: string): string {
  const salt = process.env.ANONYMIZATION_SALT ?? "fitness-app-salt";
  return crypto
    .createHash("sha256")
    .update(userId + salt)
    .digest("hex");
}

/**
 * UUID v4 を生成
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * リトライ可能なエラーかどうかを判定
 */
function isRetryableError(error: unknown): boolean {
  const err = error as { code?: string | number; message?: string };
  // ネットワークエラー、タイムアウト、一時的なサーバーエラー
  const retryableCodes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "503", "500"];
  return retryableCodes.includes(String(err.code)) ||
    (err.message?.includes("timeout") ?? false) ||
    (err.message?.includes("UNAVAILABLE") ?? false);
}

/**
 * 仮名化ログをBigQueryに記録
 */
async function logPseudonymization(params: {
  logId: string;
  sourceCollection: string;
  sourceDocumentId: string;
  targetTable: string;
  status: "success" | "failed" | "retrying";
  errorMessage: string | null;
  retryCount: number;
  processingStartedAt: Date;
  processingCompletedAt: Date;
}): Promise<void> {
  try {
    // BigQuery column names use snake_case
    const row: Record<string, unknown> = {
      "log_id": params.logId,
      "source_collection": params.sourceCollection,
      "source_document_id": params.sourceDocumentId,
      "target_table": params.targetTable,
      "status": params.status,
      "error_message": params.errorMessage,
      "retry_count": params.retryCount,
      "processing_started_at": params.processingStartedAt.toISOString(),
      "processing_completed_at": params.processingCompletedAt.toISOString(),
      "created_at": new Date().toISOString(),
    };

    await bigquery
      .dataset(DATASET_ID)
      .table("pseudonymization_log")
      .insert([row]);
  } catch (error) {
    // ログ記録の失敗は警告のみ（メイン処理を止めない）
    logger.warn("Failed to log pseudonymization", { error, params });
  }
}

/**
 * Pub/Subサブスクライバー: トレーニングセッションの仮名化とBigQuery挿入
 *
 * 設計書 5.2.2 に基づく実装:
 * - リトライロジック（指数バックオフ、最大3回）
 * - DLQ（Dead Letter Queue）への送信
 * - 仮名化ログの記録
 */
export const processTrainingSession = onMessagePublished(
  {
    topic: SESSION_STREAM_TOPIC,
    region: "asia-northeast1",
    retry: true,
  },
  async (event) => {
    const logId = generateUUID();
    const startTime = new Date();

    try {
      // メッセージデータの取得
      const messageData = event.data.message.json as SessionMessage;
      const { userId, sessionId, data: sessionData } = messageData;

      // リトライ回数の取得
      const attributes = event.data.message.attributes ?? {};
      const retryCount = attributes.retryCount
        ? parseInt(attributes.retryCount, 10)
        : 0;

      logger.info("Processing session", {
        sessionId,
        exerciseType: sessionData.exerciseType,
        retryCount,
      });

      // 1. ユーザーIDの仮名化
      const userIdHash = hashUserId(userId);

      // 2. BigQuery挿入用データの作成 (column names use snake_case)
      const bigqueryRow: Record<string, unknown> = {
        "session_id": sessionId,
        "user_id_hash": userIdHash,
        "exercise_id": sessionData.exerciseType,
        "start_time": sessionData.startTime,
        "end_time": sessionData.endTime,
        "duration_seconds": sessionData.duration,
        "created_at": sessionData.createdAt,
        "rep_count": sessionData.repCount,
        "set_count": null, // Firestoreから取得できる場合は設定
        "average_score": sessionData.averageScore,
        "max_score": null, // 必要に応じて計算
        "min_score": null, // 必要に応じて計算
        "landmarks": [], // 骨格データ（将来のML用）
        "device_info": sessionData.sessionMetadata?.deviceInfo
          ? {
            "os": sessionData.sessionMetadata.deviceInfo.platform,
            "os_version": sessionData.sessionMetadata.deviceInfo.osVersion,
            "device_model": sessionData.sessionMetadata.deviceInfo.model,
            "app_version": sessionData.sessionMetadata.appVersion,
          }
          : null,
        "region": "JP", // 日本市場のみ
        "is_deleted": false,
        "deleted_at": null,
      };

      // 3. BigQueryへのストリーミング挿入
      await bigquery
        .dataset(DATASET_ID)
        .table("training_sessions")
        .insert([bigqueryRow]);

      logger.info("Session inserted to BigQuery", {
        sessionId,
        userIdHash: userIdHash.substring(0, 8) + "...",
      });

      // 4. 成功ログの記録
      await logPseudonymization({
        logId,
        sourceCollection: `users/${userId}/sessions`,
        sourceDocumentId: sessionId,
        targetTable: "training_sessions",
        status: "success",
        errorMessage: null,
        retryCount,
        processingStartedAt: startTime,
        processingCompletedAt: new Date(),
      });

    } catch (error) {
      const err = error as Error;
      logger.error("Error processing session", err);

      // リトライ可能なエラーかチェック
      if (isRetryableError(error)) {
        const messageData = event.data.message.json as SessionMessage;
        const attributes = event.data.message.attributes ?? {};
        const retryCount = attributes.retryCount
          ? parseInt(attributes.retryCount, 10)
          : 0;

        if (retryCount < MAX_RETRY_COUNT) {
          // リトライ: 指数バックオフで再発行
          const delay = Math.pow(2, retryCount) * 1000;

          logger.info(`Retrying in ${delay}ms`, {
            attempt: retryCount + 1,
            maxRetries: MAX_RETRY_COUNT,
          });

          await new Promise((resolve) => setTimeout(resolve, delay));

          // Pub/Subに再発行
          const topic = pubsub.topic(SESSION_STREAM_TOPIC);
          await topic.publishMessage({
            json: messageData,
            attributes: {
              ...attributes,
              retryCount: String(retryCount + 1),
            },
          });

          // リトライログの記録
          await logPseudonymization({
            logId,
            sourceCollection: `users/${messageData.userId}/sessions`,
            sourceDocumentId: messageData.sessionId,
            targetTable: "training_sessions",
            status: "retrying",
            errorMessage: err.message,
            retryCount: retryCount + 1,
            processingStartedAt: startTime,
            processingCompletedAt: new Date(),
          });

          return;
        }

        // 最大リトライ回数に到達: DLQへ送信
        logger.error("Max retry count reached. Sending to DLQ.", err);

        const dlqTopic = pubsub.topic(DLQ_TOPIC);
        await dlqTopic.publishMessage({
          json: {
            ...messageData,
            error: err.message,
            failedAt: new Date().toISOString(),
            retryCount: MAX_RETRY_COUNT,
          },
        });

        // 失敗ログの記録
        await logPseudonymization({
          logId,
          sourceCollection: `users/${messageData.userId}/sessions`,
          sourceDocumentId: messageData.sessionId,
          targetTable: "training_sessions",
          status: "failed",
          errorMessage: err.message,
          retryCount: MAX_RETRY_COUNT,
          processingStartedAt: startTime,
          processingCompletedAt: new Date(),
        });
      } else {
        // リトライ不可能なエラー: 即座にDLQへ
        const messageData = event.data.message.json as SessionMessage;

        const dlqTopic = pubsub.topic(DLQ_TOPIC);
        await dlqTopic.publishMessage({
          json: {
            ...messageData,
            error: err.message,
            failedAt: new Date().toISOString(),
            retryCount: 0,
          },
        });

        await logPseudonymization({
          logId,
          sourceCollection: `users/${messageData.userId}/sessions`,
          sourceDocumentId: messageData.sessionId,
          targetTable: "training_sessions",
          status: "failed",
          errorMessage: err.message,
          retryCount: 0,
          processingStartedAt: startTime,
          processingCompletedAt: new Date(),
        });
      }
    }
  },
);
