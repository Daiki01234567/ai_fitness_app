/**
 * フィルターバーコンポーネント
 *
 * 履歴画面で使用するフィルターバーです。
 * 種目別、日付範囲でフィルタリングできます。
 *
 * @see docs/expo/tickets/024-history-screen.md
 */

import React, { useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  SegmentedButtons,
  Menu,
  Button,
  IconButton,
  Chip,
} from "react-native-paper";

import { ExerciseType } from "@/types/exercise";
import { getExerciseLabel } from "@/services/training/historyService";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * 日付範囲フィルター
 */
export type DateRangeFilter = "week" | "month" | "all";

/**
 * Props for FilterBar component
 */
interface FilterBarProps {
  /** 種目フィルター */
  exerciseFilter: string | null;
  /** 種目フィルター変更時 */
  onExerciseFilterChange: (exercise: string | null) => void;
  /** 日付範囲フィルター */
  dateRangeFilter: DateRangeFilter;
  /** 日付範囲フィルター変更時 */
  onDateRangeFilterChange: (range: DateRangeFilter) => void;
  /** カレンダーボタン押下時 */
  onCalendarPress?: () => void;
}

/**
 * FilterBar Component
 *
 * 履歴のフィルタリングコントロールを表示するコンポーネントです。
 *
 * @example
 * <FilterBar
 *   exerciseFilter={selectedExercise}
 *   onExerciseFilterChange={setSelectedExercise}
 *   dateRangeFilter={dateRange}
 *   onDateRangeFilterChange={setDateRange}
 * />
 */
export function FilterBar({
  exerciseFilter,
  onExerciseFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  onCalendarPress,
}: FilterBarProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  const exerciseOptions = [
    { value: null, label: "全て" },
    { value: ExerciseType.SQUAT, label: "スクワット" },
    { value: ExerciseType.PUSHUP, label: "プッシュアップ" },
    { value: ExerciseType.ARM_CURL, label: "アームカール" },
    { value: ExerciseType.SIDE_RAISE, label: "サイドレイズ" },
    { value: ExerciseType.SHOULDER_PRESS, label: "ショルダープレス" },
  ];

  return (
    <View style={styles.container}>
      {/* Exercise Filter Menu */}
      <View style={styles.filterRow}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              icon="filter-variant"
              style={styles.exerciseButton}
              contentStyle={styles.exerciseButtonContent}
            >
              {getExerciseLabel(exerciseFilter)}
            </Button>
          }
          contentStyle={styles.menuContent}
        >
          {exerciseOptions.map((option) => (
            <Menu.Item
              key={option.value || "all"}
              onPress={() => {
                onExerciseFilterChange(option.value);
                setMenuVisible(false);
              }}
              title={option.label}
              leadingIcon={exerciseFilter === option.value ? "check" : undefined}
            />
          ))}
        </Menu>

        {/* Calendar Button (if provided) */}
        {onCalendarPress && (
          <IconButton
            icon="calendar"
            size={24}
            onPress={onCalendarPress}
            style={styles.calendarButton}
          />
        )}
      </View>

      {/* Date Range Filter */}
      <SegmentedButtons
        value={dateRangeFilter}
        onValueChange={(value) => onDateRangeFilterChange(value as DateRangeFilter)}
        buttons={[
          { value: "week", label: "今週" },
          { value: "month", label: "今月" },
          { value: "all", label: "全期間" },
        ]}
        style={styles.segmentedButtons}
      />
    </View>
  );
}

/**
 * Compact filter using chips
 */
interface CompactFilterBarProps {
  /** 種目フィルター */
  exerciseFilter: string | null;
  /** 種目フィルター変更時 */
  onExerciseFilterChange: (exercise: string | null) => void;
}

export function CompactFilterBar({
  exerciseFilter,
  onExerciseFilterChange,
}: CompactFilterBarProps) {
  const exerciseOptions = [
    { value: null, label: "全て" },
    { value: ExerciseType.SQUAT, label: "スクワット" },
    { value: ExerciseType.PUSHUP, label: "プッシュアップ" },
    { value: ExerciseType.ARM_CURL, label: "アームカール" },
    { value: ExerciseType.SIDE_RAISE, label: "サイドレイズ" },
    { value: ExerciseType.SHOULDER_PRESS, label: "ショルダープレス" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScrollView}
      contentContainerStyle={styles.chipContainer}
    >
      {exerciseOptions.map((option) => (
        <Chip
          key={option.value || "all"}
          mode={exerciseFilter === option.value ? "flat" : "outlined"}
          selected={exerciseFilter === option.value}
          onPress={() => onExerciseFilterChange(option.value)}
          style={[
            styles.filterChip,
            exerciseFilter === option.value && styles.filterChipSelected,
          ]}
          textStyle={
            exerciseFilter === option.value
              ? styles.filterChipTextSelected
              : styles.filterChipText
          }
        >
          {option.label}
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exerciseButton: {
    flex: 1,
  },
  exerciseButtonContent: {
    justifyContent: "flex-start",
  },
  calendarButton: {
    margin: 0,
  },
  menuContent: {
    backgroundColor: THEME_COLORS.surface,
  },
  segmentedButtons: {
    // Default styling
  },
  // Compact chip styles
  chipScrollView: {
    backgroundColor: THEME_COLORS.surface,
  },
  chipContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: THEME_COLORS.background,
  },
  filterChipSelected: {
    backgroundColor: THEME_COLORS.primary,
  },
  filterChipText: {
    color: THEME_COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: "#FFFFFF",
  },
});

export default FilterBar;
