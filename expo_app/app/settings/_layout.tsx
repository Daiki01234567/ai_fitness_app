/**
 * 設定関連画面のレイアウト
 *
 * 通知設定画面など、設定関連の画面のルーティングを管理します。
 *
 * @see docs/expo/tickets/027-settings-screen.md
 * @see docs/expo/tickets/028-notification-settings.md
 */

import { Stack } from "expo-router";
import React from "react";

/**
 * Settings Layout Component
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
