/**
 * カレンダー表示コンポーネント
 *
 * トレーニング記録をカレンダー形式で表示するコンポーネントです。
 * react-native-calendars を使用しています。
 *
 * @see docs/expo/tickets/025-calendar-view.md
 */

import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, FlatList } from "react-native";
import { Text, ActivityIndicator, Surface } from "react-native-paper";
import { Calendar, LocaleConfig, DateData } from "react-native-calendars";
import { useQuery } from "@tanstack/react-query";

import { SessionListItem } from "./SessionListItem";
import { TrainingSession } from "@/services/training/historyService";
import { getExerciseColor, formatDateString } from "@/utils/exerciseUtils";

// Japanese locale configuration
LocaleConfig.locales["ja"] = {
  monthNames: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
  monthNamesShort: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
  dayNames: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
  dayNamesShort: ["日", "月", "火", "水", "木", "金", "土"],
  today: "今日",
};
LocaleConfig.defaultLocale = "ja";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  border: "#E0E0E0",
};

/**
 * Calendar marked dates type
 */
interface MarkedDates {
  [date: string]: {
    dots?: Array<{ color: string; key?: string }>;
    selected?: boolean;
    selectedColor?: string;
  };
}

/**
 * Props for CalendarView component
 */
interface CalendarViewProps {
  /** セッションデータを取得する関数 */
  fetchMonthSessions: (month: string) => Promise<TrainingSession[]>;
  /** セッション選択時のコールバック */
  onSessionPress?: (sessionId: string) => void;
}

/**
 * CalendarView Component
 *
 * トレーニング記録をカレンダー形式で表示します。
 * - 月別カレンダー表示
 * - トレーニング実施日にマーカー（ドット）表示
 * - 日付タップでその日のセッション一覧表示
 *
 * @example
 * <CalendarView
 *   fetchMonthSessions={fetchMonthSessions}
 *   onSessionPress={(id) => router.push(`/history/${id}`)}
 * />
 */
export function CalendarView({ fetchMonthSessions, onSessionPress }: CalendarViewProps) {
  const today = formatDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [currentMonth, setCurrentMonth] = useState<string>(today.substring(0, 7));

  // Fetch sessions for the current month
  const {
    data: monthSessions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["calendar-sessions", currentMonth],
    queryFn: () => fetchMonthSessions(currentMonth),
  });

  // Build marked dates for the calendar
  const markedDates = useMemo<MarkedDates>(() => {
    const marked: MarkedDates = {};

    if (monthSessions) {
      monthSessions.forEach((session: TrainingSession) => {
        const dateStr = formatDateString(session.createdAt);
        if (!marked[dateStr]) {
          marked[dateStr] = { dots: [] };
        }
        // Add dot for this exercise (limit to 3 dots max)
        if (marked[dateStr].dots && marked[dateStr].dots.length < 3) {
          marked[dateStr].dots.push({
            color: getExerciseColor(session.exerciseType),
            key: `${session.id}`,
          });
        }
      });
    }

    // Mark selected date
    if (marked[selectedDate]) {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = THEME_COLORS.primary;
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: THEME_COLORS.primary,
      };
    }

    // Mark today
    if (!marked[today]) {
      marked[today] = {};
    }

    return marked;
  }, [monthSessions, selectedDate, today]);

  // Get sessions for the selected date
  const selectedDaySessions = useMemo<TrainingSession[]>(() => {
    if (!monthSessions) return [];
    return monthSessions.filter(
      (session: TrainingSession) => formatDateString(session.createdAt) === selectedDate
    );
  }, [monthSessions, selectedDate]);

  // Handle day press
  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  // Handle month change
  const handleMonthChange = useCallback((month: DateData) => {
    setCurrentMonth(month.dateString.substring(0, 7));
  }, []);

  // Handle session press
  const handleSessionPress = useCallback(
    (sessionId: string) => {
      onSessionPress?.(sessionId);
    },
    [onSessionPress]
  );

  // Format selected date for display
  const formatSelectedDateDisplay = (dateStr: string): string => {
    const parts = dateStr.split("-");
    const year = parts[0] ?? "";
    const month = parts[1] ?? "";
    const day = parts[2] ?? "";
    return `${year}年${parseInt(month)}月${parseInt(day)}日`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>データの読み込みに失敗しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Calendar */}
      <Surface style={styles.calendarCard} elevation={1}>
        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          onMonthChange={handleMonthChange}
          markingType="multi-dot"
          markedDates={markedDates}
          firstDay={0} // Sunday first
          theme={{
            backgroundColor: THEME_COLORS.surface,
            calendarBackground: THEME_COLORS.surface,
            textSectionTitleColor: THEME_COLORS.textSecondary,
            selectedDayBackgroundColor: THEME_COLORS.primary,
            selectedDayTextColor: THEME_COLORS.surface,
            todayTextColor: THEME_COLORS.primary,
            todayBackgroundColor: `${THEME_COLORS.primary}20`,
            dayTextColor: THEME_COLORS.text,
            textDisabledColor: "#D0D0D0",
            dotColor: THEME_COLORS.primary,
            selectedDotColor: THEME_COLORS.surface,
            arrowColor: THEME_COLORS.primary,
            monthTextColor: THEME_COLORS.text,
            indicatorColor: THEME_COLORS.primary,
            textDayFontWeight: "400",
            textMonthFontWeight: "bold",
            textDayHeaderFontWeight: "600",
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
        />
      </Surface>

      {/* Session List Header */}
      <View style={styles.sessionListHeader}>
        <Text variant="titleMedium" style={styles.sessionListTitle}>
          {formatSelectedDateDisplay(selectedDate)} のトレーニング
        </Text>
        <Text variant="bodySmall" style={styles.sessionCount}>
          {selectedDaySessions.length}件
        </Text>
      </View>

      {/* Session List */}
      {selectedDaySessions.length === 0 ? (
        <Surface style={styles.emptyCard} elevation={1}>
          <Text style={styles.emptyText}>この日はトレーニングがありません</Text>
        </Surface>
      ) : (
        <Surface style={styles.sessionListCard} elevation={1}>
          <FlatList
            data={selectedDaySessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SessionListItem
                session={item}
                onPress={() => handleSessionPress(item.id)}
              />
            )}
            scrollEnabled={false}
          />
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: THEME_COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
  calendarCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: "hidden",
  },
  sessionListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sessionListTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  sessionCount: {
    color: THEME_COLORS.textSecondary,
  },
  sessionListCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  emptyCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: THEME_COLORS.textSecondary,
  },
});

export default CalendarView;
