/**
 * セッションカードコンポーネント
 *
 * 履歴画面で使用するトレーニングセッションカードです。
 * セッションのサマリー情報を表示します。
 *
 * @see docs/expo/tickets/024-history-screen.md
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { TrainingSession, getExerciseLabel } from "@/services/training/historyService";
import { formatDuration, getScoreColor } from "@/services/training/sessionService";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * Props for SessionCard component
 */
interface SessionCardProps {
  /** セッションデータ */
  session: TrainingSession;
  /** カードタップ時 */
  onPress: () => void;
}

/**
 * 日付をフォーマット
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    // Today - show time
    return `今日 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  } else if (daysDiff === 1) {
    return "昨日";
  } else if (daysDiff < 7) {
    return `${daysDiff}日前`;
  } else {
    // Show full date
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
  }
}

/**
 * SessionCard Component
 *
 * トレーニングセッションのサマリーを表示するカードコンポーネントです。
 *
 * @example
 * <SessionCard
 *   session={sessionData}
 *   onPress={() => handleSessionPress(sessionData.id)}
 * />
 */
export function SessionCard({ session, onPress }: SessionCardProps) {
  const exerciseName = getExerciseLabel(session.exerciseType);
  const scoreColor = getScoreColor(session.averageScore);

  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <Card.Content style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text variant="bodySmall" style={styles.date}>
            {formatDate(session.createdAt)}
          </Text>
          <Chip
            mode="flat"
            style={[styles.scoreChip, { backgroundColor: `${scoreColor}20` }]}
            textStyle={{ color: scoreColor, fontWeight: "bold" }}
            compact
          >
            {session.averageScore}点
          </Chip>
        </View>

        {/* Exercise Name */}
        <Text variant="titleMedium" style={styles.exerciseName}>
          {exerciseName}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="repeat"
              size={16}
              color={THEME_COLORS.primary}
            />
            <Text style={styles.statText}>{session.reps}回</Text>
          </View>
          <Text style={styles.statSeparator}>|</Text>
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={THEME_COLORS.primary}
            />
            <Text style={styles.statText}>{formatDuration(session.duration)}</Text>
          </View>
        </View>

        {/* Memo (if exists) */}
        {session.memo && (
          <View style={styles.memoContainer}>
            <MaterialCommunityIcons
              name="note-text-outline"
              size={14}
              color={THEME_COLORS.textSecondary}
            />
            <Text
              variant="bodySmall"
              style={styles.memoText}
              numberOfLines={2}
            >
              {session.memo}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  content: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  date: {
    color: THEME_COLORS.textSecondary,
  },
  scoreChip: {
    height: 24,
  },
  exerciseName: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: THEME_COLORS.text,
    fontSize: 14,
  },
  statSeparator: {
    marginHorizontal: 12,
    color: THEME_COLORS.textSecondary,
  },
  memoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  memoText: {
    flex: 1,
    marginLeft: 6,
    color: THEME_COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default SessionCard;
