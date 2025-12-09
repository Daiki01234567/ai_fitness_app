/**
 * AppTextInput - Common text input component
 * Wraps React Native Paper TextInput with error and helper text support
 */

import React, { forwardRef } from "react";
import { StyleSheet, View, ViewStyle, TextStyle } from "react-native";
import { TextInput, TextInputProps, HelperText, useTheme } from "react-native-paper";
import type { TextInput as RNTextInput } from "react-native";

import { colors, spacing } from "../../lib/theme";

/**
 * AppTextInput props interface
 */
export interface AppTextInputProps extends Omit<TextInputProps, "mode" | "error" | "theme"> {
  /** Error message to display below the input */
  errorMessage?: string;
  /** Helper text to display below the input */
  helperText?: string;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Custom input style */
  style?: TextStyle;
}

/**
 * AppTextInput component
 * A themed text input with support for error messages and helper text
 *
 * @example
 * ```tsx
 * <AppTextInput
 *   label="Email"
 *   value={email}
 *   onChangeText={setEmail}
 *   errorMessage={emailError}
 *   keyboardType="email-address"
 * />
 * ```
 */
export const AppTextInput = forwardRef<RNTextInput, AppTextInputProps>(
  function AppTextInput(
    {
      errorMessage,
      helperText,
      containerStyle,
      style,
      label,
      accessibilityLabel,
      ...props
    }: AppTextInputProps,
    ref
  ): React.ReactElement {
    const theme = useTheme();
    const hasError = !!errorMessage;
    const showHelperText = hasError || !!helperText;

    return (
      <View style={[styles.container, containerStyle]}>
        <TextInput
          ref={ref}
          mode="outlined"
          label={label}
          error={hasError}
          style={[styles.input, style]}
          outlineColor={colors.outline}
          activeOutlineColor={hasError ? colors.error : colors.primary}
          selectionColor={colors.primary}
          accessibilityLabel={
            accessibilityLabel || (typeof label === "string" ? label : undefined)
          }
          accessibilityState={{
            disabled: props.disabled,
          }}
          {...props}
        />
        {showHelperText && (
          <HelperText
            type={hasError ? "error" : "info"}
            visible={showHelperText}
            style={styles.helperText}
            accessibilityLiveRegion="polite"
          >
            {errorMessage || helperText}
          </HelperText>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
  },
  helperText: {
    marginTop: 0,
    paddingHorizontal: spacing.xs,
  },
});

export default AppTextInput;
