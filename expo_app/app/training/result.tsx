/**
 * セッション結果画面
 *
 * トレーニング終了後の結果を表示する画面です。
 * スコア、レップ数、時間などの詳細情報を表示し、
 * メモ入力や次のアクションを選択できます。
 *
 * @see docs/expo/tickets/022-session-result-screen.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, BackHandler } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionResult } from "@/components/training/SessionResult";
import { useTrainingStore } from "@/stores";
import { SessionData } from "@/services/training/sessionService";
import { ExerciseType } from "@/types/exercise";

/**
 * Theme colors
 */
const THEME_COLORS = {
  background: "#F5F5F5",
};

/**
 * Session Result Screen
 */
export default function SessionResultScreen() {
  // Get exercise type from params
  const { exerciseType } = useLocalSearchParams<{ exerciseType: string }>();

  // Training store
  const { currentSession, resetSession } = useTrainingStore();

  // Prepare session data for display
  const sessionData: SessionData = useMemo(() => {
    if (currentSession) {
      // Calculate feedbacks from reps
      const allFeedbacks = currentSession.reps.flatMap((rep) => rep.feedback);
      const uniqueFeedbacks = [...new Set(allFeedbacks)].slice(0, 5);

      return {
        exerciseType: currentSession.exerciseType,
        reps: currentSession.reps.length,
        duration: currentSession.endTime && currentSession.startTime
          ? Math.round(
              (currentSession.endTime.getTime() - currentSession.startTime.getTime()) / 1000
            )
          : 0,
        averageScore: currentSession.totalScore,
        feedbacks:
          uniqueFeedbacks.length > 0
            ? uniqueFeedbacks.map((f) => `参考: ${f}`)
            : ["参考: トレーニング完了しました"],
        poseData: currentSession.reps
          .filter((rep) => rep.poseData)
          .flatMap((rep) => rep.poseData || []),
      };
    }

    // Fallback data if no session (for testing)
    return {
      exerciseType: exerciseType || ExerciseType.SQUAT,
      reps: 10,
      duration: 180,
      averageScore: 85,
      feedbacks: [
        "参考: 良いフォームです",
        "参考: 膝の角度が良好です",
        "参考: 安定したテンポです",
      ],
    };
  }, [currentSession, exerciseType]);

  // Handle back button - prevent going back to training screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleGoHome();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Handle another set
  const handleAnotherSet = () => {
    resetSession();
    router.replace({
      pathname: "/training/session",
      params: { exerciseType: sessionData.exerciseType },
    });
  };

  // Handle go home
  const handleGoHome = () => {
    resetSession();
    router.replace("/(app)/(tabs)");
  };

  // Handle save complete
  const handleSaveComplete = (sessionId: string) => {
    console.log("[ResultScreen] Session saved:", sessionId);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <SessionResult
        sessionData={sessionData}
        onAnotherSet={handleAnotherSet}
        onGoHome={handleGoHome}
        onSaveComplete={handleSaveComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
});
