/**
 * Pushup Evaluator
 *
 * Form evaluation logic for push-up exercise.
 * Implements state machine for rep counting and form checks.
 *
 * Reference: docs/expo/tickets/016-pushup-evaluation.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 *
 * Form Checks:
 * 1. Elbow angle (80-100 degrees at bottom)
 * 2. Body line (shoulder-hip-ankle angle >= 170 degrees)
 *
 * State Machine: Up -> Descending -> Bottom -> Ascending -> Up
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";
import { BaseExerciseStateMachine } from "../BaseStateMachine";
import type { FormCheckResult, FrameEvaluationResult } from "../types";
import { PushupPhase, ANGLE_THRESHOLDS, PHASE_THRESHOLDS } from "../types";
import {
  calculateAngle,
  checkBodyLine,
  isAngleInRange,
  landmarkToPoint2D,
  getLandmark,
} from "../helpers";

/**
 * Pushup Evaluator
 *
 * Evaluates push-up form and counts reps based on elbow angle.
 *
 * @example
 * const evaluator = new PushupEvaluator();
 * const result = evaluator.processFrame(landmarks);
 * console.log(`Rep: ${result.repCount}, Score: ${result.score}`);
 */
export class PushupEvaluator extends BaseExerciseStateMachine<PushupPhase> {
  protected readonly exerciseType = "pushup";

  /**
   * Required landmarks for pushup evaluation
   * Using left side as default (can be extended for right side)
   */
  protected readonly requiredLandmarks: number[] = [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.LEFT_ANKLE,
  ];

  /** Thresholds for phase transitions */
  private readonly thresholds = PHASE_THRESHOLDS.pushup;

  /** Angle thresholds for form checks */
  private readonly angleThresholds = ANGLE_THRESHOLDS.pushup;

  constructor() {
    super(PushupPhase.UP);
  }

  /**
   * Process a frame of landmark data
   *
   * @param landmarks - Array of 33 landmarks from pose detection
   * @returns Frame evaluation result
   */
  processFrame(landmarks: Landmark[]): FrameEvaluationResult {
    const timestamp = Date.now();

    // Check if all required landmarks are visible
    if (!this.hasRequiredLandmarks(landmarks)) {
      return {
        timestamp,
        score: 0,
        checks: [],
        phase: this.currentPhase,
        repCount: this.repCount,
        landmarks,
        hasRequiredLandmarks: false,
      };
    }

    // Get key landmarks (safe access after hasRequiredLandmarks check)
    const shoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const elbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const wrist = getLandmark(landmarks, LandmarkIndex.LEFT_WRIST);
    const hip = getLandmark(landmarks, LandmarkIndex.LEFT_HIP);
    const ankle = getLandmark(landmarks, LandmarkIndex.LEFT_ANKLE);

    // Calculate elbow angle (shoulder-elbow-wrist)
    const elbowAngle = calculateAngle(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(wrist)
    );

    // Update state machine based on elbow angle
    this.updatePhase(elbowAngle);

    // Evaluate form
    const checks = this.evaluateForm(landmarks);

    // Calculate score
    const score = this.calculateScore(checks);
    this.addFrameScore(score);

    // Store transition data
    this.storePreviousFrameData(
      this.createTransitionData(
        landmarks,
        { elbow: elbowAngle },
        {}
      )
    );

    return {
      timestamp,
      score,
      checks,
      phase: this.currentPhase,
      repCount: this.repCount,
      landmarks,
      hasRequiredLandmarks: true,
    };
  }

  /**
   * Update phase based on elbow angle
   *
   * @param elbowAngle - Current elbow angle in degrees
   */
  private updatePhase(elbowAngle: number): void {
    switch (this.currentPhase) {
      case PushupPhase.UP:
        // Start descending when elbow angle decreases below threshold
        if (elbowAngle < this.thresholds.startDescending) {
          this.transitionTo(PushupPhase.DESCENDING);
        }
        break;

      case PushupPhase.DESCENDING:
        // Reach bottom when elbow angle is small enough
        if (elbowAngle <= this.thresholds.reachBottom) {
          this.transitionTo(PushupPhase.BOTTOM);
        }
        // Return to up if angle increases (incomplete rep)
        else if (elbowAngle >= this.thresholds.reachUp) {
          this.transitionTo(PushupPhase.UP);
        }
        break;

      case PushupPhase.BOTTOM:
        // Start ascending when elbow angle increases
        if (elbowAngle > this.thresholds.startAscending) {
          this.transitionTo(PushupPhase.ASCENDING);
        }
        break;

      case PushupPhase.ASCENDING:
        // Complete rep when up position reached
        if (elbowAngle >= this.thresholds.reachUp) {
          this.incrementRep();
          this.transitionTo(PushupPhase.UP);
        }
        // Return to bottom if angle decreases
        else if (elbowAngle <= this.thresholds.reachBottom) {
          this.transitionTo(PushupPhase.BOTTOM);
        }
        break;
    }
  }

  /**
   * Evaluate form for the current frame
   *
   * @param landmarks - Array of landmarks
   * @returns Array of form check results
   */
  protected evaluateForm(landmarks: Landmark[]): FormCheckResult[] {
    const checks: FormCheckResult[] = [];

    // Get landmarks (safe access after hasRequiredLandmarks check in processFrame)
    const shoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const elbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const wrist = getLandmark(landmarks, LandmarkIndex.LEFT_WRIST);
    const hip = getLandmark(landmarks, LandmarkIndex.LEFT_HIP);
    const ankle = getLandmark(landmarks, LandmarkIndex.LEFT_ANKLE);

    // Check 1: Elbow angle (only relevant in bottom phase)
    const elbowAngle = calculateAngle(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(wrist)
    );

    const elbowAnglePassed =
      this.currentPhase !== PushupPhase.BOTTOM ||
      isAngleInRange(
        elbowAngle,
        this.angleThresholds.elbowAngle.min,
        this.angleThresholds.elbowAngle.max
      );

    checks.push({
      passed: elbowAnglePassed,
      value: elbowAngle,
      description: "肘の角度",
      feedback: elbowAnglePassed ? undefined : "肘の角度を90度にしましょう",
    });

    // Check 2: Body line (shoulder-hip-ankle should be straight)
    const bodyLineCheck = checkBodyLine(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(hip),
      landmarkToPoint2D(ankle)
    );

    checks.push({
      passed: bodyLineCheck.passed,
      value: bodyLineCheck.angle,
      description: "体のライン",
      feedback: bodyLineCheck.passed
        ? undefined
        : "体のラインを真っ直ぐに保ちましょう",
    });

    return checks;
  }

  /**
   * Check if in active rep (not in up position)
   *
   * @returns True if currently performing a rep
   */
  override isInActiveRep(): boolean {
    return this.currentPhase !== PushupPhase.UP;
  }
}

export default PushupEvaluator;
