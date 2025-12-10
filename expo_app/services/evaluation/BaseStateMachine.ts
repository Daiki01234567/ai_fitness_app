/**
 * Base State Machine for Exercise Evaluation
 *
 * Abstract base class for exercise-specific state machines.
 * Handles phase transitions and rep counting.
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { Landmark } from "@/types/mediapipe";
import type { FormCheckResult, FrameEvaluationResult, StateTransition, TransitionData } from "./types";
import { areAllLandmarksVisible, getRequiredLandmarks } from "./helpers";

/**
 * State Machine Event
 */
export interface StateMachineEvent {
  type: "phase_change" | "rep_complete" | "error";
  previousPhase?: string;
  currentPhase?: string;
  repCount?: number;
  timestamp: number;
  data?: unknown;
}

/**
 * State Machine Listener
 */
export type StateMachineListener = (event: StateMachineEvent) => void;

/**
 * Base Exercise State Machine
 *
 * Abstract class that provides the foundation for exercise-specific
 * state machines. Handles common functionality like phase management,
 * rep counting, and event emission.
 *
 * @typeParam T - String literal union type for exercise phases
 *
 * @example
 * class SquatStateMachine extends BaseExerciseStateMachine<SquatPhase> {
 *   constructor() {
 *     super(SquatPhase.STANDING);
 *   }
 *
 *   processFrame(landmarks: Landmark[]): FrameEvaluationResult {
 *     // Implementation
 *   }
 *
 *   protected evaluateForm(landmarks: Landmark[]): FormCheckResult[] {
 *     // Implementation
 *   }
 * }
 */
export abstract class BaseExerciseStateMachine<T extends string> {
  /** Current exercise phase */
  protected currentPhase: T;

  /** Initial phase for reset */
  protected readonly initialPhase: T;

  /** Current rep count */
  protected repCount: number = 0;

  /** Event listeners */
  private listeners: StateMachineListener[] = [];

  /** Previous frame data for comparison */
  protected previousFrameData: TransitionData | undefined;

  /** Timestamps for phase tracking */
  protected lastPhaseChangeTime: number = 0;
  protected sessionStartTime: number = Date.now();

  /** Frame scores for current rep */
  protected currentRepScores: number[] = [];

  /** All rep scores */
  protected repScores: number[] = [];

  /** Required landmarks for this exercise */
  protected abstract readonly requiredLandmarks: number[];

  /** Exercise type identifier */
  protected abstract readonly exerciseType: string;

  /**
   * Create a new state machine instance
   *
   * @param initialPhase - Starting phase for the state machine
   */
  constructor(initialPhase: T) {
    this.initialPhase = initialPhase;
    this.currentPhase = initialPhase;
    this.lastPhaseChangeTime = Date.now();
  }

  /**
   * Process a frame of landmark data
   *
   * Must be implemented by subclasses to handle exercise-specific logic.
   *
   * @param landmarks - Array of 33 landmarks from pose detection
   * @returns Frame evaluation result
   */
  abstract processFrame(landmarks: Landmark[]): FrameEvaluationResult;

  /**
   * Evaluate form for the current frame
   *
   * Must be implemented by subclasses to define exercise-specific checks.
   *
   * @param landmarks - Array of landmarks
   * @returns Array of form check results
   */
  protected abstract evaluateForm(landmarks: Landmark[]): FormCheckResult[];

  /**
   * Get current rep count
   *
   * @returns Number of completed reps
   */
  getRepCount(): number {
    return this.repCount;
  }

  /**
   * Get current phase
   *
   * @returns Current exercise phase
   */
  getCurrentPhase(): T {
    return this.currentPhase;
  }

  /**
   * Get all rep scores
   *
   * @returns Array of scores for each completed rep
   */
  getRepScores(): number[] {
    return [...this.repScores];
  }

  /**
   * Transition to a new phase
   *
   * @param newPhase - Phase to transition to
   */
  protected transitionTo(newPhase: T): void {
    if (newPhase === this.currentPhase) return;

    const previousPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.lastPhaseChangeTime = Date.now();

    this.emitEvent({
      type: "phase_change",
      previousPhase,
      currentPhase: newPhase,
      repCount: this.repCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Increment rep count and calculate rep score
   */
  protected incrementRep(): void {
    this.repCount++;

    // Calculate score for completed rep
    if (this.currentRepScores.length > 0) {
      const repScore = Math.round(
        this.currentRepScores.reduce((a, b) => a + b, 0) / this.currentRepScores.length
      );
      this.repScores.push(repScore);
    }

    // Reset current rep scores
    this.currentRepScores = [];

    this.emitEvent({
      type: "rep_complete",
      currentPhase: this.currentPhase,
      repCount: this.repCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Add score to current rep tracking
   *
   * @param score - Frame score to add
   */
  protected addFrameScore(score: number): void {
    this.currentRepScores.push(score);
  }

  /**
   * Check if required landmarks are visible
   *
   * @param landmarks - Array of landmarks
   * @param threshold - Visibility threshold
   * @returns True if all required landmarks are visible
   */
  protected hasRequiredLandmarks(
    landmarks: Landmark[],
    threshold: number = 0.5
  ): boolean {
    return areAllLandmarksVisible(landmarks, this.requiredLandmarks, threshold);
  }

  /**
   * Create transition data from landmarks
   *
   * @param landmarks - Current landmarks
   * @param angles - Computed angles
   * @param distances - Computed distances
   * @returns TransitionData object
   */
  protected createTransitionData(
    landmarks: Landmark[],
    angles: Record<string, number>,
    distances: Record<string, number>
  ): TransitionData {
    return {
      landmarks,
      angles,
      distances,
      previousFrame: this.previousFrameData,
    };
  }

  /**
   * Store frame data for next frame comparison
   *
   * @param data - Current frame transition data
   */
  protected storePreviousFrameData(data: TransitionData): void {
    this.previousFrameData = {
      ...data,
      previousFrame: undefined, // Don't chain indefinitely
    };
  }

  /**
   * Calculate frame score from checks
   *
   * @param checks - Array of form check results
   * @returns Score from 0 to 100
   */
  protected calculateScore(checks: FormCheckResult[]): number {
    if (checks.length === 0) return 0;
    const passed = checks.filter((c) => c.passed).length;
    return Math.round((passed / checks.length) * 100);
  }

  /**
   * Add event listener
   *
   * @param listener - Callback function for events
   */
  addListener(listener: StateMachineListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   *
   * @param listener - Callback to remove
   */
  removeListener(listener: StateMachineListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Emit event to all listeners
   *
   * @param event - Event to emit
   */
  protected emitEvent(event: StateMachineEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[StateMachine] Listener error:", error);
      }
    });
  }

  /**
   * Reset state machine to initial state
   */
  reset(): void {
    this.currentPhase = this.initialPhase;
    this.repCount = 0;
    this.previousFrameData = undefined;
    this.lastPhaseChangeTime = Date.now();
    this.sessionStartTime = Date.now();
    this.currentRepScores = [];
    this.repScores = [];
  }

  /**
   * Get session duration in milliseconds
   *
   * @returns Duration since session start
   */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Get time since last phase change
   *
   * @returns Time in milliseconds since last phase change
   */
  getTimeSincePhaseChange(): number {
    return Date.now() - this.lastPhaseChangeTime;
  }

  /**
   * Check if in active rep (not in resting phase)
   *
   * @returns True if currently performing a rep
   */
  isInActiveRep(): boolean {
    // Override in subclasses for exercise-specific logic
    return this.currentPhase !== this.initialPhase;
  }

  /**
   * Get exercise type
   *
   * @returns Exercise type identifier
   */
  getExerciseType(): string {
    return this.exerciseType;
  }

  /**
   * Get current state summary
   */
  getStateSummary(): {
    phase: T;
    repCount: number;
    sessionDuration: number;
    isActive: boolean;
  } {
    return {
      phase: this.currentPhase,
      repCount: this.repCount,
      sessionDuration: this.getSessionDuration(),
      isActive: this.isInActiveRep(),
    };
  }
}

export default BaseExerciseStateMachine;
