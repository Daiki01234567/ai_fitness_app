/**
 * プロフィール画面
 *
 * ユーザー情報の表示・編集、統計情報、同意管理、データ管理を提供します。
 *
 * 機能:
 * - ユーザープロフィール表示（アバター、名前、メール、登録日）
 * - 基本情報表示（身長、体重、生年月日）
 * - 統計情報表示（総セッション数、総トレーニング時間、平均スコア）
 * - 同意状況表示（利用規約、プライバシーポリシー）
 * - 同意解除機能（確認ダイアログ→強制ログアウト）
 * - データ管理ボタン（エクスポート、削除）
 * - 設定画面への遷移
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md 3.12節
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
  Dialog,
  Portal,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks";
import { useAuthStore, useUserStore } from "@/stores";

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
 * Profile screen component
 *
 * Displays user profile, statistics, consent status, and data management options.
 * Provides navigation to settings screen.
 */
export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const { profile, clearProfile, updateProfile } = useUserStore();
  const { signOut, isLoading: authLoading } = useAuth();

  // Dialog states
  const [revokeConsentDialogVisible, setRevokeConsentDialogVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get display values with fallbacks
  const displayName = profile?.displayName || user?.displayName || "ユーザー";
  const email = profile?.email || user?.email || "メールアドレス未設定";
  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("ja-JP")
    : "不明";

  // Consent status
  const tosAccepted = profile?.tosAccepted ?? true;
  const ppAccepted = profile?.ppAccepted ?? true;

  // Handle consent revocation
  const handleRevokeConsent = async () => {
    setRevokeConsentDialogVisible(false);
    setIsProcessing(true);

    try {
      // Update profile to revoke consent
      updateProfile({
        tosAccepted: false,
        ppAccepted: false,
      });

      // Sign out user
      await signOut();
      clearAuth();
      clearProfile();

      Alert.alert(
        "同意を解除しました",
        "同意が解除されました。ご利用ありがとうございました。",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error) {
      setIsProcessing(false);
      Alert.alert(
        "エラー",
        "同意解除に失敗しました。もう一度お試しください。"
      );
    }
  };

  // Handle edit profile button press
  const handleEditProfile = () => {
    Alert.alert("準備中", "プロフィール編集機能は現在開発中です");
  };

  // Handle data export button press
  const handleDataExport = () => {
    Alert.alert("準備中", "データエクスポート機能は現在開発中です");
  };

  // Handle data deletion button press
  const handleDataDelete = () => {
    Alert.alert("準備中", "データ削除機能は現在開発中です");
  };

  // Handle settings navigation
  const handleSettingsNavigation = () => {
    router.push("/settings");
  };

  // Render loading overlay when processing
  if (isProcessing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          同意を解除しています...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card Section */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.profileHeader}>
            <Avatar.Icon
              size={80}
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
        </Surface>

        {/* Basic Information Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="titleMedium" style={styles.sectionHeader}>
              基本情報
            </Text>
            <Button
              mode="text"
              onPress={handleEditProfile}
              textColor={THEME_COLORS.primary}
              compact
              icon="pencil"
            >
              編集
            </Button>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              ニックネーム
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {displayName}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              メールアドレス
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {email}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              身長
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              --
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              体重
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              --
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              生年月日
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              --
            </Text>
          </View>
        </Surface>

        {/* Statistics Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            統計情報
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>
                0
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                総セッション数
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>
                0分
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                総トレーニング時間
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>
                --
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                平均参考スコア
              </Text>
            </View>
          </View>
        </Surface>

        {/* Consent Status Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            同意状況
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="利用規約"
            description={tosAccepted ? "同意済み" : "未同意"}
            left={(props) => (
              <List.Icon
                {...props}
                icon="file-document-outline"
                color={tosAccepted ? THEME_COLORS.success : THEME_COLORS.warning}
              />
            )}
            right={() => (
              <MaterialCommunityIcons
                name={tosAccepted ? "check-circle" : "alert-circle"}
                size={24}
                color={tosAccepted ? THEME_COLORS.success : THEME_COLORS.warning}
              />
            )}
          />
          <Divider />
          <List.Item
            title="プライバシーポリシー"
            description={ppAccepted ? "同意済み" : "未同意"}
            left={(props) => (
              <List.Icon
                {...props}
                icon="shield-lock-outline"
                color={ppAccepted ? THEME_COLORS.success : THEME_COLORS.warning}
              />
            )}
            right={() => (
              <MaterialCommunityIcons
                name={ppAccepted ? "check-circle" : "alert-circle"}
                size={24}
                color={ppAccepted ? THEME_COLORS.success : THEME_COLORS.warning}
              />
            )}
          />
          {(tosAccepted || ppAccepted) && (
            <>
              <Divider />
              <List.Item
                title="同意を解除"
                description="サービスを利用できなくなります"
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon="cancel"
                    color={THEME_COLORS.error}
                  />
                )}
                onPress={() => setRevokeConsentDialogVisible(true)}
                right={() => <List.Icon icon="chevron-right" />}
                titleStyle={{ color: THEME_COLORS.error }}
              />
            </>
          )}
        </Surface>

        {/* Data Management Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            データ管理
          </Text>
          <Divider style={styles.divider} />
          <List.Item
            title="データをエクスポート"
            description="トレーニングデータをダウンロード"
            left={(props) => <List.Icon {...props} icon="download" />}
            onPress={handleDataExport}
            right={() => <List.Icon icon="chevron-right" />}
          />
          <Divider />
          <List.Item
            title="データを削除"
            description="トレーニング記録を削除"
            left={(props) => (
              <List.Icon {...props} icon="delete-outline" color={THEME_COLORS.error} />
            )}
            onPress={handleDataDelete}
            right={() => <List.Icon icon="chevron-right" />}
            titleStyle={{ color: THEME_COLORS.error }}
          />
        </Surface>

        {/* Settings Button */}
        <Button
          mode="outlined"
          onPress={handleSettingsNavigation}
          style={styles.settingsButton}
          textColor={THEME_COLORS.primary}
          icon="cog"
        >
          設定
        </Button>
      </ScrollView>

      {/* Revoke Consent Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={revokeConsentDialogVisible}
          onDismiss={() => setRevokeConsentDialogVisible(false)}
        >
          <Dialog.Title>同意を解除しますか?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              同意を解除すると、サービスを利用できなくなります。
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginTop: 12, fontWeight: "bold" }}
            >
              この操作を行うと、自動的にログアウトされます。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRevokeConsentDialogVisible(false)}>
              キャンセル
            </Button>
            <Button
              onPress={handleRevokeConsent}
              textColor={THEME_COLORS.error}
              loading={authLoading}
            >
              同意を解除してログアウト
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
  // Section Card
  sectionCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeader: {
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  // Basic Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    color: THEME_COLORS.textSecondary,
  },
  infoValue: {
    color: THEME_COLORS.text,
  },
  // Statistics
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
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
    textAlign: "center",
  },
  // Settings Button
  settingsButton: {
    borderColor: THEME_COLORS.primary,
    marginTop: 8,
  },
});
