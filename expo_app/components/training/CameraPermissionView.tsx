/**
 * Camera Permission View Component
 *
 * Displays when camera permission is not granted.
 * Provides UI to request permission or navigate to settings.
 *
 * Reference: docs/expo/tickets/012-camera-implementation.md
 */

import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { Text, Button, Surface, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface CameraPermissionViewProps {
  /** Called when user requests permission */
  onRequestPermission: () => void;
  /** Called when user wants to open settings */
  onOpenSettings: () => void;
  /** Whether permission was denied (show settings option) */
  wasDenied?: boolean;
  /** Custom title text */
  title?: string;
  /** Custom description text */
  description?: string;
  /** Back button handler */
  onBack?: () => void;
}

/**
 * Camera Permission View
 *
 * Shows when camera permission is needed or denied.
 * Provides clear instructions and actions for the user.
 *
 * @example
 * <CameraPermissionView
 *   onRequestPermission={requestPermission}
 *   onOpenSettings={openSettings}
 *   wasDenied={permissionStatus === 'denied'}
 *   onBack={() => router.back()}
 * />
 */
export function CameraPermissionView({
  onRequestPermission,
  onOpenSettings,
  wasDenied = false,
  title,
  description,
  onBack,
}: CameraPermissionViewProps) {
  const theme = useTheme();

  const defaultTitle = wasDenied ? "カメラの許可が必要です" : "カメラを使用しますか？";

  const defaultDescription = wasDenied
    ? "トレーニング機能を使用するには、設定からカメラへのアクセスを許可してください。プライバシー保護のため、カメラ映像はデバイス内でのみ処理され、サーバーには送信されません。"
    : "トレーニング中のフォームを確認するためにカメラを使用します。カメラ映像はデバイス内でのみ処理され、サーバーには送信されません。";

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name={wasDenied ? "camera-off" : "camera"}
            size={48}
            color={theme.colors.primary}
          />
        </View>

        {/* Title */}
        <Text variant="headlineSmall" style={styles.title}>
          {title ?? defaultTitle}
        </Text>

        {/* Description */}
        <Text style={styles.description}>{description ?? defaultDescription}</Text>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <MaterialCommunityIcons name="shield-check" size={20} color={theme.colors.primary} />
          <Text style={[styles.privacyText, { color: theme.colors.primary }]}>
            プライバシーを保護します
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {wasDenied ? (
            <>
              <Button mode="contained" onPress={onOpenSettings} style={styles.primaryButton}>
                設定を開く
              </Button>
              <Button mode="text" onPress={onRequestPermission} style={styles.secondaryButton}>
                再度確認する
              </Button>
            </>
          ) : (
            <Button mode="contained" onPress={onRequestPermission} style={styles.primaryButton}>
              カメラを許可する
            </Button>
          )}

          {onBack && (
            <Button mode="outlined" onPress={onBack} style={styles.backButton}>
              戻る
            </Button>
          )}
        </View>

        {/* Platform note */}
        {Platform.OS === "android" && (
          <Text style={styles.platformNote}>
            ※ 権限ダイアログが表示されない場合は、端末の設定から許可してください
          </Text>
        )}
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    maxWidth: 400,
    width: "100%",
    alignItems: "center",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "bold",
  },
  description: {
    marginBottom: 16,
    textAlign: "center",
    color: "#666",
    lineHeight: 22,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f7f0",
    borderRadius: 8,
    gap: 8,
  },
  privacyText: {
    fontSize: 14,
    fontWeight: "500",
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    borderRadius: 8,
  },
  secondaryButton: {
    borderRadius: 8,
  },
  backButton: {
    borderRadius: 8,
    marginTop: 4,
  },
  platformNote: {
    marginTop: 16,
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
});

export default CameraPermissionView;
