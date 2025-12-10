/**
 * Training Stack Layout
 *
 * Contains training session, result, and test screens.
 *
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
      }}
    >
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
