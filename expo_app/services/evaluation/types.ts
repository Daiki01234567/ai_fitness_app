/**
 * Form Evaluation Types
 *
 * Type definitions for the form evaluation engine.
 * Used by all exercise-specific evaluation modules.
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { Landmark, Point2D } from "@/types/mediapipe";

/**
 * Exercise types supported by the app
 */
export type ExerciseType =
  | "squat"
  | "pushup"
  | "armcurl"
  | "sideraise"
  | "shoulderpress";

/**
 * Exercise phase - generic base for state machines
 */
export type ExercisePhaseBase = string;

/**
 * Squat phases
 */
export enum SquatPhase {
  STANDING = "standing",
  DESCENDING = "descending",
  BOTTOM = "bottom",
  ASCENDING = "ascending",
}

/**
 * Push-up phases
 */
export enum PushupPhase {
  UP = "up",
  DESCENDING = "descending",
  BOTTOM = "bottom",
  ASCENDING = "ascending",
}

/**
 * Arm curl phases
 */
export enum ArmCurlPhase {
  DOWN = "down",
  CURLING = "curling",
  TOP = "top",
  LOWERING = "lowering",
}

/**
 * Side raise phases
 */
export enum SideRaisePhase {
  DOWN = "down",
  RAISING = "raising",
  TOP = "top",
  LOWERING = "lowering",
}

/**
 * Shoulder press phases
 */
export enum ShoulderPressPhase {
  DOWN = "down",
  PRESSING = "pressing",
  TOP = "top",
  LOWERING = "lowering",
}

/**
 * Result of a single form check
 */
export interface FormCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** The measured value (e.g., angle) */
  value: number;
  /** Description of the check */
  description: string;
  /** Feedback message for the user */
  feedback?: string;
}

/**
 * Result of angle check with range info
 */
export interface AngleCheckResult extends FormCheckResult {
  /** Target minimum angle */
  minAngle: number;
  /** Target maximum angle */
  maxAngle: number;
}

/**
 * Result of frame-level evaluation
 */
export interface FrameEvaluationResult {
  /** Frame timestamp */
  timestamp: number;
  /** Overall frame score (0-100) */
  score: number;
  /** Individual check results */
  checks: FormCheckResult[];
  /** Current exercise phase */
  phase: string;
  /** Current rep count */
  repCount: number;
  /** Raw landmark data used */
  landmarks: Landmark[];
  /** Whether all required landmarks were visible */
  hasRequiredLandmarks: boolean;
}

/**
 * Result of session-level evaluation
 */
export interface SessionEvaluationResult {
  /** Exercise type */
  exerciseType: ExerciseType;
  /** Session start timestamp */
  startTime: number;
  /** Session end timestamp */
  endTime: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Total reps completed */
  totalReps: number;
  /** Overall score (0-100) */
  overallScore: number;
  /** Average frame score */
  averageFrameScore: number;
  /** Per-rep scores */
  repScores: number[];
  /** Frame-level results (optional, for detailed analysis) */
  frameResults?: FrameEvaluationResult[];
  /** Common form issues detected */
  formIssues: FormIssue[];
}

/**
 * Form issue identified during evaluation
 */
export interface FormIssue {
  /** Issue identifier */
  id: string;
  /** Issue description */
  description: string;
  /** Number of times issue occurred */
  occurrences: number;
  /** Severity level */
  severity: "low" | "medium" | "high";
  /** Advice to fix the issue */
  advice: string;
}

/**
 * Rep counter state
 */
export interface RepCounterState {
  /** Current rep count */
  count: number;
  /** Current phase */
  phase: string;
  /** Whether currently in a rep */
  inRep: boolean;
  /** Last state transition time */
  lastTransitionTime: number;
}

/**
 * State machine transition
 */
export interface StateTransition<T extends string> {
  /** From phase */
  from: T;
  /** To phase */
  to: T;
  /** Condition function */
  condition: (data: TransitionData) => boolean;
  /** Optional callback when transition occurs */
  onTransition?: (data: TransitionData) => void;
}

/**
 * Data passed to transition conditions
 */
export interface TransitionData {
  /** Current landmarks */
  landmarks: Landmark[];
  /** Computed angles */
  angles: Record<string, number>;
  /** Computed distances */
  distances: Record<string, number>;
  /** Previous frame data */
  previousFrame?: TransitionData;
}

/**
 * Evaluation configuration for an exercise
 */
export interface ExerciseEvaluationConfig {
  /** Exercise type */
  type: ExerciseType;
  /** Required landmark indices */
  requiredLandmarks: number[];
  /** Visibility threshold for evaluation */
  visibilityThreshold: number;
  /** Check functions to run */
  checks: ExerciseCheck[];
  /** State machine transitions */
  transitions: StateTransition<string>[];
  /** Initial phase */
  initialPhase: string;
}

/**
 * Single check function definition
 */
export interface ExerciseCheck {
  /** Check identifier */
  id: string;
  /** Check name for display */
  name: string;
  /** Check function */
  check: (landmarks: Landmark[]) => FormCheckResult;
  /** Weight for scoring (default: 1) */
  weight?: number;
}

/**
 * Feedback message for real-time display
 */
export interface RealTimeFeedback {
  /** Message to display */
  message: string;
  /** Message type */
  type: "success" | "warning" | "error" | "info";
  /** Priority (higher = more important) */
  priority: number;
  /** Duration to show in ms (0 = until next message) */
  duration: number;
}

/**
 * Angle thresholds for different exercises
 */
export const ANGLE_THRESHOLDS = {
  squat: {
    kneeAngle: { min: 90, max: 110 },
    backStraight: { min: 150, max: 180 },
    standingKnee: { min: 160, max: 180 },
  },
  pushup: {
    elbowAngle: { min: 80, max: 100 },
    bodyLine: { min: 170, max: 180 },
    upElbow: { min: 160, max: 180 },
  },
  armcurl: {
    elbowTop: { min: 30, max: 50 },
    elbowBottom: { min: 150, max: 180 },
  },
  sideraise: {
    armElevation: { min: 75, max: 95 },
    symmetryTolerance: 0.1,
  },
  shoulderpress: {
    elbowTop: { min: 160, max: 180 },
    elbowBottom: { min: 80, max: 100 },
  },
} as const;

/**
 * Phase transition thresholds
 */
export const PHASE_THRESHOLDS = {
  squat: {
    startDescending: 140,
    reachBottom: 110,
    startAscending: 110,
    reachStanding: 160,
  },
  pushup: {
    startDescending: 140,
    reachBottom: 100,
    startAscending: 100,
    reachUp: 160,
  },
  armcurl: {
    startCurling: 140,
    reachTop: 50,
    startLowering: 50,
    reachBottom: 160,
  },
} as const;

/**
 * Helper type for getting a landmark safely
 */
export type SafeLandmarkGetter = (
  landmarks: Landmark[],
  index: number
) => Landmark | null;

/**
 * Exercise metadata for display
 */
export interface ExerciseMetadata {
  type: ExerciseType;
  name: string;
  nameJa: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  recommendedCameraPosition: "front" | "side";
}

/**
 * Exercise metadata definitions
 */
export const EXERCISE_METADATA: Record<ExerciseType, ExerciseMetadata> = {
  squat: {
    type: "squat",
    name: "Squat",
    nameJa: "スクワット",
    category: "lower_body",
    difficulty: "beginner",
    equipment: [],
    recommendedCameraPosition: "side",
  },
  pushup: {
    type: "pushup",
    name: "Push-up",
    nameJa: "プッシュアップ",
    category: "chest",
    difficulty: "beginner",
    equipment: [],
    recommendedCameraPosition: "side",
  },
  armcurl: {
    type: "armcurl",
    name: "Arm Curl",
    nameJa: "アームカール",
    category: "arms",
    difficulty: "beginner",
    equipment: ["dumbbell"],
    recommendedCameraPosition: "front",
  },
  sideraise: {
    type: "sideraise",
    name: "Side Raise",
    nameJa: "サイドレイズ",
    category: "shoulders",
    difficulty: "intermediate",
    equipment: ["dumbbell"],
    recommendedCameraPosition: "front",
  },
  shoulderpress: {
    type: "shoulderpress",
    name: "Shoulder Press",
    nameJa: "ショルダープレス",
    category: "shoulders",
    difficulty: "intermediate",
    equipment: ["dumbbell"],
    recommendedCameraPosition: "front",
  },
};
