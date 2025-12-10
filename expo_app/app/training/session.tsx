/**
 * トレーニング実行画面
 *
 * 実際にトレーニングを行う画面です。
 * カメラプレビュー上に骨格をリアルタイムでオーバーレイ表示し、
 * フォーム評価のフィードバックをリアルタイムで提供します。
 *
 * @see docs/expo/tickets/021-training-screen.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { StyleSheet, View, Alert, BackHandler, Platform } from "react-native";
import { Text, Portal, Dialog, Button } from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraView } from "@/components/training/CameraView";
import { SkeletonOverlay } from "@/components/training/SkeletonOverlay";
import { FeedbackBar } from "@/components/training/FeedbackBar";
import { ProgressInfo, CompactProgressInfo } from "@/components/training/ProgressInfo";
import { ControlButtons, FloatingControlButtons } from "@/components/training/ControlButtons";
import { getExerciseById } from "@/constants/exercises";
import { useTrainingStore } from "@/stores";
import { useSettingsStore } from "@/stores";
import { voiceFeedbackService } from "@/services/training/voiceFeedbackService";
import type { Landmark } from "@/types/mediapipe";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  background: "#000000",
  surface: "#FFFFFF",
  text: "#FFFFFF",
};

/**
 * Unrecognized timeout in seconds
 */
const UNRECOGNIZED_TIMEOUT = 30;

/**
 * Training Session Screen
 */
export default function TrainingSessionScreen() {
  // Get exercise type from params
  const { exerciseType } = useLocalSearchParams<{ exerciseType: string }>();

  // Training store
  const {
    currentSession,
    isActive,
    isPaused,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    addRep,
  } = useTrainingStore();

  // Settings store
  const { audioFeedback, voiceVolume, voiceRate } = useSettingsStore();

  // Local state
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"good" | "warning" | "info">("info");
  const [unrecognizedDuration, setUnrecognizedDuration] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showUnrecognizedDialog, setShowUnrecognizedDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Refs
  const unrecognizedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get exercise info
  const exercise = exerciseType ? getExerciseById(exerciseType) : null;

  // Initialize session on mount
  useEffect(() => {
    if (exerciseType && !currentSession) {
      startSession(exerciseType as any);

      // Speak session start
      if (audioFeedback) {
        voiceFeedbackService.setOptions({
          enabled: audioFeedback,
          volume: voiceVolume,
          rate: voiceRate,
        });
        voiceFeedbackService.speakSessionStart();
      }
    }

    return () => {
      // Cleanup timers
      if (unrecognizedTimerRef.current) {
        clearInterval(unrecognizedTimerRef.current);
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
      voiceFeedbackService.stop();
    };
  }, [exerciseType]);

  // Elapsed time timer
  useEffect(() => {
    if (isActive && !isPaused) {
      elapsedTimerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    }

    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, [isActive, isPaused]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Unrecognized body detection
  useEffect(() => {
    if (!landmarks && isActive && !isPaused) {
      // Start counting unrecognized time
      unrecognizedTimerRef.current = setInterval(() => {
        setUnrecognizedDuration((prev) => {
          const newValue = prev + 1;
          if (newValue >= UNRECOGNIZED_TIMEOUT) {
            // Auto-pause and show dialog
            pauseSession();
            setShowUnrecognizedDialog(true);
            if (audioFeedback) {
              voiceFeedbackService.speakPause();
            }
          }
          return newValue;
        });
      }, 1000);
    } else {
      // Reset counter when body is detected
      setUnrecognizedDuration(0);
      if (unrecognizedTimerRef.current) {
        clearInterval(unrecognizedTimerRef.current);
      }
    }

    return () => {
      if (unrecognizedTimerRef.current) {
        clearInterval(unrecognizedTimerRef.current);
      }
    };
  }, [landmarks, isActive, isPaused]);

  // Handle pause/resume
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resumeSession();
      setShowUnrecognizedDialog(false);
      if (audioFeedback) {
        voiceFeedbackService.speakResume();
      }
    } else {
      pauseSession();
      if (audioFeedback) {
        voiceFeedbackService.speakPause();
      }
    }
  }, [isPaused, audioFeedback, pauseSession, resumeSession]);

  // Handle end session
  const handleEnd = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  // Confirm end session
  const confirmEndSession = useCallback(() => {
    setShowExitDialog(false);
    endSession();

    if (audioFeedback) {
      voiceFeedbackService.speakSessionEnd();
    }

    // Navigate to result screen
    router.replace({
      pathname: "/training/result",
      params: { exerciseType },
    });
  }, [endSession, exerciseType, audioFeedback]);

  // Handle back
  const handleBack = useCallback(() => {
    if (isActive) {
      pauseSession();
      setShowExitDialog(true);
    } else {
      router.back();
    }
  }, [isActive, pauseSession]);

  // Cancel exit
  const cancelExit = useCallback(() => {
    setShowExitDialog(false);
    resumeSession();
  }, [resumeSession]);

  // Handle camera frame (for pose detection)
  const handleCameraFrame = useCallback((frame: any) => {
    // TODO: Integrate with MediaPipe pose detection
    // This is where you would process the frame and get landmarks
  }, []);

  // Mock feedback for demonstration
  useEffect(() => {
    if (!isActive || isPaused) return;

    // Simulate feedback updates
    const feedbackInterval = setInterval(() => {
      const feedbacks = [
        { message: "良いフォームです", type: "good" as const },
        { message: "膝の角度を確認してみてください", type: "warning" as const },
        { message: "背中をまっすぐにしてみましょう", type: "info" as const },
      ];
      const randomIndex = Math.floor(Math.random() * feedbacks.length);
      const randomFeedback = feedbacks[randomIndex];
      if (randomFeedback) {
        setCurrentFeedback(randomFeedback.message);
        setFeedbackType(randomFeedback.type);

        // Voice feedback
        if (audioFeedback && Math.random() > 0.7) {
          voiceFeedbackService.speakFormFeedback(randomFeedback.message);
        }
      }
    }, 5000);

    return () => clearInterval(feedbackInterval);
  }, [isActive, isPaused, audioFeedback]);

  // Get current reps and score
  const currentReps = currentSession?.reps.length || 0;
  const currentScore = currentSession?.totalScore || 0;

  return (
    <View style={styles.container}>
      {/* Camera View with Skeleton Overlay */}
      <CameraView
        isActive={isActive && !isPaused}
        initialPosition={exercise?.recommendedCameraPosition === "front" ? "front" : "back"}
        showCameraSwitch={true}
        showFpsOverlay={__DEV__}
        onFrame={handleCameraFrame}
        onBack={handleBack}
        overlay={
          <>
            {/* Skeleton Overlay */}
            <SkeletonOverlay landmarks={landmarks} />

            {/* Feedback Bar at Top */}
            <SafeAreaView style={styles.feedbackContainer} edges={["top"]}>
              <FeedbackBar
                message={currentFeedback}
                type={feedbackType}
                visible={!!currentFeedback && isActive}
              />
            </SafeAreaView>

            {/* Progress Info Overlay */}
            <View style={styles.progressOverlay}>
              <CompactProgressInfo
                reps={currentReps}
                targetReps={10}
                duration={elapsedTime}
              />
            </View>
          </>
        }
      />

      {/* Bottom Controls */}
      <SafeAreaView style={styles.controlsContainer} edges={["bottom"]}>
        {/* Progress Info */}
        <ProgressInfo
          reps={currentReps}
          targetReps={10}
          duration={elapsedTime}
          isActive={isActive}
          isPaused={isPaused}
          currentScore={currentScore}
        />

        {/* Control Buttons */}
        <ControlButtons
          isPaused={isPaused}
          onPauseResume={handlePauseResume}
          onEnd={handleEnd}
        />
      </SafeAreaView>

      {/* Exit Confirmation Dialog */}
      <Portal>
        <Dialog visible={showExitDialog} onDismiss={cancelExit}>
          <Dialog.Title>トレーニングを終了しますか？</Dialog.Title>
          <Dialog.Content>
            <Text>現在のトレーニング結果を保存して終了します。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={cancelExit}>続ける</Button>
            <Button onPress={confirmEndSession}>終了</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Unrecognized Body Dialog */}
      <Portal>
        <Dialog
          visible={showUnrecognizedDialog}
          onDismiss={() => setShowUnrecognizedDialog(false)}
        >
          <Dialog.Title>体を検出できません</Dialog.Title>
          <Dialog.Content>
            <Text>
              カメラに全身が映るように位置を調整してください。
              {"\n"}トレーニングは一時停止されました。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={confirmEndSession}>終了</Button>
            <Button onPress={handlePauseResume}>再開</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  feedbackContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressOverlay: {
    position: "absolute",
    top: 100,
    right: 16,
    zIndex: 10,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
