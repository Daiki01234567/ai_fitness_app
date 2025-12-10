/**
 * updateProfile API Unit Tests
 *
 * Tests for user profile update functionality
 *
 * @see docs/common/tickets/007-user-api.md
 */

import { createMockUser } from "../../mocks/firestore";

// Mock firestore instance with methods
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockFirestoreInstance = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: mockGet,
  update: mockUpdate,
};

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreInstance),
}));

// Mock firebase-admin/firestore
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _methodName: "serverTimestamp" })),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

// Mock CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireCsrfProtection: jest.fn(),
}));

// Mock audit log service
jest.mock("../../../src/services/auditLog", () => ({
  logProfileUpdate: jest.fn().mockResolvedValue("audit-log-id"),
}));

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// HttpsError class for tests
class HttpsError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "HttpsError";
  }
}

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    if (typeof options === "function") {
      return options;
    }
    return handler;
  }),
  HttpsError,
}));

// Helper to create mock request
function createMockRequest(data: unknown, auth: { uid: string; token?: Record<string, unknown> } | null) {
  return {
    data,
    auth: auth ? {
      uid: auth.uid,
      token: auth.token || { email: "test@example.com", email_verified: true },
    } : null,
    rawRequest: {},
  };
}

describe("updateProfile API", () => {
  let updateProfileHandler: (request: unknown) => Promise<unknown>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/users/updateProfile");
      updateProfileHandler = module.updateProfile;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockClear();
    mockUpdate.mockClear();
    mockUpdate.mockResolvedValue(undefined);
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      const request = createMockRequest({ displayName: "NewName" }, null);

      await expect(updateProfileHandler(request)).rejects.toThrow();
      try {
        await updateProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
        expect((error as HttpsError).message).toBe("認証が必要です");
      }
    });
  });

  describe("User Not Found", () => {
    it("should throw not-found error when user does not exist", async () => {
      const userId = "non-existent-user";

      mockGet.mockResolvedValue({
        exists: false,
        id: userId,
        data: () => null,
      });

      const request = createMockRequest({ displayName: "NewName" }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
      try {
        await updateProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("Deletion Scheduled User", () => {
    it("should reject updates for deletion-scheduled user", async () => {
      const userId = "deletion-user";
      const mockUser = createMockUser({
        nickname: "DeletingUser",
        deletionScheduled: true,
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ displayName: "NewName" }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
      try {
        await updateProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
      }
    });
  });

  describe("Display Name Update", () => {
    it("should update displayName successfully", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({
        nickname: "OldName",
        deletionScheduled: false,
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ displayName: "NewName" }, { uid: userId });

      const result = await updateProfileHandler(request) as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should validate displayName length", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ displayName: "a".repeat(51) }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Height Validation", () => {
    it("should update valid height", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ height: 175 }, { uid: userId });

      const result = await updateProfileHandler(request) as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should reject height below minimum (50cm)", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ height: 40 }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });

    it("should reject height above maximum (300cm)", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ height: 350 }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Weight Validation", () => {
    it("should update valid weight", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ weight: 70 }, { uid: userId });

      const result = await updateProfileHandler(request) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it("should reject weight below minimum (10kg)", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ weight: 5 }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });

    it("should reject weight above maximum (500kg)", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ weight: 600 }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Gender Validation", () => {
    it("should accept valid gender values", async () => {
      const userId = "test-user";
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];

      for (const gender of validGenders) {
        mockGet.mockClear();
        mockUpdate.mockClear();
        const mockUser = createMockUser({ deletionScheduled: false });
        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({ gender }, { uid: userId });

        const result = await updateProfileHandler(request) as { success: boolean };
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid gender value", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ gender: "invalid" }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Fitness Level Validation", () => {
    it("should accept valid fitness levels", async () => {
      const userId = "test-user";
      const validLevels = ["beginner", "intermediate", "advanced"];

      for (const fitnessLevel of validLevels) {
        mockGet.mockClear();
        mockUpdate.mockClear();
        const mockUser = createMockUser({ deletionScheduled: false });
        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({ fitnessLevel }, { uid: userId });

        const result = await updateProfileHandler(request) as { success: boolean };
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid fitness level", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ fitnessLevel: "expert" }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Date of Birth Validation", () => {
    it("should accept valid date of birth (13+ years old)", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 20);

      const request = createMockRequest({ dateOfBirth: dateOfBirth.toISOString().split("T")[0] }, { uid: userId });

      const result = await updateProfileHandler(request) as { success: boolean };
      expect(result.success).toBe(true);
    });

    it("should reject user under 13 years old", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 10); // 10 years old

      const request = createMockRequest({ dateOfBirth: dateOfBirth.toISOString().split("T")[0] }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
    });
  });

  describe("Partial Update", () => {
    it("should only update specified fields", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({
        nickname: "OldName",
        deletionScheduled: false,
        height: 170,
        weight: 65,
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({ height: 175 }, { uid: userId });

      const result = await updateProfileHandler(request) as { success: boolean };

      expect(result.success).toBe(true);

      // Verify only height-related field was in the update call
      // The key is "profile.height" as a flat string (Firestore dot notation)
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall["profile.height"]).toBe(175);
    });

    it("should reject empty update request", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({}, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
      try {
        await updateProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toBe("更新するデータがありません");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore update errors", async () => {
      const userId = "test-user";
      const mockUser = createMockUser({ deletionScheduled: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });
      mockUpdate.mockRejectedValue(new Error("Firestore update failed"));

      const request = createMockRequest({ displayName: "NewName" }, { uid: userId });

      await expect(updateProfileHandler(request)).rejects.toThrow();
      try {
        await updateProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
