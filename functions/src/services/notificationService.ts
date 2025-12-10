/**
 * 通知サービス
 *
 * FCMを使用したプッシュ通知の送信と履歴管理
 * チケット 022, 023, 026 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import {
  NotificationRecord,
  NotificationSendResult,
  NotificationSettings,
  NotificationTemplate,
  NotificationTemplateType,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../types/notification";
import { getFirestore, userRef } from "../utils/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 通知テンプレート定義
 */
/* eslint-disable camelcase */
const NOTIFICATION_TEMPLATES: Record<
  NotificationTemplateType,
  Omit<NotificationTemplate, "type">
> = {
  training_reminder: {
    title: "トレーニングの時間です",
    body: "今日もトレーニングを始めましょう！目標達成に向けて頑張りましょう。",
    data: { action: "open_training" },
  },
  deletion_notice_30_days: {
    title: "アカウント削除予定のお知らせ",
    body: "アカウントは30日後に削除される予定です。" +
      "キャンセルする場合はアプリからお手続きください。",
    data: { action: "open_settings" },
  },
  deletion_notice_7_days: {
    title: "アカウント削除まで7日",
    body: "アカウントは7日後に削除されます。" +
      "キャンセルする場合はお早めにお手続きください。",
    data: { action: "open_settings" },
  },
  deletion_notice_1_day: {
    title: "アカウント削除まで1日",
    body: "アカウントは明日削除されます。" +
      "キャンセルする場合は本日中にお手続きください。",
    data: { action: "open_settings" },
  },
  billing_success: {
    title: "お支払いが完了しました",
    body: "プレミアムプランのお支払いが正常に処理されました。" +
      "引き続きプレミアム機能をお楽しみください。",
    data: { action: "open_subscription" },
  },
  billing_failed: {
    title: "お支払いに問題があります",
    body: "プレミアムプランのお支払いに失敗しました。" +
      "お支払い情報をご確認ください。",
    data: { action: "open_subscription" },
  },
  achievement_unlocked: {
    title: "達成おめでとうございます！",
    body: "新しい実績を達成しました。詳細を確認してください。",
    data: { action: "open_achievements" },
  },
};
/* eslint-enable camelcase */

/**
 * Firestore から取得した通知設定のインターフェース
 */
interface StoredNotificationSettings {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: string[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

/**
 * 通知コレクション参照を取得
 */
function notificationsCollection() {
  return getFirestore().collection("notifications");
}

/**
 * ユーザーの通知設定を取得
 */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const userDoc = await userRef(userId).get();

  if (!userDoc.exists) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS } as NotificationSettings;
  }

  const userData = userDoc.data();
  const settings = userData?.notificationSettings as
    | StoredNotificationSettings
    | undefined;

  if (!settings) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS } as NotificationSettings;
  }

  // 既存の設定とデフォルト値をマージ
  return {
    enabled: settings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    trainingReminder:
      settings.trainingReminder ??
      DEFAULT_NOTIFICATION_SETTINGS.trainingReminder,
    reminderTime:
      settings.reminderTime ?? DEFAULT_NOTIFICATION_SETTINGS.reminderTime,
    reminderDays:
      (settings.reminderDays as NotificationSettings["reminderDays"]) ??
      DEFAULT_NOTIFICATION_SETTINGS.reminderDays,
    timezone: settings.timezone ?? DEFAULT_NOTIFICATION_SETTINGS.timezone,
    deletionNotice:
      settings.deletionNotice ?? DEFAULT_NOTIFICATION_SETTINGS.deletionNotice,
    billingNotice:
      settings.billingNotice ?? DEFAULT_NOTIFICATION_SETTINGS.billingNotice,
    updatedAt: settings.updatedAt,
    createdAt: settings.createdAt,
  };
}

/**
 * ユーザーのFCMトークンを取得
 */
export async function getUserFCMToken(userId: string): Promise<string | null> {
  const userDoc = await userRef(userId).get();

  if (!userDoc.exists) {
    return null;
  }

  const userData = userDoc.data();
  return (userData?.fcmToken as string | undefined) || null;
}

/**
 * 通知テンプレートを取得
 */
export function getNotificationTemplate(
  templateType: NotificationTemplateType,
  customData?: Record<string, string>,
): NotificationTemplate {
  const template = NOTIFICATION_TEMPLATES[templateType];

  return {
    type: templateType,
    title: template.title,
    body: template.body,
    data: { ...template.data, ...customData },
  };
}

/**
 * 通知履歴を保存
 */
async function saveNotificationHistory(
  record: Omit<NotificationRecord, "createdAt">,
): Promise<string> {
  const docRef = await notificationsCollection().add({
    ...record,
    createdAt: FieldValue.serverTimestamp(),
  });

  return docRef.id;
}

/**
 * 通知を送信
 *
 * @param userId - 対象ユーザーID
 * @param templateType - 通知テンプレートタイプ
 * @param customData - カスタムデータ（オプション）
 * @returns 送信結果
 */
export async function sendNotification(
  userId: string,
  templateType: NotificationTemplateType,
  customData?: Record<string, string>,
): Promise<NotificationSendResult> {
  const logContext = logger.child({ userId, templateType });

  try {
    // ユーザーの通知設定を確認
    const settings = await getNotificationSettings(userId);

    // 通知が無効の場合はスキップ
    if (!settings.enabled) {
      logContext.info("Notification skipped - notifications disabled");
      return "skipped";
    }

    // テンプレートタイプに応じた設定確認
    if (templateType === "training_reminder" && !settings.trainingReminder) {
      logContext.info("Notification skipped - training reminders disabled");
      return "skipped";
    }

    if (
      (templateType.startsWith("deletion_notice") &&
        !settings.deletionNotice) ||
      (templateType.startsWith("billing") && !settings.billingNotice)
    ) {
      logContext.info(`Notification skipped - ${templateType} disabled`);
      return "skipped";
    }

    // FCMトークンを取得
    const fcmToken = await getUserFCMToken(userId);

    if (!fcmToken) {
      logContext.warn("Notification skipped - no FCM token");

      // 履歴に記録（トークンなしでスキップ）
      await saveNotificationHistory({
        userId,
        templateType,
        title: "",
        body: "",
        result: "skipped",
        errorMessage: "FCMトークンが登録されていません",
        sentAt: Timestamp.now(),
      });

      return "skipped";
    }

    // テンプレートを取得
    const template = getNotificationTemplate(templateType, customData);

    // FCMメッセージを構築
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: template.title,
        body: template.body,
      },
      data: template.data,
      android: {
        priority: "high",
        notification: {
          channelId: "fitness_notifications",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    // 通知を送信
    const response = await admin.messaging().send(message);

    logContext.info("Notification sent successfully", { messageId: response });

    // 履歴に記録
    await saveNotificationHistory({
      userId,
      templateType,
      title: template.title,
      body: template.body,
      data: template.data,
      result: "success",
      fcmMessageId: response,
      sentAt: Timestamp.now(),
    });

    return "success";
  } catch (error) {
    const err = error as Error;
    logContext.error("Failed to send notification", err);

    // エラータイプに応じた処理
    const errorCode = (error as { code?: string }).code;

    if (
      errorCode === "messaging/invalid-registration-token" ||
      errorCode === "messaging/registration-token-not-registered"
    ) {
      // 無効なトークンの場合、ユーザーのトークンをクリア
      try {
        await userRef(userId).update({
          fcmToken: FieldValue.delete(),
          fcmTokenUpdatedAt: FieldValue.delete(),
        });
        logContext.info("Invalid FCM token removed from user");
      } catch (updateError) {
        logContext.error(
          "Failed to remove invalid FCM token",
          updateError as Error,
        );
      }
    }

    // 履歴に記録
    await saveNotificationHistory({
      userId,
      templateType,
      title: "",
      body: "",
      result: "failed",
      errorMessage: err.message,
      sentAt: Timestamp.now(),
    });

    return "failed";
  }
}

/**
 * 複数ユーザーへの一括通知送信
 *
 * @param userIds - 対象ユーザーIDの配列
 * @param templateType - 通知テンプレートタイプ
 * @param customData - カスタムデータ（オプション）
 * @returns 送信結果のサマリー
 */
export async function sendBulkNotifications(
  userIds: string[],
  templateType: NotificationTemplateType,
  customData?: Record<string, string>,
): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
}> {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      sendNotification(userId, templateType, customData),
    ),
  );

  const summary = {
    total: userIds.length,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const result of results) {
    if (result.status === "fulfilled") {
      switch (result.value) {
        case "success":
          summary.success++;
          break;
        case "failed":
          summary.failed++;
          break;
        case "skipped":
          summary.skipped++;
          break;
      }
    } else {
      summary.failed++;
    }
  }

  logger.info("Bulk notification completed", summary);

  return summary;
}

/**
 * ユーザーの通知履歴を取得
 *
 * @param userId - ユーザーID
 * @param limit - 取得件数（デフォルト: 50）
 * @returns 通知履歴
 */
export async function getNotificationHistory(
  userId: string,
  limit = 50,
): Promise<(NotificationRecord & { id: string })[]> {
  const snapshot = await notificationsCollection()
    .where("userId", "==", userId)
    .orderBy("sentAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as NotificationRecord),
    id: doc.id,
  }));
}
