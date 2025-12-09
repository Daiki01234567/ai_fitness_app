/**
 * LoadingSpinner - Loading indicator component
 * Displays an activity indicator with optional message
 */

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

import { colors, spacing, typography } from "../../lib/theme";

/**
 * LoadingSpinner props interface
 */
export interface LoadingSpinnerProps {
  /** Optional message to display below the spinner */
  message?: string;
  /** Size of the spinner */
  size?: "small" | "large";
  /** Whether to display in full screen mode */
  fullScreen?: boolean;
  /** Custom color for the spinner */
  color?: string;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * LoadingSpinner component
 * Displays an activity indicator with optional loading message
 *
 * @example
 * ```tsx
 * // Simple spinner
 * <LoadingSpinner />
 *
 * // Full screen with message
 * <LoadingSpinner fullScreen message="Loading your workout..." />
 * ```
 */
export function LoadingSpinner({
  message,
  size = "large",
  fullScreen = false,
  color = colors.primary,
  style,
  testID,
}: LoadingSpinnerProps): React.ReactElement {
  const theme = useTheme();

  const content = (
    <>
      <ActivityIndicator
        size={size}
        color={color}
        accessibilityLabel={message || "Loading"}
        testID={testID ? `${testID}-indicator` : undefined}
      />
      {message && (
        <Text
          style={styles.message}
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-message` : undefined}
        >
          {message}
        </Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View
        style={[styles.fullScreen, style]}
        accessibilityRole="progressbar"
        accessibilityLabel={message || "Loading content"}
        accessibilityState={{ busy: true }}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={message || "Loading"}
      accessibilityState={{ busy: true }}
      testID={testID}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: "center",
  },
});

export default LoadingSpinner;
