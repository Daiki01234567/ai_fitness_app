/**
 * Arm Curl Evaluator
 *
 * Form evaluation logic for arm curl (bicep curl) exercise.
 * Implements state machine for rep counting and form checks.
 *
 * Reference: docs/expo/tickets/017-armcurl-evaluation.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 *
 * Form Checks:
 * 1. Elbow angle at top (30-50 degrees)
 * 2. Elbow position fixed (no swinging/momentum)
 *
 * State Machine: Down -> Curling -> Top -> Lowering -> Down
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";
import { BaseExerciseStateMachine } from "../BaseStateMachine";
import type { FormCheckResult, FrameEvaluationResult } from "../types";
import { ArmCurlPhase, ANGLE_THRESHOLDS, PHASE_THRESHOLDS } from "../types";
import {
  calculateAngle,
  checkElbowFixed,
  isAngleInRange,
  landmarkToPoint2D,
  getLandmark,
} from "../helpers";

/**
 * Arm Curl Evaluator
 *
 * Evaluates arm curl form and counts reps based on elbow angle.
 * Detects momentum/swinging by tracking elbow position.
 *
 * @example
 * const evaluator = new ArmCurlEvaluator();
 * const result = evaluator.processFrame(landmarks);
 * console.log(`Rep: ${result.repCount}, Score: ${result.score}`);
 */
export class ArmCurlEvaluator extends BaseExerciseStateMachine<ArmCurlPhase> {
  protected readonly exerciseType = "armcurl";

  /**
   * Required landmarks for arm curl evaluation
   * Using left side as default (can be extended for right side)
   */
  protected readonly requiredLandmarks: number[] = [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.LEFT_HIP,
  ];

  /** Thresholds for phase transitions */
  private readonly thresholds = PHASE_THRESHOLDS.armcurl;

  /** Angle thresholds for form checks */
  private readonly angleThresholds = ANGLE_THRESHOLDS.armcurl;

  /** Track initial elbow position for momentum detection */
  private initialElbowY: number | null = null;

  /** Tolerance for elbow movement (5% of normalized coordinates) */
  private readonly ELBOW_MOVEMENT_TOLERANCE = 0.05;

  constructor() {
    super(ArmCurlPhase.DOWN);
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

    // Calculate elbow angle (shoulder-elbow-wrist)
    const elbowAngle = calculateAngle(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(wrist)
    );

    // Track initial elbow position when starting a rep
    if (this.currentPhase === ArmCurlPhase.DOWN && this.initialElbowY === null) {
      this.initialElbowY = elbow.y;
    }

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
   * Note: For arm curls, smaller angle = more curled (top position)
   *
   * @param elbowAngle - Current elbow angle in degrees
   */
  private updatePhase(elbowAngle: number): void {
    switch (this.currentPhase) {
      case ArmCurlPhase.DOWN:
        // Start curling when elbow angle decreases below threshold
        if (elbowAngle < this.thresholds.startCurling) {
          this.transitionTo(ArmCurlPhase.CURLING);
        }
        break;

      case ArmCurlPhase.CURLING:
        // Reach top when elbow angle is small enough
        if (elbowAngle <= this.thresholds.reachTop) {
          this.transitionTo(ArmCurlPhase.TOP);
        }
        // Return to down if angle increases (incomplete curl)
        else if (elbowAngle >= this.thresholds.reachBottom) {
          this.transitionTo(ArmCurlPhase.DOWN);
          this.initialElbowY = null;
        }
        break;

      case ArmCurlPhase.TOP:
        // Start lowering when elbow angle increases
        if (elbowAngle > this.thresholds.startLowering) {
          this.transitionTo(ArmCurlPhase.LOWERING);
        }
        break;

      case ArmCurlPhase.LOWERING:
        // Complete rep when down position reached
        if (elbowAngle >= this.thresholds.reachBottom) {
          this.incrementRep();
          this.transitionTo(ArmCurlPhase.DOWN);
          this.initialElbowY = null;
        }
        // Return to top if angle decreases
        else if (elbowAngle <= this.thresholds.reachTop) {
          this.transitionTo(ArmCurlPhase.TOP);
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

    // Check 1: Elbow angle at top (only relevant in top phase)
    const elbowAngle = calculateAngle(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(wrist)
    );

    const elbowAnglePassed =
      this.currentPhase !== ArmCurlPhase.TOP ||
      isAngleInRange(
        elbowAngle,
        this.angleThresholds.elbowTop.min,
        this.angleThresholds.elbowTop.max
      );

    checks.push({
      passed: elbowAnglePassed,
      value: elbowAngle,
      description: "肘の角度",
      feedback: elbowAnglePassed ? undefined : "肘をしっかり曲げましょう",
    });

    // Check 2: Elbow position fixed (no swinging/momentum)
    const elbowFixedPassed = checkElbowFixed(
      landmarkToPoint2D(elbow),
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(hip),
      this.ELBOW_MOVEMENT_TOLERANCE
    );

    // Also check against initial position if available
    let elbowMovement = 0;
    if (this.initialElbowY !== null) {
      elbowMovement = Math.abs(elbow.y - this.initialElbowY);
    }

    const elbowStablePassed =
      elbowFixedPassed && elbowMovement <= this.ELBOW_MOVEMENT_TOLERANCE;

    checks.push({
      passed: elbowStablePassed,
      value: elbowMovement,
      description: "肘の固定",
      feedback: elbowStablePassed
        ? undefined
        : "肘を固定しましょう（反動を使わない）",
    });

    return checks;
  }

  /**
   * Check if in active rep (not in down position)
   *
   * @returns True if currently performing a rep
   */
  override isInActiveRep(): boolean {
    return this.currentPhase !== ArmCurlPhase.DOWN;
  }

  /**
   * Reset state machine
   */
  override reset(): void {
    super.reset();
    this.initialElbowY = null;
  }
}

export default ArmCurlEvaluator;
