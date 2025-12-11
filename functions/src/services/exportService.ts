/**
 * データエクスポートサービス
 *
 * 管理者によるユーザーデータ・統計データ・監査ログのエクスポート処理を提供
 * - ユーザーデータの収集とエクスポート
 * - 統計データのエクスポート
 * - 監査ログのエクスポート
 * - Cloud Storageへのアップロードと署名付きURL生成
 *
 * GDPR Article 20 (データポータビリティ権) に準拠
 *
 * 参照: docs/common/tickets/048-data-export-api.md
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md - FR-028
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import { Storage } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import {
  AdminExportFormat,
  ExportFilters,
  ExportJob,
  ExportJobStatus,
  ExportJobType,
  EXPORT_CONSTANTS,
} from "../types/export";
import { getFirestore, serverTimestamp } from "../utils/firestore";
import { logger } from "../utils/logger";

import { collectUserData } from "./gdprExport";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// Cloud Storage client
const storage = new Storage();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * エクスポート用のバケット名を取得
 */
function getExportBucketName(): string {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "tokyo-list-478804-e5";
  return `${projectId}.appspot.com`;
}

/**
 * ジョブIDを生成
 */
function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `export_${timestamp}_${random}`;
}

/**
 * 予想完了時間を計算
 */
function calculateEstimatedCompletionTime(type: ExportJobType): Date {
  const now = new Date();
  let minutes: number;

  switch (type) {
    case "user_data":
      minutes = EXPORT_CONSTANTS.ESTIMATED_USER_EXPORT_MINUTES;
      break;
    case "stats":
      minutes = EXPORT_CONSTANTS.ESTIMATED_STATS_EXPORT_MINUTES;
      break;
    case "audit_logs":
      minutes = EXPORT_CONSTANTS.ESTIMATED_AUDIT_EXPORT_MINUTES;
      break;
    default:
      minutes = 10;
  }

  return new Date(now.getTime() + minutes * 60 * 1000);
}

/**
 * Timestamp を ISO 文字列に変換
 */
function timestampToISO(timestamp: Timestamp | undefined | null): string | undefined {
  if (!timestamp) {
    return undefined;
  }
  return timestamp.toDate().toISOString();
}

// =============================================================================
// ジョブ管理
// =============================================================================

/**
 * エクスポートジョブを作成
 */
export async function createExportJob(params: {
  type: ExportJobType;
  format: AdminExportFormat;
  requestedBy: string;
  targetUserId?: string;
  filters?: ExportFilters;
  encrypted?: boolean;
}): Promise<ExportJob> {
  const db = getFirestore();
  const jobId = generateJobId();

  const job: Omit<ExportJob, "createdAt"> & { createdAt: FieldValue } = {
    id: jobId,
    type: params.type,
    status: "pending",
    format: params.format,
    requestedBy: params.requestedBy,
    targetUserId: params.targetUserId,
    filters: params.filters,
    encrypted: params.encrypted,
    createdAt: serverTimestamp(),
  };

  await db.collection("exportJobs").doc(jobId).set(job);

  logger.info("Export job created", {
    jobId,
    type: params.type,
    requestedBy: params.requestedBy,
    targetUserId: params.targetUserId,
  });

  // Firestore の serverTimestamp は即座に値が取れないので、現在時刻を使用
  return {
    ...job,
    createdAt: Timestamp.now(),
  } as ExportJob;
}

/**
 * エクスポートジョブを取得
 */
export async function getExportJob(jobId: string): Promise<ExportJob | null> {
  const db = getFirestore();
  const doc = await db.collection("exportJobs").doc(jobId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as ExportJob;
}

/**
 * エクスポートジョブを更新
 */
export async function updateExportJob(
  jobId: string,
  updates: Partial<ExportJob>,
): Promise<void> {
  const db = getFirestore();
  await db.collection("exportJobs").doc(jobId).update(updates);
}

/**
 * エクスポートジョブ一覧を取得
 */
export async function listExportJobs(params: {
  type?: ExportJobType;
  status?: ExportJobStatus;
  limit?: number;
  cursor?: string;
}): Promise<{
  items: ExportJob[];
  nextCursor?: string;
  totalCount: number;
}> {
  const db = getFirestore();
  const limit = Math.min(params.limit || EXPORT_CONSTANTS.DEFAULT_HISTORY_LIMIT, EXPORT_CONSTANTS.MAX_HISTORY_LIMIT);

  let query = db
    .collection("exportJobs")
    .orderBy("createdAt", "desc");

  if (params.type) {
    query = query.where("type", "==", params.type);
  }

  if (params.status) {
    query = query.where("status", "==", params.status);
  }

  // カーソルがある場合はページネーション
  if (params.cursor) {
    try {
      const cursorData = JSON.parse(Buffer.from(params.cursor, "base64").toString()) as { docId: string };
      const cursorDoc = await db.collection("exportJobs").doc(cursorData.docId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    } catch (error) {
      logger.warn("Invalid cursor for export jobs", { cursor: params.cursor }, error as Error);
    }
  }

  // 件数カウント
  const countQuery = db.collection("exportJobs");
  const countSnapshot = await countQuery.count().get();
  const totalCount = countSnapshot.data().count;

  // 1件多く取得して次ページ判定
  const snapshot = await query.limit(limit + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;

  if (hasMore) {
    docs.pop();
  }

  const items = docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ExportJob[];

  let nextCursor: string | undefined;
  if (hasMore && docs.length > 0) {
    const lastDoc = docs[docs.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ docId: lastDoc.id })).toString("base64");
  }

  return { items, nextCursor, totalCount };
}

// =============================================================================
// ユーザーデータエクスポート
// =============================================================================

/**
 * ユーザーデータエクスポートを実行
 */
export async function executeUserDataExport(
  jobId: string,
  userId: string,
  format: AdminExportFormat,
  requestedBy: string,
): Promise<void> {
  const startTime = Date.now();

  logger.info("Starting user data export", { jobId, userId, format, requestedBy });

  try {
    // ステータスを processing に更新
    await updateExportJob(jobId, {
      status: "processing",
      processingStartedAt: Timestamp.now(),
    });

    // ユーザーデータを収集（gdprExportサービスを再利用）
    const exportData = await collectUserData(userId, {
      scope: { type: "all" },
      includeStorage: true,
      includeAnalytics: true,
    });

    // データを指定フォーマットに変換
    let content: string;
    let contentType: string;

    // Export data as record for conversion functions
    const exportDataRecord = exportData as unknown as Record<string, unknown>;

    if (format === "json") {
      content = JSON.stringify(exportData, null, 2);
      contentType = "application/json";
    } else {
      content = convertUserDataToCSV(exportDataRecord);
      contentType = "text/csv";
    }

    // Cloud Storageにアップロード
    const uploadResult = await uploadExportFile({
      jobId,
      content,
      format,
      contentType,
      type: "user_data",
    });

    // ジョブを完了に更新
    await updateExportJob(jobId, {
      status: "completed",
      downloadUrl: uploadResult.downloadUrl,
      downloadUrlExpiry: uploadResult.expiresAt,
      fileSize: uploadResult.fileSizeBytes,
      recordCount: calculateUserDataRecordCount(exportDataRecord),
      completedAt: Timestamp.now(),
    });

    logger.info("User data export completed", {
      jobId,
      userId,
      format,
      fileSize: uploadResult.fileSizeBytes,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("User data export failed", error as Error, { jobId, userId });

    await updateExportJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: Timestamp.now(),
    });

    throw error;
  }
}

/**
 * ユーザーデータをCSVに変換
 */
function convertUserDataToCSV(data: Record<string, unknown>): string {
  const lines: string[] = [];

  // プロフィールセクション
  lines.push("=== Profile ===");
  if (data.profile) {
    const profile = data.profile as Record<string, unknown>;
    lines.push("field,value");
    for (const [key, value] of Object.entries(profile)) {
      const escapedValue = String(value).replace(/"/g, '""');
      lines.push(`"${key}","${escapedValue}"`);
    }
  }
  lines.push("");

  // セッションセクション
  lines.push("=== Sessions ===");
  const sessions = data.sessions as Array<Record<string, unknown>> | undefined;
  if (sessions && sessions.length > 0) {
    const headers = Object.keys(sessions[0]);
    lines.push(headers.map((h) => `"${h}"`).join(","));
    for (const session of sessions) {
      const values = headers.map((h) => {
        const val = session[h];
        const escaped = String(val ?? "").replace(/"/g, '""');
        return `"${escaped}"`;
      });
      lines.push(values.join(","));
    }
  }
  lines.push("");

  // 同意セクション
  lines.push("=== Consents ===");
  const consents = data.consents as Array<Record<string, unknown>> | undefined;
  if (consents && consents.length > 0) {
    const headers = Object.keys(consents[0]);
    lines.push(headers.map((h) => `"${h}"`).join(","));
    for (const consent of consents) {
      const values = headers.map((h) => {
        const val = consent[h];
        const escaped = String(val ?? "").replace(/"/g, '""');
        return `"${escaped}"`;
      });
      lines.push(values.join(","));
    }
  }

  return lines.join("\n");
}

/**
 * ユーザーデータのレコード数を計算
 */
function calculateUserDataRecordCount(data: Record<string, unknown>): number {
  let count = 0;
  if (data.profile) count += 1;
  const sessions = data.sessions as Array<unknown> | undefined;
  if (sessions) count += sessions.length;
  const consents = data.consents as Array<unknown> | undefined;
  if (consents) count += consents.length;
  if (data.settings) count += 1;
  const subscriptions = data.subscriptions as Array<unknown> | undefined;
  if (subscriptions) count += subscriptions.length;
  return count;
}

// =============================================================================
// 統計データエクスポート
// =============================================================================

/**
 * 統計データエクスポートを実行
 */
export async function executeStatsExport(
  jobId: string,
  format: AdminExportFormat,
  requestedBy: string,
  filters?: ExportFilters,
): Promise<void> {
  const startTime = Date.now();

  logger.info("Starting stats export", { jobId, format, requestedBy, filters });

  try {
    // ステータスを processing に更新
    await updateExportJob(jobId, {
      status: "processing",
      processingStartedAt: Timestamp.now(),
    });

    // 統計データを収集
    const statsData = await collectStatsData(filters);

    // データを指定フォーマットに変換
    let content: string;
    let contentType: string;

    if (format === "json") {
      content = JSON.stringify(statsData, null, 2);
      contentType = "application/json";
    } else {
      content = convertStatsToCSV(statsData);
      contentType = "text/csv";
    }

    // Cloud Storageにアップロード
    const uploadResult = await uploadExportFile({
      jobId,
      content,
      format,
      contentType,
      type: "stats",
    });

    // ジョブを完了に更新
    await updateExportJob(jobId, {
      status: "completed",
      downloadUrl: uploadResult.downloadUrl,
      downloadUrlExpiry: uploadResult.expiresAt,
      fileSize: uploadResult.fileSizeBytes,
      recordCount: statsData.dailyStats?.length || 0,
      completedAt: Timestamp.now(),
    });

    logger.info("Stats export completed", {
      jobId,
      format,
      fileSize: uploadResult.fileSizeBytes,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("Stats export failed", error as Error, { jobId });

    await updateExportJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: Timestamp.now(),
    });

    throw error;
  }
}

/**
 * 統計データを収集
 */
async function collectStatsData(filters?: ExportFilters): Promise<{
  summary: {
    totalUsers: number;
    totalSessions: number;
    activeUsers: number;
    exportedAt: string;
  };
  dailyStats: Array<{
    date: string;
    newUsers: number;
    activeSessions: number;
    avgScore: number;
  }>;
}> {
  const db = getFirestore();

  // 期間の設定
  let startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // デフォルト30日
  let endDate = new Date();

  if (filters?.startDate) {
    startDate = new Date(filters.startDate);
  }
  if (filters?.endDate) {
    endDate = new Date(filters.endDate);
  }

  // ユーザー統計を取得
  const usersSnapshot = await db.collection("users").count().get();
  const totalUsers = usersSnapshot.data().count;

  // アクティブユーザーを取得（30日以内にログイン）
  const activeThreshold = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const activeUsersSnapshot = await db
    .collection("users")
    .where("lastLoginAt", ">=", activeThreshold)
    .count()
    .get();
  const activeUsers = activeUsersSnapshot.data().count;

  // 日別統計を生成（簡易版）
  const dailyStats: Array<{
    date: string;
    newUsers: number;
    activeSessions: number;
    avgScore: number;
  }> = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dailyStats.push({
      date: currentDate.toISOString().split("T")[0],
      newUsers: 0, // 実際の実装ではFirestoreクエリが必要
      activeSessions: 0,
      avgScore: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    summary: {
      totalUsers,
      totalSessions: 0, // BigQueryから取得が必要
      activeUsers,
      exportedAt: new Date().toISOString(),
    },
    dailyStats,
  };
}

/**
 * 統計データをCSVに変換
 */
function convertStatsToCSV(data: {
  summary: Record<string, unknown>;
  dailyStats: Array<Record<string, unknown>>;
}): string {
  const lines: string[] = [];

  // サマリーセクション
  lines.push("=== Summary ===");
  lines.push("metric,value");
  for (const [key, value] of Object.entries(data.summary)) {
    lines.push(`"${key}","${String(value)}"`);
  }
  lines.push("");

  // 日別統計セクション
  lines.push("=== Daily Stats ===");
  if (data.dailyStats.length > 0) {
    const headers = Object.keys(data.dailyStats[0]);
    lines.push(headers.map((h) => `"${h}"`).join(","));
    for (const stat of data.dailyStats) {
      const values = headers.map((h) => `"${String(stat[h] ?? "")}"`);
      lines.push(values.join(","));
    }
  }

  return lines.join("\n");
}

// =============================================================================
// 監査ログエクスポート
// =============================================================================

/**
 * 監査ログエクスポートを実行
 */
export async function executeAuditLogsExport(
  jobId: string,
  format: AdminExportFormat,
  requestedBy: string,
  filters?: ExportFilters,
  maxRecords?: number,
): Promise<void> {
  const startTime = Date.now();

  logger.info("Starting audit logs export", { jobId, format, requestedBy, filters, maxRecords });

  try {
    // ステータスを processing に更新
    await updateExportJob(jobId, {
      status: "processing",
      processingStartedAt: Timestamp.now(),
    });

    // 監査ログを収集
    const limit = Math.min(maxRecords || EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS, EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS);
    const auditLogs = await collectAuditLogs(filters, limit);

    // データを指定フォーマットに変換
    let content: string;
    let contentType: string;

    if (format === "json") {
      content = JSON.stringify(auditLogs, null, 2);
      contentType = "application/json";
    } else {
      content = convertAuditLogsToCSV(auditLogs);
      contentType = "text/csv";
    }

    // Cloud Storageにアップロード
    const uploadResult = await uploadExportFile({
      jobId,
      content,
      format,
      contentType,
      type: "audit_logs",
    });

    // ジョブを完了に更新
    await updateExportJob(jobId, {
      status: "completed",
      downloadUrl: uploadResult.downloadUrl,
      downloadUrlExpiry: uploadResult.expiresAt,
      fileSize: uploadResult.fileSizeBytes,
      recordCount: auditLogs.length,
      completedAt: Timestamp.now(),
    });

    logger.info("Audit logs export completed", {
      jobId,
      format,
      recordCount: auditLogs.length,
      fileSize: uploadResult.fileSizeBytes,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("Audit logs export failed", error as Error, { jobId });

    await updateExportJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: Timestamp.now(),
    });

    throw error;
  }
}

/**
 * 監査ログを収集
 */
async function collectAuditLogs(
  filters?: ExportFilters,
  limit: number = EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS,
): Promise<Array<Record<string, unknown>>> {
  const db = getFirestore();

  let query = db.collection("auditLogs").orderBy("timestamp", "desc");

  // 期間フィルター
  if (filters?.startDate) {
    const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(filters.startDate));
    query = query.where("timestamp", ">=", startTimestamp);
  }
  if (filters?.endDate) {
    const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(filters.endDate));
    query = query.where("timestamp", "<=", endTimestamp);
  }

  // アクションフィルター
  if (filters?.action) {
    query = query.where("action", "==", filters.action);
  }

  const snapshot = await query.limit(limit).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
    };
  });
}

/**
 * 監査ログをCSVに変換
 */
function convertAuditLogsToCSV(logs: Array<Record<string, unknown>>): string {
  if (logs.length === 0) {
    return "No audit logs found";
  }

  const lines: string[] = [];

  // 基本ヘッダー
  const baseHeaders = ["id", "timestamp", "action", "userId", "resourceType", "resourceId", "success"];
  lines.push(baseHeaders.map((h) => `"${h}"`).join(","));

  for (const log of logs) {
    const values = baseHeaders.map((h) => {
      const val = log[h];
      const escaped = String(val ?? "").replace(/"/g, '""');
      return `"${escaped}"`;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

// =============================================================================
// ファイルアップロード
// =============================================================================

/**
 * エクスポートファイルをCloud Storageにアップロード
 */
async function uploadExportFile(params: {
  jobId: string;
  content: string;
  format: AdminExportFormat;
  contentType: string;
  type: ExportJobType;
}): Promise<{
  downloadUrl: string;
  expiresAt: Timestamp;
  fileSizeBytes: number;
}> {
  const bucketName = getExportBucketName();
  const fileName = `${EXPORT_CONSTANTS.EXPORT_BUCKET_PATH}/${params.type}/${params.jobId}/export.${params.format}`;
  const expiresAt = new Date(
    Date.now() + EXPORT_CONSTANTS.DOWNLOAD_URL_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // ファイルをアップロード
    await file.save(params.content, {
      contentType: params.contentType,
      metadata: {
        jobId: params.jobId,
        type: params.type,
        exportedAt: new Date().toISOString(),
      },
    });

    // 署名付きURLを生成
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: expiresAt,
    });

    const fileSizeBytes = Buffer.byteLength(params.content, "utf8");

    logger.info("Export file uploaded", {
      jobId: params.jobId,
      fileName,
      fileSizeBytes,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      downloadUrl: signedUrl,
      expiresAt: Timestamp.fromDate(expiresAt),
      fileSizeBytes,
    };
  } catch (error) {
    logger.error("Failed to upload export file", error as Error, {
      jobId: params.jobId,
      bucketName,
      fileName,
    });
    throw error;
  }
}

// =============================================================================
// クリーンアップ
// =============================================================================

/**
 * 期限切れのエクスポートファイルを削除
 */
export async function cleanupExpiredExportFiles(daysOld: number = EXPORT_CONSTANTS.FILE_RETENTION_DAYS): Promise<number> {
  const bucketName = getExportBucketName();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  logger.info("Starting expired export files cleanup", {
    bucketName,
    cutoffDate: cutoffDate.toISOString(),
  });

  try {
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: EXPORT_CONSTANTS.EXPORT_BUCKET_PATH });

    let deletedCount = 0;

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const createdAt = new Date(metadata.timeCreated as string);

        if (createdAt < cutoffDate) {
          await file.delete();
          deletedCount++;
        }
      } catch (error) {
        logger.warn("Failed to process export file for cleanup", {
          fileName: file.name,
        }, error as Error);
      }
    }

    // Firestoreのジョブも古いものを削除
    const db = getFirestore();
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
    const oldJobsSnapshot = await db
      .collection("exportJobs")
      .where("createdAt", "<", cutoffTimestamp)
      .get();

    for (const doc of oldJobsSnapshot.docs) {
      await doc.ref.delete();
    }

    logger.info("Expired export files cleanup completed", {
      deletedFiles: deletedCount,
      deletedJobs: oldJobsSnapshot.size,
    });

    return deletedCount + oldJobsSnapshot.size;
  } catch (error) {
    logger.error("Expired export files cleanup failed", error as Error);
    return 0;
  }
}

// =============================================================================
// エクスポート関連のエクスポート
// =============================================================================

export {
  timestampToISO,
  calculateEstimatedCompletionTime,
};
