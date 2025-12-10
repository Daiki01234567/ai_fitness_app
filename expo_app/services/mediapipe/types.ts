/**
 * MediaPipe Service Types
 *
 * Extended type definitions for pose detection service layer.
 * Complements the types in @/types/mediapipe.ts
 *
 * Reference: docs/expo/tickets/013-skeleton-detection.md
 */

import type { Landmark, PoseDetectionResult, FpsMeasurement } from "@/types/mediapipe";

/**
 * Extended pose detection result with evaluation data
 */
export interface ExtendedPoseDetectionResult extends PoseDetectionResult {
  /** Landmarks filtered for display (visibility >= 0.5) */
  visibleLandmarks: Landmark[];
  /** Landmarks suitable for form evaluation (visibility >= 0.8) */
  evaluatableLandmarks: Landmark[];
  /** Average visibility score across all landmarks */
  averageVisibility: number;
  /** Number of visible landmarks */
  visibleCount: number;
  /** Number of evaluatable landmarks */
  evaluatableCount: number;
}

/**
 * Pose detector state
 */
export interface PoseDetectorState {
  /** Whether detector is currently active */
  isActive: boolean;
  /** Whether detector is initialized */
  isInitialized: boolean;
  /** Last error message */
  lastError: string | null;
  /** Current processing mode */
  processingMode: "full" | "lite";
}

/**
 * Pose detection callback
 */
export type PoseDetectionCallback = (result: ExtendedPoseDetectionResult | null) => void;

/**
 * Low confidence warning event
 */
export interface LowConfidenceWarning {
  /** Average confidence when warning was triggered */
  averageConfidence: number;
  /** Number of consecutive low confidence frames */
  consecutiveFrames: number;
  /** Suggested user action */
  suggestion: LowConfidenceSuggestion;
  /** Timestamp of warning */
  timestamp: number;
}

/**
 * Suggestions for low confidence situations
 */
export type LowConfidenceSuggestion =
  | "adjust_position" // User should adjust position to show full body
  | "improve_lighting" // Lighting is insufficient
  | "adjust_distance" // Camera is too far or too close
  | "slow_down"; // Movements are too fast

/**
 * Pose detector configuration
 */
export interface PoseDetectorConfig {
  /** Minimum visibility threshold for display */
  displayThreshold: number;
  /** Minimum visibility threshold for evaluation */
  evaluationThreshold: number;
  /** Maximum consecutive low confidence frames before warning */
  maxLowConfidenceFrames: number;
  /** Enable debug logging */
  debugMode: boolean;
}

/**
 * Default pose detector configuration
 */
export const DEFAULT_POSE_DETECTOR_CONFIG: PoseDetectorConfig = {
  displayThreshold: 0.5,
  evaluationThreshold: 0.8,
  maxLowConfidenceFrames: 30, // ~1 second at 30fps
  debugMode: __DEV__ ?? false,
};

/**
 * Pose detector events
 */
export interface PoseDetectorEvents {
  /** Called when pose is detected */
  onPoseDetected: PoseDetectionCallback;
  /** Called when detection fails */
  onDetectionError: (error: Error) => void;
  /** Called when low confidence warning is triggered */
  onLowConfidenceWarning: (warning: LowConfidenceWarning) => void;
  /** Called when detector state changes */
  onStateChange: (state: PoseDetectorState) => void;
}

/**
 * Frame processing options
 */
export interface FrameProcessingOptions {
  /** Skip this frame (for performance) */
  skip: boolean;
  /** Process at reduced resolution */
  reducedResolution: boolean;
  /** Target processing time in ms */
  targetProcessingTime: number;
}

/**
 * Skeleton connection definition
 */
export interface SkeletonConnection {
  /** Start landmark index */
  start: number;
  /** End landmark index */
  end: number;
  /** Connection color (for visualization) */
  color?: string;
  /** Connection thickness */
  thickness?: number;
}

/**
 * Skeleton connections for visualization
 * Defines which landmarks should be connected with lines
 */
export const SKELETON_CONNECTIONS: SkeletonConnection[] = [
  // Face
  { start: 0, end: 1 }, // nose to left_eye_inner
  { start: 0, end: 4 }, // nose to right_eye_inner
  { start: 1, end: 2 }, // left_eye_inner to left_eye
  { start: 2, end: 3 }, // left_eye to left_eye_outer
  { start: 4, end: 5 }, // right_eye_inner to right_eye
  { start: 5, end: 6 }, // right_eye to right_eye_outer
  { start: 3, end: 7 }, // left_eye_outer to left_ear
  { start: 6, end: 8 }, // right_eye_outer to right_ear
  { start: 9, end: 10 }, // left_mouth to right_mouth

  // Torso
  { start: 11, end: 12 }, // left_shoulder to right_shoulder
  { start: 11, end: 23 }, // left_shoulder to left_hip
  { start: 12, end: 24 }, // right_shoulder to right_hip
  { start: 23, end: 24 }, // left_hip to right_hip

  // Left arm
  { start: 11, end: 13 }, // left_shoulder to left_elbow
  { start: 13, end: 15 }, // left_elbow to left_wrist
  { start: 15, end: 17 }, // left_wrist to left_pinky
  { start: 15, end: 19 }, // left_wrist to left_index
  { start: 15, end: 21 }, // left_wrist to left_thumb

  // Right arm
  { start: 12, end: 14 }, // right_shoulder to right_elbow
  { start: 14, end: 16 }, // right_elbow to right_wrist
  { start: 16, end: 18 }, // right_wrist to right_pinky
  { start: 16, end: 20 }, // right_wrist to right_index
  { start: 16, end: 22 }, // right_wrist to right_thumb

  // Left leg
  { start: 23, end: 25 }, // left_hip to left_knee
  { start: 25, end: 27 }, // left_knee to left_ankle
  { start: 27, end: 29 }, // left_ankle to left_heel
  { start: 27, end: 31 }, // left_ankle to left_foot_index
  { start: 29, end: 31 }, // left_heel to left_foot_index

  // Right leg
  { start: 24, end: 26 }, // right_hip to right_knee
  { start: 26, end: 28 }, // right_knee to right_ankle
  { start: 28, end: 30 }, // right_ankle to right_heel
  { start: 28, end: 32 }, // right_ankle to right_foot_index
  { start: 30, end: 32 }, // right_heel to right_foot_index
];

/**
 * Visibility level classification
 */
export type VisibilityLevel = "high" | "medium" | "low" | "none";

/**
 * Get visibility level from score
 */
export function getVisibilityLevel(visibility: number): VisibilityLevel {
  if (visibility >= 0.8) return "high";
  if (visibility >= 0.5) return "medium";
  if (visibility >= 0.3) return "low";
  return "none";
}

/**
 * Performance metrics for pose detection
 */
export interface PosePerformanceMetrics {
  /** FPS measurement */
  fps: FpsMeasurement;
  /** Average frame processing time in ms */
  avgProcessingTime: number;
  /** Frame skip rate (0.0 - 1.0) */
  frameSkipRate: number;
  /** Memory usage (if available) */
  memoryUsage?: number;
  /** Detection success rate */
  detectionSuccessRate: number;
}
