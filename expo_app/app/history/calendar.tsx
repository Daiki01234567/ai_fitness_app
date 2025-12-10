/**
 * カレンダー画面
 *
 * トレーニング記録をカレンダー形式で表示する画面です。
 * 月別にトレーニング実施日を視覚的に確認でき、日付タップでその日の記録一覧を表示します。
 *
 * @see docs/expo/tickets/025-calendar-view.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import React, { useCallback } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Appbar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/history/CalendarView";
import { TrainingSession } from "@/services/training/historyService";
import { ExerciseType } from "@/types/exercise";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
};

/**
 * Mock data generator for month sessions
 * TODO: Replace with actual Firestore query
 */
function generateMockMonthSessions(month: string): TrainingSession[] {
  const exerciseTypes = Object.values(ExerciseType);
  const sessions: TrainingSession[] = [];

  const parts = month.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const monthNum = parts[1] ?? new Date().getMonth() + 1;
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // Generate random sessions for the month
  for (let day = 1; day <= daysInMonth; day++) {
    // 50% chance of having training on each day
    if (Math.random() > 0.5) {
      const numSessions = Math.floor(Math.random() * 3) + 1; // 1-3 sessions per day
      for (let i = 0; i < numSessions; i++) {
        const createdAt = new Date(year, monthNum - 1, day);
        createdAt.setHours(Math.floor(Math.random() * 12) + 8); // 8:00 - 20:00
        createdAt.setMinutes(Math.floor(Math.random() * 60));

        const randomExercise = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
        sessions.push({
          id: `session_${year}${monthNum}${day}_${i}`,
          exerciseType: randomExercise || ExerciseType.SQUAT,
          reps: Math.floor(Math.random() * 15) + 5,
          duration: Math.floor(Math.random() * 300) + 60,
          averageScore: Math.floor(Math.random() * 40) + 60,
          feedbacks: ["参考: 良いフォームです"],
          createdAt,
        });
      }
    }
  }

  return sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Fetch month sessions
 * TODO: Implement actual Firestore query
 */
async function fetchMonthSessions(month: string): Promise<TrainingSession[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return generateMockMonthSessions(month);
}

/**
 * CalendarScreen Component
 */
export default function CalendarScreen() {
  // Handle session press
  const handleSessionPress = useCallback((sessionId: string) => {
    // TODO: Navigate to session detail screen
    console.log("[CalendarScreen] Session pressed:", sessionId);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "カレンダー",
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="カレンダー" titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CalendarView
          fetchMonthSessions={fetchMonthSessions}
          onSessionPress={handleSessionPress}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    backgroundColor: THEME_COLORS.surface,
    elevation: 0,
  },
  headerTitle: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
});
