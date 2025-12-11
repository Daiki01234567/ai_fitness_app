/**
 * データエクスポートAPI
 *
 * 管理者によるユーザーデータ・統計データ・監査ログのエクスポートAPI
 * - ユーザーデータエクスポート開始（非同期）
 * - エクスポート状態確認
 * - 統計データエクスポート
 * - 監査ログエクスポート（superAdminのみ）
 * - エクスポート履歴一覧
 *
 * GDPR Article 20 (データポータビリティ権) に準拠
 *
 * 参照: docs/common/tickets/048-data-export-api.md
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md - FR-028
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  requireAdminOrAbove,
  requireSuperAdmin,
  executeAdminAuthAction,
} from "../../middleware/adminAuth";
import {
  createExportJob,
  getExportJob,
  listExportJobs,
  executeUserDataExport,
  executeStatsExport,
  executeAuditLogsExport,
  timestampToISO,
  calculateEstimatedCompletionTime,
} from "../../services/exportService";
import {
  StartUserExportRequest,
  StartUserExportResponse,
  GetExportStatusRequest,
  GetExportStatusResponse,
  ExportStatsRequest,
  ExportStatsResponse,
  ExportAuditLogsRequest,
  ExportAuditLogsResponse,
  ListExportHistoryRequest,
  ListExportHistoryResponse,
  ExportHistoryItem,
  EXPORT_CONSTANTS,
} from "../../types/export";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";

// =============================================================================
// ユーザーデータエクスポート開始API
// =============================================================================

/**
 * ユーザーデータエクスポートを開始（管理者専用）
 *
 * 特定ユーザーの全データをエクスポートする非同期ジョブを開始します。
 * 大量データに対応するため、非同期処理として実行されます。
 *
 * @param request.data.userId - 対象ユーザーID
 * @param request.data.format - フォーマット（json, csv）
 * @param request.data.encrypted - 暗号化オプション
 * @param request.data.dateRange - 期間フィルター
 * @returns エクスポートジョブ情報
 */
export const admin_startUserExport = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_startUserExport");

    try {
      // admin以上の権限を要求
      const context = await requireAdminOrAbove(request);

      const data = request.data as StartUserExportRequest;

      // バリデーション
      if (!data.userId || typeof data.userId !== "string") {
        throw new HttpsError("invalid-argument", "userIdは必須です");
      }

      const format = data.format || "json";
      if (format !== "json" && format !== "csv") {
        throw new HttpsError("invalid-argument", "formatはjsonまたはcsvを指定してください");
      }

      logger.info("Starting user data export", {
        adminId: context.adminUser.uid,
        targetUserId: data.userId,
        format,
      });

      // 監査ログ付きでエクスポートジョブを作成
      const result = await executeAdminAuthAction(
        context,
        "EXPORT_AUDIT_LOGS", // 適切なアクションタイプを使用
        {
          targetUserId: data.userId,
          details: {
            type: "user_data",
            format,
            encrypted: data.encrypted,
          },
        },
        async () => {
          // エクスポートジョブを作成
          const job = await createExportJob({
            type: "user_data",
            format,
            requestedBy: context.adminUser.uid,
            targetUserId: data.userId,
            filters: data.dateRange ? {
              startDate: data.dateRange.startDate,
              endDate: data.dateRange.endDate,
            } : undefined,
            encrypted: data.encrypted,
          });

          // 非同期でエクスポートを実行（Fire and forget パターン）
          executeUserDataExport(job.id, data.userId, format, context.adminUser.uid)
            .catch((error) => {
              logger.error("Background user export failed", error as Error, {
                jobId: job.id,
                userId: data.userId,
              });
            });

          return job;
        },
      );

      const response: StartUserExportResponse = {
        jobId: result.id,
        status: "pending",
        estimatedCompletionTime: calculateEstimatedCompletionTime("user_data").toISOString(),
        message: "ユーザーデータのエクスポートを開始しました",
      };

      logger.functionEnd("admin_startUserExport", Date.now() - startTime, {
        jobId: result.id,
        targetUserId: data.userId,
      });

      return success(response, "ユーザーデータエクスポートを開始しました");
    } catch (error) {
      logger.error("admin_startUserExport failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "ユーザーデータエクスポートの開始に失敗しました");
    }
  },
);

// =============================================================================
// エクスポート状態確認API
// =============================================================================

/**
 * エクスポート状態を確認（管理者専用）
 *
 * エクスポートジョブの状態を確認し、完了していればダウンロードURLを返します。
 *
 * @param request.data.jobId - ジョブID
 * @returns エクスポート状態
 */
export const admin_getExportStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getExportStatus");

    try {
      // admin以上の権限を要求
      const context = await requireAdminOrAbove(request);

      const data = request.data as GetExportStatusRequest;

      // バリデーション
      if (!data.jobId || typeof data.jobId !== "string") {
        throw new HttpsError("invalid-argument", "jobIdは必須です");
      }

      logger.info("Checking export status", {
        adminId: context.adminUser.uid,
        jobId: data.jobId,
      });

      // ジョブを取得
      const job = await getExportJob(data.jobId);

      if (!job) {
        throw new HttpsError("not-found", "指定されたエクスポートジョブが見つかりません");
      }

      // ダウンロードURLの有効期限をチェック
      let downloadable = false;
      if (job.downloadUrl && job.downloadUrlExpiry) {
        downloadable = job.downloadUrlExpiry.toDate() > new Date();
      }

      const response: GetExportStatusResponse = {
        jobId: job.id,
        type: job.type,
        status: job.status,
        format: job.format,
        targetUserId: job.targetUserId,
        downloadUrl: downloadable ? job.downloadUrl : undefined,
        downloadUrlExpiry: downloadable ? timestampToISO(job.downloadUrlExpiry) : undefined,
        fileSize: job.fileSize,
        recordCount: job.recordCount,
        errorMessage: job.errorMessage,
        createdAt: timestampToISO(job.createdAt) || new Date().toISOString(),
        completedAt: timestampToISO(job.completedAt),
      };

      logger.functionEnd("admin_getExportStatus", Date.now() - startTime, {
        jobId: data.jobId,
        status: job.status,
      });

      return success(response, "エクスポート状態を取得しました");
    } catch (error) {
      logger.error("admin_getExportStatus failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "エクスポート状態の取得に失敗しました");
    }
  },
);

// =============================================================================
// 統計データエクスポートAPI
// =============================================================================

/**
 * 統計データをエクスポート（管理者専用）
 *
 * 利用統計データをエクスポートします。
 *
 * @param request.data.format - フォーマット（json, csv）
 * @param request.data.dateRange - 期間フィルター
 * @param request.data.reportType - レポートタイプ
 * @returns エクスポートジョブ情報
 */
export const admin_exportStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_exportStats");

    try {
      // admin以上の権限を要求
      const context = await requireAdminOrAbove(request);

      const data = request.data as ExportStatsRequest;

      const format = data.format || "csv";
      if (format !== "json" && format !== "csv") {
        throw new HttpsError("invalid-argument", "formatはjsonまたはcsvを指定してください");
      }

      logger.info("Starting stats export", {
        adminId: context.adminUser.uid,
        format,
        dateRange: data.dateRange,
      });

      // 監査ログ付きでエクスポートジョブを作成
      const result = await executeAdminAuthAction(
        context,
        "EXPORT_AUDIT_LOGS",
        {
          details: {
            type: "stats",
            format,
            dateRange: data.dateRange,
            reportType: data.reportType,
          },
        },
        async () => {
          // エクスポートジョブを作成
          const job = await createExportJob({
            type: "stats",
            format,
            requestedBy: context.adminUser.uid,
            filters: data.dateRange ? {
              startDate: data.dateRange.startDate,
              endDate: data.dateRange.endDate,
            } : undefined,
          });

          // 非同期でエクスポートを実行
          executeStatsExport(job.id, format, context.adminUser.uid, job.filters)
            .catch((error) => {
              logger.error("Background stats export failed", error as Error, {
                jobId: job.id,
              });
            });

          return job;
        },
      );

      const response: ExportStatsResponse = {
        jobId: result.id,
        status: "pending",
        estimatedCompletionTime: calculateEstimatedCompletionTime("stats").toISOString(),
        message: "統計データのエクスポートを開始しました",
      };

      logger.functionEnd("admin_exportStats", Date.now() - startTime, {
        jobId: result.id,
      });

      return success(response, "統計データエクスポートを開始しました");
    } catch (error) {
      logger.error("admin_exportStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "統計データエクスポートの開始に失敗しました");
    }
  },
);

// =============================================================================
// 監査ログエクスポートAPI
// =============================================================================

/**
 * 監査ログをエクスポート（superAdmin専用）
 *
 * 監査ログをエクスポートします。セキュリティ上の理由からsuperAdminのみ実行可能です。
 *
 * @param request.data.format - フォーマット（json, csv）
 * @param request.data.dateRange - 期間フィルター
 * @param request.data.action - アクションフィルター
 * @param request.data.userId - ユーザーIDフィルター
 * @param request.data.maxRecords - 最大レコード数
 * @returns エクスポートジョブ情報
 */
export const admin_exportAuditLogs = onCall(
  {
    region: "asia-northeast1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_exportAuditLogs");

    try {
      // superAdmin権限を要求
      const context = await requireSuperAdmin(request);

      const data = request.data as ExportAuditLogsRequest;

      const format = data.format || "json";
      if (format !== "json" && format !== "csv") {
        throw new HttpsError("invalid-argument", "formatはjsonまたはcsvを指定してください");
      }

      const maxRecords = Math.min(
        data.maxRecords || EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS,
        EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS,
      );

      logger.info("Starting audit logs export", {
        adminId: context.adminUser.uid,
        format,
        dateRange: data.dateRange,
        action: data.action,
        maxRecords,
      });

      // 監査ログ付きでエクスポートジョブを作成
      const result = await executeAdminAuthAction(
        context,
        "EXPORT_AUDIT_LOGS",
        {
          details: {
            type: "audit_logs",
            format,
            dateRange: data.dateRange,
            action: data.action,
            userId: data.userId,
            maxRecords,
          },
        },
        async () => {
          // エクスポートジョブを作成
          const job = await createExportJob({
            type: "audit_logs",
            format,
            requestedBy: context.adminUser.uid,
            filters: {
              startDate: data.dateRange?.startDate,
              endDate: data.dateRange?.endDate,
              action: data.action,
              userId: data.userId,
            },
          });

          // 非同期でエクスポートを実行
          executeAuditLogsExport(job.id, format, context.adminUser.uid, job.filters, maxRecords)
            .catch((error) => {
              logger.error("Background audit logs export failed", error as Error, {
                jobId: job.id,
              });
            });

          return job;
        },
      );

      const response: ExportAuditLogsResponse = {
        jobId: result.id,
        status: "pending",
        estimatedCompletionTime: calculateEstimatedCompletionTime("audit_logs").toISOString(),
        message: "監査ログのエクスポートを開始しました",
      };

      logger.functionEnd("admin_exportAuditLogs", Date.now() - startTime, {
        jobId: result.id,
      });

      return success(response, "監査ログエクスポートを開始しました");
    } catch (error) {
      logger.error("admin_exportAuditLogs failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "監査ログエクスポートの開始に失敗しました");
    }
  },
);

// =============================================================================
// エクスポート履歴一覧API
// =============================================================================

/**
 * エクスポート履歴一覧を取得（管理者専用）
 *
 * 過去のエクスポートジョブ一覧を取得します。
 *
 * @param request.data.type - タイプフィルター
 * @param request.data.status - ステータスフィルター
 * @param request.data.limit - 取得件数
 * @param request.data.cursor - ページネーションカーソル
 * @returns エクスポート履歴一覧
 */
export const admin_listExportHistory = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_listExportHistory");

    try {
      // admin以上の権限を要求
      const context = await requireAdminOrAbove(request);

      const data = request.data as ListExportHistoryRequest;

      // バリデーション
      if (data.type && !["user_data", "stats", "audit_logs"].includes(data.type)) {
        throw new HttpsError("invalid-argument", "typeはuser_data, stats, audit_logsのいずれかを指定してください");
      }

      if (data.status && !["pending", "processing", "completed", "failed"].includes(data.status)) {
        throw new HttpsError("invalid-argument", "statusはpending, processing, completed, failedのいずれかを指定してください");
      }

      const limit = Math.min(
        data.limit || EXPORT_CONSTANTS.DEFAULT_HISTORY_LIMIT,
        EXPORT_CONSTANTS.MAX_HISTORY_LIMIT,
      );

      logger.info("Listing export history", {
        adminId: context.adminUser.uid,
        type: data.type,
        status: data.status,
        limit,
      });

      // エクスポートジョブ一覧を取得
      const result = await listExportJobs({
        type: data.type,
        status: data.status,
        limit,
        cursor: data.cursor,
      });

      // レスポンス用に変換
      const items: ExportHistoryItem[] = result.items.map((job) => {
        // ダウンロード可能かチェック
        let downloadable = false;
        if (job.status === "completed" && job.downloadUrl && job.downloadUrlExpiry) {
          downloadable = job.downloadUrlExpiry.toDate() > new Date();
        }

        return {
          jobId: job.id,
          type: job.type,
          status: job.status,
          format: job.format,
          requestedBy: job.requestedBy,
          targetUserId: job.targetUserId,
          fileSize: job.fileSize,
          recordCount: job.recordCount,
          downloadable,
          createdAt: timestampToISO(job.createdAt) || new Date().toISOString(),
          completedAt: timestampToISO(job.completedAt),
        };
      });

      const response: ListExportHistoryResponse = {
        items,
        nextCursor: result.nextCursor,
        totalCount: result.totalCount,
      };

      logger.functionEnd("admin_listExportHistory", Date.now() - startTime, {
        itemCount: items.length,
        totalCount: result.totalCount,
      });

      return success(response, "エクスポート履歴を取得しました");
    } catch (error) {
      logger.error("admin_listExportHistory failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "エクスポート履歴の取得に失敗しました");
    }
  },
);
