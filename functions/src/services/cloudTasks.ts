/**
 * Cloud Tasks Service
 * Handles asynchronous task queue operations
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";

import { addMinutes, getExponentialBackoffDelay } from "../utils/date";
import { logger } from "../utils/logger";

// Type aliases for Cloud Tasks
type Task = protos.google.cloud.tasks.v2.ITask;
type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;

/**
 * Task configuration
 */
export interface TaskConfig {
  queueName: string;
  url: string;
  payload: Record<string, unknown>;
  scheduleTime?: Date;
  retryConfig?: RetryConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  minBackoffSeconds: number;
  maxBackoffSeconds: number;
  maxDoublings: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  minBackoffSeconds: 10,
  maxBackoffSeconds: 3600, // 1 hour
  maxDoublings: 5,
};

/**
 * Queue names
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
 * Cloud Tasks Service class
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
   * Get queue path
   */
  private getQueuePath(queueName: string): string {
    return this.client.queuePath(this.projectId, this.location, queueName);
  }

  /**
   * Create a new task
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

      // Set schedule time if provided
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
   * Create BigQuery sync task
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
   * Create data export task
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
   * Create data deletion task
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
   * Create notification task
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
   * Create retry task with exponential backoff
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
   * Delete a task
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
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const name = this.getQueuePath(queueName);
    await this.client.pauseQueue({ name });
    logger.info("Queue paused", { queueName });
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const name = this.getQueuePath(queueName);
    await this.client.resumeQueue({ name });
    logger.info("Queue resumed", { queueName });
  }
}

// Export singleton instance
export const cloudTasks = new CloudTasksService();
