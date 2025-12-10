/**
 * Base Rep Counter
 *
 * Simplified rep counting logic that can be used independently
 * or as part of a state machine.
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { RepCounterState } from "./types";

/**
 * Rep counter event types
 */
export interface RepCounterEvent {
  type: "rep_started" | "rep_completed" | "phase_changed";
  count: number;
  phase: string;
  timestamp: number;
}

/**
 * Rep counter listener
 */
export type RepCounterListener = (event: RepCounterEvent) => void;

/**
 * Generic phase transition definition
 */
export interface PhaseTransition {
  /** Current phase */
  from: string;
  /** Target phase */
  to: string;
  /** Whether this transition completes a rep */
  completesRep: boolean;
}

/**
 * Base Rep Counter
 *
 * Provides a simple, reusable rep counting mechanism based on
 * angle thresholds and phase transitions.
 *
 * @example
 * // Create a squat counter
 * const counter = new BaseRepCounter(['standing', 'descending', 'bottom', 'ascending']);
 * counter.setTransitions([
 *   { from: 'standing', to: 'descending', completesRep: false },
 *   { from: 'descending', to: 'bottom', completesRep: false },
 *   { from: 'bottom', to: 'ascending', completesRep: false },
 *   { from: 'ascending', to: 'standing', completesRep: true },
 * ]);
 *
 * // Process angle updates
 * counter.processAngle(kneeAngle);
 */
export class BaseRepCounter {
  private count: number = 0;
  private currentPhase: string;
  private phases: string[];
  private transitions: PhaseTransition[] = [];
  private listeners: RepCounterListener[] = [];
  private lastTransitionTime: number = 0;
  private inRep: boolean = false;

  /** Angle thresholds for phase detection */
  private angleThresholds: Map<string, { enter: number; exit: number }> = new Map();

  /** Minimum time between transitions (ms) to prevent rapid toggling */
  private readonly MIN_TRANSITION_INTERVAL = 100;

  /**
   * Create a new rep counter
   *
   * @param phases - Array of phase names in order
   * @param initialPhase - Starting phase (default: first phase)
   */
  constructor(phases: string[], initialPhase?: string) {
    this.phases = phases;
    this.currentPhase = initialPhase ?? phases[0];
    this.lastTransitionTime = Date.now();
  }

  /**
   * Set phase transitions
   *
   * @param transitions - Array of phase transitions
   */
  setTransitions(transitions: PhaseTransition[]): void {
    this.transitions = transitions;
  }

  /**
   * Set angle threshold for a phase
   *
   * @param phase - Phase name
   * @param enterThreshold - Angle to enter this phase
   * @param exitThreshold - Angle to exit this phase
   */
  setPhaseThreshold(
    phase: string,
    enterThreshold: number,
    exitThreshold: number
  ): void {
    this.angleThresholds.set(phase, {
      enter: enterThreshold,
      exit: exitThreshold,
    });
  }

  /**
   * Process an angle value and update state
   *
   * This is a simple implementation that checks angle against thresholds.
   * Override for more complex logic.
   *
   * @param angle - Current angle value
   * @returns Updated rep count
   */
  processAngle(angle: number): number {
    // Find next phase based on current phase and angle
    const transition = this.findValidTransition(angle);

    if (transition) {
      this.executeTransition(transition);
    }

    return this.count;
  }

  /**
   * Find a valid transition based on current angle
   *
   * @param angle - Current angle
   * @returns Valid transition or null
   */
  private findValidTransition(angle: number): PhaseTransition | null {
    // Check if enough time has passed since last transition
    const now = Date.now();
    if (now - this.lastTransitionTime < this.MIN_TRANSITION_INTERVAL) {
      return null;
    }

    // Find transitions from current phase
    const possibleTransitions = this.transitions.filter(
      (t) => t.from === this.currentPhase
    );

    // Check each possible transition
    for (const transition of possibleTransitions) {
      const threshold = this.angleThresholds.get(transition.to);
      if (threshold && this.shouldTransition(angle, threshold)) {
        return transition;
      }
    }

    return null;
  }

  /**
   * Check if angle meets threshold for transition
   *
   * @param angle - Current angle
   * @param threshold - Enter/exit thresholds
   * @returns True if should transition
   */
  private shouldTransition(
    angle: number,
    threshold: { enter: number; exit: number }
  ): boolean {
    // Simple threshold check - can be overridden for more complex logic
    return angle <= threshold.enter || angle >= threshold.exit;
  }

  /**
   * Execute a phase transition
   *
   * @param transition - Transition to execute
   */
  private executeTransition(transition: PhaseTransition): void {
    const previousPhase = this.currentPhase;
    this.currentPhase = transition.to;
    this.lastTransitionTime = Date.now();

    // Emit phase change event
    this.emitEvent({
      type: "phase_changed",
      count: this.count,
      phase: this.currentPhase,
      timestamp: Date.now(),
    });

    // Check if this completes a rep
    if (transition.completesRep) {
      this.count++;
      this.inRep = false;

      this.emitEvent({
        type: "rep_completed",
        count: this.count,
        phase: this.currentPhase,
        timestamp: Date.now(),
      });
    } else if (previousPhase === this.phases[0] && !this.inRep) {
      // Starting a new rep
      this.inRep = true;

      this.emitEvent({
        type: "rep_started",
        count: this.count + 1, // Next rep number
        phase: this.currentPhase,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Manually transition to a specific phase
   *
   * @param phase - Phase to transition to
   * @param completesRep - Whether this completes a rep
   */
  transitionTo(phase: string, completesRep: boolean = false): void {
    if (!this.phases.includes(phase)) {
      console.warn(`[RepCounter] Invalid phase: ${phase}`);
      return;
    }

    this.executeTransition({
      from: this.currentPhase,
      to: phase,
      completesRep,
    });
  }

  /**
   * Get current count
   *
   * @returns Current rep count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get current phase
   *
   * @returns Current phase name
   */
  getCurrentPhase(): string {
    return this.currentPhase;
  }

  /**
   * Get current state
   *
   * @returns Full state object
   */
  getState(): RepCounterState {
    return {
      count: this.count,
      phase: this.currentPhase,
      inRep: this.inRep,
      lastTransitionTime: this.lastTransitionTime,
    };
  }

  /**
   * Check if currently in a rep
   *
   * @returns True if in active rep
   */
  isInRep(): boolean {
    return this.inRep;
  }

  /**
   * Manually increment count
   */
  incrementCount(): void {
    this.count++;
    this.emitEvent({
      type: "rep_completed",
      count: this.count,
      phase: this.currentPhase,
      timestamp: Date.now(),
    });
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.count = 0;
    this.currentPhase = this.phases[0];
    this.inRep = false;
    this.lastTransitionTime = Date.now();
  }

  /**
   * Add event listener
   *
   * @param listener - Callback for events
   */
  addListener(listener: RepCounterListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   *
   * @param listener - Callback to remove
   */
  removeListener(listener: RepCounterListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Emit event to listeners
   *
   * @param event - Event to emit
   */
  private emitEvent(event: RepCounterEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[RepCounter] Listener error:", error);
      }
    });
  }
}

/**
 * Factory function to create a squat counter
 */
export function createSquatCounter(): BaseRepCounter {
  const counter = new BaseRepCounter([
    "standing",
    "descending",
    "bottom",
    "ascending",
  ]);

  counter.setTransitions([
    { from: "standing", to: "descending", completesRep: false },
    { from: "descending", to: "bottom", completesRep: false },
    { from: "bottom", to: "ascending", completesRep: false },
    { from: "ascending", to: "standing", completesRep: true },
  ]);

  // Knee angle thresholds
  counter.setPhaseThreshold("descending", 140, 180); // Enter when angle < 140
  counter.setPhaseThreshold("bottom", 110, 140); // Enter when angle <= 110
  counter.setPhaseThreshold("ascending", 110, 140); // Enter when angle > 110
  counter.setPhaseThreshold("standing", 160, 180); // Enter when angle >= 160

  return counter;
}

/**
 * Factory function to create a push-up counter
 */
export function createPushupCounter(): BaseRepCounter {
  const counter = new BaseRepCounter([
    "up",
    "descending",
    "bottom",
    "ascending",
  ]);

  counter.setTransitions([
    { from: "up", to: "descending", completesRep: false },
    { from: "descending", to: "bottom", completesRep: false },
    { from: "bottom", to: "ascending", completesRep: false },
    { from: "ascending", to: "up", completesRep: true },
  ]);

  // Elbow angle thresholds
  counter.setPhaseThreshold("descending", 140, 180);
  counter.setPhaseThreshold("bottom", 100, 140);
  counter.setPhaseThreshold("ascending", 100, 140);
  counter.setPhaseThreshold("up", 160, 180);

  return counter;
}

/**
 * Factory function to create an arm curl counter
 */
export function createArmCurlCounter(): BaseRepCounter {
  const counter = new BaseRepCounter([
    "down",
    "curling",
    "top",
    "lowering",
  ]);

  counter.setTransitions([
    { from: "down", to: "curling", completesRep: false },
    { from: "curling", to: "top", completesRep: false },
    { from: "top", to: "lowering", completesRep: false },
    { from: "lowering", to: "down", completesRep: true },
  ]);

  // Elbow angle thresholds (reversed - smaller angle at top)
  counter.setPhaseThreshold("curling", 140, 180);
  counter.setPhaseThreshold("top", 30, 50);
  counter.setPhaseThreshold("lowering", 50, 140);
  counter.setPhaseThreshold("down", 150, 180);

  return counter;
}

export default BaseRepCounter;
