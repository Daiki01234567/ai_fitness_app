/**
 * 通知スケジューラー
 *
 * 定期実行される通知関連の関数
 * - トレーニングリマインダー（毎時）
 * - 削除予告通知（毎日）
 *
 * チケット 023 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";

import {
  sendNotification,
  sendBulkNotifications,
} from "../../services/notificationService";
import {
  NotificationSettings,
  WEEKDAY_TO_NUMBER,
  WeekdayType,
} from "../../types/notification";
import { usersCollection } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 時刻情報インターフェース
 */
interface TimeInfo {
  hours: number;
  minutes: number;
  dayOfWeek: number;
}

/**
 * 指定されたタイムゾーンでの現在時刻を取得
 */
function getCurrentTimeInTimezone(timezone: string): TimeInfo {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);

    let hours = 0;
    let minutes = 0;
    let weekday = "";

    for (const part of parts) {
      if (part.type === "hour") {
        hours = parseInt(part.value, 10);
      } else if (part.type === "minute") {
        minutes = parseInt(part.value, 10);
      } else if (part.type === "weekday") {
        weekday = part.value.toLowerCase();
      }
    }

    // 曜日を数値に変換
    const dayMapping: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    return {
      hours,
      minutes,
      dayOfWeek: dayMapping[weekday] || 0,
    };
  } catch {
    // タイムゾーンエラーの場合はUTCとして扱う
    const now = new Date();
    return {
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      dayOfWeek: now.getUTCDay(),
    };
  }
}

/**
 * 時刻文字列（HH:MM）を時と分に分解
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n, 10));
  return { hours, minutes };
}

/**
 * 現在時刻がリマインダー時刻と一致するかチェック
 * 1時間ごとの実行なので、時のみ比較
 */
function isReminderTime(
  currentTime: TimeInfo,
  reminderTime: string,
  reminderDays: WeekdayType[],
): boolean {
  const { hours: reminderHours } = parseTimeString(reminderTime);

  // 時間が一致するかチェック
  if (currentTime.hours !== reminderHours) {
    return false;
  }

  // 曜日が一致するかチェック
  for (const day of reminderDays) {
    if (WEEKDAY_TO_NUMBER[day] === currentTime.dayOfWeek) {
      return true;
    }
  }

  return false;
}

/* eslint-disable camelcase */
/**
 * トレーニングリマインダー送信（毎時実行）
 *
 * 各ユーザーのタイムゾーンと設定された時刻に基づいて
 * トレーニングリマインダーを送信
 */
export const notification_sendTrainingReminders = onSchedule(
  {
    schedule: "0 * * * *", // 毎時0分に実行
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300,
    retryCount: 3,
  },
  async (_event: ScheduledEvent) => {
    logger.info("Starting training reminder job");

    try {
      // 通知が有効でトレーニングリマインダーが有効なユーザーを取得
      const usersSnapshot = await usersCollection()
        .where("notificationSettings.enabled", "==", true)
        .where("notificationSettings.trainingReminder", "==", true)
        .where("deletionScheduled", "==", false)
        .get();

      if (usersSnapshot.empty) {
        logger.info("No users with training reminders enabled");
        return;
      }

      logger.info(
        `Found ${usersSnapshot.size} users with reminders enabled`,
      );

      const usersToNotify: string[] = [];

      for (const doc of usersSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const settings = userData.notificationSettings as NotificationSettings;

        // FCMトークンがない場合はスキップ
        if (!userData.fcmToken) {
          continue;
        }

        // ユーザーのタイムゾーンでの現在時刻を取得
        const currentTime = getCurrentTimeInTimezone(
          settings.timezone || "Asia/Tokyo",
        );

        // リマインダー時刻と曜日をチェック
        if (
          isReminderTime(
            currentTime,
            settings.reminderTime || "19:00",
            settings.reminderDays || ["monday", "wednesday", "friday"],
          )
        ) {
          usersToNotify.push(userId);
        }
      }

      if (usersToNotify.length === 0) {
        logger.info("No users to notify at this time");
        return;
      }

      logger.info(
        `Sending training reminders to ${usersToNotify.length} users`,
      );

      // バッチで通知を送信
      const result = await sendBulkNotifications(
        usersToNotify,
        "training_reminder",
      );

      logger.info("Training reminder job completed", result);
    } catch (error) {
      logger.error("Training reminder job failed", error as Error);
      throw error;
    }
  },
);

/**
 * 削除予定日までの残り日数を計算
 */
function getDaysUntilDeletion(scheduledDeletionDate: Timestamp): number {
  const now = new Date();
  const deletionDate = scheduledDeletionDate.toDate();
  const diffTime = deletionDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 削除予告通知送信（毎日04:00 UTC実行）
 *
 * 削除予定のユーザーに対して、30日、7日、1日前に通知を送信
 */
export const notification_sendDeletionNotices = onSchedule(
  {
    schedule: "0 4 * * *", // 毎日04:00 UTCに実行
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 300,
    retryCount: 3,
  },
  async (_event: ScheduledEvent) => {
    logger.info("Starting deletion notice job");

    try {
      // 削除予定のユーザーを取得
      const usersSnapshot = await usersCollection()
        .where("deletionScheduled", "==", true)
        .get();

      if (usersSnapshot.empty) {
        logger.info("No users with scheduled deletion");
        return;
      }

      logger.info(
        `Found ${usersSnapshot.size} users with scheduled deletion`,
      );

      const notificationsSent = {
        thirtyDays: 0,
        sevenDays: 0,
        oneDay: 0,
        skipped: 0,
      };

      for (const doc of usersSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();

        // 削除日が設定されていない場合はスキップ
        if (!userData.scheduledDeletionDate) {
          notificationsSent.skipped++;
          continue;
        }

        // 通知設定を確認
        const settings = userData.notificationSettings as
          | NotificationSettings
          | undefined;

        if (settings && !settings.enabled) {
          notificationsSent.skipped++;
          continue;
        }

        if (settings && !settings.deletionNotice) {
          notificationsSent.skipped++;
          continue;
        }

        // FCMトークンがない場合はスキップ
        if (!userData.fcmToken) {
          notificationsSent.skipped++;
          continue;
        }

        // 削除までの残り日数を計算
        const deletionDate = userData.scheduledDeletionDate as Timestamp;
        const daysUntilDeletion = getDaysUntilDeletion(deletionDate);

        // 適切な通知を送信
        if (daysUntilDeletion === 30) {
          await sendNotification(userId, "deletion_notice_30_days");
          notificationsSent.thirtyDays++;
        } else if (daysUntilDeletion === 7) {
          await sendNotification(userId, "deletion_notice_7_days");
          notificationsSent.sevenDays++;
        } else if (daysUntilDeletion === 1) {
          await sendNotification(userId, "deletion_notice_1_day");
          notificationsSent.oneDay++;
        }
      }

      logger.info("Deletion notice job completed", notificationsSent);
    } catch (error) {
      logger.error("Deletion notice job failed", error as Error);
      throw error;
    }
  },
);
/* eslint-enable camelcase */
