/**
 * 履歴画面（スタブ）
 *
 * 過去のトレーニング記録を表示します。
 * 詳細な実装は後続のチケットで行います。
 *
 * @see docs/expo/specs/05_画面遷移図_Expo版_v1.md
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>トレーニング履歴</Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonActive]}>
            <Text style={[styles.filterButtonText, styles.filterButtonTextActive]}>
              すべて
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>今週</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>今月</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>総セッション</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>総レップ</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0分</Text>
            <Text style={styles.statLabel}>総時間</Text>
          </View>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Text style={styles.emptyStateIconText}>icon</Text>
          </View>
          <Text style={styles.emptyStateTitle}>トレーニング記録がありません</Text>
          <Text style={styles.emptyStateDescription}>
            トレーニングを行うと、ここに記録が表示されます。
            フォーム評価スコアや改善点も確認できます。
          </Text>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>トレーニングを始める</Text>
          </TouchableOpacity>
        </View>

        {/* Example History Item (Hidden - for future implementation) */}
        {false && (
          <View style={styles.historyList}>
            <TouchableOpacity style={styles.historyItem}>
              <View style={styles.historyDate}>
                <Text style={styles.historyDay}>12</Text>
                <Text style={styles.historyMonth}>月</Text>
              </View>
              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>スクワット</Text>
                <Text style={styles.historyDetails}>20レップ | 15分 | スコア: 85</Text>
              </View>
              <View style={styles.historyScore}>
                <Text style={styles.historyScoreText}>85</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
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
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  filterButtonActive: {
    backgroundColor: "#2f95dc",
    borderColor: "#2f95dc",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
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
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2f95dc",
    marginBottom: 4,
  },
  statLabel: {
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
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateIconText: {
    fontSize: 14,
    color: "#999",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: "#2f95dc",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyDate: {
    width: 48,
    alignItems: "center",
    marginRight: 16,
  },
  historyDay: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  historyMonth: {
    fontSize: 12,
    color: "#666",
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  historyDetails: {
    fontSize: 14,
    color: "#666",
  },
  historyScore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#28a745",
    alignItems: "center",
    justifyContent: "center",
  },
  historyScoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
});
