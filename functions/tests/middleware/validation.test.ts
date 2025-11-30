/**
 * Validation Middleware Tests
 *
 * Unit tests for request validation and sanitization
 * Covers schema validation, field validation, and common schemas
 *
 * Reference: docs/specs/03_API設計書_Firebase_Functions_v3_3.md
 */

// Mock utils/errors - keep ValidationError functional for testing
jest.mock("../../src/utils/errors", () => {
  class ValidationError extends Error {
    details?: { field?: string; constraint?: string };

    constructor(message: string, details?: { field?: string; constraint?: string }) {
      super(message);
      this.name = "ValidationError";
      this.details = details;
    }

    static field(field: string, message: string, constraint?: string): ValidationError {
      return new ValidationError(message, { field, constraint });
    }

    static required(field: string): ValidationError {
      return new ValidationError(`${field}は必須です`, {
        field,
        constraint: "required",
      });
    }

    static invalidType(field: string, expectedType: string): ValidationError {
      return new ValidationError(
        `${field}の型が不正です。${expectedType}が必要です`,
        { field, constraint: `type:${expectedType}` }
      );
    }

    static outOfRange(field: string, min?: number, max?: number): ValidationError {
      let message = `${field}の値が範囲外です`;
      if (min !== undefined && max !== undefined) {
        message = `${field}は${min}から${max}の範囲で入力してください`;
      } else if (min !== undefined) {
        message = `${field}は${min}以上で入力してください`;
      } else if (max !== undefined) {
        message = `${field}は${max}以下で入力してください`;
      }
      return new ValidationError(message, {
        field,
        constraint: `range:${min ?? ""}-${max ?? ""}`,
      });
    }
  }

  return { ValidationError };
});

// Import after mocks
import {
  validateSchema,
  getValidatedData,
  CommonSchemas,
  requireFields,
  sanitizeString,
  sanitizeEmail,
  Schema,
  SchemaField,
} from "../../src/middleware/validation";
import { ValidationError } from "../../src/utils/errors";

describe("Validation Middleware", () => {
  describe("validateSchema", () => {
    describe("basic validation", () => {
      it("should validate data against schema", () => {
        const schema: Schema = {
          name: { type: "string", required: true },
          age: { type: "number", required: true },
        };

        const data = { name: "Test User", age: 25 };
        const result = validateSchema<{ name: string; age: number }>(data, schema);

        expect(result.name).toBe("Test User");
        expect(result.age).toBe(25);
      });

      it("should throw for non-object data", () => {
        const schema: Schema = { name: { type: "string" } };

        expect(() => validateSchema("not an object", schema)).toThrow(
          "リクエストデータが不正です"
        );
      });

      it("should throw for null data", () => {
        const schema: Schema = { name: { type: "string" } };

        expect(() => validateSchema(null, schema)).toThrow(
          "リクエストデータが不正です"
        );
      });

      it("should skip undefined optional fields", () => {
        const schema: Schema = {
          name: { type: "string", required: true },
          nickname: { type: "string", required: false },
        };

        const data = { name: "Test" };
        const result = validateSchema<{ name: string; nickname?: string }>(
          data,
          schema
        );

        expect(result.name).toBe("Test");
        expect(result.nickname).toBeUndefined();
      });

      it("should skip null optional fields", () => {
        const schema: Schema = {
          name: { type: "string", required: true },
          nickname: { type: "string", required: false },
        };

        const data = { name: "Test", nickname: null };
        const result = validateSchema<{ name: string; nickname?: string }>(
          data,
          schema
        );

        expect(result.name).toBe("Test");
        expect(result.nickname).toBeUndefined();
      });
    });

    describe("required fields", () => {
      it("should throw for missing required field", () => {
        const schema: Schema = {
          name: { type: "string", required: true },
        };

        expect(() => validateSchema({}, schema)).toThrow("nameは必須です");
      });

      it("should throw for null required field", () => {
        const schema: Schema = {
          name: { type: "string", required: true },
        };

        expect(() => validateSchema({ name: null }, schema)).toThrow(
          "nameは必須です"
        );
      });
    });

    describe("type validation", () => {
      it("should validate string type", () => {
        const schema: Schema = { name: { type: "string", required: true } };
        const result = validateSchema<{ name: string }>({ name: "test" }, schema);
        expect(result.name).toBe("test");
      });

      it("should throw for wrong string type", () => {
        const schema: Schema = { name: { type: "string", required: true } };
        expect(() => validateSchema({ name: 123 }, schema)).toThrow(
          "nameの型が不正です。stringが必要です"
        );
      });

      it("should validate number type", () => {
        const schema: Schema = { age: { type: "number", required: true } };
        const result = validateSchema<{ age: number }>({ age: 25 }, schema);
        expect(result.age).toBe(25);
      });

      it("should throw for wrong number type", () => {
        const schema: Schema = { age: { type: "number", required: true } };
        expect(() => validateSchema({ age: "25" }, schema)).toThrow(
          "ageの型が不正です。numberが必要です"
        );
      });

      it("should validate boolean type", () => {
        const schema: Schema = { active: { type: "boolean", required: true } };
        const result = validateSchema<{ active: boolean }>(
          { active: true },
          schema
        );
        expect(result.active).toBe(true);
      });

      it("should throw for wrong boolean type", () => {
        const schema: Schema = { active: { type: "boolean", required: true } };
        expect(() => validateSchema({ active: "true" }, schema)).toThrow(
          "activeの型が不正です。booleanが必要です"
        );
      });

      it("should validate array type", () => {
        const schema: Schema = { items: { type: "array", required: true } };
        const result = validateSchema<{ items: string[] }>(
          { items: ["a", "b"] },
          schema
        );
        expect(result.items).toEqual(["a", "b"]);
      });

      it("should throw for wrong array type", () => {
        const schema: Schema = { items: { type: "array", required: true } };
        expect(() => validateSchema({ items: "not array" }, schema)).toThrow(
          "itemsの型が不正です。arrayが必要です"
        );
      });

      it("should validate object type", () => {
        const schema: Schema = { data: { type: "object", required: true } };
        const result = validateSchema<{ data: object }>(
          { data: { key: "value" } },
          schema
        );
        expect(result.data).toEqual({ key: "value" });
      });

      it("should throw for wrong object type", () => {
        const schema: Schema = { data: { type: "object", required: true } };
        expect(() => validateSchema({ data: "not object" }, schema)).toThrow(
          "dataの型が不正です。objectが必要です"
        );
      });
    });

    describe("string validation", () => {
      it("should validate minLength", () => {
        const schema: Schema = {
          name: { type: "string", required: true, minLength: 3 },
        };

        expect(() => validateSchema({ name: "ab" }, schema)).toThrow();

        const result = validateSchema<{ name: string }>({ name: "abc" }, schema);
        expect(result.name).toBe("abc");
      });

      it("should validate maxLength", () => {
        const schema: Schema = {
          name: { type: "string", required: true, maxLength: 5 },
        };

        expect(() => validateSchema({ name: "abcdef" }, schema)).toThrow();

        const result = validateSchema<{ name: string }>({ name: "abcde" }, schema);
        expect(result.name).toBe("abcde");
      });

      it("should validate pattern", () => {
        const schema: Schema = {
          code: { type: "string", required: true, pattern: /^[A-Z]{3}$/ },
        };

        expect(() => validateSchema({ code: "abc" }, schema)).toThrow(
          "codeの形式が不正です"
        );

        const result = validateSchema<{ code: string }>({ code: "ABC" }, schema);
        expect(result.code).toBe("ABC");
      });
    });

    describe("number validation", () => {
      it("should validate min", () => {
        const schema: Schema = {
          age: { type: "number", required: true, min: 18 },
        };

        expect(() => validateSchema({ age: 17 }, schema)).toThrow();

        const result = validateSchema<{ age: number }>({ age: 18 }, schema);
        expect(result.age).toBe(18);
      });

      it("should validate max", () => {
        const schema: Schema = {
          age: { type: "number", required: true, max: 100 },
        };

        expect(() => validateSchema({ age: 101 }, schema)).toThrow();

        const result = validateSchema<{ age: number }>({ age: 100 }, schema);
        expect(result.age).toBe(100);
      });

      it("should validate min and max together", () => {
        const schema: Schema = {
          score: { type: "number", required: true, min: 0, max: 100 },
        };

        expect(() => validateSchema({ score: -1 }, schema)).toThrow(
          "scoreは0から100の範囲で入力してください"
        );
        expect(() => validateSchema({ score: 101 }, schema)).toThrow(
          "scoreは0から100の範囲で入力してください"
        );

        const result = validateSchema<{ score: number }>({ score: 50 }, schema);
        expect(result.score).toBe(50);
      });
    });

    describe("enum validation", () => {
      it("should validate enum values", () => {
        const schema: Schema = {
          status: {
            type: "string",
            required: true,
            enum: ["active", "inactive", "pending"],
          },
        };

        expect(() => validateSchema({ status: "unknown" }, schema)).toThrow(
          "statusの値が不正です。有効な値: active, inactive, pending"
        );

        const result = validateSchema<{ status: string }>(
          { status: "active" },
          schema
        );
        expect(result.status).toBe("active");
      });

      it("should validate number enum", () => {
        const schema: Schema = {
          level: { type: "number", required: true, enum: [1, 2, 3] },
        };

        expect(() => validateSchema({ level: 4 }, schema)).toThrow(
          "levelの値が不正です"
        );

        const result = validateSchema<{ level: number }>({ level: 2 }, schema);
        expect(result.level).toBe(2);
      });
    });

    describe("array validation", () => {
      it("should validate array items", () => {
        const schema: Schema = {
          tags: {
            type: "array",
            required: true,
            items: { type: "string" },
          },
        };

        const result = validateSchema<{ tags: string[] }>(
          { tags: ["a", "b", "c"] },
          schema
        );
        expect(result.tags).toEqual(["a", "b", "c"]);
      });

      it("should throw for invalid array item type", () => {
        const schema: Schema = {
          tags: {
            type: "array",
            required: true,
            items: { type: "string" },
          },
        };

        expect(() => validateSchema({ tags: ["a", 123, "c"] }, schema)).toThrow(
          "tags[1]の型が不正です。stringが必要です"
        );
      });

      it("should validate nested array items", () => {
        const schema: Schema = {
          scores: {
            type: "array",
            required: true,
            items: { type: "number", min: 0, max: 100 },
          },
        };

        const result = validateSchema<{ scores: number[] }>(
          { scores: [85, 90, 75] },
          schema
        );
        expect(result.scores).toEqual([85, 90, 75]);
      });
    });

    describe("object validation", () => {
      it("should validate nested object properties", () => {
        const schema: Schema = {
          address: {
            type: "object",
            required: true,
            properties: {
              city: { type: "string", required: true },
              zip: { type: "string", required: true },
            },
          },
        };

        const result = validateSchema<{
          address: { city: string; zip: string };
        }>({ address: { city: "Tokyo", zip: "100-0001" } }, schema);

        expect(result.address.city).toBe("Tokyo");
        expect(result.address.zip).toBe("100-0001");
      });

      it("should throw for missing required nested field", () => {
        const schema: Schema = {
          address: {
            type: "object",
            required: true,
            properties: {
              city: { type: "string", required: true },
              zip: { type: "string", required: true },
            },
          },
        };

        expect(() =>
          validateSchema({ address: { city: "Tokyo" } }, schema)
        ).toThrow("address.zipは必須です");
      });

      it("should skip undefined optional nested fields", () => {
        const schema: Schema = {
          address: {
            type: "object",
            required: true,
            properties: {
              city: { type: "string", required: true },
              country: { type: "string", required: false },
            },
          },
        };

        const result = validateSchema<{
          address: { city: string; country?: string };
        }>({ address: { city: "Tokyo" } }, schema);

        expect(result.address.city).toBe("Tokyo");
        expect(result.address.country).toBeUndefined();
      });

      it("should validate nested object field types", () => {
        const schema: Schema = {
          profile: {
            type: "object",
            required: true,
            properties: {
              age: { type: "number", required: true },
            },
          },
        };

        expect(() =>
          validateSchema({ profile: { age: "25" } }, schema)
        ).toThrow("profile.ageの型が不正です");
      });
    });

    describe("custom validation", () => {
      it("should run custom validator", () => {
        const schema: Schema = {
          password: {
            type: "string",
            required: true,
            custom: (value: unknown) => {
              const str = value as string;
              return str.length >= 8 && /[A-Z]/.test(str) && /[0-9]/.test(str);
            },
            customMessage: "パスワードは8文字以上で大文字と数字を含む必要があります",
          },
        };

        expect(() => validateSchema({ password: "weak" }, schema)).toThrow(
          "パスワードは8文字以上で大文字と数字を含む必要があります"
        );

        const result = validateSchema<{ password: string }>(
          { password: "Strong1Password" },
          schema
        );
        expect(result.password).toBe("Strong1Password");
      });

      it("should use default custom message", () => {
        const schema: Schema = {
          value: {
            type: "number",
            required: true,
            custom: (value: unknown) => (value as number) % 2 === 0,
          },
        };

        expect(() => validateSchema({ value: 3 }, schema)).toThrow(
          "valueのバリデーションに失敗しました"
        );
      });
    });
  });

  describe("getValidatedData", () => {
    it("should validate request data", () => {
      const schema: Schema = {
        userId: { type: "string", required: true },
      };

      const request = {
        data: { userId: "user-123" },
      } as any;

      const result = getValidatedData<{ userId: string }>(request, schema);
      expect(result.userId).toBe("user-123");
    });

    it("should throw for invalid request data", () => {
      const schema: Schema = {
        userId: { type: "string", required: true },
      };

      const request = {
        data: {},
      } as any;

      expect(() => getValidatedData(request, schema)).toThrow("userIdは必須です");
    });
  });

  describe("CommonSchemas", () => {
    describe("pagination", () => {
      it("should have correct pagination schema", () => {
        expect(CommonSchemas.pagination.limit.type).toBe("number");
        expect(CommonSchemas.pagination.limit.min).toBe(1);
        expect(CommonSchemas.pagination.limit.max).toBe(100);
        expect(CommonSchemas.pagination.pageToken.type).toBe("string");
      });

      it("should validate pagination data", () => {
        const schema = CommonSchemas.pagination;
        const result = validateSchema<{ limit: number; pageToken: string }>(
          { limit: 10, pageToken: "abc" },
          schema
        );
        expect(result.limit).toBe(10);
      });
    });

    describe("profileUpdate", () => {
      it("should have correct profile schema", () => {
        expect(CommonSchemas.profileUpdate.nickname.type).toBe("string");
        expect(CommonSchemas.profileUpdate.birthYear.type).toBe("number");
        expect(CommonSchemas.profileUpdate.gender.enum).toContain("male");
        expect(CommonSchemas.profileUpdate.height.min).toBe(50);
        expect(CommonSchemas.profileUpdate.weight.min).toBe(10);
        expect(CommonSchemas.profileUpdate.fitnessLevel.enum).toContain(
          "beginner"
        );
      });
    });

    describe("deviceInfo", () => {
      it("should have correct device info schema", () => {
        expect(CommonSchemas.deviceInfo.platform.required).toBe(true);
        expect(CommonSchemas.deviceInfo.platform.enum).toContain("ios");
        expect(CommonSchemas.deviceInfo.platform.enum).toContain("android");
        expect(CommonSchemas.deviceInfo.model.required).toBe(true);
        expect(CommonSchemas.deviceInfo.screenWidth.min).toBe(1);
      });
    });

    describe("exerciseType", () => {
      it("should have correct exercise type schema", () => {
        expect(CommonSchemas.exerciseType.type).toBe("string");
        expect(CommonSchemas.exerciseType.required).toBe(true);
        expect(CommonSchemas.exerciseType.enum).toContain("squat");
        expect(CommonSchemas.exerciseType.enum).toContain("armcurl");
        expect(CommonSchemas.exerciseType.enum).toContain("sideraise");
        expect(CommonSchemas.exerciseType.enum).toContain("shoulderpress");
        expect(CommonSchemas.exerciseType.enum).toContain("pushup");
      });
    });

    describe("statisticsPeriod", () => {
      it("should have correct statistics period schema", () => {
        expect(CommonSchemas.statisticsPeriod.type).toBe("string");
        expect(CommonSchemas.statisticsPeriod.required).toBe(true);
        expect(CommonSchemas.statisticsPeriod.enum).toContain("week");
        expect(CommonSchemas.statisticsPeriod.enum).toContain("month");
        expect(CommonSchemas.statisticsPeriod.enum).toContain("year");
        expect(CommonSchemas.statisticsPeriod.enum).toContain("all");
      });
    });
  });

  describe("requireFields", () => {
    it("should pass when all required fields are present", () => {
      const data = { name: "test", age: 25 };
      expect(() => requireFields(data, ["name", "age"])).not.toThrow();
    });

    it("should throw for missing field", () => {
      const data = { name: "test" };
      expect(() => requireFields(data, ["name", "age"])).toThrow("ageは必須です");
    });

    it("should throw for null field", () => {
      const data = { name: "test", age: null };
      expect(() => requireFields(data, ["name", "age"])).toThrow("ageは必須です");
    });

    it("should throw for undefined field", () => {
      const data = { name: "test", age: undefined };
      expect(() => requireFields(data, ["name", "age"])).toThrow("ageは必須です");
    });

    it("should pass for empty required fields array", () => {
      const data = {};
      expect(() => requireFields(data, [])).not.toThrow();
    });

    it("should accept zero as valid value", () => {
      const data = { count: 0 };
      expect(() => requireFields(data, ["count"])).not.toThrow();
    });

    it("should accept empty string as valid value", () => {
      const data = { name: "" };
      expect(() => requireFields(data, ["name"])).not.toThrow();
    });

    it("should accept false as valid value", () => {
      const data = { active: false };
      expect(() => requireFields(data, ["active"])).not.toThrow();
    });
  });

  describe("sanitizeString", () => {
    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("should trim leading whitespace", () => {
      expect(sanitizeString("  hello")).toBe("hello");
    });

    it("should trim trailing whitespace", () => {
      expect(sanitizeString("hello  ")).toBe("hello");
    });

    it("should handle string with only whitespace", () => {
      expect(sanitizeString("   ")).toBe("");
    });

    it("should handle empty string", () => {
      expect(sanitizeString("")).toBe("");
    });

    it("should preserve internal whitespace", () => {
      expect(sanitizeString("  hello world  ")).toBe("hello world");
    });

    it("should handle tabs and newlines", () => {
      expect(sanitizeString("\thello\n")).toBe("hello");
    });
  });

  describe("sanitizeEmail", () => {
    it("should normalize email to lowercase", () => {
      expect(sanitizeEmail("Test@Example.COM")).toBe("test@example.com");
    });

    it("should trim whitespace", () => {
      expect(sanitizeEmail("  test@example.com  ")).toBe("test@example.com");
    });

    it("should validate valid email", () => {
      expect(sanitizeEmail("user@domain.com")).toBe("user@domain.com");
    });

    it("should validate email with subdomain", () => {
      expect(sanitizeEmail("user@sub.domain.com")).toBe("user@sub.domain.com");
    });

    it("should validate email with plus sign", () => {
      expect(sanitizeEmail("user+tag@domain.com")).toBe("user+tag@domain.com");
    });

    it("should throw for invalid email - missing @", () => {
      expect(() => sanitizeEmail("invalid-email")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });

    it("should throw for invalid email - missing domain", () => {
      expect(() => sanitizeEmail("user@")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });

    it("should throw for invalid email - missing local part", () => {
      expect(() => sanitizeEmail("@domain.com")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });

    it("should throw for invalid email - missing TLD", () => {
      expect(() => sanitizeEmail("user@domain")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });

    it("should throw for email with spaces", () => {
      expect(() => sanitizeEmail("user @domain.com")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });

    it("should throw for empty string", () => {
      expect(() => sanitizeEmail("")).toThrow(
        "有効なメールアドレスを入力してください"
      );
    });
  });

  describe("ValidationError static methods", () => {
    it("should create field error", () => {
      const error = ValidationError.field("name", "Invalid name", "format");
      expect(error.message).toBe("Invalid name");
      expect(error.details?.field).toBe("name");
    });

    it("should create required error", () => {
      const error = ValidationError.required("email");
      expect(error.message).toBe("emailは必須です");
      expect(error.details?.field).toBe("email");
      expect(error.details?.constraint).toBe("required");
    });

    it("should create invalid type error", () => {
      const error = ValidationError.invalidType("age", "number");
      expect(error.message).toBe("ageの型が不正です。numberが必要です");
    });

    it("should create out of range error with both bounds", () => {
      const error = ValidationError.outOfRange("score", 0, 100);
      expect(error.message).toBe("scoreは0から100の範囲で入力してください");
    });

    it("should create out of range error with min only", () => {
      const error = ValidationError.outOfRange("age", 18, undefined);
      expect(error.message).toBe("ageは18以上で入力してください");
    });

    it("should create out of range error with max only", () => {
      const error = ValidationError.outOfRange("count", undefined, 10);
      expect(error.message).toBe("countは10以下で入力してください");
    });

    it("should create out of range error without bounds", () => {
      const error = ValidationError.outOfRange("value");
      expect(error.message).toBe("valueの値が範囲外です");
    });
  });
});
