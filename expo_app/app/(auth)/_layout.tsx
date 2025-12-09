/**
 * 認証グループレイアウト
 *
 * 未認証ユーザー向けの画面グループです。
 * ログイン、サインアップ、パスワードリセット画面を含みます。
 */

import { Stack } from "expo-router";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

export default function AuthLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
        },
        headerTintColor: Colors[colorScheme ?? "light"].text,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        contentStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
        },
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: "ログイン",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: "新規登録",
          headerBackTitle: "戻る",
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: "パスワードをお忘れの方",
          headerBackTitle: "戻る",
        }}
      />
    </Stack>
  );
}
