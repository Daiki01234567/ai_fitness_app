/**
 * タブナビゲーションレイアウト
 *
 * メインアプリのタブナビゲーションを定義します。
 * Material Design 3準拠のボトムナビゲーションを実装。
 *
 * タブ構成:
 * - ホーム: 今日のトレーニング概要、クイックスタート
 * - トレーニング: 種目選択、トレーニング開始
 * - 履歴: 過去のトレーニング記録
 * - プロフィール: ユーザー情報、同意管理、設定への遷移
 *
 * 注: 設定画面は /settings に移動し、プロフィール画面から遷移します。
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md 1.2節
 * @see docs/expo/tickets/010-bottom-navigation.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";

/**
 * Theme colors following Material Design 3 guidelines
 */
const THEME_COLORS = {
  primary: "#4CAF50", // Green - Active tab color
  inactive: "#999999", // Gray - Inactive tab color
  backgroundLight: "#FFFFFF",
  backgroundDark: "#121212",
  textLight: "#212121",
  textDark: "#FFFFFF",
  borderLight: "#E0E0E0",
  borderDark: "#333333",
};

/**
 * Tab bar icon component using MaterialCommunityIcons
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons
      size={props.size ?? 24}
      style={{ marginBottom: -3 }}
      {...props}
    />
  );
}

/**
 * Tab layout component
 *
 * Configures the bottom navigation with 4 tabs:
 * - Home (ホーム): Dashboard and quick start
 * - Training (トレーニング): Exercise selection
 * - History (履歴): Training records
 * - Profile (プロフィール): User profile, consent management, settings navigation
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        // Tab bar styling - Material Design 3
        tabBarActiveTintColor: THEME_COLORS.primary,
        tabBarInactiveTintColor: THEME_COLORS.inactive,
        tabBarStyle: {
          backgroundColor: isDark
            ? THEME_COLORS.backgroundDark
            : THEME_COLORS.backgroundLight,
          borderTopColor: isDark
            ? THEME_COLORS.borderDark
            : THEME_COLORS.borderLight,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        // Header styling
        headerStyle: {
          backgroundColor: isDark
            ? THEME_COLORS.backgroundDark
            : THEME_COLORS.backgroundLight,
        },
        headerTintColor: isDark
          ? THEME_COLORS.textDark
          : THEME_COLORS.textLight,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "home" : "home-outline"}
              color={color}
            />
          ),
        }}
      />

      {/* Training Tab */}
      <Tabs.Screen
        name="training"
        options={{
          title: "トレーニング",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "dumbbell" : "dumbbell"}
              color={color}
            />
          ),
        }}
      />

      {/* History Tab */}
      <Tabs.Screen
        name="history"
        options={{
          title: "履歴",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "history" : "history"}
              color={color}
            />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "プロフィール",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "account" : "account-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
