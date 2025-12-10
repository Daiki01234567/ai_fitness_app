/**
 * Zustand ストアのエクスポート
 *
 * アプリケーション全体で使用する状態管理ストアを一元管理します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

// Auth Store - 認証状態管理
export { useAuthStore } from "./authStore";
export type { User } from "./authStore";

// User Store - ユーザープロファイル管理
export { useUserStore } from "./userStore";
export type { UserProfile } from "./userStore";

// Training Store - トレーニングセッション管理
export { useTrainingStore } from "./trainingStore";
export type {
  ExerciseType,
  RepData,
  TrainingSession,
} from "./trainingStore";

// Settings Store - アプリ設定管理（永続化付き）
export { useSettingsStore } from "./settingsStore";
export type { Language, Theme } from "./settingsStore";

// Notification Store - 通知設定管理（永続化付き）
export { useNotificationStore, getDayLabel, getDayLabelLong, ALL_DAYS } from "./notificationStore";
export type { DayOfWeek, FrequencyPreset } from "./notificationStore";
