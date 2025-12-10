/**
 * Frame Skip Controller
 *
 * Provides dynamic FPS adjustment based on device processing capabilities.
 * Ensures stable performance across different devices by intelligently
 * skipping frames when processing is slow.
 *
 * Reference: docs/expo/tickets/012-camera-implementation.md
 */

import { FPS_TARGETS } from "@/types/mediapipe";

/**
 * Frame skip metrics for logging and monitoring
 */
export interface FrameSkipMetrics {
  /** Total number of frames received */
  totalFrames: number;
  /** Number of frames that were skipped */
  skippedFrames: number;
  /** Skip rate (0.0 - 1.0) */
  skipRate: number;
  /** Average FPS achieved */
  averageFPS: number;
  /** Current target FPS */
  currentTargetFPS: number;
  /** Device model (if available) */
  deviceModel?: string;
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Target FPS levels for dynamic adjustment
 */
export const TARGET_FPS_LEVELS = {
  /** Optimal performance - 30fps */
  OPTIMAL: 30,
  /** Good performance - 24fps */
  GOOD: 24,
  /** Minimum acceptable - 15fps */
  MINIMUM: 15,
} as const;

/**
 * Processing time thresholds for FPS adjustment (in milliseconds)
 */
export const PROCESSING_TIME_THRESHOLDS = {
  /** Heavy processing - trigger FPS reduction to 15fps */
  HEAVY: 50,
  /** Medium processing - trigger FPS reduction to 24fps */
  MEDIUM: 33,
} as const;

/**
 * Frame Skip Controller Class
 *
 * Manages dynamic frame rate adjustment to maintain smooth performance.
 * When MediaPipe processing takes too long, automatically reduces target FPS.
 *
 * @example
 * const controller = new FrameSkipController();
 *
 * // In frame processor
 * if (!controller.shouldProcessFrame(Date.now())) {
 *   return; // Skip this frame
 * }
 *
 * const startTime = performance.now();
 * const result = await detectPose(frame);
 * const processingTime = performance.now() - startTime;
 *
 * controller.adjustTargetFPS(processingTime);
 */
export class FrameSkipController {
  private lastProcessedTime: number = 0;
  private targetInterval: number;
  private consecutiveSkips: number = 0;
  private totalFrames: number = 0;
  private skippedFrames: number = 0;
  private fpsHistory: number[] = [];
  private lastMetricTime: number = Date.now();
  private framesInCurrentPeriod: number = 0;

  /**
   * Maximum consecutive frames to skip before forcing processing
   * Prevents long gaps that could affect form evaluation accuracy
   */
  private readonly MAX_CONSECUTIVE_SKIPS = 3;

  /**
   * Size of FPS history for averaging
   */
  private readonly FPS_HISTORY_SIZE = 10;

  /**
   * Metric collection interval in milliseconds (1 minute)
   */
  private readonly METRIC_INTERVAL_MS = 60000;

  /**
   * Create a new Frame Skip Controller
   *
   * @param initialTargetFps - Initial target FPS (default: 30)
   */
  constructor(initialTargetFps: number = FPS_TARGETS.OPTIMAL) {
    this.targetInterval = 1000 / initialTargetFps;
    this.lastProcessedTime = Date.now();
  }

  /**
   * Determine if the current frame should be processed
   *
   * Returns true if:
   * - Enough time has passed since the last processed frame
   * - OR maximum consecutive skips have been reached
   *
   * @param currentTime - Current timestamp in milliseconds
   * @returns true if frame should be processed, false to skip
   */
  shouldProcessFrame(currentTime: number): boolean {
    this.totalFrames++;
    const elapsed = currentTime - this.lastProcessedTime;

    // Force processing if max skips reached to maintain accuracy
    const shouldProcess =
      elapsed >= this.targetInterval || this.consecutiveSkips >= this.MAX_CONSECUTIVE_SKIPS;

    if (shouldProcess) {
      this.lastProcessedTime = currentTime;
      this.consecutiveSkips = 0;
      this.framesInCurrentPeriod++;
      return true;
    }

    // Skip this frame
    this.consecutiveSkips++;
    this.skippedFrames++;
    return false;
  }

  /**
   * Adjust target FPS based on MediaPipe processing time
   *
   * Automatically reduces FPS when processing is slow to maintain stability:
   * - > 50ms: Switch to 15fps (minimum)
   * - > 33ms: Switch to 24fps (good)
   * - <= 33ms: Maintain or restore 30fps (optimal)
   *
   * @param processingTime - Time taken to process frame in milliseconds
   */
  adjustTargetFPS(processingTime: number): void {
    const previousInterval = this.targetInterval;

    if (processingTime > PROCESSING_TIME_THRESHOLDS.HEAVY) {
      // Heavy processing - reduce to 15fps
      this.targetInterval = 1000 / TARGET_FPS_LEVELS.MINIMUM;
    } else if (processingTime > PROCESSING_TIME_THRESHOLDS.MEDIUM) {
      // Medium processing - reduce to 24fps
      this.targetInterval = 1000 / TARGET_FPS_LEVELS.GOOD;
    } else {
      // Normal processing - maintain 30fps
      this.targetInterval = 1000 / TARGET_FPS_LEVELS.OPTIMAL;
    }

    // Log FPS changes for debugging
    if (previousInterval !== this.targetInterval) {
      const newFps = Math.round(1000 / this.targetInterval);
      console.log(`[FrameSkipController] FPS adjusted to ${newFps}fps (processing: ${processingTime.toFixed(1)}ms)`);
    }
  }

  /**
   * Get the current target FPS
   *
   * @returns Current target FPS value
   */
  getCurrentTargetFPS(): number {
    return Math.round(1000 / this.targetInterval);
  }

  /**
   * Get the current skip rate
   *
   * @returns Skip rate as a value between 0.0 and 1.0
   */
  getSkipRate(): number {
    if (this.totalFrames === 0) return 0;
    return this.skippedFrames / this.totalFrames;
  }

  /**
   * Record current FPS measurement
   *
   * @param fps - Current FPS value
   */
  recordFps(fps: number): void {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.FPS_HISTORY_SIZE) {
      this.fpsHistory.shift();
    }
  }

  /**
   * Get average FPS from recent history
   *
   * @returns Average FPS value
   */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  /**
   * Get comprehensive frame skip metrics
   *
   * Useful for logging and quality monitoring.
   * Call periodically (e.g., every minute) to track performance.
   *
   * @param deviceModel - Optional device model string
   * @returns Frame skip metrics object
   */
  getMetrics(deviceModel?: string): FrameSkipMetrics {
    const now = Date.now();
    const elapsed = now - this.lastMetricTime;

    // Calculate FPS for current period
    const currentFps =
      elapsed > 0 ? Math.round((this.framesInCurrentPeriod * 1000) / elapsed) : 0;

    const metrics: FrameSkipMetrics = {
      totalFrames: this.totalFrames,
      skippedFrames: this.skippedFrames,
      skipRate: this.getSkipRate(),
      averageFPS: this.getAverageFPS() || currentFps,
      currentTargetFPS: this.getCurrentTargetFPS(),
      deviceModel,
      timestamp: now,
    };

    return metrics;
  }

  /**
   * Check if metrics should be collected (every minute)
   *
   * @returns true if metrics collection interval has passed
   */
  shouldCollectMetrics(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastMetricTime;
    return elapsed >= this.METRIC_INTERVAL_MS;
  }

  /**
   * Reset metric counters after collection
   */
  resetMetricCounters(): void {
    this.lastMetricTime = Date.now();
    this.framesInCurrentPeriod = 0;
    // Note: Don't reset totalFrames/skippedFrames for session-wide tracking
  }

  /**
   * Log metrics to console (for development)
   *
   * @param deviceModel - Optional device model string
   */
  logMetrics(deviceModel?: string): void {
    const metrics = this.getMetrics(deviceModel);
    console.log("[FrameSkipController] Metrics:", {
      totalFrames: metrics.totalFrames,
      skippedFrames: metrics.skippedFrames,
      skipRate: `${(metrics.skipRate * 100).toFixed(1)}%`,
      averageFPS: `${metrics.averageFPS} fps`,
      targetFPS: `${metrics.currentTargetFPS} fps`,
      device: metrics.deviceModel ?? "unknown",
    });
  }

  /**
   * Reset all counters and state
   */
  reset(): void {
    this.lastProcessedTime = Date.now();
    this.targetInterval = 1000 / TARGET_FPS_LEVELS.OPTIMAL;
    this.consecutiveSkips = 0;
    this.totalFrames = 0;
    this.skippedFrames = 0;
    this.fpsHistory = [];
    this.lastMetricTime = Date.now();
    this.framesInCurrentPeriod = 0;
  }

  /**
   * Get number of consecutive frames skipped
   *
   * @returns Consecutive skip count
   */
  getConsecutiveSkips(): number {
    return this.consecutiveSkips;
  }

  /**
   * Check if performance is below acceptable threshold
   *
   * @returns true if skip rate is above 50%
   */
  isPerformanceCritical(): boolean {
    return this.getSkipRate() > 0.5;
  }

  /**
   * Get target frame interval in milliseconds
   *
   * @returns Target interval between frames
   */
  getTargetInterval(): number {
    return this.targetInterval;
  }

  /**
   * Set target FPS manually
   *
   * @param fps - Target FPS value
   */
  setTargetFPS(fps: number): void {
    if (fps > 0 && fps <= TARGET_FPS_LEVELS.OPTIMAL) {
      this.targetInterval = 1000 / fps;
    }
  }
}

/**
 * Create a singleton instance for global use
 */
let globalFrameSkipController: FrameSkipController | null = null;

/**
 * Get or create global Frame Skip Controller instance
 *
 * @returns Global FrameSkipController instance
 */
export function getFrameSkipController(): FrameSkipController {
  if (!globalFrameSkipController) {
    globalFrameSkipController = new FrameSkipController();
  }
  return globalFrameSkipController;
}

/**
 * Reset global Frame Skip Controller
 */
export function resetFrameSkipController(): void {
  if (globalFrameSkipController) {
    globalFrameSkipController.reset();
  }
}

export default FrameSkipController;
