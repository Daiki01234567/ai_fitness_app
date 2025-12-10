/**
 * 認証フック
 *
 * Firebase Authを使用した認証関連の操作を提供するカスタムフックです。
 * Phase 1ではメール/パスワード認証を本実装。
 * Google認証はDevelopment Build後に本実装予定。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { useCallback, useEffect } from "react";

import { useAuthStore, type User } from "@/stores";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as firebaseSignOut,
  resetPassword as firebaseResetPassword,
  signInWithGoogle as firebaseSignInWithGoogle,
  resendVerificationEmail as firebaseResendVerificationEmail,
  deleteAccount as firebaseDeleteAccount,
  subscribeToAuthState,
} from "@/lib/auth";

/**
 * useAuth フックの戻り値の型
 */
interface UseAuthReturn {
  /** 現在のユーザー情報 */
  user: User | null;
  /** 認証済みかどうか */
  isAuthenticated: boolean;
  /** 認証処理中かどうか */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** メール/パスワードでサインイン */
  signIn: (email: string, password: string) => Promise<void>;
  /** メール/パスワードでサインアップ */
  signUp: (email: string, password: string) => Promise<void>;
  /** サインアウト */
  signOut: () => Promise<void>;
  /** パスワードリセットメール送信 */
  resetPassword: (email: string) => Promise<void>;
  /** Google認証でサインイン（Development Build後に本実装） */
  signInWithGoogle: () => Promise<void>;
  /** 認証メールを再送信 */
  resendVerificationEmail: () => Promise<void>;
  /** アカウント削除 */
  deleteAccount: () => Promise<void>;
  /** エラーをクリア */
  clearError: () => void;
}

/**
 * 認証フック
 *
 * 使用例:
 * ```tsx
 * function LoginScreen() {
 *   const { signIn, isLoading, error } = useAuth();
 *
 *   const handleLogin = async () => {
 *     await signIn(email, password);
 *   };
 *
 *   return (
 *     <View>
 *       {error && <Text style={{ color: 'red' }}>{error}</Text>}
 *       <Button onPress={handleLogin} disabled={isLoading}>
 *         ログイン
 *       </Button>
 *     </View>
 *   );
 * }
 * ```
 */
export const useAuth = (): UseAuthReturn => {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError, clearAuth } =
    useAuthStore();

  /**
   * 認証状態の監視を設定
   */
  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        clearAuth();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [setUser, clearAuth]);

  /**
   * メールアドレスとパスワードでサインイン
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await signInWithEmail(email, password);

        if (!result.success) {
          setError(result.error || "ログインに失敗しました");
          return;
        }

        // User will be set by onAuthStateChanged listener
        console.log("サインイン完了");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "ログインに失敗しました";
        setError(errorMessage);
        throw err;
      }
    },
    [setLoading, setError]
  );

  /**
   * 新規ユーザー登録
   */
  const signUp = useCallback(
    async (email: string, password: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await signUpWithEmail(email, password);

        if (!result.success) {
          setError(result.error || "登録に失敗しました");
          return;
        }

        // User will be set by onAuthStateChanged listener
        console.log("サインアップ完了");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "登録に失敗しました";
        setError(errorMessage);
        throw err;
      }
    },
    [setLoading, setError]
  );

  /**
   * サインアウト
   */
  const signOut = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const result = await firebaseSignOut();

      if (!result.success) {
        setError(result.error || "ログアウトに失敗しました");
        return;
      }

      // User will be cleared by onAuthStateChanged listener
      console.log("サインアウト完了");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ログアウトに失敗しました";
      setError(errorMessage);
      throw err;
    }
  }, [setLoading, setError]);

  /**
   * パスワードリセットメール送信
   */
  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await firebaseResetPassword(email);

        if (!result.success) {
          setError(result.error || "パスワードリセットメールの送信に失敗しました");
          return;
        }

        setLoading(false);
        console.log("パスワードリセットメール送信完了");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "パスワードリセットメールの送信に失敗しました";
        setError(errorMessage);
        throw err;
      }
    },
    [setLoading, setError]
  );

  /**
   * Google認証でサインイン
   * (Development Build後に本実装)
   */
  const signInWithGoogle = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseSignInWithGoogle();

      if (!result.success) {
        setError(result.error || "Google認証に失敗しました");
        return;
      }

      // User will be set by onAuthStateChanged listener when implemented
      console.log("Google認証完了");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Google認証に失敗しました";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * 認証メールを再送信
   */
  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseResendVerificationEmail();

      if (!result.success) {
        setError(result.error || "認証メールの再送信に失敗しました");
        return;
      }

      setLoading(false);
      console.log("認証メール再送信完了");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "認証メールの再送信に失敗しました";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * アカウント削除
   */
  const deleteAccount = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseDeleteAccount();

      if (!result.success) {
        setError(result.error || "アカウント削除に失敗しました");
        throw new Error(result.error);
      }

      // User will be cleared by onAuthStateChanged listener
      console.log("アカウント削除完了");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "アカウント削除に失敗しました";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
    resendVerificationEmail,
    deleteAccount,
    clearError,
  };
};
