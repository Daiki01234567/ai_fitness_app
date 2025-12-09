/**
 * AppButton - Common button component
 * Wraps React Native Paper Button with predefined variants
 */

import React from "react";
import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Button, ButtonProps, useTheme } from "react-native-paper";

import { colors } from "../../lib/theme";

/**
 * Button variant types
 */
export type ButtonVariant = "primary" | "secondary" | "text" | "danger";

/**
 * AppButton props interface
 */
export interface AppButtonProps extends Omit<ButtonProps, "mode" | "theme"> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Whether the button should take full width */
  fullWidth?: boolean;
  /** Custom button style */
  style?: ViewStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
}

/**
 * Minimum touch target size for accessibility (44x44 per WCAG guidelines)
 */
const MIN_TOUCH_TARGET = 44;

/**
 * AppButton component
 * A themed button component with multiple variants
 *
 * @example
 * ```tsx
 * <AppButton variant="primary" onPress={() => {}}>
 *   Submit
 * </AppButton>
 * ```
 */
export function AppButton({
  variant = "primary",
  fullWidth = false,
  style,
  labelStyle,
  disabled,
  children,
  accessibilityLabel,
  ...props
}: AppButtonProps): React.ReactElement {
  const theme = useTheme();

  /**
   * Get button mode based on variant
   */
  const getMode = (): ButtonProps["mode"] => {
    switch (variant) {
      case "primary":
      case "danger":
        return "contained";
      case "secondary":
        return "outlined";
      case "text":
        return "text";
      default:
        return "contained";
    }
  };

  /**
   * Get button color based on variant
   */
  const getButtonColor = (): string | undefined => {
    if (disabled) {
      return undefined;
    }
    switch (variant) {
      case "primary":
        return colors.primary;
      case "danger":
        return colors.error;
      case "secondary":
        return undefined; // Uses outline style
      case "text":
        return undefined; // Uses theme default
      default:
        return colors.primary;
    }
  };

  /**
   * Get text color based on variant
   */
  const getTextColor = (): string | undefined => {
    if (disabled) {
      return colors.textDisabled;
    }
    switch (variant) {
      case "primary":
      case "danger":
        return colors.onPrimary;
      case "secondary":
        return colors.primary;
      case "text":
        return colors.primary;
      default:
        return colors.onPrimary;
    }
  };

  return (
    <Button
      mode={getMode()}
      buttonColor={getButtonColor()}
      textColor={getTextColor()}
      disabled={disabled}
      style={[styles.button, fullWidth && styles.fullWidth, style]}
      contentStyle={styles.content}
      labelStyle={[styles.label, labelStyle]}
      accessibilityLabel={
        accessibilityLabel || (typeof children === "string" ? children : undefined)
      }
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      {...props}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  fullWidth: {
    width: "100%",
  },
  content: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default AppButton;
