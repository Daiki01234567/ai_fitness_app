/**
 * 統計サマリーカードコンポーネント
 *
 * グラフ画面で使用する統計情報の表示カードです。
 *
 * @see docs/expo/tickets/026-graph-view.md
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
 * Stats data interface
 */
export interface StatsData {
  totalSessions: number;
  totalReps: number;
  totalMinutes: number;
  averageScore: number;
}

/**
 * Props for StatsCard component
 */
interface StatsCardProps {
  /** 統計データ */
  stats: StatsData;
  /** 期間ラベル */
  periodLabel: string;
}

/**
 * StatsCard Component
 *
 * 統計情報をカード形式で表示します。
 *
 * @example
 * <StatsCard
 *   stats={{ totalSessions: 10, totalReps: 150, totalMinutes: 120, averageScore: 85 }}
 *   periodLabel="今週"
 * />
 */
export function StatsCard({ stats, periodLabel }: StatsCardProps) {
  return (
    <Surface style={styles.card} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>
        {periodLabel}の統計
      </Text>

      <View style={styles.statsGrid}>
        {/* Sessions */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="counter"
            size={28}
            color={THEME_COLORS.primary}
          />
          <Text variant="headlineSmall" style={styles.statValue}>
            {stats.totalSessions}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            セッション
          </Text>
        </View>

        {/* Reps */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="repeat"
            size={28}
            color={THEME_COLORS.primary}
          />
          <Text variant="headlineSmall" style={styles.statValue}>
            {stats.totalReps}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            総レップ数
          </Text>
        </View>

        {/* Time */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={28}
            color={THEME_COLORS.primary}
          />
          <Text variant="headlineSmall" style={styles.statValue}>
            {stats.totalMinutes}分
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            トレーニング時間
          </Text>
        </View>

        {/* Average Score */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="chart-line"
            size={28}
            color={THEME_COLORS.primary}
          />
          <Text variant="headlineSmall" style={styles.statValue}>
            {stats.averageScore > 0 ? stats.averageScore : "--"}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            平均スコア
          </Text>
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  statValue: {
    color: THEME_COLORS.primary,
    fontWeight: "bold",
    marginTop: 8,
  },
  statLabel: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
});

export default StatsCard;
