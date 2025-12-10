/**
 * バックアップステータスAPI
 *
 * 管理者向けのバックアップステータス取得API
 * - 過去のバックアップログ一覧
 * - バックアップサマリー情報
 * - バケット情報
 *
 * チケット 030 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAdminFromRequest } from "../../middleware/adminAuth";
import {
  getBackupStatus,
  getBackupBucketInfo,
  BackupStatusSummary,
} from "../../services/backupService";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// 型定義
// =============================================================================

/**
 * バックアップステータス取得リクエスト
 */
interface GetBackupStatusRequest {
  /** 取得する日数（デフォルト7日、最大30日） */
  days?: number;
  /** 取得件数上限（デフォルト30件、最大100件） */
  limit?: number;
  /** バケット情報を含めるか */
  includeBucketInfo?: boolean;
}

/**
 * バックアップステータス取得レスポンス
 */
interface GetBackupStatusResponse {
  success: true;
  data: BackupStatusSummary & {
    bucketInfo?: {
      bucketName: string;
      exists: boolean;
      totalSize?: number;
      dailyBackupCount?: number;
      weeklyBackupCount?: number;
    };
  };
}

// =============================================================================
// 入力バリデーション
// =============================================================================

/**
 * リクエストデータを検証
 */
function validateRequest(data: unknown): GetBackupStatusRequest {
  if (data === null || data === undefined) {
    return {};
  }

  if (typeof data !== "object") {
    throw new HttpsError("invalid-argument", "リクエストデータが不正です");
  }

  const request = data as Record<string, unknown>;
  const result: GetBackupStatusRequest = {};

  // days の検証
  if (request.days !== undefined) {
    if (typeof request.days !== "number" || !Number.isInteger(request.days)) {
      throw new HttpsError("invalid-argument", "daysは整数で指定してください");
    }
    if (request.days < 1 || request.days > 30) {
      throw new HttpsError("invalid-argument", "daysは1から30の範囲で指定してください");
    }
    result.days = request.days;
  }

  // limit の検証
  if (request.limit !== undefined) {
    if (typeof request.limit !== "number" || !Number.isInteger(request.limit)) {
      throw new HttpsError("invalid-argument", "limitは整数で指定してください");
    }
    if (request.limit < 1 || request.limit > 100) {
      throw new HttpsError("invalid-argument", "limitは1から100の範囲で指定してください");
    }
    result.limit = request.limit;
  }

  // includeBucketInfo の検証
  if (request.includeBucketInfo !== undefined) {
    if (typeof request.includeBucketInfo !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "includeBucketInfoはbooleanで指定してください",
      );
    }
    result.includeBucketInfo = request.includeBucketInfo;
  }

  return result;
}

// =============================================================================
// API関数
// =============================================================================

/* eslint-disable camelcase */

/**
 * バックアップステータス取得API
 *
 * 管理者のみアクセス可能
 * 過去のバックアップログとサマリー情報を返す
 *
 * @param request Callable リクエスト
 * @returns バックアップステータスレスポンス
 *
 * @example
 * // クライアント側からの呼び出し例:
 * const functions = getFunctions(app, 'asia-northeast1');
 * const getStatus = httpsCallable(functions, 'backup_getBackupStatus');
 * const result = await getStatus({ days: 7, includeBucketInfo: true });
 */
export const backup_getBackupStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request: CallableRequest<unknown>): Promise<GetBackupStatusResponse> => {
    const startTime = Date.now();

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // 管理者権限チェック
    requireAdminFromRequest(request);

    const userId = request.auth.uid;
    logger.info("バックアップステータス取得開始", { userId });

    try {
      // リクエストデータの検証
      const validatedRequest = validateRequest(request.data);
      const {
        days = 7,
        limit = 30,
        includeBucketInfo = false,
      } = validatedRequest;

      // バックアップステータスを取得
      const status = await getBackupStatus(days, limit);

      // バケット情報を取得（オプション）
      let bucketInfo: GetBackupStatusResponse["data"]["bucketInfo"];
      if (includeBucketInfo) {
        bucketInfo = await getBackupBucketInfo();
      }

      const durationMs = Date.now() - startTime;
      logger.info("バックアップステータス取得完了", {
        userId,
        logCount: status.logs.length,
        durationMs,
      });

      return {
        success: true,
        data: {
          ...status,
          ...(bucketInfo && { bucketInfo }),
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error("バックアップステータス取得失敗", error as Error, {
        userId,
        durationMs,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "バックアップステータスの取得に失敗しました",
      );
    }
  },
);

/* eslint-enable camelcase */
