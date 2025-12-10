/**
 * ユーティリティライブラリのエクスポート
 */

// Firebase Configuration
export {
  getFirebaseConfig,
  getEmulatorConfig,
  getEnvironment,
  getApiEndpoint,
  initializeFirebase,
  isFirebaseInitialized,
} from "./firebase";
export type { FirebaseConfig, EmulatorConfig } from "./firebase";

// Firebase App (provided by firebase.ts)
// Note: Use getAuth() from auth.ts instead of directly importing auth instance
export { app } from "./firebase";

// Firebase Auth
export {
  signInWithEmail,
  signUpWithEmail,
  signOut,
  resetPassword,
  signInWithGoogle,
  resendVerificationEmail,
  subscribeToAuthState,
  getCurrentUser,
  getAuth,
  getAuthErrorMessage,
  convertFirebaseUser,
  // Validation functions
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "./auth";
export type { AuthResult, ValidationResult } from "./auth";

// TanStack Query
export { queryClient } from "./queryClient";

// Logger
export { logger, createScopedLogger, LogLevel } from "./logger";
export type { Logger } from "./logger";

// Analytics
export {
  initAnalytics,
  logScreenView,
  logLogin,
  logSignUp,
  logTrainingStart,
  logTrainingComplete,
  logAppError,
  logEvent,
  setUserProperty,
  setAnalyticsUserId,
  isAnalyticsActive,
  AnalyticsEvents,
} from "./analytics";
export type {
  ScreenViewParams,
  LoginParams,
  SignUpParams,
  TrainingStartParams,
  TrainingCompleteParams,
  EventParams,
} from "./analytics";

// Crashlytics
export {
  initCrashlytics,
  setCrashlyticsEnabled,
  setCrashlyticsUserId,
  setCrashlyticsAttribute,
  setCrashlyticsAttributes,
  logCrashlyticsMessage,
  recordError,
  recordJsError,
  testCrash,
  isCrashlyticsEnabled,
  setupGlobalErrorHandler as setupCrashlyticsGlobalErrorHandler,
  setupUnhandledPromiseRejectionHandler,
} from "./crashlytics";
export type { UserAttributes } from "./crashlytics";

// Errors
export {
  AppError,
  AuthError,
  NetworkError,
  ValidationError,
  FirestoreError,
  StorageError,
  ErrorCode,
  errorMessages,
  getUserMessage,
  isAppError,
  isAuthError,
  isNetworkError,
  isValidationError,
  isFirestoreError,
  isStorageError,
} from "./errors";

// Error Handler
export {
  configureErrorHandler,
  normalizeError,
  logError,
  reportError,
  handleError,
  getErrorMessage,
  withErrorHandling,
  isRetryableError,
  isAuthenticationError,
  setupGlobalErrorHandler,
} from "./errorHandler";
export type { ErrorHandlerOptions } from "./errorHandler";

// Theme
export {
  theme,
  lightTheme,
  darkTheme,
  colors,
  darkColors,
  spacing,
  borderRadius,
  typography,
} from "./theme";

export type {
  AppTheme,
  Colors,
  Spacing,
  BorderRadius,
  Typography,
} from "./theme";

// Pose Detection Utilities
export * from "./pose";
