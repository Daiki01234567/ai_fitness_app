/**
 * グラフ表示コンポーネント
 *
 * トレーニング記録のグラフ表示を統合的に提供するコンポーネントです。
 * スコア推移折れ線グラフ、種目別レップ数棒グラフを表示します。
 *
 * @see docs/expo/tickets/026-graph-view.md
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { StatsCard, StatsData } from "./StatsCard";
import { ScoreLineChart, ScoreDataPoint } from "./ScoreLineChart";
import { RepsBarChart, RepsDataPoint } from "./RepsBarChart";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  textSecondary: "#757575",
};

/**
 * Graph data interface
 */
export interface GraphData {
  stats: StatsData;
  scoreData: ScoreDataPoint[];
  repsData: RepsDataPoint[];
}

/**
 * Props for GraphView component
 */
interface GraphViewProps {
  /** グラフデータ */
  data: GraphData | null;
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** エラーフラグ */
  isError: boolean;
  /** 期間ラベル */
  periodLabel: string;
}

/**
 * GraphView Component
 *
 * 統計カード、スコア推移グラフ、種目別レップ数グラフを表示します。
 *
 * @example
 * <GraphView
 *   data={graphData}
 *   isLoading={false}
 *   isError={false}
 *   periodLabel="今週"
 * />
 */
export function GraphView({ data, isLoading, isError, periodLabel }: GraphViewProps) {
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>データの読み込みに失敗しました</Text>
      </View>
    );
  }

  // Empty state
  if (!data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>データがありません</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Summary Card */}
      <StatsCard stats={data.stats} periodLabel={periodLabel} />

      {/* Score Line Chart */}
      <ScoreLineChart data={data.scoreData} title="スコア推移" />

      {/* Reps Bar Chart */}
      <RepsBarChart data={data.repsData} title="種目別トレーニング回数" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 12,
    color: THEME_COLORS.textSecondary,
  },
  errorText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
  emptyText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
});

export default GraphView;
