/**
 * MediaPipe Services Export
 *
 * Central export for all MediaPipe-related services and types.
 */

// Pose Detector
export {
  PoseDetector,
  getPoseDetector,
  disposePoseDetector,
} from "./PoseDetector";

// Types
export type {
  ExtendedPoseDetectionResult,
  PoseDetectorConfig,
  PoseDetectorState,
  LowConfidenceWarning,
  LowConfidenceSuggestion,
  PoseDetectionCallback,
  FrameProcessingOptions,
  SkeletonConnection,
  VisibilityLevel,
  PosePerformanceMetrics,
} from "./types";

export {
  DEFAULT_POSE_DETECTOR_CONFIG,
  SKELETON_CONNECTIONS,
  getVisibilityLevel,
} from "./types";
