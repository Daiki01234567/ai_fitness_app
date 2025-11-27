/**
 * Error Utilities Tests
 */

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
} from "../../src/utils/errors";
import { HttpsError } from "firebase-functions/v2/https";

describe("Error Utilities", () => {
  describe("AppError", () => {
    it("should create an error with code and message", () => {
      const error = new AppError("internal", "Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.code).toBe("internal");
      expect(error.httpStatus).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it("should convert to HttpsError", () => {
      const error = new AppError("invalid-argument", "Invalid input", {
        details: { field: "email" },
      });

      const httpsError = error.toHttpsError();

      expect(httpsError).toBeInstanceOf(HttpsError);
      expect(httpsError.code).toBe("invalid-argument");
      expect(httpsError.message).toBe("Invalid input");
    });
  });

  describe("ValidationError", () => {
    it("should create a validation error", () => {
      const error = new ValidationError("Invalid input");

      expect(error.code).toBe("invalid-argument");
      expect(error.httpStatus).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it("should create field-specific validation error", () => {
      const error = ValidationError.field("email", "Invalid email format", "email");

      expect(error.message).toBe("Invalid email format");
      expect(error.details?.field).toBe("email");
      expect(error.details?.constraint).toBe("email");
    });

    it("should create required field error", () => {
      const error = ValidationError.required("nickname");

      expect(error.message).toBe("nicknameは必須です");
      expect(error.details?.field).toBe("nickname");
    });

    it("should create out of range error", () => {
      const error = ValidationError.outOfRange("age", 18, 100);

      expect(error.message).toContain("18");
      expect(error.message).toContain("100");
    });
  });

  describe("AuthenticationError", () => {
    it("should create an authentication error", () => {
      const error = new AuthenticationError();

      expect(error.code).toBe("unauthenticated");
      expect(error.httpStatus).toBe(401);
      expect(error.message).toBe("認証が必要です");
    });

    it("should create token expired error", () => {
      const error = AuthenticationError.tokenExpired();

      expect(error.message).toContain("有効期限");
    });

    it("should create session revoked error", () => {
      const error = AuthenticationError.sessionRevoked();

      expect(error.message).toContain("無効化");
    });
  });

  describe("AuthorizationError", () => {
    it("should create an authorization error", () => {
      const error = new AuthorizationError();

      expect(error.code).toBe("permission-denied");
      expect(error.httpStatus).toBe(403);
    });

    it("should create deletion scheduled error", () => {
      const error = AuthorizationError.deletionScheduled();

      expect(error.message).toContain("削除");
    });

    it("should create consent required error", () => {
      const error = AuthorizationError.consentRequired();

      expect(error.message).toContain("同意");
    });

    it("should create subscription required error", () => {
      const error = AuthorizationError.subscriptionRequired();

      expect(error.message).toContain("プレミアム");
    });
  });

  describe("NotFoundError", () => {
    it("should create a not found error", () => {
      const error = new NotFoundError("User");

      expect(error.code).toBe("not-found");
      expect(error.httpStatus).toBe(404);
      expect(error.message).toContain("User");
    });

    it("should create not found error with ID", () => {
      const error = new NotFoundError("Session", "session-123");

      expect(error.message).toContain("Session");
      expect(error.message).toContain("session-123");
    });

    it("should create user not found error", () => {
      const error = NotFoundError.user("user-123");

      expect(error.message).toContain("ユーザー");
    });

    it("should create session not found error", () => {
      const error = NotFoundError.session("session-123");

      expect(error.message).toContain("セッション");
    });
  });

  describe("RateLimitError", () => {
    it("should create a rate limit error", () => {
      const error = new RateLimitError();

      expect(error.code).toBe("resource-exhausted");
      expect(error.httpStatus).toBe(429);
      expect(error.retryable).toBe(true);
    });
  });

  describe("ExternalServiceError", () => {
    it("should create an external service error", () => {
      const error = new ExternalServiceError("BigQuery", "Connection failed");

      expect(error.code).toBe("unavailable");
      expect(error.httpStatus).toBe(503);
      expect(error.serviceName).toBe("BigQuery");
      expect(error.retryable).toBe(true);
    });

    it("should create BigQuery error", () => {
      const cause = new Error("Original error");
      const error = ExternalServiceError.bigQuery("Insert failed", cause);

      expect(error.serviceName).toBe("BigQuery");
      expect(error.cause).toBe(cause);
    });

    it("should create RevenueCat error", () => {
      const error = ExternalServiceError.revenueCat("Purchase failed");

      expect(error.serviceName).toBe("RevenueCat");
    });
  });
});
