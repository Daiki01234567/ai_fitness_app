/**
 * Mock Landmarks for Development/Testing
 *
 * Provides test data for skeleton visualization when MediaPipe is not yet integrated.
 * Contains 33 landmarks as defined by MediaPipe Pose.
 *
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { Landmark } from "@/types/mediapipe";
import { LandmarkIndex } from "@/types/mediapipe";

/**
 * Default standing pose - neutral position
 * Coordinates are normalized (0.0 - 1.0)
 */
export const STANDING_POSE: Landmark[] = [
  // 0: nose
  { x: 0.5, y: 0.12, z: 0.0, visibility: 0.95 },
  // 1: left_eye_inner
  { x: 0.48, y: 0.1, z: -0.02, visibility: 0.92 },
  // 2: left_eye
  { x: 0.46, y: 0.1, z: -0.03, visibility: 0.9 },
  // 3: left_eye_outer
  { x: 0.44, y: 0.1, z: -0.02, visibility: 0.88 },
  // 4: right_eye_inner
  { x: 0.52, y: 0.1, z: -0.02, visibility: 0.92 },
  // 5: right_eye
  { x: 0.54, y: 0.1, z: -0.03, visibility: 0.9 },
  // 6: right_eye_outer
  { x: 0.56, y: 0.1, z: -0.02, visibility: 0.88 },
  // 7: left_ear
  { x: 0.42, y: 0.11, z: 0.02, visibility: 0.85 },
  // 8: right_ear
  { x: 0.58, y: 0.11, z: 0.02, visibility: 0.85 },
  // 9: left_mouth
  { x: 0.48, y: 0.14, z: 0.0, visibility: 0.9 },
  // 10: right_mouth
  { x: 0.52, y: 0.14, z: 0.0, visibility: 0.9 },
  // 11: left_shoulder
  { x: 0.38, y: 0.22, z: 0.0, visibility: 0.95 },
  // 12: right_shoulder
  { x: 0.62, y: 0.22, z: 0.0, visibility: 0.95 },
  // 13: left_elbow
  { x: 0.32, y: 0.35, z: 0.0, visibility: 0.92 },
  // 14: right_elbow
  { x: 0.68, y: 0.35, z: 0.0, visibility: 0.92 },
  // 15: left_wrist
  { x: 0.3, y: 0.48, z: 0.0, visibility: 0.9 },
  // 16: right_wrist
  { x: 0.7, y: 0.48, z: 0.0, visibility: 0.9 },
  // 17: left_pinky
  { x: 0.28, y: 0.5, z: 0.0, visibility: 0.85 },
  // 18: right_pinky
  { x: 0.72, y: 0.5, z: 0.0, visibility: 0.85 },
  // 19: left_index
  { x: 0.29, y: 0.52, z: 0.0, visibility: 0.85 },
  // 20: right_index
  { x: 0.71, y: 0.52, z: 0.0, visibility: 0.85 },
  // 21: left_thumb
  { x: 0.32, y: 0.5, z: 0.02, visibility: 0.85 },
  // 22: right_thumb
  { x: 0.68, y: 0.5, z: 0.02, visibility: 0.85 },
  // 23: left_hip
  { x: 0.42, y: 0.5, z: 0.0, visibility: 0.95 },
  // 24: right_hip
  { x: 0.58, y: 0.5, z: 0.0, visibility: 0.95 },
  // 25: left_knee
  { x: 0.42, y: 0.7, z: 0.0, visibility: 0.92 },
  // 26: right_knee
  { x: 0.58, y: 0.7, z: 0.0, visibility: 0.92 },
  // 27: left_ankle
  { x: 0.42, y: 0.9, z: 0.0, visibility: 0.9 },
  // 28: right_ankle
  { x: 0.58, y: 0.9, z: 0.0, visibility: 0.9 },
  // 29: left_heel
  { x: 0.41, y: 0.92, z: 0.02, visibility: 0.85 },
  // 30: right_heel
  { x: 0.59, y: 0.92, z: 0.02, visibility: 0.85 },
  // 31: left_foot_index
  { x: 0.4, y: 0.94, z: -0.05, visibility: 0.85 },
  // 32: right_foot_index
  { x: 0.6, y: 0.94, z: -0.05, visibility: 0.85 },
];

/**
 * Squat bottom position (90 degree knee angle)
 */
export const SQUAT_BOTTOM_POSE: Landmark[] = [
  // 0: nose
  { x: 0.5, y: 0.25, z: 0.0, visibility: 0.95 },
  // 1: left_eye_inner
  { x: 0.48, y: 0.23, z: -0.02, visibility: 0.92 },
  // 2: left_eye
  { x: 0.46, y: 0.23, z: -0.03, visibility: 0.9 },
  // 3: left_eye_outer
  { x: 0.44, y: 0.23, z: -0.02, visibility: 0.88 },
  // 4: right_eye_inner
  { x: 0.52, y: 0.23, z: -0.02, visibility: 0.92 },
  // 5: right_eye
  { x: 0.54, y: 0.23, z: -0.03, visibility: 0.9 },
  // 6: right_eye_outer
  { x: 0.56, y: 0.23, z: -0.02, visibility: 0.88 },
  // 7: left_ear
  { x: 0.42, y: 0.24, z: 0.02, visibility: 0.85 },
  // 8: right_ear
  { x: 0.58, y: 0.24, z: 0.02, visibility: 0.85 },
  // 9: left_mouth
  { x: 0.48, y: 0.27, z: 0.0, visibility: 0.9 },
  // 10: right_mouth
  { x: 0.52, y: 0.27, z: 0.0, visibility: 0.9 },
  // 11: left_shoulder
  { x: 0.38, y: 0.35, z: 0.0, visibility: 0.95 },
  // 12: right_shoulder
  { x: 0.62, y: 0.35, z: 0.0, visibility: 0.95 },
  // 13: left_elbow
  { x: 0.32, y: 0.42, z: 0.08, visibility: 0.92 },
  // 14: right_elbow
  { x: 0.68, y: 0.42, z: 0.08, visibility: 0.92 },
  // 15: left_wrist
  { x: 0.38, y: 0.38, z: 0.15, visibility: 0.9 },
  // 16: right_wrist
  { x: 0.62, y: 0.38, z: 0.15, visibility: 0.9 },
  // 17: left_pinky
  { x: 0.36, y: 0.4, z: 0.15, visibility: 0.85 },
  // 18: right_pinky
  { x: 0.64, y: 0.4, z: 0.15, visibility: 0.85 },
  // 19: left_index
  { x: 0.37, y: 0.42, z: 0.15, visibility: 0.85 },
  // 20: right_index
  { x: 0.63, y: 0.42, z: 0.15, visibility: 0.85 },
  // 21: left_thumb
  { x: 0.4, y: 0.4, z: 0.17, visibility: 0.85 },
  // 22: right_thumb
  { x: 0.6, y: 0.4, z: 0.17, visibility: 0.85 },
  // 23: left_hip
  { x: 0.42, y: 0.55, z: 0.0, visibility: 0.95 },
  // 24: right_hip
  { x: 0.58, y: 0.55, z: 0.0, visibility: 0.95 },
  // 25: left_knee - bent at 90 degrees, forward
  { x: 0.35, y: 0.7, z: -0.15, visibility: 0.92 },
  // 26: right_knee - bent at 90 degrees, forward
  { x: 0.65, y: 0.7, z: -0.15, visibility: 0.92 },
  // 27: left_ankle
  { x: 0.38, y: 0.9, z: 0.0, visibility: 0.9 },
  // 28: right_ankle
  { x: 0.62, y: 0.9, z: 0.0, visibility: 0.9 },
  // 29: left_heel
  { x: 0.37, y: 0.92, z: 0.02, visibility: 0.85 },
  // 30: right_heel
  { x: 0.63, y: 0.92, z: 0.02, visibility: 0.85 },
  // 31: left_foot_index
  { x: 0.36, y: 0.94, z: -0.05, visibility: 0.85 },
  // 32: right_foot_index
  { x: 0.64, y: 0.94, z: -0.05, visibility: 0.85 },
];

/**
 * Arm curl top position
 */
export const ARM_CURL_TOP_POSE: Landmark[] = [
  // 0: nose
  { x: 0.5, y: 0.12, z: 0.0, visibility: 0.95 },
  // 1: left_eye_inner
  { x: 0.48, y: 0.1, z: -0.02, visibility: 0.92 },
  // 2: left_eye
  { x: 0.46, y: 0.1, z: -0.03, visibility: 0.9 },
  // 3: left_eye_outer
  { x: 0.44, y: 0.1, z: -0.02, visibility: 0.88 },
  // 4: right_eye_inner
  { x: 0.52, y: 0.1, z: -0.02, visibility: 0.92 },
  // 5: right_eye
  { x: 0.54, y: 0.1, z: -0.03, visibility: 0.9 },
  // 6: right_eye_outer
  { x: 0.56, y: 0.1, z: -0.02, visibility: 0.88 },
  // 7: left_ear
  { x: 0.42, y: 0.11, z: 0.02, visibility: 0.85 },
  // 8: right_ear
  { x: 0.58, y: 0.11, z: 0.02, visibility: 0.85 },
  // 9: left_mouth
  { x: 0.48, y: 0.14, z: 0.0, visibility: 0.9 },
  // 10: right_mouth
  { x: 0.52, y: 0.14, z: 0.0, visibility: 0.9 },
  // 11: left_shoulder
  { x: 0.38, y: 0.22, z: 0.0, visibility: 0.95 },
  // 12: right_shoulder
  { x: 0.62, y: 0.22, z: 0.0, visibility: 0.95 },
  // 13: left_elbow - fixed at shoulder side
  { x: 0.35, y: 0.35, z: 0.0, visibility: 0.92 },
  // 14: right_elbow - fixed at shoulder side
  { x: 0.65, y: 0.35, z: 0.0, visibility: 0.92 },
  // 15: left_wrist - curled up near shoulder
  { x: 0.35, y: 0.24, z: -0.1, visibility: 0.9 },
  // 16: right_wrist - curled up near shoulder
  { x: 0.65, y: 0.24, z: -0.1, visibility: 0.9 },
  // 17: left_pinky
  { x: 0.33, y: 0.23, z: -0.1, visibility: 0.85 },
  // 18: right_pinky
  { x: 0.67, y: 0.23, z: -0.1, visibility: 0.85 },
  // 19: left_index
  { x: 0.34, y: 0.22, z: -0.1, visibility: 0.85 },
  // 20: right_index
  { x: 0.66, y: 0.22, z: -0.1, visibility: 0.85 },
  // 21: left_thumb
  { x: 0.37, y: 0.23, z: -0.08, visibility: 0.85 },
  // 22: right_thumb
  { x: 0.63, y: 0.23, z: -0.08, visibility: 0.85 },
  // 23: left_hip
  { x: 0.42, y: 0.5, z: 0.0, visibility: 0.95 },
  // 24: right_hip
  { x: 0.58, y: 0.5, z: 0.0, visibility: 0.95 },
  // 25: left_knee
  { x: 0.42, y: 0.7, z: 0.0, visibility: 0.92 },
  // 26: right_knee
  { x: 0.58, y: 0.7, z: 0.0, visibility: 0.92 },
  // 27: left_ankle
  { x: 0.42, y: 0.9, z: 0.0, visibility: 0.9 },
  // 28: right_ankle
  { x: 0.58, y: 0.9, z: 0.0, visibility: 0.9 },
  // 29: left_heel
  { x: 0.41, y: 0.92, z: 0.02, visibility: 0.85 },
  // 30: right_heel
  { x: 0.59, y: 0.92, z: 0.02, visibility: 0.85 },
  // 31: left_foot_index
  { x: 0.4, y: 0.94, z: -0.05, visibility: 0.85 },
  // 32: right_foot_index
  { x: 0.6, y: 0.94, z: -0.05, visibility: 0.85 },
];

/**
 * Exercise-specific pose sets for animation
 */
export type ExerciseType = "squat" | "pushup" | "arm_curl" | "side_raise" | "shoulder_press";

/**
 * Get mock pose keyframes for animation based on exercise type
 */
export function getMockPoseKeyframes(exerciseType: ExerciseType): Landmark[][] {
  switch (exerciseType) {
    case "squat":
      return [STANDING_POSE, SQUAT_BOTTOM_POSE];
    case "arm_curl":
      return [STANDING_POSE, ARM_CURL_TOP_POSE];
    // Other exercises use standing pose for now
    default:
      return [STANDING_POSE];
  }
}

/**
 * Interpolate between two poses
 * @param poseA Starting pose
 * @param poseB Ending pose
 * @param t Interpolation factor (0.0 - 1.0)
 * @returns Interpolated pose
 */
export function interpolatePoses(
  poseA: Landmark[],
  poseB: Landmark[],
  t: number
): Landmark[] {
  if (poseA.length !== poseB.length) {
    console.warn("Pose length mismatch in interpolation");
    return poseA;
  }

  // Clamp t to 0-1 range
  const clampedT = Math.max(0, Math.min(1, t));

  return poseA.map((landmarkA, index) => {
    const landmarkB = poseB[index];
    if (!landmarkB) return landmarkA;

    return {
      x: landmarkA.x + (landmarkB.x - landmarkA.x) * clampedT,
      y: landmarkA.y + (landmarkB.y - landmarkA.y) * clampedT,
      z: landmarkA.z + (landmarkB.z - landmarkA.z) * clampedT,
      visibility: landmarkA.visibility + (landmarkB.visibility - landmarkA.visibility) * clampedT,
    };
  });
}

/**
 * Add subtle noise to landmarks for more realistic appearance
 * @param landmarks Base landmarks
 * @param noiseAmount Amount of noise (0.0 - 0.1 recommended)
 * @returns Landmarks with added noise
 */
export function addNoiseToLandmarks(
  landmarks: Landmark[],
  noiseAmount: number = 0.005
): Landmark[] {
  return landmarks.map((landmark) => ({
    x: landmark.x + (Math.random() - 0.5) * noiseAmount * 2,
    y: landmark.y + (Math.random() - 0.5) * noiseAmount * 2,
    z: landmark.z + (Math.random() - 0.5) * noiseAmount * 2,
    // Visibility should stay relatively stable
    visibility: Math.max(0, Math.min(1, landmark.visibility + (Math.random() - 0.5) * 0.02)),
  }));
}

/**
 * Create an animated pose sequence
 * @param exerciseType Type of exercise
 * @param duration Duration of one cycle in milliseconds
 * @param currentTime Current time in milliseconds
 * @returns Animated landmark positions
 */
export function getAnimatedMockPose(
  exerciseType: ExerciseType,
  duration: number = 2000,
  currentTime: number
): Landmark[] {
  const keyframes = getMockPoseKeyframes(exerciseType);

  // Safety check - always return standing pose if no keyframes
  if (keyframes.length === 0) {
    return addNoiseToLandmarks(STANDING_POSE);
  }

  const firstFrame = keyframes[0] ?? STANDING_POSE;

  if (keyframes.length === 1) {
    // No animation, just add noise
    return addNoiseToLandmarks(firstFrame);
  }

  const secondFrame = keyframes[1] ?? firstFrame;

  // Calculate phase (0 to 1) with sine wave for smooth animation
  const phase = (Math.sin((currentTime / duration) * Math.PI * 2) + 1) / 2;

  // Interpolate between first two keyframes
  const interpolated = interpolatePoses(firstFrame, secondFrame, phase);

  // Add subtle noise
  return addNoiseToLandmarks(interpolated);
}

/**
 * Get a specific landmark by index with type safety
 */
export function getLandmarkByIndex(
  landmarks: Landmark[],
  index: LandmarkIndex
): Landmark | undefined {
  return landmarks[index];
}

/**
 * Get multiple landmarks by indices
 */
export function getLandmarksByIndices(
  landmarks: Landmark[],
  indices: LandmarkIndex[]
): (Landmark | undefined)[] {
  return indices.map((index) => landmarks[index]);
}
