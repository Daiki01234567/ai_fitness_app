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
  setUserDeletionScheduled,
  hasPendingDeletionRequest,
  deleteUserStorage,
  deleteUserFromBigQuery,
  verifyCompleteDeletion,
  generateDeletionCertificate,
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
  DeletionCertificate,
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
 *
 * 強化版: Storage削除、BigQuery削除、削除証明書生成を含む完全な削除処理
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

    logger.info("Processing data deletion job (enhanced)", { userId, requestId });

    const docRef = deletionRequestsCollection().doc(requestId);

    // Track deletion results for certificate
    let storageFilesCount = 0;
    let bigqueryRowsDeleted = 0;
    let authDeleted = false;

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
        processingStartedAt: FieldValue.serverTimestamp(),
      });

      // ========================================
      // Step 1: Firestore データを削除
      // ========================================
      logger.info("Step 1: Deleting Firestore data", { userId, requestId });
      const { deletedCollections } = await deleteUserData(userId, deletionRequest.scope);

      // ========================================
      // Step 2: Storage データを削除
      // ========================================
      logger.info("Step 2: Deleting Storage data", { userId, requestId });
      const storageResult = await deleteUserStorage(userId);
      storageFilesCount = storageResult.filesCount;

      if (!storageResult.deleted && storageResult.error) {
        logger.warn("Storage deletion had errors", {
          userId,
          requestId,
          error: storageResult.error,
        });
      }

      // ========================================
      // Step 3: BigQuery データを削除
      // ========================================
      logger.info("Step 3: Deleting BigQuery data", { userId, requestId });
      const bigqueryResult = await deleteUserFromBigQuery(userId);
      bigqueryRowsDeleted = bigqueryResult.rowsAffected;

      if (!bigqueryResult.deleted && bigqueryResult.error) {
        logger.warn("BigQuery deletion had errors", {
          userId,
          requestId,
          error: bigqueryResult.error,
        });
      }

      // ========================================
      // Step 4: Firebase Auth を削除（全削除の場合のみ）
      // ========================================
      if (deletionRequest.scope.includes("all")) {
        logger.info("Step 4: Deleting Firebase Auth user", { userId, requestId });
        try {
          await admin.auth().deleteUser(userId);
          authDeleted = true;
          deletedCollections.push("auth");
        } catch (authError) {
          logger.warn("Failed to delete Auth user", { userId }, authError as Error);
          // Auth user may have been deleted already
          authDeleted = false;
        }
      }

      // ========================================
      // Step 5: 完全削除を検証
      // ========================================
      logger.info("Step 5: Verifying complete deletion", { userId, requestId });
      const {
        verified,
        verificationResult,
        remainingData,
      } = await verifyCompleteDeletion(userId, deletionRequest.scope);

      if (!verified) {
        logger.warn("Deletion verification found remaining data", {
          userId,
          requestId,
          remainingData,
        });
      }

      // ========================================
      // Step 6: 削除証明書を生成
      // ========================================
      logger.info("Step 6: Generating deletion certificate", { userId, requestId });
      const certificate = await generateDeletionCertificate(
        userId,
        requestId,
        {
          firestoreCollections: deletedCollections,
          storageFilesCount,
          bigqueryRowsDeleted,
          authDeleted,
        },
        verificationResult,
      );

      // ステータスを completed に更新
      await docRef.update({
        status: "completed" as DeletionRequestStatus,
        executedAt: FieldValue.serverTimestamp(),
        deletionVerified: verified,
        deletedCollections,
        certificateId: certificate.certificateId,
        deletionDetails: {
          storageFilesDeleted: storageFilesCount,
          bigqueryRowsDeleted,
          authDeleted,
          verificationResult,
        },
      });

      // 監査ログを作成
      await createAuditLog({
        userId,
        action: "account_deleted",
        resourceType: "deletion",
        resourceId: requestId,
        newValues: {
          deletedCollections,
          storageFilesDeleted: storageFilesCount,
          bigqueryRowsDeleted,
          authDeleted,
          verified,
          certificateId: certificate.certificateId,
        },
        success: true,
      });

      logger.info("Data deletion completed successfully", {
        userId,
        requestId,
        deletedCollections,
        storageFilesDeleted: storageFilesCount,
        bigqueryRowsDeleted,
        authDeleted,
        verified,
        certificateId: certificate.certificateId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Data deletion processing failed", error as Error, { userId, requestId });

      // ステータスを更新（エラー情報を記録）
      await docRef.update({
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
        lastErrorAt: FieldValue.serverTimestamp(),
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

/**
 * 削除証明書を取得
 *
 * @description
 * 削除リクエスト完了後に発行された削除証明書を取得。
 * GDPR コンプライアンス証明として使用可能。
 */
export const gdpr_getDeletionCertificate = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<{ requestId: string }>,
  ): Promise<{ certificate: DeletionCertificate | null; message: string }> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const { requestId } = request.data || {};

    if (!requestId) {
      throw new HttpsError("invalid-argument", "リクエストIDが必要です");
    }

    logger.info("Getting deletion certificate", { userId, requestId });

    try {
      // Get the deletion request first
      const deletionDoc = await deletionRequestsCollection().doc(requestId).get();

      if (!deletionDoc.exists) {
        throw new NotFoundError("削除リクエスト", requestId);
      }

      const deletionRequest = deletionDoc.data() as DeletionRequest;

      // Verify ownership
      if (deletionRequest.userId !== userId) {
        throw new HttpsError("permission-denied", "この証明書にアクセスする権限がありません");
      }

      // Check if deletion is completed and has a certificate
      if (deletionRequest.status !== "completed") {
        return {
          certificate: null,
          message: "削除がまだ完了していないため、証明書は発行されていません",
        };
      }

      // Get the certificate ID from the deletion request
      type DeletionRequestWithCert = DeletionRequest & { certificateId?: string };
      const certificateId = (deletionRequest as DeletionRequestWithCert).certificateId;

      if (!certificateId) {
        return {
          certificate: null,
          message: "この削除リクエストには証明書が関連付けられていません",
        };
      }

      // Get the certificate
      const certDoc = await db.collection("deletionCertificates").doc(certificateId).get();

      if (!certDoc.exists) {
        logger.warn("Certificate not found for completed deletion", { requestId, certificateId });
        return {
          certificate: null,
          message: "証明書が見つかりません",
        };
      }

      const certificate = certDoc.data() as DeletionCertificate;

      logger.info("Deletion certificate retrieved", { userId, requestId, certificateId });

      return {
        certificate,
        message: "削除証明書を取得しました",
      };
    } catch (error) {
      logger.error("Get deletion certificate failed", error as Error, { userId, requestId });

      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof NotFoundError) {
        throw new HttpsError("not-found", error.message);
      }

      throw new HttpsError("internal", "証明書の取得に失敗しました");
    }
  },
);
