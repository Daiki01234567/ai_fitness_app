/**
 * 通知設定状態管理ストア
 *
 * Zustandを使用して通知設定を管理します。
 * AsyncStorageを使用して設定を永続化します。
 *
 * @see docs/expo/tickets/028-notification-settings.md
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * 曜日の型
 */
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/**
 * 頻度プリセット
 */
export type FrequencyPreset = "daily" | "three_times" | "weekly" | "custom";

/**
 * 通知設定状態の型定義
 */
interface NotificationSettingsState {
  // State
  /** 全体通知有効フラグ */
  enabled: boolean;
  /** トレーニングリマインダー有効フラグ */
  trainingReminder: boolean;
  /** リマインダー時刻（HH:MM形式） */
  reminderTime: string;
  /** リマインダー曜日 */
  reminderDays: DayOfWeek[];
  /** 頻度プリセット */
  frequencyPreset: FrequencyPreset;
  /** タイムゾーン */
  timezone: string;
  /** 削除通知有効フラグ */
  deletionNotice: boolean;
  /** 課金通知有効フラグ */
  billingNotice: boolean;
  /** 同期済みフラグ */
  isSynced: boolean;
  /** 最終同期日時 */
  lastSyncedAt: string | null;
  /** hydration完了フラグ */
  _hasHydrated: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setTrainingReminder: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderDays: (days: DayOfWeek[]) => void;
  setFrequencyPreset: (preset: FrequencyPreset) => void;
  toggleDay: (day: DayOfWeek) => void;
  setTimezone: (timezone: string) => void;
  setDeletionNotice: (enabled: boolean) => void;
  setBillingNotice: (enabled: boolean) => void;
  markSynced: () => void;
  markUnsynced: () => void;
  loadFromServer: (settings: Partial<NotificationSettingsState>) => void;
  resetNotificationSettings: () => void;
  setHasHydrated: (state: boolean) => void;
}

/**
 * デフォルトの曜日設定（月・水・金）
 */
const DEFAULT_DAYS: DayOfWeek[] = ["monday", "wednesday", "friday"];

/**
 * デフォルト設定
 */
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  trainingReminder: false,
  reminderTime: "19:00",
  reminderDays: DEFAULT_DAYS,
  frequencyPreset: "three_times" as FrequencyPreset,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  deletionNotice: true,
  billingNotice: true,
  isSynced: false,
  lastSyncedAt: null,
};

/**
 * 頻度プリセットに対応する曜日を取得
 */
function getDaysForPreset(preset: FrequencyPreset, currentDays: DayOfWeek[]): DayOfWeek[] {
  switch (preset) {
    case "daily":
      return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    case "three_times":
      return ["monday", "wednesday", "friday"];
    case "weekly":
      return ["sunday"];
    case "custom":
    default:
      return currentDays;
  }
}

/**
 * 通知設定ストア（AsyncStorage永続化付き）
 *
 * 使用例:
 * ```tsx
 * function NotificationSettingsScreen() {
 *   const {
 *     trainingReminder,
 *     reminderTime,
 *     reminderDays,
 *     frequencyPreset,
 *     setTrainingReminder,
 *     setReminderTime,
 *     setFrequencyPreset,
 *     toggleDay,
 *   } = useNotificationStore();
 *
 *   return (
 *     <View>
 *       <Switch value={trainingReminder} onValueChange={setTrainingReminder} />
 *       <TimePicker value={reminderTime} onChange={setReminderTime} />
 *     </View>
 *   );
 * }
 * ```
 */
export const useNotificationStore = create<NotificationSettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_NOTIFICATION_SETTINGS,
      _hasHydrated: false,

      // Actions
      setEnabled: (enabled) => set({ enabled, isSynced: false }),

      setTrainingReminder: (trainingReminder) => set({ trainingReminder, isSynced: false }),

      setReminderTime: (reminderTime) => set({ reminderTime, isSynced: false }),

      setReminderDays: (reminderDays) => set({ reminderDays, isSynced: false }),

      setFrequencyPreset: (frequencyPreset) => {
        const currentDays = get().reminderDays;
        const newDays = getDaysForPreset(frequencyPreset, currentDays);
        set({ frequencyPreset, reminderDays: newDays, isSynced: false });
      },

      toggleDay: (day) => {
        const current = get().reminderDays;
        const newDays = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        // Ensure at least one day is selected
        if (newDays.length > 0) {
          set({ reminderDays: newDays, frequencyPreset: "custom", isSynced: false });
        }
      },

      setTimezone: (timezone) => set({ timezone, isSynced: false }),

      setDeletionNotice: (deletionNotice) => set({ deletionNotice, isSynced: false }),

      setBillingNotice: (billingNotice) => set({ billingNotice, isSynced: false }),

      markSynced: () =>
        set({
          isSynced: true,
          lastSyncedAt: new Date().toISOString(),
        }),

      markUnsynced: () => set({ isSynced: false }),

      loadFromServer: (settings) =>
        set({
          ...settings,
          isSynced: true,
          lastSyncedAt: new Date().toISOString(),
        }),

      resetNotificationSettings: () => set(DEFAULT_NOTIFICATION_SETTINGS),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "ai-fitness-notification-settings",
      storage: createJSONStorage(() => AsyncStorage),
      // Exclude internal fields from persistence
      partialize: (state) => ({
        enabled: state.enabled,
        trainingReminder: state.trainingReminder,
        reminderTime: state.reminderTime,
        reminderDays: state.reminderDays,
        frequencyPreset: state.frequencyPreset,
        timezone: state.timezone,
        deletionNotice: state.deletionNotice,
        billingNotice: state.billingNotice,
        isSynced: state.isSynced,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * 曜日の日本語表示名を取得
 */
export function getDayLabel(day: DayOfWeek): string {
  const labels: Record<DayOfWeek, string> = {
    monday: "月",
    tuesday: "火",
    wednesday: "水",
    thursday: "木",
    friday: "金",
    saturday: "土",
    sunday: "日",
  };
  return labels[day];
}

/**
 * 曜日の長い日本語表示名を取得
 */
export function getDayLabelLong(day: DayOfWeek): string {
  const labels: Record<DayOfWeek, string> = {
    monday: "月曜日",
    tuesday: "火曜日",
    wednesday: "水曜日",
    thursday: "木曜日",
    friday: "金曜日",
    saturday: "土曜日",
    sunday: "日曜日",
  };
  return labels[day];
}

/**
 * 全曜日リスト
 */
export const ALL_DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
