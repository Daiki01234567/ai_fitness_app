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

// Mock Landmarks for Development/Testing
export {
  STANDING_POSE,
  SQUAT_BOTTOM_POSE,
  ARM_CURL_TOP_POSE,
  getMockPoseKeyframes,
  interpolatePoses,
  addNoiseToLandmarks,
  getAnimatedMockPose,
  getLandmarkByIndex,
  getLandmarksByIndices,
} from "./mockLandmarks";

// Export MockExerciseType with a different name to avoid conflict with evaluation/types ExerciseType
export type { ExerciseType as MockExerciseType } from "./mockLandmarks";
