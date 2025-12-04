/**
 * BigQuery DLQ (Dead Letter Queue) 処理
 *
 * 失敗したBigQuery同期メッセージを定期的にリトライ
 *
 * 仕様書参照:
 * - docs/specs/04_BigQuery設計書_v3_3.md - セクション5.2.3
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { PubSub, Message } from "@google-cloud/pubsub";

import { logger } from "../utils/logger";
import { requireAdminFromRequest } from "../middleware/adminAuth";

const pubsub = new PubSub();

// トピック名
const SESSION_STREAM_TOPIC = "training-sessions-stream";
const DLQ_SUBSCRIPTION = "training-sessions-dlq-sub";

// 設定
const MAX_MESSAGES_PER_RUN = 100;
const PULL_TIMEOUT_MS = 10000; // 10秒

/**
 * DLQメッセージの型定義
 */
interface DLQMessage {
  userId: string;
  sessionId: string;
  data: Record<string, unknown>;
  error?: string;
  failedAt?: string;
  retryCount?: number;
}

/**
 * スケジュール実行: DLQメッセージを定期的にリトライ
 *
 * 毎日午前5時（JST）に実行
 */
export const scheduled_processBigQueryDlq = onSchedule(
  {
    schedule: "0 5 * * *", // 毎日午前5時（JST）
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    logger.info("Starting scheduled DLQ processing");

    try {
      const result = await processDlqMessages(MAX_MESSAGES_PER_RUN);

      logger.info("Scheduled DLQ processing completed", result);
    } catch (error) {
      logger.error("Scheduled DLQ processing failed", error as Error);
      throw error;
    }
  },
);

/**
 * 手動実行: 管理者がDLQメッセージをリトライ
 */
export const admin_processDlq = onCall(
  {
    region: "asia-northeast1",
    timeoutSeconds: 120,
  },
  async (request) => {
    // Admin authentication check
    requireAdminFromRequest(request);

    const { sessionId, maxMessages } = request.data as {
      sessionId?: string;
      maxMessages?: number;
    };

    try {
      if (sessionId) {
        // 特定のセッションのみリトライ
        const result = await recoverSpecificSession(sessionId);
        return result;
      } else {
        // バッチリトライ
        const result = await processDlqMessages(maxMessages ?? 100);
        return result;
      }
    } catch (error) {
      const err = error as Error;
      logger.error("Admin DLQ processing failed", err);
      throw new HttpsError("internal", `DLQ処理エラー: ${err.message}`);
    }
  },
);

/**
 * DLQからメッセージを取得してリトライ
 *
 * Pub/Sub v5の非同期メッセージ処理を使用
 */
async function processDlqMessages(
  maxMessages: number,
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const subscription = pubsub.subscription(DLQ_SUBSCRIPTION);
  const topic = pubsub.topic(SESSION_STREAM_TOPIC);

  const messages: Message[] = [];
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // メッセージを収集
  return new Promise((resolve) => {
    let messageCount = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const messageHandler = (message: Message) => {
      messages.push(message);
      messageCount++;

      if (messageCount >= maxMessages) {
        subscription.removeListener("message", messageHandler);
        clearTimeout(timeoutId);
        processCollectedMessages();
      }
    };

    const processCollectedMessages = async () => {
      if (messages.length === 0) {
        logger.info("No messages in DLQ");
        resolve({ processed: 0, succeeded: 0, failed: 0, errors: [] });
        return;
      }

      logger.info(`Found ${messages.length} messages in DLQ`);

      for (const message of messages) {
        try {
          const messageData = parseMessage(message);

          // Pub/Subに再発行（リトライカウントをリセット）
          await topic.publishMessage({
            json: {
              userId: messageData.userId,
              sessionId: messageData.sessionId,
              data: messageData.data,
              timestamp: new Date().toISOString(),
            },
            attributes: {
              retryCount: "0",
              manualRecovery: "true",
              originalFailedAt: messageData.failedAt ?? "",
            },
          });

          // 成功したメッセージをACK
          message.ack();
          succeeded++;

          logger.info("Message recovered from DLQ", {
            sessionId: messageData.sessionId,
          });
        } catch (error) {
          failed++;
          const err = error as Error;
          errors.push(err.message);
          // 失敗したメッセージはNACK（再キューイング）
          message.nack();
          logger.error("Failed to recover message from DLQ", err);
        }
      }

      resolve({
        processed: messages.length,
        succeeded,
        failed,
        errors,
      });
    };

    // タイムアウト処理
    timeoutId = setTimeout(() => {
      subscription.removeListener("message", messageHandler);
      processCollectedMessages();
    }, PULL_TIMEOUT_MS);

    // メッセージリスナーを登録
    subscription.on("message", messageHandler);
  });
}

/**
 * 特定のセッションをDLQから回復
 */
async function recoverSpecificSession(
  sessionId: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  const subscription = pubsub.subscription(DLQ_SUBSCRIPTION);
  const topic = pubsub.topic(SESSION_STREAM_TOPIC);

  return new Promise((resolve, reject) => {
    const messages: Message[] = [];
    let timeoutId: ReturnType<typeof setTimeout>;

    const messageHandler = (message: Message) => {
      messages.push(message);

      // 100件まで収集
      if (messages.length >= 100) {
        subscription.removeListener("message", messageHandler);
        clearTimeout(timeoutId);
        findAndRecoverSession();
      }
    };

    const findAndRecoverSession = async () => {
      // 対象セッションを検索
      let targetMessage: Message | undefined;
      let targetData: DLQMessage | undefined;

      for (const msg of messages) {
        try {
          const data = parseMessage(msg);
          if (data.sessionId === sessionId) {
            targetMessage = msg;
            targetData = data;
            break;
          } else {
            // 対象外のメッセージはNACK（キューに戻す）
            msg.nack();
          }
        } catch {
          msg.nack();
        }
      }

      if (!targetMessage || !targetData) {
        reject(
          new HttpsError(
            "not-found",
            `セッション ${sessionId} がDLQに見つかりません`,
          ),
        );
        return;
      }

      try {
        // Pub/Subに再発行
        await topic.publishMessage({
          json: {
            userId: targetData.userId,
            sessionId: targetData.sessionId,
            data: targetData.data,
            timestamp: new Date().toISOString(),
          },
          attributes: {
            retryCount: "0",
            manualRecovery: "true",
          },
        });

        // DLQからメッセージを削除
        targetMessage.ack();

        logger.info(`Session ${sessionId} recovered from DLQ`);

        resolve({
          success: true,
          message: `セッション ${sessionId} をDLQから回復しました`,
        });
      } catch (error) {
        targetMessage.nack();
        reject(error);
      }
    };

    // タイムアウト処理
    timeoutId = setTimeout(() => {
      subscription.removeListener("message", messageHandler);
      findAndRecoverSession();
    }, PULL_TIMEOUT_MS);

    // メッセージリスナーを登録
    subscription.on("message", messageHandler);
  });
}

/**
 * Pub/Subメッセージをパース
 */
function parseMessage(message: Message): DLQMessage {
  if (!message.data) {
    throw new Error("Message has no data");
  }

  const dataStr = message.data.toString("utf-8");
  return JSON.parse(dataStr) as DLQMessage;
}
