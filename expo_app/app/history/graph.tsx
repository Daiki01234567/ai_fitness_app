/**
 * グラフ画面
 *
 * トレーニング記録をグラフ形式で表示する画面です。
 * スコア推移、種目別レップ数などを視覚的に確認できます。
 *
 * @see docs/expo/tickets/026-graph-view.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { Appbar, SegmentedButtons, Chip, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { GraphView, GraphData } from "@/components/history/GraphView";
import { ScoreDataPoint } from "@/components/history/ScoreLineChart";
import { RepsDataPoint } from "@/components/history/RepsBarChart";
import { ExerciseType } from "@/types/exercise";
import { getExerciseLabel, formatDateString } from "@/utils/exerciseUtils";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * Period filter type
 */
type PeriodFilter = "week" | "month" | "3months" | "all";

/**
 * Period labels
 */
const PERIOD_LABELS: Record<PeriodFilter, string> = {
  week: "今週",
  month: "今月",
  "3months": "3ヶ月",
  all: "全期間",
};

/**
 * Generate mock graph data
 * TODO: Replace with actual Firestore query
 */
function generateMockGraphData(period: PeriodFilter, exerciseFilter: string | null): GraphData {
  const exerciseTypes = exerciseFilter
    ? [exerciseFilter as ExerciseType]
    : Object.values(ExerciseType);

  // Determine date range
  let days: number;
  switch (period) {
    case "week":
      days = 7;
      break;
    case "month":
      days = 30;
      break;
    case "3months":
      days = 90;
      break;
    case "all":
    default:
      days = 180;
  }

  // Generate score data
  const scoreData: ScoreDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    if (Math.random() > 0.3) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      scoreData.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        score: Math.floor(Math.random() * 30) + 65, // 65-95
      });
    }
  }

  // Generate reps data by exercise type
  const repsData: RepsDataPoint[] = exerciseTypes.map((type) => ({
    exerciseType: type,
    reps: Math.floor(Math.random() * 100) + 20, // 20-120
  }));

  // Calculate stats
  const totalSessions = Math.floor(Math.random() * 20) + 5;
  const totalReps = repsData.reduce((sum, d) => sum + d.reps, 0);
  const totalMinutes = Math.floor(Math.random() * 200) + 30;
  const averageScore =
    scoreData.length > 0
      ? Math.round(scoreData.reduce((sum, d) => sum + d.score, 0) / scoreData.length)
      : 0;

  return {
    stats: {
      totalSessions,
      totalReps,
      totalMinutes,
      averageScore,
    },
    scoreData,
    repsData,
  };
}

/**
 * Fetch graph data
 * TODO: Implement actual Firestore query
 */
async function fetchGraphData(
  period: PeriodFilter,
  exerciseFilter: string | null
): Promise<GraphData> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return generateMockGraphData(period, exerciseFilter);
}

/**
 * GraphScreen Component
 */
export default function GraphScreen() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);

  // Fetch graph data
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["graph-data", periodFilter, exerciseFilter],
    queryFn: () => fetchGraphData(periodFilter, exerciseFilter),
  });

  // Handle period change
  const handlePeriodChange = useCallback((value: string) => {
    setPeriodFilter(value as PeriodFilter);
  }, []);

  // Handle exercise filter toggle
  const handleExerciseFilterToggle = useCallback((exerciseType: ExerciseType) => {
    setExerciseFilter((prev) => (prev === exerciseType ? null : exerciseType));
  }, []);

  // Period label for stats card
  const periodLabel = PERIOD_LABELS[periodFilter];

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "グラフ",
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="グラフ" titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Filter */}
        <View style={styles.filterSection}>
          <Text variant="labelMedium" style={styles.filterLabel}>
            期間
          </Text>
          <SegmentedButtons
            value={periodFilter}
            onValueChange={handlePeriodChange}
            buttons={[
              { value: "week", label: "週" },
              { value: "month", label: "月" },
              { value: "3months", label: "3ヶ月" },
              { value: "all", label: "全期間" },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* Exercise Filter */}
        <View style={styles.filterSection}>
          <Text variant="labelMedium" style={styles.filterLabel}>
            種目フィルター
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exerciseFilterContainer}
          >
            {Object.values(ExerciseType).map((type) => (
              <Chip
                key={type}
                selected={exerciseFilter === type}
                onPress={() => handleExerciseFilterToggle(type)}
                style={styles.exerciseChip}
                showSelectedCheck={false}
                mode={exerciseFilter === type ? "flat" : "outlined"}
              >
                {getExerciseLabel(type)}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Graph View */}
        <GraphView
          data={data || null}
          isLoading={isLoading}
          isError={isError}
          periodLabel={periodLabel}
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
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterLabel: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  exerciseFilterContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  exerciseChip: {
    marginRight: 4,
  },
});
