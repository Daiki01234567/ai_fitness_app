/**
 * スコア推移折れ線グラフコンポーネント
 *
 * トレーニングスコアの推移を折れ線グラフで表示します。
 *
 * @see docs/expo/tickets/026-graph-view.md
 */

import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { Surface, Text } from "react-native-paper";
import { LineChart } from "react-native-chart-kit";

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
 * Chart data point
 */
export interface ScoreDataPoint {
  date: string;
  score: number;
}

/**
 * Props for ScoreLineChart component
 */
interface ScoreLineChartProps {
  /** スコアデータポイント */
  data: ScoreDataPoint[];
  /** グラフタイトル */
  title?: string;
}

/**
 * ScoreLineChart Component
 *
 * スコアの推移を折れ線グラフで表示します。
 *
 * @example
 * <ScoreLineChart
 *   data={[
 *     { date: "12/1", score: 75 },
 *     { date: "12/2", score: 82 },
 *   ]}
 *   title="スコア推移"
 * />
 */
export function ScoreLineChart({ data, title = "スコア推移" }: ScoreLineChartProps) {
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

  // Prepare chart data
  const labels = data.map((point) => point.date);
  const scores = data.map((point) => point.score);

  // Limit labels to avoid overcrowding
  const maxLabels = 7;
  const step = Math.ceil(labels.length / maxLabels);
  const displayLabels = labels.filter((_, index) => index % step === 0);

  const chartData = {
    labels: displayLabels,
    datasets: [
      {
        data: scores,
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Primary color
        strokeWidth: 2,
      },
    ],
    legend: [],
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
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: THEME_COLORS.primary,
    },
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
        <LineChart
          data={chartData}
          width={screenWidth}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          yAxisSuffix=""
          yAxisInterval={1}
          fromZero={false}
        />
      </View>
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: THEME_COLORS.primary }]} />
          <Text style={styles.legendText}>フォームスコア (0-100)</Text>
        </View>
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
    justifyContent: "center",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 12,
  },
});

export default ScoreLineChart;
