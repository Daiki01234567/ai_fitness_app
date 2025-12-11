/**
 * セキュリティ監視API Unit Tests
 *
 * チケット047: セキュリティ監視API
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
const mockSet = jest.fn().mockResolvedValue({});
const mockUpdate = jest.fn().mockResolvedValue({});
const mockDelete = jest.fn().mockResolvedValue({});
const mockAdd = jest.fn().mockResolvedValue({ id: "mock-id" });

// Batch mock
const mockBatch = {
  update: jest.fn().mockReturnThis(),
  commit: jest.fn().mockResolvedValue({}),
};

// Document mock
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  id: "mock-doc-id",
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
  add: mockAdd,
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 10 }) }),
  }),
};

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
    arrayUnion: jest.fn((item) => ({ _arrayUnion: item })),
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
      toMillis: () => Date.now(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => mockCollection),
        batch: jest.fn(() => mockBatch),
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
const mockGetAdminLevel = jest.fn().mockReturnValue("super_admin");

jest.mock("../../../src/middleware/adminAuth", () => ({
  requireAdminFromRequest: mockRequireAdminFromRequest,
  requireAction: mockRequireAction,
  executeAdminAction: mockExecuteAdminAction,
  getAdminLevel: mockGetAdminLevel,
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
          token: auth.token || { admin: true, super_admin: true },
        }
      : null,
    rawRequest: {},
  };
}

function createMockSecurityEvent(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    id: "event-id",
    type: "LOGIN_FAILURE_BURST",
    severity: "medium",
    title: "ログイン失敗の連続検知",
    description: "テストイベント",
    sourceIp: "192.168.1.1",
    status: "new",
    details: {},
    detectedAt: now,
    ...overrides,
  };
}

function createMockAlertRule(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    id: "rule-id",
    name: "テストルール",
    description: "テスト説明",
    enabled: true,
    eventType: "LOGIN_FAILURE_BURST",
    conditions: [{ metric: "count", operator: "gte", threshold: 5, timeWindowMinutes: 5 }],
    severity: "high",
    notifications: [{ type: "email", target: "admin@example.com", enabled: true }],
    cooldownMinutes: 30,
    createdAt: now,
    createdBy: "admin-uid",
    updatedAt: now,
    ...overrides,
  };
}

function createMockIncident(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    id: "incident-id",
    title: "テストインシデント",
    description: "テスト説明",
    severity: "high",
    status: "open",
    category: "UNAUTHORIZED_ACCESS",
    affectedUsers: 0,
    affectedSystems: [],
    relatedEvents: [],
    timeline: [{
      id: "action_1",
      action: "インシデント登録",
      performedBy: "admin-uid",
      performedAt: now,
      notes: "テスト",
    }],
    detectedAt: now,
    createdAt: now,
    createdBy: "admin-uid",
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// テスト
// =============================================================================

describe("Security Monitoring API", () => {
  let handlers: Record<string, (request: unknown) => Promise<unknown>>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/admin/security");
      handlers = {
        getSecurityDashboard: module.admin_getSecurityDashboard,
        listSecurityEvents: module.admin_listSecurityEvents,
        listAlertRules: module.admin_listAlertRules,
        createAlertRule: module.admin_createAlertRule,
        updateAlertRule: module.admin_updateAlertRule,
        deleteAlertRule: module.admin_deleteAlertRule,
        listIncidents: module.admin_listIncidents,
        getIncidentDetail: module.admin_getIncidentDetail,
        createIncident: module.admin_createIncident,
        updateIncident: module.admin_updateIncident,
        addIncidentAction: module.admin_addIncidentAction,
      };
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock implementations
    mockGet.mockResolvedValue({
      exists: true,
      id: "test-id",
      data: () => createMockSecurityEvent(),
    });

    mockQuery.get.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });

    mockRequireAdminFromRequest.mockImplementation(() => {});
    mockRequireAction.mockImplementation(() => {});
    mockGetAdminLevel.mockReturnValue("super_admin");
  });

  // ===========================================================================
  // セキュリティダッシュボードAPI
  // ===========================================================================

  describe("admin_getSecurityDashboard", () => {
    it("should require admin authentication", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {
        throw new HttpsError("permission-denied", "管理者権限が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(handlers.getSecurityDashboard(request)).rejects.toThrow(
        "管理者権限が必要です",
      );
    });

    it("should return dashboard data", async () => {
      // Setup mocks for dashboard queries
      mockCollection.count.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 5 }) }),
      });

      mockQuery.count.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 3 }) }),
      });

      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getSecurityDashboard(request)) as {
        success: boolean;
        data: { summary: { threatLevel: string }; generatedAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.generatedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // セキュリティイベント一覧API
  // ===========================================================================

  describe("admin_listSecurityEvents", () => {
    it("should require admin authentication", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {
        throw new HttpsError("permission-denied", "管理者権限が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(handlers.listSecurityEvents(request)).rejects.toThrow(
        "管理者権限が必要です",
      );
    });

    it("should return empty list when no events exist", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listSecurityEvents(request)) as {
        success: boolean;
        data: { events: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(0);
    });

    it("should apply severity filter", async () => {
      // Reset mockCollection.where to track calls
      const whereCall = jest.fn().mockReturnValue(mockQuery);
      mockCollection.where = whereCall;

      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest(
        { severity: "critical" },
        { uid: "admin-uid" },
      );

      await handlers.listSecurityEvents(request);

      // The first where call should be for severity filter
      expect(whereCall).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // アラートルール管理API
  // ===========================================================================

  describe("admin_listAlertRules", () => {
    it("should return empty list when no rules exist", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listAlertRules(request)) as {
        success: boolean;
        data: { rules: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.rules).toHaveLength(0);
    });

    it("should apply enabled filter", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest(
        { enabled: true },
        { uid: "admin-uid" },
      );

      await handlers.listAlertRules(request);

      // Filter is applied either via collection.where or query.where
      const whereCalledWithEnabled =
        mockCollection.where.mock.calls.some(
          (call: unknown[]) => call[0] === "enabled" && call[1] === "==" && call[2] === true,
        ) ||
        mockQuery.where.mock.calls.some(
          (call: unknown[]) => call[0] === "enabled" && call[1] === "==" && call[2] === true,
        );
      expect(whereCalledWithEnabled).toBe(true);
    });
  });

  describe("admin_createAlertRule", () => {
    it("should require superAdmin permission", async () => {
      mockGetAdminLevel.mockReturnValue("admin");

      const request = createMockRequest(
        {
          name: "テストルール",
          description: "テスト説明",
          eventType: "LOGIN_FAILURE_BURST",
          conditions: [{ metric: "count", operator: "gte", threshold: 5, timeWindowMinutes: 5 }],
          severity: "high",
          notifications: [{ type: "email", target: "admin@example.com", enabled: true }],
          cooldownMinutes: 30,
        },
        { uid: "admin-uid", token: { admin: true } },
      );

      await expect(handlers.createAlertRule(request)).rejects.toThrow(
        "この操作にはsuperAdmin権限が必要です",
      );
    });

    it("should throw error when name is missing", async () => {
      const request = createMockRequest(
        {
          eventType: "LOGIN_FAILURE_BURST",
          conditions: [{ metric: "count", operator: "gte", threshold: 5, timeWindowMinutes: 5 }],
          severity: "high",
          notifications: [{ type: "email", target: "admin@example.com", enabled: true }],
          cooldownMinutes: 30,
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createAlertRule(request)).rejects.toThrow(
        "ルール名は必須です",
      );
    });

    it("should throw error when conditions are empty", async () => {
      const request = createMockRequest(
        {
          name: "テストルール",
          description: "テスト説明",
          eventType: "LOGIN_FAILURE_BURST",
          conditions: [],
          severity: "high",
          notifications: [{ type: "email", target: "admin@example.com", enabled: true }],
          cooldownMinutes: 30,
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createAlertRule(request)).rejects.toThrow(
        "アラート条件を1つ以上設定してください",
      );
    });

    it("should create alert rule successfully", async () => {
      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        {
          name: "テストルール",
          description: "テスト説明",
          eventType: "LOGIN_FAILURE_BURST",
          conditions: [{ metric: "count", operator: "gte", threshold: 5, timeWindowMinutes: 5 }],
          severity: "high",
          notifications: [{ type: "email", target: "admin@example.com", enabled: true }],
          cooldownMinutes: 30,
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.createAlertRule(request)) as {
        success: boolean;
        data: { ruleId: string; createdAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.ruleId).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    });
  });

  describe("admin_updateAlertRule", () => {
    it("should require superAdmin permission", async () => {
      mockGetAdminLevel.mockReturnValue("admin");

      const request = createMockRequest(
        { ruleId: "rule-id", enabled: false },
        { uid: "admin-uid", token: { admin: true } },
      );

      await expect(handlers.updateAlertRule(request)).rejects.toThrow(
        "この操作にはsuperAdmin権限が必要です",
      );
    });

    it("should throw error when ruleId is missing", async () => {
      const request = createMockRequest(
        { enabled: false },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAlertRule(request)).rejects.toThrow(
        "ruleIdは必須です",
      );
    });

    it("should throw not found when rule does not exist", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        id: "non-existent",
        data: () => null,
      });

      const request = createMockRequest(
        { ruleId: "non-existent", enabled: false },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAlertRule(request)).rejects.toThrow();
    });

    it("should update alert rule successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "rule-id",
        data: () => createMockAlertRule(),
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { ruleId: "rule-id", enabled: false },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateAlertRule(request)) as {
        success: boolean;
        data: { ruleId: string; updatedAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.ruleId).toBe("rule-id");
    });
  });

  describe("admin_deleteAlertRule", () => {
    it("should require superAdmin permission", async () => {
      mockGetAdminLevel.mockReturnValue("admin");

      const request = createMockRequest(
        { ruleId: "rule-id" },
        { uid: "admin-uid", token: { admin: true } },
      );

      await expect(handlers.deleteAlertRule(request)).rejects.toThrow(
        "この操作にはsuperAdmin権限が必要です",
      );
    });

    it("should delete alert rule successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "rule-id",
        data: () => createMockAlertRule(),
      });

      mockDelete.mockResolvedValue({});

      const request = createMockRequest(
        { ruleId: "rule-id" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.deleteAlertRule(request)) as {
        success: boolean;
        data: { ruleId: string; deletedAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.ruleId).toBe("rule-id");
    });
  });

  // ===========================================================================
  // インシデント管理API
  // ===========================================================================

  describe("admin_listIncidents", () => {
    it("should return empty list when no incidents exist", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listIncidents(request)) as {
        success: boolean;
        data: { incidents: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.incidents).toHaveLength(0);
    });

    it("should apply status filter", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest(
        { status: "open" },
        { uid: "admin-uid" },
      );

      await handlers.listIncidents(request);

      // Filter is applied either via collection.where or query.where
      const whereCalledWithStatus =
        mockCollection.where.mock.calls.some(
          (call: unknown[]) => call[0] === "status" && call[1] === "==" && call[2] === "open",
        ) ||
        mockQuery.where.mock.calls.some(
          (call: unknown[]) => call[0] === "status" && call[1] === "==" && call[2] === "open",
        );
      expect(whereCalledWithStatus).toBe(true);
    });
  });

  describe("admin_getIncidentDetail", () => {
    it("should throw error when incidentId is missing", async () => {
      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.getIncidentDetail(request)).rejects.toThrow(
        "incidentIdは必須です",
      );
    });

    it("should return incident detail", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "incident-id",
        data: () => createMockIncident(),
      });

      const request = createMockRequest(
        { incidentId: "incident-id" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.getIncidentDetail(request)) as {
        success: boolean;
        data: { incident: { id: string; title: string } };
      };

      expect(result.success).toBe(true);
      expect(result.data.incident.id).toBe("incident-id");
    });
  });

  describe("admin_createIncident", () => {
    it("should throw error when title is missing", async () => {
      const request = createMockRequest(
        {
          description: "テスト説明",
          severity: "high",
          category: "UNAUTHORIZED_ACCESS",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createIncident(request)).rejects.toThrow(
        "タイトルは必須です",
      );
    });

    it("should throw error when severity is missing", async () => {
      const request = createMockRequest(
        {
          title: "テストインシデント",
          description: "テスト説明",
          category: "UNAUTHORIZED_ACCESS",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createIncident(request)).rejects.toThrow(
        "重要度は必須です",
      );
    });

    it("should create incident successfully", async () => {
      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        {
          title: "テストインシデント",
          description: "テスト説明",
          severity: "high",
          category: "UNAUTHORIZED_ACCESS",
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.createIncident(request)) as {
        success: boolean;
        data: { incidentId: string; createdAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.incidentId).toBeDefined();
    });
  });

  describe("admin_updateIncident", () => {
    it("should throw error when incidentId is missing", async () => {
      const request = createMockRequest(
        { status: "investigating" },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateIncident(request)).rejects.toThrow(
        "incidentIdは必須です",
      );
    });

    it("should update incident successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "incident-id",
        data: () => createMockIncident(),
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { incidentId: "incident-id", status: "investigating" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateIncident(request)) as {
        success: boolean;
        data: { incidentId: string; updatedAt: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.incidentId).toBe("incident-id");
    });
  });

  describe("admin_addIncidentAction", () => {
    it("should throw error when incidentId is missing", async () => {
      const request = createMockRequest(
        { action: "対応実施", notes: "テスト" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIncidentAction(request)).rejects.toThrow(
        "incidentIdは必須です",
      );
    });

    it("should throw error when action is missing", async () => {
      const request = createMockRequest(
        { incidentId: "incident-id", notes: "テスト" },
        { uid: "admin-uid" },
      );

      await expect(handlers.addIncidentAction(request)).rejects.toThrow(
        "アクション内容は必須です",
      );
    });

    it("should add incident action successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "incident-id",
        data: () => createMockIncident(),
      });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { incidentId: "incident-id", action: "対応実施", notes: "テスト対応" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.addIncidentAction(request)) as {
        success: boolean;
        data: { incidentId: string; actionId: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.incidentId).toBe("incident-id");
      expect(result.data.actionId).toBeDefined();
    });
  });

  // ===========================================================================
  // 権限チェックテスト
  // ===========================================================================

  describe("Permission checks", () => {
    it("should require view_audit_logs permission for dashboard", async () => {
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "view_audit_logs") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.getSecurityDashboard(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });

    it("should require view_audit_logs permission for listing events", async () => {
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "view_audit_logs") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.listSecurityEvents(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });

    it("should require superAdmin for creating alert rules", async () => {
      mockGetAdminLevel.mockReturnValue("admin");

      const request = createMockRequest(
        {
          name: "テスト",
          eventType: "LOGIN_FAILURE_BURST",
          conditions: [{ metric: "count", operator: "gte", threshold: 5, timeWindowMinutes: 5 }],
          severity: "high",
          notifications: [{ type: "email", target: "test@example.com", enabled: true }],
          cooldownMinutes: 30,
        },
        { uid: "admin-uid", token: { admin: true } },
      );

      await expect(handlers.createAlertRule(request)).rejects.toThrow(
        "この操作にはsuperAdmin権限が必要です",
      );
    });
  });
});
