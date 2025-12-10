/**
 * 回数推移棒グラフコンポーネント
 *
 * 種目別のレップ数を棒グラフで表示します。
 *
 * @see docs/expo/tickets/026-graph-view.md
 */

import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { Surface, Text } from "react-native-paper";
import { BarChart } from "react-native-chart-kit";

import { getExerciseLabel, getExerciseColor } from "@/utils/exerciseUtils";
import { ExerciseType } from "@/types/exercise";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * Reps data point
 */
export interface RepsDataPoint {
  exerciseType: ExerciseType | string;
  reps: number;
}

/**
 * Props for RepsBarChart component
 */
interface RepsBarChartProps {
  /** レップ数データ */
  data: RepsDataPoint[];
  /** グラフタイトル */
  title?: string;
}

/**
 * RepsBarChart Component
 *
 * 種目別のレップ数を棒グラフで表示します。
 *
 * @example
 * <RepsBarChart
 *   data={[
 *     { exerciseType: "squat", reps: 50 },
 *     { exerciseType: "pushup", reps: 40 },
 *   ]}
 *   title="種目別レップ数"
 * />
 */
export function RepsBarChart({ data, title = "種目別レップ数" }: RepsBarChartProps) {
  const screenWidth = Dimensions.get("window").width - 64;

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>データがありません</Text>
        </View>
      </Surface>
    );
  }

  // Sort by reps descending
  const sortedData = [...data].sort((a, b) => b.reps - a.reps);

  // Prepare chart data
  const labels = sortedData.map((point) => {
    const label = getExerciseLabel(point.exerciseType);
    // Truncate long labels
    return label.length > 6 ? label.substring(0, 5) + "..." : label;
  });
  const reps = sortedData.map((point) => point.reps);

  const chartData = {
    labels,
    datasets: [
      {
        data: reps,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: THEME_COLORS.surface,
    backgroundGradientFrom: THEME_COLORS.surface,
    backgroundGradientTo: THEME_COLORS.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(117, 117, 117, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    barPercentage: 0.7,
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: "#E0E0E0",
      strokeWidth: 1,
    },
  };

  return (
    <Surface style={styles.card} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      <View style={styles.chartContainer}>
        <BarChart
          data={chartData}
          width={screenWidth}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix="回"
          withInnerLines={true}
          showValuesOnTopOfBars={true}
          fromZero={true}
        />
      </View>

      {/* Legend with exercise colors */}
      <View style={styles.legendContainer}>
        {sortedData.map((point, index) => (
          <View key={point.exerciseType} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: getExerciseColor(point.exerciseType) },
              ]}
            />
            <Text style={styles.legendText}>
              {getExerciseLabel(point.exerciseType)}: {point.reps}回
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: "center",
    marginLeft: -16,
  },
  chart: {
    borderRadius: 12,
  },
  emptyContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: THEME_COLORS.textSecondary,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 12,
  },
});

export default RepsBarChart;
