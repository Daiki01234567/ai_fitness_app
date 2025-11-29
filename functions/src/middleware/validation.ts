/**
 * バリデーションミドルウェア
 * Cloud Functions 用リクエストバリデーションユーティリティ
 */

import { CallableRequest } from "firebase-functions/v2/https";

import { ValidationError } from "../utils/errors";

/**
 * バリデーション用のスキーマ定義
 */
export interface SchemaField {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: unknown[];
  pattern?: RegExp;
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
  custom?: (value: unknown) => boolean;
  customMessage?: string;
}

export type Schema = Record<string, SchemaField>;

/**
 * スキーマに対してリクエストデータをバリデート
 */
export function validateSchema<T>(data: unknown, schema: Schema): T {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("リクエストデータが不正です");
  }

  const dataObj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = dataObj[fieldName];

    // 必須チェック
    if (fieldSchema.required && (value === undefined || value === null)) {
      throw ValidationError.required(fieldName);
    }

    // オプショナルな未定義値をスキップ
    if (value === undefined || value === null) {
      continue;
    }

    // バリデートして結果に追加
    result[fieldName] = validateField(fieldName, value, fieldSchema);
  }

  return result as T;
}

/**
 * 個別フィールドをバリデート
 */
function validateField(
  fieldName: string,
  value: unknown,
  schema: SchemaField,
): unknown {
  // 型バリデーション
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (actualType !== schema.type) {
    throw ValidationError.invalidType(fieldName, schema.type);
  }

  // 文字列バリデーション
  if (schema.type === "string" && typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw ValidationError.outOfRange(
        fieldName,
        schema.minLength,
        schema.maxLength,
      );
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw ValidationError.outOfRange(
        fieldName,
        schema.minLength,
        schema.maxLength,
      );
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      throw new ValidationError(`${fieldName}の形式が不正です`, {
        field: fieldName,
        constraint: `pattern:${schema.pattern.source}`,
      });
    }
  }

  // 数値バリデーション
  if (schema.type === "number" && typeof value === "number") {
    if (schema.min !== undefined && value < schema.min) {
      throw ValidationError.outOfRange(fieldName, schema.min, schema.max);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw ValidationError.outOfRange(fieldName, schema.min, schema.max);
    }
  }

  // Enum バリデーション
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ValidationError(
      `${fieldName}の値が不正です。有効な値: ${schema.enum.join(", ")}`,
      {
        field: fieldName,
        constraint: `enum:${schema.enum.join(",")}`,
      },
    );
  }

  // 配列バリデーション
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.items) {
      return value.map((item, index) =>
        validateField(`${fieldName}[${index}]`, item, schema.items!),
      );
    }
  }

  // オブジェクトバリデーション
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    if (schema.properties) {
      const objResult: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propValue = (value as Record<string, unknown>)[propName];
        if (propSchema.required && (propValue === undefined || propValue === null)) {
          throw ValidationError.required(`${fieldName}.${propName}`);
        }
        if (propValue !== undefined && propValue !== null) {
          objResult[propName] = validateField(
            `${fieldName}.${propName}`,
            propValue,
            propSchema,
          );
        }
      }
      return objResult;
    }
  }

  // カスタムバリデーション
  if (schema.custom && !schema.custom(value)) {
    throw new ValidationError(
      schema.customMessage ?? `${fieldName}のバリデーションに失敗しました`,
      { field: fieldName, constraint: "custom" },
    );
  }

  return value;
}

/**
 * Callable リクエストからバリデート済みデータを取得
 */
export function getValidatedData<T>(
  request: CallableRequest,
  schema: Schema,
): T {
  return validateSchema<T>(request.data, schema);
}

/**
 * 再利用のための共通スキーマ
 */
export const CommonSchemas = {
  // ページネーション
  pagination: {
    limit: {
      type: "number" as const,
      min: 1,
      max: 100,
    },
    pageToken: {
      type: "string" as const,
      maxLength: 500,
    },
  },

  // ユーザープロフィール更新
  profileUpdate: {
    nickname: {
      type: "string" as const,
      minLength: 1,
      maxLength: 50,
    },
    birthYear: {
      type: "number" as const,
      min: 1900,
      max: new Date().getFullYear(),
    },
    gender: {
      type: "string" as const,
      enum: ["male", "female", "other", "prefer_not_to_say"],
    },
    height: {
      type: "number" as const,
      min: 50,
      max: 300,
    },
    weight: {
      type: "number" as const,
      min: 10,
      max: 500,
    },
    fitnessLevel: {
      type: "string" as const,
      enum: ["beginner", "intermediate", "advanced"],
    },
  },

  // デバイス情報
  deviceInfo: {
    platform: {
      type: "string" as const,
      required: true,
      enum: ["ios", "android"],
    },
    model: {
      type: "string" as const,
      required: true,
      maxLength: 100,
    },
    osVersion: {
      type: "string" as const,
      required: true,
      maxLength: 50,
    },
    screenWidth: {
      type: "number" as const,
      required: true,
      min: 1,
    },
    screenHeight: {
      type: "number" as const,
      required: true,
      min: 1,
    },
  },

  // エクササイズタイプ
  exerciseType: {
    type: "string" as const,
    required: true,
    enum: ["squat", "armcurl", "sideraise", "shoulderpress", "pushup"],
  },

  // 統計期間
  statisticsPeriod: {
    type: "string" as const,
    required: true,
    enum: ["week", "month", "year", "all"],
  },
};

/**
 * リクエストに必須フィールドがあるかバリデート
 */
export function requireFields(
  data: Record<string, unknown>,
  fields: string[],
): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      throw ValidationError.required(field);
    }
  }
}

/**
 * 文字列入力をサニタイズ
 */
export function sanitizeString(value: string): string {
  return value.trim();
}

/**
 * メールアドレスをサニタイズしてバリデート
 */
export function sanitizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("有効なメールアドレスを入力してください", {
      field: "email",
      constraint: "email",
    });
  }
  return email;
}
