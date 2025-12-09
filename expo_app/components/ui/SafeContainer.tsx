/**
 * SafeContainer - Safe area container component
 * Wraps content in SafeAreaView for proper padding on notched devices
 */

import React from "react";
import { StyleSheet, ViewStyle, StatusBar, Platform } from "react-native";
import {
  SafeAreaView,
  Edge,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { colors } from "../../lib/theme";

/**
 * SafeContainer props interface
 */
export interface SafeContainerProps {
  /** Container children */
  children: React.ReactNode;
  /** Custom container style */
  style?: ViewStyle;
  /** Background color */
  backgroundColor?: string;
  /** Which edges to apply safe area insets to */
  edges?: Edge[];
  /** Test ID for testing */
  testID?: string;
}

/**
 * SafeContainer component
 * Provides safe area padding for content on devices with notches or rounded corners
 *
 * @example
 * ```tsx
 * <SafeContainer>
 *   <Text>Content is safe from notches!</Text>
 * </SafeContainer>
 *
 * // With custom edges
 * <SafeContainer edges={['top', 'bottom']}>
 *   <Text>Only top and bottom are safe</Text>
 * </SafeContainer>
 * ```
 */
export function SafeContainer({
  children,
  style,
  backgroundColor = colors.background,
  edges = ["top", "bottom", "left", "right"],
  testID,
}: SafeContainerProps): React.ReactElement {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }, style]}
      edges={edges}
      testID={testID}
    >
      {children}
    </SafeAreaView>
  );
}

/**
 * Hook to get safe area insets
 * Useful for custom layouts that need to account for safe areas
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const insets = useSafeInsets();
 *   return (
 *     <View style={{ paddingTop: insets.top }}>
 *       <Text>Custom safe area handling</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useSafeInsets() {
  return useSafeAreaInsets();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeContainer;
