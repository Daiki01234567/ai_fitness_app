/**
 * 種目カードコンポーネント
 *
 * メニュー選択画面で使用する種目カードです。
 * 種目名、カテゴリ、難易度、器具の有無、説明を表示します。
 *
 * @see docs/expo/tickets/020-menu-screen.md
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text, Chip, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  Exercise,
  getCategoryLabel,
  getDifficultyLabel,
} from "@/types/exercise";

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
  warning: "#FF9800",
};

/**
 * Props for ExerciseCard component
 */
interface ExerciseCardProps {
  /** 種目データ */
  exercise: Exercise;
  /** カードタップ時のコールバック */
  onPress: () => void;
  /** 無効状態 */
  disabled?: boolean;
}

/**
 * ExerciseCard Component
 *
 * 種目の情報を表示するカードコンポーネントです。
 *
 * @example
 * <ExerciseCard
 *   exercise={squatExercise}
 *   onPress={() => handleExerciseSelect(squatExercise.id)}
 * />
 */
export function ExerciseCard({ exercise, onPress, disabled }: ExerciseCardProps) {
  const isDisabled = disabled || !exercise.available;

  return (
    <Card
      style={[styles.card, isDisabled && styles.cardDisabled]}
      mode="elevated"
      onPress={isDisabled ? undefined : onPress}
    >
      <Card.Content style={styles.content}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            isDisabled && styles.iconContainerDisabled,
          ]}
        >
          <MaterialCommunityIcons
            name={exercise.iconName as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
            size={32}
            color={isDisabled ? THEME_COLORS.disabled : THEME_COLORS.primary}
          />
        </View>

        {/* Content */}
        <View style={styles.info}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text
              variant="titleMedium"
              style={[styles.name, isDisabled && styles.textDisabled]}
            >
              {exercise.name}
            </Text>
            {!exercise.available && (
              <Chip
                mode="flat"
                style={styles.comingSoonChip}
                textStyle={styles.comingSoonText}
                compact
              >
                準備中
              </Chip>
            )}
          </View>

          {/* Category and Difficulty */}
          <Text
            variant="bodySmall"
            style={[styles.subtitle, isDisabled && styles.textDisabled]}
          >
            {getCategoryLabel(exercise.category)} | {getDifficultyLabel(exercise.difficulty)}
          </Text>

          {/* Description */}
          <Text
            variant="bodySmall"
            style={[styles.description, isDisabled && styles.textDisabled]}
            numberOfLines={2}
          >
            {exercise.description}
          </Text>

          {/* Equipment and Muscles */}
          <View style={styles.tagsContainer}>
            {exercise.requiresEquipment && exercise.equipmentName && (
              <Chip
                mode="outlined"
                style={styles.tag}
                textStyle={styles.tagText}
                compact
                icon="dumbbell"
              >
                {exercise.equipmentName}
              </Chip>
            )}
            {exercise.targetMuscles.slice(0, 2).map((muscle, index) => (
              <Chip
                key={index}
                mode="outlined"
                style={styles.tag}
                textStyle={styles.tagText}
                compact
              >
                {muscle}
              </Chip>
            ))}
          </View>
        </View>

        {/* Arrow */}
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={isDisabled ? THEME_COLORS.disabled : THEME_COLORS.textSecondary}
        />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  cardDisabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME_COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconContainerDisabled: {
    backgroundColor: THEME_COLORS.background,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  name: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  subtitle: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 4,
  },
  description: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  textDisabled: {
    color: THEME_COLORS.disabled,
  },
  comingSoonChip: {
    backgroundColor: "#FFF3E0",
    height: 22,
  },
  comingSoonText: {
    fontSize: 10,
    color: THEME_COLORS.warning,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    height: 24,
    backgroundColor: THEME_COLORS.background,
  },
  tagText: {
    fontSize: 10,
    color: THEME_COLORS.textSecondary,
  },
});

export default ExerciseCard;
