/**
 * Cloud Tasks サービス
 * 非同期タスクキュー操作を処理
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";

import { addMinutes, getExponentialBackoffDelay } from "../utils/date";
import { logger } from "../utils/logger";

// Cloud Tasks 用の型エイリアス
type Task = protos.google.cloud.tasks.v2.ITask;
type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;

/**
 * タスク設定
 */
export interface TaskConfig {
  queueName: string;
  url: string;
  payload: Record<string, unknown>;
  scheduleTime?: Date;
  retryConfig?: RetryConfig;
}

/**
 * リトライ設定
 */
export interface RetryConfig {
  maxRetries: number;
  minBackoffSeconds: number;
  maxBackoffSeconds: number;
  maxDoublings: number;
}

/**
 * デフォルトのリトライ設定
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  minBackoffSeconds: 10,
  maxBackoffSeconds: 3600, // 1時間
  maxDoublings: 5,
};

/**
 * キュー名
 */
export const QueueNames = {
  BIGQUERY_SYNC: "bigquery-sync",
  DATA_EXPORT: "data-export",
  DATA_DELETION: "data-deletion",
  NOTIFICATIONS: "notifications",
  DEFAULT: "default",
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

/**
 * Cloud Tasks サービスクラス
 */
export class CloudTasksService {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;

  constructor(projectId?: string, location = "asia-northeast1") {
    this.client = new CloudTasksClient();
    this.projectId = projectId ?? process.env.GCLOUD_PROJECT ?? "";
    this.location = location;
  }

  /**
   * キューパスを取得
   */
  private getQueuePath(queueName: string): string {
    return this.client.queuePath(this.projectId, this.location, queueName);
  }

  /**
   * 新しいタスクを作成
   */
  async createTask(config: TaskConfig): Promise<string | null> {
    const { queueName, url, payload, scheduleTime } = config;

    try {
      const parent = this.getQueuePath(queueName);

      const task: Task = {
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
          },
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        },
      };

      // スケジュール時間が指定されている場合は設定
      if (scheduleTime) {
        task.scheduleTime = {
          seconds: Math.floor(scheduleTime.getTime() / 1000),
        };
      }

      const request: CreateTaskRequest = {
        parent,
        task,
      };

      const [response] = await this.client.createTask(request);

      logger.info("Task created", {
        queueName,
        taskName: response.name,
        url,
      });

      return response.name ?? null;
    } catch (error) {
      logger.error("Failed to create task", error as Error, {
        queueName,
        url,
      });
      throw error;
    }
  }

  /**
   * BigQuery 同期タスクを作成
   */
  async createBigQuerySyncTask(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    retryCount = 0,
  ): Promise<string | null> {
    const baseUrl = process.env.FUNCTIONS_BASE_URL ?? "";

    return this.createTask({
      queueName: QueueNames.BIGQUERY_SYNC,
      url: `${baseUrl}/bigquery_syncDocument`,
      payload: {
        collection,
        documentId,
        data,
        retryCount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * データエクスポートタスクを作成
   */
  async createDataExportTask(
    userId: string,
    requestId: string,
  ): Promise<string | null> {
    const baseUrl = process.env.FUNCTIONS_BASE_URL ?? "";

    return this.createTask({
      queueName: QueueNames.DATA_EXPORT,
      url: `${baseUrl}/gdpr_processDataExport`,
      payload: {
        userId,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * データ削除タスクを作成
   */
  async createDataDeletionTask(
    userId: string,
    requestId: string,
    scheduledDate: Date,
  ): Promise<string | null> {
    const baseUrl = process.env.FUNCTIONS_BASE_URL ?? "";

    return this.createTask({
      queueName: QueueNames.DATA_DELETION,
      url: `${baseUrl}/gdpr_processDataDeletion`,
      payload: {
        userId,
        requestId,
        timestamp: new Date().toISOString(),
      },
      scheduleTime: scheduledDate,
    });
  }

  /**
   * 通知タスクを作成
   */
  async createNotificationTask(
    userId: string,
    notificationType: string,
    data: Record<string, unknown>,
    scheduleTime?: Date,
  ): Promise<string | null> {
    const baseUrl = process.env.FUNCTIONS_BASE_URL ?? "";

    return this.createTask({
      queueName: QueueNames.NOTIFICATIONS,
      url: `${baseUrl}/notifications_send`,
      payload: {
        userId,
        notificationType,
        data,
        timestamp: new Date().toISOString(),
      },
      scheduleTime,
    });
  }

  /**
   * 指数バックオフ付きリトライタスクを作成
   */
  async createRetryTask(
    queueName: QueueName,
    url: string,
    payload: Record<string, unknown>,
    currentRetry: number,
    maxRetries: number,
  ): Promise<string | null> {
    if (currentRetry >= maxRetries) {
      logger.warn("Max retries exceeded", {
        queueName,
        url,
        currentRetry,
        maxRetries,
      });
      return null;
    }

    const delayMs = getExponentialBackoffDelay(currentRetry + 1);
    const scheduleTime = addMinutes(new Date(), delayMs / 60000);

    return this.createTask({
      queueName,
      url,
      payload: {
        ...payload,
        retryCount: currentRetry + 1,
      },
      scheduleTime,
    });
  }

  /**
   * タスクを削除
   */
  async deleteTask(taskName: string): Promise<void> {
    try {
      await this.client.deleteTask({ name: taskName });
      logger.info("Task deleted", { taskName });
    } catch (error) {
      logger.error("Failed to delete task", error as Error, { taskName });
      throw error;
    }
  }

  /**
   * キューを一時停止
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const name = this.getQueuePath(queueName);
    await this.client.pauseQueue({ name });
    logger.info("Queue paused", { queueName });
  }

  /**
   * キューを再開
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const name = this.getQueuePath(queueName);
    await this.client.resumeQueue({ name });
    logger.info("Queue resumed", { queueName });
  }
}

// シングルトンインスタンスをエクスポート
export const cloudTasks = new CloudTasksService();
