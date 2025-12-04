/**
 * メールアドレス存在チェック API テスト
 *
 * @version 1.3.0
 * @date 2025-12-04
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Create mock functions before jest.mock calls
const mockGetUserByEmail = jest.fn();

// Mock firebase-admin before importing the function
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
}));

// Mock firebase-admin/auth with factory function that captures current mock
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUserByEmail: mockGetUserByEmail,
  }),
}));

// Mock rate limiter
const mockCheckLimit = jest.fn();
jest.mock("../../src/middleware/rateLimiter", () => ({
  rateLimiter: {
    checkLimit: mockCheckLimit,
  },
  RateLimits: {
    AUTH_SIGNUP: { maxRequests: 10, windowSeconds: 3600 },
  },
}));

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock firestore utils
jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(),
    })),
  })),
  serverTimestamp: jest.fn(),
}));

// Static import after mocks are set up
import { auth_checkEmailExists } from "../../src/api/auth/checkEmailExists";
import { RateLimitError } from "../../src/utils/errors";

// Helper function to run the callable function
type CallableRequest = {
  data: Record<string, unknown>;
  rawRequest: {
    headers: Record<string, string>;
    socket: { remoteAddress: string };
  };
};

async function runCallable(request: CallableRequest): Promise<unknown> {
  return (auth_checkEmailExists as unknown as { run: (req: CallableRequest) => Promise<unknown> }).run(request);
}

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
      const mockRequest: CallableRequest = {
        data: {},
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await expect(runCallable(mockRequest)).rejects.toThrow();
    });

    it("should reject invalid email format", async () => {
      const mockRequest: CallableRequest = {
        data: { email: "invalid-email" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await expect(runCallable(mockRequest)).rejects.toThrow();
    });

    it("should normalize email to lowercase", async () => {
      // Simulate user not found (email available)
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest: CallableRequest = {
        data: { email: "TEST@Example.COM" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await runCallable(mockRequest);

      expect(mockGetUserByEmail).toHaveBeenCalledWith("test@example.com");
    });
  });

  describe("email existence check", () => {
    it("should return exists: false for new email", async () => {
      // Simulate user not found
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest: CallableRequest = {
        data: { email: "new@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await runCallable(mockRequest);

      expect(result).toEqual({
        exists: false,
      });
    });

    it("should return exists: true for existing email", async () => {
      // Simulate user found (getUserByEmail returns successfully)
      mockGetUserByEmail.mockResolvedValue({ uid: "test-uid", email: "existing@example.com" });

      const mockRequest: CallableRequest = {
        data: { email: "existing@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await runCallable(mockRequest) as { exists: boolean; message?: string };

      expect(result).toEqual({
        exists: true,
        message: "このメールアドレスは既に登録されています",
      });
    });
  });

  describe("rate limiting", () => {
    it("should apply rate limiting based on IP", async () => {
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest: CallableRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.100" },
          socket: { remoteAddress: "192.168.1.100" },
        },
      };

      await runCallable(mockRequest);

      expect(mockCheckLimit).toHaveBeenCalledWith(
        "EMAIL_CHECK:192.168.1.100",
        { maxRequests: 10, windowSeconds: 60 }
      );
    });

    it("should throw error when rate limit exceeded", async () => {
      mockCheckLimit.mockRejectedValue(new RateLimitError());

      const mockRequest: CallableRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await expect(runCallable(mockRequest)).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should return exists: false on unexpected Firebase Auth error", async () => {
      // Simulate unexpected error (not user-not-found)
      const unexpectedError = new Error("Internal error") as Error & { code: string };
      unexpectedError.code = "auth/internal-error";
      mockGetUserByEmail.mockRejectedValue(unexpectedError);

      const mockRequest: CallableRequest = {
        data: { email: "test@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      const result = await runCallable(mockRequest) as { exists: boolean };

      // Should return false to avoid leaking information
      expect(result).toEqual({
        exists: false,
      });
    });
  });

  describe("security", () => {
    it("should mask email in logs", async () => {
      const notFoundError = new Error("User not found") as Error & { code: string };
      notFoundError.code = "auth/user-not-found";
      mockGetUserByEmail.mockRejectedValue(notFoundError);

      const mockRequest: CallableRequest = {
        data: { email: "testuser@example.com" },
        rawRequest: {
          headers: { "x-forwarded-for": "192.168.1.1" },
          socket: { remoteAddress: "192.168.1.1" },
        },
      };

      await runCallable(mockRequest);

      // Check that logged email is masked
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Checking email existence",
        expect.objectContaining({
          maskedEmail: "te***@example.com",
        })
      );
    });
  });
});
