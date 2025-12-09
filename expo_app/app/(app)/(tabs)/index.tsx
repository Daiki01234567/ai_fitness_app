/**
 * ホーム画面（スタブ）
 *
 * 今日のトレーニング概要、クイックスタート、最近のアクティビティを表示します。
 * 詳細な実装は後続のチケットで行います。
 *
 * @see docs/expo/specs/05_画面遷移図_Expo版_v1.md
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores";

export default function HomeScreen() {
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>こんにちは</Text>
          <Text style={styles.userName}>{user?.displayName || user?.email || "ユーザー"}</Text>
        </View>

        {/* Quick Start Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>クイックスタート</Text>
          <TouchableOpacity style={styles.quickStartCard}>
            <View style={styles.quickStartContent}>
              <Text style={styles.quickStartTitle}>トレーニングを開始</Text>
              <Text style={styles.quickStartDescription}>
                種目を選んでトレーニングを始めましょう
              </Text>
            </View>
            <View style={styles.quickStartIcon}>
              <Text style={styles.quickStartIconText}>{">"}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Today's Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日のサマリー</Text>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>0</Text>
              <Text style={styles.summaryLabel}>セッション</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>0</Text>
              <Text style={styles.summaryLabel}>レップ</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>0分</Text>
              <Text style={styles.summaryLabel}>時間</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最近のアクティビティ</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>まだトレーニング記録がありません</Text>
            <Text style={styles.emptyStateSubtext}>
              トレーニングを始めて記録を残しましょう
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: "#666",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  quickStartCard: {
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickStartContent: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  quickStartDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  quickStartIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickStartIconText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  summaryContainer: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
