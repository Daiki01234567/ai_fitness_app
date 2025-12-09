/**
 * ユーザープロファイル状態管理ストア
 *
 * Zustandを使用してユーザープロファイルを管理します。
 * 認証後のユーザー情報、同意状態などを保持します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { create } from "zustand";

/**
 * ユーザープロファイルの型定義
 */
export interface UserProfile {
  /** Firebase Auth UID */
  uid: string;
  /** ユーザーのメールアドレス */
  email: string;
  /** 表示名 */
  displayName: string | null;
  /** プロフィール画像URL */
  photoURL: string | null;
  /** アカウント作成日時 */
  createdAt: Date;
  /** 利用規約への同意状態 */
  tosAccepted: boolean;
  /** プライバシーポリシーへの同意状態 */
  ppAccepted: boolean;
}

/**
 * ユーザー状態の型定義
 */
interface UserState {
  // State
  /** ユーザープロファイル */
  profile: UserProfile | null;
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;

  // Actions
  /** プロファイルを設定 */
  setProfile: (profile: UserProfile) => void;
  /** プロファイルをクリア */
  clearProfile: () => void;
  /** 読み込み状態を設定 */
  setLoading: (isLoading: boolean) => void;
  /** エラーを設定 */
  setError: (error: string | null) => void;
  /** プロファイルを部分的に更新 */
  updateProfile: (updates: Partial<UserProfile>) => void;
}

/**
 * ユーザーストア
 *
 * 使用例:
 * ```tsx
 * function ProfileScreen() {
 *   const { profile, isLoading, error } = useUserStore();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (!profile) return <NoProfile />;
 *
 *   return (
 *     <View>
 *       <Text>{profile.displayName}</Text>
 *       <Text>{profile.email}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export const useUserStore = create<UserState>((set) => ({
  // Initial state
  profile: null,
  isLoading: false,
  error: null,

  // Actions
  setProfile: (profile) =>
    set({
      profile,
      isLoading: false,
      error: null,
    }),

  clearProfile: () =>
    set({
      profile: null,
      isLoading: false,
      error: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile
        ? { ...state.profile, ...updates }
        : null,
    })),
}));
