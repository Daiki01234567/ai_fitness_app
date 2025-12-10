/**
 * 種目関連ユーティリティ
 *
 * 種目の色、アイコン、ラベルなどのユーティリティ関数を提供します。
 *
 * @see docs/expo/tickets/025-calendar-view.md
 * @see docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import { ExerciseType } from "@/types/exercise";

/**
 * 種目ごとの色定義
 */
const EXERCISE_COLORS: Record<string, string> = {
  [ExerciseType.SQUAT]: "#4CAF50", // Green
  [ExerciseType.PUSHUP]: "#2196F3", // Blue
  [ExerciseType.ARM_CURL]: "#FF9800", // Orange
  [ExerciseType.SIDE_RAISE]: "#9C27B0", // Purple
  [ExerciseType.SHOULDER_PRESS]: "#F44336", // Red
};

/**
 * 種目ごとのアイコン定義
 */
const EXERCISE_ICONS: Record<string, string> = {
  [ExerciseType.SQUAT]: "human",
  [ExerciseType.PUSHUP]: "arm-flex",
  [ExerciseType.ARM_CURL]: "dumbbell",
  [ExerciseType.SIDE_RAISE]: "weight-lifter",
  [ExerciseType.SHOULDER_PRESS]: "weight",
};

/**
 * 種目ごとの日本語ラベル定義
 */
const EXERCISE_LABELS: Record<string, string> = {
  [ExerciseType.SQUAT]: "スクワット",
  [ExerciseType.PUSHUP]: "プッシュアップ",
  [ExerciseType.ARM_CURL]: "アームカール",
  [ExerciseType.SIDE_RAISE]: "サイドレイズ",
  [ExerciseType.SHOULDER_PRESS]: "ショルダープレス",
};

/**
 * 種目の色を取得
 *
 * @param exerciseType - 種目タイプ
 * @returns カラーコード
 */
export function getExerciseColor(exerciseType: string): string {
  return EXERCISE_COLORS[exerciseType] || "#757575";
}

/**
 * 種目のアイコン名を取得
 *
 * @param exerciseType - 種目タイプ
 * @returns アイコン名
 */
export function getExerciseIcon(exerciseType: string): string {
  return EXERCISE_ICONS[exerciseType] || "dumbbell";
}

/**
 * 種目の日本語ラベルを取得
 *
 * @param exerciseType - 種目タイプ
 * @returns 日本語ラベル
 */
export function getExerciseLabel(exerciseType: string | null | undefined): string {
  if (!exerciseType) return "全て";
  return EXERCISE_LABELS[exerciseType] || exerciseType;
}

/**
 * スコアに応じた色を取得
 *
 * @param score - スコア（0-100）
 * @returns カラーコード
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "#4CAF50"; // Excellent - Green
  if (score >= 60) return "#FF9800"; // Good - Orange
  return "#F44336"; // Needs Improvement - Red
}

/**
 * 時間をフォーマット（秒→分:秒）
 *
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}分${secs > 0 ? `${secs}秒` : ""}`;
  }
  return `${secs}秒`;
}

/**
 * 日付をYYYY-MM-DD形式でフォーマット
 *
 * @param date - Date オブジェクト
 * @returns フォーマットされた日付文字列
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 日付を日本語でフォーマット
 *
 * @param date - Date オブジェクト
 * @returns 日本語フォーマットの日付文字列
 */
export function formatDateJapanese(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 全種目のリストを取得
 *
 * @returns 種目タイプの配列
 */
export function getAllExerciseTypes(): ExerciseType[] {
  return Object.values(ExerciseType);
}

/**
 * 種目タイプかどうかを判定
 *
 * @param value - 判定する値
 * @returns 種目タイプの場合true
 */
export function isValidExerciseType(value: string): value is ExerciseType {
  return Object.values(ExerciseType).includes(value as ExerciseType);
}
