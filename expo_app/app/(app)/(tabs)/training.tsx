/**
 * トレーニング画面
 *
 * トレーニング種目の選択と開始を行う画面です。
 * 5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）を表示。
 * MediaPipeを使用したフォーム評価は後続のチケット（Phase 2）で実装予定。
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import {
  Card,
  Text,
  Button,
  Surface,
  Chip,
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
  disabled: "#BDBDBD",
};

/**
 * アイコン名の型定義
 */
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * トレーニング種目の定義
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */
interface ExerciseType {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  targetMuscles: string[];
  available: boolean;
}

const EXERCISE_TYPES: ExerciseType[] = [
  {
    id: "squat",
    name: "スクワット",
    description: "下半身強化の基本種目",
    icon: "human-handsdown",
    targetMuscles: ["大腿四頭筋", "臀筋", "ハムストリング"],
    available: false,
  },
  {
    id: "push-up",
    name: "プッシュアップ",
    description: "胸と上腕三頭筋を鍛える種目",
    icon: "arm-flex",
    targetMuscles: ["大胸筋", "上腕三頭筋", "三角筋"],
    available: false,
  },
  {
    id: "arm-curl",
    name: "アームカール",
    description: "上腕二頭筋を鍛える種目",
    icon: "arm-flex-outline",
    targetMuscles: ["上腕二頭筋", "前腕"],
    available: false,
  },
  {
    id: "side-raise",
    name: "サイドレイズ",
    description: "肩（三角筋）を鍛える種目",
    icon: "human-handsup",
    targetMuscles: ["三角筋（側部）"],
    available: false,
  },
  {
    id: "shoulder-press",
    name: "ショルダープレス",
    description: "肩と上腕三頭筋を鍛える種目",
    icon: "weight-lifter",
    targetMuscles: ["三角筋", "上腕三頭筋"],
    available: false,
  },
];

/**
 * Training screen component
 */
export default function TrainingScreen() {
  /**
   * Handle starting a training session
   */
  const handleStartTraining = (exerciseId: string) => {
    const exercise = EXERCISE_TYPES.find((e) => e.id === exerciseId);
    if (!exercise?.available) {
      Alert.alert(
        "準備中",
        "この種目は現在開発中です。今後のアップデートをお待ちください。"
      );
      return;
    }
    // TODO: Navigate to training session screen (Phase 2)
    console.log("Start training:", exerciseId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            トレーニング種目
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            AIがあなたのフォームをリアルタイムで分析します
          </Text>
        </View>

        {/* Exercise Cards */}
        <View style={styles.exerciseList}>
          {EXERCISE_TYPES.map((exercise) => (
            <Card
              key={exercise.id}
              style={[
                styles.exerciseCard,
                !exercise.available && styles.exerciseCardDisabled,
              ]}
              mode="elevated"
              onPress={() => handleStartTraining(exercise.id)}
            >
              <Card.Content style={styles.exerciseContent}>
                <View style={styles.exerciseIconContainer}>
                  <MaterialCommunityIcons
                    name={exercise.icon}
                    size={32}
                    color={exercise.available ? THEME_COLORS.primary : THEME_COLORS.disabled}
                  />
                </View>
                <View style={styles.exerciseInfo}>
                  <View style={styles.exerciseTitleRow}>
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.exerciseName,
                        !exercise.available && styles.textDisabled,
                      ]}
                    >
                      {exercise.name}
                    </Text>
                    {!exercise.available && (
                      <Chip
                        mode="flat"
                        style={styles.comingSoonChip}
                        textStyle={styles.comingSoonText}
                      >
                        準備中
                      </Chip>
                    )}
                  </View>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.exerciseDescription,
                      !exercise.available && styles.textDisabled,
                    ]}
                  >
                    {exercise.description}
                  </Text>
                  <View style={styles.muscleChips}>
                    {exercise.targetMuscles.slice(0, 2).map((muscle, index) => (
                      <Chip
                        key={index}
                        mode="outlined"
                        style={styles.muscleChip}
                        textStyle={styles.muscleChipText}
                        compact
                      >
                        {muscle}
                      </Chip>
                    ))}
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={exercise.available ? THEME_COLORS.textSecondary : THEME_COLORS.disabled}
                />
              </Card.Content>
            </Card>
          ))}
        </View>

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
    marginBottom: 24,
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: THEME_COLORS.textSecondary,
  },
  // Exercise List
  exerciseList: {
    gap: 12,
    marginBottom: 24,
  },
  exerciseCard: {
    backgroundColor: THEME_COLORS.surface,
  },
  exerciseCardDisabled: {
    opacity: 0.8,
  },
  exerciseContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  exerciseIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME_COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  exerciseName: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  exerciseDescription: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
  },
  textDisabled: {
    color: THEME_COLORS.disabled,
  },
  comingSoonChip: {
    backgroundColor: "#FFF3E0",
    height: 24,
  },
  comingSoonText: {
    fontSize: 10,
    color: "#F57C00",
  },
  muscleChips: {
    flexDirection: "row",
    gap: 6,
  },
  muscleChip: {
    height: 24,
    backgroundColor: THEME_COLORS.background,
  },
  muscleChipText: {
    fontSize: 10,
    color: THEME_COLORS.textSecondary,
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
