/**
 * 通知関連の型定義
 *
 * プッシュ通知とリマインダー機能のための型
 * チケット 022, 023, 026 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { Timestamp } from "firebase-admin/firestore";

/**
 * 通知テンプレートタイプ
 */
export type NotificationTemplateType =
  | "training_reminder"
  | "deletion_notice_30_days"
  | "deletion_notice_7_days"
  | "deletion_notice_1_day"
  | "billing_success"
  | "billing_failed"
  | "achievement_unlocked";

/**
 * 通知送信結果
 */
export type NotificationSendResult = "success" | "failed" | "skipped";

/**
 * 曜日タイプ
 */
export type WeekdayType =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/**
 * 有効な曜日リスト
 */
export const VALID_WEEKDAYS: WeekdayType[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * 曜日から数値へのマッピング（0 = 日曜日）
 */
export const WEEKDAY_TO_NUMBER: Record<WeekdayType, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * 通知設定インターフェース
 */
export interface NotificationSettings {
  enabled: boolean;
  trainingReminder: boolean;
  reminderTime: string; // HH:MM format
  reminderDays: WeekdayType[];
  timezone: string;
  deletionNotice: boolean;
  billingNotice: boolean;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

/**
 * デフォルト通知設定
 */
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<
  NotificationSettings,
  "updatedAt" | "createdAt"
> = {
  enabled: true,
  trainingReminder: true,
  reminderTime: "19:00",
  reminderDays: ["monday", "wednesday", "friday"],
  timezone: "Asia/Tokyo",
  deletionNotice: true,
  billingNotice: true,
};

/**
 * 通知履歴レコード
 */
export interface NotificationRecord {
  userId: string;
  templateType: NotificationTemplateType;
  title: string;
  body: string;
  data?: Record<string, string>;
  result: NotificationSendResult;
  errorMessage?: string;
  fcmMessageId?: string;
  sentAt: Timestamp;
  createdAt: Timestamp;
}

/**
 * 通知テンプレート
 */
export interface NotificationTemplate {
  type: NotificationTemplateType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * FCMトークン更新リクエスト
 */
export interface UpdateFCMTokenRequest {
  fcmToken: string;
}

/**
 * 通知設定更新リクエスト
 */
export interface UpdateNotificationSettingsRequest {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: WeekdayType[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
}

/**
 * 通知設定レスポンス
 */
export interface NotificationSettingsResponse {
  success: true;
  data: NotificationSettings;
  message: string;
}
