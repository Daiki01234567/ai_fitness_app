/**
 * エラーフォールバック画面
 *
 * Error Boundaryでエラーが捕捉された際に表示する
 * ユーザーフレンドリーなエラー画面です。
 *
 * @see CLAUDE.md - エラーハンドリング要件
 */

import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  useTheme,
  Icon,
} from "react-native-paper";

import { AppError, isNetworkError, isAuthError } from "@/lib/errors";
import { isRetryableError, isAuthenticationError } from "@/lib/errorHandler";

/**
 * ErrorFallbackScreenのprops
 */
export interface ErrorFallbackScreenProps {
  /** エラーオブジェクト */
  error: AppError;
  /** 再試行コールバック */
  onRetry?: () => void;
  /** ホームに戻るコールバック */
  onGoHome?: () => void;
  /** ログアウトコールバック（認証エラー時） */
  onLogout?: () => void;
  /** デバッグ情報を表示するか */
  showDebugInfo?: boolean;
}

/**
 * エラーアイコンのマッピング
 */
function getErrorIcon(error: AppError): string {
  if (isNetworkError(error)) {
    return "wifi-off";
  }
  if (isAuthError(error)) {
    return "account-alert";
  }
  return "alert-circle";
}

/**
 * エラーの色を取得
 */
function getErrorColor(error: AppError): string {
  if (isNetworkError(error)) {
    return "#FF9800"; // Orange for network errors
  }
  if (isAuthError(error)) {
    return "#F44336"; // Red for auth errors
  }
  return "#F44336"; // Default red
}

/**
 * エラーフォールバック画面コンポーネント
 *
 * 使用例:
 * ```tsx
 * <ErrorFallbackScreen
 *   error={normalizedError}
 *   onRetry={() => refetch()}
 *   onGoHome={() => navigation.navigate('Home')}
 *   showDebugInfo={__DEV__}
 * />
 * ```
 */
export function ErrorFallbackScreen({
  error,
  onRetry,
  onGoHome,
  onLogout,
  showDebugInfo = __DEV__,
}: ErrorFallbackScreenProps): React.ReactElement {
  const theme = useTheme();
  const isRetryable = isRetryableError(error);
  const isAuth = isAuthenticationError(error);
  const iconName = getErrorIcon(error);
  const errorColor = getErrorColor(error);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Error Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${errorColor}20` }]}>
            <Icon source={iconName} size={64} color={errorColor} />
          </View>

          {/* Error Title */}
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            {isNetworkError(error)
              ? "接続エラー"
              : isAuth
                ? "認証エラー"
                : "エラーが発生しました"}
          </Text>

          {/* User Message */}
          <Text
            variant="bodyLarge"
            style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
          >
            {error.userMessage}
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {isRetryable && onRetry && (
              <Button
                mode="contained"
                onPress={onRetry}
                style={styles.button}
                icon="refresh"
              >
                再試行
              </Button>
            )}

            {isAuth && onLogout && (
              <Button
                mode="contained"
                onPress={onLogout}
                style={styles.button}
                icon="logout"
              >
                ログアウト
              </Button>
            )}

            {onGoHome && (
              <Button
                mode="outlined"
                onPress={onGoHome}
                style={styles.button}
                icon="home"
              >
                ホームに戻る
              </Button>
            )}

            {!isRetryable && !isAuth && onRetry && (
              <Button
                mode="contained"
                onPress={onRetry}
                style={styles.button}
                icon="refresh"
              >
                もう一度試す
              </Button>
            )}
          </View>

          {/* Debug Info (Development Only) */}
          {showDebugInfo && (
            <Surface style={styles.debugContainer} elevation={1}>
              <Text variant="labelMedium" style={styles.debugTitle}>
                デバッグ情報
              </Text>
              <View style={styles.debugRow}>
                <Text variant="bodySmall" style={styles.debugLabel}>
                  エラーコード:
                </Text>
                <Text variant="bodySmall" style={styles.debugValue}>
                  {error.code}
                </Text>
              </View>
              <View style={styles.debugRow}>
                <Text variant="bodySmall" style={styles.debugLabel}>
                  エラー名:
                </Text>
                <Text variant="bodySmall" style={styles.debugValue}>
                  {error.name}
                </Text>
              </View>
              <View style={styles.debugRow}>
                <Text variant="bodySmall" style={styles.debugLabel}>
                  発生時刻:
                </Text>
                <Text variant="bodySmall" style={styles.debugValue}>
                  {error.timestamp.toLocaleString("ja-JP")}
                </Text>
              </View>
              {error.originalError && (
                <View style={styles.debugRow}>
                  <Text variant="bodySmall" style={styles.debugLabel}>
                    元のエラー:
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={styles.debugValue}
                    numberOfLines={3}
                  >
                    {error.originalError.message}
                  </Text>
                </View>
              )}
            </Surface>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * コンパクトなエラー表示コンポーネント
 *
 * 画面全体ではなく、特定の領域内でエラーを表示する場合に使用します。
 *
 * 使用例:
 * ```tsx
 * {errorState.hasError && (
 *   <ErrorBanner
 *     message={errorState.message}
 *     onDismiss={clearError}
 *     showRetry={errorState.isRetryable}
 *     onRetry={handleRetry}
 *   />
 * )}
 * ```
 */
export interface ErrorBannerProps {
  /** エラーメッセージ */
  message: string | null;
  /** 閉じるコールバック */
  onDismiss?: () => void;
  /** 再試行ボタンを表示するか */
  showRetry?: boolean;
  /** 再試行コールバック */
  onRetry?: () => void;
  /** スタイル */
  style?: object;
}

export function ErrorBanner({
  message,
  onDismiss,
  showRetry = false,
  onRetry,
  style,
}: ErrorBannerProps): React.ReactElement | null {
  const theme = useTheme();

  if (!message) {
    return null;
  }

  return (
    <Surface
      style={[
        styles.bannerContainer,
        { backgroundColor: theme.colors.errorContainer },
        style,
      ]}
      elevation={2}
    >
      <View style={styles.bannerContent}>
        <Icon source="alert-circle" size={20} color={theme.colors.error} />
        <Text
          variant="bodyMedium"
          style={[styles.bannerMessage, { color: theme.colors.onErrorContainer }]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
      <View style={styles.bannerActions}>
        {showRetry && onRetry && (
          <Button
            mode="text"
            compact
            onPress={onRetry}
            textColor={theme.colors.error}
          >
            再試行
          </Button>
        )}
        {onDismiss && (
          <Button
            mode="text"
            compact
            onPress={onDismiss}
            textColor={theme.colors.onErrorContainer}
          >
            閉じる
          </Button>
        )}
      </View>
    </Surface>
  );
}

/**
 * インラインエラーテキストコンポーネント
 *
 * フォームフィールドの下などに表示する小さなエラーメッセージです。
 *
 * 使用例:
 * ```tsx
 * <TextInput label="メールアドレス" error={!!errors.email} />
 * <ErrorText message={errors.email} />
 * ```
 */
export interface ErrorTextProps {
  /** エラーメッセージ */
  message?: string | null;
  /** スタイル */
  style?: object;
}

export function ErrorText({
  message,
  style,
}: ErrorTextProps): React.ReactElement | null {
  const theme = useTheme();

  if (!message) {
    return null;
  }

  return (
    <View style={[styles.errorTextContainer, style]}>
      <Icon source="alert-circle-outline" size={14} color={theme.colors.error} />
      <Text
        variant="bodySmall"
        style={[styles.errorText, { color: theme.colors.error }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  message: {
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
    gap: 12,
  },
  button: {
    width: "100%",
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    width: "100%",
    maxWidth: 400,
  },
  debugTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  debugRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  debugLabel: {
    fontWeight: "500",
    marginRight: 8,
    minWidth: 80,
  },
  debugValue: {
    flex: 1,
  },
  // Banner styles
  bannerContainer: {
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bannerMessage: {
    flex: 1,
  },
  bannerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 8,
  },
  // Error text styles
  errorTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
  },
});
