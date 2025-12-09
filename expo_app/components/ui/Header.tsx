/**
 * Header - Screen header component
 * Provides a consistent header with title, back button, and action buttons
 */

import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { Appbar, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";

import { colors, spacing } from "../../lib/theme";

/**
 * Header action button interface
 */
export interface HeaderAction {
  /** Icon name from MaterialCommunityIcons */
  icon: string;
  /** Callback when action is pressed */
  onPress: () => void;
  /** Accessibility label for the action */
  accessibilityLabel: string;
  /** Optional disabled state */
  disabled?: boolean;
}

/**
 * Header props interface
 */
export interface HeaderProps {
  /** Title text to display */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Whether to show back button */
  showBackButton?: boolean;
  /** Custom back button callback (overrides default navigation) */
  onBackPress?: () => void;
  /** Array of right action buttons */
  actions?: HeaderAction[];
  /** Background color */
  backgroundColor?: string;
  /** Whether to use elevated style */
  elevated?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Minimum touch target size for accessibility (44x44)
 */
const MIN_TOUCH_TARGET = 44;

/**
 * Header component
 * A consistent header for all screens with navigation and actions support
 *
 * @example
 * ```tsx
 * // Simple header
 * <Header title="Workout" />
 *
 * // With back button and actions
 * <Header
 *   title="Settings"
 *   showBackButton
 *   actions={[
 *     {
 *       icon: "cog",
 *       onPress: () => openSettings(),
 *       accessibilityLabel: "Open settings"
 *     }
 *   ]}
 * />
 * ```
 */
export function Header({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  actions = [],
  backgroundColor = colors.background,
  elevated = false,
  style,
  testID,
}: HeaderProps): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <Appbar.Header
      style={[
        styles.header,
        { backgroundColor },
        elevated && styles.elevated,
        style,
      ]}
      elevated={elevated}
      testID={testID}
      accessibilityRole="header"
    >
      {showBackButton && (
        <Appbar.BackAction
          onPress={handleBackPress}
          accessibilityLabel="Go back"
          accessibilityHint="Navigate to previous screen"
          accessibilityRole="button"
          size={24}
          style={styles.backButton}
          testID={testID ? `${testID}-back-button` : undefined}
        />
      )}

      <Appbar.Content
        title={title}
        subtitle={subtitle}
        titleStyle={styles.title}
        subtitleStyle={styles.subtitle}
        testID={testID ? `${testID}-content` : undefined}
      />

      {actions.map((action, index) => (
        <Appbar.Action
          key={`action-${index}`}
          icon={action.icon}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          disabled={action.disabled}
          size={24}
          style={styles.actionButton}
          testID={testID ? `${testID}-action-${index}` : undefined}
        />
      ))}
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  header: {
    elevation: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  elevated: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  actionButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default Header;
