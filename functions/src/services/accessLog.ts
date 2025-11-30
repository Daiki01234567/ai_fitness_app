/**
 * アクセスログサービス
 *
 * セキュリティ監視とコンプライアンスのためのアクセスログ機能を提供
 * - ダウンロード記録
 * - IP アドレス記録（ハッシュ化）
 * - 操作履歴
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as crypto from "crypto";

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { CallableRequest } from "firebase-functions/v2/https";

import {
  AccessLogEntry,
  AccessLogAction,
  GetAccessLogsOptions,
  AccessLogSummary,
  RequestSecurityMetadata,
  SECURITY_CONSTANTS,
} from "../types/security";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * IP アドレスをハッシュ化
 *
 * @param ipAddress IP アドレス
 * @returns ハッシュ化された IP アドレス
 */
export function hashIpAddress(ipAddress: string): string {
  const salt = process.env[SECURITY_CONSTANTS.IP_HASH_SALT_ENV] || "ip_default_salt";
  return crypto
    .createHash("sha256")
    .update(ipAddress + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * リクエストからセキュリティメタデータを抽出
 *
 * @param request Callable リクエスト
 * @returns セキュリティメタデータ
 */
export function extractRequestMetadata(
  request: CallableRequest,
): RequestSecurityMetadata {
  const rawRequest = request.rawRequest;

  // IP アドレスを取得（プロキシ経由の場合は X-Forwarded-For を使用）
  let ipAddress: string | undefined;
  if (rawRequest) {
    ipAddress =
      (rawRequest.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      rawRequest.ip ||
      rawRequest.socket?.remoteAddress;
  }

  // ユーザーエージェントを取得
  const userAgent = rawRequest?.headers["user-agent"] as string;

  // リファラーを取得
  const referer = rawRequest?.headers["referer"] as string;

  return {
    ipAddress,
    ipAddressHash: ipAddress ? hashIpAddress(ipAddress) : undefined,
    userAgent,
    referer,
    requestId: request.rawRequest?.headers["x-request-id"] as string | undefined,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// アクセスログ記録
// =============================================================================

/**
 * アクセスログを記録
 *
 * @param entry アクセスログエントリー
 * @returns 作成されたログ ID
 */
export async function logAccess(
  entry: Omit<AccessLogEntry, "timestamp" | "logId">,
): Promise<string> {
  try {
    const logEntry: Omit<AccessLogEntry, "logId"> = {
      ...entry,
      timestamp: FieldValue.serverTimestamp() as unknown as Timestamp,
    };

    const docRef = await db.collection("accessLogs").add(logEntry);

    logger.info("Access log created", {
      logId: docRef.id,
      userId: entry.userId,
      action: entry.action,
      success: entry.success,
    });

    return docRef.id;
  } catch (error) {
    // ログ記録失敗はメイン処理に影響させない
    logger.error("Failed to create access log", error as Error, {
      userId: entry.userId,
      action: entry.action,
    });
    return "";
  }
}

/**
 * エクスポートダウンロードをログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logExportDownload(params: {
  userId: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return logAccess({
    userId: params.userId,
    action: "export_download",
    resourceId: params.requestId,
    resourceType: "export",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
  });
}

/**
 * エクスポートリクエストをログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logExportRequest(params: {
  userId: string;
  requestId: string;
  format: string;
  scopeType: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return logAccess({
    userId: params.userId,
    action: "export_request",
    resourceId: params.requestId,
    resourceType: "export",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      format: params.format,
      scopeType: params.scopeType,
    },
  });
}

/**
 * 削除リクエストをログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logDeletionRequest(params: {
  userId: string;
  requestId: string;
  deletionType: string;
  scope: string[];
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return logAccess({
    userId: params.userId,
    action: "deletion_request",
    resourceId: params.requestId,
    resourceType: "deletion",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      deletionType: params.deletionType,
      scope: params.scope,
    },
  });
}

/**
 * 削除キャンセルをログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logDeletionCancel(params: {
  userId: string;
  requestId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return logAccess({
    userId: params.userId,
    action: "deletion_cancel",
    resourceId: params.requestId,
    resourceType: "deletion",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      cancellationReason: params.reason,
    },
  });
}

/**
 * アカウント復元をログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logRecovery(params: {
  userId: string;
  requestId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return logAccess({
    userId: params.userId,
    action: "recovery",
    resourceId: params.requestId,
    resourceType: "account",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      // メールアドレスはマスキング
      email: params.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
    },
  });
}

/**
 * 管理者操作をログ記録
 *
 * @param params パラメータ
 * @returns ログ ID
 */
export async function logAdminAccess(params: {
  adminUserId: string;
  targetUserId: string;
  action: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  return logAccess({
    userId: params.adminUserId,
    action: "admin_action",
    resourceId: params.resourceId,
    resourceType: "admin",
    ipAddressHash: params.ipAddress ? hashIpAddress(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      targetUserId: params.targetUserId,
      adminAction: params.action,
      ...params.metadata,
    },
  });
}

// =============================================================================
// アクセスログ取得
// =============================================================================

/**
 * ユーザーのアクセスログを取得
 *
 * @param userId ユーザー ID
 * @param options 取得オプション
 * @returns アクセスログエントリー一覧
 */
export async function getAccessLogs(
  userId: string,
  options: GetAccessLogsOptions = {},
): Promise<AccessLogEntry[]> {
  try {
    let query = db.collection("accessLogs")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc");

    // アクションでフィルタ
    if (options.action) {
      query = query.where("action", "==", options.action);
    }

    // 日付範囲でフィルタ
    if (options.startDate) {
      query = query.where("timestamp", ">=", Timestamp.fromDate(options.startDate));
    }
    if (options.endDate) {
      query = query.where("timestamp", "<=", Timestamp.fromDate(options.endDate));
    }

    // 件数制限
    const limit = options.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({
      logId: doc.id,
      ...doc.data(),
    })) as AccessLogEntry[];
  } catch (error) {
    logger.error("Failed to get access logs", error as Error, { userId });
    return [];
  }
}

/**
 * リソースのアクセスログを取得
 *
 * @param resourceId リソース ID
 * @param resourceType リソースタイプ
 * @param options 取得オプション
 * @returns アクセスログエントリー一覧
 */
export async function getResourceAccessLogs(
  resourceId: string,
  resourceType: string,
  options: Omit<GetAccessLogsOptions, "resourceType"> = {},
): Promise<AccessLogEntry[]> {
  try {
    let query = db.collection("accessLogs")
      .where("resourceId", "==", resourceId)
      .where("resourceType", "==", resourceType)
      .orderBy("timestamp", "desc");

    // 件数制限
    const limit = options.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({
      logId: doc.id,
      ...doc.data(),
    })) as AccessLogEntry[];
  } catch (error) {
    logger.error("Failed to get resource access logs", error as Error, {
      resourceId,
      resourceType,
    });
    return [];
  }
}

// =============================================================================
// アクセスログ集計
// =============================================================================

/**
 * ユーザーのアクセスログを集計
 *
 * @param userId ユーザー ID
 * @param startDate 集計開始日
 * @param endDate 集計終了日
 * @returns 集計結果
 */
export async function summarizeAccessLogs(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<AccessLogSummary> {
  try {
    const logs = await getAccessLogs(userId, {
      startDate,
      endDate,
      limit: 10000, // 集計用に上限を上げる
    });

    // アクション別カウント
    /* eslint-disable camelcase */
    const actionCounts: Record<AccessLogAction, number> = {
      export_download: 0,
      export_request: 0,
      deletion_request: 0,
      deletion_cancel: 0,
      recovery: 0,
      admin_view: 0,
      admin_action: 0,
      sensitive_op: 0,
    };
    /* eslint-enable camelcase */

    let successCount = 0;

    for (const log of logs) {
      if (log.action in actionCounts) {
        actionCounts[log.action]++;
      }
      if (log.success) {
        successCount++;
      }
    }

    const successRate = logs.length > 0 ? successCount / logs.length : 1;

    return {
      actionCounts,
      successRate,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (error) {
    logger.error("Failed to summarize access logs", error as Error, { userId });

    /* eslint-disable camelcase */
    return {
      actionCounts: {
        export_download: 0,
        export_request: 0,
        deletion_request: 0,
        deletion_cancel: 0,
        recovery: 0,
        admin_view: 0,
        admin_action: 0,
        sensitive_op: 0,
      },
      successRate: 0,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
    /* eslint-enable camelcase */
  }
}

// =============================================================================
// アクセスログクリーンアップ
// =============================================================================

/**
 * 古いアクセスログを削除
 *
 * @param retentionDays 保存日数
 * @returns 削除されたログ数
 */
export async function cleanupOldAccessLogs(
  retentionDays: number = SECURITY_CONSTANTS.ACCESS_LOG_RETENTION_DAYS,
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const snapshot = await db.collection("accessLogs")
      .where("timestamp", "<", Timestamp.fromDate(cutoffDate))
      .limit(500) // バッチサイズ
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info("Access logs cleanup completed", {
      deletedCount: snapshot.size,
      cutoffDate: cutoffDate.toISOString(),
    });

    return snapshot.size;
  } catch (error) {
    logger.error("Failed to cleanup access logs", error as Error);
    return 0;
  }
}
