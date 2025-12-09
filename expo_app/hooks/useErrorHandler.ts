/**
 * エラーハンドリングフック
 *
 * Reactコンポーネント内でエラーを簡単に処理するためのカスタムフックです。
 * エラー状態の管理、エラーメッセージの表示、自動クリアなどの機能を提供します。
 *
 * @see CLAUDE.md - エラーハンドリング要件
 */

import { useState, useCallback, useRef, useEffect } from "react";

import {
  AppError,
  ValidationError,
  ErrorCode,
  isAppError,
} from "@/lib/errors";
import {
  normalizeError,
  handleError,
  isRetryableError,
  isAuthenticationError,
  withErrorHandling,
} from "@/lib/errorHandler";

/**
 * エラー状態の型定義
 */
export interface ErrorState {
  /** エラーが発生しているか */
  hasError: boolean;
  /** エラーオブジェクト */
  error: AppError | null;
  /** ユーザー向けメッセージ */
  message: string | null;
  /** エラーコード */
  code: string | null;
  /** 再試行可能か */
  isRetryable: boolean;
}

/**
 * useErrorHandlerの戻り値の型定義
 */
export interface UseErrorHandlerReturn {
  /** 現在のエラー状態 */
  errorState: ErrorState;
  /** エラーを設定 */
  setError: (error: unknown, context?: string) => void;
  /** エラーをクリア */
  clearError: () => void;
  /** エラーハンドリング付きで非同期関数を実行 */
  handleAsync: <T>(
    fn: () => Promise<T>,
    context?: string
  ) => Promise<T | null>;
  /** バリデーションエラーを設定 */
  setValidationError: (field: string, message: string) => void;
  /** 認証エラーかどうか */
  isAuthError: boolean;
}

/**
 * useErrorHandlerのオプション
 */
export interface UseErrorHandlerOptions {
  /** エラーを自動的にクリアするまでの時間（ミリ秒）、0で無効 */
  autoClearAfter?: number;
  /** エラー発生時のコールバック */
  onError?: (error: AppError) => void;
  /** エラークリア時のコールバック */
  onClear?: () => void;
}

/**
 * 初期エラー状態
 */
const initialErrorState: ErrorState = {
  hasError: false,
  error: null,
  message: null,
  code: null,
  isRetryable: false,
};

/**
 * エラーハンドリングフック
 *
 * 使用例:
 * ```tsx
 * function LoginScreen() {
 *   const { errorState, setError, clearError, handleAsync } = useErrorHandler({
 *     autoClearAfter: 5000,
 *     onError: (error) => console.log('Error occurred:', error.code),
 *   });
 *
 *   const handleLogin = async () => {
 *     const result = await handleAsync(
 *       () => auth.signIn(email, password),
 *       'ログイン処理'
 *     );
 *     if (result) {
 *       // Success
 *       navigation.navigate('Home');
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       {errorState.hasError && (
 *         <ErrorBanner
 *           message={errorState.message}
 *           onDismiss={clearError}
 *           showRetry={errorState.isRetryable}
 *         />
 *       )}
 *       <Button onPress={handleLogin}>ログイン</Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useErrorHandler(
  options: UseErrorHandlerOptions = {}
): UseErrorHandlerReturn {
  const { autoClearAfter = 0, onError, onClear } = options;

  const [errorState, setErrorState] = useState<ErrorState>(initialErrorState);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  /**
   * エラーを設定
   */
  const setError = useCallback(
    (error: unknown, context?: string) => {
      // Cancel any pending auto-clear
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }

      // Normalize the error
      const normalizedError = normalizeError(error);

      // Handle error (log & report)
      handleError(error, context);

      // Update state
      setErrorState({
        hasError: true,
        error: normalizedError,
        message: normalizedError.userMessage,
        code: normalizedError.code,
        isRetryable: isRetryableError(normalizedError),
      });

      // Call onError callback
      onError?.(normalizedError);

      // Set auto-clear timeout if configured
      if (autoClearAfter > 0) {
        clearTimeoutRef.current = setTimeout(() => {
          setErrorState(initialErrorState);
          onClear?.();
        }, autoClearAfter);
      }
    },
    [autoClearAfter, onError, onClear]
  );

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    // Cancel any pending auto-clear
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }

    setErrorState(initialErrorState);
    onClear?.();
  }, [onClear]);

  /**
   * エラーハンドリング付きで非同期関数を実行
   */
  const handleAsync = useCallback(
    async <T>(fn: () => Promise<T>, context?: string): Promise<T | null> => {
      // Clear previous error
      clearError();

      const result = await withErrorHandling(fn, context);

      if (result.error) {
        setErrorState({
          hasError: true,
          error: result.error,
          message: result.error.userMessage,
          code: result.error.code,
          isRetryable: isRetryableError(result.error),
        });

        // Call onError callback
        onError?.(result.error);

        // Set auto-clear timeout if configured
        if (autoClearAfter > 0) {
          clearTimeoutRef.current = setTimeout(() => {
            setErrorState(initialErrorState);
            onClear?.();
          }, autoClearAfter);
        }

        return null;
      }

      return result.data;
    },
    [clearError, autoClearAfter, onError, onClear]
  );

  /**
   * バリデーションエラーを設定
   */
  const setValidationError = useCallback(
    (field: string, message: string) => {
      const validationError = new ValidationError(
        ErrorCode.VALIDATION_FORMAT,
        field,
        message
      );

      setErrorState({
        hasError: true,
        error: validationError,
        message: validationError.userMessage,
        code: validationError.code,
        isRetryable: false,
      });

      // Call onError callback
      onError?.(validationError);

      // Set auto-clear timeout if configured
      if (autoClearAfter > 0) {
        clearTimeoutRef.current = setTimeout(() => {
          setErrorState(initialErrorState);
          onClear?.();
        }, autoClearAfter);
      }
    },
    [autoClearAfter, onError, onClear]
  );

  /**
   * 認証エラーかどうかを判定
   */
  const isAuthError = errorState.error
    ? isAuthenticationError(errorState.error)
    : false;

  return {
    errorState,
    setError,
    clearError,
    handleAsync,
    setValidationError,
    isAuthError,
  };
}

/**
 * 複数フィールドのバリデーションエラー管理フック
 *
 * フォームバリデーションなど、複数のフィールドに対する
 * エラー管理を行う場合に使用します。
 *
 * 使用例:
 * ```tsx
 * function RegistrationForm() {
 *   const { errors, setFieldError, clearFieldError, clearAllErrors, hasErrors } =
 *     useFormErrors();
 *
 *   const validateEmail = (email: string) => {
 *     if (!email) {
 *       setFieldError('email', 'メールアドレスを入力してください');
 *       return false;
 *     }
 *     if (!isValidEmail(email)) {
 *       setFieldError('email', 'メールアドレスの形式が正しくありません');
 *       return false;
 *     }
 *     clearFieldError('email');
 *     return true;
 *   };
 *
 *   return (
 *     <View>
 *       <TextInput
 *         placeholder="メールアドレス"
 *         onChangeText={(text) => validateEmail(text)}
 *       />
 *       {errors.email && <Text style={{ color: 'red' }}>{errors.email}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * フィールドエラーを設定
   */
  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  /**
   * フィールドエラーをクリア
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * 全てのエラーをクリア
   */
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * 複数のエラーを一度に設定
   */
  const setMultipleErrors = useCallback(
    (newErrors: Record<string, string>) => {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    },
    []
  );

  /**
   * エラーが存在するかどうか
   */
  const hasErrors = Object.keys(errors).length > 0;

  /**
   * 特定のフィールドにエラーがあるかどうか
   */
  const hasFieldError = useCallback(
    (field: string) => {
      return field in errors;
    },
    [errors]
  );

  /**
   * 特定のフィールドのエラーメッセージを取得
   */
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      return errors[field];
    },
    [errors]
  );

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    setMultipleErrors,
    hasErrors,
    hasFieldError,
    getFieldError,
  };
}
