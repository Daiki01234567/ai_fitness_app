/**
 * Comprehensive Error Tests
 * Tests for handleError and withErrorHandling functions
 */

import {
  AppError,
  ValidationError,
  handleError,
  withErrorHandling,
} from "../../src/utils/errors";
import { HttpsError } from "firebase-functions/v2/https";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("Error Utilities - Comprehensive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ValidationError edge cases", () => {
    it("should handle outOfRange with only min", () => {
      const error = ValidationError.outOfRange("age", 18);
      expect(error.message).toContain("18以上");
    });

    it("should handle outOfRange with only max", () => {
      const error = ValidationError.outOfRange("age", undefined, 100);
      expect(error.message).toContain("100以下");
    });

    it("should handle outOfRange with neither min nor max", () => {
      const error = ValidationError.outOfRange("age");
      expect(error.message).toContain("範囲外");
    });

    it("should handle invalidType", () => {
      const error = ValidationError.invalidType("field", "string");
      expect(error.message).toContain("string");
      expect(error.details?.constraint).toBe("type:string");
    });
  });

  describe("handleError function", () => {
    it("should handle AppError", () => {
      const error = new AppError("internal", "Test error");
      
      expect(() => handleError(error, { userId: "user-123" })).toThrow(HttpsError);
    });

    it("should handle HttpsError", () => {
      const error = new HttpsError("internal", "Test");
      
      expect(() => handleError(error)).toThrow(HttpsError);
    });

    it("should handle generic Error", () => {
      const error = new Error("Generic error");
      
      expect(() => handleError(error, { requestId: "req-123" })).toThrow(HttpsError);
    });

    it("should handle unknown error type - string", () => {
      expect(() => handleError("string error")).toThrow(HttpsError);
    });

    it("should handle unknown error type - number", () => {
      expect(() => handleError(123)).toThrow(HttpsError);
    });

    it("should handle unknown error type - null", () => {
      expect(() => handleError(null)).toThrow(HttpsError);
    });
  });

  describe("withErrorHandling wrapper", () => {
    it("should wrap function and handle errors", async () => {
      const fn = async () => {
        throw new Error("Test error");
      };
      
      const wrapped = withErrorHandling(fn, { userId: "user-123" });
      
      await expect(wrapped()).rejects.toThrow();
    });

    it("should return result on success", async () => {
      const fn = async (x: number, y: number) => x + y;
      
      const wrapped = withErrorHandling(fn);
      const result = await wrapped(2, 3);
      
      expect(result).toBe(5);
    });

    it("should pass through multiple arguments", async () => {
      const fn = async (a: string, b: number, c: boolean) => ({ a, b, c });
      
      const wrapped = withErrorHandling(fn);
      const result = await wrapped("test", 42, true);
      
      expect(result).toEqual({ a: "test", b: 42, c: true });
    });
  });
});

  describe("AppError with unknown error code", () => {
    it("should use default httpStatus and retryable for unknown code", () => {
      // Using a valid FunctionsErrorCode but one not in ErrorCodes mapping
      const error = new AppError("data-loss" as any, "Unknown error type");
      
      expect(error.httpStatus).toBe(500);
      expect(error.retryable).toBe(false);
    });
  });
