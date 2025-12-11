/**
 * メニュー選択画面（トレーニング種目選択）
 *
 * 5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）の
 * 中からトレーニング種目を選択する画面です。
 *
 * @see docs/expo/tickets/020-menu-screen.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Alert } from "react-native";
import { Text, Surface, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseCard } from "@/components/training/ExerciseCard";
import { EXERCISES, getAvailableExercises } from "@/constants/exercises";
import { Exercise, ExerciseType } from "@/types/exercise";

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
  disabled: "#BDBDBD",
};

/**
 * Training screen component (Menu Selection)
 */
export default function TrainingScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle exercise selection
   */
  const handleExercisePress = useCallback((exercise: Exercise) => {
    if (!exercise.available) {
      Alert.alert(
        "準備中",
        "この種目は現在開発中です。今後のアップデートをお待ちください。"
      );
      return;
    }

    // Navigate to exercise detail screen with exercise type
    // Flow: Menu -> Exercise Detail -> Camera Setup -> Training Session
    router.push({
      pathname: `/training/${exercise.id}`,
    });
  }, []);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh (in production, would reload exercise data)
    setTimeout(() => {
      setRefreshing(false);
      setError(null);
    }, 500);
  }, []);

  /**
   * Render exercise card
   */
  const renderExerciseCard = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseCard
        exercise={item}
        onPress={() => handleExercisePress(item)}
      />
    ),
    [handleExercisePress]
  );

  /**
   * Render header
   */
  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          トレーニング種目
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          AIがあなたのフォームをリアルタイムで分析します
        </Text>
      </View>
    ),
    []
  );

  /**
   * Render footer with info card
   */
  const renderFooter = useCallback(
    () => (
      <View style={styles.footer}>
        {/* Privacy Info Card */}
        <Surface style={styles.infoCard} elevation={1}>
          <View style={styles.infoHeader}>
            <MaterialCommunityIcons
              name="shield-check"
              size={24}
              color={THEME_COLORS.primary}
            />
            <Text variant="titleSmall" style={styles.infoTitle}>
              プライバシー保護
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.infoText}>
            トレーニング中のカメラ映像はデバイス内でのみ処理され、サーバーには送信されません。
            AIによるフォーム分析はオンデバイスで完結します。
          </Text>
        </Surface>

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            フォーム評価について
          </Text>
          <View style={styles.stepList}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text variant="labelLarge" style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text variant="bodyMedium" style={styles.stepTitle}>
                  種目を選択
                </Text>
                <Text variant="bodySmall" style={styles.stepDescription}>
                  トレーニングしたい種目を選びます
                </Text>
              </View>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text variant="labelLarge" style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text variant="bodyMedium" style={styles.stepTitle}>
                  カメラをセット
                </Text>
                <Text variant="bodySmall" style={styles.stepDescription}>
                  全身が映るようにカメラを配置します
                </Text>
              </View>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text variant="labelLarge" style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text variant="bodyMedium" style={styles.stepTitle}>
                  リアルタイムフィードバック
                </Text>
                <Text variant="bodySmall" style={styles.stepDescription}>
                  AIがフォームを分析してアドバイスします
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    ),
    []
  );

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
  if (error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={48}
          color={THEME_COLORS.disabled}
        />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <FlatList
        data={EXERCISES}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseCard}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[THEME_COLORS.primary]}
            tintColor={THEME_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
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
  },
  loadingText: {
    marginTop: 16,
    color: THEME_COLORS.textSecondary,
  },
  errorText: {
    marginTop: 16,
    color: THEME_COLORS.disabled,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  // Header
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: THEME_COLORS.textSecondary,
  },
  // Footer
  footer: {
    padding: 16,
    paddingTop: 8,
  },
  // Info Card
  infoCard: {
    backgroundColor: THEME_COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    color: THEME_COLORS.primary,
    fontWeight: "600",
  },
  infoText: {
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  // How It Works
  howItWorksSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 16,
  },
  stepList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumberText: {
    color: THEME_COLORS.surface,
    fontWeight: "bold",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: THEME_COLORS.text,
    fontWeight: "500",
    marginBottom: 2,
  },
  stepDescription: {
    color: THEME_COLORS.textSecondary,
  },
});
