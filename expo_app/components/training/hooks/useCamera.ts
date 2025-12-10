/**
 * Camera custom hook for training screens
 *
 * Provides camera permission management, device selection,
 * and camera position switching functionality.
 *
 * Reference: docs/expo/tickets/012-camera-implementation.md
 */

import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

// VisionCamera types and hooks
type CameraPosition = "front" | "back";
type CameraPermissionStatus = "granted" | "denied" | "not-determined";

interface CameraDevice {
  id: string;
  name: string;
  position: CameraPosition;
  hasFlash: boolean;
  hasTorch: boolean;
  supportsPhotoHDR: boolean;
  supportsVideoHDR: boolean;
  isMultiCam: boolean;
  minZoom: number;
  maxZoom: number;
  neutralZoom: number;
  formats: unknown[];
}

interface UseCameraResult {
  /** Whether camera permission is granted */
  hasPermission: boolean;
  /** Current permission status */
  permissionStatus: CameraPermissionStatus | null;
  /** Whether permission is being checked */
  isCheckingPermission: boolean;
  /** Request camera permission */
  requestPermission: () => Promise<boolean>;
  /** Open system settings */
  openSettings: () => Promise<void>;
  /** Current camera position */
  cameraPosition: CameraPosition;
  /** Toggle between front and back camera */
  toggleCameraPosition: () => void;
  /** Set specific camera position */
  setCameraPosition: (position: CameraPosition) => void;
  /** Current camera device (null if not available) */
  device: CameraDevice | undefined;
  /** Whether camera is available on this device */
  isCameraAvailable: boolean;
  /** Error message if camera is not available */
  errorMessage: string | null;
}

// Default hook for when camera is not available (web/expo go)
const defaultCameraHook = (): UseCameraResult => ({
  hasPermission: false,
  permissionStatus: null,
  isCheckingPermission: false,
  requestPermission: async () => false,
  openSettings: async () => {},
  cameraPosition: "front",
  toggleCameraPosition: () => {},
  setCameraPosition: () => {},
  device: undefined,
  isCameraAvailable: false,
  errorMessage: "Camera not available on this platform",
});

/**
 * Custom hook for camera management
 *
 * Handles:
 * - Permission state management
 * - Device selection (front/back camera)
 * - Platform-specific availability checks
 *
 * @param initialPosition - Initial camera position (default: 'front')
 * @returns Camera state and control functions
 *
 * @example
 * const { hasPermission, device, toggleCameraPosition } = useCamera('front');
 *
 * if (!hasPermission) {
 *   return <CameraPermissionView />;
 * }
 */
export function useCamera(initialPosition: CameraPosition = "front"): UseCameraResult {
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>(initialPosition);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<CameraPermissionStatus | null>(null);
  const [device, setDevice] = useState<CameraDevice | undefined>(undefined);
  const [isCameraAvailable, setIsCameraAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if we're on a native platform
  const isNativePlatform = Platform.OS !== "web";

  // Initialize camera hooks and check availability
  useEffect(() => {
    if (!isNativePlatform) {
      setIsCheckingPermission(false);
      setErrorMessage("Camera is only available on native platforms (iOS/Android)");
      return;
    }

    // Dynamic import to avoid issues on web
    const initializeCamera = async () => {
      try {
        const VisionCamera = await import("react-native-vision-camera");
        const Camera = VisionCamera.Camera;

        // Check initial permission status
        const currentPermission = await Camera.getCameraPermissionStatus();
        setPermissionStatus(currentPermission as CameraPermissionStatus);
        setIsCameraAvailable(true);

        // Get available devices
        const devices = await Camera.getAvailableCameraDevices();
        const selectedDevice = devices.find((d: CameraDevice) => d.position === cameraPosition);
        setDevice(selectedDevice);
      } catch (error) {
        console.warn("[useCamera] Failed to initialize camera:", error);
        setErrorMessage("Camera module not available. Development Build required.");
        setIsCameraAvailable(false);
      } finally {
        setIsCheckingPermission(false);
      }
    };

    initializeCamera();
  }, [isNativePlatform, cameraPosition]);

  // Request camera permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform || !isCameraAvailable) {
      return false;
    }

    try {
      const VisionCamera = await import("react-native-vision-camera");
      const Camera = VisionCamera.Camera;

      const status = await Camera.requestCameraPermission();
      setPermissionStatus(status as CameraPermissionStatus);

      if (status === "denied") {
        // Show alert to guide user to settings
        Alert.alert(
          "カメラ権限が必要です",
          "トレーニング機能を使用するには、カメラへのアクセスを許可してください。設定画面からカメラの権限を有効にしてください。",
          [
            { text: "キャンセル", style: "cancel" },
            { text: "設定を開く", onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      return status === "granted";
    } catch (error) {
      console.error("[useCamera] Permission request failed:", error);
      return false;
    }
  }, [isNativePlatform, isCameraAvailable]);

  // Open system settings
  const openSettings = useCallback(async (): Promise<void> => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error("[useCamera] Failed to open settings:", error);
    }
  }, []);

  // Toggle camera position
  const toggleCameraPosition = useCallback(() => {
    setCameraPosition((prev) => (prev === "front" ? "back" : "front"));
  }, []);

  // Update device when position changes
  useEffect(() => {
    if (!isCameraAvailable) return;

    const updateDevice = async () => {
      try {
        const VisionCamera = await import("react-native-vision-camera");
        const Camera = VisionCamera.Camera;
        const devices = await Camera.getAvailableCameraDevices();
        const selectedDevice = devices.find((d: CameraDevice) => d.position === cameraPosition);
        setDevice(selectedDevice);
      } catch (error) {
        console.warn("[useCamera] Failed to update device:", error);
      }
    };

    updateDevice();
  }, [cameraPosition, isCameraAvailable]);

  // Return default hook for web
  if (!isNativePlatform) {
    return defaultCameraHook();
  }

  return {
    hasPermission: permissionStatus === "granted",
    permissionStatus,
    isCheckingPermission,
    requestPermission,
    openSettings,
    cameraPosition,
    toggleCameraPosition,
    setCameraPosition,
    device,
    isCameraAvailable,
    errorMessage,
  };
}

export type { CameraPosition, CameraDevice, UseCameraResult };
