/**
 * GDPR データ削除 API
 *
 * GDPR Article 17 (削除権) に準拠したデータ削除機能
 * - 30日間の猶予期間
 * - キャンセル/復元機能
 * - 完全削除と部分削除
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
  deleteUserData,
  verifyDeletion,
  setUserDeletionScheduled,
  hasPendingDeletionRequest,
} from "../../services/gdprService";
import {
  DeletionRequest,
  DeletionRequestStatus,
  DeletionType,
  DeletionScope,
  RequestDeletionApiRequest,
  RequestDeletionApiResponse,
  CancelDeletionApiRequest,
  CancelDeletionApiResponse,
  GetDeletionStatusApiResponse,
  GDPR_CONSTANTS,
} from "../../types/gdpr";
import { ValidationError, NotFoundError } from "../../utils/errors";
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
 * 削除リクエストコレクション参照
 */
function deletionRequestsCollection() {
  return db.collection("deletionRequests");
}

/**
 * 削除タイプを検証
 */
function validateDeletionType(type?: DeletionType): DeletionType {
  if (!type) {
    return "soft";
  }
  if (!["soft", "hard", "partial"].includes(type)) {
    throw new ValidationError("無効な削除タイプです。soft, hard, partial のいずれかを指定してください");
  }
  return type;
}

/**
 * 削除スコープを検証
 */
function validateDeletionScope(type: DeletionType, scope?: DeletionScope[]): DeletionScope[] {
  if (type === "partial") {
    if (!scope || scope.length === 0) {
      throw new ValidationError("部分削除にはスコープの指定が必要です");
    }
    const validScopes: DeletionScope[] = ["sessions", "consents", "settings", "subscriptions"];
    for (const s of scope) {
      if (!validScopes.includes(s)) {
        throw new ValidationError(`無効な削除スコープ: ${s}`);
      }
    }
    return scope;
  }

  // soft または hard の場合は全削除
  return ["all"];
}

/**
 * 削除予定日を計算
 */
function calculateScheduledDeletionDate(type: DeletionType): Date {
  if (type === "hard") {
    // 即時削除（ただし最低1時間の猶予）
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  // 30日間の猶予期間
  return new Date(Date.now() + GDPR_CONSTANTS.DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * 復元期限を計算
 */
function calculateRecoverDeadline(scheduledDate: Date): Date {
  // 削除予定日の1時間前まで復元可能
  return new Date(scheduledDate.getTime() - 60 * 60 * 1000);
}

// =============================================================================
// API エンドポイント
// =============================================================================

/**
 * アカウント削除をリクエスト
 *
 * @description
 * ユーザーのアカウント削除リクエストを作成。
 * デフォルトで30日間の猶予期間が設定される。
 */
export const gdpr_requestAccountDeletion = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (
    request: CallableRequest<RequestDeletionApiRequest>,
  ): Promise<RequestDeletionApiResponse> => {
    const startTime = Date.now();

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data || {};

    logger.info("Account deletion request received", { userId });

    try {
      // レート制限チェック
      await rateLimiter.check("GDPR_DELETE_REQUEST", userId);

      // 既存の保留中リクエストがないか確認
      const hasPending = await hasPendingDeletionRequest(userId);
      if (hasPending) {
        throw new HttpsError(
          "already-exists",
          "既に削除リクエストが存在します。新しいリクエストを作成する前にキャンセルしてください。",
        );
      }

      // 入力を検証
      const type = validateDeletionType(data.type);
      const scope = validateDeletionScope(type, data.scope);

      // 日付を計算
      const scheduledDate = calculateScheduledDeletionDate(type);
      const recoverDeadline = type === "soft" ? calculateRecoverDeadline(scheduledDate) : undefined;
      const canRecover = type === "soft";

      // リクエスト ID を生成
      const requestId = `deletion_${userId}_${Date.now()}`;

      // 削除リクエストを作成
      const deletionRequest: DeletionRequest = {
        userId,
        requestId,
        type,
        scope,
        reason: data.reason,
        requestedAt: Timestamp.now(),
        scheduledAt: Timestamp.fromDate(scheduledDate),
        status: "scheduled",
        canRecover,
        recoverDeadline: recoverDeadline ? Timestamp.fromDate(recoverDeadline) : undefined,
      };

      // エクスポートリクエストを先に作成する場合
      let exportRequestId: string | undefined;
      if (data.exportDataFirst) {
        // エクスポートリクエストを作成
        const exportRequestDoc = await db.collection("exportRequests").add({
          userId,
          requestId: `export_before_deletion_${userId}_${Date.now()}`,
          format: "json",
          scope: { type: "all" },
          status: "pending",
          requestedAt: FieldValue.serverTimestamp(),
        });
        exportRequestId = exportRequestDoc.id;
        deletionRequest.exportRequestId = exportRequestId;

        // Cloud Tasks でエクスポート処理をスケジュール
        await cloudTasks.createDataExportTask(userId, exportRequestId);
      }

      // Firestore に保存
      await deletionRequestsCollection().doc(requestId).set(deletionRequest);

      // ユーザーに削除予定フラグを設定
      await setUserDeletionScheduled(userId, true, scheduledDate);

      // Cloud Tasks で削除処理をスケジュール
      await cloudTasks.createDataDeletionTask(userId, requestId, scheduledDate);

      // 監査ログを作成
      await createAuditLog({
        userId,
        action: "account_deletion_request",
        resourceType: "deletion",
        resourceId: requestId,
        newValues: {
          type,
          scope,
          scheduledAt: scheduledDate.toISOString(),
          canRecover,
        },
        success: true,
      });

      logger.info("Account deletion request created", {
        userId,
        requestId,
        type,
        scope,
        scheduledAt: scheduledDate.toISOString(),
        canRecover,
        durationMs: Date.now() - startTime,
      });

      return {
        requestId,
        scheduledDeletionDate: scheduledDate.toISOString(),
        canRecover,
        recoverDeadline: recoverDeadline?.toISOString() || scheduledDate.toISOString(),
        exportRequestId,
        message: canRecover
          ? `アカウント削除が${GDPR_CONSTANTS.DELETION_GRACE_PERIOD_DAYS}日後にスケジュールされました。この期間中はキャンセル可能です。`
          : "アカウント削除がスケジュールされました。",
      };
    } catch (error) {
      logger.error("Account deletion request failed", error as Error, { userId });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }

      throw new HttpsError("internal", "削除リクエストの処理に失敗しました");
    }
  },
);

/**
 * 削除リクエストをキャンセル
 */
export const gdpr_cancelDeletion = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (
    request: CallableRequest<CancelDeletionApiRequest>,
  ): Promise<CancelDeletionApiResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const { requestId, reason } = request.data || {};

    if (!requestId) {
      throw new HttpsError("invalid-argument", "リクエストIDが必要です");
    }

    logger.info("Deletion cancellation request received", { userId, requestId });

    try {
      const docRef = deletionRequestsCollection().doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError("削除リクエスト", requestId);
      }

      const deletionRequest = doc.data() as DeletionRequest;

      // 本人確認
      if (deletionRequest.userId !== userId) {
        throw new HttpsError("permission-denied", "このリクエストをキャンセルする権限がありません");
      }

      // ステータス確認
      if (deletionRequest.status === "completed") {
        throw new HttpsError("failed-precondition", "既に削除が完了しています");
      }
      if (deletionRequest.status === "cancelled") {
        throw new HttpsError("failed-precondition", "既にキャンセルされています");
      }
      if (deletionRequest.status === "processing") {
        throw new HttpsError("failed-precondition", "削除処理中のためキャンセルできません");
      }

      // 復元期限を確認
      if (!deletionRequest.canRecover) {
        throw new HttpsError("failed-precondition", "このリクエストはキャンセルできません");
      }
      if (deletionRequest.recoverDeadline) {
        const now = Timestamp.now();
        if (now.toMillis() > deletionRequest.recoverDeadline.toMillis()) {
          throw new HttpsError("failed-precondition", "キャンセル期限を過ぎています");
        }
      }

      // ステータスを cancelled に更新
      await docRef.update({
        status: "cancelled" as DeletionRequestStatus,
        cancelledAt: FieldValue.serverTimestamp(),
        cancellationReason: reason,
        recoveredAt: FieldValue.serverTimestamp(),
      });

      // ユーザーの削除予定フラグを解除
      await setUserDeletionScheduled(userId, false);

      // 監査ログを作成
      await createAuditLog({
        userId,
        action: "account_deletion_cancel",
        resourceType: "deletion",
        resourceId: requestId,
        newValues: {
          reason,
        },
        success: true,
      });

      logger.info("Deletion request cancelled", { userId, requestId });

      return {
        requestId,
        status: "cancelled",
        message: "削除リクエストがキャンセルされました。アカウントは通常通り使用できます。",
      };
    } catch (error) {
      logger.error("Deletion cancellation failed", error as Error, { userId, requestId });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof NotFoundError) {
        throw new HttpsError("not-found", error.message);
      }

      throw new HttpsError("internal", "キャンセル処理に失敗しました");
    }
  },
);

/**
 * 削除ステータスを取得
 */
export const gdpr_getDeletionStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<{ requestId?: string }>,
  ): Promise<GetDeletionStatusApiResponse | null> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const { requestId } = request.data || {};

    try {
      let doc;

      if (requestId) {
        // 特定のリクエストを取得
        doc = await deletionRequestsCollection().doc(requestId).get();
      } else {
        // 最新のアクティブなリクエストを取得
        const snapshot = await deletionRequestsCollection()
          .where("userId", "==", userId)
          .where("status", "in", ["pending", "scheduled", "processing"])
          .orderBy("requestedAt", "desc")
          .limit(1)
          .get();

        if (snapshot.empty) {
          return null;
        }
        doc = snapshot.docs[0];
      }

      if (!doc.exists) {
        return null;
      }

      const deletionRequest = doc.data() as DeletionRequest;

      // 本人確認
      if (deletionRequest.userId !== userId) {
        throw new HttpsError("permission-denied", "このリクエストにアクセスする権限がありません");
      }

      return {
        requestId: deletionRequest.requestId,
        status: deletionRequest.status,
        type: deletionRequest.type,
        scheduledAt: timestampToISOString(deletionRequest.scheduledAt) || "",
        canRecover: deletionRequest.canRecover,
        recoverDeadline: timestampToISOString(deletionRequest.recoverDeadline),
        executedAt: timestampToISOString(deletionRequest.executedAt),
        error: deletionRequest.error,
      };
    } catch (error) {
      logger.error("Get deletion status failed", error as Error, { userId, requestId });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "ステータスの取得に失敗しました");
    }
  },
);

/**
 * 削除ジョブを処理（Cloud Tasks トリガー）
 */
export const gdpr_processDataDeletion = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
      maxBackoffSeconds: 600,
    },
    rateLimits: {
      maxConcurrentDispatches: 5,
    },
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540, // 9分
  },
  async (req) => {
    const { userId, requestId } = req.data as { userId: string; requestId: string };
    const startTime = Date.now();

    logger.info("Processing data deletion job", { userId, requestId });

    const docRef = deletionRequestsCollection().doc(requestId);

    try {
      // リクエストを取得
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.error("Deletion request not found", undefined, { requestId });
        return;
      }

      const deletionRequest = doc.data() as DeletionRequest;

      // キャンセルされた場合はスキップ
      if (deletionRequest.status === "cancelled") {
        logger.info("Deletion request was cancelled", { requestId });
        return;
      }

      // 既に処理済みの場合はスキップ
      if (deletionRequest.status === "completed") {
        logger.info("Deletion request already completed", { requestId });
        return;
      }

      // スケジュール時間をチェック
      const now = Timestamp.now();
      if (deletionRequest.scheduledAt.toMillis() > now.toMillis()) {
        logger.info("Deletion not yet scheduled", {
          requestId,
          scheduledAt: timestampToISOString(deletionRequest.scheduledAt),
        });
        // 再スケジュールするために例外をスロー
        throw new Error("Deletion not yet scheduled");
      }

      // ステータスを processing に更新
      await docRef.update({
        status: "processing" as DeletionRequestStatus,
      });

      // ユーザーデータを削除
      const { deletedCollections } = await deleteUserData(userId, deletionRequest.scope);

      // 削除を検証
      const { verified, remainingData } = await verifyDeletion(userId, deletionRequest.scope);

      if (!verified) {
        logger.warn("Deletion verification failed", { userId, requestId, remainingData });
      }

      // ステータスを completed に更新
      await docRef.update({
        status: "completed" as DeletionRequestStatus,
        executedAt: FieldValue.serverTimestamp(),
        deletionVerified: verified,
        deletedCollections,
      });

      // 監査ログを作成
      await createAuditLog({
        userId,
        action: "account_deleted",
        resourceType: "deletion",
        resourceId: requestId,
        newValues: {
          deletedCollections,
          verified,
        },
        success: true,
      });

      logger.info("Data deletion completed", {
        userId,
        requestId,
        deletedCollections,
        verified,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Data deletion processing failed", error as Error, { userId, requestId });

      // ステータスを更新（エラー情報を記録）
      await docRef.update({
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      });

      throw error; // リトライのために再スロー
    }
  },
);

/**
 * 削除リクエスト一覧を取得
 */
export const gdpr_getDeletionRequests = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<{ limit?: number }>,
  ): Promise<{ requests: GetDeletionStatusApiResponse[] }> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const limit = request.data?.limit || 10;

    try {
      const snapshot = await deletionRequestsCollection()
        .where("userId", "==", userId)
        .orderBy("requestedAt", "desc")
        .limit(limit)
        .get();

      const requests: GetDeletionStatusApiResponse[] = snapshot.docs.map((doc) => {
        const data = doc.data() as DeletionRequest;
        return {
          requestId: data.requestId,
          status: data.status,
          type: data.type,
          scheduledAt: timestampToISOString(data.scheduledAt) || "",
          canRecover: data.canRecover,
          recoverDeadline: timestampToISOString(data.recoverDeadline),
          executedAt: timestampToISOString(data.executedAt),
          error: data.error,
        };
      });

      return { requests };
    } catch (error) {
      logger.error("Get deletion requests failed", error as Error, { userId });
      throw new HttpsError("internal", "削除リクエスト一覧の取得に失敗しました");
    }
  },
);
