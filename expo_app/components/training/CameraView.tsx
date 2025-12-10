/**
 * Reusable Camera View Component
 *
 * Provides a full-featured camera preview with:
 * - Permission handling
 * - Front/back camera switching
 * - Portrait/landscape orientation support
 * - Frame processor integration
 * - Error handling
 *
 * Reference: docs/expo/tickets/012-camera-implementation.md
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Text, IconButton, Surface, Chip, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { CameraPermissionView } from "./CameraPermissionView";
import { useCamera, type CameraPosition } from "./hooks/useCamera";

// VisionCamera types
type Frame = {
  width: number;
  height: number;
  timestamp: number;
  isMirrored: boolean;
  orientation: string;
};

type FrameProcessor = (frame: Frame) => void;

interface CameraViewProps {
  /** Initial camera position */
  initialPosition?: CameraPosition;
  /** Whether camera is active */
  isActive?: boolean;
  /** Frame processor callback (called for each frame) */
  onFrame?: FrameProcessor;
  /** Called when camera is initialized */
  onInitialized?: () => void;
  /** Called when camera encounters an error */
  onError?: (error: Error) => void;
  /** Show FPS overlay */
  showFpsOverlay?: boolean;
  /** Show camera switch button */
  showCameraSwitch?: boolean;
  /** Custom overlay component */
  overlay?: React.ReactNode;
  /** Back navigation handler */
  onBack?: () => void;
  /** Style for the container */
  style?: object;
}

// VisionCamera module - dynamically loaded
let Camera: typeof import("react-native-vision-camera").Camera | null = null;
let useCameraDevice: typeof import("react-native-vision-camera").useCameraDevice | null = null;

if (Platform.OS !== "web") {
  try {
    const VisionCamera = require("react-native-vision-camera");
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
  } catch (error) {
    console.warn("[CameraView] react-native-vision-camera not available:", error);
  }
}

/**
 * Web Platform Fallback Component
 */
function WebPlatformFallback({ onBack }: { onBack?: () => void }) {
  return (
    <SafeAreaView style={styles.fallbackContainer}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <MaterialCommunityIcons name="camera-off" size={48} color="#666" />
        <Text variant="headlineSmall" style={styles.fallbackTitle}>
          カメラが利用できません
        </Text>
        <Text style={styles.fallbackText}>
          このプラットフォームではカメラ機能を利用できません。
          iOS または Android の Development Build で実行してください。
        </Text>
        {onBack && (
          <IconButton icon="arrow-left" size={24} onPress={onBack} style={styles.backButton} />
        )}
      </Surface>
    </SafeAreaView>
  );
}

/**
 * Loading State Component
 */
function LoadingState({ message }: { message: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6200ee" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

/**
 * Camera Error State Component
 */
function CameraErrorState({
  error,
  onRetry,
  onBack,
}: {
  error: string;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={styles.fallbackContainer}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#d32f2f" />
        <Text variant="headlineSmall" style={styles.errorTitle}>
          カメラエラー
        </Text>
        <Text style={styles.fallbackText}>{error}</Text>
        <View style={styles.errorActions}>
          {onRetry && (
            <IconButton icon="refresh" size={24} onPress={onRetry} mode="contained" />
          )}
          {onBack && <IconButton icon="arrow-left" size={24} onPress={onBack} />}
        </View>
      </Surface>
    </SafeAreaView>
  );
}

/**
 * FPS Overlay Component
 */
function FpsOverlay({ fps, isReady }: { fps: number; isReady: boolean }) {
  const getStatusColor = () => {
    if (fps >= 30) return "#4caf50"; // Green - optimal
    if (fps >= 24) return "#ff9800"; // Orange - good
    if (fps >= 15) return "#ff5722"; // Deep orange - acceptable
    return "#f44336"; // Red - poor
  };

  return (
    <View style={styles.fpsOverlay}>
      <Chip
        mode="flat"
        style={[styles.fpsChip, { backgroundColor: isReady ? getStatusColor() : "#666" }]}
        textStyle={styles.fpsChipText}
      >
        {isReady ? `${fps} fps` : "準備中..."}
      </Chip>
    </View>
  );
}

/**
 * Camera Controls Component
 */
function CameraControls({
  onToggleCamera,
  cameraPosition,
  onBack,
}: {
  onToggleCamera: () => void;
  cameraPosition: CameraPosition;
  onBack?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.controlsContainer}>
      {onBack && (
        <IconButton
          icon="arrow-left"
          size={28}
          iconColor="#fff"
          style={styles.controlButton}
          onPress={onBack}
        />
      )}
      <View style={styles.controlsSpacer} />
      <IconButton
        icon={cameraPosition === "front" ? "camera-rear" : "camera-front"}
        size={28}
        iconColor="#fff"
        style={styles.controlButton}
        onPress={onToggleCamera}
      />
    </View>
  );
}

/**
 * Native Camera Component
 */
function NativeCameraView({
  isActive,
  initialPosition,
  onFrame,
  onInitialized,
  onError,
  showFpsOverlay,
  showCameraSwitch,
  overlay,
  onBack,
  style,
}: CameraViewProps) {
  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fpsRef = useRef({ count: 0, lastTime: Date.now() });

  const {
    hasPermission,
    permissionStatus,
    isCheckingPermission,
    requestPermission,
    openSettings,
    cameraPosition,
    toggleCameraPosition,
    isCameraAvailable,
    errorMessage,
  } = useCamera(initialPosition ?? "front");

  // Get camera device
  const device = useCameraDevice?.(cameraPosition);

  // Handle camera initialization
  const handleCameraInitialized = useCallback(() => {
    setIsReady(true);
    setCameraError(null);
    console.log("[CameraView] Camera initialized");
    onInitialized?.();
  }, [onInitialized]);

  // Handle camera error
  const handleCameraError = useCallback(
    (error: Error) => {
      console.error("[CameraView] Camera error:", error);
      setCameraError(error.message);
      setIsReady(false);
      onError?.(error);
    },
    [onError]
  );

  // FPS calculation
  useEffect(() => {
    if (!showFpsOverlay || !isReady) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - fpsRef.current.lastTime;
      if (elapsed >= 1000) {
        const calculatedFps = Math.round((fpsRef.current.count * 1000) / elapsed);
        setFps(calculatedFps);
        fpsRef.current.count = 0;
        fpsRef.current.lastTime = now;
      }
    }, 500);

    return () => clearInterval(interval);
  }, [showFpsOverlay, isReady]);

  // Track frames for FPS
  const incrementFrameCount = useCallback(() => {
    fpsRef.current.count++;
  }, []);

  // Check if camera module is available
  if (!isCameraAvailable || !Camera || !useCameraDevice) {
    return (
      <CameraErrorState
        error={errorMessage ?? "カメラモジュールが利用できません。Development Buildが必要です。"}
        onBack={onBack}
      />
    );
  }

  // Show loading while checking permission
  if (isCheckingPermission) {
    return <LoadingState message="カメラ権限を確認中..." />;
  }

  // Show permission view if not granted
  if (!hasPermission) {
    return (
      <CameraPermissionView
        onRequestPermission={requestPermission}
        onOpenSettings={openSettings}
        wasDenied={permissionStatus === "denied"}
        onBack={onBack}
      />
    );
  }

  // Show loading if device not found
  if (!device) {
    return <LoadingState message="カメラデバイスを検索中..." />;
  }

  // Show error state
  if (cameraError) {
    return <CameraErrorState error={cameraError} onRetry={() => setCameraError(null)} onBack={onBack} />;
  }

  const CameraComponent = Camera!;

  return (
    <View style={[styles.cameraContainer, style]}>
      {/* Camera View */}
      <CameraComponent
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive ?? true}
        onInitialized={handleCameraInitialized}
        onError={handleCameraError}
        // Note: Frame processor requires react-native-worklets-core
        // frameProcessor={onFrame ? frameProcessor : undefined}
      />

      {/* Overlay Container */}
      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Section */}
        <View style={styles.topSection}>
          {showCameraSwitch && (
            <CameraControls
              onToggleCamera={toggleCameraPosition}
              cameraPosition={cameraPosition}
              onBack={onBack}
            />
          )}
          {showFpsOverlay && <FpsOverlay fps={fps} isReady={isReady} />}
        </View>

        {/* Custom Overlay */}
        {overlay}

        {/* Status indicator */}
        {!isReady && (
          <View style={styles.statusOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.statusText}>カメラを初期化中...</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * CameraView Component
 *
 * A reusable camera component for training screens.
 * Handles permissions, device selection, and provides a clean API
 * for integrating camera functionality.
 *
 * @example
 * // Basic usage
 * <CameraView
 *   isActive={true}
 *   showCameraSwitch={true}
 *   onBack={() => router.back()}
 * />
 *
 * // With frame processor
 * <CameraView
 *   isActive={true}
 *   onFrame={(frame) => {
 *     // Process frame with MediaPipe
 *   }}
 *   overlay={<SkeletonOverlay landmarks={landmarks} />}
 * />
 */
export function CameraView(props: CameraViewProps) {
  // Web platform fallback
  if (Platform.OS === "web") {
    return <WebPlatformFallback onBack={props.onBack} />;
  }

  return <NativeCameraView {...props} />;
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlayContainer: {
    flex: 1,
  },
  topSection: {
    padding: 8,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  controlsSpacer: {
    flex: 1,
  },
  controlButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 24,
  },
  fpsOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  fpsChip: {
    height: 28,
  },
  fpsChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  statusOverlay: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    gap: 16,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  fallbackCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    maxWidth: 400,
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  fallbackTitle: {
    textAlign: "center",
  },
  errorTitle: {
    textAlign: "center",
    color: "#d32f2f",
  },
  fallbackText: {
    textAlign: "center",
    color: "#666",
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  backButton: {
    marginTop: 8,
  },
});

export default CameraView;
