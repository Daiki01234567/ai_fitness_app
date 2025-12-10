/**
 * Landmark filtering utilities for pose analysis
 *
 * Provides functions to filter landmarks based on visibility/confidence scores
 *
 * Reference: docs/common/specs/06_Form_Evaluation_Logic_v1_0.md
 */

import type { Landmark, PoseDetectionResult } from "@/types/mediapipe";
import { LandmarkIndex, LANDMARK_GROUPS, VISIBILITY_THRESHOLDS } from "@/types/mediapipe";

/**
 * Check if a single landmark has sufficient visibility
 *
 * @param landmark - Landmark to check
 * @param threshold - Minimum visibility threshold (default: 0.5)
 * @returns True if landmark visibility meets or exceeds threshold
 */
export function isLandmarkVisible(
  landmark: Landmark,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): boolean {
  return landmark.visibility >= threshold;
}

/**
 * Filter landmarks by visibility threshold
 *
 * @param landmarks - Array of all 33 landmarks
 * @param threshold - Minimum visibility threshold (default: 0.5)
 * @returns Filtered array of landmarks with sufficient visibility
 */
export function filterByVisibility(
  landmarks: Landmark[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): Landmark[] {
  return landmarks.filter((landmark) => landmark.visibility >= threshold);
}

/**
 * Filter landmarks and return their indices
 *
 * @param landmarks - Array of all 33 landmarks
 * @param threshold - Minimum visibility threshold
 * @returns Array of indices for visible landmarks
 */
export function getVisibleLandmarkIndices(
  landmarks: Landmark[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): number[] {
  return landmarks.reduce<number[]>((indices, landmark, index) => {
    if (landmark.visibility >= threshold) {
      indices.push(index);
    }
    return indices;
  }, []);
}

/**
 * Get a specific landmark if it meets visibility threshold
 *
 * @param landmarks - Array of all 33 landmarks
 * @param index - Landmark index to retrieve
 * @param threshold - Minimum visibility threshold
 * @returns Landmark if visible, null otherwise
 */
export function getVisibleLandmark(
  landmarks: Landmark[],
  index: LandmarkIndex,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): Landmark | null {
  const landmark = landmarks[index];
  if (landmark && landmark.visibility >= threshold) {
    return landmark;
  }
  return null;
}

/**
 * Get landmarks for a specific exercise group
 *
 * @param landmarks - Array of all 33 landmarks
 * @param group - Landmark group from LANDMARK_GROUPS
 * @param threshold - Minimum visibility threshold
 * @returns Object with landmark index as key and landmark as value
 */
export function getLandmarkGroup(
  landmarks: Landmark[],
  group: readonly LandmarkIndex[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): Map<LandmarkIndex, Landmark | null> {
  const result = new Map<LandmarkIndex, Landmark | null>();

  for (const index of group) {
    const landmark = landmarks[index];
    if (landmark && landmark.visibility >= threshold) {
      result.set(index, landmark);
    } else {
      result.set(index, null);
    }
  }

  return result;
}

/**
 * Check if all required landmarks for an exercise are visible
 *
 * @param landmarks - Array of all 33 landmarks
 * @param requiredIndices - Array of required landmark indices
 * @param threshold - Minimum visibility threshold
 * @returns True if all required landmarks are visible
 */
export function areAllLandmarksVisible(
  landmarks: Landmark[],
  requiredIndices: readonly LandmarkIndex[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): boolean {
  return requiredIndices.every((index) => {
    const landmark = landmarks[index];
    return landmark && landmark.visibility >= threshold;
  });
}

/**
 * Count the number of visible landmarks
 *
 * @param landmarks - Array of landmarks
 * @param threshold - Minimum visibility threshold
 * @returns Number of visible landmarks
 */
export function countVisibleLandmarks(
  landmarks: Landmark[],
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): number {
  return landmarks.filter((l) => l.visibility >= threshold).length;
}

/**
 * Calculate average visibility score across all landmarks
 *
 * @param landmarks - Array of landmarks
 * @returns Average visibility score (0.0 - 1.0)
 */
export function calculateAverageVisibility(landmarks: Landmark[]): number {
  if (landmarks.length === 0) return 0;

  const sum = landmarks.reduce((acc, l) => acc + l.visibility, 0);
  return sum / landmarks.length;
}

/**
 * Calculate average visibility for a specific landmark group
 *
 * @param landmarks - Array of all 33 landmarks
 * @param group - Landmark group from LANDMARK_GROUPS
 * @returns Average visibility score for the group
 */
export function calculateGroupVisibility(
  landmarks: Landmark[],
  group: readonly LandmarkIndex[]
): number {
  if (group.length === 0) return 0;

  const sum = group.reduce((acc, index) => {
    const landmark = landmarks[index];
    return acc + (landmark?.visibility ?? 0);
  }, 0);

  return sum / group.length;
}

/**
 * Get visibility statistics for pose detection result
 *
 * @param result - Pose detection result
 * @param threshold - Minimum visibility threshold
 * @returns Visibility statistics
 */
export function getVisibilityStats(
  result: PoseDetectionResult,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): {
  totalLandmarks: number;
  visibleCount: number;
  visiblePercentage: number;
  averageVisibility: number;
  minVisibility: number;
  maxVisibility: number;
} {
  const { landmarks } = result;
  const totalLandmarks = landmarks.length;
  const visibleCount = countVisibleLandmarks(landmarks, threshold);
  const visiblePercentage = (visibleCount / totalLandmarks) * 100;
  const averageVisibility = calculateAverageVisibility(landmarks);

  const visibilities = landmarks.map((l) => l.visibility);
  const minVisibility = Math.min(...visibilities);
  const maxVisibility = Math.max(...visibilities);

  return {
    totalLandmarks,
    visibleCount,
    visiblePercentage,
    averageVisibility,
    minVisibility,
    maxVisibility,
  };
}

/**
 * Check if pose detection result has enough visible landmarks for analysis
 *
 * @param result - Pose detection result
 * @param exerciseType - Type of exercise to check requirements for
 * @param threshold - Minimum visibility threshold
 * @returns True if enough landmarks are visible for the exercise
 */
export function hasEnoughLandmarksForExercise(
  result: PoseDetectionResult,
  exerciseType: keyof typeof LANDMARK_GROUPS,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): boolean {
  const requiredLandmarks = LANDMARK_GROUPS[exerciseType];
  return areAllLandmarksVisible(result.landmarks, requiredLandmarks, threshold);
}

/**
 * Get missing landmarks for an exercise
 *
 * @param landmarks - Array of all 33 landmarks
 * @param exerciseType - Type of exercise
 * @param threshold - Minimum visibility threshold
 * @returns Array of missing landmark indices
 */
export function getMissingLandmarks(
  landmarks: Landmark[],
  exerciseType: keyof typeof LANDMARK_GROUPS,
  threshold: number = VISIBILITY_THRESHOLDS.MINIMUM
): LandmarkIndex[] {
  const requiredLandmarks = LANDMARK_GROUPS[exerciseType];

  return requiredLandmarks.filter((index) => {
    const landmark = landmarks[index];
    return !landmark || landmark.visibility < threshold;
  });
}
