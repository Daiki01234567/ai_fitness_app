/**
 * GDPR データエクスポート API
 *
 * GDPR Article 20 (データポータビリティ権) に準拠したデータエクスポート機能
 * - 24時間に1回の制限
 * - 72時間以内の処理完了
 * - JSON/CSV形式でのエクスポート
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as admin from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onTaskDispatched } from "firebase-functions/v2/tasks";

import { rateLimiter } from "../../middleware/rateLimiter";
import { createAuditLog } from "../../services/auditLog";
import { cloudTasks } from "../../services/cloudTasks";
import {
  collectUserData,
  transformToExportFormat,
  uploadExportFile,
  hasRecentExportRequest,
  countUserRecords,
} from "../../services/gdprService";
import {
  ExportRequest,
  ExportStatus,
  ExportFormat,
  ExportScope,
  ExportScopeType,
  ExportDataType,
  RequestDataExportApiRequest,
  RequestDataExportApiResponse,
  GetExportStatusApiResponse,
  GDPR_CONSTANTS,
} from "../../types/gdpr";
import { RateLimitError, NotFoundError, ValidationError } from "../../utils/errors";
import { getFirestore, timestampToISOString } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * エクスポートリクエストコレクション参照
 */
function exportRequestsCollection() {
  return db.collection("exportRequests");
}

/**
 * スコープを検証
 */
function validateScope(scope?: {
  type?: ExportScopeType;
  startDate?: string;
  endDate?: string;
  dataTypes?: ExportDataType[];
}): ExportScope {
  const validScope: ExportScope = {
    type: "all",
  };

  if (!scope) {
    return validScope;
  }

  // タイプを検証
  if (scope.type) {
    if (!["all", "dateRange", "specific"].includes(scope.type)) {
      throw new ValidationError("無効なスコープタイプです");
    }
    validScope.type = scope.type;
  }

  // 日付範囲を検証
  if (scope.type === "dateRange") {
    if (scope.startDate) {
      const startDate = new Date(scope.startDate);
      if (isNaN(startDate.getTime())) {
        throw new ValidationError("無効な開始日です");
      }
      validScope.startDate = Timestamp.fromDate(startDate);
    }
    if (scope.endDate) {
      const endDate = new Date(scope.endDate);
      if (isNaN(endDate.getTime())) {
        throw new ValidationError("無効な終了日です");
      }
      validScope.endDate = Timestamp.fromDate(endDate);
    }
    if (validScope.startDate && validScope.endDate) {
      if (validScope.startDate.toMillis() > validScope.endDate.toMillis()) {
        throw new ValidationError("開始日は終了日より前である必要があります");
      }
    }
  }

  // データタイプを検証
  if (scope.type === "specific") {
    if (!scope.dataTypes || scope.dataTypes.length === 0) {
      throw new ValidationError("specific スコープにはデータタイプの指定が必要です");
    }
    const validDataTypes: ExportDataType[] = [
      "profile",
      "sessions",
      "consents",
      "settings",
      "subscriptions",
    ];
    for (const dataType of scope.dataTypes) {
      if (!validDataTypes.includes(dataType)) {
        throw new ValidationError(`無効なデータタイプ: ${dataType}`);
      }
    }
    validScope.dataTypes = scope.dataTypes;
  }

  return validScope;
}

/**
 * フォーマットを検証
 */
function validateFormat(format?: ExportFormat): ExportFormat {
  if (!format) {
    return "json";
  }
  if (!["json", "csv"].includes(format)) {
    throw new ValidationError("無効なフォーマットです。json または csv を指定してください");
  }
  return format;
}

/**
 * 推定完了時間を計算
 */
function calculateEstimatedCompletionTime(): string {
  // 通常は数分で完了するが、最大72時間を保証
  const estimatedMinutes = 5;
  const completionTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);
  return completionTime.toISOString();
}

// =============================================================================
// API エンドポイント
// =============================================================================

/**
 * データエクスポートをリクエスト
 *
 * @description
 * ユーザーのデータエクスポートリクエストを作成し、バックグラウンド処理をスケジュール。
 * 24時間に1回の制限あり。
 */
export const gdpr_requestDataExport = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (
    request: CallableRequest<RequestDataExportApiRequest>,
  ): Promise<RequestDataExportApiResponse> => {
    const startTime = Date.now();

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data || {};

    logger.info("Data export request received", { userId });

    try {
      // レート制限チェック
      await rateLimiter.check("GDPR_DATA_EXPORT", userId);

      // 24時間以内のリクエストがないか確認
      const hasRecent = await hasRecentExportRequest(userId);
      if (hasRecent) {
        throw new RateLimitError(
          `データエクスポートは${GDPR_CONSTANTS.EXPORT_RATE_LIMIT_HOURS}時間に1回までです`,
        );
      }

      // 入力を検証
      const format = validateFormat(data.format);
      const scope = validateScope(data.scope);

      // リクエスト ID を生成
      const requestId = `export_${userId}_${Date.now()}`;

      // エクスポートリクエストを作成
      const exportRequest: ExportRequest = {
        userId,
        requestId,
        format,
        scope,
        status: "pending",
        requestedAt: Timestamp.now(),
      };

      // Firestore に保存
      await exportRequestsCollection().doc(requestId).set(exportRequest);

      // Cloud Tasks でバックグラウンド処理をスケジュール
      await cloudTasks.createDataExportTask(userId, requestId);

      // 監査ログを作成
      await createAuditLog({
        userId,
        action: "data_export_request",
        resourceType: "export",
        resourceId: requestId,
        newValues: {
          format,
          scopeType: scope.type,
        },
        success: true,
      });

      logger.info("Data export request created", {
        userId,
        requestId,
        format,
        scopeType: scope.type,
        durationMs: Date.now() - startTime,
      });

      return {
        requestId,
        status: "pending",
        estimatedCompletionTime: calculateEstimatedCompletionTime(),
        message: "エクスポートリクエストを受け付けました。処理完了後に通知されます。",
      };
    } catch (error) {
      logger.error("Data export request failed", error as Error, { userId });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof RateLimitError) {
        throw new HttpsError("resource-exhausted", error.message);
      }
      if (error instanceof ValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }

      throw new HttpsError("internal", "エクスポートリクエストの処理に失敗しました");
    }
  },
);

/**
 * エクスポートステータスを取得
 */
export const gdpr_getExportStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request: CallableRequest<{ requestId: string }>): Promise<GetExportStatusApiResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const { requestId } = request.data || {};

    if (!requestId) {
      throw new HttpsError("invalid-argument", "リクエストIDが必要です");
    }

    try {
      const docRef = exportRequestsCollection().doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError("エクスポートリクエスト", requestId);
      }

      const exportRequest = doc.data() as ExportRequest;

      // 本人確認
      if (exportRequest.userId !== userId) {
        throw new HttpsError("permission-denied", "このリクエストにアクセスする権限がありません");
      }

      return {
        requestId: exportRequest.requestId,
        status: exportRequest.status,
        downloadUrl: exportRequest.downloadUrl,
        expiresAt: timestampToISOString(exportRequest.expiresAt),
        recordCount: exportRequest.recordCount,
        fileSizeBytes: exportRequest.fileSizeBytes,
        error: exportRequest.error,
      };
    } catch (error) {
      logger.error("Get export status failed", error as Error, { userId, requestId });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof NotFoundError) {
        throw new HttpsError("not-found", error.message);
      }

      throw new HttpsError("internal", "ステータスの取得に失敗しました");
    }
  },
);

/**
 * エクスポートジョブを処理（Cloud Tasks トリガー）
 */
export const gdpr_processDataExport = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
      maxBackoffSeconds: 600,
    },
    rateLimits: {
      maxConcurrentDispatches: 10,
    },
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540, // 9分
  },
  async (req) => {
    const { userId, requestId } = req.data as { userId: string; requestId: string };
    const startTime = Date.now();

    logger.info("Processing data export job", { userId, requestId });

    const docRef = exportRequestsCollection().doc(requestId);

    try {
      // リクエストを取得
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.error("Export request not found", undefined, { requestId });
        return;
      }

      const exportRequest = doc.data() as ExportRequest;

      // 既に処理済みの場合はスキップ
      if (exportRequest.status === "completed" || exportRequest.status === "failed") {
        logger.info("Export request already processed", { requestId, status: exportRequest.status });
        return;
      }

      // ステータスを processing に更新
      await docRef.update({
        status: "processing",
        processingStartedAt: FieldValue.serverTimestamp(),
      });

      // ユーザーデータを収集
      const exportData = await collectUserData(userId, exportRequest.scope);

      // フォーマットに変換
      const content = transformToExportFormat(exportData, exportRequest.format);

      // Cloud Storage にアップロード
      const { downloadUrl, expiresAt, fileSizeBytes } = await uploadExportFile(
        userId,
        requestId,
        content,
        exportRequest.format,
      );

      // レコード数をカウント
      const recordCount = await countUserRecords(userId);

      // ステータスを completed に更新
      await docRef.update({
        status: "completed" as ExportStatus,
        completedAt: FieldValue.serverTimestamp(),
        downloadUrl,
        expiresAt: Timestamp.fromDate(expiresAt),
        fileSizeBytes,
        recordCount,
      });

      logger.info("Data export completed", {
        userId,
        requestId,
        format: exportRequest.format,
        fileSizeBytes,
        recordCount,
        durationMs: Date.now() - startTime,
      });

      // TODO: ユーザーに通知を送信
      // await sendExportCompletedNotification(userId, requestId, downloadUrl);
    } catch (error) {
      logger.error("Data export processing failed", error as Error, { userId, requestId });

      // ステータスを failed に更新
      await docRef.update({
        status: "failed" as ExportStatus,
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      });

      throw error; // リトライのために再スロー
    }
  },
);

/**
 * エクスポートリクエスト一覧を取得
 */
export const gdpr_getExportRequests = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<{ limit?: number }>,
  ): Promise<{ requests: GetExportStatusApiResponse[] }> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const limit = request.data?.limit || 10;

    try {
      const snapshot = await exportRequestsCollection()
        .where("userId", "==", userId)
        .orderBy("requestedAt", "desc")
        .limit(limit)
        .get();

      const requests: GetExportStatusApiResponse[] = snapshot.docs.map((doc) => {
        const data = doc.data() as ExportRequest;
        return {
          requestId: data.requestId,
          status: data.status,
          downloadUrl: data.downloadUrl,
          expiresAt: timestampToISOString(data.expiresAt),
          recordCount: data.recordCount,
          fileSizeBytes: data.fileSizeBytes,
          error: data.error,
        };
      });

      return { requests };
    } catch (error) {
      logger.error("Get export requests failed", error as Error, { userId });
      throw new HttpsError("internal", "エクスポートリクエスト一覧の取得に失敗しました");
    }
  },
);
