/**
 * 種目関連の型定義
 *
 * 5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）の
 * 型定義を提供します。
 *
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 * @see docs/expo/tickets/020-menu-screen.md
 */

/**
 * サポートされる種目タイプ
 */
export enum ExerciseType {
  SQUAT = "squat",
  PUSHUP = "pushup",
  ARM_CURL = "arm_curl",
  SIDE_RAISE = "side_raise",
  SHOULDER_PRESS = "shoulder_press",
}

/**
 * 種目カテゴリ
 */
export enum ExerciseCategory {
  LOWER_BODY = "lower_body",
  CHEST = "chest",
  ARM = "arm",
  SHOULDER = "shoulder",
}

/**
 * 種目の難易度
 */
export enum ExerciseDifficulty {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

/**
 * 種目の詳細情報
 */
export interface Exercise {
  /** 種目ID */
  id: ExerciseType;
  /** 種目名（日本語） */
  name: string;
  /** 種目名（英語） */
  nameEn: string;
  /** カテゴリ */
  category: ExerciseCategory;
  /** 難易度 */
  difficulty: ExerciseDifficulty;
  /** 器具が必要かどうか */
  requiresEquipment: boolean;
  /** 必要な器具名 */
  equipmentName?: string;
  /** 種目の説明 */
  description: string;
  /** アイコン名 */
  iconName: string;
  /** 対象筋肉群 */
  targetMuscles: string[];
  /** 推奨カメラ向き */
  recommendedCameraPosition: "front" | "side";
  /** 利用可能かどうか */
  available: boolean;
}

/**
 * カテゴリ表示名を取得
 */
export function getCategoryLabel(category: ExerciseCategory): string {
  switch (category) {
    case ExerciseCategory.LOWER_BODY:
      return "下半身";
    case ExerciseCategory.CHEST:
      return "胸・腕";
    case ExerciseCategory.ARM:
      return "腕";
    case ExerciseCategory.SHOULDER:
      return "肩";
    default:
      return "";
  }
}

/**
 * 難易度表示名を取得
 */
export function getDifficultyLabel(difficulty: ExerciseDifficulty): string {
  switch (difficulty) {
    case ExerciseDifficulty.BEGINNER:
      return "初級";
    case ExerciseDifficulty.INTERMEDIATE:
      return "中級";
    case ExerciseDifficulty.ADVANCED:
      return "上級";
    default:
      return "";
  }
}

/**
 * 種目名から種目タイプを取得
 */
export function getExerciseType(exerciseId: string): ExerciseType | null {
  const normalizedId = exerciseId.toLowerCase().replace(/-/g, "_");
  if (Object.values(ExerciseType).includes(normalizedId as ExerciseType)) {
    return normalizedId as ExerciseType;
  }
  return null;
}
