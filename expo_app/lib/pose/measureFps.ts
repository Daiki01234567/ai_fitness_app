/**
 * FPS measurement utilities for pose detection performance monitoring
 *
 * Provides accurate FPS tracking with rolling averages and performance alerts
 *
 * Reference: docs/expo/tickets/011-mediapipe-poc.md
 */

import { FPS_TARGETS, type FpsMeasurement } from "@/types/mediapipe";

/**
 * FPS Counter class for tracking frame rates
 *
 * Features:
 * - Real-time FPS calculation
 * - Rolling average over specified window
 * - Performance warning detection
 *
 * @example
 * const fpsCounter = new FpsCounter();
 *
 * // In frame processor
 * fpsCounter.tick();
 * const fps = fpsCounter.getCurrentFps();
 */
export class FpsCounter {
  private frameCount: number = 0;
  private lastMeasureTime: number = Date.now();
  private currentFps: number = 0;
  private fpsHistory: number[] = [];
  private readonly historySize: number;
  private readonly measureIntervalMs: number;

  /**
   * Create a new FPS counter
   *
   * @param historySize - Number of FPS samples to keep for averaging (default: 10)
   * @param measureIntervalMs - Interval for FPS calculation in ms (default: 1000)
   */
  constructor(historySize: number = 10, measureIntervalMs: number = 1000) {
    this.historySize = historySize;
    this.measureIntervalMs = measureIntervalMs;
  }

  /**
   * Call this method for each frame processed
   * Updates the FPS calculation
   */
  tick(): void {
    this.frameCount++;
    const now = Date.now();
    const elapsed = now - this.lastMeasureTime;

    if (elapsed >= this.measureIntervalMs) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);

      // Update history
      this.fpsHistory.push(this.currentFps);
      if (this.fpsHistory.length > this.historySize) {
        this.fpsHistory.shift();
      }

      // Reset for next measurement
      this.frameCount = 0;
      this.lastMeasureTime = now;
    }
  }

  /**
   * Get the current FPS value
   *
   * @returns Current FPS (0 if not yet calculated)
   */
  getCurrentFps(): number {
    return this.currentFps;
  }

  /**
   * Get the average FPS over the history window
   *
   * @returns Average FPS
   */
  getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 0;

    const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  /**
   * Get comprehensive FPS measurement data
   *
   * @returns FpsMeasurement object with current, average, and timing data
   */
  getMeasurement(): FpsMeasurement {
    const now = Date.now();
    const elapsed = now - this.lastMeasureTime;

    return {
      currentFps: this.currentFps,
      averageFps: this.getAverageFps(),
      frameCount: this.frameCount,
      elapsedMs: elapsed,
    };
  }

  /**
   * Check if FPS is below the minimum acceptable threshold
   *
   * @returns True if FPS is below minimum (15 fps)
   */
  isBelowMinimum(): boolean {
    return this.currentFps > 0 && this.currentFps < FPS_TARGETS.MINIMUM;
  }

  /**
   * Check if FPS meets the recommended target
   *
   * @returns True if FPS meets or exceeds recommended (24 fps)
   */
  meetsRecommended(): boolean {
    return this.currentFps >= FPS_TARGETS.RECOMMENDED;
  }

  /**
   * Check if FPS meets the optimal target
   *
   * @returns True if FPS meets or exceeds optimal (30 fps)
   */
  meetsOptimal(): boolean {
    return this.currentFps >= FPS_TARGETS.OPTIMAL;
  }

  /**
   * Get performance level based on current FPS
   *
   * @returns "optimal" | "good" | "acceptable" | "poor"
   */
  getPerformanceLevel(): "optimal" | "good" | "acceptable" | "poor" {
    if (this.currentFps >= FPS_TARGETS.OPTIMAL) return "optimal";
    if (this.currentFps >= FPS_TARGETS.RECOMMENDED) return "good";
    if (this.currentFps >= FPS_TARGETS.MINIMUM) return "acceptable";
    return "poor";
  }

  /**
   * Reset all counters and history
   */
  reset(): void {
    this.frameCount = 0;
    this.lastMeasureTime = Date.now();
    this.currentFps = 0;
    this.fpsHistory = [];
  }

  /**
   * Get FPS history array
   *
   * @returns Array of recent FPS measurements
   */
  getHistory(): number[] {
    return [...this.fpsHistory];
  }
}

/**
 * Create a simple FPS measurement function (for quick tests)
 * Returns a closure that updates and returns FPS on each call
 *
 * @param logToConsole - If true, logs FPS to console
 * @returns Function that returns current FPS measurement
 *
 * @example
 * const measureFps = createFpsMeasurer(true);
 *
 * // In frame processor
 * const fps = measureFps();
 */
export function createFpsMeasurer(logToConsole: boolean = false): () => FpsMeasurement {
  let frameCount = 0;
  let lastTime = Date.now();
  let currentFps = 0;
  let totalFrames = 0;

  return (): FpsMeasurement => {
    frameCount++;
    totalFrames++;
    const now = Date.now();
    const elapsed = now - lastTime;

    if (elapsed >= 1000) {
      currentFps = Math.round((frameCount * 1000) / elapsed);

      if (logToConsole) {
        console.log(`[FPS] Current: ${currentFps} fps`);
      }

      frameCount = 0;
      lastTime = now;
    }

    return {
      currentFps,
      averageFps: currentFps, // Simplified for single measurement
      frameCount: totalFrames,
      elapsedMs: elapsed,
    };
  };
}

/**
 * Frame time tracker for detailed performance analysis
 *
 * Tracks individual frame processing times to identify performance bottlenecks
 */
export class FrameTimeTracker {
  private frameTimes: number[] = [];
  private readonly maxSamples: number;
  private lastFrameStart: number | null = null;

  /**
   * Create a frame time tracker
   *
   * @param maxSamples - Maximum number of frame times to track (default: 60)
   */
  constructor(maxSamples: number = 60) {
    this.maxSamples = maxSamples;
  }

  /**
   * Mark the start of frame processing
   */
  startFrame(): void {
    this.lastFrameStart = performance.now();
  }

  /**
   * Mark the end of frame processing and record the duration
   *
   * @returns Frame processing time in milliseconds
   */
  endFrame(): number {
    if (this.lastFrameStart === null) {
      return 0;
    }

    const frameTime = performance.now() - this.lastFrameStart;
    this.lastFrameStart = null;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    return frameTime;
  }

  /**
   * Get the average frame processing time
   *
   * @returns Average frame time in milliseconds
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;

    const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Get the maximum frame processing time
   *
   * @returns Max frame time in milliseconds
   */
  getMaxFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return Math.max(...this.frameTimes);
  }

  /**
   * Get the minimum frame processing time
   *
   * @returns Min frame time in milliseconds
   */
  getMinFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return Math.min(...this.frameTimes);
  }

  /**
   * Check if average frame time exceeds the target for 30fps (33ms)
   *
   * @returns True if average is above 33ms
   */
  isAboveTarget(): boolean {
    return this.getAverageFrameTime() > 33;
  }

  /**
   * Get comprehensive frame time statistics
   */
  getStats(): {
    average: number;
    min: number;
    max: number;
    samples: number;
    exceedsTarget: boolean;
  } {
    return {
      average: this.getAverageFrameTime(),
      min: this.getMinFrameTime(),
      max: this.getMaxFrameTime(),
      samples: this.frameTimes.length,
      exceedsTarget: this.isAboveTarget(),
    };
  }

  /**
   * Reset all tracked frame times
   */
  reset(): void {
    this.frameTimes = [];
    this.lastFrameStart = null;
  }
}

/**
 * Format FPS value for display
 *
 * @param fps - FPS value
 * @returns Formatted string (e.g., "30 fps")
 */
export function formatFps(fps: number): string {
  return `${Math.round(fps)} fps`;
}

/**
 * Format frame time for display
 *
 * @param ms - Frame time in milliseconds
 * @returns Formatted string (e.g., "16.7 ms")
 */
export function formatFrameTime(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}
