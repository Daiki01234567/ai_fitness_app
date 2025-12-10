/**
 * Side Raise Evaluator
 *
 * Form evaluation logic for side raise (lateral raise) exercise.
 * Implements state machine for rep counting and form checks.
 *
 * Reference: docs/expo/tickets/018-sideraise-evaluation.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 *
 * Form Checks:
 * 1. Arm elevation (elbow at shoulder height, Y diff <= 0.05)
 * 2. Left-right symmetry (Y diff between elbows <= 0.1)
 *
 * State Machine: Down -> Raising -> Top -> Lowering -> Down
 *
 * Note: Uses Y coordinate comparison instead of angles
 *       because side raises are viewed from the front.
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";
import { BaseExerciseStateMachine } from "../BaseStateMachine";
import type { FormCheckResult, FrameEvaluationResult } from "../types";
import { SideRaisePhase, ANGLE_THRESHOLDS } from "../types";
import {
  checkArmElevation,
  checkSymmetry,
  landmarkToPoint2D,
  getLandmark,
} from "../helpers";

/**
 * Side Raise Evaluator
 *
 * Evaluates side raise form and counts reps based on arm elevation.
 * Uses Y coordinate comparison for phase detection since exercise
 * is viewed from the front.
 *
 * @example
 * const evaluator = new SideRaiseEvaluator();
 * const result = evaluator.processFrame(landmarks);
 * console.log(`Rep: ${result.repCount}, Score: ${result.score}`);
 */
export class SideRaiseEvaluator extends BaseExerciseStateMachine<SideRaisePhase> {
  protected readonly exerciseType = "sideraise";

  /**
   * Required landmarks for side raise evaluation
   * Uses both sides for symmetry check
   */
  protected readonly requiredLandmarks: number[] = [
    LandmarkIndex.LEFT_SHOULDER,
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.LEFT_ELBOW,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.LEFT_WRIST,
    LandmarkIndex.RIGHT_WRIST,
  ];

  /** Thresholds for arm elevation */
  private readonly angleThresholds = ANGLE_THRESHOLDS.sideraise;

  /** Y difference threshold for top position (elbow at shoulder height) */
  private readonly TOP_Y_THRESHOLD = 0.05;

  /** Y difference threshold for down position (arms at sides) */
  private readonly DOWN_Y_THRESHOLD = 0.15;

  /** Y difference threshold for transition (arms moving) */
  private readonly TRANSITION_Y_THRESHOLD = 0.10;

  constructor() {
    super(SideRaisePhase.DOWN);
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
    const leftShoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const rightShoulder = getLandmark(landmarks, LandmarkIndex.RIGHT_SHOULDER);
    const leftElbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const rightElbow = getLandmark(landmarks, LandmarkIndex.RIGHT_ELBOW);

    // Calculate arm elevation (average of both sides)
    // In normalized coordinates, smaller Y = higher on screen
    const leftElevation = leftShoulder.y - leftElbow.y;
    const rightElevation = rightShoulder.y - rightElbow.y;
    const avgElevation = (leftElevation + rightElevation) / 2;

    // Update state machine based on arm elevation
    this.updatePhase(avgElevation);

    // Evaluate form
    const checks = this.evaluateForm(landmarks);

    // Calculate score
    const score = this.calculateScore(checks);
    this.addFrameScore(score);

    // Store transition data
    this.storePreviousFrameData(
      this.createTransitionData(
        landmarks,
        { leftElevation, rightElevation, avgElevation },
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
   * Update phase based on arm elevation
   *
   * Positive elevation = elbow above shoulder (raised position)
   * Negative elevation = elbow below shoulder (down position)
   *
   * @param elevation - Shoulder Y - Elbow Y (positive = raised)
   */
  private updatePhase(elevation: number): void {
    switch (this.currentPhase) {
      case SideRaisePhase.DOWN:
        // Start raising when arms move up
        // Elevation increases (elbow moving toward shoulder height)
        if (elevation > -this.DOWN_Y_THRESHOLD) {
          this.transitionTo(SideRaisePhase.RAISING);
        }
        break;

      case SideRaisePhase.RAISING:
        // Reach top when elbow is at shoulder height
        if (Math.abs(elevation) <= this.TOP_Y_THRESHOLD) {
          this.transitionTo(SideRaisePhase.TOP);
        }
        // Return to down if arms drop
        else if (elevation < -this.DOWN_Y_THRESHOLD) {
          this.transitionTo(SideRaisePhase.DOWN);
        }
        break;

      case SideRaisePhase.TOP:
        // Start lowering when arms move down
        if (elevation < -this.TOP_Y_THRESHOLD) {
          this.transitionTo(SideRaisePhase.LOWERING);
        }
        break;

      case SideRaisePhase.LOWERING:
        // Complete rep when down position reached
        if (elevation < -this.DOWN_Y_THRESHOLD) {
          this.incrementRep();
          this.transitionTo(SideRaisePhase.DOWN);
        }
        // Return to top if arms raise again
        else if (Math.abs(elevation) <= this.TOP_Y_THRESHOLD) {
          this.transitionTo(SideRaisePhase.TOP);
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
    const leftShoulder = getLandmark(landmarks, LandmarkIndex.LEFT_SHOULDER);
    const rightShoulder = getLandmark(landmarks, LandmarkIndex.RIGHT_SHOULDER);
    const leftElbow = getLandmark(landmarks, LandmarkIndex.LEFT_ELBOW);
    const rightElbow = getLandmark(landmarks, LandmarkIndex.RIGHT_ELBOW);

    // Check 1: Arm elevation (elbow at shoulder height at top)
    // Use left side for primary check
    const armElevationCheck = checkArmElevation(
      landmarkToPoint2D(leftShoulder),
      landmarkToPoint2D(leftElbow)
    );

    const armElevationPassed =
      this.currentPhase !== SideRaisePhase.TOP || armElevationCheck.passed;

    checks.push({
      passed: armElevationPassed,
      value: armElevationCheck.diff,
      description: "腕の高さ",
      feedback: armElevationPassed
        ? undefined
        : "肘を肩の高さまで上げましょう",
    });

    // Check 2: Left-right symmetry
    const symmetryCheck = checkSymmetry(
      landmarkToPoint2D(leftElbow),
      landmarkToPoint2D(rightElbow),
      this.angleThresholds.symmetryTolerance
    );

    checks.push({
      passed: symmetryCheck.passed,
      value: symmetryCheck.diff,
      description: "左右対称性",
      feedback: symmetryCheck.passed ? undefined : "左右対称に上げましょう",
    });

    return checks;
  }

  /**
   * Check if in active rep (not in down position)
   *
   * @returns True if currently performing a rep
   */
  override isInActiveRep(): boolean {
    return this.currentPhase !== SideRaisePhase.DOWN;
  }
}

export default SideRaiseEvaluator;
