/**
 * completeSession API Unit Tests
 *
 * Tests for training session completion functionality
 *
 * @see docs/common/tickets/011-session-save-api.md
 * @see docs/common/specs/04_API_Firebase_Functions_v1_0.md Section 6
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore instance with methods - must be defined before firebase-admin mock
const mockUpdate = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  doc: mockDoc,
  update: mockUpdate,
  get: mockGet,
};

// Configure chained calls
mockCollection.mockReturnValue({
  doc: mockDoc,
});
mockDoc.mockReturnValue({
  collection: mockCollection,
  doc: mockDoc,
  update: mockUpdate,
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
      FieldValue: {
        serverTimestamp: jest.fn(() => "server-timestamp"),
      },
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

// Valid form feedback for testing
const validFormFeedback = {
  overallScore: 85,
  goodFrames: 800,
  warningFrames: 100,
  errorFrames: 50,
  warnings: [
    { type: "knee_over_toe", count: 5, severity: "medium" as const },
    { type: "back_not_straight", count: 3, severity: "low" as const },
  ],
};

// Valid session metadata for testing
const validSessionMetadata = {
  totalFrames: 950,
  processedFrames: 950,
  averageFps: 28.5,
  frameDropCount: 10,
  averageConfidence: 0.92,
  mediapipePerformance: {
    averageInferenceTime: 25.5,
    maxInferenceTime: 45.2,
    minInferenceTime: 18.3,
  },
  deviceInfo: {
    platform: "iOS" as const,
    osVersion: "17.0",
    deviceModel: "iPhone 14 Pro",
    deviceMemory: 6,
  },
};

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

// Helper to create valid complete session request
function createValidCompleteRequest(
  overrides: Partial<{
    sessionId: string;
    repCount: number;
    setCount: number;
    formFeedback: typeof validFormFeedback;
    sessionMetadata: typeof validSessionMetadata;
  }> = {},
) {
  return {
    sessionId: "test-session-id",
    repCount: 10,
    setCount: 3,
    formFeedback: validFormFeedback,
    sessionMetadata: validSessionMetadata,
    ...overrides,
  };
}

describe("completeSession API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let completeSessionHandler: (request: any) => Promise<any>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/training/completeSession");
      completeSessionHandler = module.completeSession;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockRequireAuth.mockReturnValue({ uid: "test-user-123" });

    // Default mock for existing session
    const startTime = new Date(Date.now() - 300000); // 5 minutes ago
    mockGet.mockResolvedValue({
      exists: true,
      id: "test-session-id",
      data: () => ({
        sessionId: "test-session-id",
        userId: "test-user-123",
        exerciseType: "squat",
        status: "active",
        startTime: mockTimestamp(startTime),
      }),
    });
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new HttpsError("unauthenticated", "Authentication required");
      });

      const request = createMockRequest(createValidCompleteRequest(), null);

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });

    it("should throw permission-denied when trying to complete another user session", async () => {
      // Session belongs to different user
      mockGet.mockResolvedValue({
        exists: true,
        id: "test-session-id",
        data: () => ({
          sessionId: "test-session-id",
          userId: "other-user-456",
          exerciseType: "squat",
          status: "active",
          startTime: mockTimestamp(),
        }),
      });

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });
  });

  describe("Session Validation", () => {
    it("should throw not-found when session does not exist", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        id: "nonexistent-session",
        data: () => null,
      });

      const request = createMockRequest(
        createValidCompleteRequest({ sessionId: "nonexistent-session" }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });

    it("should throw failed-precondition when session is already completed", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "test-session-id",
        data: () => ({
          sessionId: "test-session-id",
          userId: "test-user-123",
          exerciseType: "squat",
          status: "completed",
          startTime: mockTimestamp(),
        }),
      });

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
      }
    });

    it("should reject invalid sessionId", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ sessionId: "" }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject non-string sessionId", async () => {
      const request = createMockRequest(
        { ...createValidCompleteRequest(), sessionId: 12345 },
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Rep Count and Set Count Validation", () => {
    it("should accept valid repCount of 0", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ repCount: 0 }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.repCount).toBe(0);
    });

    it("should accept valid positive repCount", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ repCount: 25 }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.repCount).toBe(25);
    });

    it("should reject negative repCount", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ repCount: -1 }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject non-integer repCount", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ repCount: 10.5 }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should accept valid setCount of 1", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ setCount: 1 }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
    });

    it("should reject setCount less than 1", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({ setCount: 0 }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Form Feedback Validation", () => {
    it("should accept valid form feedback", async () => {
      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.overallScore).toBe(85);
    });

    it("should reject overallScore less than 0", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: { ...validFormFeedback, overallScore: -1 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject overallScore greater than 100", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: { ...validFormFeedback, overallScore: 101 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject non-integer overallScore", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: { ...validFormFeedback, overallScore: 85.5 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject negative frame counts", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: { ...validFormFeedback, goodFrames: -10 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject invalid warning severity", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: {
            ...validFormFeedback,
            warnings: [{ type: "test", count: 1, severity: "critical" as never }],
          },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should accept empty warnings array", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          formFeedback: { ...validFormFeedback, warnings: [] },
        }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
    });
  });

  describe("Session Metadata Validation", () => {
    it("should accept valid session metadata", async () => {
      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
    });

    it("should reject negative totalFrames", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          sessionMetadata: { ...validSessionMetadata, totalFrames: -1 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject averageConfidence greater than 1", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          sessionMetadata: { ...validSessionMetadata, averageConfidence: 1.5 },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should reject invalid platform", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          sessionMetadata: {
            ...validSessionMetadata,
            deviceInfo: {
              ...validSessionMetadata.deviceInfo,
              platform: "Windows" as never,
            },
          },
        }),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("should accept Android platform", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          sessionMetadata: {
            ...validSessionMetadata,
            deviceInfo: {
              ...validSessionMetadata.deviceInfo,
              platform: "Android" as const,
            },
          },
        }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
    });

    it("should accept null deviceMemory", async () => {
      const request = createMockRequest(
        createValidCompleteRequest({
          sessionMetadata: {
            ...validSessionMetadata,
            deviceInfo: {
              ...validSessionMetadata.deviceInfo,
              deviceMemory: null,
            },
          },
        }),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
    });
  });

  describe("Session Completion", () => {
    it("should complete session with correct response", async () => {
      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      const result = await completeSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        sessionId: "test-session-id",
        userId: "test-user-123",
        status: "completed",
        repCount: 10,
        overallScore: 85,
      });
      expect(result.data.completedAt).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it("should call Firestore update with correct data", async () => {
      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await completeSessionHandler(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          repCount: 10,
          setCount: 3,
          formFeedback: validFormFeedback,
          sessionMetadata: validSessionMetadata,
          bigquerySyncStatus: "pending",
        }),
      );
    });

    it("should calculate duration correctly", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockGet.mockResolvedValue({
        exists: true,
        id: "test-session-id",
        data: () => ({
          sessionId: "test-session-id",
          userId: "test-user-123",
          exerciseType: "squat",
          status: "active",
          startTime: mockTimestamp(fiveMinutesAgo),
        }),
      });

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await completeSessionHandler(request);

      // Verify duration is approximately 300 seconds (5 minutes)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
        }),
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.duration).toBeGreaterThanOrEqual(299);
      expect(updateCall.duration).toBeLessThanOrEqual(301);
    });

    it("should log session completion", async () => {
      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await completeSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Completing session",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "test-session-id",
        }),
      );

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Session completed",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "test-session-id",
          repCount: 10,
          overallScore: 85,
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore update errors", async () => {
      mockUpdate.mockRejectedValue(new Error("Firestore update error"));

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      const customError = new HttpsError("resource-exhausted", "Rate limit exceeded");
      mockGet.mockRejectedValue(customError);

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      await expect(completeSessionHandler(request)).rejects.toThrow();
      try {
        await completeSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("should log errors on failure", async () => {
      mockUpdate.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      try {
        await completeSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to complete session",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "test-session-id",
        }),
      );
    });

    it("should log warning for unauthorized access attempt", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "test-session-id",
        data: () => ({
          sessionId: "test-session-id",
          userId: "other-user-456",
          exerciseType: "squat",
          status: "active",
          startTime: mockTimestamp(),
        }),
      });

      const request = createMockRequest(
        createValidCompleteRequest(),
        { uid: "test-user-123" },
      );

      try {
        await completeSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Unauthorized session completion attempt",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: "test-session-id",
          sessionUserId: "other-user-456",
        }),
      );
    });
  });
});
