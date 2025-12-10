/**
 * ホーム画面
 *
 * アプリのメイン画面。今日のトレーニング概要、週間進捗、最近のアクティビティを表示。
 * トレーニング開始へのクイックアクセスを提供。
 *
 * 機能:
 * - ユーザー情報の表示（displayName、email）
 * - 今日のトレーニング推奨
 * - 最近のトレーニング履歴（プレースホルダー）
 * - トレーニング開始ボタン
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/expo/tickets/008-home-screen.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import {
  Card,
  Text,
  Button,
  Surface,
  useTheme,
  Divider,
  Avatar,
  ProgressBar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore, useUserStore } from "@/stores";

/**
 * Theme colors following Material Design 3 guidelines
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  primaryLight: "#E8F5E9",
  secondary: "#2196F3",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  success: "#4CAF50",
  warning: "#FF9800",
};

/**
 * Mock data for weekly progress (days of the week)
 * Will be replaced with actual data from Firestore in Phase 2
 */
const MOCK_WEEKLY_DATA = [
  { day: "月", sessions: 0 },
  { day: "火", sessions: 0 },
  { day: "水", sessions: 0 },
  { day: "木", sessions: 0 },
  { day: "金", sessions: 0 },
  { day: "土", sessions: 0 },
  { day: "日", sessions: 0 },
];

/**
 * Get greeting based on time of day
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

/**
 * Home screen component
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { profile } = useUserStore();
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Navigate to training screen
  const handleStartTraining = () => {
    router.push("/(app)/(tabs)/training");
  };

  // Get display name with fallback
  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "ユーザー";

  // Today's session count (placeholder - will be fetched from Firestore)
  const todaySessions = 0;

  // Weekly progress (placeholder)
  const weeklyProgress = MOCK_WEEKLY_DATA;
  const totalWeeklySessions = weeklyProgress.reduce((acc, day) => acc + day.sessions, 0);

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
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View style={styles.welcomeText}>
              <Text variant="bodyMedium" style={styles.greeting}>
                {getGreeting()}
              </Text>
              <Text variant="headlineMedium" style={styles.userName}>
                {displayName}さん
              </Text>
            </View>
            <Avatar.Icon
              size={48}
              icon="account"
              style={{ backgroundColor: THEME_COLORS.primary }}
            />
          </View>
        </View>

        {/* Quick Start Card */}
        <Card style={styles.quickStartCard} mode="elevated">
          <Card.Content style={styles.quickStartContent}>
            <View style={styles.quickStartInfo}>
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={32}
                color={THEME_COLORS.surface}
              />
              <View style={styles.quickStartTextContainer}>
                <Text variant="titleMedium" style={styles.quickStartTitle}>
                  トレーニングを開始
                </Text>
                <Text variant="bodySmall" style={styles.quickStartDescription}>
                  種目を選んでトレーニングを始めましょう
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={handleStartTraining}
              style={styles.quickStartButton}
              buttonColor={THEME_COLORS.surface}
              textColor={THEME_COLORS.primary}
              icon="play"
            >
              開始
            </Button>
          </Card.Content>
        </Card>

        {/* Today's Summary */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            今日のセッション
          </Text>
          <Surface style={styles.todayCard} elevation={1}>
            <View style={styles.todayContent}>
              <MaterialCommunityIcons
                name="calendar-today"
                size={28}
                color={THEME_COLORS.primary}
              />
              <View style={styles.todayStats}>
                <Text variant="displaySmall" style={styles.todayValue}>
                  {todaySessions}
                </Text>
                <Text variant="bodyMedium" style={styles.todayLabel}>
                  回
                </Text>
              </View>
            </View>
            {todaySessions === 0 && (
              <Text variant="bodySmall" style={styles.todayHint}>
                今日はまだトレーニングしていません
              </Text>
            )}
          </Surface>
        </View>

        {/* Weekly Progress */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            週間の進捗
          </Text>
          <Surface style={styles.weeklyCard} elevation={1}>
            <View style={styles.weeklyHeader}>
              <Text variant="bodyMedium" style={styles.weeklyTotal}>
                今週の合計: {totalWeeklySessions}セッション
              </Text>
            </View>
            <View style={styles.weeklyBars}>
              {weeklyProgress.map((day, index) => (
                <View key={index} style={styles.weeklyBarContainer}>
                  <View style={styles.weeklyBarBackground}>
                    <View
                      style={[
                        styles.weeklyBarFill,
                        {
                          height: `${Math.min(day.sessions * 20, 100)}%`,
                          backgroundColor:
                            day.sessions > 0
                              ? THEME_COLORS.primary
                              : THEME_COLORS.background,
                        },
                      ]}
                    />
                  </View>
                  <Text variant="labelSmall" style={styles.weeklyDayLabel}>
                    {day.day}
                  </Text>
                </View>
              ))}
            </View>
          </Surface>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            最近のアクティビティ
          </Text>
          <Surface style={styles.emptyStateCard} elevation={1}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={48}
              color={THEME_COLORS.textSecondary}
            />
            <Text variant="titleSmall" style={styles.emptyStateTitle}>
              まだトレーニング記録がありません
            </Text>
            <Text variant="bodySmall" style={styles.emptyStateDescription}>
              トレーニングを始めて記録を残しましょう
            </Text>
            <Button
              mode="outlined"
              onPress={handleStartTraining}
              style={styles.emptyStateButton}
              textColor={THEME_COLORS.primary}
            >
              トレーニングを始める
            </Button>
          </Surface>
        </View>

        {/* Subscription Info (Free Plan) */}
        <Surface style={styles.subscriptionCard} elevation={1}>
          <View style={styles.subscriptionHeader}>
            <MaterialCommunityIcons
              name="star-outline"
              size={20}
              color={THEME_COLORS.warning}
            />
            <Text variant="labelMedium" style={styles.subscriptionLabel}>
              無料プラン
            </Text>
          </View>
          <View style={styles.subscriptionProgress}>
            <Text variant="bodySmall" style={styles.subscriptionText}>
              今日の残り: 3回/3回
            </Text>
            <ProgressBar
              progress={1}
              color={THEME_COLORS.primary}
              style={styles.progressBar}
            />
          </View>
          <Button
            mode="text"
            compact
            textColor={THEME_COLORS.primary}
            onPress={() => {
              // TODO: Navigate to subscription screen (Phase 3)
            }}
          >
            プレミアムにアップグレード
          </Button>
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
  // Welcome Section
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 4,
  },
  userName: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  // Quick Start Card
  quickStartCard: {
    backgroundColor: THEME_COLORS.primary,
    marginBottom: 24,
  },
  quickStartContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  quickStartInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  quickStartTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  quickStartTitle: {
    color: THEME_COLORS.surface,
    fontWeight: "bold",
  },
  quickStartDescription: {
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  quickStartButton: {
    marginLeft: 12,
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  // Today's Summary
  todayCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  todayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  todayStats: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  todayValue: {
    color: THEME_COLORS.primary,
    fontWeight: "bold",
  },
  todayLabel: {
    color: THEME_COLORS.textSecondary,
    marginLeft: 4,
  },
  todayHint: {
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
  },
  // Weekly Progress
  weeklyCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  weeklyHeader: {
    marginBottom: 16,
  },
  weeklyTotal: {
    color: THEME_COLORS.textSecondary,
  },
  weeklyBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 80,
  },
  weeklyBarContainer: {
    flex: 1,
    alignItems: "center",
  },
  weeklyBarBackground: {
    width: 24,
    height: 50,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weeklyBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  weeklyDayLabel: {
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyStateTitle: {
    color: THEME_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyStateButton: {
    borderColor: THEME_COLORS.primary,
  },
  // Subscription Card
  subscriptionCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  subscriptionLabel: {
    color: THEME_COLORS.warning,
    fontWeight: "600",
  },
  subscriptionProgress: {
    marginBottom: 8,
  },
  subscriptionText: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME_COLORS.background,
  },
});
