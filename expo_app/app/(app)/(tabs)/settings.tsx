/**
 * 設定画面（プロフィール機能含む）
 *
 * アプリ設定、ユーザープロフィール、アカウント管理を提供します。
 *
 * 機能:
 * - ユーザープロフィール表示・編集
 * - 同意状況の表示
 * - アプリ設定（テーマ、通知など）
 * - ログアウト機能
 * - アカウント削除機能（確認ダイアログ付き）
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/expo/tickets/009-profile-screen.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import {
  Surface,
  Text,
  Button,
  List,
  Avatar,
  Divider,
  Switch,
  Dialog,
  Portal,
  ActivityIndicator,
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
 */
export default function SettingsScreen() {
  const { user, clearAuth } = useAuthStore();
  const { profile, clearProfile } = useUserStore();
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

  // Get display name with fallback
  const displayName = profile?.displayName || user?.displayName || "ユーザー";
  const email = profile?.email || user?.email || "メールアドレス未設定";
  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("ja-JP")
    : "不明";

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
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.profileHeader}>
            <Avatar.Icon
              size={72}
              icon="account"
              style={{ backgroundColor: THEME_COLORS.primary }}
            />
            <View style={styles.profileInfo}>
              <Text variant="titleLarge" style={styles.profileName}>
                {displayName}
              </Text>
              <Text variant="bodyMedium" style={styles.profileEmail}>
                {email}
              </Text>
              <Text variant="bodySmall" style={styles.profileDate}>
                登録日: {createdAt}
              </Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              // TODO: Navigate to profile edit screen (Phase 2)
              Alert.alert("準備中", "プロフィール編集機能は現在開発中です");
            }}
            style={styles.editProfileButton}
            textColor={THEME_COLORS.primary}
            icon="pencil"
          >
            プロフィールを編集
          </Button>
        </Surface>

        {/* Stats Section */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            統計情報
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>0</Text>
              <Text variant="bodySmall" style={styles.statLabel}>総セッション</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>0分</Text>
              <Text variant="bodySmall" style={styles.statLabel}>総トレーニング時間</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>--</Text>
              <Text variant="bodySmall" style={styles.statLabel}>平均スコア</Text>
            </View>
          </View>
        </Surface>

        {/* Consent Status Section */}
        <Surface style={styles.consentCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            同意状況
          </Text>
          <List.Item
            title="利用規約"
            description="同意済み"
            left={(props) => (
              <List.Icon
                {...props}
                icon="file-document-outline"
                color={THEME_COLORS.success}
              />
            )}
            right={() => (
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={THEME_COLORS.success}
              />
            )}
          />
          <Divider />
          <List.Item
            title="プライバシーポリシー"
            description="同意済み"
            left={(props) => (
              <List.Icon
                {...props}
                icon="shield-lock-outline"
                color={THEME_COLORS.success}
              />
            )}
            right={() => (
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={THEME_COLORS.success}
              />
            )}
          />
        </Surface>

        {/* Training Settings */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            トレーニング設定
          </Text>
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
            通知設定
          </Text>
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
        </Surface>

        {/* Data Management */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            データ管理
          </Text>
          <List.Item
            title="データをエクスポート"
            description="トレーニングデータをダウンロード"
            left={(props) => <List.Icon {...props} icon="download" />}
            onPress={() => {
              // TODO: Implement data export (Phase 2)
              Alert.alert("準備中", "データエクスポート機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="データを削除"
            description="トレーニング記録を削除"
            left={(props) => (
              <List.Icon {...props} icon="delete-outline" color={THEME_COLORS.error} />
            )}
            onPress={() => {
              // TODO: Implement data deletion (Phase 2)
              Alert.alert("準備中", "データ削除機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
            titleStyle={{ color: THEME_COLORS.error }}
          />
        </Surface>

        {/* Support Section */}
        <Surface style={styles.settingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            サポート
          </Text>
          <List.Item
            title="ヘルプ"
            left={(props) => <List.Icon {...props} icon="help-circle-outline" />}
            onPress={() => {
              // TODO: Navigate to help center (Phase 2)
              Alert.alert("準備中", "ヘルプ機能は現在開発中です");
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
            onPress={() => {
              // TODO: Open contact form
              Alert.alert("準備中", "お問い合わせ機能は現在開発中です");
            }}
            right={() => <List.Icon icon="chevron-right" />}
          />
        </Surface>

        {/* Account Actions */}
        <Surface style={styles.accountActionsCard} elevation={1}>
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

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text variant="bodySmall" style={styles.versionText}>
            AI Fitness v1.0.0
          </Text>
        </View>
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
  // Profile Card
  profileCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  profileEmail: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  profileDate: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  editProfileButton: {
    borderColor: THEME_COLORS.primary,
  },
  // Stats Card
  statsCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: THEME_COLORS.primary,
    fontWeight: "bold",
  },
  statLabel: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  // Consent Card
  consentCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },
  // Settings Card
  settingsCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },
  // Account Actions Card
  accountActionsCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
  },
  // Version
  versionContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  versionText: {
    color: THEME_COLORS.textSecondary,
  },
});
