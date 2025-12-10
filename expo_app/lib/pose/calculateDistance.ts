/**
 * Distance calculation utilities for pose analysis
 *
 * Reference: docs/common/specs/06_Form_Evaluation_Logic_v1_0.md
 */

import type { Point2D, Point3D } from "@/types/mediapipe";

/**
 * Calculate Euclidean distance between two points in 2D space
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Distance between the two points
 *
 * @example
 * // Calculate distance between shoulders to determine body width
 * const shoulderWidth = calculateDistance2D(leftShoulder, rightShoulder);
 */
export function calculateDistance2D(pointA: Point2D, pointB: Point2D): number {
  return Math.sqrt(Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2));
}

/**
 * Calculate Euclidean distance between two points in 3D space
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Distance between the two points
 */
export function calculateDistance3D(pointA: Point3D, pointB: Point3D): number {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) +
      Math.pow(pointB.y - pointA.y, 2) +
      Math.pow(pointB.z - pointA.z, 2)
  );
}

/**
 * Calculate the difference in Y coordinates (vertical distance)
 * Useful for checking if points are at the same height
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Absolute difference in Y coordinates
 */
export function calculateVerticalDistance(pointA: Point2D, pointB: Point2D): number {
  return Math.abs(pointB.y - pointA.y);
}

/**
 * Calculate the difference in X coordinates (horizontal distance)
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Absolute difference in X coordinates
 */
export function calculateHorizontalDistance(pointA: Point2D, pointB: Point2D): number {
  return Math.abs(pointB.x - pointA.x);
}

/**
 * Calculate the midpoint between two points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Midpoint coordinates
 */
export function calculateMidpoint2D(pointA: Point2D, pointB: Point2D): Point2D {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
  };
}

/**
 * Calculate the midpoint between two 3D points
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @returns Midpoint coordinates
 */
export function calculateMidpoint3D(pointA: Point3D, pointB: Point3D): Point3D {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
    z: (pointA.z + pointB.z) / 2,
  };
}

/**
 * Check if a point is within a specified distance from another point
 *
 * @param pointA - First point
 * @param pointB - Second point
 * @param threshold - Maximum allowed distance
 * @returns True if the distance is within the threshold
 */
export function isWithinDistance(pointA: Point2D, pointB: Point2D, threshold: number): boolean {
  return calculateDistance2D(pointA, pointB) <= threshold;
}

/**
 * Check left-right symmetry by comparing Y coordinates of symmetric landmarks
 * Used for exercises like side raises where arms should be at same height
 *
 * @param leftPoint - Left side landmark
 * @param rightPoint - Right side landmark
 * @param tolerance - Maximum allowed difference (default: 0.1 = 10%)
 * @returns Object with difference value and pass/fail status
 */
export function checkSymmetry(
  leftPoint: Point2D,
  rightPoint: Point2D,
  tolerance: number = 0.1
): { diff: number; passed: boolean } {
  const diff = Math.abs(leftPoint.y - rightPoint.y);
  const passed = diff <= tolerance;

  return { diff, passed };
}

/**
 * Check if knee is over toe (for squat form)
 * Knee should not extend past the toe
 *
 * @param knee - Knee landmark
 * @param footIndex - Foot index landmark (toe)
 * @param tolerance - Tolerance for X position (default: 0.05 = 5%)
 * @returns True if knee position is acceptable
 */
export function checkKneeOverToe(
  knee: Point2D,
  footIndex: Point2D,
  tolerance: number = 0.05
): boolean {
  // For side view: knee.x should not exceed footIndex.x + tolerance
  return knee.x <= footIndex.x + tolerance;
}

/**
 * Check if elbow is fixed at torso side (for arm curls)
 * Elbow should stay between shoulder and hip
 *
 * @param elbow - Elbow landmark
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param tolerance - Tolerance for Y position (default: 0.05 = 5%)
 * @returns True if elbow position is acceptable
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
 * Calculate the aspect ratio of a bounding box formed by landmarks
 * Useful for detecting body orientation (portrait vs landscape)
 *
 * @param landmarks - Array of landmarks to consider
 * @returns Aspect ratio (width / height)
 */
export function calculateBoundingBoxAspectRatio(landmarks: Point2D[]): number {
  if (landmarks.length === 0) return 0;

  const xValues = landmarks.map((l) => l.x);
  const yValues = landmarks.map((l) => l.y);

  const width = Math.max(...xValues) - Math.min(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);

  if (height === 0) return 0;

  return width / height;
}
