/**
 * 管理者ユーザー管理API Unit Tests
 *
 * チケット042: ユーザー管理API
 * チケット043: ユーザー検索API
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import { mockTimestamp } from "../../mocks/firestore";

// =============================================================================
// モックセットアップ
// =============================================================================

// Mock firestore references
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockSessionCount = jest.fn().mockResolvedValue({ data: () => ({ count: 5 }) });

// Subcollection mock
const mockSubCollection = {
  count: jest.fn().mockReturnValue({
    get: mockSessionCount,
  }),
};

// Document mock
const mockDocRef = {
  get: mockGet,
  update: mockUpdate,
  collection: jest.fn().mockReturnValue(mockSubCollection),
};

// Query mock
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  }),
};

// Collection mock
const mockCollection = {
  doc: jest.fn().mockReturnValue(mockDocRef),
  where: jest.fn().mockReturnValue(mockQuery),
  orderBy: jest.fn().mockReturnValue(mockQuery),
  limit: jest.fn().mockReturnValue(mockQuery),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 10 }) }),
  }),
};

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockAuth = {
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn().mockResolvedValue({}),
    revokeRefreshTokens: jest.fn().mockResolvedValue({}),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => ({ _isFieldValue: true, type: "delete" })),
  };

  const mockTimestampFn = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => mockCollection),
      })),
      {
        FieldValue: mockFieldValue,
        Timestamp: mockTimestampFn,
      },
    ),
  };
});

// Mock admin auth middleware
const mockRequireAdminFromRequest = jest.fn();
const mockRequireAction = jest.fn();
const mockExecuteAdminAction = jest.fn(
  <T>(_params: unknown, operation: () => Promise<T>) => operation(),
);

jest.mock("../../../src/middleware/adminAuth", () => ({
  requireAdminFromRequest: mockRequireAdminFromRequest,
  requireAction: mockRequireAction,
  executeAdminAction: mockExecuteAdminAction,
}));

// Mock CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireCsrfProtection: jest.fn(),
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

// Mock custom errors
jest.mock("../../../src/utils/errors", () => ({
  NotFoundError: class NotFoundError extends Error {
    code = "not-found";
    constructor(resource: string, id?: string) {
      super(
        id ? `${resource}(${id})が見つかりません` : `${resource}が見つかりません`,
      );
      this.name = "NotFoundError";
    }
  },
  ValidationError: class ValidationError extends Error {
    code = "invalid-argument";
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

// =============================================================================
// ヘルパー関数
// =============================================================================

function createMockRequest(
  data: unknown,
  auth: { uid: string; token?: Record<string, unknown> } | null,
) {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: auth.token || { admin: true },
        }
      : null,
    rawRequest: {},
  };
}

function createMockUserData(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    email: "test@example.com",
    displayName: "Test User",
    nickname: "TestNick",
    tosAccepted: true,
    ppAccepted: true,
    suspended: false,
    deletionScheduled: false,
    subscriptionStatus: "free",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    ...overrides,
  };
}

// =============================================================================
// テスト
// =============================================================================

describe("Admin Users API", () => {
  let handlers: Record<string, (request: unknown) => Promise<unknown>>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/admin/users");
      handlers = {
        listUsers: module.admin_listUsers,
        getUserDetail: module.admin_getUserDetail,
        suspendUser: module.admin_suspendUser,
        restoreUser: module.admin_restoreUser,
        searchUsersByEmail: module.admin_searchUsersByEmail,
        searchUsersByUid: module.admin_searchUsersByUid,
        searchUsersByName: module.admin_searchUsersByName,
        searchUsers: module.admin_searchUsers,
      };
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock implementations
    mockGet.mockResolvedValue({
      exists: true,
      id: "test-user-id",
      data: () => createMockUserData(),
    });

    mockSessionCount.mockResolvedValue({ data: () => ({ count: 5 }) });

    mockQuery.get.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });

    // Setup auth mocks
    const admin = require("firebase-admin");
    (admin.auth().getUser as jest.Mock).mockResolvedValue({
      emailVerified: true,
      providerData: [{ providerId: "password" }],
      disabled: false,
    });
    (admin.auth().getUserByEmail as jest.Mock).mockResolvedValue(null);
  });

  // ===========================================================================
  // チケット042: ユーザー管理API
  // ===========================================================================

  describe("admin_listUsers", () => {
    it("should require admin authentication", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {
        throw new HttpsError("permission-denied", "管理者権限が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(handlers.listUsers(request)).rejects.toThrow(
        "管理者権限が必要です",
      );
    });

    it("should return empty list when no users exist", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listUsers(request)) as {
        success: boolean;
        data: { users: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.users).toHaveLength(0);
    });

    it("should validate limit parameter", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      // Test max limit
      const request = createMockRequest({ limit: 200 }, { uid: "admin-uid" });

      const result = (await handlers.listUsers(request)) as {
        success: boolean;
        data: { limit: number };
      };

      expect(result.data.limit).toBeLessThanOrEqual(100);
    });
  });

  describe("admin_getUserDetail", () => {
    it("should return user detail", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({
        birthYear: 1990,
        gender: "male",
        height: 175,
        weight: 70,
        fitnessLevel: "intermediate",
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      const request = createMockRequest(
        { userId: "target-user" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.getUserDetail(request)) as {
        success: boolean;
        data: { user: { userId: string; email: string } };
      };

      expect(result.success).toBe(true);
      expect(result.data.user).toBeDefined();
      expect(result.data.user.userId).toBe("target-user");
    });

    it("should throw error when userId is missing", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.getUserDetail(request)).rejects.toThrow(
        "userIdは必須です",
      );
    });

    it("should throw not found when user does not exist", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      mockGet.mockResolvedValue({
        exists: false,
        id: "non-existent",
        data: () => null,
      });

      const request = createMockRequest(
        { userId: "non-existent" },
        { uid: "admin-uid" },
      );

      await expect(handlers.getUserDetail(request)).rejects.toThrow();
    });
  });

  describe("admin_suspendUser", () => {
    it("should suspend user successfully", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({ suspended: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { userId: "target-user", reason: "違反行為のため" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.suspendUser(request)) as {
        success: boolean;
        data: { userId: string; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.userId).toBe("target-user");
      expect(result.data.message).toBe("ユーザーを停止しました");
    });

    it("should throw error when reason is missing", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest(
        { userId: "target-user" },
        { uid: "admin-uid" },
      );

      await expect(handlers.suspendUser(request)).rejects.toThrow(
        "停止理由は必須です",
      );
    });

    it("should throw error when user is already suspended", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({ suspended: true });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      const request = createMockRequest(
        { userId: "target-user", reason: "テスト" },
        { uid: "admin-uid" },
      );

      await expect(handlers.suspendUser(request)).rejects.toThrow(
        "このユーザーは既に停止されています",
      );
    });
  });

  describe("admin_restoreUser", () => {
    it("should restore user successfully", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({ suspended: true });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { userId: "target-user", reason: "誤停止のため" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.restoreUser(request)) as {
        success: boolean;
        data: { userId: string; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.userId).toBe("target-user");
      expect(result.data.message).toBe("ユーザーを復帰しました");
    });

    it("should throw error when user is not suspended", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({ suspended: false });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      const request = createMockRequest(
        { userId: "target-user", reason: "テスト" },
        { uid: "admin-uid" },
      );

      await expect(handlers.restoreUser(request)).rejects.toThrow(
        "このユーザーは停止されていません",
      );
    });
  });

  // ===========================================================================
  // チケット043: ユーザー検索API
  // ===========================================================================

  describe("admin_searchUsersByEmail", () => {
    it("should return success response with exact match query", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest(
        { email: "test@example.com", exactMatch: true },
        { uid: "admin-uid" },
      );

      const result = (await handlers.searchUsersByEmail(request)) as {
        success: boolean;
        data: { query: { exactMatch: boolean; email: string } };
      };

      // Test that exact match flag is correctly passed through
      expect(result.success).toBe(true);
      expect(result.data.query.exactMatch).toBe(true);
      expect(result.data.query.email).toBe("test@example.com");
    });

    it("should throw error when email is missing", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.searchUsersByEmail(request)).rejects.toThrow(
        "emailは必須です",
      );
    });
  });

  describe("admin_searchUsersByUid", () => {
    it("should find user by UID", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => createMockUserData(),
      });

      const request = createMockRequest(
        { userId: "target-user" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.searchUsersByUid(request)) as {
        success: boolean;
        data: { users: Array<{ userId: string }>; resultCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.resultCount).toBe(1);
      expect(result.data.users[0].userId).toBe("target-user");
    });

    it("should return empty when UID not found", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      mockGet.mockResolvedValue({
        exists: false,
        id: "non-existent",
        data: () => null,
      });

      const request = createMockRequest(
        { userId: "non-existent" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.searchUsersByUid(request)) as {
        success: boolean;
        data: { users: unknown[]; resultCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.resultCount).toBe(0);
    });
  });

  describe("admin_searchUsersByName", () => {
    it("should throw error when displayName is missing", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.searchUsersByName(request)).rejects.toThrow(
        "displayNameは必須です",
      );
    });
  });

  describe("admin_searchUsers (complex search)", () => {
    it("should search with userId criteria", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const mockUserData = createMockUserData({
        email: "test@example.com",
        displayName: "Test User",
      });

      mockGet.mockResolvedValue({
        exists: true,
        id: "target-user",
        data: () => mockUserData,
      });

      const request = createMockRequest(
        { userId: "target-user" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.searchUsers(request)) as {
        success: boolean;
        data: { users: Array<{ userId: string }>; resultCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.resultCount).toBeGreaterThanOrEqual(0);
    });

    it("should throw error when no search criteria provided", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation(() => {});

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.searchUsers(request)).rejects.toThrow(
        "検索条件（email、userId、displayName）のいずれかを指定してください",
      );
    });
  });

  // ===========================================================================
  // 権限チェックテスト
  // ===========================================================================

  describe("Permission checks", () => {
    it("should require view_user_data permission for listing users", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "view_user_data") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.listUsers(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });

    it("should require suspend_user permission for suspending", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "suspend_user") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest(
        { userId: "target", reason: "test" },
        { uid: "admin-uid" },
      );

      await expect(handlers.suspendUser(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });

    it("should require restore_user permission for restoring", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {});
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "restore_user") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest(
        { userId: "target", reason: "test" },
        { uid: "admin-uid" },
      );

      await expect(handlers.restoreUser(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });
  });
});
