/**
 * 5種目データ定義
 *
 * スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレスの
 * 詳細情報を定義します。
 *
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 * @see docs/expo/tickets/020-menu-screen.md
 */

import {
  Exercise,
  ExerciseType,
  ExerciseCategory,
  ExerciseDifficulty,
} from "@/types/exercise";

/**
 * 5種目のデータ定義
 */
export const EXERCISES: Exercise[] = [
  {
    id: ExerciseType.SQUAT,
    name: "スクワット",
    nameEn: "Squat",
    category: ExerciseCategory.LOWER_BODY,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: false,
    description: "下半身を鍛える基本種目。膝の角度と姿勢をチェックします。",
    iconName: "human-handsdown",
    targetMuscles: ["大腿四頭筋", "臀筋", "ハムストリング"],
    recommendedCameraPosition: "side",
    available: true,
  },
  {
    id: ExerciseType.PUSHUP,
    name: "プッシュアップ",
    nameEn: "Pushup",
    category: ExerciseCategory.CHEST,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: false,
    description: "胸と腕を鍛える基本種目。体のラインと肘の角度をチェックします。",
    iconName: "arm-flex",
    targetMuscles: ["大胸筋", "上腕三頭筋", "三角筋"],
    recommendedCameraPosition: "side",
    available: true,
  },
  {
    id: ExerciseType.ARM_CURL,
    name: "アームカール",
    nameEn: "Arm Curl",
    category: ExerciseCategory.ARM,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: true,
    equipmentName: "ダンベル",
    description: "上腕二頭筋を鍛える種目。肘の角度と位置をチェックします。",
    iconName: "arm-flex-outline",
    targetMuscles: ["上腕二頭筋", "前腕"],
    recommendedCameraPosition: "front",
    available: true,
  },
  {
    id: ExerciseType.SIDE_RAISE,
    name: "サイドレイズ",
    nameEn: "Side Raise",
    category: ExerciseCategory.SHOULDER,
    difficulty: ExerciseDifficulty.INTERMEDIATE,
    requiresEquipment: true,
    equipmentName: "ダンベル",
    description: "肩を鍛える種目。腕の挙上角度と左右対称性をチェックします。",
    iconName: "human-handsup",
    targetMuscles: ["三角筋（側部）"],
    recommendedCameraPosition: "front",
    available: true,
  },
  {
    id: ExerciseType.SHOULDER_PRESS,
    name: "ショルダープレス",
    nameEn: "Shoulder Press",
    category: ExerciseCategory.SHOULDER,
    difficulty: ExerciseDifficulty.INTERMEDIATE,
    requiresEquipment: true,
    equipmentName: "ダンベル",
    description: "肩と腕を鍛える種目。肘の軌道と腰の姿勢をチェックします。",
    iconName: "weight-lifter",
    targetMuscles: ["三角筋", "上腕三頭筋"],
    recommendedCameraPosition: "front",
    available: true,
  },
];

/**
 * 種目IDから種目を取得
 */
export function getExerciseById(id: ExerciseType | string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}

/**
 * カテゴリ別に種目をグループ化
 */
export function getExercisesByCategory(): Record<ExerciseCategory, Exercise[]> {
  return EXERCISES.reduce(
    (acc, exercise) => {
      if (!acc[exercise.category]) {
        acc[exercise.category] = [];
      }
      acc[exercise.category].push(exercise);
      return acc;
    },
    {} as Record<ExerciseCategory, Exercise[]>
  );
}

/**
 * 器具の有無で種目をフィルタリング
 */
export function getExercisesByEquipment(requiresEquipment: boolean): Exercise[] {
  return EXERCISES.filter(
    (exercise) => exercise.requiresEquipment === requiresEquipment
  );
}

/**
 * 利用可能な種目のみを取得
 */
export function getAvailableExercises(): Exercise[] {
  return EXERCISES.filter((exercise) => exercise.available);
}
