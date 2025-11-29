/**
 * BigQuery サービス
 * 分析用のデータウェアハウス操作を処理
 */

import * as crypto from "crypto";

import { BigQuery, Table } from "@google-cloud/bigquery";
import * as admin from "firebase-admin";

import { BigQuerySyncFailure, Session, User } from "../types/firestore";
import { bigquerySyncFailuresCollection, serverTimestamp } from "../utils/firestore";
import { logger } from "../utils/logger";

/**
 * BigQuery 設定
 */
const BQ_CONFIG = {
  datasetId: "fitness_analytics",
  tables: {
    users: "users_anonymized",
    sessions: "training_sessions",
    exercises: "exercise_metrics",
  },
  // データ保持期間: 2年（GDPR 準拠）
  retentionDays: 730,
};

/**
 * BigQuery 用の匿名化されたユーザーデータ
 */
interface AnonymizedUser {
  user_hash: string;
  birth_year_range: string;
  gender: string;
  fitness_level: string;
  created_at: string;
  region: string;
}

/**
 * BigQuery 用のセッションデータ
 */
interface SessionAnalytics {
  session_id: string;
  user_hash: string;
  exercise_type: string;
  rep_count: number;
  average_score: number;
  total_score: number;
  duration_seconds: number;
  average_fps: number;
  device_platform: string;
  device_model_hash: string;
  app_version: string;
  created_at: string;
}

/**
 * BigQuery サービスクラス
 */
export class BigQueryService {
  private client: BigQuery;
  private projectId: string;

  constructor(projectId?: string) {
    this.projectId = projectId ?? process.env.GCLOUD_PROJECT ?? "";
    this.client = new BigQuery({ projectId: this.projectId });
  }

  /**
   * テーブル参照を取得
   */
  private getTable(tableName: string): Table {
    return this.client.dataset(BQ_CONFIG.datasetId).table(tableName);
  }

  /**
   * 匿名化のために機密データをハッシュ化
   */
  private hashData(data: string): string {
    return crypto
      .createHash("sha256")
      .update(data + (process.env.ANONYMIZATION_SALT ?? ""))
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * 匿名化のために生年の範囲を取得
   */
  private getBirthYearRange(birthYear?: number): string {
    if (!birthYear) {
      return "unknown";
    }
    const decade = Math.floor(birthYear / 10) * 10;
    return `${decade}s`;
  }

  /**
   * ユーザーデータを匿名化
   */
  anonymizeUser(userId: string, user: User): AnonymizedUser {
    return {
      user_hash: this.hashData(userId),
      birth_year_range: this.getBirthYearRange(user.birthYear),
      gender: user.gender ?? "unknown",
      fitness_level: user.fitnessLevel ?? "unknown",
      created_at: user.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      region: "JP", // 日本市場のみ
    };
  }

  /**
   * 分析用にセッションを変換
   */
  transformSession(
    userId: string,
    sessionId: string,
    session: Session,
  ): SessionAnalytics {
    return {
      session_id: this.hashData(sessionId),
      user_hash: this.hashData(userId),
      exercise_type: session.exerciseType,
      rep_count: session.repCount,
      average_score: session.averageScore,
      total_score: session.totalScore,
      duration_seconds: session.duration,
      average_fps: session.sessionMetadata?.averageFps ?? 0,
      device_platform: session.sessionMetadata?.deviceInfo?.platform ?? "unknown",
      device_model_hash: this.hashData(session.sessionMetadata?.deviceInfo?.model ?? "unknown"),
      app_version: session.sessionMetadata?.appVersion ?? "unknown",
      created_at: session.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * ストリーミングインサートを使用して BigQuery に行を挿入
   */
  async insertRows(
    tableName: string,
    rows: Record<string, unknown>[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const table = this.getTable(tableName);

    try {
      await table.insert(rows, {
        skipInvalidRows: false,
        ignoreUnknownValues: false,
      });

      logger.info("BigQuery insert successful", {
        table: tableName,
        rowCount: rows.length,
      });
    } catch (error) {
      const err = error as { errors?: unknown[] };
      logger.error("BigQuery insert failed", error as Error, {
        table: tableName,
        rowCount: rows.length,
        errors: err.errors,
      });
      throw error;
    }
  }

  /**
   * ユーザーデータを BigQuery に同期
   */
  async syncUser(userId: string, user: User): Promise<void> {
    const anonymizedUser = this.anonymizeUser(userId, user);
    const rows = [anonymizedUser as unknown as Record<string, unknown>];
    await this.insertRows(BQ_CONFIG.tables.users, rows);
  }

  /**
   * セッションデータを BigQuery に同期
   */
  async syncSession(
    userId: string,
    sessionId: string,
    session: Session,
  ): Promise<void> {
    const sessionAnalytics = this.transformSession(userId, sessionId, session);
    const rows = [sessionAnalytics as unknown as Record<string, unknown>];
    await this.insertRows(BQ_CONFIG.tables.sessions, rows);
  }

  /**
   * リトライと DLQ サポート付きで同期
   */
  async syncWithRetry(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    maxRetries = 3,
  ): Promise<boolean> {
    const collectionTableMap: Record<string, string> = {
      users: BQ_CONFIG.tables.users,
      sessions: BQ_CONFIG.tables.sessions,
    };

    const tableName = collectionTableMap[collection];
    if (!tableName) {
      logger.warn("Unknown collection for BigQuery sync", { collection });
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.insertRows(tableName, [data]);
        return true;
      } catch (error) {
        logger.warn(`BigQuery sync attempt ${attempt}/${maxRetries} failed`, {
          collection,
          documentId,
        }, error as Error);

        if (attempt === maxRetries) {
          // DLQ に送信
          await this.sendToDeadLetterQueue(collection, documentId, data, error as Error);
          return false;
        }

        // リトライ前に待機（指数バックオフ）
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
      }
    }

    return false;
  }

  /**
   * 失敗した同期を Dead Letter Queue に送信
   */
  private async sendToDeadLetterQueue(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    error: Error,
  ): Promise<void> {
    const failureRecord: Omit<BigQuerySyncFailure, "createdAt" | "updatedAt"> = {
      sourceCollection: collection,
      sourceDocumentId: documentId,
      sourceData: data,
      status: "dead_letter",
      errorMessage: error.message,
      errorCode: (error as NodeJS.ErrnoException).code,
      retryCount: 3,
      maxRetries: 3,
    };

    await bigquerySyncFailuresCollection().add({
      ...failureRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.error("Sync failure sent to DLQ", error, {
      collection,
      documentId,
    });
  }

  /**
   * DLQ アイテムを処理（スケジュール関数用）
   */
  async processDLQItems(limit = 100): Promise<number> {
    const snapshot = await bigquerySyncFailuresCollection()
      .where("status", "==", "dead_letter")
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const failure = doc.data() as BigQuerySyncFailure;

      try {
        // 再度同期を試行
        await this.insertRows(
          failure.sourceCollection === "users"
            ? BQ_CONFIG.tables.users
            : BQ_CONFIG.tables.sessions,
          [failure.sourceData],
        );

        // 完了としてマーク
        await doc.ref.delete();
        processedCount++;
      } catch {
        // リトライ回数と次回リトライ時間を更新
        await doc.ref.update({
          status: "failed",
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    logger.info("DLQ processing completed", {
      processed: processedCount,
      total: snapshot.size,
    });

    return processedCount;
  }

  /**
   * BigQuery からユーザーデータを削除（GDPR 準拠）
   */
  async deleteUserData(userId: string): Promise<void> {
    const userHash = this.hashData(userId);

    // users テーブルから削除
    const deleteUserQuery = `
      DELETE FROM \`${this.projectId}.${BQ_CONFIG.datasetId}.${BQ_CONFIG.tables.users}\`
      WHERE user_hash = @userHash
    `;

    // sessions テーブルから削除
    const deleteSessionsQuery = `
      DELETE FROM \`${this.projectId}.${BQ_CONFIG.datasetId}.${BQ_CONFIG.tables.sessions}\`
      WHERE user_hash = @userHash
    `;

    const options = {
      query: "",
      params: { userHash },
    };

    try {
      options.query = deleteUserQuery;
      await this.client.query(options);

      options.query = deleteSessionsQuery;
      await this.client.query(options);

      logger.info("User data deleted from BigQuery", { userHash });
    } catch (error) {
      logger.error("Failed to delete user data from BigQuery", error as Error, {
        userHash,
      });
      throw error;
    }
  }

  /**
   * 分析クエリを実行
   */
  async runQuery<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
    const options = {
      query,
      params,
    };

    const [rows] = await this.client.query(options);
    return rows as T[];
  }

  /**
   * 集計統計を取得
   */
  async getAggregateStats(): Promise<{
    totalUsers: number;
    totalSessions: number;
    avgSessionsPerUser: number;
    avgScoreByExercise: Record<string, number>;
  }> {
    const dataset = `${this.projectId}.${BQ_CONFIG.datasetId}`;
    const usersTable = `\`${dataset}.${BQ_CONFIG.tables.users}\``;
    const sessionsTable = `\`${dataset}.${BQ_CONFIG.tables.sessions}\``;

    const query = `
      SELECT
        (SELECT COUNT(DISTINCT user_hash) FROM ${usersTable}) as total_users,
        COUNT(*) as total_sessions,
        AVG(average_score) as overall_avg_score
      FROM ${sessionsTable}
    `;

    const scoreByExerciseQuery = `
      SELECT
        exercise_type,
        AVG(average_score) as avg_score
      FROM ${sessionsTable}
      GROUP BY exercise_type
    `;

    interface GeneralStatsRow {
      total_users: number;
      total_sessions: number;
      overall_avg_score: number;
    }

    interface ExerciseStatsRow {
      exercise_type: string;
      avg_score: number;
    }

    const [generalStats] = await this.client.query({ query });
    const [exerciseStats] = await this.client.query({ query: scoreByExerciseQuery });

    const avgScoreByExercise: Record<string, number> = {};
    for (const row of exerciseStats as ExerciseStatsRow[]) {
      avgScoreByExercise[row.exercise_type] = row.avg_score;
    }

    const stats = generalStats[0] as GeneralStatsRow | undefined;
    const totalUsers = stats?.total_users ?? 0;
    const totalSessions = stats?.total_sessions ?? 0;

    return {
      totalUsers,
      totalSessions,
      avgSessionsPerUser: totalUsers > 0 ? totalSessions / totalUsers : 0,
      avgScoreByExercise,
    };
  }
}

// シングルトンインスタンスをエクスポート
export const bigQueryService = new BigQueryService();
