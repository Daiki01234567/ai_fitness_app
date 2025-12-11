/**
 * Training Stack Layout
 *
 * Contains exercise detail, camera setup, training session, result, and test screens.
 *
 * Training Flow:
 * Menu -> Exercise Detail -> Camera Setup -> Training Session -> Result
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/expo/tickets/021-training-screen.md
 * @see docs/expo/tickets/022-session-result-screen.md
 */

import { Stack } from "expo-router";

export default function TrainingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "戻る",
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#212121",
      }}
    >
      {/* Exercise Detail Screen (Dynamic Route) */}
      <Stack.Screen
        name="[exerciseType]"
        options={{
          title: "種目詳細",
          headerBackTitle: "戻る",
        }}
      />

      {/* Camera Setup Screen */}
      <Stack.Screen
        name="setup"
        options={{
          title: "カメラ設定",
          headerShown: false, // Full screen camera view
          gestureEnabled: true, // Allow going back to exercise detail
        }}
      />

      {/* Training Session Screen */}
      <Stack.Screen
        name="session"
        options={{
          title: "トレーニング",
          headerShown: false, // Full screen camera view
          gestureEnabled: false, // Prevent accidental swipe back
        }}
      />

      {/* Session Result Screen */}
      <Stack.Screen
        name="result"
        options={{
          title: "トレーニング結果",
          headerShown: false,
          gestureEnabled: false, // Prevent going back to session
        }}
      />

      {/* Camera Test Screen (for development) */}
      <Stack.Screen
        name="camera-test"
        options={{
          title: "カメラテスト",
          headerBackTitle: "戻る",
        }}
      />

      {/* Pose Detection Test Screen (for development) */}
      <Stack.Screen
        name="pose-detection-test"
        options={{
          title: "姿勢検出テスト",
          headerBackTitle: "戻る",
        }}
      />
    </Stack>
  );
}
