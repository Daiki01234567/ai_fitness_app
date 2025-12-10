/**
 * 履歴画面
 *
 * 過去のトレーニング記録を一覧表示する画面です。
 * 種目別、日付範囲でフィルタリングでき、各セッションの詳細を確認できます。
 *
 * @see docs/expo/tickets/024-history-screen.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Surface, Text, Button, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionCard } from "@/components/history/SessionCard";
import { FilterBar, DateRangeFilter } from "@/components/history/FilterBar";
import {
  fetchTrainingSessions,
  fetchHistoryStats,
  TrainingSession,
} from "@/services/training/historyService";

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
 * History screen component
 */
export default function HistoryScreen() {
  // Filter state
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("month");

  // Fetch sessions with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["training-sessions", exerciseFilter, dateRangeFilter],
    queryFn: ({ pageParam }) =>
      fetchTrainingSessions({
        exerciseType: exerciseFilter,
        dateRange: dateRangeFilter,
        lastDoc: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    initialPageParam: undefined as unknown,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["history-stats", dateRangeFilter],
    queryFn: () => fetchHistoryStats(dateRangeFilter),
  });

  // Flatten sessions from pages
  const sessions = useMemo(() => {
    return data?.pages.flatMap((page) => page.sessions) ?? [];
  }, [data]);

  // Handle session press
  const handleSessionPress = useCallback((sessionId: string) => {
    // TODO: Navigate to session detail screen
    console.log("Session pressed:", sessionId);
  }, []);

  // Handle start training
  const handleStartTraining = useCallback(() => {
    router.push("/(app)/(tabs)/training");
  }, []);

  // Handle calendar press
  const handleCalendarPress = useCallback(() => {
    router.push("/history/calendar");
  }, []);

  // Handle graph press
  const handleGraphPress = useCallback(() => {
    router.push("/history/graph");
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render session card
  const renderSessionCard = useCallback(
    ({ item }: { item: TrainingSession }) => (
      <SessionCard session={item} onPress={() => handleSessionPress(item.id)} />
    ),
    [handleSessionPress]
  );

  // Render header with stats
  const renderHeader = useCallback(
    () => (
      <View style={styles.headerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            トレーニング履歴
          </Text>
          <View style={styles.headerActions}>
            <Button
              mode="text"
              compact
              icon="chart-line"
              onPress={handleGraphPress}
              textColor={THEME_COLORS.primary}
            >
              グラフ
            </Button>
          </View>
        </View>

        {/* Filter Bar */}
        <FilterBar
          exerciseFilter={exerciseFilter}
          onExerciseFilterChange={setExerciseFilter}
          dateRangeFilter={dateRangeFilter}
          onDateRangeFilterChange={setDateRangeFilter}
          onCalendarPress={handleCalendarPress}
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
              {stats?.totalSessions || 0}
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
              {stats?.totalReps || 0}
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
              {stats?.totalMinutes || 0}分
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
                {stats?.averageScore || "--"}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chart-line"
              size={48}
              color={THEME_COLORS.primaryLight}
            />
          </View>
        </Surface>
      </View>
    ),
    [exerciseFilter, dateRangeFilter, stats, handleCalendarPress, handleGraphPress]
  );

  // Render empty state
  const renderEmptyState = useCallback(
    () => (
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
    ),
    [handleStartTraining]
  );

  // Render footer (loading indicator)
  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={THEME_COLORS.primary} />
        </View>
      );
    }

    // Tips card at the end
    if (sessions.length > 0) {
      return (
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
      );
    }

    return null;
  }, [isFetchingNextPage, sessions.length]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={48}
          color={THEME_COLORS.textSecondary}
        />
        <Text style={styles.errorText}>履歴の読み込みに失敗しました</Text>
        <Button mode="outlined" onPress={() => refetch()}>
          再試行
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[THEME_COLORS.primary]}
            tintColor={THEME_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB for quick training access */}
      <FAB
        icon="plus"
        label="トレーニング"
        onPress={handleStartTraining}
        style={styles.fab}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME_COLORS.background,
    padding: 16,
    gap: 16,
  },
  loadingText: {
    color: THEME_COLORS.textSecondary,
  },
  errorText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 100, // Space for FAB
  },
  loadingFooter: {
    padding: 16,
    alignItems: "center",
  },
  // Header Container
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  // Statistics
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 16,
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
    marginBottom: 16,
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
    marginHorizontal: 16,
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
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
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
  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: THEME_COLORS.primary,
  },
});
