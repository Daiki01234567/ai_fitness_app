/**
 * Angle calculation utilities for pose analysis
 *
 * Reference: docs/common/specs/06_Form_Evaluation_Logic_v1_0.md
 */

import type { Point2D, Point3D } from "@/types/mediapipe";

/**
 * Calculate angle between three points in 2D space
 *
 * @param pointA - Starting point
 * @param pointB - Vertex point (angle measured at this point)
 * @param pointC - End point
 * @returns Angle in degrees (0-180)
 *
 * @example
 * // Calculate elbow angle
 * const elbowAngle = calculateAngle2D(shoulder, elbow, wrist);
 */
export function calculateAngle2D(pointA: Point2D, pointB: Point2D, pointC: Point2D): number {
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
 * Calculate angle between three points in 3D space
 *
 * Uses dot product formula for more accurate 3D angle calculation
 *
 * @param pointA - Starting point
 * @param pointB - Vertex point (angle measured at this point)
 * @param pointC - End point
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle3D(pointA: Point3D, pointB: Point3D, pointC: Point3D): number {
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
  const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y + vectorBA.z * vectorBC.z;

  // Magnitudes
  const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2 + vectorBA.z ** 2);
  const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2 + vectorBC.z ** 2);

  // Avoid division by zero
  if (magnitudeBA === 0 || magnitudeBC === 0) {
    return 0;
  }

  // Calculate angle using dot product formula
  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);

  // Clamp to [-1, 1] to handle floating point errors
  const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));

  // Convert to degrees
  const angleInRadians = Math.acos(clampedCosAngle);
  const angleInDegrees = (angleInRadians * 180.0) / Math.PI;

  return angleInDegrees;
}

/**
 * Check if angle is within a specified range
 *
 * @param angle - Angle in degrees
 * @param minAngle - Minimum acceptable angle
 * @param maxAngle - Maximum acceptable angle
 * @returns True if angle is within range
 */
export function isAngleInRange(angle: number, minAngle: number, maxAngle: number): boolean {
  return angle >= minAngle && angle <= maxAngle;
}

/**
 * Calculate knee angle for squats
 * Measures the angle at the hip between shoulder-hip-knee
 *
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param knee - Knee landmark
 * @returns Object with angle and pass/fail status
 */
export function calculateKneeAngle(
  shoulder: Point2D,
  hip: Point2D,
  knee: Point2D
): { angle: number; passed: boolean } {
  const angle = calculateAngle2D(shoulder, hip, knee);
  // Target: 90-110 degrees for proper squat depth
  const passed = isAngleInRange(angle, 90, 110);

  return { angle, passed };
}

/**
 * Calculate elbow angle
 *
 * @param shoulder - Shoulder landmark
 * @param elbow - Elbow landmark
 * @param wrist - Wrist landmark
 * @returns Angle in degrees
 */
export function calculateElbowAngle(shoulder: Point2D, elbow: Point2D, wrist: Point2D): number {
  return calculateAngle2D(shoulder, elbow, wrist);
}

/**
 * Calculate body line angle (shoulder-hip-ankle)
 * Used for checking body alignment in push-ups
 *
 * @param shoulder - Shoulder landmark
 * @param hip - Hip landmark
 * @param ankle - Ankle landmark
 * @returns Object with angle and pass/fail status (170+ degrees = straight line)
 */
export function calculateBodyLineAngle(
  shoulder: Point2D,
  hip: Point2D,
  ankle: Point2D
): { angle: number; passed: boolean } {
  const angle = calculateAngle2D(shoulder, hip, ankle);
  // Target: 170+ degrees for straight body line
  const passed = angle >= 170;

  return { angle, passed };
}
