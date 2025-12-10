/**
 * deleteSession API Unit Tests
 *
 * Tests for training session deletion (logical delete) functionality
 *
 * @see docs/common/tickets/014-session-delete-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md Section 6
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore instance with methods
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
  update: mockUpdate,
};

// Configure chained calls
mockCollection.mockReturnValue({
  doc: mockDoc,
});
mockDoc.mockReturnValue({
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
  update: mockUpdate,
  id: "test-session-id",
});

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => mockFirestoreInstance),
    {
      Timestamp: {
        fromDate: jest.fn((date: Date) => mockTimestamp(date)),
      },
    },
  ),
}));

// Mock firebase-admin/firestore
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-timestamp"),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => mockTimestamp(date)),
  },
}));

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: jest.fn(),
  },
}));

// Mock auth middleware
const mockRequireAuthWithWritePermission = jest.fn();
jest.mock("../../../src/middleware/auth", () => ({
  requireAuthWithWritePermission: mockRequireAuthWithWritePermission,
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
function createMockRequest(
  data: unknown,
  auth: { uid: string; token?: Record<string, unknown> } | null,
) {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: auth.token || { email: "test@example.com", email_verified: true },
        }
      : null,
    rawRequest: {},
  };
}

// Helper to create mock session document
function createMockSessionDoc(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    data: () => data,
    id: data?.sessionId || "test-session-id",
  };
}

describe("deleteSession API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deleteSessionHandler: (request: any) => Promise<any>;

  const mockSessionData = {
    sessionId: "session-123",
    userId: "test-user-123",
    exerciseType: "squat",
    startTime: mockTimestamp(new Date("2025-12-10T10:00:00Z")),
    endTime: mockTimestamp(new Date("2025-12-10T10:30:00Z")),
    duration: 1800,
    status: "completed",
    repCount: 30,
    setCount: 3,
    formFeedback: {
      overallScore: 85,
    },
    createdAt: mockTimestamp(new Date("2025-12-10T10:00:00Z")),
    updatedAt: mockTimestamp(new Date("2025-12-10T10:30:00Z")),
  };

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/training/deleteSession");
      deleteSessionHandler = module.deleteSession;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuthWithWritePermission.mockResolvedValue({ uid: "test-user-123" });
    mockGet.mockResolvedValue(createMockSessionDoc(true, mockSessionData));
    mockUpdate.mockResolvedValue(undefined);
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("unauthenticated", "認証が必要です"),
      );

      const request = createMockRequest({ sessionId: "session-123" }, null);

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });

    it("should throw permission-denied when user is scheduled for deletion", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("permission-denied", "アカウント削除が予定されています"),
      );

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "deletion-scheduled-user" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });
  });

  describe("Session ID Validation", () => {
    it("should reject missing sessionId", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("セッションID");
      }
    });

    it("should reject non-string sessionId", async () => {
      const request = createMockRequest({ sessionId: 12345 }, { uid: "test-user-123" });

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject empty string sessionId", async () => {
      const request = createMockRequest({ sessionId: "" }, { uid: "test-user-123" });

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Session Not Found", () => {
    it("should throw not-found error for non-existent session", async () => {
      mockGet.mockResolvedValue(createMockSessionDoc(false));

      const request = createMockRequest(
        { sessionId: "non-existent-session" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
        expect((error as HttpsError).message).toContain("セッション");
      }
    });

    it("should throw not-found error when session data is null", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => null,
      });

      const request = createMockRequest(
        { sessionId: "session-with-null-data" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("Authorization", () => {
    it("should throw permission-denied error when deleting another user's session", async () => {
      const otherUserSession = {
        ...mockSessionData,
        userId: "other-user-456",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, otherUserSession));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
        expect((error as HttpsError).message).toContain("他人のセッション");
      }
    });

    it("should log warning for unauthorized deletion attempt", async () => {
      const otherUserSession = {
        ...mockSessionData,
        userId: "other-user-456",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, otherUserSession));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      try {
        await deleteSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Unauthorized session deletion attempt",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
          sessionUserId: "other-user-456",
        }),
      );
    });
  });

  describe("Already Deleted", () => {
    it("should throw failed-precondition when session is already cancelled", async () => {
      const cancelledSession = {
        ...mockSessionData,
        status: "cancelled",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, cancelledSession));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("既に削除");
      }
    });
  });

  describe("Successful Deletion", () => {
    it("should delete session successfully (logical delete)", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await deleteSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        sessionId: "session-123",
        status: "cancelled",
      });
      expect(result.data.deletedAt).toBeDefined();
      expect(result.message).toContain("削除しました");
    });

    it("should update Firestore with cancelled status", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await deleteSessionHandler(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          updatedAt: "server-timestamp",
        }),
      );
    });

    it("should delete active session", async () => {
      const activeSession = {
        ...mockSessionData,
        status: "active",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, activeSession));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await deleteSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("cancelled");
    });

    it("should delete completed session", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await deleteSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("cancelled");
    });
  });

  describe("Logging", () => {
    it("should log deletion request", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await deleteSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Deleting session",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
        }),
      );
    });

    it("should log successful deletion", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await deleteSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Session deleted (logical)",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
          duration: expect.any(Number),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore read errors", async () => {
      mockGet.mockRejectedValue(new Error("Firestore read error"));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
        expect((error as HttpsError).message).toContain("セッションの削除に失敗");
      }
    });

    it("should handle Firestore update errors", async () => {
      mockUpdate.mockRejectedValue(new Error("Firestore update error"));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
        expect((error as HttpsError).message).toContain("セッションの削除に失敗");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("resource-exhausted", "Rate limit exceeded"),
      );

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(deleteSessionHandler(request)).rejects.toThrow();
      try {
        await deleteSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("should log errors on failure", async () => {
      mockGet.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      try {
        await deleteSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to delete session",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
        }),
      );
    });
  });
});
