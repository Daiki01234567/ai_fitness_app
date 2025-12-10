/**
 * 通知設定 API
 *
 * 通知設定の取得・更新
 * チケット 022 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import {
  requireAuth,
  requireAuthWithWritePermission,
} from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import {
  NotificationSettings,
  NotificationSettingsResponse,
  UpdateNotificationSettingsRequest,
  WeekdayType,
  VALID_WEEKDAYS,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../../types/notification";
import { userRef } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Firestore から取得した通知設定のインターフェース
 */
interface StoredNotificationSettings {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: WeekdayType[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

/**
 * 時刻形式（HH:MM）のバリデーション正規表現
 */
const TIME_FORMAT_REGEX = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * 時刻形式のバリデーション
 */
function validateReminderTime(time: unknown): string {
  if (typeof time !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "リマインダー時刻は文字列である必要があります",
    );
  }

  if (!TIME_FORMAT_REGEX.test(time)) {
    throw new HttpsError(
      "invalid-argument",
      "リマインダー時刻はHH:MM形式（例: 19:00）で指定してください",
    );
  }

  return time;
}

/**
 * 曜日配列のバリデーション
 */
function validateReminderDays(days: unknown): WeekdayType[] {
  if (!Array.isArray(days)) {
    throw new HttpsError(
      "invalid-argument",
      "リマインダー曜日は配列である必要があります",
    );
  }

  const invalidDays: string[] = [];
  const validDays: WeekdayType[] = [];

  for (const day of days) {
    if (typeof day !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "リマインダー曜日の各要素は文字列である必要があります",
      );
    }

    const lowerDay = day.toLowerCase() as WeekdayType;

    if (VALID_WEEKDAYS.includes(lowerDay)) {
      if (!validDays.includes(lowerDay)) {
        validDays.push(lowerDay);
      }
    } else {
      invalidDays.push(day);
    }
  }

  if (invalidDays.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `無効な曜日が含まれています: ${invalidDays.join(", ")}。` +
        `有効な値: ${VALID_WEEKDAYS.join(", ")}`,
    );
  }

  return validDays;
}

/**
 * タイムゾーンのバリデーション
 */
function validateTimezone(timezone: unknown): string {
  if (typeof timezone !== "string" || timezone.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "タイムゾーンは空でない文字列である必要があります",
    );
  }

  // 基本的なタイムゾーン形式チェック
  // 例: Asia/Tokyo, America/New_York, Europe/London
  const timezonePattern = /^[A-Za-z]+\/[A-Za-z_]+$/;

  if (!timezonePattern.test(timezone) && timezone !== "UTC") {
    throw new HttpsError(
      "invalid-argument",
      "タイムゾーンの形式が不正です（例: Asia/Tokyo）",
    );
  }

  return timezone;
}

/**
 * ブール値のバリデーション
 */
function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName}はブール値である必要があります`,
    );
  }

  return value;
}

/* eslint-disable camelcase */
/**
 * 通知設定更新 callable 関数
 *
 * ユーザーの通知設定を更新
 */
export const notification_updateSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (
    request: CallableRequest<UpdateNotificationSettingsRequest>,
  ): Promise<NotificationSettingsResponse> => {
    // 認証と書き込み権限を確認
    const authContext = await requireAuthWithWritePermission(request);
    const userId = authContext.uid;

    // レート制限チェック
    await rateLimiter.check("NOTIFICATION_SETTINGS", userId);

    const data = request.data || {};

    logger.info("Updating notification settings", { userId });

    try {
      // ユーザーの存在確認
      const userDoc = await userRef(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // 削除予定ユーザーのチェック
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されているため、設定を変更できません",
        );
      }

      // 現在の設定を取得
      const currentSettings = (userData?.notificationSettings ||
        {}) as StoredNotificationSettings;

      // 更新対象の設定を構築
      const updatedSettings: Partial<NotificationSettings> = {};

      if (data.enabled !== undefined) {
        updatedSettings.enabled = validateBoolean(data.enabled, "enabled");
      }

      if (data.trainingReminder !== undefined) {
        updatedSettings.trainingReminder = validateBoolean(
          data.trainingReminder,
          "trainingReminder",
        );
      }

      if (data.reminderTime !== undefined) {
        updatedSettings.reminderTime = validateReminderTime(data.reminderTime);
      }

      if (data.reminderDays !== undefined) {
        updatedSettings.reminderDays = validateReminderDays(data.reminderDays);
      }

      if (data.timezone !== undefined) {
        updatedSettings.timezone = validateTimezone(data.timezone);
      }

      if (data.deletionNotice !== undefined) {
        updatedSettings.deletionNotice = validateBoolean(
          data.deletionNotice,
          "deletionNotice",
        );
      }

      if (data.billingNotice !== undefined) {
        updatedSettings.billingNotice = validateBoolean(
          data.billingNotice,
          "billingNotice",
        );
      }

      // 更新するデータがない場合
      if (Object.keys(updatedSettings).length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "更新する設定が指定されていません",
        );
      }

      // 設定をマージ
      const enabledVal =
        updatedSettings.enabled ??
        currentSettings.enabled ??
        DEFAULT_NOTIFICATION_SETTINGS.enabled;
      const trainingReminderVal =
        updatedSettings.trainingReminder ??
        currentSettings.trainingReminder ??
        DEFAULT_NOTIFICATION_SETTINGS.trainingReminder;
      const reminderTimeVal =
        updatedSettings.reminderTime ??
        currentSettings.reminderTime ??
        DEFAULT_NOTIFICATION_SETTINGS.reminderTime;
      const reminderDaysVal =
        updatedSettings.reminderDays ??
        currentSettings.reminderDays ??
        DEFAULT_NOTIFICATION_SETTINGS.reminderDays;
      const timezoneVal =
        updatedSettings.timezone ??
        currentSettings.timezone ??
        DEFAULT_NOTIFICATION_SETTINGS.timezone;
      const deletionNoticeVal =
        updatedSettings.deletionNotice ??
        currentSettings.deletionNotice ??
        DEFAULT_NOTIFICATION_SETTINGS.deletionNotice;
      const billingNoticeVal =
        updatedSettings.billingNotice ??
        currentSettings.billingNotice ??
        DEFAULT_NOTIFICATION_SETTINGS.billingNotice;

      const newSettings: NotificationSettings = {
        enabled: enabledVal,
        trainingReminder: trainingReminderVal,
        reminderTime: reminderTimeVal,
        reminderDays: reminderDaysVal,
        timezone: timezoneVal,
        deletionNotice: deletionNoticeVal,
        billingNotice: billingNoticeVal,
        createdAt: currentSettings.createdAt,
      };

      // Firestoreを更新
      await userRef(userId).update({
        notificationSettings: {
          ...newSettings,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: currentSettings.createdAt || FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Notification settings updated successfully", { userId });

      return {
        success: true,
        data: newSettings,
        message: "通知設定を更新しました",
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error(
        "Failed to update notification settings",
        error as Error,
        { userId },
      );
      throw new HttpsError("internal", "通知設定の更新に失敗しました");
    }
  },
);

/**
 * 通知設定取得 callable 関数
 *
 * ユーザーの通知設定を取得（デフォルト値を含む）
 */
export const notification_getSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request: CallableRequest): Promise<NotificationSettingsResponse> => {
    // 認証を確認
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    logger.info("Getting notification settings", { userId });

    try {
      // ユーザーの存在確認
      const userDoc = await userRef(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();
      const savedSettings = (userData?.notificationSettings ||
        {}) as StoredNotificationSettings;

      // デフォルト値とマージ
      const settings: NotificationSettings = {
        enabled:
          savedSettings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
        trainingReminder:
          savedSettings.trainingReminder ??
          DEFAULT_NOTIFICATION_SETTINGS.trainingReminder,
        reminderTime:
          savedSettings.reminderTime ??
          DEFAULT_NOTIFICATION_SETTINGS.reminderTime,
        reminderDays:
          savedSettings.reminderDays ??
          DEFAULT_NOTIFICATION_SETTINGS.reminderDays,
        timezone:
          savedSettings.timezone ?? DEFAULT_NOTIFICATION_SETTINGS.timezone,
        deletionNotice:
          savedSettings.deletionNotice ??
          DEFAULT_NOTIFICATION_SETTINGS.deletionNotice,
        billingNotice:
          savedSettings.billingNotice ??
          DEFAULT_NOTIFICATION_SETTINGS.billingNotice,
        updatedAt: savedSettings.updatedAt,
        createdAt: savedSettings.createdAt,
      };

      logger.info("Notification settings retrieved successfully", { userId });

      return {
        success: true,
        data: settings,
        message: "通知設定を取得しました",
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error(
        "Failed to get notification settings",
        error as Error,
        { userId },
      );
      throw new HttpsError("internal", "通知設定の取得に失敗しました");
    }
  },
);
/* eslint-enable camelcase */
