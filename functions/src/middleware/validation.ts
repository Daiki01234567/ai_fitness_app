/**
 * Validation Middleware
 * Request validation utilities for Cloud Functions
 */

import { CallableRequest } from "firebase-functions/v2/https";

import { ValidationError } from "../utils/errors";

/**
 * Schema definition for validation
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
 * Validate request data against schema
 */
export function validateSchema<T>(data: unknown, schema: Schema): T {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("リクエストデータが不正です");
  }

  const dataObj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = dataObj[fieldName];

    // Check required
    if (fieldSchema.required && (value === undefined || value === null)) {
      throw ValidationError.required(fieldName);
    }

    // Skip optional undefined values
    if (value === undefined || value === null) {
      continue;
    }

    // Validate and add to result
    result[fieldName] = validateField(fieldName, value, fieldSchema);
  }

  return result as T;
}

/**
 * Validate individual field
 */
function validateField(
  fieldName: string,
  value: unknown,
  schema: SchemaField,
): unknown {
  // Type validation
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (actualType !== schema.type) {
    throw ValidationError.invalidType(fieldName, schema.type);
  }

  // String validations
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

  // Number validations
  if (schema.type === "number" && typeof value === "number") {
    if (schema.min !== undefined && value < schema.min) {
      throw ValidationError.outOfRange(fieldName, schema.min, schema.max);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw ValidationError.outOfRange(fieldName, schema.min, schema.max);
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ValidationError(
      `${fieldName}の値が不正です。有効な値: ${schema.enum.join(", ")}`,
      {
        field: fieldName,
        constraint: `enum:${schema.enum.join(",")}`,
      },
    );
  }

  // Array validation
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.items) {
      return value.map((item, index) =>
        validateField(`${fieldName}[${index}]`, item, schema.items!),
      );
    }
  }

  // Object validation
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

  // Custom validation
  if (schema.custom && !schema.custom(value)) {
    throw new ValidationError(
      schema.customMessage ?? `${fieldName}のバリデーションに失敗しました`,
      { field: fieldName, constraint: "custom" },
    );
  }

  return value;
}

/**
 * Get validated data from callable request
 */
export function getValidatedData<T>(
  request: CallableRequest,
  schema: Schema,
): T {
  return validateSchema<T>(request.data, schema);
}

/**
 * Common schemas for reuse
 */
export const CommonSchemas = {
  // Pagination
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

  // User profile update
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

  // Device info
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

  // Exercise type
  exerciseType: {
    type: "string" as const,
    required: true,
    enum: ["squat", "armcurl", "sideraise", "shoulderpress", "pushup"],
  },

  // Statistics period
  statisticsPeriod: {
    type: "string" as const,
    required: true,
    enum: ["week", "month", "year", "all"],
  },
};

/**
 * Validate request has required fields
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
 * Sanitize string input
 */
export function sanitizeString(value: string): string {
  return value.trim();
}

/**
 * Sanitize and validate email
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
