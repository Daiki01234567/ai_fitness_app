/**
 * バックアップスケジューラー
 *
 * Firestoreの自動バックアップを定期実行するスケジュール関数
 * - 毎日午前2時UTC（日本時間11時）に日次バックアップ
 * - 毎週日曜日午前2時UTCに週次バックアップ
 * - 毎日午前3時UTCに古いバックアップを削除
 *
 * チケット 030 対応
 *
 * 参照: docs/common/specs/02-2_非機能要件_v1_0.md - NFR-027, NFR-028
 * 参照: docs/common/tickets/030-backup-recovery.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";

import {
  executeFirestoreBackup,
  deleteOldBackups,
  sendBackupAlert,
} from "../../services/backupService";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/* eslint-disable camelcase */

/**
 * 日次バックアップ（毎日午前2時UTC）
 *
 * Firestoreの全コレクションを Cloud Storage にエクスポート
 * バックアップは30日間保持
 *
 * @example
 * // Firebase Functions Shell でテスト実行:
 * backup_createDailyBackup()
 */
export const backup_createDailyBackup = onSchedule(
  {
    schedule: "0 2 * * *", // 毎日午前2時UTC（日本時間11時）
    timeZone: "UTC",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540, // 9分（バックアップは時間がかかる可能性）
    retryCount: 2,
  },
  async (_event: ScheduledEvent) => {
    logger.info("日次Firestoreバックアップ開始");

    try {
      const result = await executeFirestoreBackup("daily");

      if (!result.success) {
        // バックアップ失敗時はアラートを送信
        await sendBackupAlert({
          type: "backup_failure",
          backupType: "daily",
          message: `日次バックアップが失敗しました: ${result.error}`,
          details: {
            outputUriPrefix: result.outputUriPrefix,
            durationMs: result.durationMs,
          },
        });

        throw new Error(result.error);
      }

      logger.info("日次Firestoreバックアップ完了", {
        outputUriPrefix: result.outputUriPrefix,
        operationName: result.operationName,
        durationMs: result.durationMs,
      });
    } catch (error) {
      logger.error("日次Firestoreバックアップでエラー発生", error as Error);
      throw error;
    }
  },
);

/**
 * 週次バックアップ（毎週日曜日午前2時UTC）
 *
 * Firestoreの全コレクションを Cloud Storage にエクスポート
 * バックアップは90日間保持
 *
 * @example
 * // Firebase Functions Shell でテスト実行:
 * backup_createWeeklyBackup()
 */
export const backup_createWeeklyBackup = onSchedule(
  {
    schedule: "0 2 * * 0", // 毎週日曜日午前2時UTC（日本時間11時）
    timeZone: "UTC",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540,
    retryCount: 2,
  },
  async (_event: ScheduledEvent) => {
    logger.info("週次Firestoreバックアップ開始");

    try {
      const result = await executeFirestoreBackup("weekly");

      if (!result.success) {
        await sendBackupAlert({
          type: "backup_failure",
          backupType: "weekly",
          message: `週次バックアップが失敗しました: ${result.error}`,
          details: {
            outputUriPrefix: result.outputUriPrefix,
            durationMs: result.durationMs,
          },
        });

        throw new Error(result.error);
      }

      logger.info("週次Firestoreバックアップ完了", {
        outputUriPrefix: result.outputUriPrefix,
        operationName: result.operationName,
        durationMs: result.durationMs,
      });
    } catch (error) {
      logger.error("週次Firestoreバックアップでエラー発生", error as Error);
      throw error;
    }
  },
);

/**
 * 古いバックアップの削除（毎日午前3時UTC）
 *
 * 保持期間を過ぎたバックアップファイルを自動削除
 * - daily: 30日以上前
 * - weekly: 90日以上前
 *
 * @example
 * // Firebase Functions Shell でテスト実行:
 * backup_deleteOldBackups()
 */
export const backup_deleteOldBackups = onSchedule(
  {
    schedule: "0 3 * * *", // 毎日午前3時UTC
    timeZone: "UTC",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300,
    retryCount: 2,
  },
  async (_event: ScheduledEvent) => {
    logger.info("古いバックアップの削除開始");

    try {
      const result = await deleteOldBackups();

      if (result.errors.length > 0) {
        // 一部のファイル削除に失敗した場合
        await sendBackupAlert({
          type: "cleanup_failure",
          message: "一部のバックアップファイル削除に失敗しました",
          details: {
            deletedCount: result.deletedCount,
            errors: result.errors,
          },
        });
      }

      logger.info("古いバックアップの削除完了", {
        deletedCount: result.deletedCount,
        errorCount: result.errors.length,
      });
    } catch (error) {
      logger.error("古いバックアップの削除でエラー発生", error as Error);

      await sendBackupAlert({
        type: "cleanup_failure",
        message: `バックアップクリーンアップが失敗しました: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });

      throw error;
    }
  },
);

/* eslint-enable camelcase */
