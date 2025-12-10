/**
 * アプリ設定状態管理ストア
 *
 * Zustandを使用してアプリ設定を管理します。
 * AsyncStorageを使用して設定を永続化します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * サポートされる言語
 */
export type Language = "ja" | "en";

/**
 * サポートされるテーマ
 */
export type Theme = "light" | "dark" | "system";

/**
 * 設定状態の型定義
 */
interface SettingsState {
  // State
  /** サウンド有効フラグ */
  soundEnabled: boolean;
  /** バイブレーション有効フラグ */
  vibrationEnabled: boolean;
  /** 言語設定 */
  language: Language;
  /** テーマ設定 */
  theme: Theme;
  /** 音声フィードバック有効フラグ（トレーニング中） */
  audioFeedback: boolean;
  /** リマインダー通知有効フラグ */
  reminderNotification: boolean;
  /** お知らせ通知有効フラグ */
  newsNotification: boolean;
  /** 設定が読み込み済みかどうか */
  _hasHydrated: boolean;

  // Actions
  /** サウンド設定を変更 */
  setSoundEnabled: (enabled: boolean) => void;
  /** バイブレーション設定を変更 */
  setVibrationEnabled: (enabled: boolean) => void;
  /** 言語設定を変更 */
  setLanguage: (lang: Language) => void;
  /** テーマ設定を変更 */
  setTheme: (theme: Theme) => void;
  /** 音声フィードバック設定を変更 */
  setAudioFeedback: (enabled: boolean) => void;
  /** リマインダー通知設定を変更 */
  setReminderNotification: (enabled: boolean) => void;
  /** お知らせ通知設定を変更 */
  setNewsNotification: (enabled: boolean) => void;
  /** 設定をリセット */
  resetSettings: () => void;
  /** hydration完了をマーク */
  setHasHydrated: (state: boolean) => void;
}

/**
 * デフォルト設定
 */
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  vibrationEnabled: true,
  language: "ja" as Language,
  theme: "system" as Theme,
  audioFeedback: true,
  reminderNotification: false,
  newsNotification: true,
};

/**
 * 設定ストア（AsyncStorage永続化付き）
 *
 * 使用例:
 * ```tsx
 * function SettingsScreen() {
 *   const {
 *     soundEnabled,
 *     vibrationEnabled,
 *     language,
 *     theme,
 *     audioFeedback,
 *     reminderNotification,
 *     newsNotification,
 *     setSoundEnabled,
 *     setVibrationEnabled,
 *     setLanguage,
 *     setTheme,
 *     setAudioFeedback,
 *     setReminderNotification,
 *     setNewsNotification,
 *   } = useSettingsStore();
 *
 *   return (
 *     <View>
 *       <Switch
 *         value={soundEnabled}
 *         onValueChange={setSoundEnabled}
 *       />
 *       <Switch
 *         value={vibrationEnabled}
 *         onValueChange={setVibrationEnabled}
 *       />
 *       <Switch
 *         value={audioFeedback}
 *         onValueChange={setAudioFeedback}
 *       />
 *       <LanguagePicker
 *         value={language}
 *         onChange={setLanguage}
 *       />
 *       <ThemePicker
 *         value={theme}
 *         onChange={setTheme}
 *       />
 *     </View>
 *   );
 * }
 * ```
 *
 * hydration状態の確認:
 * ```tsx
 * function App() {
 *   const hasHydrated = useSettingsStore((state) => state._hasHydrated);
 *
 *   if (!hasHydrated) {
 *     return <LoadingScreen />;
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_SETTINGS,
      _hasHydrated: false,

      // Actions
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      setVibrationEnabled: (enabled) => set({ vibrationEnabled: enabled }),

      setLanguage: (lang) => set({ language: lang }),

      setTheme: (theme) => set({ theme: theme }),

      setAudioFeedback: (enabled) => set({ audioFeedback: enabled }),

      setReminderNotification: (enabled) => set({ reminderNotification: enabled }),

      setNewsNotification: (enabled) => set({ newsNotification: enabled }),

      resetSettings: () => set(DEFAULT_SETTINGS),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "ai-fitness-settings",
      storage: createJSONStorage(() => AsyncStorage),
      // Exclude _hasHydrated from persistence
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        vibrationEnabled: state.vibrationEnabled,
        language: state.language,
        theme: state.theme,
        audioFeedback: state.audioFeedback,
        reminderNotification: state.reminderNotification,
        newsNotification: state.newsNotification,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
