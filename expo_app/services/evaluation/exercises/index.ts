/**
 * Exercise Evaluators Index
 *
 * Central export for all exercise-specific evaluation modules.
 * Each evaluator implements the BaseExerciseStateMachine pattern.
 *
 * Reference: docs/expo/tickets/015-019
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import { SquatEvaluator } from "./SquatEvaluator";
import { PushupEvaluator } from "./PushupEvaluator";
import { ArmCurlEvaluator } from "./ArmCurlEvaluator";
import { SideRaiseEvaluator } from "./SideRaiseEvaluator";
import { ShoulderPressEvaluator } from "./ShoulderPressEvaluator";

// Re-export evaluator classes
export { SquatEvaluator } from "./SquatEvaluator";
export { PushupEvaluator } from "./PushupEvaluator";
export { ArmCurlEvaluator } from "./ArmCurlEvaluator";
export { SideRaiseEvaluator } from "./SideRaiseEvaluator";
export { ShoulderPressEvaluator } from "./ShoulderPressEvaluator";

/**
 * Union type for all evaluators
 */
export type ExerciseEvaluator =
  | SquatEvaluator
  | PushupEvaluator
  | ArmCurlEvaluator
  | SideRaiseEvaluator
  | ShoulderPressEvaluator;

/**
 * Evaluator factory - creates evaluator instance by exercise type
 *
 * @param exerciseType - Type of exercise
 * @returns Evaluator instance or null if type not supported
 *
 * @example
 * const evaluator = createEvaluator('squat');
 * if (evaluator) {
 *   const result = evaluator.processFrame(landmarks);
 * }
 */
export function createEvaluator(exerciseType: string): ExerciseEvaluator | null {
  switch (exerciseType.toLowerCase()) {
    case "squat":
      return new SquatEvaluator();
    case "pushup":
      return new PushupEvaluator();
    case "armcurl":
      return new ArmCurlEvaluator();
    case "sideraise":
      return new SideRaiseEvaluator();
    case "shoulderpress":
      return new ShoulderPressEvaluator();
    default:
      console.warn(`[createEvaluator] Unknown exercise type: ${exerciseType}`);
      return null;
  }
}

/**
 * Get all supported exercise types
 *
 * @returns Array of supported exercise type strings
 */
export function getSupportedExerciseTypes(): string[] {
  return ["squat", "pushup", "armcurl", "sideraise", "shoulderpress"];
}

/**
 * Check if an exercise type is supported
 *
 * @param exerciseType - Type to check
 * @returns True if supported
 */
export function isExerciseTypeSupported(exerciseType: string): boolean {
  return getSupportedExerciseTypes().includes(exerciseType.toLowerCase());
}
