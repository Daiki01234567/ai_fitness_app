/**
 * 進捗情報表示コンポーネント
 *
 * トレーニング実行画面で、レップカウント、経過時間、進捗バーを表示します。
 *
 * @see docs/expo/tickets/021-training-screen.md
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, ProgressBar, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  primaryLight: "#E8F5E9",
  surface: "#FFFFFF",
  text: "#212121",
  textSecondary: "#757575",
  textLight: "#FFFFFF",
};

/**
 * Props for ProgressInfo component
 */
interface ProgressInfoProps {
  /** 現在のレップ数 */
  reps: number;
  /** 目標レップ数 */
  targetReps?: number;
  /** 経過時間（秒） */
  duration: number;
  /** トレーニングがアクティブか */
  isActive?: boolean;
  /** 一時停止中か */
  isPaused?: boolean;
  /** 現在のスコア */
  currentScore?: number;
}

/**
 * 時間をフォーマット (MM:SS)
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * ProgressInfo Component
 *
 * トレーニングの進捗情報を表示するコンポーネントです。
 *
 * @example
 * <ProgressInfo
 *   reps={5}
 *   targetReps={10}
 *   duration={120}
 *   isActive={true}
 * />
 */
export function ProgressInfo({
  reps,
  targetReps,
  duration,
  isActive = true,
  isPaused = false,
  currentScore,
}: ProgressInfoProps) {
  const [elapsedTime, setElapsedTime] = useState(duration);

  // Update elapsed time every second when active
  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  // Sync with external duration
  useEffect(() => {
    setElapsedTime(duration);
  }, [duration]);

  // Calculate progress
  const progress = targetReps && targetReps > 0 ? Math.min(reps / targetReps, 1) : 0;

  return (
    <Surface style={styles.container} elevation={2}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <ProgressBar
          progress={progress}
          color={THEME_COLORS.primary}
          style={styles.progressBar}
        />
        {targetReps && (
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Reps */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="repeat"
            size={20}
            color={THEME_COLORS.primary}
          />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>
              {reps}
              {targetReps && <Text style={styles.statTarget}> / {targetReps}</Text>}
            </Text>
            <Text style={styles.statLabel}>レップ</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Duration */}
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={20}
            color={THEME_COLORS.primary}
          />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{formatDuration(elapsedTime)}</Text>
            <Text style={styles.statLabel}>経過時間</Text>
          </View>
        </View>

        {/* Score (if available) */}
        {currentScore !== undefined && (
          <>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="star"
                size={20}
                color={THEME_COLORS.primary}
              />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{currentScore}点</Text>
                <Text style={styles.statLabel}>スコア</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Pause Indicator */}
      {isPaused && (
        <View style={styles.pauseIndicator}>
          <MaterialCommunityIcons
            name="pause-circle"
            size={16}
            color={THEME_COLORS.textSecondary}
          />
          <Text style={styles.pauseText}>一時停止中</Text>
        </View>
      )}
    </Surface>
  );
}

/**
 * Compact version for overlay use
 */
export function CompactProgressInfo({
  reps,
  targetReps,
  duration,
}: Pick<ProgressInfoProps, "reps" | "targetReps" | "duration">) {
  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactItem}>
        <Text style={styles.compactValue}>{reps}</Text>
        {targetReps && (
          <Text style={styles.compactTarget}>/{targetReps}</Text>
        )}
        <Text style={styles.compactLabel}>回</Text>
      </View>
      <View style={styles.compactDivider} />
      <View style={styles.compactItem}>
        <Text style={styles.compactValue}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME_COLORS.primaryLight,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: THEME_COLORS.primary,
    minWidth: 40,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  statContent: {
    marginLeft: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.text,
  },
  statTarget: {
    fontSize: 14,
    fontWeight: "normal",
    color: THEME_COLORS.textSecondary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: "#E0E0E0",
  },
  pauseIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  pauseText: {
    marginLeft: 4,
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compactItem: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  compactValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.textLight,
  },
  compactTarget: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  compactLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginLeft: 2,
  },
  compactDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 12,
  },
});

export default ProgressInfo;
