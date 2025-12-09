/**
 * Theme configuration for the AI Fitness App
 * Based on Material Design 3 guidelines
 */

import { MD3LightTheme, MD3DarkTheme, configureFonts } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";

/**
 * Color palette following Material Design 3
 */
export const colors = {
  // Primary colors
  primary: "#4CAF50",
  primaryContainer: "#C8E6C9",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#1B5E20",

  // Secondary colors
  secondary: "#2196F3",
  secondaryContainer: "#BBDEFB",
  onSecondary: "#FFFFFF",
  onSecondaryContainer: "#0D47A1",

  // Error colors
  error: "#F44336",
  errorContainer: "#FFCDD2",
  onError: "#FFFFFF",
  onErrorContainer: "#B71C1C",

  // Success colors (same as primary for consistency)
  success: "#4CAF50",
  successContainer: "#C8E6C9",
  onSuccess: "#FFFFFF",
  onSuccessContainer: "#1B5E20",

  // Warning colors
  warning: "#FF9800",
  warningContainer: "#FFE0B2",
  onWarning: "#FFFFFF",
  onWarningContainer: "#E65100",

  // Background and surface colors
  background: "#FFFFFF",
  onBackground: "#212121",
  surface: "#FFFFFF",
  surfaceVariant: "#F5F5F5",
  onSurface: "#212121",
  onSurfaceVariant: "#757575",

  // Text colors
  textPrimary: "#212121",
  textSecondary: "#757575",
  textDisabled: "#BDBDBD",

  // Outline and divider
  outline: "#E0E0E0",
  outlineVariant: "#EEEEEE",

  // Elevation overlay (for dark theme)
  elevation: {
    level0: "transparent",
    level1: "#FAFAFA",
    level2: "#F5F5F5",
    level3: "#EEEEEE",
    level4: "#E0E0E0",
    level5: "#BDBDBD",
  },
} as const;

/**
 * Dark mode color palette
 */
export const darkColors = {
  ...colors,
  primary: "#81C784",
  primaryContainer: "#1B5E20",
  onPrimary: "#1B5E20",
  onPrimaryContainer: "#C8E6C9",

  secondary: "#64B5F6",
  secondaryContainer: "#0D47A1",
  onSecondary: "#0D47A1",
  onSecondaryContainer: "#BBDEFB",

  background: "#121212",
  onBackground: "#FFFFFF",
  surface: "#1E1E1E",
  surfaceVariant: "#2C2C2C",
  onSurface: "#FFFFFF",
  onSurfaceVariant: "#BDBDBD",

  textPrimary: "#FFFFFF",
  textSecondary: "#BDBDBD",
  textDisabled: "#757575",

  outline: "#424242",
  outlineVariant: "#303030",

  elevation: {
    level0: "transparent",
    level1: "#1E1E1E",
    level2: "#232323",
    level3: "#282828",
    level4: "#2C2C2C",
    level5: "#323232",
  },
} as const;

/**
 * Spacing scale following 8px base unit
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Border radius scale
 */
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Font configuration for Material Design 3
 */
const fontConfig = {
  displayLarge: {
    fontFamily: "System",
    fontSize: 57,
    fontWeight: "400" as const,
    letterSpacing: -0.25,
    lineHeight: 64,
  },
  displayMedium: {
    fontFamily: "System",
    fontSize: 45,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 52,
  },
  displaySmall: {
    fontFamily: "System",
    fontSize: 36,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 44,
  },
  headlineLarge: {
    fontFamily: "System",
    fontSize: 32,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 40,
  },
  headlineMedium: {
    fontFamily: "System",
    fontSize: 28,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 36,
  },
  headlineSmall: {
    fontFamily: "System",
    fontSize: 24,
    fontWeight: "700" as const,
    letterSpacing: 0,
    lineHeight: 32,
  },
  titleLarge: {
    fontFamily: "System",
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: 0,
    lineHeight: 28,
  },
  titleMedium: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.15,
    lineHeight: 24,
  },
  titleSmall: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "600" as const,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  bodyLarge: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: 0.25,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  labelLarge: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  labelMedium: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  labelSmall: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
};

/**
 * Typography scale for custom use
 */
export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: "700" as const,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
  },
} as const;

/**
 * Light theme configuration
 */
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryContainer,
    onPrimary: colors.onPrimary,
    onPrimaryContainer: colors.onPrimaryContainer,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryContainer,
    onSecondary: colors.onSecondary,
    onSecondaryContainer: colors.onSecondaryContainer,
    error: colors.error,
    errorContainer: colors.errorContainer,
    onError: colors.onError,
    onErrorContainer: colors.onErrorContainer,
    background: colors.background,
    onBackground: colors.onBackground,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    onSurface: colors.onSurface,
    onSurfaceVariant: colors.onSurfaceVariant,
    outline: colors.outline,
    outlineVariant: colors.outlineVariant,
    elevation: colors.elevation,
  },
  fonts: configureFonts({ config: fontConfig }),
};

/**
 * Dark theme configuration
 */
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary,
    primaryContainer: darkColors.primaryContainer,
    onPrimary: darkColors.onPrimary,
    onPrimaryContainer: darkColors.onPrimaryContainer,
    secondary: darkColors.secondary,
    secondaryContainer: darkColors.secondaryContainer,
    onSecondary: darkColors.onSecondary,
    onSecondaryContainer: darkColors.onSecondaryContainer,
    error: colors.error,
    errorContainer: colors.errorContainer,
    onError: colors.onError,
    onErrorContainer: colors.onErrorContainer,
    background: darkColors.background,
    onBackground: darkColors.onBackground,
    surface: darkColors.surface,
    surfaceVariant: darkColors.surfaceVariant,
    onSurface: darkColors.onSurface,
    onSurfaceVariant: darkColors.onSurfaceVariant,
    outline: darkColors.outline,
    outlineVariant: darkColors.outlineVariant,
    elevation: darkColors.elevation,
  },
  fonts: configureFonts({ config: fontConfig }),
};

/**
 * Default theme export (light theme)
 */
export const theme = lightTheme;

/**
 * Type exports
 */
export type AppTheme = typeof lightTheme;
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Typography = typeof typography;
