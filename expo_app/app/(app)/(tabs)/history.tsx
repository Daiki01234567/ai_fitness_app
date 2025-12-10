/**
 * 履歴画面
 *
 * 過去のトレーニング記録を表示します。
 * フィルター機能や統計情報を提供。
 * Phase 2でFirestoreからのデータ取得を実装予定。
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import {
  Surface,
  Text,
  Button,
  Chip,
  SegmentedButtons,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Theme colors following Material Design 3 guidelines
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  primaryLight: "#E8F5E9",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  success: "#4CAF50",
  warning: "#FF9800",
};

/**
 * Filter period options
 */
type FilterPeriod = "all" | "week" | "month";

/**
 * History screen component
 */
export default function HistoryScreen() {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Fetch data from Firestore (Phase 2)
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Navigate to training screen
  const handleStartTraining = () => {
    router.push("/(app)/(tabs)/training");
  };

  // Mock statistics (will be replaced with actual data in Phase 2)
  const stats = {
    totalSessions: 0,
    totalReps: 0,
    totalMinutes: 0,
    averageScore: "--",
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME_COLORS.primary]}
            tintColor={THEME_COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            トレーニング履歴
          </Text>
        </View>

        {/* Filter Buttons */}
        <SegmentedButtons
          value={filterPeriod}
          onValueChange={(value) => setFilterPeriod(value as FilterPeriod)}
          buttons={[
            { value: "all", label: "すべて" },
            { value: "week", label: "今週" },
            { value: "month", label: "今月" },
          ]}
          style={styles.filterButtons}
        />

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="counter"
              size={24}
              color={THEME_COLORS.primary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {stats.totalSessions}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              セッション
            </Text>
          </Surface>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="repeat"
              size={24}
              color={THEME_COLORS.primary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {stats.totalReps}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              レップ
            </Text>
          </Surface>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={24}
              color={THEME_COLORS.primary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {stats.totalMinutes}分
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              時間
            </Text>
          </Surface>
        </View>

        {/* Average Score Card */}
        <Surface style={styles.averageScoreCard} elevation={1}>
          <View style={styles.averageScoreContent}>
            <View>
              <Text variant="labelMedium" style={styles.averageScoreLabel}>
                平均フォームスコア
              </Text>
              <Text variant="displaySmall" style={styles.averageScoreValue}>
                {stats.averageScore}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chart-line"
              size={48}
              color={THEME_COLORS.primaryLight}
            />
          </View>
        </Surface>

        {/* Empty State */}
        <Surface style={styles.emptyStateCard} elevation={1}>
          <View style={styles.emptyStateIcon}>
            <MaterialCommunityIcons
              name="history"
              size={64}
              color={THEME_COLORS.textSecondary}
            />
          </View>
          <Text variant="titleMedium" style={styles.emptyStateTitle}>
            トレーニング記録がありません
          </Text>
          <Text variant="bodyMedium" style={styles.emptyStateDescription}>
            トレーニングを行うと、ここに記録が表示されます。{"\n"}
            フォーム評価スコアや改善点も確認できます。
          </Text>
          <Button
            mode="contained"
            onPress={handleStartTraining}
            style={styles.emptyStateButton}
            buttonColor={THEME_COLORS.primary}
            icon="dumbbell"
          >
            トレーニングを始める
          </Button>
        </Surface>

        {/* Info Tips */}
        <Surface style={styles.tipsCard} elevation={1}>
          <View style={styles.tipsHeader}>
            <MaterialCommunityIcons
              name="lightbulb-outline"
              size={20}
              color={THEME_COLORS.warning}
            />
            <Text variant="labelMedium" style={styles.tipsTitle}>
              トレーニングのヒント
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.tipsText}>
            定期的なトレーニングを続けると、フォームスコアの推移や改善点を確認できます。
            週に2-3回のトレーニングがおすすめです。
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Header
  header: {
    marginBottom: 16,
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  // Filter Buttons
  filterButtons: {
    marginBottom: 20,
  },
  // Statistics
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
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
  // Average Score
  averageScoreCard: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  averageScoreContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  averageScoreLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  averageScoreValue: {
    color: THEME_COLORS.surface,
    fontWeight: "bold",
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME_COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyStateDescription: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    paddingHorizontal: 16,
  },
  // Tips Card
  tipsCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 16,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  tipsTitle: {
    color: THEME_COLORS.warning,
    fontWeight: "600",
  },
  tipsText: {
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
});
