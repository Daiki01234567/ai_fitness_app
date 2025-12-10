/**
 * 履歴関連画面のレイアウト
 *
 * カレンダー画面やグラフ画面など、履歴関連の画面のルーティングを管理します。
 *
 * @see docs/expo/tickets/025-calendar-view.md
 * @see docs/expo/tickets/026-graph-view.md
 */

import { Stack } from "expo-router";
import React from "react";

/**
 * History Layout Component
 */
export default function HistoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="calendar" />
      <Stack.Screen name="graph" />
    </Stack>
  );
}
