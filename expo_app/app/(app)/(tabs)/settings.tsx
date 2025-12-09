/**
 * 設定画面（スタブ）
 *
 * アプリ設定、アカウント管理、データ管理などを提供します。
 * 詳細な実装は後続のチケットで行います。
 *
 * @see docs/expo/specs/05_画面遷移図_Expo版_v1.md
 */

import { router } from "expo-router";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks";
import { useAuthStore } from "@/stores";

/**
 * 設定メニュー項目の型
 */
interface SettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}

export default function SettingsScreen() {
  const { user } = useAuthStore();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert(
      "ログアウト",
      "ログアウトしてもよろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "ログアウト",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/(auth)/login");
            } catch {
              Alert.alert("エラー", "ログアウトに失敗しました");
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "アカウント削除",
      "アカウントを削除すると、すべてのデータが失われます。この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => {
            // TODO: Implement account deletion
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
      ]
    );
  };

  const settingsSections: { title: string; items: SettingsItem[] }[] = [
    {
      title: "アカウント",
      items: [
        {
          id: "profile",
          title: "プロフィール",
          subtitle: user?.email || "",
          onPress: () => {
            // TODO: Navigate to profile screen
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
        {
          id: "notifications",
          title: "通知設定",
          onPress: () => {
            // TODO: Navigate to notification settings
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
      ],
    },
    {
      title: "アプリ設定",
      items: [
        {
          id: "theme",
          title: "テーマ",
          subtitle: "システム設定に従う",
          onPress: () => {
            // TODO: Open theme picker
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
        {
          id: "language",
          title: "言語",
          subtitle: "日本語",
          onPress: () => {
            // TODO: Open language picker
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
      ],
    },
    {
      title: "データ",
      items: [
        {
          id: "export",
          title: "データをエクスポート",
          onPress: () => {
            // TODO: Implement data export
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
        {
          id: "delete-data",
          title: "トレーニングデータを削除",
          onPress: () => {
            // TODO: Implement data deletion
            Alert.alert("準備中", "この機能は現在開発中です");
          },
          danger: true,
        },
      ],
    },
    {
      title: "サポート",
      items: [
        {
          id: "help",
          title: "ヘルプ",
          onPress: () => {
            // TODO: Open help page
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
        {
          id: "privacy",
          title: "プライバシーポリシー",
          onPress: () => {
            // TODO: Open privacy policy
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
        {
          id: "terms",
          title: "利用規約",
          onPress: () => {
            // TODO: Open terms of service
            Alert.alert("準備中", "この機能は現在開発中です");
          },
        },
      ],
    },
    {
      title: "",
      items: [
        {
          id: "logout",
          title: "ログアウト",
          onPress: handleSignOut,
        },
        {
          id: "delete-account",
          title: "アカウントを削除",
          onPress: handleDeleteAccount,
          danger: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            {section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null}
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingsItem,
                    itemIndex < section.items.length - 1 && styles.settingsItemBorder,
                  ]}
                  onPress={item.onPress}
                >
                  <View style={styles.settingsItemContent}>
                    <Text
                      style={[styles.settingsItemTitle, item.danger && styles.dangerText]}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.settingsItemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <Text style={styles.settingsItemArrow}>{">"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>AI Fitness v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionContent: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    color: "#333",
  },
  settingsItemSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  settingsItemArrow: {
    fontSize: 16,
    color: "#ccc",
  },
  dangerText: {
    color: "#dc3545",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 14,
    color: "#999",
  },
});
