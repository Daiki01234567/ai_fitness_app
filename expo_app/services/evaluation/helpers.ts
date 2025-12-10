/**
 * Form Evaluation Helper Functions
 *
 * Core utility functions for pose analysis including
 * angle calculation, distance measurement, and landmark visibility checks.
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { Landmark, Point2D, Point3D } from "@/types/mediapipe";
import { LandmarkIndex, VISIBILITY_THRESHOLDS } from "@/types/mediapipe";

/**
 * Calculate angle between three points in 2D space (degrees)
 *
 * Uses atan2 for robust angle calculation in all quadrants.
 *
 * @param pointA - Start point
 * @param pointB - Vertex point (angle measured at this point)
 * @param pointC - End point
 * @returns Angle in degrees (0-180)
 *
 * @example
 * // Calculate knee angle
 * const kneeAngle = calculateAngle(hip, knee, ankle);
 */
export function calculateAngle(
  pointA: Point2D,
  pointB: Point2D,
  pointC: Point2D
): number {
  const radians =
    Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);

  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

/**
 * Calculate angle between three 3D points using dot product
 *
 * More accurate for 3D pose analysis when Z coordinates are reliable.
 *
 * @param pointA - Start point
 * @param pointB - Vertex point
 * @param pointC - End point
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle3D(
  pointA: Point3D,
  pointB: Point3D,
  pointC: Point3D
): number {
  // Vector BA
  const vectorBA = {
    x: pointA.x - pointB.x,
    y: pointA.y - pointB.y,
    z: pointA.z - pointB.z,
  };

  // Vector BC
  const vectorBC = {
    x: pointC.x - pointB.x,
    y: pointC.y - pointB.y,
    z: pointC.z - pointB.z,
  };

  // Dot product
  const dotProduct =
    vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y + vectorBA.z * vectorBC.z;

  // Magnitudes
  const magnitudeBA = Math.sqrt(
    vectorBA.x ** 2 + vectorBA.y ** 2 + vectorBA.z ** 2
  );
  const magnitudeBC = Math.sqrt(
    vectorBC.x ** 2 + vectorBC.y ** 2 + vectorBC.z ** 2
  );

  // Avoid division by zero
  if (magnitudeBA === 0 || magnitudeBC === 0) {
    return 0;
  }

  // Calculate angle
  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
  const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));
  const angleInRadians = Math.acos(clampedCosAngle);

  return (angleInRadians * 180.0) / Math.PI;
}

/**
 * Calculate Euclidean distance between two 2D points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Distance (in normalized coordinates if using normalized landmarks)
 *
 * @example
 * // Calculate shoulder width
 * const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
 */
export function calculateDistance(pointA: Point2D, pointB: Point2D): number {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
  );
}

/**
 * Calculate Euclidean distance in 3D space
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Distance
 */
export function calculateDistance3D(pointA: Point3D, pointB: Point3D): number {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) +
      Math.pow(pointB.y - pointA.y, 2) +
      Math.pow(pointB.z - pointA.z, 2)
  );
}

/**
 * Check if a landmark has sufficient visibility for evaluation
 *
 * @param landmark - Landmark to check
 * @param threshold - Minimum visibility threshold (default: 0.5)
 * @returns True if landmark is visible enough
 *
 * @example
 * if (isLandmarkVisible(landmarks[LandmarkIndex.LEFT_KNEE], 0.8)) {
 *   // Safe to use for evaluation
 * }
 */
export function isLandmarkVisible(
  landmark: Landmark | undefined | null,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): boolean {
  if (!landmark) return false;
  return landmark.visibility >= threshold;
}

/**
 * Get a landmark safely, returning null if not visible
 *
 * @param landmarks - Array of landmarks
 * @param index - Landmark index
 * @param threshold - Minimum visibility threshold
 * @returns Landmark if visible, null otherwise
 */
export function getVisibleLandmark(
  landmarks: Landmark[],
  index: number,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): Landmark | null {
  const landmark = landmarks[index];
  if (!landmark || landmark.visibility < threshold) {
    return null;
  }
  return landmark;
}

/**
 * Get a landmark with assertion that it exists
 *
 * Should only be used after hasRequiredLandmarks check.
 * Throws error if landmark is undefined.
 *
 * @param landmarks - Array of landmarks
 * @param index - Landmark index
 * @returns Landmark (guaranteed non-null)
 * @throws Error if landmark is undefined
 */
export function getLandmark(landmarks: Landmark[], index: number): Landmark {
  const landmark = landmarks[index];
  if (!landmark) {
    throw new Error(`Landmark at index ${index} is undefined`);
  }
  return landmark;
}

/**
 * Check if all required landmarks are visible
 *
 * @param landmarks - Array of landmarks
 * @param requiredIndices - Indices of required landmarks
 * @param threshold - Minimum visibility threshold
 * @returns True if all required landmarks are visible
 */
export function areAllLandmarksVisible(
  landmarks: Landmark[],
  requiredIndices: number[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): boolean {
  return requiredIndices.every((index) =>
    isLandmarkVisible(landmarks[index], threshold)
  );
}

/**
 * Calculate midpoint between two points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Midpoint coordinates
 */
export function calculateMidpoint(pointA: Point2D, pointB: Point2D): Point2D {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
  };
}

/**
 * Check if angle is within a specified range
 *
 * @param angle - Angle in degrees
 * @param minAngle - Minimum acceptable angle
 * @param maxAngle - Maximum acceptable angle
 * @returns True if angle is within range
 */
export function isAngleInRange(
  angle: number,
  minAngle: number,
  maxAngle: number
): boolean {
  return angle >= minAngle && angle <= maxAngle;
}

/**
 * Calculate vertical distance (Y difference) between two points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Absolute difference in Y coordinates
 */
export function calculateVerticalDistance(
  pointA: Point2D,
  pointB: Point2D
): number {
  return Math.abs(pointB.y - pointA.y);
}

/**
 * Calculate horizontal distance (X difference) between two points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Absolute difference in X coordinates
 */
export function calculateHorizontalDistance(
  pointA: Point2D,
  pointB: Point2D
): number {
  return Math.abs(pointB.x - pointA.x);
}

/**
 * Check if knee is over toe (for squat form check)
 *
 * @param knee - Knee landmark
 * @param footIndex - Foot index (toe) landmark
 * @param tolerance - Tolerance for X position (default: 0.05 = 5%)
 * @returns True if knee position is acceptable
 */
export function checkKneeOverToe(
  knee: Point2D,
  footIndex: Point2D,
  tolerance: number = 0.05
): boolean {
  // Knee should not extend past the toe
  return knee.x <= footIndex.x + tolerance;
}

/**
 * Check if elbow is fixed at torso side (for arm curls)
 *
 * @param elbow - Elbow landmark
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param tolerance - Tolerance for Y position (default: 0.05 = 5%)
 * @returns True if elbow is properly fixed
 */
export function checkElbowFixed(
  elbow: Point2D,
  shoulder: Point2D,
  hip: Point2D,
  tolerance: number = 0.05
): boolean {
  const midpointY = (shoulder.y + hip.y) / 2;
  return Math.abs(elbow.y - midpointY) <= tolerance;
}

/**
 * Check left-right symmetry
 *
 * @param leftPoint - Left side landmark
 * @param rightPoint - Right side landmark
 * @param tolerance - Maximum allowed Y difference (default: 0.1 = 10%)
 * @returns Object with symmetry status and difference
 */
export function checkSymmetry(
  leftPoint: Point2D,
  rightPoint: Point2D,
  tolerance: number = 0.1
): { passed: boolean; diff: number } {
  const diff = Math.abs(leftPoint.y - rightPoint.y);
  return {
    passed: diff <= tolerance,
    diff,
  };
}

/**
 * Calculate body line angle (shoulder-hip-ankle)
 * Used for push-up form evaluation
 *
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param ankle - Ankle landmark
 * @returns Angle and pass/fail status
 */
export function checkBodyLine(
  shoulder: Point2D,
  hip: Point2D,
  ankle: Point2D
): { angle: number; passed: boolean } {
  const angle = calculateAngle(shoulder, hip, ankle);
  // Body should be relatively straight (170+ degrees)
  return {
    angle,
    passed: angle >= 170,
  };
}

/**
 * Calculate back straightness (for squats)
 *
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param knee - Knee landmark
 * @returns Angle and pass/fail status
 */
export function checkBackStraight(
  shoulder: Point2D,
  hip: Point2D,
  knee: Point2D
): { angle: number; passed: boolean } {
  const angle = calculateAngle(shoulder, hip, knee);
  // Back should maintain angle of 150+ degrees
  return {
    angle,
    passed: angle >= 150,
  };
}

/**
 * Check arm elevation for side raises
 *
 * @param shoulder - Shoulder landmark
 * @param elbow - Elbow landmark
 * @returns Elevation difference and pass/fail status
 */
export function checkArmElevation(
  shoulder: Point2D,
  elbow: Point2D
): { diff: number; passed: boolean } {
  const diff = Math.abs(shoulder.y - elbow.y);
  // Elbow should be at about the same height as shoulder
  return {
    diff,
    passed: diff <= 0.05,
  };
}

/**
 * Check wrist height for shoulder press
 *
 * @param nose - Nose landmark
 * @param wrist - Wrist landmark
 * @returns True if wrist is above head
 */
export function checkWristAboveHead(nose: Point2D, wrist: Point2D): boolean {
  // In normalized coordinates, smaller Y = higher on screen
  return wrist.y < nose.y;
}

/**
 * Get required landmarks for a specific exercise
 *
 * @param exerciseType - Type of exercise
 * @returns Array of required landmark indices
 */
export function getRequiredLandmarks(
  exerciseType: string
): LandmarkIndex[] {
  const requirements: Record<string, LandmarkIndex[]> = {
    squat: [
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_HIP,
      LandmarkIndex.RIGHT_HIP,
      LandmarkIndex.LEFT_KNEE,
      LandmarkIndex.RIGHT_KNEE,
      LandmarkIndex.LEFT_ANKLE,
      LandmarkIndex.RIGHT_ANKLE,
    ],
    pushup: [
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_ELBOW,
      LandmarkIndex.RIGHT_ELBOW,
      LandmarkIndex.LEFT_WRIST,
      LandmarkIndex.RIGHT_WRIST,
      LandmarkIndex.LEFT_HIP,
      LandmarkIndex.RIGHT_HIP,
      LandmarkIndex.LEFT_ANKLE,
      LandmarkIndex.RIGHT_ANKLE,
    ],
    armcurl: [
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_ELBOW,
      LandmarkIndex.RIGHT_ELBOW,
      LandmarkIndex.LEFT_WRIST,
      LandmarkIndex.RIGHT_WRIST,
      LandmarkIndex.LEFT_HIP,
      LandmarkIndex.RIGHT_HIP,
    ],
    sideraise: [
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_ELBOW,
      LandmarkIndex.RIGHT_ELBOW,
      LandmarkIndex.LEFT_WRIST,
      LandmarkIndex.RIGHT_WRIST,
    ],
    shoulderpress: [
      LandmarkIndex.NOSE,
      LandmarkIndex.LEFT_SHOULDER,
      LandmarkIndex.RIGHT_SHOULDER,
      LandmarkIndex.LEFT_ELBOW,
      LandmarkIndex.RIGHT_ELBOW,
      LandmarkIndex.LEFT_WRIST,
      LandmarkIndex.RIGHT_WRIST,
    ],
  };

  return requirements[exerciseType] || [];
}

/**
 * Convert landmark to Point2D (for type safety)
 *
 * @param landmark - Landmark object
 * @returns Point2D with x and y
 */
export function landmarkToPoint2D(landmark: Landmark): Point2D {
  return {
    x: landmark.x,
    y: landmark.y,
  };
}

/**
 * Convert landmark to Point3D (for type safety)
 *
 * @param landmark - Landmark object
 * @returns Point3D with x, y, and z
 */
export function landmarkToPoint3D(landmark: Landmark): Point3D {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
  };
}
