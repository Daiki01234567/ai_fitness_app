/**
 * Evaluation Services Export
 *
 * Central export for form evaluation engine components.
 */

// Helper functions
export {
  calculateAngle,
  calculateAngle3D,
  calculateDistance,
  calculateDistance3D,
  isLandmarkVisible,
  getVisibleLandmark,
  getLandmark,
  areAllLandmarksVisible,
  calculateMidpoint,
  isAngleInRange,
  calculateVerticalDistance,
  calculateHorizontalDistance,
  checkKneeOverToe,
  checkElbowFixed,
  checkSymmetry,
  checkBodyLine,
  checkBackStraight,
  checkArmElevation,
  checkWristAboveHead,
  getRequiredLandmarks,
  landmarkToPoint2D,
  landmarkToPoint3D,
} from "./helpers";

// Scoring functions
export {
  calculateFrameScore,
  calculateFrameScoreFromResults,
  calculateOverallScore,
  calculateRepScore,
  calculateWeightedOverallScore,
  getLetterGrade,
  getScoreDescription,
  analyzeFormIssues,
  calculateConsistencyScore,
  getPerformanceTrend,
  generateSessionStats,
} from "./scoring";

// Base classes
export {
  BaseExerciseStateMachine,
  type StateMachineEvent,
  type StateMachineListener,
} from "./BaseStateMachine";

export {
  BaseRepCounter,
  createSquatCounter,
  createPushupCounter,
  createArmCurlCounter,
  type RepCounterEvent,
  type RepCounterListener,
  type PhaseTransition,
} from "./BaseRepCounter";

// Types
export type {
  ExerciseType,
  ExercisePhaseBase,
  FormCheckResult,
  AngleCheckResult,
  FrameEvaluationResult,
  SessionEvaluationResult,
  FormIssue,
  RepCounterState,
  StateTransition,
  TransitionData,
  ExerciseEvaluationConfig,
  ExerciseCheck,
  RealTimeFeedback,
  SafeLandmarkGetter,
  ExerciseMetadata,
} from "./types";

export {
  SquatPhase,
  PushupPhase,
  ArmCurlPhase,
  SideRaisePhase,
  ShoulderPressPhase,
  ANGLE_THRESHOLDS,
  PHASE_THRESHOLDS,
  EXERCISE_METADATA,
} from "./types";

// Exercise evaluators (Tickets 015-019)
export {
  SquatEvaluator,
  PushupEvaluator,
  ArmCurlEvaluator,
  SideRaiseEvaluator,
  ShoulderPressEvaluator,
  createEvaluator,
  getSupportedExerciseTypes,
  isExerciseTypeSupported,
} from "./exercises";
