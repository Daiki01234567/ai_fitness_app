/**
 * Camera Test Screen
 *
 * Basic camera preview screen to verify react-native-vision-camera
 * integration works correctly with Development Build.
 *
 * Reference: docs/expo/tickets/011-mediapipe-poc.md
 */

import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View, Platform, Linking, Alert } from "react-native";
import { Text, Button, ActivityIndicator, Surface, Chip } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

// VisionCamera - only available on native platforms
let Camera: typeof import("react-native-vision-camera").Camera | null = null;
let useCameraDevice: typeof import("react-native-vision-camera").useCameraDevice | null = null;
let useCameraPermission: typeof import("react-native-vision-camera").useCameraPermission | null =
  null;

if (Platform.OS !== "web") {
  try {
    const VisionCamera = require("react-native-vision-camera");
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCameraPermission = VisionCamera.useCameraPermission;
  } catch (error) {
    console.warn("react-native-vision-camera not available:", error);
  }
}

/**
 * Permission status component
 */
function PermissionStatus({
  hasPermission,
  onRequest,
}: {
  hasPermission: boolean;
  onRequest: () => void;
}) {
  if (hasPermission) {
    return (
      <Chip icon="check-circle" mode="flat" style={styles.permissionChip}>
        カメラ許可済み
      </Chip>
    );
  }

  return (
    <View style={styles.permissionContainer}>
      <Text style={styles.permissionText}>カメラの使用許可が必要です</Text>
      <Button mode="contained" onPress={onRequest} style={styles.permissionButton}>
        許可する
      </Button>
    </View>
  );
}

/**
 * Web fallback component
 */
function WebFallback() {
  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <Text variant="headlineSmall" style={styles.fallbackTitle}>
          カメラテスト
        </Text>
        <Text style={styles.fallbackText}>
          このテストはネイティブプラットフォーム（iOS/Android）でのみ実行できます。
        </Text>
        <Text style={styles.fallbackNote}>
          Development Buildを作成し、実機またはエミュレータで実行してください。
        </Text>
        <View style={styles.commandBox}>
          <Text style={styles.commandLabel}>iOS:</Text>
          <Text style={styles.commandText}>npx expo run:ios</Text>
          <Text style={styles.commandLabel}>Android:</Text>
          <Text style={styles.commandText}>npx expo run:android</Text>
        </View>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          戻る
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

/**
 * Loading state component
 */
function LoadingState({ message }: { message: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

/**
 * Camera not available component
 */
function CameraNotAvailable() {
  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <Text variant="headlineSmall" style={styles.errorTitle}>
          カメラが利用できません
        </Text>
        <Text style={styles.fallbackText}>
          このデバイスではカメラを利用できないか、
          react-native-vision-cameraのセットアップが完了していません。
        </Text>
        <Text style={styles.fallbackNote}>
          Development Buildが必要です。 Expo Goでは動作しません。
        </Text>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          戻る
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

/**
 * Main camera preview component
 */
function CameraPreview() {
  const [isReady, setIsReady] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>("");

  // Use hooks from VisionCamera
  const { hasPermission, requestPermission } = useCameraPermission!();
  const device = useCameraDevice!("back");

  // Request permission handler
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert("カメラの許可が必要です", "設定アプリからカメラの使用を許可してください。", [
        { text: "キャンセル", style: "cancel" },
        { text: "設定を開く", onPress: () => Linking.openSettings() },
      ]);
    }
  }, [requestPermission]);

  // Update device info when device changes
  useEffect(() => {
    if (device) {
      setDeviceInfo(`${device.name} (${device.position})`);
    }
  }, [device]);

  // Handle camera initialized
  const handleCameraInitialized = useCallback(() => {
    setIsReady(true);
    console.log("[CameraTest] Camera initialized successfully");
  }, []);

  // Handle camera error
  const handleCameraError = useCallback((error: Error) => {
    console.error("[CameraTest] Camera error:", error);
    Alert.alert("カメラエラー", error.message);
  }, []);

  // Show loading while checking permission
  if (hasPermission === null) {
    return <LoadingState message="カメラ権限を確認中..." />;
  }

  // Show permission request
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Surface style={styles.fallbackCard} elevation={2}>
          <Text variant="headlineSmall" style={styles.fallbackTitle}>
            カメラの許可が必要です
          </Text>
          <PermissionStatus hasPermission={false} onRequest={handleRequestPermission} />
          <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
            戻る
          </Button>
        </Surface>
      </SafeAreaView>
    );
  }

  // Show loading while device is being found
  if (!device) {
    return <LoadingState message="カメラデバイスを検索中..." />;
  }

  // Get camera component with null check
  const CameraComponent = Camera!;

  return (
    <View style={styles.cameraContainer}>
      {/* Camera View */}
      <CameraComponent
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        onInitialized={handleCameraInitialized}
        onError={handleCameraError}
      />

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay}>
        {/* Top Info */}
        <View style={styles.topInfo}>
          <Surface style={styles.infoCard} elevation={3}>
            <Text variant="titleMedium">カメラプレビュー</Text>
            <Text variant="bodySmall" style={styles.deviceInfo}>
              {deviceInfo}
            </Text>
            {isReady ? (
              <Chip icon="check-circle" mode="flat" compact style={styles.statusChip}>
                初期化完了
              </Chip>
            ) : (
              <Chip icon="loading" mode="flat" compact style={styles.statusChip}>
                初期化中...
              </Chip>
            )}
          </Surface>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <Button
            mode="contained"
            onPress={() => router.push("/training/pose-detection-test")}
            style={styles.nextButton}
            disabled={!isReady}
          >
            姿勢検出テストへ
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.backButtonOverlay}
            textColor="#fff"
          >
            戻る
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Camera Test Screen
 */
export default function CameraTestScreen() {
  // Web platform fallback
  if (Platform.OS === "web") {
    return <WebFallback />;
  }

  // Check if VisionCamera is available
  if (!Camera || !useCameraDevice || !useCameraPermission) {
    return <CameraNotAvailable />;
  }

  return <CameraPreview />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topInfo: {
    padding: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  deviceInfo: {
    marginTop: 4,
    color: "#666",
  },
  statusChip: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  bottomControls: {
    padding: 16,
    gap: 12,
  },
  nextButton: {
    borderRadius: 8,
  },
  backButtonOverlay: {
    borderRadius: 8,
    borderColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  fallbackCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    maxWidth: 400,
    width: "100%",
  },
  fallbackTitle: {
    marginBottom: 16,
    textAlign: "center",
  },
  errorTitle: {
    marginBottom: 16,
    textAlign: "center",
    color: "#d32f2f",
  },
  fallbackText: {
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
    lineHeight: 22,
  },
  fallbackNote: {
    marginBottom: 16,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  commandBox: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  commandLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  commandText: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#333",
  },
  backButton: {
    marginTop: 8,
  },
  permissionContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  permissionText: {
    marginBottom: 12,
    textAlign: "center",
    color: "#666",
  },
  permissionButton: {
    borderRadius: 8,
  },
  permissionChip: {
    alignSelf: "center",
    marginVertical: 16,
  },
});
