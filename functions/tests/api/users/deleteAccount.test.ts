/**
 * deleteAccount API Unit Tests
 *
 * Tests for account deletion request and cancellation functionality
 *
 * @see docs/common/tickets/007-user-api.md
 */

import { createMockUser } from "../../mocks/firestore";

// Mock firestore instance with methods
const mockGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockDocRef = {
  id: "mock-request-id",
  get: mockGet,
};
const mockFirestoreInstance = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnValue(mockDocRef),
  get: mockGet,
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  runTransaction: mockRunTransaction,
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
  requireStrictCsrfProtection: jest.fn(),
}));

// Mock audit log service
jest.mock("../../../src/services/auditLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue("audit-log-id"),
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

// Mock validation
jest.mock("../../../src/utils/validation", () => ({
  isNonEmptyString: jest.fn((value: unknown) => typeof value === "string" && value.trim().length > 0),
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

// Helper to create mock query snapshot
function createMockQuerySnapshot(docs: Array<{ id: string; data: unknown }>) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map(({ id, data }) => ({
      id,
      exists: true,
      data: () => data,
      ref: {
        path: `dataDeletionRequests/${id}`,
        update: jest.fn(),
      },
    })),
  };
}

describe("deleteAccount API", () => {
  let requestAccountDeletionHandler: (request: unknown) => Promise<unknown>;
  let cancelAccountDeletionHandler: (request: unknown) => Promise<unknown>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/users/deleteAccount");
      requestAccountDeletionHandler = module.requestAccountDeletion;
      cancelAccountDeletionHandler = module.cancelAccountDeletion;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockClear();
    mockRunTransaction.mockClear();
    // Default transaction implementation
    mockRunTransaction.mockImplementation(async (callback) => {
      const transaction = {
        set: jest.fn(),
        update: jest.fn(),
      };
      await callback(transaction);
      return transaction;
    });
  });

  describe("requestAccountDeletion", () => {
    describe("Authentication", () => {
      it("should throw unauthenticated error when no auth context", async () => {
        const request = createMockRequest({}, null);

        await expect(requestAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await requestAccountDeletionHandler(request);
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

        const request = createMockRequest({}, { uid: userId });

        await expect(requestAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await requestAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("not-found");
        }
      });
    });

    describe("Already Scheduled", () => {
      it("should reject if deletion is already scheduled", async () => {
        const userId = "already-scheduled-user";
        const mockUser = createMockUser({
          deletionScheduled: true,
        });

        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({}, { uid: userId });

        await expect(requestAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await requestAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("failed-precondition");
          expect((error as HttpsError).message).toBe("既にアカウント削除が予定されています");
        }
      });
    });

    describe("Successful Request", () => {
      it("should schedule deletion successfully", async () => {
        const userId = "test-user";
        const mockUser = createMockUser({
          deletionScheduled: false,
        });

        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({}, { uid: userId });

        const result = (await requestAccountDeletionHandler(request)) as {
          success: boolean;
          data: {
            requestId: string;
            scheduledDeletionDate: string;
            exportRequested: boolean;
            message: string;
          };
        };

        expect(result.success).toBe(true);
        expect(result.data.requestId).toBeDefined();
        expect(result.data.scheduledDeletionDate).toBeDefined();
        expect(result.data.message).toContain("30日後");
      });

      it("should handle optional reason", async () => {
        const userId = "test-user";
        const mockUser = createMockUser({
          deletionScheduled: false,
        });

        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({ reason: "I no longer use this app" }, { uid: userId });

        const result = (await requestAccountDeletionHandler(request)) as { success: boolean };

        expect(result.success).toBe(true);
      });

      it("should handle export data flag", async () => {
        const userId = "test-user";
        const mockUser = createMockUser({
          deletionScheduled: false,
        });

        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({ exportData: true }, { uid: userId });

        const result = (await requestAccountDeletionHandler(request)) as {
          success: boolean;
          data: { exportRequested: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data.exportRequested).toBe(true);
      });
    });

    describe("Input Validation", () => {
      it("should reject reason over 500 characters", async () => {
        const userId = "test-user";
        const mockUser = createMockUser({
          deletionScheduled: false,
        });

        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({ reason: "a".repeat(501) }, { uid: userId });

        await expect(requestAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await requestAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("invalid-argument");
        }
      });
    });
  });

  describe("cancelAccountDeletion", () => {
    describe("Authentication", () => {
      it("should throw unauthenticated error when no auth context", async () => {
        const request = createMockRequest({}, null);

        await expect(cancelAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await cancelAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("unauthenticated");
          expect((error as HttpsError).message).toBe("認証が必要です");
        }
      });
    });

    describe("User Not Found", () => {
      it("should throw not-found error when user does not exist", async () => {
        const userId = "non-existent-user-cancel";

        // Clear previous mocks and set up for this test
        mockGet.mockReset();
        mockGet.mockResolvedValue({
          exists: false,
          id: userId,
          data: () => null,
        });

        const request = createMockRequest({}, { uid: userId });

        await expect(cancelAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await cancelAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("not-found");
        }
      });
    });

    describe("Not Scheduled", () => {
      it("should reject if deletion is not scheduled", async () => {
        const userId = "not-scheduled-user";
        const mockUser = createMockUser({
          deletionScheduled: false,
        });

        // Clear previous mocks and set up for this test
        mockGet.mockReset();
        mockGet.mockResolvedValue({
          exists: true,
          id: userId,
          data: () => mockUser,
        });

        const request = createMockRequest({}, { uid: userId });

        await expect(cancelAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await cancelAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("failed-precondition");
          expect((error as HttpsError).message).toBe("アカウント削除が予定されていません");
        }
      });
    });

    describe("Successful Cancellation", () => {
      it("should cancel deletion successfully", async () => {
        const userId = "scheduled-user";
        const mockUser = createMockUser({
          deletionScheduled: true,
        });

        // Clear and set up mocks
        mockGet.mockReset();
        // First call: get user document
        mockGet.mockResolvedValueOnce({
          exists: true,
          id: userId,
          data: () => mockUser,
        });
        // Second call: query for deletion request
        mockGet.mockResolvedValueOnce(
          createMockQuerySnapshot([{ id: "deletion-request-1", data: { userId, status: "pending" } }]),
        );

        const request = createMockRequest({}, { uid: userId });

        const result = (await cancelAccountDeletionHandler(request)) as {
          success: boolean;
          data: {
            requestId: string;
            status: string;
            message: string;
          };
        };

        expect(result.success).toBe(true);
        expect(result.data.status).toBe("cancelled");
        expect(result.data.message).toContain("キャンセル");
      });

      it("should handle case when no deletion request document exists", async () => {
        const userId = "scheduled-user-no-doc";
        const mockUser = createMockUser({
          deletionScheduled: true,
        });

        // Clear and set up mocks
        mockGet.mockReset();
        // First call: get user document
        mockGet.mockResolvedValueOnce({
          exists: true,
          id: userId,
          data: () => mockUser,
        });
        // Second call: empty query result
        mockGet.mockResolvedValueOnce(createMockQuerySnapshot([]));

        const request = createMockRequest({}, { uid: userId });

        const result = (await cancelAccountDeletionHandler(request)) as {
          success: boolean;
          data: { requestId: string };
        };

        expect(result.success).toBe(true);
        expect(result.data.requestId).toBe("unknown");
      });
    });

    describe("Error Handling", () => {
      it("should handle Firestore errors gracefully", async () => {
        const userId = "error-user";

        mockGet.mockRejectedValue(new Error("Firestore connection error"));

        const request = createMockRequest({}, { uid: userId });

        await expect(cancelAccountDeletionHandler(request)).rejects.toThrow();
        try {
          await cancelAccountDeletionHandler(request);
        } catch (error) {
          expect((error as HttpsError).code).toBe("internal");
        }
      });
    });
  });
});
