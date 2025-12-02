/**
 * メールアドレス存在チェック API テスト
 *
 * @version 1.0.0
 * @date 2025-12-02
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock firebase-admin before importing the function
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
}));

// Mock firebase-admin/auth
const mockGetUserByEmail = jest.fn<() => Promise<{ uid: string; email: string }>>();
jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({
    getUserByEmail: mockGetUserByEmail,
  })),
}));

// Mock rate limiter
const mockCheckLimit = jest.fn<() => Promise<boolean>>();
jest.mock("../../../src/middleware/rateLimiter.js", () => ({
  rateLimiter: {
    checkLimit: mockCheckLimit,
  },
  RateLimits: {
    AUTH_SIGNUP: { maxRequests: 10, windowSeconds: 3600 },
  },
}));

// Mock logger
jest.mock("../../../src/utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock firestore utils
jest.mock("../../../src/utils/firestore.js", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(),
    })),
  })),
  serverTimestamp: jest.fn(),
}));

describe("auth_checkEmailExists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit passes
    mockCheckLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("input validation", () => {
    it("should reject missing email", async () => {
      // Import after mocks are set up
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");

      // Create mock request
      const mockRequest = {
        data: {},
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      // The function should throw ValidationError for missing email
      await expect(
        (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest)
      ).rejects.toThrow();
    });

    it("should reject invalid email format", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");

      const mockRequest = {
        data: { email: "invalid-email" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await expect(
        (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest)
      ).rejects.toThrow();
    });

    it("should normalize email to lowercase", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      // Simulate user not found (email available)
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest = {
        data: { email: "TEST@Example.COM" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest);

      expect(mockGetUserByEmail).toHaveBeenCalledWith("test@example.com");
    });
  });

  describe("email existence check", () => {
    it("should return exists: false for new email", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      // Simulate user not found
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest = {
        data: { email: "new@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<{ exists: boolean }> }).run(mockRequest);

      expect(result).toEqual({
        exists: false,
      });
    });

    it("should return exists: true for existing email", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      // Simulate user found
      mockGetUserByEmail.mockResolvedValue({ uid: "test-uid", email: "existing@example.com" });

      const mockRequest = {
        data: { email: "existing@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<{ exists: boolean; message?: string }> }).run(mockRequest);

      expect(result).toEqual({
        exists: true,
        message: "このメールアドレスは既に登録されています",
      });
    });
  });

  describe("rate limiting", () => {
    it("should apply rate limiting based on IP", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.100" },
          socket: { remoteAddress: "192.168.1.100" },
        },
      };

      await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest);

      expect(mockCheckLimit).toHaveBeenCalledWith(
        "EMAIL_CHECK:192.168.1.100",
        { maxRequests: 10, windowSeconds: 60 }
      );
    });

    it("should throw error when rate limit exceeded", async () => {
      const { RateLimitError } = await import("../../../src/utils/errors.js");
      mockCheckLimit.mockRejectedValue(new RateLimitError());

      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");

      const mockRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await expect(
        (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest)
      ).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should return exists: false on unexpected Firebase Auth error", async () => {
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      // Simulate unexpected error (not user-not-found)
      const unexpectedError = new Error("Internal error") as Error & { code: string };
      unexpectedError.code = "auth/internal-error";
      mockGetUserByEmail.mockRejectedValue(unexpectedError);

      const mockRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<{ exists: boolean }> }).run(mockRequest);

      // Should return false to avoid leaking information
      expect(result).toEqual({
        exists: false,
      });
    });
  });

  describe("security", () => {
    it("should mask email in logs", async () => {
      const { logger } = await import("../../../src/utils/logger.js");
      const { auth_checkEmailExists } = await import("../../../src/api/auth/checkEmailExists.js");
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest = {
        data: { email: "testuser@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await (auth_checkEmailExists as unknown as { run: (req: unknown) => Promise<unknown> }).run(mockRequest);

      // Check that logged email is masked
      expect(logger.info).toHaveBeenCalledWith(
        "Checking email existence",
        expect.objectContaining({
          maskedEmail: "te***@example.com",
        })
      );
    });
  });
});
