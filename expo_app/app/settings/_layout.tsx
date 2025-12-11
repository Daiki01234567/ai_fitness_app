/**
 * 設定関連画面のレイアウト
 *
 * 設定画面と通知設定画面のルーティングを管理します。
 * 設定画面にはAppbarでヘッダーを表示するため、headerShownはfalseに設定。
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md 3.13節
 * @see docs/expo/tickets/027-settings-screen.md
 * @see docs/expo/tickets/028-notification-settings.md
 */

import { Stack } from "expo-router";
import React from "react";

/**
 * Settings Layout Component
 *
 * Manages routing for settings-related screens:
 * - index: Main settings screen with training, notifications, account settings
 * - notifications: Detailed notification settings
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "設定",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: "通知設定",
        }}
      />
    </Stack>
  );
}
