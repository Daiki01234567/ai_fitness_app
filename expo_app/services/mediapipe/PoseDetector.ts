/**
 * Pose Detector Service
 *
 * Wrapper class for MediaPipe Pose detection.
 * Handles frame processing, landmark filtering, and confidence monitoring.
 *
 * Reference: docs/expo/tickets/013-skeleton-detection.md
 */

import type { Landmark, PoseDetectionResult } from "@/types/mediapipe";
import { VISIBILITY_THRESHOLDS } from "@/types/mediapipe";
import { FpsCounter, FrameTimeTracker } from "@/lib/pose";
import {
  type ExtendedPoseDetectionResult,
  type PoseDetectorConfig,
  type PoseDetectorState,
  type LowConfidenceWarning,
  type LowConfidenceSuggestion,
  DEFAULT_POSE_DETECTOR_CONFIG,
} from "./types";

/**
 * PoseDetector Class
 *
 * Provides a high-level interface for pose detection with:
 * - Confidence-based landmark filtering
 * - Performance monitoring (FPS, processing time)
 * - Low confidence warnings and user feedback suggestions
 *
 * @example
 * const detector = new PoseDetector();
 * detector.initialize();
 *
 * // Process frame
 * const result = await detector.detectPose(landmarks);
 * if (result) {
 *   // Use result.evaluatableLandmarks for form analysis
 *   // Use result.visibleLandmarks for display
 * }
 */
export class PoseDetector {
  private config: PoseDetectorConfig;
  private state: PoseDetectorState;
  private fpsCounter: FpsCounter;
  private frameTimeTracker: FrameTimeTracker;
  private consecutiveLowConfidenceFrames: number = 0;
  private totalFrames: number = 0;
  private successfulDetections: number = 0;
  private lastWarningTime: number = 0;
  private onLowConfidenceWarning?: (warning: LowConfidenceWarning) => void;

  /**
   * Warning cooldown period in milliseconds
   * Prevents spam of warnings to the user
   */
  private readonly WARNING_COOLDOWN_MS = 5000;

  /**
   * Create a new PoseDetector instance
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<PoseDetectorConfig>) {
    this.config = { ...DEFAULT_POSE_DETECTOR_CONFIG, ...config };
    this.state = {
      isActive: false,
      isInitialized: false,
      lastError: null,
      processingMode: "lite",
    };
    this.fpsCounter = new FpsCounter();
    this.frameTimeTracker = new FrameTimeTracker();
  }

  /**
   * Initialize the pose detector
   *
   * Sets up MediaPipe model and prepares for detection.
   * Note: Actual MediaPipe initialization happens in react-native-mediapipe
   */
  initialize(): void {
    this.state.isInitialized = true;
    this.state.isActive = true;
    this.state.lastError = null;
    this.resetCounters();

    if (this.config.debugMode) {
      console.log("[PoseDetector] Initialized with config:", this.config);
    }
  }

  /**
   * Process detected landmarks and return extended result
   *
   * @param landmarks - Raw landmarks array from MediaPipe (33 landmarks)
   * @returns Extended pose detection result with filtered landmarks
   */
  processLandmarks(landmarks: Landmark[]): ExtendedPoseDetectionResult | null {
    if (!this.state.isInitialized || !this.state.isActive) {
      return null;
    }

    this.frameTimeTracker.startFrame();
    this.fpsCounter.tick();
    this.totalFrames++;

    try {
      // Validate landmarks array
      if (!landmarks || landmarks.length !== 33) {
        if (this.config.debugMode) {
          console.warn("[PoseDetector] Invalid landmarks array:", landmarks?.length);
        }
        return null;
      }

      // Calculate average visibility
      const averageVisibility = this.calculateAverageVisibility(landmarks);

      // Filter landmarks by visibility threshold
      const visibleLandmarks = this.filterLandmarks(landmarks, this.config.displayThreshold);
      const evaluatableLandmarks = this.filterLandmarks(
        landmarks,
        this.config.evaluationThreshold
      );

      // Check for low confidence
      this.checkLowConfidence(averageVisibility);

      // Track successful detection
      if (visibleLandmarks.length > 0) {
        this.successfulDetections++;
      }

      const result: ExtendedPoseDetectionResult = {
        landmarks,
        timestamp: Date.now(),
        isDetected: visibleLandmarks.length > 0,
        visibleLandmarks,
        evaluatableLandmarks,
        averageVisibility,
        visibleCount: visibleLandmarks.length,
        evaluatableCount: evaluatableLandmarks.length,
      };

      const processingTime = this.frameTimeTracker.endFrame();

      if (this.config.debugMode && this.totalFrames % 30 === 0) {
        console.log("[PoseDetector] Stats:", {
          fps: this.fpsCounter.getCurrentFps(),
          avgVisibility: averageVisibility.toFixed(2),
          visibleCount: result.visibleCount,
          evaluatableCount: result.evaluatableCount,
          processingTime: `${processingTime.toFixed(1)}ms`,
        });
      }

      return result;
    } catch (error) {
      this.state.lastError = error instanceof Error ? error.message : "Unknown error";
      console.error("[PoseDetector] Error processing landmarks:", error);
      return null;
    }
  }

  /**
   * Create a pose detection result from raw landmarks
   *
   * Convenience method that wraps processLandmarks
   *
   * @param landmarks - Raw landmarks from MediaPipe
   * @returns Extended pose detection result
   */
  detectPose(landmarks: Landmark[]): ExtendedPoseDetectionResult | null {
    return this.processLandmarks(landmarks);
  }

  /**
   * Filter landmarks by visibility threshold
   *
   * @param landmarks - All landmarks
   * @param threshold - Minimum visibility score
   * @returns Filtered landmarks array
   */
  private filterLandmarks(landmarks: Landmark[], threshold: number): Landmark[] {
    return landmarks.filter((landmark) => landmark.visibility >= threshold);
  }

  /**
   * Calculate average visibility across all landmarks
   *
   * @param landmarks - All landmarks
   * @returns Average visibility score (0.0 - 1.0)
   */
  private calculateAverageVisibility(landmarks: Landmark[]): number {
    if (landmarks.length === 0) return 0;
    const sum = landmarks.reduce((acc, landmark) => acc + landmark.visibility, 0);
    return sum / landmarks.length;
  }

  /**
   * Check for low confidence and emit warning if needed
   *
   * @param averageVisibility - Current average visibility
   */
  private checkLowConfidence(averageVisibility: number): void {
    if (averageVisibility < this.config.displayThreshold) {
      this.consecutiveLowConfidenceFrames++;

      // Check if we should warn the user
      if (
        this.consecutiveLowConfidenceFrames >= this.config.maxLowConfidenceFrames &&
        this.shouldEmitWarning()
      ) {
        this.emitLowConfidenceWarning(averageVisibility);
      }
    } else {
      this.consecutiveLowConfidenceFrames = 0;
    }
  }

  /**
   * Check if enough time has passed since last warning
   */
  private shouldEmitWarning(): boolean {
    const now = Date.now();
    return now - this.lastWarningTime > this.WARNING_COOLDOWN_MS;
  }

  /**
   * Emit a low confidence warning
   *
   * @param averageConfidence - Current average confidence
   */
  private emitLowConfidenceWarning(averageConfidence: number): void {
    const suggestion = this.determineSuggestion(averageConfidence);

    const warning: LowConfidenceWarning = {
      averageConfidence,
      consecutiveFrames: this.consecutiveLowConfidenceFrames,
      suggestion,
      timestamp: Date.now(),
    };

    this.lastWarningTime = Date.now();

    if (this.config.debugMode) {
      console.warn("[PoseDetector] Low confidence warning:", warning);
    }

    this.onLowConfidenceWarning?.(warning);
  }

  /**
   * Determine appropriate suggestion based on detection state
   *
   * @param avgConfidence - Average confidence score
   * @returns Appropriate suggestion for the user
   */
  private determineSuggestion(avgConfidence: number): LowConfidenceSuggestion {
    // Very low confidence across all landmarks suggests lighting issues
    if (avgConfidence < 0.3) {
      return "improve_lighting";
    }

    // Check if this might be a distance issue
    // (would need to analyze landmark spread, simplified here)
    if (avgConfidence < 0.4) {
      return "adjust_distance";
    }

    // Default suggestion
    return "adjust_position";
  }

  /**
   * Set callback for low confidence warnings
   *
   * @param callback - Function to call when warning is triggered
   */
  setLowConfidenceCallback(callback: (warning: LowConfidenceWarning) => void): void {
    this.onLowConfidenceWarning = callback;
  }

  /**
   * Get current FPS
   *
   * @returns Current frames per second
   */
  getCurrentFps(): number {
    return this.fpsCounter.getCurrentFps();
  }

  /**
   * Get average FPS
   *
   * @returns Average FPS over measurement period
   */
  getAverageFps(): number {
    return this.fpsCounter.getAverageFps();
  }

  /**
   * Get average frame processing time
   *
   * @returns Average processing time in milliseconds
   */
  getAverageProcessingTime(): number {
    return this.frameTimeTracker.getAverageFrameTime();
  }

  /**
   * Get detection success rate
   *
   * @returns Success rate as percentage (0-100)
   */
  getDetectionSuccessRate(): number {
    if (this.totalFrames === 0) return 0;
    return (this.successfulDetections / this.totalFrames) * 100;
  }

  /**
   * Get current detector state
   *
   * @returns Current state object
   */
  getState(): PoseDetectorState {
    return { ...this.state };
  }

  /**
   * Check if specific landmarks are evaluatable
   *
   * @param landmarks - All landmarks
   * @param indices - Indices to check
   * @returns True if all specified landmarks are evaluatable
   */
  areLandmarksEvaluatable(landmarks: Landmark[], indices: number[]): boolean {
    return indices.every((index) => {
      const landmark = landmarks[index];
      return landmark && landmark.visibility >= this.config.evaluationThreshold;
    });
  }

  /**
   * Get user-friendly message for low confidence situation
   *
   * @param suggestion - Suggestion type
   * @returns Localized message string
   */
  getSuggestionMessage(suggestion: LowConfidenceSuggestion): string {
    const messages: Record<LowConfidenceSuggestion, string> = {
      adjust_position: "全身が映るようにカメラを調整してください",
      improve_lighting: "明るい場所に移動してください",
      adjust_distance: "カメラとの距離を調整してください",
      slow_down: "ゆっくりとした動作で行ってください",
    };

    return messages[suggestion];
  }

  /**
   * Pause detection
   */
  pause(): void {
    this.state.isActive = false;
  }

  /**
   * Resume detection
   */
  resume(): void {
    if (this.state.isInitialized) {
      this.state.isActive = true;
    }
  }

  /**
   * Reset all counters
   */
  resetCounters(): void {
    this.consecutiveLowConfidenceFrames = 0;
    this.totalFrames = 0;
    this.successfulDetections = 0;
    this.lastWarningTime = 0;
    this.fpsCounter.reset();
    this.frameTimeTracker.reset();
  }

  /**
   * Dispose of the detector
   */
  dispose(): void {
    this.state.isActive = false;
    this.state.isInitialized = false;
    this.resetCounters();
    this.onLowConfidenceWarning = undefined;

    if (this.config.debugMode) {
      console.log("[PoseDetector] Disposed");
    }
  }

  /**
   * Update configuration
   *
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<PoseDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get performance summary for debugging
   */
  getPerformanceSummary(): {
    fps: number;
    avgFps: number;
    avgProcessingTime: number;
    successRate: number;
    totalFrames: number;
  } {
    return {
      fps: this.getCurrentFps(),
      avgFps: this.getAverageFps(),
      avgProcessingTime: this.getAverageProcessingTime(),
      successRate: this.getDetectionSuccessRate(),
      totalFrames: this.totalFrames,
    };
  }
}

// Singleton instance
let detectorInstance: PoseDetector | null = null;

/**
 * Get or create global PoseDetector instance
 *
 * @param config - Optional configuration
 * @returns PoseDetector instance
 */
export function getPoseDetector(config?: Partial<PoseDetectorConfig>): PoseDetector {
  if (!detectorInstance) {
    detectorInstance = new PoseDetector(config);
    detectorInstance.initialize();
  }
  return detectorInstance;
}

/**
 * Dispose global PoseDetector instance
 */
export function disposePoseDetector(): void {
  if (detectorInstance) {
    detectorInstance.dispose();
    detectorInstance = null;
  }
}

export default PoseDetector;
