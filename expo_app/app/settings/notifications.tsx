/**
 * 通知設定画面
 *
 * リマインダー通知の時刻設定、通知頻度、プッシュ通知許可などを管理する画面です。
 *
 * @see docs/expo/tickets/028-notification-settings.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { Stack, router } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ScrollView, Alert, Platform } from "react-native";
import {
  Appbar,
  List,
  Switch,
  RadioButton,
  Chip,
  Button,
  Text,
  Divider,
  ActivityIndicator,
  Surface,
} from "react-native-paper";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useNotificationStore,
  DayOfWeek,
  FrequencyPreset,
  getDayLabel,
  ALL_DAYS,
} from "@/stores/notificationStore";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  openNotificationSettings,
  saveNotificationSettings,
  getNotificationSettings,
  scheduleTrainingReminder,
  cancelAllScheduledNotifications,
  NotificationPermissionStatus,
} from "@/services/notification/notificationService";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  error: "#F44336",
  warning: "#FF9800",
};

/**
 * NotificationSettingsScreen Component
 */
export default function NotificationSettingsScreen() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus | null>(
    null
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    trainingReminder,
    reminderTime,
    reminderDays,
    frequencyPreset,
    timezone,
    setTrainingReminder,
    setReminderTime,
    setFrequencyPreset,
    toggleDay,
    markSynced,
    loadFromServer,
  } = useNotificationStore();

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get notification permission status
        const status = await getNotificationPermissionStatus();
        setPermissionStatus(status);

        // Get settings from server
        const serverSettings = await getNotificationSettings();
        if (serverSettings) {
          loadFromServer(serverSettings);
        }
      } catch (error) {
        console.error("[NotificationSettings] Failed to initialize:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [loadFromServer]);

  // Handle permission request
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    const status = await getNotificationPermissionStatus();
    setPermissionStatus(status);

    if (!granted) {
      Alert.alert(
        "通知が許可されていません",
        "通知を受け取るには、設定アプリから通知を許可してください。",
        [
          { text: "キャンセル", style: "cancel" },
          { text: "設定を開く", onPress: openNotificationSettings },
        ]
      );
    }
  }, []);

  // Handle time change
  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowTimePicker(Platform.OS === "ios");
      if (selectedDate && event.type === "set") {
        const hours = selectedDate.getHours();
        const minutes = selectedDate.getMinutes();
        setReminderTime(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
      }
    },
    [setReminderTime]
  );

  // Get time as Date object for picker
  const getTimeAsDate = useCallback((): Date => {
    const parts = reminderTime.split(":").map(Number);
    const hours = parts[0] ?? 19;
    const minutes = parts[1] ?? 0;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [reminderTime]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveNotificationSettings({
        trainingReminder,
        reminderTime,
        reminderDays,
        timezone,
      });

      // Schedule or cancel notifications based on settings
      if (trainingReminder && permissionStatus?.granted) {
        await scheduleTrainingReminder(reminderTime, reminderDays);
      } else {
        await cancelAllScheduledNotifications();
      }

      markSynced();
      Alert.alert("保存完了", "通知設定を保存しました", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("エラー", "設定の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }, [
    trainingReminder,
    reminderTime,
    reminderDays,
    timezone,
    permissionStatus,
    markSynced,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => (
              <Appbar.Header style={styles.header}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="通知設定" titleStyle={styles.headerTitle} />
              </Appbar.Header>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="通知設定" titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notification Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <List.Section>
            <List.Subheader style={styles.sectionTitle}>プッシュ通知</List.Subheader>
            <View style={styles.permissionSection}>
              <Text variant="bodyMedium" style={styles.permissionText}>
                通知の許可状態:{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {permissionStatus?.granted ? "許可済み" : "未許可"}
                </Text>
              </Text>
              {!permissionStatus?.granted && (
                <Button
                  mode="outlined"
                  onPress={handleRequestPermission}
                  style={styles.permissionButton}
                  textColor={THEME_COLORS.primary}
                >
                  {permissionStatus?.canAskAgain ? "通知を許可する" : "設定を開く"}
                </Button>
              )}
            </View>
          </List.Section>
        </Surface>

        {/* Training Reminder Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <List.Section>
            <List.Subheader style={styles.sectionTitle}>
              トレーニングリマインダー
            </List.Subheader>

            <List.Item
              title="リマインダー通知"
              description="設定した時刻にトレーニングをお知らせ"
              left={(props) => <List.Icon {...props} icon="bell-ring" />}
              right={() => (
                <Switch
                  value={trainingReminder}
                  onValueChange={setTrainingReminder}
                  disabled={!permissionStatus?.granted}
                  color={THEME_COLORS.primary}
                />
              )}
            />

            {trainingReminder && (
              <>
                <Divider />

                {/* Time Setting */}
                <List.Item
                  title="通知時刻"
                  description={reminderTime}
                  left={(props) => <List.Icon {...props} icon="clock-outline" />}
                  onPress={() => setShowTimePicker(true)}
                />

                {showTimePicker && (
                  <DateTimePicker
                    value={getTimeAsDate()}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                  />
                )}

                <Divider />

                {/* Frequency Setting */}
                <View style={styles.frequencySection}>
                  <Text variant="labelLarge" style={styles.frequencyTitle}>
                    通知頻度
                  </Text>
                  <RadioButton.Group
                    onValueChange={(value) => setFrequencyPreset(value as FrequencyPreset)}
                    value={frequencyPreset}
                  >
                    <RadioButton.Item label="毎日" value="daily" />
                    <RadioButton.Item label="週3回（月・水・金）" value="three_times" />
                    <RadioButton.Item label="週1回（日曜日）" value="weekly" />
                    <RadioButton.Item label="カスタム" value="custom" />
                  </RadioButton.Group>
                </View>

                {/* Day Selection */}
                {frequencyPreset === "custom" && (
                  <View style={styles.daysContainer}>
                    <Text variant="labelMedium" style={styles.daysLabel}>
                      曜日を選択
                    </Text>
                    <View style={styles.daysRow}>
                      {ALL_DAYS.map((day) => (
                        <Chip
                          key={day}
                          selected={reminderDays.includes(day)}
                          onPress={() => toggleDay(day)}
                          style={styles.dayChip}
                          showSelectedCheck={false}
                          mode={reminderDays.includes(day) ? "flat" : "outlined"}
                        >
                          {getDayLabel(day)}
                        </Chip>
                      ))}
                    </View>
                    {reminderDays.length === 0 && (
                      <Text style={styles.errorText}>
                        少なくとも1つの曜日を選択してください
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </List.Section>
        </Surface>

        {/* Timezone Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <List.Section>
            <List.Subheader style={styles.sectionTitle}>タイムゾーン</List.Subheader>
            <List.Item
              title="検出されたタイムゾーン"
              description={timezone}
              left={(props) => <List.Icon {...props} icon="earth" />}
            />
          </List.Section>
        </Surface>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={reminderDays.length === 0 && trainingReminder}
            style={styles.saveButton}
            buttonColor={THEME_COLORS.primary}
          >
            設定を保存
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    backgroundColor: THEME_COLORS.surface,
    elevation: 0,
  },
  headerTitle: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: THEME_COLORS.textSecondary,
  },
  sectionCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  permissionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  permissionText: {
    color: THEME_COLORS.text,
  },
  permissionButton: {
    marginTop: 12,
  },
  frequencySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  frequencyTitle: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  daysLabel: {
    color: THEME_COLORS.textSecondary,
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    marginBottom: 4,
  },
  errorText: {
    color: THEME_COLORS.error,
    fontSize: 12,
    marginTop: 8,
  },
  buttonContainer: {
    padding: 16,
    paddingTop: 24,
  },
  saveButton: {
    paddingVertical: 8,
  },
});
