/**
 * getSession API Unit Tests
 *
 * Tests for training session retrieval functionality
 *
 * @see docs/common/tickets/012-session-get-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md Section 6
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore instance with methods
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
};

// Configure chained calls
mockCollection.mockReturnValue({
  doc: mockDoc,
});
mockDoc.mockReturnValue({
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
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
const mockRequireAuth = jest.fn();
jest.mock("../../../src/middleware/auth", () => ({
  requireAuth: mockRequireAuth,
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

describe("getSession API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getSessionHandler: (request: any) => Promise<any>;

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
      goodFrames: 1500,
      warningFrames: 200,
      errorFrames: 50,
      warnings: [
        { type: "knee_angle", count: 5, severity: "warning" },
      ],
    },
    cameraSettings: {
      position: "side",
      resolution: "1280x720",
      fps: 30,
    },
    sessionMetadata: {
      totalFrames: 1750,
      processedFrames: 1750,
      averageFps: 29.5,
      frameDropCount: 10,
      averageConfidence: 0.92,
    },
    createdAt: mockTimestamp(new Date("2025-12-10T10:00:00Z")),
    updatedAt: mockTimestamp(new Date("2025-12-10T10:30:00Z")),
  };

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/training/getSession");
      getSessionHandler = module.getSession;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue({ uid: "test-user-123" });
    mockGet.mockResolvedValue(createMockSessionDoc(true, mockSessionData));
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new HttpsError("unauthenticated", "認証が必要です");
      });

      const request = createMockRequest({ sessionId: "session-123" }, null);

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("Session ID Validation", () => {
    it("should reject missing sessionId", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("セッションID");
      }
    });

    it("should reject non-string sessionId", async () => {
      const request = createMockRequest({ sessionId: 12345 }, { uid: "test-user-123" });

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject empty string sessionId", async () => {
      const request = createMockRequest({ sessionId: "" }, { uid: "test-user-123" });

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Session Retrieval", () => {
    it("should return session data for valid request", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        sessionId: "session-123",
        userId: "test-user-123",
        exerciseType: "squat",
        status: "completed",
        repCount: 30,
        setCount: 3,
      });
    });

    it("should return formFeedback data", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(result.data.formFeedback).toMatchObject({
        overallScore: 85,
        goodFrames: 1500,
        warningFrames: 200,
        errorFrames: 50,
      });
    });

    it("should return cameraSettings data", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(result.data.cameraSettings).toMatchObject({
        position: "side",
        resolution: "1280x720",
        fps: 30,
      });
    });

    it("should return sessionMetadata data", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(result.data.sessionMetadata).toMatchObject({
        totalFrames: 1750,
        processedFrames: 1750,
        averageFps: 29.5,
      });
    });

    it("should convert timestamps to ISO strings", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(typeof result.data.startTime).toBe("string");
      expect(typeof result.data.createdAt).toBe("string");
      expect(typeof result.data.updatedAt).toBe("string");
    });

    it("should handle null endTime and duration", async () => {
      const activeSessionData = {
        ...mockSessionData,
        endTime: null,
        duration: null,
        status: "active",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, activeSessionData));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      const result = await getSessionHandler(request);

      expect(result.data.endTime).toBeNull();
      expect(result.data.duration).toBeNull();
      expect(result.data.status).toBe("active");
    });
  });

  describe("Session Not Found", () => {
    it("should throw not-found error for non-existent session", async () => {
      mockGet.mockResolvedValue(createMockSessionDoc(false));

      const request = createMockRequest(
        { sessionId: "non-existent-session" },
        { uid: "test-user-123" },
      );

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
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

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("Authorization", () => {
    it("should throw permission-denied error when accessing another user session", async () => {
      // Session belongs to different user
      const otherUserSession = {
        ...mockSessionData,
        userId: "other-user-456",
      };
      mockGet.mockResolvedValue(createMockSessionDoc(true, otherUserSession));

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
        expect((error as HttpsError).message).toContain("他人のセッション");
      }
    });

    it("should log warning for unauthorized access attempt", async () => {
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
        await getSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Unauthorized session access attempt",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
          sessionUserId: "other-user-456",
        }),
      );
    });
  });

  describe("Logging", () => {
    it("should log session retrieval request", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await getSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Getting session",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
        }),
      );
    });

    it("should log successful session retrieval with duration", async () => {
      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await getSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Session retrieved",
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

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
        expect((error as HttpsError).message).toContain("セッションの取得に失敗");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new HttpsError("resource-exhausted", "Rate limit exceeded");
      });

      const request = createMockRequest(
        { sessionId: "session-123" },
        { uid: "test-user-123" },
      );

      await expect(getSessionHandler(request)).rejects.toThrow();
      try {
        await getSessionHandler(request);
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
        await getSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to get session",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "session-123",
        }),
      );
    });
  });
});
