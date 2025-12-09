/**
 * ErrorMessage - Error display component
 * Shows an error message with an icon and optional retry button
 */

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, spacing, typography, borderRadius } from "../../lib/theme";
import { AppButton } from "./AppButton";

/**
 * ErrorMessage props interface
 */
export interface ErrorMessageProps {
  /** Error message to display */
  message: string;
  /** Optional callback for retry action */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Whether to show as inline or full container */
  inline?: boolean;
  /** Custom icon name */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * ErrorMessage component
 * Displays an error message with an icon and optional retry button
 *
 * @example
 * ```tsx
 * // Simple error
 * <ErrorMessage message="Something went wrong" />
 *
 * // With retry
 * <ErrorMessage
 *   message="Failed to load data"
 *   onRetry={() => refetch()}
 *   retryText="Try Again"
 * />
 * ```
 */
export function ErrorMessage({
  message,
  onRetry,
  retryText = "Retry",
  inline = false,
  icon = "alert-circle",
  style,
  testID,
}: ErrorMessageProps): React.ReactElement {
  const theme = useTheme();

  if (inline) {
    return (
      <View
        style={[styles.inlineContainer, style]}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        testID={testID}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={colors.error}
          accessibilityLabel="Error icon"
        />
        <Text
          style={styles.inlineMessage}
          testID={testID ? `${testID}-message` : undefined}
        >
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID={testID}
    >
      <MaterialCommunityIcons
        name={icon}
        size={48}
        color={colors.error}
        accessibilityLabel="Error icon"
      />
      <Text
        style={styles.message}
        testID={testID ? `${testID}-message` : undefined}
      >
        {message}
      </Text>
      {onRetry && (
        <AppButton
          variant="secondary"
          onPress={onRetry}
          accessibilityLabel={retryText}
          accessibilityHint="Tap to try again"
          testID={testID ? `${testID}-retry-button` : undefined}
        >
          {retryText}
        </AppButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.sm,
  },
  message: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    textAlign: "center",
    maxWidth: "80%",
  },
  inlineMessage: {
    marginLeft: spacing.sm,
    fontSize: typography.caption.fontSize,
    color: colors.error,
    flex: 1,
  },
});

export default ErrorMessage;
