/**
 * 認証状態管理ストア
 *
 * Zustandを使用して認証状態を管理します。
 * Phase 1では基本的な認証フローを実装します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { create } from "zustand";

/**
 * ユーザー情報の型定義
 */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * 認証状態の型定義
 */
interface AuthState {
  // State
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  initializeAuth: () => Promise<void>;
}

/**
 * 認証ストア
 *
 * 使用例:
 * ```tsx
 * function LoginScreen() {
 *   const { user, isAuthenticated, isLoading } = useAuthStore();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isAuthenticated) return <Redirect to="/home" />;
 *   return <LoginForm />;
 * }
 * ```
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isInitialized: false,

  // Actions
  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
      error: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    }),

  /**
   * 認証状態の初期化
   *
   * Firebase Authの状態を確認し、認証状態を復元します。
   * TODO: Firebase Auth onAuthStateChanged を実装する
   */
  initializeAuth: async () => {
    if (get().isInitialized) return;

    try {
      // TODO: Firebase Auth からユーザー状態を取得
      // import auth from '@react-native-firebase/auth';
      // const currentUser = auth().currentUser;
      // if (currentUser) {
      //   set({
      //     user: {
      //       uid: currentUser.uid,
      //       email: currentUser.email,
      //       displayName: currentUser.displayName,
      //       photoURL: currentUser.photoURL,
      //       emailVerified: currentUser.emailVerified,
      //     },
      //     isAuthenticated: true,
      //     isLoading: false,
      //     isInitialized: true,
      //   });
      // } else {
      //   set({ isLoading: false, isInitialized: true });
      // }

      // Simulate auth state check delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // No persisted user for now
      set({
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Auth initialization failed:", error);
      set({
        isLoading: false,
        isInitialized: true,
        error: "認証状態の確認に失敗しました",
      });
    }
  },
}));
