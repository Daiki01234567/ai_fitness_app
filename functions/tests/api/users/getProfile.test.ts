/**
 * getProfile API Unit Tests
 *
 * Tests for user profile retrieval functionality
 *
 * @see docs/common/tickets/007-user-api.md
 */

import { createMockUser, mockTimestamp } from "../../mocks/firestore";

// Mock firestore instance with methods - must be defined before firebase-admin mock
const mockGet = jest.fn();
const mockFirestoreInstance = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: mockGet,
};

// Mock firebase-admin - override global mock
jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreInstance),
}));

// Mock CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireCsrfProtection: jest.fn(),
}));

// Mock logger - capture error calls
const mockLoggerError = jest.fn();
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: mockLoggerError,
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
    // Return the handler directly for testing
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

describe("getProfile API", () => {
  let getProfileHandler: (request: unknown) => Promise<unknown>;

  beforeAll(() => {
    // Import after all mocks are set up
    jest.isolateModules(() => {
      const module = require("../../../src/api/users/getProfile");
      getProfileHandler = module.getProfile;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset only implementation, not entire mock
    mockGet.mockClear();
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      const request = createMockRequest({}, null);

      await expect(getProfileHandler(request)).rejects.toThrow();
      try {
        await getProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
        expect((error as HttpsError).message).toBe("認証が必要です");
      }
    });

    it("should succeed with valid auth context", async () => {
      const userId = "test-user-123";
      const mockUser = createMockUser({ nickname: "TestUser" });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({}, { uid: userId });

      const result = await getProfileHandler(request);

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          userId,
          nickname: "TestUser",
        }),
      });
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

      const request = createMockRequest({}, { uid: userId });

      await expect(getProfileHandler(request)).rejects.toThrow();
      try {
        await getProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("Profile Data Retrieval", () => {
    it("should return full profile data", async () => {
      const userId = "test-user-456";
      const now = mockTimestamp();
      const mockUser = {
        nickname: "FullUser",
        email: "full@example.com",
        photoURL: "https://example.com/photo.jpg",
        birthYear: 1990,
        gender: "male",
        height: 175,
        weight: 70,
        fitnessLevel: "intermediate",
        tosAccepted: true,
        ppAccepted: true,
        deletionScheduled: false,
        createdAt: now,
        updatedAt: now,
      };

      mockGet.mockResolvedValueOnce({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({}, { uid: userId });

      const result = await getProfileHandler(request) as { success: boolean; data: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        userId,
        nickname: "FullUser",
        email: "full@example.com",
        photoURL: "https://example.com/photo.jpg",
        gender: "male",
        height: 175,
        weight: 70,
        fitnessLevel: "intermediate",
        tosAccepted: true,
        ppAccepted: true,
        deletionScheduled: false,
      });
    });

    it("should return minimal profile with defaults", async () => {
      const userId = "minimal-user";
      const minimalUser = {
        nickname: "Minimal",
        email: "minimal@example.com",
        tosAccepted: false,
        ppAccepted: false,
        deletionScheduled: false,
        createdAt: mockTimestamp(),
        updatedAt: mockTimestamp(),
      };

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => minimalUser,
      });

      const request = createMockRequest({}, { uid: userId });

      const result = await getProfileHandler(request) as { success: boolean; data: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.data.userId).toBe(userId);
      expect(result.data.nickname).toBe("Minimal");
      expect(result.data.photoURL).toBeUndefined();
      expect(result.data.height).toBeUndefined();
      expect(result.data.weight).toBeUndefined();
    });

    it("should handle profile nested in profile field", async () => {
      const userId = "nested-profile-user";
      const userWithNestedProfile = {
        nickname: "NestedUser",
        email: "nested@example.com",
        profile: {
          birthday: "1985-05-15",
          gender: "female",
          height: 165,
          weight: 55,
          fitnessLevel: "beginner",
        },
        tosAccepted: true,
        ppAccepted: true,
        deletionScheduled: false,
        createdAt: mockTimestamp(),
        updatedAt: mockTimestamp(),
      };

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => userWithNestedProfile,
      });

      const request = createMockRequest({}, { uid: userId });

      const result = await getProfileHandler(request) as { success: boolean; data: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.data.gender).toBe("female");
      expect(result.data.height).toBe(165);
      expect(result.data.weight).toBe(55);
      expect(result.data.fitnessLevel).toBe("beginner");
    });
  });

  describe("Deletion Scheduled User", () => {
    it("should allow profile retrieval for deletion-scheduled user (read-only)", async () => {
      const userId = "deletion-scheduled-user";
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 30);

      const mockUser = createMockUser({
        nickname: "DeletingUser",
        deletionScheduled: true,
        scheduledDeletionDate: mockTimestamp(scheduledDate),
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: userId,
        data: () => mockUser,
      });

      const request = createMockRequest({}, { uid: userId });

      const result = await getProfileHandler(request) as { success: boolean; data: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.data.deletionScheduled).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore errors gracefully", async () => {
      const userId = "error-user";

      mockGet.mockRejectedValue(new Error("Firestore connection error"));

      const request = createMockRequest({}, { uid: userId });

      await expect(getProfileHandler(request)).rejects.toThrow();
      try {
        await getProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      const userId = "https-error-user";

      const customError = new HttpsError("permission-denied", "Custom error");
      mockGet.mockRejectedValue(customError);

      const request = createMockRequest({}, { uid: userId });

      await expect(getProfileHandler(request)).rejects.toThrow();
      try {
        await getProfileHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });
  });
});
