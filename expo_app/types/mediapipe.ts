/**
 * MediaPipe Pose Detection Type Definitions
 *
 * Based on MediaPipe Pose which detects 33 body landmarks.
 * Reference: docs/common/specs/06_Form_Evaluation_Logic_v1_0.md
 */

/**
 * 33 Landmark indices as defined by MediaPipe Pose
 */
export enum LandmarkIndex {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  LEFT_MOUTH = 9,
  RIGHT_MOUTH = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/**
 * Human-readable landmark names mapped to indices
 */
export const LANDMARK_NAMES: Record<LandmarkIndex, string> = {
  [LandmarkIndex.NOSE]: "nose",
  [LandmarkIndex.LEFT_EYE_INNER]: "left_eye_inner",
  [LandmarkIndex.LEFT_EYE]: "left_eye",
  [LandmarkIndex.LEFT_EYE_OUTER]: "left_eye_outer",
  [LandmarkIndex.RIGHT_EYE_INNER]: "right_eye_inner",
  [LandmarkIndex.RIGHT_EYE]: "right_eye",
  [LandmarkIndex.RIGHT_EYE_OUTER]: "right_eye_outer",
  [LandmarkIndex.LEFT_EAR]: "left_ear",
  [LandmarkIndex.RIGHT_EAR]: "right_ear",
  [LandmarkIndex.LEFT_MOUTH]: "left_mouth",
  [LandmarkIndex.RIGHT_MOUTH]: "right_mouth",
  [LandmarkIndex.LEFT_SHOULDER]: "left_shoulder",
  [LandmarkIndex.RIGHT_SHOULDER]: "right_shoulder",
  [LandmarkIndex.LEFT_ELBOW]: "left_elbow",
  [LandmarkIndex.RIGHT_ELBOW]: "right_elbow",
  [LandmarkIndex.LEFT_WRIST]: "left_wrist",
  [LandmarkIndex.RIGHT_WRIST]: "right_wrist",
  [LandmarkIndex.LEFT_PINKY]: "left_pinky",
  [LandmarkIndex.RIGHT_PINKY]: "right_pinky",
  [LandmarkIndex.LEFT_INDEX]: "left_index",
  [LandmarkIndex.RIGHT_INDEX]: "right_index",
  [LandmarkIndex.LEFT_THUMB]: "left_thumb",
  [LandmarkIndex.RIGHT_THUMB]: "right_thumb",
  [LandmarkIndex.LEFT_HIP]: "left_hip",
  [LandmarkIndex.RIGHT_HIP]: "right_hip",
  [LandmarkIndex.LEFT_KNEE]: "left_knee",
  [LandmarkIndex.RIGHT_KNEE]: "right_knee",
  [LandmarkIndex.LEFT_ANKLE]: "left_ankle",
  [LandmarkIndex.RIGHT_ANKLE]: "right_ankle",
  [LandmarkIndex.LEFT_HEEL]: "left_heel",
  [LandmarkIndex.RIGHT_HEEL]: "right_heel",
  [LandmarkIndex.LEFT_FOOT_INDEX]: "left_foot_index",
  [LandmarkIndex.RIGHT_FOOT_INDEX]: "right_foot_index",
};

/**
 * Single landmark point with position and visibility
 */
export interface Landmark {
  /** Normalized X coordinate (0.0 - 1.0, relative to image width) */
  x: number;
  /** Normalized Y coordinate (0.0 - 1.0, relative to image height) */
  y: number;
  /** Depth value (relative, hip center as origin 0) */
  z: number;
  /** Visibility/confidence score (0.0 - 1.0) */
  visibility: number;
}

/**
 * 2D point for angle/distance calculations
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 3D point for advanced calculations
 */
export interface Point3D extends Point2D {
  z: number;
}

/**
 * Result of pose detection for a single frame
 */
export interface PoseDetectionResult {
  /** Array of 33 landmarks */
  landmarks: Landmark[];
  /** Timestamp when the frame was captured (milliseconds) */
  timestamp: number;
  /** Whether detection was successful */
  isDetected: boolean;
}

/**
 * FPS measurement data
 */
export interface FpsMeasurement {
  /** Current FPS */
  currentFps: number;
  /** Average FPS over measurement period */
  averageFps: number;
  /** Total frames processed */
  frameCount: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Performance metrics for pose detection
 */
export interface PerformanceMetrics {
  /** FPS measurement */
  fps: FpsMeasurement;
  /** Frame processing time in milliseconds */
  processingTimeMs: number;
  /** Number of visible landmarks (visibility >= threshold) */
  visibleLandmarkCount: number;
  /** Average visibility score across all landmarks */
  averageVisibility: number;
}

/**
 * Configuration for pose detection
 */
export interface PoseDetectionConfig {
  /** Minimum visibility threshold (0.0 - 1.0, default: 0.5) */
  minVisibility: number;
  /** Target FPS (default: 30) */
  targetFps: number;
  /** Enable GPU acceleration if available */
  useGpu: boolean;
  /** Model complexity: "lite" | "full" | "heavy" */
  modelComplexity: "lite" | "full" | "heavy";
}

/**
 * Default pose detection configuration
 */
export const DEFAULT_POSE_CONFIG: PoseDetectionConfig = {
  minVisibility: 0.5,
  targetFps: 30,
  useGpu: true,
  modelComplexity: "lite",
};

/**
 * Visibility thresholds
 */
export const VISIBILITY_THRESHOLDS = {
  /** Recommended threshold for reliable detection */
  RECOMMENDED: 0.7,
  /** Minimum acceptable threshold */
  MINIMUM: 0.5,
  /** Low confidence threshold (use with caution) */
  LOW: 0.3,
} as const;

/**
 * FPS targets
 */
export const FPS_TARGETS = {
  /** Optimal FPS for smooth experience */
  OPTIMAL: 30,
  /** Recommended FPS for good experience */
  RECOMMENDED: 24,
  /** Minimum acceptable FPS */
  MINIMUM: 15,
} as const;

/**
 * Landmark groups for exercise-specific analysis
 */
export const LANDMARK_GROUPS = {
  /** Face landmarks (0-10) */
  FACE: [
    LandmarkIndex.NOSE,
    LandmarkIndex.LEFT_EYE_INNER,
    LandmarkIndex.LEFT_EYE,
    LandmarkIndex.LEFT_EYE_OUTER,
    LandmarkIndex.RIGHT_EYE_INNER,
    LandmarkIndex.RIGHT_EYE,
    LandmarkIndex.RIGHT_EYE_OUTER,
    LandmarkIndex.LEFT_EAR,
    LandmarkIndex.RIGHT_EAR,
    LandmarkIndex.LEFT_MOUTH,
    LandmarkIndex.RIGHT_MOUTH,
  ],
  /** Upper body landmarks for push-ups, arm curls, etc. */
  UPPER_BODY: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
  ],
  /** Lower body landmarks for squats, etc. */
  LOWER_BODY: [
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.RIGHT_HIP,
    LandmarkIndex.LEFT_KNEE,
    LandmarkIndex.RIGHT_KNEE,
    LandmarkIndex.LEFT_ANKLE,
    LandmarkIndex.RIGHT_ANKLE,
  ],
  /** Left side landmarks */
  LEFT_SIDE: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.LEFT_KNEE,
    LandmarkIndex.LEFT_ANKLE,
  ],
  /** Right side landmarks */
  RIGHT_SIDE: [
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.RIGHT_WRIST,
    LandmarkIndex.RIGHT_HIP,
    LandmarkIndex.RIGHT_KNEE,
    LandmarkIndex.RIGHT_ANKLE,
  ],
  /** Squats: key landmarks */
  SQUAT: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.RIGHT_HIP,
    LandmarkIndex.LEFT_KNEE,
    LandmarkIndex.RIGHT_KNEE,
    LandmarkIndex.LEFT_ANKLE,
    LandmarkIndex.RIGHT_ANKLE,
  ],
  /** Push-ups: key landmarks */
  PUSHUP: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.RIGHT_HIP,
    LandmarkIndex.LEFT_ANKLE,
    LandmarkIndex.RIGHT_ANKLE,
  ],
  /** Arm curl: key landmarks */
  ARM_CURL: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.RIGHT_HIP,
  ],
  /** Side raise: key landmarks */
  SIDE_RAISE: [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
  ],
  /** Shoulder press: key landmarks */
  SHOULDER_PRESS: [
    LandmarkIndex.NOSE,
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
  ],
} as const;
