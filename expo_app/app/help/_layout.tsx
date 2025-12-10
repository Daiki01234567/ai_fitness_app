/**
 * ヘルプ関連画面のレイアウト
 *
 * ヘルプセンター、FAQ、お問い合わせなどの画面のルーティングを管理します。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

import { Stack } from "expo-router";
import React from "react";

/**
 * Help Layout Component
 */
export default function HelpLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="faq" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="guide" />
    </Stack>
  );
}
