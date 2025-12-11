/**
 * カメラ設定画面
 *
 * トレーニング開始前にカメラの配置と環境を確認する画面です。
 * - カメラプレビュー表示
 * - スケルトン表示（姿勢検出時）
 * - 種目名と推奨向き表示
 * - 確認事項チェックリスト
 * - 開始ボタン
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md (3.8 カメラ設定画面)
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, BackHandler } from "react-native";
import { Text, Surface, Button, Checkbox } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraView } from "@/components/training/CameraView";
import { SkeletonOverlay } from "@/components/training/SkeletonOverlay";
import { getExerciseById } from "@/constants/exercises";
import type { Landmark } from "@/types/mediapipe";

/**
 * Theme colors following Material Design 3 guidelines
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  primaryLight: "#E8F5E9",
  surface: "#FFFFFF",
  background: "#000000",
  text: "#FFFFFF",
  textSecondary: "#BDBDBD",
  disabled: "#757575",
  error: "#F44336",
  success: "#4CAF50",
};

/**
 * Camera position labels
 */
const CAMERA_POSITION_LABELS: Record<"front" | "side", string> = {
  front: "正面",
  side: "横向き",
};

/**
 * Checklist item interface
 */
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  autoDetect?: boolean;
}

/**
 * Initial checklist items
 */
const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: "fullBody",
    label: "全身が映っていますか?",
    checked: false,
    autoDetect: true,
  },
  {
    id: "brightness",
    label: "明るさは十分ですか?",
    checked: false,
    autoDetect: true,
  },
  {
    id: "background",
    label: "背景はシンプルですか?",
    checked: false,
    autoDetect: false,
  },
  {
    id: "distance",
    label: "カメラから1.5-2.5m離れていますか?",
    checked: false,
    autoDetect: true,
  },
];

/**
 * Auto-start countdown duration in seconds
 */
const AUTO_START_COUNTDOWN = 3;

/**
 * Camera Setup Screen
 */
export default function CameraSetupScreen() {
  // Get params from previous screen
  const { exerciseType, targetReps } = useLocalSearchParams<{
    exerciseType: string;
    targetReps: string;
  }>();

  // State
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  // landmarks will be populated when MediaPipe integration is complete
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Refs
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get exercise info
  const exercise = exerciseType ? getExerciseById(exerciseType) : null;

  // Check if all items are checked
  const allChecked = checklist.every((item) => item.checked);

  // Cleanup countdown timer
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Start countdown when all items are checked
  useEffect(() => {
    if (allChecked && !isStarting && countdown === null) {
      startCountdown();
    } else if (!allChecked && countdown !== null) {
      // Cancel countdown if items become unchecked
      cancelCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to training session
  const navigateToSession = useCallback(() => {
    setIsStarting(true);
    router.replace({
      pathname: "/training/session",
      params: {
        exerciseType,
        targetReps: targetReps || "10",
      },
    });
  }, [exerciseType, targetReps]);

  // Cancel countdown
  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Start countdown
  const startCountdown = useCallback(() => {
    setCountdown(AUTO_START_COUNTDOWN);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up - navigate to session
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          navigateToSession();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [navigateToSession]);

  // Handle immediate start
  const handleStartNow = useCallback(() => {
    cancelCountdown();
    navigateToSession();
  }, [cancelCountdown, navigateToSession]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    cancelCountdown();
    router.back();
  }, [cancelCountdown]);

  // Toggle checklist item
  const toggleChecklistItem = useCallback((id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }, []);

  // Handle camera frame (for pose detection)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCameraFrame = useCallback((_frame: unknown) => {
    // TODO: Integrate with MediaPipe pose detection
    // This would process the frame and update landmarks
    // For now, landmarks will be null (skeleton won't show)
  }, []);

  // Handle camera initialized
  const handleCameraInitialized = useCallback(() => {
    console.log("[CameraSetup] Camera initialized");
    // Could auto-check some items based on camera feed
  }, []);

  // If exercise not found, show error
  if (!exercise) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={64}
          color={THEME_COLORS.textSecondary}
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
    <View style={styles.container}>
      {/* Camera Preview */}
      <CameraView
        isActive={!isStarting}
        initialPosition={exercise.recommendedCameraPosition === "front" ? "front" : "back"}
        showCameraSwitch={true}
        showFpsOverlay={__DEV__}
        onFrame={handleCameraFrame}
        onInitialized={handleCameraInitialized}
        onBack={handleBack}
        overlay={
          <>
            {/* Skeleton Overlay */}
            <SkeletonOverlay landmarks={landmarks} />

            {/* Exercise Info Overlay */}
            <View style={styles.exerciseInfoOverlay}>
              <Surface style={styles.exerciseInfoCard} elevation={2}>
                <MaterialCommunityIcons
                  name={exercise.iconName as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
                  size={24}
                  color={THEME_COLORS.primary}
                />
                <Text variant="titleMedium" style={styles.exerciseInfoName}>
                  {exercise.name}
                </Text>
                <Text variant="bodySmall" style={styles.exerciseInfoPosition}>
                  推奨: {CAMERA_POSITION_LABELS[exercise.recommendedCameraPosition]}
                </Text>
              </Surface>
            </View>
          </>
        }
      />

      {/* Bottom Panel */}
      <SafeAreaView style={styles.bottomPanel} edges={["bottom"]}>
        {/* Checklist */}
        <View style={styles.checklistContainer}>
          <Text variant="titleMedium" style={styles.checklistTitle}>
            確認事項
          </Text>
          {checklist.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <Checkbox
                status={item.checked ? "checked" : "unchecked"}
                onPress={() => toggleChecklistItem(item.id)}
                color={THEME_COLORS.primary}
                uncheckedColor={THEME_COLORS.textSecondary}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.checklistLabel,
                  item.checked && styles.checklistLabelChecked,
                ]}
                onPress={() => toggleChecklistItem(item.id)}
              >
                {item.label}
              </Text>
              {item.autoDetect && (
                <MaterialCommunityIcons
                  name="auto-fix"
                  size={16}
                  color={THEME_COLORS.disabled}
                  style={styles.autoDetectIcon}
                />
              )}
            </View>
          ))}
        </View>

        {/* Countdown or Start Button */}
        {allChecked && countdown !== null ? (
          <View style={styles.countdownContainer}>
            <Text variant="bodyMedium" style={styles.countdownText}>
              {countdown}秒後に自動開始...
            </Text>
            <View style={styles.countdownCircle}>
              <Text variant="displaySmall" style={styles.countdownNumber}>
                {countdown}
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={handleStartNow}
              style={styles.startNowButton}
              labelStyle={styles.startNowButtonLabel}
            >
              すぐに開始
            </Button>
          </View>
        ) : (
          <Button
            mode="contained"
            onPress={handleStartNow}
            style={[styles.startButton, !allChecked && styles.startButtonDisabled]}
            contentStyle={styles.startButtonContent}
            labelStyle={styles.startButtonLabel}
            disabled={!allChecked}
          >
            開始
          </Button>
        )}

        {/* Help text */}
        {!allChecked && (
          <Text variant="bodySmall" style={styles.helpText}>
            全ての項目を確認してください
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
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
  // Exercise info overlay
  exerciseInfoOverlay: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  exerciseInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    gap: 8,
  },
  exerciseInfoName: {
    color: "#212121",
    fontWeight: "600",
  },
  exerciseInfoPosition: {
    color: "#757575",
    marginLeft: 8,
  },
  // Bottom panel
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 24,
  },
  // Checklist
  checklistContainer: {
    marginBottom: 20,
  },
  checklistTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  checklistLabel: {
    flex: 1,
    color: THEME_COLORS.text,
    marginLeft: 4,
  },
  checklistLabelChecked: {
    color: THEME_COLORS.success,
  },
  autoDetectIcon: {
    marginLeft: 8,
  },
  // Countdown
  countdownContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  countdownText: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 16,
  },
  countdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  countdownNumber: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  startNowButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: THEME_COLORS.text,
    borderRadius: 12,
  },
  startNowButtonLabel: {
    color: THEME_COLORS.text,
  },
  // Start button
  startButton: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
  },
  startButtonDisabled: {
    backgroundColor: THEME_COLORS.disabled,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  startButtonLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.text,
  },
  // Help text
  helpText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    marginTop: 12,
  },
});
