/**
 * 設定画面
 *
 * アプリの各種設定とアカウント管理を提供します。
 *
 * 機能:
 * - トレーニング設定（音声フィードバック ON/OFF）
 * - 通知設定（リマインダー、お知らせ）
 * - アカウント管理（サブスクリプション、利用規約、プライバシーポリシー、お問い合わせ）
 * - ログアウト機能
 * - アカウント削除機能（確認ダイアログ付き）
 * - アプリバージョン表示
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md 3.13節
 * @see docs/expo/tickets/027-settings-screen.md
 */

import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import {
  Surface,
  Text,
  Button,
  List,
  Divider,
  Switch,
  Dialog,
  Portal,
  ActivityIndicator,
  Appbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks";
import { useAuthStore, useUserStore, useSettingsStore } from "@/stores";

/**
 * Theme colors following Material Design 3 guidelines
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  error: "#F44336",
  success: "#4CAF50",
  warning: "#FF9800",
};

/**
 * Settings screen component
 *
 * Provides app settings, account management, and logout/delete functionality.
 * Accessible from Profile screen.
 */
export default function SettingsScreen() {
  const { clearAuth } = useAuthStore();
  const { clearProfile } = useUserStore();
  const { signOut, deleteAccount, isLoading: authLoading } = useAuth();

  // Dialog states
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings states (stored in SettingsStore)
  const settings = useSettingsStore();
  const [audioFeedback, setAudioFeedback] = useState(settings.audioFeedback ?? true);
  const [reminderNotification, setReminderNotification] = useState(settings.reminderNotification ?? false);
  const [newsNotification, setNewsNotification] = useState(settings.newsNotification ?? true);

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Handle logout
  const handleLogout = async () => {
    setLogoutDialogVisible(false);
    try {
      await signOut();
      clearAuth();
      clearProfile();
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("エラー", "ログアウトに失敗しました。もう一度お試しください。");
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    setDeleteDialogVisible(false);
    setIsDeleting(true);

    try {
      await deleteAccount();
      clearAuth();
      clearProfile();
      Alert.alert(
        "アカウント削除完了",
        "アカウントが削除されました。ご利用ありがとうございました。",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error) {
      setIsDeleting(false);
      Alert.alert(
        "エラー",
        "アカウントの削除に失敗しました。再度ログインしてからお試しください。"
      );
    }
  };

  // Handle settings changes
  const handleAudioFeedbackChange = (value: boolean) => {
    setAudioFeedback(value);
    settings.setAudioFeedback(value);
  };

  const handleReminderNotificationChange = (value: boolean) => {
    setReminderNotification(value);
    settings.setReminderNotification(value);
  };

  const handleNewsNotificationChange = (value: boolean) => {
    setNewsNotification(value);
    settings.setNewsNotification(value);
  };

  // Render loading overlay when deleting
  if (isDeleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          アカウントを削除しています...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header with back button */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="設定" />
      </Appbar.Header>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Training Settings */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            トレーニング
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="音声フィードバック"
            description="トレーニング中の音声ガイド"
            left={(props) => <List.Icon {...props} icon="volume-high" />}
            right={() => (
              <Switch
                value={audioFeedback}
                onValueChange={handleAudioFeedbackChange}
                color={THEME_COLORS.primary}
              />
            )}
          />
        </Surface>

        {/* Notification Settings */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            通知
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="リマインダー通知"
            description="トレーニングのリマインド"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={() => (
              <Switch
                value={reminderNotification}
                onValueChange={handleReminderNotificationChange}
                color={THEME_COLORS.primary}
              />
            )}
          />
          <Divider />
          <List.Item
            title="お知らせ通知"
            description="アプリからのお知らせ"
            left={(props) => <List.Icon {...props} icon="bell-ring-outline" />}
            right={() => (
              <Switch
                value={newsNotification}
                onValueChange={handleNewsNotificationChange}
                color={THEME_COLORS.primary}
              />
            )}
          />
          <Divider />
          <List.Item
            title="通知の詳細設定"
            description="時刻や頻度を設定"
            left={(props) => <List.Icon {...props} icon="cog-outline" />}
            right={() => <List.Icon icon="chevron-right" />}
            onPress={() => router.push("/settings/notifications")}
          />
        </Surface>

        {/* Account Section */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            アカウント
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="サブスクリプション管理"
            left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
            onPress={() => {
              // TODO: Navigate to subscription management (Phase 3)
              Alert.alert("準備中", "サブスクリプション管理機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="利用規約"
            left={(props) => <List.Icon {...props} icon="file-document-outline" />}
            onPress={() => {
              // TODO: Open terms of service
              Alert.alert("準備中", "利用規約表示機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="プライバシーポリシー"
            left={(props) => <List.Icon {...props} icon="shield-lock-outline" />}
            onPress={() => {
              // TODO: Open privacy policy
              Alert.alert("準備中", "プライバシーポリシー表示機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="お問い合わせ"
            left={(props) => <List.Icon {...props} icon="email-outline" />}
            onPress={() => router.push("/help/contact")}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="ログアウト"
            left={(props) => <List.Icon {...props} icon="logout" />}
            onPress={() => setLogoutDialogVisible(true)}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="アカウントを削除"
            left={(props) => (
              <List.Icon {...props} icon="account-remove" color={THEME_COLORS.error} />
            )}
            onPress={() => setDeleteDialogVisible(true)}
            right={() => <List.Icon icon="chevron-right" />}
            titleStyle={{ color: THEME_COLORS.error }}
          />
        </Surface>

        {/* App Info Section */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            アプリ情報
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="バージョン"
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
        </Surface>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={logoutDialogVisible}
          onDismiss={() => setLogoutDialogVisible(false)}
        >
          <Dialog.Title>ログアウト</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              ログアウトしてもよろしいですか？
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>
              キャンセル
            </Button>
            <Button
              onPress={handleLogout}
              textColor={THEME_COLORS.error}
              loading={authLoading}
            >
              ログアウト
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Account Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>アカウント削除</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              アカウントを削除すると、すべてのデータが完全に削除されます。
              この操作は取り消せません。
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginTop: 12, fontWeight: "bold" }}
            >
              本当に削除してもよろしいですか？
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              キャンセル
            </Button>
            <Button
              onPress={handleDeleteAccount}
              textColor={THEME_COLORS.error}
            >
              削除する
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME_COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: THEME_COLORS.textSecondary,
  },
  // Settings Card
  settingsCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
});
