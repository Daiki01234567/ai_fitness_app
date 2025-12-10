/**
 * LoadingOverlay - Modal-based loading overlay component
 * Displays a full-screen overlay with activity indicator and optional message
 */

import React from "react";
import { View, StyleSheet, Modal, ViewStyle } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

import { colors, spacing, borderRadius, typography } from "../../lib/theme";

/**
 * LoadingOverlay props interface
 */
export interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Optional message to display below the spinner */
  message?: string;
  /** Custom overlay background color */
  overlayColor?: string;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * LoadingOverlay component
 * A modal-based loading overlay that blocks user interaction while loading
 *
 * @example
 * ```tsx
 * const [loading, setLoading] = useState(false);
 *
 * return (
 *   <>
 *     <LoadingOverlay visible={loading} message="Saving your workout..." />
 *     <YourContent />
 *   </>
 * );
 * ```
 */
export function LoadingOverlay({
  visible,
  message,
  overlayColor = "rgba(0, 0, 0, 0.5)",
  containerStyle,
  testID,
}: LoadingOverlayProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent closing the modal by back button while loading
      }}
      accessibilityViewIsModal
      accessibilityLabel={message || "Loading"}
      testID={testID}
    >
      <View
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
      >
        <View style={[styles.content, containerStyle]}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
    minWidth: 120,
    maxWidth: 280,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.body.lineHeight,
  },
});

export default LoadingOverlay;
