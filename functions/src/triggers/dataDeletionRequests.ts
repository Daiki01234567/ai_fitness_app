/**
 * データ削除リクエスト Firestore トリガー
 *
 * dataDeletionRequestsコレクションのドキュメント変更を処理
 * GDPR第17条（忘れられる権利）に準拠した30日猶予期間付き削除を実装
 *
 * 法的根拠: GDPR 第17条（消去の権利）
 *
 * 仕様書参照:
 * - docs/common/specs/03_Firestoreデータベース設計書_v1_0.md - DataDeletionRequestsコレクション
 * - docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - GDPR関連API
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { cloudTasks } from "../services/cloudTasks";
import { DataDeletionRequest } from "../types/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 削除猶予期間（日数）
 * GDPR準拠のため30日間の猶予期間を設ける
 */
const DELETION_GRACE_PERIOD_DAYS = 30;

/**
 * トリガー: データ削除リクエスト作成時
 *
 * ユーザーがアカウント削除をリクエストした際に自動的に実行される
 *
 * 処理内容:
 * 1. ユーザードキュメントに削除予定フラグを設定
 * 2. Cloud Tasksで30日後の削除処理をスケジュール
 * 3. ユーザーに削除予定の通知を作成
 * 4. 監査ログを記録
 */
export const onDataDeletionRequestCreated = onDocumentCreated(
  {
    document: "dataDeletionRequests/{requestId}",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data in deletion request creation event");
      return;
    }

    const requestData = snapshot.data() as DataDeletionRequest;
    const requestId = event.params.requestId;
    const userId = requestData.userId;

    logger.info("Processing data deletion request", {
      requestId,
      userId,
      requestedAt: requestData.requestedAt?.toDate?.()?.toISOString(),
      exportRequested: requestData.exportRequested,
    });

    try {
      // 1. ユーザードキュメントの存在確認
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        logger.warn("User not found for deletion request", { userId, requestId });

        // ユーザーが存在しない場合はリクエストをキャンセル扱いに
        await snapshot.ref.update({
          status: "cancelled",
          cancelledAt: FieldValue.serverTimestamp(),
          reason: "User not found",
        });
        return;
      }

      const userData = userDoc.data()!;

      // 2. 既に削除予定の場合はスキップ
      if (userData.deletionScheduled) {
        logger.info("User already scheduled for deletion", { userId, requestId });

        await snapshot.ref.update({
          status: "cancelled",
          cancelledAt: FieldValue.serverTimestamp(),
          reason: "Already scheduled for deletion",
        });
        return;
      }

      // 3. 削除予定日を計算（30日後）
      const now = new Date();
      const scheduledDeletionDate = new Date(now);
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

      // 4. ユーザードキュメントに削除予定フラグを設定
      await userRef.update({
        deletionScheduled: true,
        scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
        forceLogoutAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Set deletion scheduled flag for user", {
        userId,
        scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      });

      // 5. Cloud Tasksで30日後の削除処理をスケジュール
      let taskName: string | null = null;
      try {
        taskName = await cloudTasks.createDataDeletionTask(
          userId,
          requestId,
          scheduledDeletionDate,
        );

        logger.info("Scheduled deletion task", {
          userId,
          requestId,
          taskName,
          scheduledFor: scheduledDeletionDate.toISOString(),
        });
      } catch (taskError) {
        logger.error("Failed to create deletion task", taskError as Error, {
          userId,
          requestId,
        });

        // タスク作成に失敗してもリクエストは継続
        // スケジュール関数でフォールバック処理
      }

      // 6. データエクスポートがリクエストされている場合はエクスポートタスクを作成
      if (requestData.exportRequested) {
        try {
          const exportTaskName = await cloudTasks.createDataExportTask(userId, requestId);

          logger.info("Created data export task", {
            userId,
            requestId,
            exportTaskName,
          });
        } catch (exportError) {
          logger.error("Failed to create export task", exportError as Error, {
            userId,
            requestId,
          });
          // エクスポートタスク作成失敗は致命的ではない
        }
      }

      // 7. ユーザーへの通知を作成
      const notificationRef = db.collection("notifications").doc();
      await notificationRef.set({
        userId,
        type: "system",
        title: "アカウント削除予定",
        body: "アカウント削除リクエストを受け付けました。" +
          DELETION_GRACE_PERIOD_DAYS +
          "日間の猶予期間後に完全に削除されます。" +
          "この期間中にキャンセルすることが可能です。",
        data: {
          requestId,
          scheduledDeletionDate: scheduledDeletionDate.toISOString(),
          type: "deletion_scheduled",
        },
        read: false,
        sentAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      logger.info("Created deletion notification for user", {
        userId,
        requestId,
      });

      // 8. カスタムクレームを更新して強制ログアウトを設定
      try {
        const user = await admin.auth().getUser(userId);
        const currentClaims = user.customClaims || {};

        await admin.auth().setCustomUserClaims(userId, {
          ...currentClaims,
          deletionScheduled: true,
          forceLogout: true,
          forceLogoutAt: Date.now(),
        });

        logger.info("Set custom claims for deletion scheduled user", { userId });
      } catch (authError) {
        logger.error("Failed to set custom claims", authError as Error, { userId });
        // カスタムクレーム設定失敗は致命的ではない
      }

      // 9. リフレッシュトークンを無効化
      try {
        await admin.auth().revokeRefreshTokens(userId);
        logger.info("Revoked refresh tokens for user", { userId });
      } catch (revokeError) {
        logger.warn("Failed to revoke refresh tokens", {
          error: revokeError,
          userId,
        });
      }

      // 10. 削除リクエストドキュメントを更新
      await snapshot.ref.update({
        status: "pending",
        scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
      });

      logger.info("Data deletion request processed successfully", {
        requestId,
        userId,
        scheduledDeletionDate: scheduledDeletionDate.toISOString(),
        exportRequested: requestData.exportRequested,
        taskName,
      });
    } catch (error) {
      logger.error("Failed to process data deletion request", error as Error, {
        requestId,
        userId,
      });

      // エラー時はステータスを失敗に更新
      try {
        await snapshot.ref.update({
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      } catch (updateError) {
        logger.error("Failed to update request status to failed", updateError as Error, {
          requestId,
        });
      }

      // Dead Letter Queue に保存
      try {
        await db.collection("bigquerySyncFailures").add({
          sourceCollection: "dataDeletionRequests",
          sourceDocumentId: requestId,
          sourceData: {
            userId,
            requestedAt: requestData.requestedAt?.toDate?.()?.toISOString(),
          },
          status: "pending",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: (error as NodeJS.ErrnoException).code,
          retryCount: 0,
          maxRetries: 3,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info("Saved deletion request failure to DLQ", {
          requestId,
          userId,
        });
      } catch (dlqError) {
        logger.error("Failed to save to DLQ", dlqError as Error, { requestId });
      }

      throw error;
    }
  },
);
