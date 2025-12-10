/**
 * consent_getHistory API Unit Tests
 *
 * Tests for consent history retrieval functionality
 *
 * @see docs/common/tickets/020-gdpr-consent-api.md
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore
const mockGet = jest.fn();
const mockCollection = jest.fn();
const mockCountGet = jest.fn();

// Build a fluent query mock
const createQueryMock = () => {
  const queryMock: Record<string, jest.Mock> = {
    where: jest.fn(),
    orderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    count: jest.fn(),
    get: mockGet,
  };

  // Each method returns the query mock for chaining
  queryMock.where.mockReturnValue(queryMock);
  queryMock.orderBy.mockReturnValue(queryMock);
  queryMock.offset.mockReturnValue(queryMock);
  queryMock.limit.mockReturnValue(queryMock);
  queryMock.count.mockReturnValue({
    get: mockCountGet,
  });

  return queryMock;
};

const queryMock = createQueryMock();

mockCollection.mockReturnValue(queryMock);

const mockFirestoreInstance = {
  collection: mockCollection,
};

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
const mockLoggerError = jest.fn();
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock auth middleware
const mockRequireAuth = jest.fn();
jest.mock("../../../src/middleware/auth", () => ({
  requireAuth: mockRequireAuth,
}));

// Mock rate limiter
const mockRateLimiterCheck = jest.fn();
jest.mock("../../../src/middleware/rateLimiter", () => ({
  rateLimiter: {
    check: mockRateLimiterCheck,
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
function createMockRequest(
  data: unknown,
  auth: { uid: string; token?: Record<string, unknown> } | null,
) {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: auth.token || { email: "test@example.com" },
        }
      : null,
    rawRequest: {},
  };
}

// Helper to create mock consent docs
function createMockConsentDocs(count: number) {
  const docs = [];
  const baseDate = new Date("2025-12-10T10:00:00Z");
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
    docs.push({
      id: `consent-${i}`,
      data: () => ({
        userId: "test-user-123",
        consentType: i % 2 === 0 ? "tos" : "privacy_policy",
        documentVersion: "1.0",
        action: "accept",
        createdAt: {
          toDate: () => date,
        },
        consentDetails: {
          ipAddress: "abc123",
          userAgent: "Mozilla/5.0",
        },
      }),
    });
  }
  return docs;
}

describe("consent_getHistory API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getHistoryHandler: (request: any) => Promise<any>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/consent/history");
      getHistoryHandler = module.consent_getHistory;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ uid: "test-user-123" });
    mockRateLimiterCheck.mockResolvedValue(true);
    mockCountGet.mockResolvedValue({ data: () => ({ count: 5 }) });
    mockGet.mockResolvedValue({ docs: createMockConsentDocs(5) });

    // Reset query mock chains
    queryMock.where.mockReturnValue(queryMock);
    queryMock.orderBy.mockReturnValue(queryMock);
    queryMock.offset.mockReturnValue(queryMock);
    queryMock.limit.mockReturnValue(queryMock);
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuth.mockRejectedValue(
        new HttpsError("unauthenticated", "認証が必要です"),
      );

      const request = createMockRequest({}, null);

      await expect(getHistoryHandler(request)).rejects.toThrow();
      try {
        await getHistoryHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should check rate limit for user", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });
      await getHistoryHandler(request);

      expect(mockRateLimiterCheck).toHaveBeenCalledWith("CONSENT_HISTORY", "test-user-123");
    });
  });

  describe("Successful Retrieval", () => {
    it("should return consent history with default pagination", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await getHistoryHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.history).toHaveLength(5);
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    });

    it("should respect custom limit and offset", async () => {
      const request = createMockRequest(
        { limit: 10, offset: 5 },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      expect(queryMock.offset).toHaveBeenCalledWith(5);
      expect(queryMock.limit).toHaveBeenCalledWith(11); // limit + 1 for hasMore check
    });

    it("should enforce max limit of 100", async () => {
      const request = createMockRequest(
        { limit: 500 },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      expect(queryMock.limit).toHaveBeenCalledWith(101); // 100 + 1
    });

    it("should filter by consent type", async () => {
      const request = createMockRequest(
        { consentType: "tos" },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      expect(queryMock.where).toHaveBeenCalledWith("consentType", "==", "tos");
    });

    it("should not filter when consentType is 'all'", async () => {
      const request = createMockRequest(
        { consentType: "all" },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      // consentType filter should not be called with 'all'
      const whereCallArgs = queryMock.where.mock.calls.map((call) => call[0]);
      expect(whereCallArgs).not.toContain("consentType");
    });

    it("should include hasMore flag when more results exist", async () => {
      mockGet.mockResolvedValue({ docs: createMockConsentDocs(21) });

      const request = createMockRequest(
        { limit: 20 },
        { uid: "test-user-123" },
      );

      const result = await getHistoryHandler(request);

      expect(result.data.hasMore).toBe(true);
      expect(result.data.history).toHaveLength(20);
    });

    it("should return hasMore false when no more results", async () => {
      mockGet.mockResolvedValue({ docs: createMockConsentDocs(3) });

      const request = createMockRequest(
        { limit: 20 },
        { uid: "test-user-123" },
      );

      const result = await getHistoryHandler(request);

      expect(result.data.hasMore).toBe(false);
    });

    it("should format history items correctly", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      const result = await getHistoryHandler(request);
      const firstItem = result.data.history[0];

      expect(firstItem).toHaveProperty("consentId");
      expect(firstItem).toHaveProperty("consentType");
      expect(firstItem).toHaveProperty("documentVersion");
      expect(firstItem).toHaveProperty("action");
      expect(firstItem).toHaveProperty("timestamp");
      expect(firstItem).toHaveProperty("ipAddress");
      expect(firstItem).toHaveProperty("userAgent");
    });
  });

  describe("Date Filtering", () => {
    it("should filter by start date", async () => {
      const request = createMockRequest(
        { startDate: "2025-12-01T00:00:00Z" },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      expect(queryMock.where).toHaveBeenCalledWith(
        "createdAt",
        ">=",
        expect.any(Object),
      );
    });

    it("should filter by end date", async () => {
      const request = createMockRequest(
        { endDate: "2025-12-31T23:59:59Z" },
        { uid: "test-user-123" },
      );

      await getHistoryHandler(request);

      expect(queryMock.where).toHaveBeenCalledWith(
        "createdAt",
        "<=",
        expect.any(Object),
      );
    });
  });

  describe("Logging", () => {
    it("should log history retrieval", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await getHistoryHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Getting consent history",
        expect.objectContaining({
          userId: "test-user-123",
        }),
      );
    });

    it("should log successful retrieval with count", async () => {
      const request = createMockRequest({}, { uid: "test-user-123" });

      await getHistoryHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Consent history retrieved",
        expect.objectContaining({
          userId: "test-user-123",
          count: expect.any(Number),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore errors", async () => {
      mockGet.mockRejectedValue(new Error("Firestore error"));

      const request = createMockRequest({}, { uid: "test-user-123" });

      await expect(getHistoryHandler(request)).rejects.toThrow();
      try {
        await getHistoryHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("should log errors on failure", async () => {
      mockGet.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest({}, { uid: "test-user-123" });

      try {
        await getHistoryHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to get consent history",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-123",
        }),
      );
    });
  });
});
