/**
 * Shoulder Press Evaluator
 *
 * Form evaluation logic for shoulder press (overhead press) exercise.
 * Implements state machine for rep counting and form checks.
 *
 * Reference: docs/expo/tickets/019-shoulderpress-evaluation.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 *
 * Form Checks:
 * 1. Elbow angle at top (160-180 degrees, fully extended)
 * 2. Wrist height (wrists above head/nose at top)
 *
 * State Machine: Down -> Pressing -> Top -> Lowering -> Down
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";
import { BaseExerciseStateMachine } from "../BaseStateMachine";
import type { FormCheckResult, FrameEvaluationResult } from "../types";
import { ShoulderPressPhase, ANGLE_THRESHOLDS } from "../types";
import {
  calculateAngle,
  checkWristAboveHead,
  isAngleInRange,
  landmarkToPoint2D,
  getLandmark,
} from "../helpers";

/**
 * Shoulder Press Evaluator
 *
 * Evaluates shoulder press form and counts reps based on elbow angle
 * and wrist height.
 *
 * @example
 * const evaluator = new ShoulderPressEvaluator();
 * const result = evaluator.processFrame(landmarks);
 * console.log(`Rep: ${result.repCount}, Score: ${result.score}`);
 */
export class ShoulderPressEvaluator extends BaseExerciseStateMachine<ShoulderPressPhase> {
  protected readonly exerciseType = "shoulderpress";

  /**
   * Required landmarks for shoulder press evaluation
   * Using left side as default (can be extended for right side)
   */
  protected readonly requiredLandmarks: number[] = [
    LandmarkIndex.NOSE,
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
  ];

  /** Angle thresholds for form checks */
  private readonly angleThresholds = ANGLE_THRESHOLDS.shoulderpress;

  /** Phase transition thresholds for elbow angle */
  private readonly PHASE_THRESHOLDS = {
    startPressing: 120, // Start pressing when angle increases above this
    reachTop: 160, // Top position when angle >= this
    startLowering: 160, // Start lowering when angle drops below this
    reachBottom: 90, // Bottom position when angle <= this
  };

  constructor() {
    super(ShoulderPressPhase.DOWN);
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
    const nose = getLandmark(landmarks, LandmarkIndex.NOSE);
    const shoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const elbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const wrist = getLandmark(landmarks, LandmarkIndex.LEFT_WRIST);

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
   * For shoulder press:
   * - Large angle (160-180) = top (arms extended overhead)
   * - Small angle (80-100) = bottom (starting position)
   *
   * @param elbowAngle - Current elbow angle in degrees
   */
  private updatePhase(elbowAngle: number): void {
    switch (this.currentPhase) {
      case ShoulderPressPhase.DOWN:
        // Start pressing when elbow angle increases above threshold
        if (elbowAngle > this.PHASE_THRESHOLDS.startPressing) {
          this.transitionTo(ShoulderPressPhase.PRESSING);
        }
        break;

      case ShoulderPressPhase.PRESSING:
        // Reach top when elbow is fully extended
        if (elbowAngle >= this.PHASE_THRESHOLDS.reachTop) {
          this.transitionTo(ShoulderPressPhase.TOP);
        }
        // Return to down if angle decreases (incomplete press)
        else if (elbowAngle <= this.PHASE_THRESHOLDS.reachBottom) {
          this.transitionTo(ShoulderPressPhase.DOWN);
        }
        break;

      case ShoulderPressPhase.TOP:
        // Start lowering when elbow angle decreases
        if (elbowAngle < this.PHASE_THRESHOLDS.startLowering) {
          this.transitionTo(ShoulderPressPhase.LOWERING);
        }
        break;

      case ShoulderPressPhase.LOWERING:
        // Complete rep when down position reached
        if (elbowAngle <= this.PHASE_THRESHOLDS.reachBottom) {
          this.incrementRep();
          this.transitionTo(ShoulderPressPhase.DOWN);
        }
        // Return to top if angle increases
        else if (elbowAngle >= this.PHASE_THRESHOLDS.reachTop) {
          this.transitionTo(ShoulderPressPhase.TOP);
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
    const nose = getLandmark(landmarks, LandmarkIndex.NOSE);
    const shoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const elbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const wrist = getLandmark(landmarks, LandmarkIndex.LEFT_WRIST);

    // Check 1: Elbow angle at top (should be fully extended)
    const elbowAngle = calculateAngle(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(wrist)
    );

    const elbowAnglePassed =
      this.currentPhase !== ShoulderPressPhase.TOP ||
      isAngleInRange(
        elbowAngle,
        this.angleThresholds.elbowTop.min,
        this.angleThresholds.elbowTop.max
      );

    checks.push({
      passed: elbowAnglePassed,
      value: elbowAngle,
      description: "肘の角度",
      feedback: elbowAnglePassed ? undefined : "肘をしっかり伸ばしましょう",
    });

    // Check 2: Wrist height at top (should be above head)
    const wristAboveHead = checkWristAboveHead(
      landmarkToPoint2D(nose),
      landmarkToPoint2D(wrist)
    );

    const wristHeightPassed =
      this.currentPhase !== ShoulderPressPhase.TOP || wristAboveHead;

    checks.push({
      passed: wristHeightPassed,
      value: nose.y - wrist.y, // Positive if wrist above head
      description: "手首の高さ",
      feedback: wristHeightPassed
        ? undefined
        : "手首を頭より高く上げましょう",
    });

    return checks;
  }

  /**
   * Check if in active rep (not in down position)
   *
   * @returns True if currently performing a rep
   */
  override isInActiveRep(): boolean {
    return this.currentPhase !== ShoulderPressPhase.DOWN;
  }
}

export default ShoulderPressEvaluator;
