/**
 * Squat Evaluator
 *
 * Form evaluation logic for squat exercise.
 * Implements state machine for rep counting and form checks.
 *
 * Reference: docs/expo/tickets/015-squat-evaluation.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 *
 * Form Checks:
 * 1. Knee angle (90-110 degrees at bottom)
 * 2. Knee over toe (knee should not extend past toes)
 * 3. Back straight (shoulder-hip-knee angle >= 150 degrees)
 *
 * State Machine: Standing -> Descending -> Bottom -> Ascending -> Standing
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";
import { BaseExerciseStateMachine } from "../BaseStateMachine";
import type { FormCheckResult, FrameEvaluationResult } from "../types";
import { SquatPhase, ANGLE_THRESHOLDS, PHASE_THRESHOLDS } from "../types";
import {
  calculateAngle,
  checkKneeOverToe,
  checkBackStraight,
  isAngleInRange,
  landmarkToPoint2D,
  getLandmark,
} from "../helpers";

/**
 * Squat Evaluator
 *
 * Evaluates squat form and counts reps based on knee angle.
 *
 * @example
 * const evaluator = new SquatEvaluator();
 * const result = evaluator.processFrame(landmarks);
 * console.log(`Rep: ${result.repCount}, Score: ${result.score}`);
 */
export class SquatEvaluator extends BaseExerciseStateMachine<SquatPhase> {
  protected readonly exerciseType = "squat";

  /**
   * Required landmarks for squat evaluation
   * Using left side as default (can be extended for right side)
   */
  protected readonly requiredLandmarks: number[] = [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.LEFT_HIP,
    LandmarkIndex.LEFT_KNEE,
    LandmarkIndex.LEFT_ANKLE,
    LandmarkIndex.LEFT_FOOT_INDEX,
  ];

  /** Thresholds for phase transitions */
  private readonly thresholds = PHASE_THRESHOLDS.squat;

  /** Angle thresholds for form checks */
  private readonly angleThresholds = ANGLE_THRESHOLDS.squat;

  constructor() {
    super(SquatPhase.STANDING);
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
    const hip = getLandmark(landmarks, LandmarkIndex.LEFT_HIP);
    const knee = getLandmark(landmarks, LandmarkIndex.LEFT_KNEE);
    const ankle = getLandmark(landmarks, LandmarkIndex.LEFT_ANKLE);
    const footIndex = getLandmark(landmarks, LandmarkIndex.LEFT_FOOT_INDEX);

    // Calculate knee angle (hip-knee-ankle)
    const kneeAngle = calculateAngle(
      landmarkToPoint2D(hip),
      landmarkToPoint2D(knee),
      landmarkToPoint2D(ankle)
    );

    // Update state machine based on knee angle
    this.updatePhase(kneeAngle);

    // Evaluate form
    const checks = this.evaluateForm(landmarks);

    // Calculate score
    const score = this.calculateScore(checks);
    this.addFrameScore(score);

    // Store transition data
    this.storePreviousFrameData(
      this.createTransitionData(
        landmarks,
        { knee: kneeAngle },
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
   * Update phase based on knee angle
   *
   * @param kneeAngle - Current knee angle in degrees
   */
  private updatePhase(kneeAngle: number): void {
    switch (this.currentPhase) {
      case SquatPhase.STANDING:
        // Start descending when knee angle decreases below threshold
        if (kneeAngle < this.thresholds.startDescending) {
          this.transitionTo(SquatPhase.DESCENDING);
        }
        break;

      case SquatPhase.DESCENDING:
        // Reach bottom when knee angle is small enough
        if (kneeAngle <= this.thresholds.reachBottom) {
          this.transitionTo(SquatPhase.BOTTOM);
        }
        // Return to standing if angle increases (incomplete rep)
        else if (kneeAngle >= this.thresholds.reachStanding) {
          this.transitionTo(SquatPhase.STANDING);
        }
        break;

      case SquatPhase.BOTTOM:
        // Start ascending when knee angle increases
        if (kneeAngle > this.thresholds.startAscending) {
          this.transitionTo(SquatPhase.ASCENDING);
        }
        break;

      case SquatPhase.ASCENDING:
        // Complete rep when standing position reached
        if (kneeAngle >= this.thresholds.reachStanding) {
          this.incrementRep();
          this.transitionTo(SquatPhase.STANDING);
        }
        // Return to bottom if angle decreases
        else if (kneeAngle <= this.thresholds.reachBottom) {
          this.transitionTo(SquatPhase.BOTTOM);
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
    const hip = getLandmark(landmarks, LandmarkIndex.LEFT_HIP);
    const knee = getLandmark(landmarks, LandmarkIndex.LEFT_KNEE);
    const ankle = getLandmark(landmarks, LandmarkIndex.LEFT_ANKLE);
    const footIndex = getLandmark(landmarks, LandmarkIndex.LEFT_FOOT_INDEX);

    // Check 1: Knee angle (only relevant in bottom phase)
    const kneeAngle = calculateAngle(
      landmarkToPoint2D(hip),
      landmarkToPoint2D(knee),
      landmarkToPoint2D(ankle)
    );

    const kneeAnglePassed =
      this.currentPhase !== SquatPhase.BOTTOM ||
      isAngleInRange(
        kneeAngle,
        this.angleThresholds.kneeAngle.min,
        this.angleThresholds.kneeAngle.max
      );

    checks.push({
      passed: kneeAnglePassed,
      value: kneeAngle,
      description: "膝の角度",
      feedback: kneeAnglePassed ? undefined : "膝の角度を90-110度にしましょう",
    });

    // Check 2: Knee over toe
    const kneeOverToePassed = checkKneeOverToe(
      landmarkToPoint2D(knee),
      landmarkToPoint2D(footIndex)
    );

    checks.push({
      passed: kneeOverToePassed,
      value: knee.x - footIndex.x,
      description: "膝の位置",
      feedback: kneeOverToePassed ? undefined : "膝がつま先を越えています",
    });

    // Check 3: Back straight
    const backCheck = checkBackStraight(
      landmarkToPoint2D(shoulder),
      landmarkToPoint2D(hip),
      landmarkToPoint2D(knee)
    );

    checks.push({
      passed: backCheck.passed,
      value: backCheck.angle,
      description: "背中の角度",
      feedback: backCheck.passed ? undefined : "背中を真っ直ぐに保ちましょう",
    });

    return checks;
  }

  /**
   * Check if in active rep (not standing)
   *
   * @returns True if currently performing a rep
   */
  override isInActiveRep(): boolean {
    return this.currentPhase !== SquatPhase.STANDING;
  }
}

export default SquatEvaluator;
