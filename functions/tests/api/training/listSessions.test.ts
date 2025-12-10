/**
 * listSessions API Unit Tests
 *
 * Tests for training session listing with pagination and filtering
 *
 * @see docs/common/tickets/013-history-list-api.md
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md Section 6
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore query builder
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockWhere = jest.fn();
const mockStartAfter = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
};

// Configure chained calls for query builder pattern
const mockQueryChain = {
  orderBy: mockOrderBy,
  limit: mockLimit,
  where: mockWhere,
  startAfter: mockStartAfter,
  get: mockGet,
};

mockCollection.mockReturnValue({
  doc: mockDoc,
  orderBy: mockOrderBy,
});
mockDoc.mockReturnValue({
  collection: mockCollection,
  doc: mockDoc,
  get: mockGet,
  id: "test-session-id",
});
mockOrderBy.mockReturnValue(mockQueryChain);
mockLimit.mockReturnValue(mockQueryChain);
mockWhere.mockReturnValue(mockQueryChain);
mockStartAfter.mockReturnValue(mockQueryChain);

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

// Helper to create mock session documents
function createMockSessionDocs(count: number, exerciseType = "squat") {
  const docs = [];
  const baseDate = new Date("2025-12-10T10:00:00Z");
  for (let i = 0; i < count; i++) {
    // Use baseDate minus i days to avoid invalid dates
    const date = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
    docs.push({
      id: `session-${i + 1}`,
      data: () => ({
        sessionId: `session-${i + 1}`,
        exerciseType,
        startTime: mockTimestamp(date),
        endTime: mockTimestamp(new Date(date.getTime() + 1800000)),
        duration: 1800,
        status: "completed",
        repCount: Math.max(1, 30 - i),
        setCount: 3,
        formFeedback: {
          overallScore: Math.max(1, 85 - i),
        },
        createdAt: mockTimestamp(date),
      }),
    });
  }
  return docs;
}

describe("listSessions API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listSessionsHandler: (request: any) => Promise<any>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/training/listSessions");
      listSessionsHandler = module.listSessions;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue({ uid: "test-user-123" });
    mockGet.mockResolvedValue({ docs: createMockSessionDocs(5) });
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new HttpsError("unauthenticated", "認証が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("Limit Validation", () => {
    it("should use default limit of 20 when not specified", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await listSessionsHandler(request);

      expect(mockLimit).toHaveBeenCalledWith(21); // 20 + 1 for hasMore check
    });

    it("should accept valid limit within range", async () => {
      const request = createMockRequest({ limit: 50 }, { uid: "test-user-123" });

      await listSessionsHandler(request);

      expect(mockLimit).toHaveBeenCalledWith(51); // 50 + 1
    });

    it("should reject limit less than 1", async () => {
      // Note: limit: 0 is treated as falsy and defaults to 20
      // Use -1 to test the validation
      const request = createMockRequest({ limit: -1 }, { uid: "test-user-123" });

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("limit");
      }
    });

    it("should reject limit greater than 100", async () => {
      const request = createMockRequest({ limit: 101 }, { uid: "test-user-123" });

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("limit");
      }
    });
  });

  describe("Exercise Type Filtering", () => {
    it("should accept valid exercise type: squat", async () => {
      const request = createMockRequest(
        { exerciseType: "squat" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).toHaveBeenCalledWith("exerciseType", "==", "squat");
    });

    it("should accept valid exercise type: pushup", async () => {
      const request = createMockRequest(
        { exerciseType: "pushup" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).toHaveBeenCalledWith("exerciseType", "==", "pushup");
    });

    it("should accept valid exercise type: armcurl", async () => {
      const request = createMockRequest(
        { exerciseType: "armcurl" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).toHaveBeenCalledWith("exerciseType", "==", "armcurl");
    });

    it("should accept valid exercise type: sidelateral", async () => {
      const request = createMockRequest(
        { exerciseType: "sidelateral" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).toHaveBeenCalledWith("exerciseType", "==", "sidelateral");
    });

    it("should accept valid exercise type: shoulderpress", async () => {
      const request = createMockRequest(
        { exerciseType: "shoulderpress" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).toHaveBeenCalledWith("exerciseType", "==", "shoulderpress");
    });

    it("should reject invalid exercise type", async () => {
      const request = createMockRequest(
        { exerciseType: "invalid_exercise" },
        { uid: "test-user-123" },
      );

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("無効な種目");
      }
    });

    it("should not apply filter when exerciseType is not provided", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await listSessionsHandler(request);

      expect(mockWhere).not.toHaveBeenCalled();
    });

    it("should not apply filter when exerciseType is null", async () => {
      const request = createMockRequest(
        { exerciseType: null },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  describe("Pagination", () => {
    it("should apply startAfter cursor when provided", async () => {
      const cursorDoc = {
        exists: true,
        data: () => ({ sessionId: "cursor-session" }),
      };
      mockGet.mockResolvedValueOnce(cursorDoc);
      mockGet.mockResolvedValueOnce({ docs: createMockSessionDocs(5) });

      const request = createMockRequest(
        { startAfter: "cursor-session" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockStartAfter).toHaveBeenCalled();
    });

    it("should throw error for invalid cursor", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const request = createMockRequest(
        { startAfter: "invalid-cursor" },
        { uid: "test-user-123" },
      );

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("カーソル");
      }
    });

    it("should return hasMore=true when there are more results", async () => {
      // Return more docs than limit to indicate hasMore (21 docs for limit 20)
      // The mock is already configured in beforeEach with 5 docs, we override it here
      mockGet.mockResolvedValueOnce({ docs: createMockSessionDocs(21) });

      const request = createMockRequest({ limit: 20 }, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.data.hasMore).toBe(true);
      expect(result.data.nextCursor).toBe("session-20");
    });

    it("should return hasMore=false when there are no more results", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(5) });

      const request = createMockRequest({ limit: 20 }, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.data.hasMore).toBe(false);
      expect(result.data.nextCursor).toBeNull();
    });

    it("should return nextCursor as last session's sessionId", async () => {
      // Return more docs than limit (21 for limit 20) to get nextCursor
      mockGet.mockResolvedValueOnce({ docs: createMockSessionDocs(21) });

      const request = createMockRequest({ limit: 20 }, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      // nextCursor should be the last session in the returned list (limited to 20)
      expect(result.data.nextCursor).toBe("session-20");
    });
  });

  describe("Session List Response", () => {
    it("should return sessions in correct format", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(3) });

      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(3);
      expect(result.data.sessions[0]).toMatchObject({
        sessionId: "session-1",
        exerciseType: "squat",
        status: "completed",
        repCount: expect.any(Number),
        setCount: expect.any(Number),
        overallScore: expect.any(Number),
      });
    });

    it("should convert timestamps to ISO strings", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(1) });

      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(typeof result.data.sessions[0].startTime).toBe("string");
      expect(typeof result.data.sessions[0].createdAt).toBe("string");
    });

    it("should return limited number of sessions", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(10) });

      const request = createMockRequest({ limit: 5 }, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.data.sessions.length).toBeLessThanOrEqual(5);
    });

    it("should include overallScore from formFeedback", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(1) });

      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.data.sessions[0].overallScore).toBe(85);
    });

    it("should handle sessions without formFeedback", async () => {
      const docsWithoutFeedback = [{
        id: "session-no-feedback",
        data: () => ({
          sessionId: "session-no-feedback",
          exerciseType: "squat",
          startTime: mockTimestamp(new Date()),
          endTime: null,
          duration: null,
          status: "active",
          repCount: 0,
          setCount: 0,
          formFeedback: null,
          createdAt: mockTimestamp(new Date()),
        }),
      }];
      mockGet.mockResolvedValue({ docs: docsWithoutFeedback });

      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.data.sessions[0].overallScore).toBeNull();
    });
  });

  describe("Sorting", () => {
    it("should order by createdAt descending", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await listSessionsHandler(request);

      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    });
  });

  describe("Logging", () => {
    it("should log listing request", async () => {
      const request = createMockRequest(
        { limit: 10, exerciseType: "squat" },
        { uid: "test-user-123" },
      );

      await listSessionsHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Listing sessions",
        expect.objectContaining({
          userId: "test-user-123",
          limit: 10,
          exerciseType: "squat",
        }),
      );
    });

    it("should log successful listing with count and hasMore", async () => {
      mockGet.mockResolvedValue({ docs: createMockSessionDocs(5) });

      const request = createMockRequest({}, { uid: "test-user-123" });

      await listSessionsHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Sessions listed",
        expect.objectContaining({
          userId: "test-user-123",
          count: 5,
          hasMore: false,
          duration: expect.any(Number),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore query errors", async () => {
      mockGet.mockRejectedValue(new Error("Firestore query error"));

      const request = createMockRequest({}, { uid: "test-user-123" });

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
        expect((error as HttpsError).message).toContain("一覧取得に失敗");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new HttpsError("resource-exhausted", "Rate limit exceeded");
      });

      const request = createMockRequest({}, { uid: "test-user-123" });

      await expect(listSessionsHandler(request)).rejects.toThrow();
      try {
        await listSessionsHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("should log errors on failure", async () => {
      mockGet.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({}, { uid: "test-user-123" });

      try {
        await listSessionsHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to list sessions",
        expect.any(Error),
        expect.objectContaining({ userId: "test-user-123" }),
      );
    });
  });

  describe("Empty Results", () => {
    it("should handle empty session list", async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await listSessionsHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(0);
      expect(result.data.hasMore).toBe(false);
      expect(result.data.nextCursor).toBeNull();
    });
  });
});
