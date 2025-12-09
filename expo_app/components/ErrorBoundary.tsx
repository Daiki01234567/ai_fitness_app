/**
 * React Error Boundary
 *
 * Reactコンポーネントツリー内で発生した未処理エラーを捕捉し、
 * ユーザーフレンドリーなフォールバックUIを表示します。
 *
 * @see CLAUDE.md - エラーハンドリング要件
 */

import React, { Component, ErrorInfo, ReactNode } from "react";

import { AppError, ErrorCode } from "@/lib/errors";
import { normalizeError, logError, reportError } from "@/lib/errorHandler";

import { ErrorFallbackScreen } from "./ErrorFallbackScreen";

/**
 * Error Boundaryのprops
 */
export interface ErrorBoundaryProps {
  /** 子コンポーネント */
  children: ReactNode;
  /** カスタムフォールバックUI */
  fallback?: ReactNode | ((error: AppError, reset: () => void) => ReactNode);
  /** エラー発生時のコールバック */
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  /** リセット時のコールバック */
  onReset?: () => void;
}

/**
 * Error Boundaryのstate
 */
interface ErrorBoundaryState {
  /** エラーが発生したか */
  hasError: boolean;
  /** 正規化されたエラー */
  error: AppError | null;
  /** Reactのエラー情報 */
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary クラスコンポーネント
 *
 * 使用例:
 * ```tsx
 * function App() {
 *   return (
 *     <ErrorBoundary
 *       onError={(error) => console.log('Error caught:', error.code)}
 *       onReset={() => console.log('Reset triggered')}
 *     >
 *       <MainContent />
 *     </ErrorBoundary>
 *   );
 * }
 *
 * // カスタムフォールバックUI
 * function App() {
 *   return (
 *     <ErrorBoundary
 *       fallback={(error, reset) => (
 *         <CustomErrorScreen error={error} onRetry={reset} />
 *       )}
 *     >
 *       <MainContent />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * エラーから派生した状態を取得
   * Reactのライフサイクルメソッド
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Normalize the error
    const normalizedError = normalizeError(error);

    return {
      hasError: true,
      error: normalizedError,
    };
  }

  /**
   * エラーをキャッチした後の処理
   * Reactのライフサイクルメソッド
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const normalizedError = normalizeError(error);

    // Update state with error info
    this.setState({ errorInfo });

    // Log the error
    logError(normalizedError, "React Error Boundary");

    // Report to Crashlytics
    reportError(normalizedError, "React Error Boundary");

    // Call onError callback
    this.props.onError?.(normalizedError, errorInfo);

    // Log component stack in development
    if (__DEV__ && errorInfo.componentStack) {
      console.error("Component Stack:", errorInfo.componentStack);
    }
  }

  /**
   * エラー状態をリセット
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // カスタムフォールバックが関数として提供されている場合
      if (typeof fallback === "function") {
        return fallback(error, this.handleReset);
      }

      // カスタムフォールバックがReactNodeとして提供されている場合
      if (fallback) {
        return fallback;
      }

      // デフォルトのフォールバックUI
      return <ErrorFallbackScreen error={error} onRetry={this.handleReset} />;
    }

    return children;
  }
}

/**
 * Error Boundaryのラッパーフック
 *
 * 関数コンポーネントからError Boundaryの状態をリセットする
 * トリガーを提供します。
 *
 * 使用例:
 * ```tsx
 * function App() {
 *   const { ErrorBoundaryWrapper, resetErrorBoundary } = useErrorBoundary();
 *
 *   return (
 *     <ErrorBoundaryWrapper>
 *       <Button onPress={resetErrorBoundary}>リセット</Button>
 *       <MainContent />
 *     </ErrorBoundaryWrapper>
 *   );
 * }
 * ```
 */
export function useErrorBoundary() {
  const errorBoundaryRef = React.useRef<ErrorBoundary>(null);

  const resetErrorBoundary = React.useCallback(() => {
    errorBoundaryRef.current?.handleReset();
  }, []);

  const ErrorBoundaryWrapper = React.useCallback(
    ({
      children,
      ...props
    }: Omit<ErrorBoundaryProps, "children"> & { children: ReactNode }) => (
      <ErrorBoundary ref={errorBoundaryRef} {...props}>
        {children}
      </ErrorBoundary>
    ),
    []
  );

  return {
    ErrorBoundaryWrapper,
    resetErrorBoundary,
  };
}

/**
 * 特定のエラーコードを無視するError Boundary
 *
 * 指定したエラーコードの場合は通常通りスローし、
 * それ以外のエラーのみを捕捉します。
 */
export class SelectiveErrorBoundary extends Component<
  ErrorBoundaryProps & { ignoreErrorCodes?: string[] },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { ignoreErrorCodes?: string[] }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const normalizedError = normalizeError(error);
    return {
      hasError: true,
      error: normalizedError,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const normalizedError = normalizeError(error);
    const { ignoreErrorCodes = [] } = this.props;

    // Check if this error should be ignored
    if (ignoreErrorCodes.includes(normalizedError.code)) {
      // Re-throw the error to let it propagate
      throw error;
    }

    this.setState({ errorInfo });
    logError(normalizedError, "Selective Error Boundary");
    reportError(normalizedError, "Selective Error Boundary");
    this.props.onError?.(normalizedError, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, ignoreErrorCodes = [] } = this.props;

    // Check if error should be ignored
    if (hasError && error && ignoreErrorCodes.includes(error.code)) {
      return children;
    }

    if (hasError && error) {
      if (typeof fallback === "function") {
        return fallback(error, this.handleReset);
      }
      if (fallback) {
        return fallback;
      }
      return <ErrorFallbackScreen error={error} onRetry={this.handleReset} />;
    }

    return children;
  }
}
