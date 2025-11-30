/**
 * バリデーションユーティリティ
 * リクエストデータの共通バリデーション関数
 */

import { ExerciseType } from "../types/firestore";

import { ValidationError } from "./errors";

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * 値が空でない文字列かどうかをチェック
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 値が正の数値かどうかをチェック
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && value > 0;
}

/**
 * 値が非負の数値かどうかをチェック
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

/**
 * 値が有効なメールアドレスかどうかをチェック
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 値が有効なエクササイズタイプかどうかをチェック
 */
export function isValidExerciseType(value: unknown): value is ExerciseType {
  const validTypes: ExerciseType[] = [
    "squat",
    "armcurl",
    "sideraise",
    "shoulderpress",
    "pushup",
  ];
  return typeof value === "string" && validTypes.includes(value as ExerciseType);
}

/**
 * 文字列の長さをバリデート
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string,
): void {
  if (value.length < minLength || value.length > maxLength) {
    throw ValidationError.outOfRange(fieldName, minLength, maxLength);
  }
}

/**
 * 数値の範囲をバリデート
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string,
): void {
  if (value < min || value > max) {
    throw ValidationError.outOfRange(fieldName, min, max);
  }
}

/**
 * 必須フィールドをバリデート
 */
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null) {
    throw ValidationError.required(fieldName);
  }
  if (typeof value === "string" && value.trim().length === 0) {
    throw ValidationError.required(fieldName);
  }
}

/**
 * ニックネームをバリデート
 */
export function validateNickname(nickname: unknown): string {
  validateRequired(nickname, "ニックネーム");
  if (!isNonEmptyString(nickname)) {
    throw ValidationError.invalidType("ニックネーム", "文字列");
  }
  validateStringLength(nickname, 1, 50, "ニックネーム");
  return nickname.trim();
}

/**
 * メールアドレスをバリデート
 */
export function validateEmail(email: unknown): string {
  validateRequired(email, "メールアドレス");
  if (typeof email !== "string") {
    throw ValidationError.invalidType("メールアドレス", "文字列");
  }
  const trimmedEmail = email.toLowerCase().trim();
  if (!isValidEmail(trimmedEmail)) {
    throw new ValidationError("有効なメールアドレスを入力してください", {
      field: "email",
      constraint: "email",
    });
  }
  return trimmedEmail;
}

/**
 * 生年をバリデート
 */
export function validateBirthYear(birthYear: unknown): number | undefined {
  if (birthYear === undefined || birthYear === null) {
    return undefined;
  }
  if (typeof birthYear !== "number" || !Number.isInteger(birthYear)) {
    throw ValidationError.invalidType("生年", "整数");
  }
  const currentYear = new Date().getFullYear();
  validateNumberRange(birthYear, 1900, currentYear, "生年");
  return birthYear;
}

/**
 * 身長をバリデート（cm）
 */
export function validateHeight(height: unknown): number | undefined {
  if (height === undefined || height === null) {
    return undefined;
  }
  if (!isPositiveNumber(height)) {
    throw ValidationError.invalidType("身長", "正の数値");
  }
  validateNumberRange(height, 50, 300, "身長");
  return height;
}

/**
 * 体重をバリデート（kg）
 */
export function validateWeight(weight: unknown): number | undefined {
  if (weight === undefined || weight === null) {
    return undefined;
  }
  if (!isPositiveNumber(weight)) {
    throw ValidationError.invalidType("体重", "正の数値");
  }
  validateNumberRange(weight, 10, 500, "体重");
  return weight;
}

/**
 * 性別をバリデート
 */
export function validateGender(
  gender: unknown,
): "male" | "female" | "other" | "prefer_not_to_say" | undefined {
  if (gender === undefined || gender === null) {
    return undefined;
  }
  const validGenders = ["male", "female", "other", "prefer_not_to_say"];
  if (!validGenders.includes(gender as string)) {
    throw new ValidationError("性別の値が不正です", {
      field: "gender",
      constraint: `enum:${validGenders.join(",")}`,
    });
  }
  return gender as "male" | "female" | "other" | "prefer_not_to_say";
}

/**
 * フィットネスレベルをバリデート
 */
export function validateFitnessLevel(
  level: unknown,
): "beginner" | "intermediate" | "advanced" | undefined {
  if (level === undefined || level === null) {
    return undefined;
  }
  const validLevels = ["beginner", "intermediate", "advanced"];
  if (!validLevels.includes(level as string)) {
    throw new ValidationError("フィットネスレベルの値が不正です", {
      field: "fitnessLevel",
      constraint: `enum:${validLevels.join(",")}`,
    });
  }
  return level as "beginner" | "intermediate" | "advanced";
}

/**
 * エクササイズタイプをバリデート
 */
export function validateExerciseType(exerciseType: unknown): ExerciseType {
  validateRequired(exerciseType, "種目");
  if (!isValidExerciseType(exerciseType)) {
    throw new ValidationError("種目の値が不正です", {
      field: "exerciseType",
      constraint: "enum:squat,armcurl,sideraise,shoulderpress,pushup",
    });
  }
  return exerciseType;
}

/**
 * ポーズランドマークをバリデート
 */
export function validatePoseLandmark(
  landmark: unknown,
  index: number,
): { index: number; x: number; y: number; z: number; visibility: number } {
  if (typeof landmark !== "object" || landmark === null) {
    throw new ValidationError(`ポーズデータ[${index}]の形式が不正です`, {
      field: `poseData[${index}]`,
      constraint: "object",
    });
  }

  const data = landmark as Record<string, unknown>;

  // インデックスをバリデート
  if (typeof data.index !== "number" || data.index < 0 || data.index > 32) {
    throw new ValidationError(`ポーズデータ[${index}].indexが不正です（0-32）`, {
      field: `poseData[${index}].index`,
      constraint: "range:0-32",
    });
  }

  // 座標をバリデート
  for (const coord of ["x", "y", "z"]) {
    if (typeof data[coord] !== "number") {
      throw ValidationError.invalidType(`poseData[${index}].${coord}`, "数値");
    }
  }

  // 可視性をバリデート
  if (typeof data.visibility !== "number" || data.visibility < 0 || data.visibility > 1) {
    throw new ValidationError(
      `ポーズデータ[${index}].visibilityが不正です（0-1）`,
      {
        field: `poseData[${index}].visibility`,
        constraint: "range:0-1",
      },
    );
  }

  return {
    index: data.index,
    x: data.x as number,
    y: data.y as number,
    z: data.z as number,
    visibility: data.visibility,
  };
}

/**
 * ポーズランドマークの配列をバリデート（33点）
 */
export function validatePoseData(
  poseData: unknown,
): Array<{ index: number; x: number; y: number; z: number; visibility: number }> {
  validateRequired(poseData, "ポーズデータ");
  if (!Array.isArray(poseData)) {
    throw ValidationError.invalidType("ポーズデータ", "配列");
  }
  if (poseData.length !== 33) {
    throw new ValidationError("ポーズデータは33個のランドマークが必要です", {
      field: "poseData",
      constraint: "length:33",
    });
  }
  return poseData.map((landmark, index) => validatePoseLandmark(landmark, index));
}

/**
 * ページネーションの制限値をバリデート
 */
export function validateLimit(limit: unknown, defaultValue = 20, maxValue = 100): number {
  if (limit === undefined || limit === null) {
    return defaultValue;
  }
  if (!isPositiveNumber(limit) || !Number.isInteger(limit)) {
    throw ValidationError.invalidType("limit", "正の整数");
  }
  return Math.min(limit, maxValue);
}

/**
 * ページトークンをバリデート（base64エンコード）
 */
export function validatePageToken(pageToken: unknown): string | undefined {
  if (pageToken === undefined || pageToken === null) {
    return undefined;
  }
  if (!isNonEmptyString(pageToken)) {
    throw ValidationError.invalidType("pageToken", "文字列");
  }
  // 基本的な base64 バリデーション
  try {
    Buffer.from(pageToken, "base64").toString();
    return pageToken;
  } catch {
    throw new ValidationError("pageTokenの形式が不正です", {
      field: "pageToken",
      constraint: "base64",
    });
  }
}
