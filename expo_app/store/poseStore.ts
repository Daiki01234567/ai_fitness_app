/**
 * Pose Store (Zustand)
 *
 * State management for pose detection data.
 * Stores current pose, detection state, and performance metrics.
 *
 * Reference: docs/expo/tickets/013-skeleton-detection.md
 */

import { create } from "zustand";
import type { Landmark, FpsMeasurement } from "@/types/mediapipe";
import type { ExtendedPoseDetectionResult, LowConfidenceWarning } from "@/services/mediapipe";

/**
 * Pose store state interface
 */
interface PoseState {
  // Detection state
  /** Whether pose detection is currently active */
  isDetecting: boolean;
  /** Whether the detector is initialized */
  isInitialized: boolean;
  /** Current detection error, if any */
  error: string | null;

  // Pose data
  /** Current pose detection result */
  currentPose: ExtendedPoseDetectionResult | null;
  /** Current raw landmarks (33 points) */
  landmarks: Landmark[] | null;
  /** Landmarks suitable for form evaluation (high confidence) */
  evaluatableLandmarks: Landmark[] | null;

  // Performance metrics
  /** Current FPS */
  fps: number;
  /** Average FPS */
  averageFps: number;
  /** Average visibility score */
  averageVisibility: number;
  /** Frame processing time in ms */
  processingTime: number;

  // User feedback
  /** Current low confidence warning, if any */
  lowConfidenceWarning: LowConfidenceWarning | null;
  /** User-friendly message for current warning */
  warningMessage: string | null;

  // Statistics
  /** Total frames processed */
  totalFrames: number;
  /** Successful detections */
  successfulDetections: number;
  /** Detection success rate */
  successRate: number;
}

/**
 * Pose store actions interface
 */
interface PoseActions {
  // State management
  /** Start pose detection */
  startDetection: () => void;
  /** Stop pose detection */
  stopDetection: () => void;
  /** Set initialization state */
  setInitialized: (initialized: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;

  // Pose updates
  /** Update current pose data */
  updatePose: (result: ExtendedPoseDetectionResult | null) => void;
  /** Update raw landmarks */
  updateLandmarks: (landmarks: Landmark[] | null) => void;

  // Performance updates
  /** Update FPS metrics */
  updateFps: (fps: number, averageFps: number) => void;
  /** Update processing time */
  updateProcessingTime: (time: number) => void;

  // Warning management
  /** Set low confidence warning */
  setLowConfidenceWarning: (warning: LowConfidenceWarning | null, message: string | null) => void;
  /** Clear current warning */
  clearWarning: () => void;

  // Statistics
  /** Increment frame counters */
  incrementFrameCount: (successful: boolean) => void;
  /** Reset all statistics */
  resetStats: () => void;

  // Complete reset
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Initial state values
 */
const initialState: PoseState = {
  isDetecting: false,
  isInitialized: false,
  error: null,

  currentPose: null,
  landmarks: null,
  evaluatableLandmarks: null,

  fps: 0,
  averageFps: 0,
  averageVisibility: 0,
  processingTime: 0,

  lowConfidenceWarning: null,
  warningMessage: null,

  totalFrames: 0,
  successfulDetections: 0,
  successRate: 0,
};

/**
 * Pose Store
 *
 * Zustand store for managing pose detection state.
 *
 * @example
 * // In a component
 * const { currentPose, isDetecting, fps } = usePoseStore();
 *
 * // Start detection
 * const { startDetection, updatePose } = usePoseStore();
 * startDetection();
 *
 * // Update pose from detector
 * const result = detector.processLandmarks(landmarks);
 * updatePose(result);
 */
export const usePoseStore = create<PoseState & PoseActions>((set, get) => ({
  // Initial state
  ...initialState,

  // State management actions
  startDetection: () =>
    set({
      isDetecting: true,
      error: null,
    }),

  stopDetection: () =>
    set({
      isDetecting: false,
      currentPose: null,
      landmarks: null,
      evaluatableLandmarks: null,
    }),

  setInitialized: (initialized) =>
    set({
      isInitialized: initialized,
    }),

  setError: (error) =>
    set({
      error,
      isDetecting: error ? false : get().isDetecting,
    }),

  // Pose update actions
  updatePose: (result) => {
    if (result) {
      set({
        currentPose: result,
        landmarks: result.landmarks,
        evaluatableLandmarks: result.evaluatableLandmarks,
        averageVisibility: result.averageVisibility,
      });
    } else {
      set({
        currentPose: null,
        landmarks: null,
        evaluatableLandmarks: null,
        averageVisibility: 0,
      });
    }
  },

  updateLandmarks: (landmarks) =>
    set({
      landmarks,
    }),

  // Performance update actions
  updateFps: (fps, averageFps) =>
    set({
      fps,
      averageFps,
    }),

  updateProcessingTime: (time) =>
    set({
      processingTime: time,
    }),

  // Warning management actions
  setLowConfidenceWarning: (warning, message) =>
    set({
      lowConfidenceWarning: warning,
      warningMessage: message,
    }),

  clearWarning: () =>
    set({
      lowConfidenceWarning: null,
      warningMessage: null,
    }),

  // Statistics actions
  incrementFrameCount: (successful) => {
    const state = get();
    const newTotalFrames = state.totalFrames + 1;
    const newSuccessful = successful ? state.successfulDetections + 1 : state.successfulDetections;
    const newSuccessRate = newTotalFrames > 0 ? (newSuccessful / newTotalFrames) * 100 : 0;

    set({
      totalFrames: newTotalFrames,
      successfulDetections: newSuccessful,
      successRate: newSuccessRate,
    });
  },

  resetStats: () =>
    set({
      totalFrames: 0,
      successfulDetections: 0,
      successRate: 0,
    }),

  // Complete reset
  reset: () => set(initialState),
}));

/**
 * Selector for checking if pose data is available for evaluation
 */
export const selectHasEvaluatablePose = (state: PoseState): boolean => {
  return (
    state.currentPose !== null &&
    state.evaluatableLandmarks !== null &&
    state.evaluatableLandmarks.length > 0
  );
};

/**
 * Selector for getting pose quality level
 */
export const selectPoseQuality = (
  state: PoseState
): "excellent" | "good" | "fair" | "poor" | "none" => {
  if (!state.currentPose) return "none";

  const { averageVisibility, evaluatableLandmarks } = state.currentPose;

  if (averageVisibility >= 0.8 && evaluatableLandmarks.length >= 25) {
    return "excellent";
  }
  if (averageVisibility >= 0.7 && evaluatableLandmarks.length >= 20) {
    return "good";
  }
  if (averageVisibility >= 0.5 && evaluatableLandmarks.length >= 15) {
    return "fair";
  }
  return "poor";
};

/**
 * Selector for performance status
 */
export const selectPerformanceStatus = (
  state: PoseState
): "optimal" | "good" | "acceptable" | "poor" => {
  const { fps, processingTime } = state;

  if (fps >= 30 && processingTime < 33) return "optimal";
  if (fps >= 24 && processingTime < 42) return "good";
  if (fps >= 15 && processingTime < 67) return "acceptable";
  return "poor";
};

export default usePoseStore;
