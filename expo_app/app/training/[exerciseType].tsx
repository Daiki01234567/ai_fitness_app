/**
 * 種目詳細画面
 *
 * 選択された種目の詳細情報を表示し、トレーニングの準備を行う画面です。
 * - 動作のGIF表示（プレースホルダー）
 * - 推奨カメラ向き表示
 * - 前回の記録表示
 * - 今回の目標レップ数入力
 * - 「開始する」ボタン
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md (3.7 種目詳細画面)
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  Chip,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getExerciseById } from "@/constants/exercises";
import { getCategoryLabel, getDifficultyLabel } from "@/types/exercise";

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
  error: "#F44336",
};

/**
 * Placeholder images for exercises
 */
const EXERCISE_IMAGES: Record<string, any> = {
  // Using placeholder icon for now
  // These would be replaced with actual GIF/video assets
  squat: null,
  pushup: null,
  arm_curl: null,
  side_raise: null,
  shoulder_press: null,
};

/**
 * Camera position labels
 */
const CAMERA_POSITION_LABELS: Record<"front" | "side", string> = {
  front: "正面",
  side: "横向き",
};

/**
 * Mock previous session data
 * In production, this would come from Firestore
 */
interface PreviousSession {
  date: string;
  reps: number;
  score: number;
}

/**
 * Exercise Detail Screen
 */
export default function ExerciseDetailScreen() {
  // Get exercise type from URL params
  const { exerciseType } = useLocalSearchParams<{ exerciseType: string }>();

  // State
  const [targetReps, setTargetReps] = useState("10");
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true);

  // Get exercise info
  const exercise = exerciseType ? getExerciseById(exerciseType) : null;

  // Load previous session data
  useEffect(() => {
    const loadPreviousSession = async () => {
      setIsLoadingPrevious(true);
      try {
        // TODO: Fetch from Firestore
        // For now, simulate a delay and return mock data for demonstration
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock data - in production, query sessions collection
        // where userId == currentUser.uid AND exerciseType == exerciseType
        // orderBy startTime desc, limit 1
        const mockHasHistory = Math.random() > 0.5;
        if (mockHasHistory) {
          setPreviousSession({
            date: "2025/12/10",
            reps: 10,
            score: 85,
          });
        } else {
          setPreviousSession(null);
        }
      } catch (error) {
        console.error("[ExerciseDetail] Failed to load previous session:", error);
        setPreviousSession(null);
      } finally {
        setIsLoadingPrevious(false);
      }
    };

    if (exerciseType) {
      loadPreviousSession();
    }
  }, [exerciseType]);

  // Handle start training
  const handleStartTraining = useCallback(() => {
    const reps = parseInt(targetReps, 10);
    if (isNaN(reps) || reps < 1 || reps > 100) {
      // Invalid input, use default
      router.push({
        pathname: "/training/setup",
        params: {
          exerciseType,
          targetReps: "10",
        },
      });
    } else {
      router.push({
        pathname: "/training/setup",
        params: {
          exerciseType,
          targetReps: targetReps,
        },
      });
    }
  }, [exerciseType, targetReps]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.back();
  }, []);

  // Validate reps input
  const handleRepsChange = useCallback((text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, "");
    setTargetReps(numericText);
  }, []);

  // Check if reps value is valid
  const isRepsValid = useCallback(() => {
    const reps = parseInt(targetReps, 10);
    return !isNaN(reps) && reps >= 1 && reps <= 100;
  }, [targetReps]);

  // If exercise not found, show error
  if (!exercise) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={64}
          color={THEME_COLORS.disabled}
        />
        <Text variant="headlineSmall" style={styles.errorTitle}>
          種目が見つかりません
        </Text>
        <Text variant="bodyMedium" style={styles.errorText}>
          選択された種目は存在しません。
        </Text>
        <Button mode="contained" onPress={handleBack} style={styles.errorButton}>
          戻る
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Exercise GIF/Image Placeholder */}
          <Surface style={styles.imageContainer} elevation={1}>
            {EXERCISE_IMAGES[exercise.id] ? (
              <Image
                source={EXERCISE_IMAGES[exercise.id]}
                style={styles.exerciseImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialCommunityIcons
                  name={exercise.iconName as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
                  size={80}
                  color={THEME_COLORS.primary}
                />
                <Text variant="bodySmall" style={styles.placeholderText}>
                  動作イメージ
                </Text>
              </View>
            )}
          </Surface>

          {/* Exercise Info */}
          <View style={styles.infoSection}>
            <Text variant="headlineMedium" style={styles.exerciseName}>
              {exercise.name}
            </Text>
            <View style={styles.tagsRow}>
              <Chip mode="flat" style={styles.categoryChip} compact>
                {getCategoryLabel(exercise.category)}
              </Chip>
              <Chip mode="flat" style={styles.difficultyChip} compact>
                {getDifficultyLabel(exercise.difficulty)}
              </Chip>
              {exercise.requiresEquipment && exercise.equipmentName && (
                <Chip mode="flat" style={styles.equipmentChip} icon="dumbbell" compact>
                  {exercise.equipmentName}
                </Chip>
              )}
            </View>
            <Text variant="bodyMedium" style={styles.description}>
              {exercise.description}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Recommended Camera Position */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              推奨カメラ向き
            </Text>
            <Surface style={styles.cameraInfoCard} elevation={1}>
              <MaterialCommunityIcons
                name={exercise.recommendedCameraPosition === "front" ? "account-box" : "account-arrow-right"}
                size={32}
                color={THEME_COLORS.primary}
              />
              <View style={styles.cameraInfoContent}>
                <Text variant="titleSmall" style={styles.cameraPositionLabel}>
                  {CAMERA_POSITION_LABELS[exercise.recommendedCameraPosition]}
                </Text>
                <Text variant="bodySmall" style={styles.cameraInfoText}>
                  {exercise.recommendedCameraPosition === "front"
                    ? "左右対称性を確認するため正面からの撮影をお勧めします"
                    : "関節の角度を確認するため横からの撮影をお勧めします"}
                </Text>
              </View>
            </Surface>
          </View>

          <Divider style={styles.divider} />

          {/* Previous Record */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              前回の記録
            </Text>
            {isLoadingPrevious ? (
              <Surface style={styles.previousRecordCard} elevation={1}>
                <Text variant="bodyMedium" style={styles.loadingText}>
                  読み込み中...
                </Text>
              </Surface>
            ) : previousSession ? (
              <Surface style={styles.previousRecordCard} elevation={1}>
                <View style={styles.recordRow}>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={20}
                    color={THEME_COLORS.textSecondary}
                  />
                  <Text variant="bodyMedium" style={styles.recordText}>
                    {previousSession.date}
                  </Text>
                </View>
                <View style={styles.recordRow}>
                  <MaterialCommunityIcons
                    name="counter"
                    size={20}
                    color={THEME_COLORS.textSecondary}
                  />
                  <Text variant="bodyMedium" style={styles.recordText}>
                    レップ数: {previousSession.reps}回
                  </Text>
                </View>
                <View style={styles.recordRow}>
                  <MaterialCommunityIcons
                    name="star"
                    size={20}
                    color={THEME_COLORS.textSecondary}
                  />
                  <Text variant="bodyMedium" style={styles.recordText}>
                    参考スコア: {previousSession.score}点
                  </Text>
                </View>
              </Surface>
            ) : (
              <Surface style={styles.previousRecordCard} elevation={1}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={24}
                  color={THEME_COLORS.disabled}
                />
                <Text variant="bodyMedium" style={styles.noRecordText}>
                  まだ記録がありません
                </Text>
              </Surface>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Target Reps Input */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              今回の目標
            </Text>
            <View style={styles.repsInputContainer}>
              <TextInput
                mode="outlined"
                label="レップ数 (回)"
                value={targetReps}
                onChangeText={handleRepsChange}
                keyboardType="number-pad"
                style={styles.repsInput}
                outlineColor={THEME_COLORS.disabled}
                activeOutlineColor={THEME_COLORS.primary}
                error={targetReps !== "" && !isRepsValid()}
                right={<TextInput.Affix text="回" />}
              />
            </View>
            <Text variant="bodySmall" style={styles.repsHint}>
              例: 10、15、20（1-100回の範囲で入力）
            </Text>
            {targetReps !== "" && !isRepsValid() && (
              <Text variant="bodySmall" style={styles.repsError}>
                1から100の間で入力してください
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Start Button */}
        <View style={styles.bottomContainer}>
          <Button
            mode="contained"
            onPress={handleStartTraining}
            style={styles.startButton}
            contentStyle={styles.startButtonContent}
            labelStyle={styles.startButtonLabel}
            disabled={targetReps !== "" && !isRepsValid()}
          >
            開始する
          </Button>
        </View>
      </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME_COLORS.background,
    padding: 32,
  },
  errorTitle: {
    color: THEME_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: THEME_COLORS.primary,
  },
  // Image section
  imageContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: THEME_COLORS.surface,
  },
  exerciseImage: {
    width: "100%",
    height: 200,
  },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME_COLORS.primaryLight,
  },
  placeholderText: {
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
  },
  // Info section
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  exerciseName: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  categoryChip: {
    backgroundColor: THEME_COLORS.primaryLight,
  },
  difficultyChip: {
    backgroundColor: "#FFF3E0",
  },
  equipmentChip: {
    backgroundColor: "#E3F2FD",
  },
  description: {
    color: THEME_COLORS.textSecondary,
    lineHeight: 22,
  },
  // Sections
  divider: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  // Camera info
  cameraInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.surface,
  },
  cameraInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  cameraPositionLabel: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 4,
  },
  cameraInfoText: {
    color: THEME_COLORS.textSecondary,
    lineHeight: 18,
  },
  // Previous record
  previousRecordCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.surface,
    gap: 8,
  },
  loadingText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordText: {
    color: THEME_COLORS.text,
  },
  noRecordText: {
    color: THEME_COLORS.disabled,
    marginLeft: 8,
  },
  // Reps input
  repsInputContainer: {
    marginBottom: 8,
  },
  repsInput: {
    backgroundColor: THEME_COLORS.surface,
  },
  repsHint: {
    color: THEME_COLORS.textSecondary,
  },
  repsError: {
    color: THEME_COLORS.error,
    marginTop: 4,
  },
  // Bottom button
  bottomContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.background,
  },
  startButton: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  startButtonLabel: {
    fontSize: 18,
    fontWeight: "bold",
  },
});
