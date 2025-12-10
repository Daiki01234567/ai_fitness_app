/**
 * セッションリストアイテムコンポーネント
 *
 * カレンダー画面でその日のセッション一覧を表示するためのコンポーネントです。
 *
 * @see docs/expo/tickets/025-calendar-view.md
 */

import React from "react";
import { StyleSheet } from "react-native";
import { List, Chip } from "react-native-paper";

import { TrainingSession } from "@/services/training/historyService";
import {
  getExerciseLabel,
  getExerciseIcon,
  getExerciseColor,
  getScoreColor,
  formatDuration,
} from "@/utils/exerciseUtils";

/**
 * Theme colors
 */
const THEME_COLORS = {
  surface: "#FFFFFF",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * Props for SessionListItem component
 */
interface SessionListItemProps {
  /** セッションデータ */
  session: TrainingSession;
  /** アイテムタップ時のコールバック */
  onPress: () => void;
}

/**
 * 時刻をフォーマット
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * SessionListItem Component
 *
 * カレンダー画面で選択された日のセッションを一覧表示するためのコンポーネントです。
 *
 * @example
 * <SessionListItem
 *   session={sessionData}
 *   onPress={() => handleSessionPress(sessionData.id)}
 * />
 */
export function SessionListItem({ session, onPress }: SessionListItemProps) {
  const exerciseLabel = getExerciseLabel(session.exerciseType);
  const exerciseIcon = getExerciseIcon(session.exerciseType);
  const exerciseColor = getExerciseColor(session.exerciseType);
  const scoreColor = getScoreColor(session.averageScore);

  const description = `${session.reps}回 | ${formatDuration(session.duration)}`;

  return (
    <List.Item
      title={exerciseLabel}
      description={description}
      left={(props) => (
        <List.Icon {...props} icon={exerciseIcon} color={exerciseColor} />
      )}
      right={() => (
        <Chip
          mode="outlined"
          textStyle={{ color: scoreColor, fontWeight: "bold", fontSize: 12 }}
          style={styles.scoreChip}
          compact
        >
          {session.averageScore}点
        </Chip>
      )}
      onPress={onPress}
      style={styles.listItem}
      titleStyle={styles.title}
      descriptionStyle={styles.description}
    />
  );
}

const styles = StyleSheet.create({
  listItem: {
    backgroundColor: THEME_COLORS.surface,
    paddingVertical: 4,
  },
  title: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  description: {
    color: THEME_COLORS.textSecondary,
    fontSize: 13,
  },
  scoreChip: {
    alignSelf: "center",
    height: 28,
    borderColor: "transparent",
  },
});

export default SessionListItem;
