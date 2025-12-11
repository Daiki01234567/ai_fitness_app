/**
 * 強制削除API
 *
 * 管理者（superAdminのみ）がユーザーアカウントと関連データを
 * 即座に完全削除できるAPI
 *
 * GDPR対応や法的要請に対応するため、30日間の猶予期間を待たずに削除
 *
 * 参照: docs/common/tickets/044-force-delete-api.md
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md - FR-043
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { getAdminLevel } from "../../middleware/adminAuth";
import {
  backupUserData,
  deleteUserCompletely,
  logForceDeleteAudit,
  getDeletePreviewData,
} from "../../services/userDeletion";
import {
  ForceDeleteRequest,
  ForceDeleteResponse,
  DeletePreviewResponse,
  generateConfirmationCode,
  validateConfirmationCode,
  timestampToString,
} from "../../types/admin";
import { userRef } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// 強制削除API
// =============================================================================

/**
 * ユーザーアカウントと関連データを即座に完全削除する（superAdmin専用）
 *
 * 重要: この操作は取り消せません
 *
 * @param data - 強制削除リクエスト
 * @param data.userId - 削除するユーザーのUID
 * @param data.reason - 削除理由（必須、監査ログ用）
 * @param data.confirmationCode - 確認コード（ユーザーIDの最初の8文字）
 *
 * @returns 削除結果
 *
 * @throws unauthenticated - 認証がない場合
 * @throws permission-denied - superAdmin権限がない場合
 * @throws invalid-argument - パラメータが不正な場合
 * @throws not-found - ユーザーが見つからない場合
 * @throws internal - 削除処理中にエラーが発生した場合
 *
 * @example
 * ```typescript
 * const result = await admin_forceDeleteUser({
 *   userId: "abc12345-...",
 *   reason: "GDPR削除要求（法的要請）",
 *   confirmationCode: "abc12345",
 * });
 * ```
 */
export const admin_forceDeleteUser = onCall<ForceDeleteRequest, Promise<ForceDeleteResponse>>(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300, // 5分（削除処理に時間がかかる場合あり）
  },
  async (request) => {
    const startTime = Date.now();

    // 1. 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // 2. superAdmin権限チェック（最高権限のみ）
    const adminLevel = getAdminLevel(request.auth.token);
    if (adminLevel !== "super_admin") {
      logger.warn("強制削除の権限不足", {
        userId: request.auth.uid,
        adminLevel,
        requestedAction: "force_delete",
      });
      throw new HttpsError(
        "permission-denied",
        "この操作にはsuperAdmin権限が必要です",
      );
    }

    const { userId, reason, confirmationCode } = request.data;

    // 3. パラメータバリデーション
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userIdは必須です");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      throw new HttpsError(
        "invalid-argument",
        "削除理由は10文字以上で入力してください",
      );
    }

    if (!confirmationCode || typeof confirmationCode !== "string") {
      throw new HttpsError("invalid-argument", "確認コードは必須です");
    }

    // 4. 確認コードの検証（誤操作防止）
    if (!validateConfirmationCode(userId, confirmationCode)) {
      throw new HttpsError(
        "invalid-argument",
        "確認コードが一致しません。ユーザーIDの最初の8文字を入力してください",
      );
    }

    // 5. ユーザーの存在確認
    const userDoc = await userRef(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "ユーザーが見つかりません");
    }

    logger.info("強制削除を開始", {
      targetUserId: userId,
      performedBy: request.auth.uid,
      reason: reason.substring(0, 100), // 監査ログには先頭100文字のみ
    });

    try {
      // 6. 削除前にデータをバックアップ
      const backupData = await backupUserData(
        userId,
        reason,
        request.auth.uid,
      );

      // 7. 監査ログにバックアップIDを記録（削除前）
      const backupId = `backup_${userId}_${Date.now()}`;

      // 8. 削除処理を実行
      const deleteResult = await deleteUserCompletely(
        userId,
        request.auth.uid,
        reason,
        backupId,
      );

      // 9. 監査ログに完全な記録を保存
      const auditLogId = await logForceDeleteAudit({
        performedBy: request.auth.uid,
        targetUser: userId,
        reason,
        backupData,
        deleteResult,
      });

      logger.info("強制削除が完了", {
        targetUserId: userId,
        performedBy: request.auth.uid,
        success: deleteResult.success,
        auditLogId,
        durationMs: Date.now() - startTime,
      });

      // 10. 部分的な失敗がある場合は警告をログ
      if (deleteResult.errors && deleteResult.errors.length > 0) {
        logger.warn("強制削除で一部エラーが発生", {
          targetUserId: userId,
          errors: deleteResult.errors,
        });
      }

      return {
        success: deleteResult.success,
        message: deleteResult.success
          ? "ユーザーとすべての関連データを削除しました"
          : "ユーザーの削除が完了しましたが、一部エラーが発生しました",
        deletedUserId: userId,
        backupId: auditLogId,
      };
    } catch (error) {
      logger.error("強制削除中にエラーが発生", error as Error, {
        targetUserId: userId,
        performedBy: request.auth.uid,
      });

      throw new HttpsError(
        "internal",
        "削除処理中にエラーが発生しました。管理者に連絡してください",
      );
    }
  },
);

// =============================================================================
// 削除プレビューAPI
// =============================================================================

/**
 * 削除対象のデータ概要を取得する（superAdmin専用）
 *
 * 削除前に対象ユーザーのデータ概要を確認するためのAPI
 * 確認コードも返すため、削除APIを呼ぶ前の確認に使用
 *
 * @param data - プレビューリクエスト
 * @param data.userId - プレビューするユーザーのUID
 *
 * @returns 削除プレビュー情報
 *
 * @throws unauthenticated - 認証がない場合
 * @throws permission-denied - superAdmin権限がない場合
 * @throws invalid-argument - userIdがない場合
 * @throws not-found - ユーザーが見つからない場合
 *
 * @example
 * ```typescript
 * const preview = await admin_getDeletePreview({
 *   userId: "abc12345-...",
 * });
 * console.log(`確認コード: ${preview.confirmationCode}`);
 * ```
 */
export const admin_getDeletePreview = onCall<
  { userId: string },
  Promise<DeletePreviewResponse>
>(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    // 1. 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // 2. superAdmin権限チェック
    const adminLevel = getAdminLevel(request.auth.token);
    if (adminLevel !== "super_admin") {
      logger.warn("削除プレビューの権限不足", {
        userId: request.auth.uid,
        adminLevel,
      });
      throw new HttpsError(
        "permission-denied",
        "この操作にはsuperAdmin権限が必要です",
      );
    }

    const { userId } = request.data;

    // 3. パラメータバリデーション
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userIdは必須です");
    }

    // 4. ユーザーデータを取得
    const userDoc = await userRef(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "ユーザーが見つかりません");
    }

    const userData = userDoc.data();

    // 5. 追加データを取得
    const previewData = await getDeletePreviewData(userId);

    logger.info("削除プレビューを取得", {
      targetUserId: userId,
      performedBy: request.auth.uid,
      sessionCount: previewData.sessionCount,
      consentCount: previewData.consentCount,
    });

    return {
      userId,
      email: userData?.email || "",
      displayName: userData?.nickname || userData?.displayName || null,
      createdAt: timestampToString(userData?.createdAt) || "",
      sessionCount: previewData.sessionCount,
      hasStripeAccount: previewData.hasStripeAccount,
      subscriptionStatus: userData?.subscriptionStatus || null,
      confirmationCode: generateConfirmationCode(userId),
      consentCount: previewData.consentCount,
      lastLoginAt: timestampToString(userData?.lastLoginAt),
      deletionScheduled: userData?.deletionScheduled || false,
    };
  },
);
