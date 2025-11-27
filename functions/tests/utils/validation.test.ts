/**
 * Validation Utilities Tests
 */

import {
  validateNickname,
  validateEmail,
  validateBirthYear,
  validateHeight,
  validateWeight,
  validateExerciseType,
  validateLimit,
  isNonEmptyString,
  isPositiveNumber,
  isValidEmail,
  isValidExerciseType,
} from "../../src/utils/validation";
import { ValidationError } from "../../src/utils/errors";

describe("Validation Utilities", () => {
  describe("isNonEmptyString", () => {
    it("should return true for non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("a")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
    });

    it("should return false for non-strings", () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe("isPositiveNumber", () => {
    it("should return true for positive numbers", () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(100)).toBe(true);
    });

    it("should return false for zero and negative numbers", () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-0.1)).toBe(false);
    });

    it("should return false for NaN and non-numbers", () => {
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber("1")).toBe(false);
      expect(isPositiveNumber(null)).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    it("should return true for valid emails", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co.jp")).toBe(true);
    });

    it("should return false for invalid emails", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("isValidExerciseType", () => {
    it("should return true for valid exercise types", () => {
      expect(isValidExerciseType("squat")).toBe(true);
      expect(isValidExerciseType("armcurl")).toBe(true);
      expect(isValidExerciseType("sideraise")).toBe(true);
      expect(isValidExerciseType("shoulderpress")).toBe(true);
      expect(isValidExerciseType("pushup")).toBe(true);
    });

    it("should return false for invalid exercise types", () => {
      expect(isValidExerciseType("running")).toBe(false);
      expect(isValidExerciseType("")).toBe(false);
      expect(isValidExerciseType(null)).toBe(false);
    });
  });

  describe("validateNickname", () => {
    it("should accept valid nicknames", () => {
      expect(validateNickname("TestUser")).toBe("TestUser");
      expect(validateNickname("  Trimmed  ")).toBe("Trimmed");
    });

    it("should reject empty nicknames", () => {
      expect(() => validateNickname("")).toThrow(ValidationError);
      expect(() => validateNickname("   ")).toThrow(ValidationError);
    });

    it("should reject nicknames that are too long", () => {
      const longName = "a".repeat(51);
      expect(() => validateNickname(longName)).toThrow(ValidationError);
    });

    it("should reject non-string nicknames", () => {
      expect(() => validateNickname(null)).toThrow(ValidationError);
      expect(() => validateNickname(123)).toThrow(ValidationError);
    });
  });

  describe("validateEmail", () => {
    it("should accept valid emails and normalize", () => {
      expect(validateEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
      expect(validateEmail("  user@domain.com  ")).toBe("user@domain.com");
    });

    it("should reject invalid emails", () => {
      expect(() => validateEmail("invalid")).toThrow(ValidationError);
      expect(() => validateEmail("")).toThrow(ValidationError);
    });
  });

  describe("validateBirthYear", () => {
    it("should accept valid birth years", () => {
      expect(validateBirthYear(1990)).toBe(1990);
      expect(validateBirthYear(2000)).toBe(2000);
    });

    it("should return undefined for null/undefined", () => {
      expect(validateBirthYear(null)).toBeUndefined();
      expect(validateBirthYear(undefined)).toBeUndefined();
    });

    it("should reject invalid birth years", () => {
      expect(() => validateBirthYear(1800)).toThrow(ValidationError);
      expect(() => validateBirthYear(3000)).toThrow(ValidationError);
      expect(() => validateBirthYear("1990")).toThrow(ValidationError);
    });
  });

  describe("validateHeight", () => {
    it("should accept valid heights", () => {
      expect(validateHeight(170)).toBe(170);
      expect(validateHeight(150.5)).toBe(150.5);
    });

    it("should return undefined for null/undefined", () => {
      expect(validateHeight(null)).toBeUndefined();
      expect(validateHeight(undefined)).toBeUndefined();
    });

    it("should reject invalid heights", () => {
      expect(() => validateHeight(0)).toThrow(ValidationError);
      expect(() => validateHeight(-170)).toThrow(ValidationError);
      expect(() => validateHeight(400)).toThrow(ValidationError);
    });
  });

  describe("validateWeight", () => {
    it("should accept valid weights", () => {
      expect(validateWeight(70)).toBe(70);
      expect(validateWeight(65.5)).toBe(65.5);
    });

    it("should return undefined for null/undefined", () => {
      expect(validateWeight(null)).toBeUndefined();
      expect(validateWeight(undefined)).toBeUndefined();
    });

    it("should reject invalid weights", () => {
      expect(() => validateWeight(0)).toThrow(ValidationError);
      expect(() => validateWeight(5)).toThrow(ValidationError);
      expect(() => validateWeight(600)).toThrow(ValidationError);
    });
  });

  describe("validateExerciseType", () => {
    it("should accept valid exercise types", () => {
      expect(validateExerciseType("squat")).toBe("squat");
      expect(validateExerciseType("pushup")).toBe("pushup");
    });

    it("should reject invalid exercise types", () => {
      expect(() => validateExerciseType("")).toThrow(ValidationError);
      expect(() => validateExerciseType("running")).toThrow(ValidationError);
      expect(() => validateExerciseType(null)).toThrow(ValidationError);
    });
  });

  describe("validateLimit", () => {
    it("should return default value for null/undefined", () => {
      expect(validateLimit(undefined)).toBe(20);
      expect(validateLimit(null)).toBe(20);
    });

    it("should accept valid limits", () => {
      expect(validateLimit(10)).toBe(10);
      expect(validateLimit(50)).toBe(50);
    });

    it("should cap at max value", () => {
      expect(validateLimit(200)).toBe(100);
      expect(validateLimit(150, 20, 50)).toBe(50);
    });

    it("should reject invalid limits", () => {
      expect(() => validateLimit(0)).toThrow(ValidationError);
      expect(() => validateLimit(-1)).toThrow(ValidationError);
      expect(() => validateLimit("10")).toThrow(ValidationError);
    });
  });
});
