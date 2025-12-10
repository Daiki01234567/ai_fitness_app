/**
 * Pose Detection Test Screen
 *
 * MediaPipe Pose detection integration test screen.
 * Displays real-time pose detection with 33 landmarks and FPS measurement.
 *
 * Reference:
 * - docs/expo/tickets/011-mediapipe-poc.md
 * - docs/common/specs/06_Form_Evaluation_Logic_v1_0.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Platform, ScrollView } from "react-native";
import { Text, Button, Surface, Chip, ActivityIndicator, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { FpsCounter, countVisibleLandmarks, calculateAverageVisibility } from "@/lib/pose";
import { LandmarkIndex, LANDMARK_NAMES, VISIBILITY_THRESHOLDS } from "@/types/mediapipe";

// MediaPipe imports - only available on native platforms
let usePoseDetection: typeof import("react-native-mediapipe").usePoseDetection | null = null;
let MediapipeCamera: typeof import("react-native-mediapipe").MediapipeCamera | null = null;
let RunningMode: typeof import("react-native-mediapipe").RunningMode | null = null;
let Delegate: typeof import("react-native-mediapipe").Delegate | null = null;
let KnownPoseLandmarks: typeof import("react-native-mediapipe").KnownPoseLandmarks | null = null;

// VisionCamera permission hook
let useCameraPermission: typeof import("react-native-vision-camera").useCameraPermission | null =
  null;

if (Platform.OS !== "web") {
  try {
    const MediaPipe = require("react-native-mediapipe");
    usePoseDetection = MediaPipe.usePoseDetection;
    MediapipeCamera = MediaPipe.MediapipeCamera;
    RunningMode = MediaPipe.RunningMode;
    Delegate = MediaPipe.Delegate;
    KnownPoseLandmarks = MediaPipe.KnownPoseLandmarks;

    const VisionCamera = require("react-native-vision-camera");
    useCameraPermission = VisionCamera.useCameraPermission;
  } catch (error) {
    console.warn("MediaPipe/VisionCamera not available:", error);
  }
}

// Model path for pose detection (bundled with react-native-mediapipe)
const POSE_DETECTION_MODEL = "pose_landmarker_lite.task";

/**
 * Landmark data for display
 */
interface LandmarkDisplayData {
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
  isVisible: boolean;
}

/**
 * Detection state
 */
interface DetectionState {
  isDetecting: boolean;
  fps: number;
  avgFps: number;
  landmarkCount: number;
  visibleCount: number;
  avgVisibility: number;
  lastResults: LandmarkDisplayData[];
  inferenceTime: number;
  errorMessage: string | null;
}

/**
 * Initial detection state
 */
const initialDetectionState: DetectionState = {
  isDetecting: false,
  fps: 0,
  avgFps: 0,
  landmarkCount: 0,
  visibleCount: 0,
  avgVisibility: 0,
  lastResults: [],
  inferenceTime: 0,
  errorMessage: null,
};

/**
 * Web fallback component
 */
function WebFallback() {
  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <Text variant="headlineSmall" style={styles.fallbackTitle}>
          姿勢検出テスト
        </Text>
        <Text style={styles.fallbackText}>
          このテストはネイティブプラットフォーム（iOS/Android）でのみ実行できます。
        </Text>
        <Text style={styles.fallbackNote}>
          Development Buildを作成し、実機またはエミュレータで実行してください。
        </Text>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          戻る
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

/**
 * Not available component
 */
function NotAvailable({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.fallbackCard} elevation={2}>
        <Text variant="headlineSmall" style={styles.errorTitle}>
          セットアップが必要です
        </Text>
        <Text style={styles.fallbackText}>{message}</Text>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          戻る
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

/**
 * FPS display component
 */
function FpsDisplay({
  fps,
  avgFps,
  inferenceTime,
}: {
  fps: number;
  avgFps: number;
  inferenceTime: number;
}) {
  const getPerformanceColor = (fpsValue: number) => {
    if (fpsValue >= 30) return "#4CAF50";
    if (fpsValue >= 24) return "#8BC34A";
    if (fpsValue >= 15) return "#FFC107";
    return "#F44336";
  };

  return (
    <Surface style={styles.fpsCard} elevation={3}>
      <View style={styles.fpsRow}>
        <View style={styles.fpsItem}>
          <Text variant="headlineMedium" style={{ color: getPerformanceColor(fps) }}>
            {fps}
          </Text>
          <Text variant="bodySmall" style={styles.fpsLabel}>
            FPS
          </Text>
        </View>
        <Divider style={styles.fpsDivider} />
        <View style={styles.fpsItem}>
          <Text variant="headlineMedium" style={{ color: getPerformanceColor(avgFps) }}>
            {avgFps}
          </Text>
          <Text variant="bodySmall" style={styles.fpsLabel}>
            平均FPS
          </Text>
        </View>
        <Divider style={styles.fpsDivider} />
        <View style={styles.fpsItem}>
          <Text variant="headlineMedium" style={styles.inferenceText}>
            {inferenceTime.toFixed(0)}
          </Text>
          <Text variant="bodySmall" style={styles.fpsLabel}>
            推論時間(ms)
          </Text>
        </View>
      </View>
    </Surface>
  );
}

/**
 * Detection stats component
 */
function DetectionStats({
  landmarkCount,
  visibleCount,
  avgVisibility,
}: {
  landmarkCount: number;
  visibleCount: number;
  avgVisibility: number;
}) {
  return (
    <View style={styles.statsRow}>
      <Chip icon="chart-bubble" style={styles.statChip}>
        検出: {visibleCount}/{landmarkCount}
      </Chip>
      <Chip icon="eye" style={styles.statChip}>
        信頼度: {(avgVisibility * 100).toFixed(0)}%
      </Chip>
    </View>
  );
}

/**
 * Landmark list component
 */
function LandmarkList({ landmarks }: { landmarks: LandmarkDisplayData[] }) {
  if (landmarks.length === 0) {
    return (
      <View style={styles.emptyLandmarks}>
        <Text style={styles.emptyText}>ポーズが検出されていません</Text>
      </View>
    );
  }

  // Show only key landmarks for readability
  const keyLandmarks = landmarks.filter((l) =>
    [
      LandmarkIndex.NOSE,
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_ELBOW,
      LandmarkIndex.RIGHT_ELBOW,
      LandmarkIndex.LEFT_WRIST,
      LandmarkIndex.RIGHT_WRIST,
      LandmarkIndex.LEFT_HIP,
      LandmarkIndex.RIGHT_HIP,
      LandmarkIndex.LEFT_KNEE,
      LandmarkIndex.RIGHT_KNEE,
      LandmarkIndex.LEFT_ANKLE,
      LandmarkIndex.RIGHT_ANKLE,
    ].includes(l.index)
  );

  return (
    <ScrollView style={styles.landmarkList} contentContainerStyle={styles.landmarkListContent}>
      <Text variant="titleSmall" style={styles.landmarkTitle}>
        主要ランドマーク（{keyLandmarks.length}個）
      </Text>
      {keyLandmarks.map((landmark) => (
        <View
          key={landmark.index}
          style={[styles.landmarkItem, !landmark.isVisible && styles.landmarkItemInvisible]}
        >
          <Text style={styles.landmarkName}>{landmark.name}</Text>
          <Text style={styles.landmarkCoords}>
            x: {landmark.x.toFixed(3)} y: {landmark.y.toFixed(3)} z: {landmark.z.toFixed(3)}
          </Text>
          <Text
            style={[
              styles.landmarkVisibility,
              landmark.isVisible ? styles.visibleText : styles.invisibleText,
            ]}
          >
            信頼度: {(landmark.visibility * 100).toFixed(0)}%
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Pose Detection Camera component
 */
function PoseDetectionCamera({
  onDetectionStateChange,
}: {
  onDetectionStateChange: (state: Partial<DetectionState>) => void;
}) {
  const fpsCounterRef = useRef(new FpsCounter());
  const { hasPermission } = useCameraPermission!();

  // Pose detection callbacks
  const handleResults = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result: any) => {
      // Update FPS
      fpsCounterRef.current.tick();
      const measurement = fpsCounterRef.current.getMeasurement();

      // Process landmarks
      const landmarks: LandmarkDisplayData[] = [];
      let totalVisibility = 0;

      if (result.results && result.results.length > 0 && result.results[0].landmarks) {
        const poseLandmarks = result.results[0].landmarks[0] || [];
        poseLandmarks.forEach(
          (landmark: { x: number; y: number; z: number; visibility?: number }, index: number) => {
            const visibility = landmark.visibility ?? 0;
            totalVisibility += visibility;
            landmarks.push({
              index,
              name: LANDMARK_NAMES[index as LandmarkIndex] || `landmark_${index}`,
              x: landmark.x,
              y: landmark.y,
              z: landmark.z,
              visibility,
              isVisible: visibility >= VISIBILITY_THRESHOLDS.MINIMUM,
            });
          }
        );
      }

      const visibleCount = landmarks.filter((l) => l.isVisible).length;
      const avgVisibility = landmarks.length > 0 ? totalVisibility / landmarks.length : 0;

      // Log detection result (for debugging)
      if (measurement.currentFps > 0 && landmarks.length > 0) {
        console.log(
          `[PoseDetection] FPS: ${measurement.currentFps}, Landmarks: ${visibleCount}/${landmarks.length}, Inference: ${result.inferenceTime}ms`
        );
      }

      onDetectionStateChange({
        isDetecting: landmarks.length > 0,
        fps: measurement.currentFps,
        avgFps: measurement.averageFps,
        landmarkCount: landmarks.length,
        visibleCount,
        avgVisibility,
        lastResults: landmarks,
        inferenceTime: result.inferenceTime || 0,
        errorMessage: null,
      });
    },
    [onDetectionStateChange]
  );

  const handleError = useCallback(
    (error: { code: number; message: string }) => {
      console.error("[PoseDetection] Error:", error);
      onDetectionStateChange({
        errorMessage: `Error ${error.code}: ${error.message}`,
      });
    },
    [onDetectionStateChange]
  );

  // Initialize pose detection
  const solution = usePoseDetection!(
    {
      onResults: handleResults,
      onError: handleError,
    },
    RunningMode!.LIVE_STREAM,
    POSE_DETECTION_MODEL,
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate!.GPU,
      shouldOutputSegmentationMasks: false,
    }
  );

  if (!hasPermission) {
    return (
      <View style={styles.noCameraPermission}>
        <Text>カメラの権限がありません</Text>
        <Button
          mode="contained"
          onPress={() => router.push("/training/camera-test")}
          style={styles.permissionButton}
        >
          権限を設定
        </Button>
      </View>
    );
  }

  const CameraComponent = MediapipeCamera!;

  return (
    <View style={styles.cameraWrapper}>
      <CameraComponent
        style={styles.camera}
        solution={solution}
        activeCamera="back"
        resizeMode="cover"
      />
    </View>
  );
}

/**
 * Main Pose Detection Test Screen
 */
function PoseDetectionTestContent() {
  const [detectionState, setDetectionState] = useState<DetectionState>(initialDetectionState);
  const [showLandmarks, setShowLandmarks] = useState(false);

  const handleDetectionStateChange = useCallback((newState: Partial<DetectionState>) => {
    setDetectionState((prev) => ({ ...prev, ...newState }));
  }, []);

  return (
    <View style={styles.mainContainer}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <PoseDetectionCamera onDetectionStateChange={handleDetectionStateChange} />

        {/* Overlay Info */}
        <SafeAreaView style={styles.overlay} edges={["top"]}>
          {/* FPS Display */}
          <FpsDisplay
            fps={detectionState.fps}
            avgFps={detectionState.avgFps}
            inferenceTime={detectionState.inferenceTime}
          />

          {/* Detection Status */}
          {detectionState.isDetecting ? (
            <DetectionStats
              landmarkCount={detectionState.landmarkCount}
              visibleCount={detectionState.visibleCount}
              avgVisibility={detectionState.avgVisibility}
            />
          ) : (
            <View style={styles.notDetecting}>
              <ActivityIndicator size="small" />
              <Text style={styles.notDetectingText}>ポーズを検出中...</Text>
            </View>
          )}

          {/* Error Message */}
          {detectionState.errorMessage && (
            <Surface style={styles.errorCard} elevation={3}>
              <Text style={styles.errorText}>{detectionState.errorMessage}</Text>
            </Surface>
          )}
        </SafeAreaView>
      </View>

      {/* Bottom Panel */}
      <Surface style={styles.bottomPanel} elevation={4}>
        <View style={styles.buttonRow}>
          <Button
            mode={showLandmarks ? "contained" : "outlined"}
            onPress={() => setShowLandmarks(!showLandmarks)}
            style={styles.toggleButton}
            compact
          >
            ランドマーク表示
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.backButtonBottom}
            compact
          >
            戻る
          </Button>
        </View>

        {/* Landmark List */}
        {showLandmarks && <LandmarkList landmarks={detectionState.lastResults} />}

        {/* Info Text */}
        <Text variant="bodySmall" style={styles.infoText}>
          MediaPipe Pose Lite モデルで33関節点を検出中。{"\n"}
          目標: 30fps / 最低: 15fps / 信頼度閾値: 0.5
        </Text>
      </Surface>
    </View>
  );
}

/**
 * Pose Detection Test Screen Entry Point
 */
export default function PoseDetectionTestScreen() {
  // Web platform fallback
  if (Platform.OS === "web") {
    return <WebFallback />;
  }

  // Check if MediaPipe is available
  if (!usePoseDetection || !MediapipeCamera || !useCameraPermission) {
    return (
      <NotAvailable message="react-native-mediapipeまたはreact-native-vision-cameraが利用できません。Development Buildが必要です。" />
    );
  }

  return <PoseDetectionTestContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraContainer: {
    flex: 1,
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  fpsCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 12,
  },
  fpsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  fpsItem: {
    alignItems: "center",
  },
  fpsLabel: {
    color: "#666",
    marginTop: 2,
  },
  fpsDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#ddd",
  },
  inferenceText: {
    color: "#666",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statChip: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  notDetecting: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    gap: 8,
  },
  notDetectingText: {
    color: "#666",
  },
  errorCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFEBEE",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
  },
  bottomPanel: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
  },
  backButtonBottom: {
    flex: 1,
  },
  landmarkList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  landmarkListContent: {
    gap: 8,
  },
  landmarkTitle: {
    marginBottom: 8,
    color: "#333",
  },
  landmarkItem: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 8,
  },
  landmarkItemInvisible: {
    opacity: 0.5,
  },
  landmarkName: {
    fontWeight: "600",
    fontSize: 12,
    marginBottom: 2,
  },
  landmarkCoords: {
    fontSize: 11,
    color: "#666",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  landmarkVisibility: {
    fontSize: 11,
    marginTop: 2,
  },
  visibleText: {
    color: "#4CAF50",
  },
  invisibleText: {
    color: "#F44336",
  },
  emptyLandmarks: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
  },
  infoText: {
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
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
  backButton: {
    marginTop: 8,
  },
  noCameraPermission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    gap: 16,
  },
  permissionButton: {
    marginTop: 8,
  },
});
