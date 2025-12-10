/**
 * 通知サービス
 *
 * プッシュ通知の許可リクエスト、トークン取得、設定の保存・取得を行います。
 *
 * @see docs/expo/tickets/028-notification-settings.md
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform, Linking } from "react-native";

import { DayOfWeek } from "@/stores/notificationStore";

/**
 * 通知許可状態
 */
export interface NotificationPermissionStatus {
  /** 許可されているか */
  granted: boolean;
  /** 再度許可リクエスト可能か */
  canAskAgain: boolean;
  /** 許可状態 */
  status: string;
}

/**
 * 通知設定データ
 */
export interface NotificationSettingsData {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: DayOfWeek[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
}

/**
 * 通知許可状態を取得
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return {
      granted: status === "granted",
      canAskAgain,
      status,
    };
  } catch (error) {
    console.error("[NotificationService] Failed to get permission status:", error);
    return {
      granted: false,
      canAskAgain: true,
      status: "undetermined",
    };
  }
}

/**
 * 通知許可をリクエスト
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn("[NotificationService] Must use physical device for push notifications");
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[NotificationService] Permission not granted");
      return false;
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        } as Notifications.NotificationBehavior;
      },
    });

    return true;
  } catch (error) {
    console.error("[NotificationService] Failed to request permission:", error);
    return false;
  }
}

/**
 * Expoプッシュトークンを取得
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn("[NotificationService] Must use physical device for push notifications");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn("[NotificationService] Project ID not found");
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return token.data;
  } catch (error) {
    console.error("[NotificationService] Failed to get Expo push token:", error);
    return null;
  }
}

/**
 * システムの通知設定画面を開く
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("app-settings:");
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error("[NotificationService] Failed to open settings:", error);
  }
}

/**
 * 通知設定をサーバーに保存
 * TODO: Firebase Functions連携後に実装
 */
export async function saveNotificationSettings(
  settings: NotificationSettingsData
): Promise<void> {
  try {
    // TODO: Implement actual Firebase Functions call
    // const updateSettings = httpsCallable(functions, 'notification_updateSettings');
    // await updateSettings(settings);
    console.log("[NotificationService] Saving settings:", settings);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error("[NotificationService] Failed to save settings:", error);
    throw error;
  }
}

/**
 * 通知設定をサーバーから取得
 * TODO: Firebase Functions連携後に実装
 */
export async function getNotificationSettings(): Promise<NotificationSettingsData | null> {
  try {
    // TODO: Implement actual Firebase Functions call
    // const getSettings = httpsCallable(functions, 'notification_getSettings');
    // const result = await getSettings();
    // return (result.data as any).data;
    console.log("[NotificationService] Getting settings from server");

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return null;
  } catch (error) {
    console.error("[NotificationService] Failed to get settings:", error);
    return null;
  }
}

/**
 * ローカル通知をスケジュール
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput
): Promise<string> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger,
    });
    return identifier;
  } catch (error) {
    console.error("[NotificationService] Failed to schedule notification:", error);
    throw error;
  }
}

/**
 * 全てのスケジュールされた通知をキャンセル
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("[NotificationService] Failed to cancel notifications:", error);
  }
}

/**
 * 特定の通知をキャンセル
 */
export async function cancelScheduledNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error("[NotificationService] Failed to cancel notification:", error);
  }
}

/**
 * トレーニングリマインダーをスケジュール
 */
export async function scheduleTrainingReminder(
  time: string,
  days: DayOfWeek[]
): Promise<string[]> {
  const timeParts = time.split(":").map(Number);
  const hours = timeParts[0] ?? 19;
  const minutes = timeParts[1] ?? 0;

  const dayNumbers: Record<DayOfWeek, number> = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7,
  };

  const identifiers: string[] = [];

  // Cancel existing reminders first
  await cancelAllScheduledNotifications();

  // Schedule new reminders for each selected day
  for (const day of days) {
    const weekday = dayNumbers[day];
    try {
      const identifier = await scheduleLocalNotification(
        "トレーニングの時間です",
        "今日のトレーニングを始めましょう!",
        {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          hour: hours,
          minute: minutes,
          weekday,
        }
      );
      identifiers.push(identifier);
    } catch (error) {
      console.error(`[NotificationService] Failed to schedule reminder for ${day}:`, error);
    }
  }

  return identifiers;
}

/**
 * Androidの通知チャンネルを設定
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("training-reminders", {
        name: "トレーニングリマインダー",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4CAF50",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("general", {
        name: "一般通知",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      });
    } catch (error) {
      console.error("[NotificationService] Failed to setup channels:", error);
    }
  }
}
