/**
 * React Native グローバル型定義
 *
 * React Native固有のグローバル変数の型を定義します。
 */

/**
 * ErrorUtils - React Nativeのグローバルエラーハンドラー
 */
type ErrorHandler = (error: Error, isFatal?: boolean) => void;

interface ErrorUtilsInterface {
  setGlobalHandler: (handler: ErrorHandler) => void;
  getGlobalHandler: () => ErrorHandler | null;
  reportFatalError: (error: Error) => void;
  reportError: (error: Error) => void;
}

declare global {
  const ErrorUtils: ErrorUtilsInterface;

  /**
   * __DEV__ - 開発環境フラグ
   * Metro bundlerによって設定される
   */
  const __DEV__: boolean;

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace globalThis {
    // ErrorUtils may not be defined in all environments (e.g., web)
    // eslint-disable-next-line no-var
    var ErrorUtils: ErrorUtilsInterface | undefined;
  }
}

export {};
