/**
 * セキュリティ設定API Unit Tests
 *
 * チケット050: セキュリティ設定API
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import { mockTimestamp } from "../../mocks/firestore";

// =============================================================================
// モックセットアップ
// =============================================================================

// Mock firestore references
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockAdd = jest.fn();
const mockDelete = jest.fn();

// Document mock
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  id: "test-doc-id",
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
  add: mockAdd,
  where: jest.fn().mockReturnValue(mockQuery),
  orderBy: jest.fn().mockReturnValue(mockQuery),
  limit: jest.fn().mockReturnValue(mockQuery),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  }),
};

// Mock firebase-admin
jest.mock("firebase-admin", () => {
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
    now: jest.fn(() => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => mockCollection),
        doc: jest.fn(() => mockDocRef),
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

// Mock admin utils
jest.mock("../../../src/utils/adminUtils", () => ({
  isValidIpAddress: jest.fn((ip: string) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    const parts = ip.split(".");
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }),
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
          token: auth.token || { admin: true, role: "superAdmin" },
        }
      : null,
    rawRequest: {},
  };
}

function createMockIpAllowlistEntry(overrides: Record<string, unknown> = {}) {
  return {
    ip: "192.168.1.100",
    description: "オフィスIP",
    addedBy: "admin-uid",
    addedAt: mockTimestamp(),
    expiresAt: undefined,
    ...overrides,
  };
}

function createMockIpBlocklistEntry(overrides: Record<string, unknown> = {}) {
  return {
    ip: "10.0.0.1",
    reason: "不正アクセス",
    blockedBy: "admin-uid",
    blockedAt: mockTimestamp(),
    expiresAt: undefined,
    autoBlocked: false,
    ...overrides,
  };
}

function createMockRateLimitConfig(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "default",
    maxRequests: 100,
    windowSeconds: 60,
    enabled: true,
    bypassRoles: ["superAdmin"],
    ...overrides,
  };
}

function createMockAuthPolicy(overrides: Record<string, unknown> = {}) {
  return {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    mfaRequired: false,
    mfaRequiredForAdmin: true,
    sessionTimeoutMinutes: 60,
    adminSessionTimeoutMinutes: 30,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    updatedAt: mockTimestamp(),
    updatedBy: "admin-uid",
    ...overrides,
  };
}

// =============================================================================
// テスト
// =============================================================================

describe("Admin Security Settings API", () => {
  let handlers: Record<string, (request: unknown) => Promise<unknown>>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/admin/securitySettings");
      handlers = {
        getIpAllowlist: module.admin_getIpAllowlist,
        addIpAllowlist: module.admin_addIpAllowlist,
        removeIpAllowlist: module.admin_removeIpAllowlist,
        getIpBlocklist: module.admin_getIpBlocklist,
        addIpBlocklist: module.admin_addIpBlocklist,
        removeIpBlocklist: module.admin_removeIpBlocklist,
        getRateLimits: module.admin_getRateLimits,
        updateRateLimits: module.admin_updateRateLimits,
        getAuthPolicy: module.admin_getAuthPolicy,
        updateAuthPolicy: module.admin_updateAuthPolicy,
        getSecurityChangeHistory: module.admin_getSecurityChangeHistory,
        getSecuritySnapshot: module.admin_getSecuritySnapshot,
      };
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock implementations
    mockRequireAdminFromRequest.mockImplementation(() => {});
    mockRequireAction.mockImplementation(() => {});

    mockGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    mockQuery.get.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });

    mockAdd.mockResolvedValue({ id: "new-doc-id" });
    mockSet.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  // ===========================================================================
  // IP許可リストAPI
  // ===========================================================================

  describe("admin_getIpAllowlist", () => {
    it("should require admin authentication", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {
        throw new HttpsError("permission-denied", "管理者権限が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(handlers.getIpAllowlist(request)).rejects.toThrow(
        "管理者権限が必要です",
      );
    });

    it("should return empty list when not configured", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getIpAllowlist(request)) as {
        success: boolean;
        data: { entries: unknown[]; enabled: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.entries).toHaveLength(0);
      expect(result.data.enabled).toBe(false);
    });

    it("should return configured allowlist", async () => {
      const mockEntries = [
        createMockIpAllowlistEntry({ ip: "192.168.1.1" }),
        createMockIpAllowlistEntry({ ip: "192.168.1.2" }),
      ];

      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          entries: mockEntries,
          enabled: true,
        }),
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getIpAllowlist(request)) as {
        success: boolean;
        data: { entries: unknown[]; enabled: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.enabled).toBe(true);
    });
  });

  describe("admin_addIpAllowlist", () => {
    it("should require valid IP address", async () => {
      const request = createMockRequest(
        { ip: "invalid-ip", description: "Test" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpAllowlist(request)).rejects.toThrow(
        "有効なIPアドレスを指定してください",
      );
    });

    it("should require description", async () => {
      const request = createMockRequest(
        { ip: "192.168.1.1" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpAllowlist(request)).rejects.toThrow(
        "説明は必須です",
      );
    });

    it("should prevent duplicate IPs", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          entries: [createMockIpAllowlistEntry({ ip: "192.168.1.1" })],
          enabled: true,
        }),
      });

      const request = createMockRequest(
        { ip: "192.168.1.1", description: "Duplicate" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpAllowlist(request)).rejects.toThrow(
        "このIPアドレスは既に登録されています",
      );
    });

    it("should add IP to allowlist successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ entries: [], enabled: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            entries: [createMockIpAllowlistEntry({ ip: "192.168.1.100" })],
            enabled: true,
          }),
        });

      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        { ip: "192.168.1.100", description: "新しいIP" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.addIpAllowlist(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("IPアドレスを許可リストに追加しました");
    });
  });

  describe("admin_removeIpAllowlist", () => {
    it("should require IP address", async () => {
      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.removeIpAllowlist(request)).rejects.toThrow(
        "IPアドレスは必須です",
      );
    });

    it("should throw error when IP not found in list", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          entries: [createMockIpAllowlistEntry({ ip: "192.168.1.1" })],
          enabled: true,
        }),
      });

      const request = createMockRequest(
        { ip: "192.168.1.2" },
        { uid: "admin-uid" },
      );

      await expect(handlers.removeIpAllowlist(request)).rejects.toThrow(
        "指定されたIPアドレスは許可リストに存在しません",
      );
    });

    it("should remove IP from allowlist successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          entries: [createMockIpAllowlistEntry({ ip: "192.168.1.1" })],
          enabled: true,
        }),
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { ip: "192.168.1.1", reason: "不要になった" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.removeIpAllowlist(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("IPアドレスを許可リストから削除しました");
    });
  });

  // ===========================================================================
  // IPブロックリストAPI
  // ===========================================================================

  describe("admin_getIpBlocklist", () => {
    it("should return empty list when no blocked IPs", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getIpBlocklist(request)) as {
        success: boolean;
        data: { entries: unknown[] };
      };

      expect(result.success).toBe(true);
      expect(result.data.entries).toHaveLength(0);
    });

    it("should return blocked IPs", async () => {
      const mockEntries = [
        createMockIpBlocklistEntry({ ip: "10.0.0.1" }),
        createMockIpBlocklistEntry({ ip: "10.0.0.2" }),
      ];

      mockQuery.get.mockResolvedValue({
        docs: mockEntries.map((entry) => ({
          id: entry.ip.replace(/\./g, "_"),
          data: () => entry,
        })),
        empty: false,
        size: 2,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getIpBlocklist(request)) as {
        success: boolean;
        data: { entries: unknown[] };
      };

      expect(result.success).toBe(true);
      expect(result.data.entries).toHaveLength(2);
    });
  });

  describe("admin_addIpBlocklist", () => {
    it("should require valid IP address", async () => {
      const request = createMockRequest(
        { ip: "not-an-ip", reason: "Test" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpBlocklist(request)).rejects.toThrow(
        "有効なIPアドレスを指定してください",
      );
    });

    it("should require reason", async () => {
      const request = createMockRequest(
        { ip: "10.0.0.1" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpBlocklist(request)).rejects.toThrow(
        "理由は必須です",
      );
    });

    it("should prevent duplicate blocks", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => createMockIpBlocklistEntry({ ip: "10.0.0.1" }),
      });

      const request = createMockRequest(
        { ip: "10.0.0.1", reason: "重複" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIpBlocklist(request)).rejects.toThrow(
        "このIPアドレスは既にブロックされています",
      );
    });

    it("should add IP to blocklist successfully", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      mockSet.mockResolvedValue({});

      mockQuery.get.mockResolvedValue({
        docs: [
          {
            id: "10_0_0_1",
            data: () => createMockIpBlocklistEntry({ ip: "10.0.0.1" }),
          },
        ],
        empty: false,
        size: 1,
      });

      const request = createMockRequest(
        { ip: "10.0.0.1", reason: "不正アクセス" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.addIpBlocklist(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("IPアドレスをブロックリストに追加しました");
    });
  });

  describe("admin_removeIpBlocklist", () => {
    it("should require IP address", async () => {
      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.removeIpBlocklist(request)).rejects.toThrow(
        "IPアドレスは必須です",
      );
    });

    it("should throw error when IP not in blocklist", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = createMockRequest(
        { ip: "10.0.0.1" },
        { uid: "admin-uid" },
      );

      await expect(handlers.removeIpBlocklist(request)).rejects.toThrow(
        "指定されたIPアドレスはブロックリストに存在しません",
      );
    });

    it("should remove IP from blocklist successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => createMockIpBlocklistEntry({ ip: "10.0.0.1" }),
      });

      mockDelete.mockResolvedValue({});

      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest(
        { ip: "10.0.0.1", reason: "誤ブロック" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.removeIpBlocklist(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("IPアドレスをブロックリストから削除しました");
    });
  });

  // ===========================================================================
  // レート制限設定API
  // ===========================================================================

  describe("admin_getRateLimits", () => {
    it("should return default rate limits when not configured", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getRateLimits(request)) as {
        success: boolean;
        data: { configs: Array<{ endpoint: string }> };
      };

      expect(result.success).toBe(true);
      expect(result.data.configs).toHaveLength(1);
      expect(result.data.configs[0].endpoint).toBe("default");
    });

    it("should return configured rate limits", async () => {
      const mockConfigs = [
        createMockRateLimitConfig({ endpoint: "api/users", maxRequests: 50 }),
        createMockRateLimitConfig({ endpoint: "api/training", maxRequests: 200 }),
      ];

      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ configs: mockConfigs }),
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getRateLimits(request)) as {
        success: boolean;
        data: { configs: unknown[] };
      };

      expect(result.success).toBe(true);
      expect(result.data.configs).toHaveLength(2);
    });
  });

  describe("admin_updateRateLimits", () => {
    it("should require configs array", async () => {
      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.updateRateLimits(request)).rejects.toThrow(
        "configsは配列で指定してください",
      );
    });

    it("should validate each config has endpoint", async () => {
      const request = createMockRequest(
        {
          configs: [{ maxRequests: 100, windowSeconds: 60, enabled: true }],
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateRateLimits(request)).rejects.toThrow(
        "各設定にはendpointが必要です",
      );
    });

    it("should validate maxRequests", async () => {
      const request = createMockRequest(
        {
          configs: [
            { endpoint: "test", maxRequests: 0, windowSeconds: 60, enabled: true },
          ],
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateRateLimits(request)).rejects.toThrow(
        "maxRequestsは1以上の数値で指定してください",
      );
    });

    it("should update rate limits successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ configs: [createMockRateLimitConfig()] }),
      });

      mockSet.mockResolvedValue({});

      const newConfigs = [
        createMockRateLimitConfig({ endpoint: "api/users", maxRequests: 50 }),
      ];

      const request = createMockRequest(
        { configs: newConfigs },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateRateLimits(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("レート制限設定を更新しました");
    });
  });

  // ===========================================================================
  // 認証ポリシーAPI
  // ===========================================================================

  describe("admin_getAuthPolicy", () => {
    it("should return default policy when not configured", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getAuthPolicy(request)) as {
        success: boolean;
        data: { policy: { passwordMinLength: number } };
      };

      expect(result.success).toBe(true);
      expect(result.data.policy.passwordMinLength).toBe(8);
    });

    it("should return configured policy", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => createMockAuthPolicy({ passwordMinLength: 12 }),
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getAuthPolicy(request)) as {
        success: boolean;
        data: { policy: { passwordMinLength: number } };
      };

      expect(result.success).toBe(true);
      expect(result.data.policy.passwordMinLength).toBe(12);
    });
  });

  describe("admin_updateAuthPolicy", () => {
    it("should validate passwordMinLength", async () => {
      const request = createMockRequest(
        { passwordMinLength: 4 },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAuthPolicy(request)).rejects.toThrow(
        "パスワード最小文字数は6以上で指定してください",
      );
    });

    it("should validate sessionTimeoutMinutes", async () => {
      const request = createMockRequest(
        { sessionTimeoutMinutes: 2 },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAuthPolicy(request)).rejects.toThrow(
        "セッションタイムアウトは5分以上で指定してください",
      );
    });

    it("should validate maxLoginAttempts", async () => {
      const request = createMockRequest(
        { maxLoginAttempts: 1 },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAuthPolicy(request)).rejects.toThrow(
        "最大ログイン試行回数は3以上で指定してください",
      );
    });

    it("should update auth policy successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => createMockAuthPolicy(),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => createMockAuthPolicy({ passwordMinLength: 12 }),
        });

      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        { passwordMinLength: 12, mfaRequired: true },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateAuthPolicy(request)) as {
        success: boolean;
        data: { success: boolean; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("認証ポリシーを更新しました");
    });
  });

  // ===========================================================================
  // セキュリティ変更履歴API
  // ===========================================================================

  describe("admin_getSecurityChangeHistory", () => {
    it("should return empty list when no history", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getSecurityChangeHistory(request)) as {
        success: boolean;
        data: { logs: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(0);
    });

    it("should return change history with pagination", async () => {
      const mockLogs = [
        {
          id: "log1",
          changeType: "ip_allowlist",
          action: "create",
          changedBy: "admin-uid",
          changedAt: mockTimestamp(),
        },
        {
          id: "log2",
          changeType: "auth_policy",
          action: "update",
          changedBy: "admin-uid",
          changedAt: mockTimestamp(),
        },
      ];

      mockQuery.get.mockResolvedValue({
        docs: mockLogs.map((log) => ({
          id: log.id,
          data: () => log,
        })),
        empty: false,
        size: 2,
      });

      const request = createMockRequest({ limit: 10 }, { uid: "admin-uid" });

      const result = (await handlers.getSecurityChangeHistory(request)) as {
        success: boolean;
        data: { logs: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.logs.length).toBe(2);
    });
  });

  // ===========================================================================
  // セキュリティスナップショットAPI
  // ===========================================================================

  describe("admin_getSecuritySnapshot", () => {
    it("should return complete security snapshot", async () => {
      // Mock IP allowlist (first doc.get call)
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            entries: [createMockIpAllowlistEntry()],
            enabled: true,
          }),
        })
        // Mock rate limits (third doc.get call, after collection.get)
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ configs: [createMockRateLimitConfig()] }),
        })
        // Mock auth policy (fourth doc.get call)
        .mockResolvedValueOnce({
          exists: true,
          data: () => createMockAuthPolicy(),
        });

      // Mock IP blocklist (collection.get call)
      mockCollection.get = jest.fn().mockResolvedValue({
        docs: [
          {
            id: "10_0_0_1",
            data: () => createMockIpBlocklistEntry(),
          },
        ],
        empty: false,
        size: 1,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getSecuritySnapshot(request)) as {
        success: boolean;
        data: {
          ipAllowlist: { entries: unknown[]; enabled: boolean };
          ipBlocklist: unknown[];
          rateLimits: unknown[];
          authPolicy: { passwordMinLength: number };
          generatedAt: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.ipAllowlist.enabled).toBe(true);
      expect(result.data.generatedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // 権限チェックテスト
  // ===========================================================================

  describe("Permission checks", () => {
    it("should require manage_security permission for all security APIs", async () => {
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "manage_security") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.getIpAllowlist(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );

      await expect(handlers.getIpBlocklist(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );

      await expect(handlers.getRateLimits(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );

      await expect(handlers.getAuthPolicy(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });
  });
});
