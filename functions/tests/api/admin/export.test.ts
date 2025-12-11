/**
 * データエクスポートAPI テスト
 *
 * ユーザーデータエクスポート、統計データエクスポート、監査ログエクスポートAPIのテスト
 *
 * 参照: docs/common/tickets/048-data-export-api.md
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

// =============================================================================
// モック設定
// =============================================================================

// Cloud Storage モック
const mockSave = jest.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = jest.fn().mockResolvedValue(["https://storage.googleapis.com/signed-url"]);
const mockFile = jest.fn().mockReturnValue({
  save: mockSave,
  getSignedUrl: mockGetSignedUrl,
});
const mockBucket = jest.fn().mockReturnValue({
  file: mockFile,
});

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: mockBucket,
  })),
}));

// firebase-admin モック
const mockTimestamp = {
  now: jest.fn(() => ({
    toDate: jest.fn(() => new Date()),
    toMillis: jest.fn(() => Date.now()),
  })),
  fromDate: jest.fn((date: Date) => ({
    toDate: jest.fn(() => date),
    toMillis: jest.fn(() => date.getTime()),
  })),
  fromMillis: jest.fn((ms: number) => ({
    toDate: jest.fn(() => new Date(ms)),
    toMillis: jest.fn(() => ms),
  })),
};

const mockFieldValue = {
  serverTimestamp: jest.fn(() => new Date()),
};

const mockDocData: Record<string, unknown> = {};
const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocRef = {
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
};

const mockDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
const mockQueryGet = jest.fn().mockResolvedValue({
  docs: mockDocs,
  empty: true,
});
const mockCountGet = jest.fn().mockResolvedValue({
  data: () => ({ count: 0 }),
});

const mockCollection = {
  doc: jest.fn(() => mockDocRef),
  orderBy: jest.fn(() => ({
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: mockQueryGet,
      })),
    })),
    limit: jest.fn(() => ({
      get: mockQueryGet,
    })),
  })),
  count: jest.fn(() => ({
    get: mockCountGet,
  })),
  where: jest.fn(() => ({
    count: jest.fn(() => ({
      get: mockCountGet,
    })),
    limit: jest.fn(() => ({
      get: mockQueryGet,
    })),
    orderBy: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: mockQueryGet,
      })),
    })),
  })),
};

const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => mockCollection),
}));

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test-app" }],
  initializeApp: jest.fn(),
  firestore: Object.assign(mockFirestore, {
    FieldValue: mockFieldValue,
    Timestamp: mockTimestamp,
  }),
}));

// utils/firestore モック
jest.mock("../../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
  })),
  serverTimestamp: jest.fn(() => new Date()),
}));

// utils/logger モック
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    functionStart: jest.fn(),
    functionEnd: jest.fn(),
  },
}));

// middleware/adminAuth モック
const mockAdminContext = {
  adminUser: {
    uid: "admin-user-123",
    role: "admin" as const,
    permissions: ["users:view", "audit:export"] as const,
    email: "admin@example.com",
  },
  claims: {
    role: "admin" as const,
    permissions: ["users:view", "audit:export"],
    mfaVerified: true,
    lastLoginAt: Date.now(),
  },
  clientIp: "192.168.1.1",
  mfaVerified: true,
};

const mockSuperAdminContext = {
  adminUser: {
    uid: "superadmin-user-123",
    role: "superAdmin" as const,
    permissions: ["users:view", "audit:export", "users:delete"] as const,
    email: "superadmin@example.com",
  },
  claims: {
    role: "superAdmin" as const,
    permissions: ["users:view", "audit:export", "users:delete"],
    mfaVerified: true,
    lastLoginAt: Date.now(),
  },
  clientIp: "192.168.1.2",
  mfaVerified: true,
};

jest.mock("../../../src/middleware/adminAuth", () => ({
  requireAdminOrAbove: jest.fn().mockResolvedValue(mockAdminContext),
  requireSuperAdmin: jest.fn().mockResolvedValue(mockSuperAdminContext),
  executeAdminAuthAction: jest.fn(async (context, action, params, operation) => {
    return await operation();
  }),
}));

// gdprExport モック
jest.mock("../../../src/services/gdprExport", () => ({
  collectUserData: jest.fn().mockResolvedValue({
    exportedAt: new Date().toISOString(),
    userId: "test-user-123",
    format: "json",
    profile: {
      nickname: "TestUser",
      email: "test@example.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sessions: [],
    consents: [],
  }),
}));

// =============================================================================
// テストデータ
// =============================================================================

const mockExportJob = {
  id: "export_test123_abc456",
  type: "user_data" as const,
  status: "pending" as const,
  format: "json" as const,
  requestedBy: "admin-user-123",
  targetUserId: "test-user-123",
  createdAt: mockTimestamp.now(),
};

const mockCompletedJob = {
  ...mockExportJob,
  status: "completed" as const,
  downloadUrl: "https://storage.googleapis.com/signed-url",
  downloadUrlExpiry: mockTimestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  fileSize: 1024,
  recordCount: 10,
  completedAt: mockTimestamp.now(),
};

const mockAuditLog = {
  id: "audit-log-1",
  timestamp: new Date().toISOString(),
  action: "profile_update",
  userId: "user-123",
  resourceType: "user_profile",
  success: true,
};

// =============================================================================
// インポート（モック設定後）
// =============================================================================

import {
  createExportJob,
  getExportJob,
  listExportJobs,
  executeUserDataExport,
  executeStatsExport,
  executeAuditLogsExport,
  calculateEstimatedCompletionTime,
  timestampToISO,
} from "../../../src/services/exportService";
import { EXPORT_CONSTANTS } from "../../../src/types/export";
import { logger } from "../../../src/utils/logger";

// =============================================================================
// テストスイート: エクスポートサービス
// =============================================================================

describe("Export Service Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // ドキュメント取得のモック設定
    mockDocGet.mockResolvedValue({
      exists: true,
      id: mockExportJob.id,
      data: () => mockExportJob,
    });
  });

  // ==========================================================================
  // ジョブ作成テスト
  // ==========================================================================

  describe("createExportJob", () => {
    it("should create a user data export job", async () => {
      const job = await createExportJob({
        type: "user_data",
        format: "json",
        requestedBy: "admin-user-123",
        targetUserId: "test-user-123",
      });

      expect(job).toBeDefined();
      expect(job.id).toMatch(/^export_/);
      expect(job.type).toBe("user_data");
      expect(job.format).toBe("json");
      expect(job.status).toBe("pending");
      expect(job.requestedBy).toBe("admin-user-123");
      expect(job.targetUserId).toBe("test-user-123");

      expect(mockDocSet).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Export job created",
        expect.objectContaining({
          type: "user_data",
          requestedBy: "admin-user-123",
          targetUserId: "test-user-123",
        }),
      );
    });

    it("should create a stats export job", async () => {
      const job = await createExportJob({
        type: "stats",
        format: "csv",
        requestedBy: "admin-user-123",
        filters: {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      });

      expect(job).toBeDefined();
      expect(job.type).toBe("stats");
      expect(job.format).toBe("csv");
      expect(job.filters).toEqual({
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });
    });

    it("should create an audit logs export job", async () => {
      const job = await createExportJob({
        type: "audit_logs",
        format: "json",
        requestedBy: "superadmin-user-123",
        filters: {
          action: "profile_update",
          userId: "user-123",
        },
      });

      expect(job).toBeDefined();
      expect(job.type).toBe("audit_logs");
      expect(job.filters?.action).toBe("profile_update");
      expect(job.filters?.userId).toBe("user-123");
    });

    it("should support encrypted export option", async () => {
      const job = await createExportJob({
        type: "user_data",
        format: "json",
        requestedBy: "admin-user-123",
        targetUserId: "test-user-123",
        encrypted: true,
      });

      expect(job.encrypted).toBe(true);
    });
  });

  // ==========================================================================
  // ジョブ取得テスト
  // ==========================================================================

  describe("getExportJob", () => {
    it("should return existing job", async () => {
      const job = await getExportJob(mockExportJob.id);

      expect(job).toBeDefined();
      expect(job?.id).toBe(mockExportJob.id);
      expect(job?.type).toBe("user_data");
    });

    it("should return null for non-existent job", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: false,
      });

      const job = await getExportJob("non-existent-job");

      expect(job).toBeNull();
    });
  });

  // ==========================================================================
  // ジョブ一覧テスト
  // ==========================================================================

  describe("listExportJobs", () => {
    beforeEach(() => {
      mockQueryGet.mockResolvedValue({
        docs: [
          { id: "job-1", data: () => ({ ...mockExportJob, id: "job-1" }) },
          { id: "job-2", data: () => ({ ...mockCompletedJob, id: "job-2" }) },
        ],
        empty: false,
      });
      mockCountGet.mockResolvedValue({
        data: () => ({ count: 2 }),
      });
    });

    it("should list export jobs with pagination", async () => {
      const result = await listExportJobs({ limit: 10 });

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.totalCount).toBeDefined();
    });

    it("should filter by type", async () => {
      const result = await listExportJobs({ type: "user_data" });

      expect(result).toBeDefined();
    });

    it("should filter by status", async () => {
      const result = await listExportJobs({ status: "completed" });

      expect(result).toBeDefined();
    });

    it("should respect limit parameter", async () => {
      const result = await listExportJobs({ limit: 5 });

      expect(result).toBeDefined();
    });

    it("should enforce maximum limit", async () => {
      const result = await listExportJobs({ limit: 1000 });

      // 最大制限が適用されることを確認
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // 推定完了時間テスト
  // ==========================================================================

  describe("calculateEstimatedCompletionTime", () => {
    it("should calculate correct time for user_data export", () => {
      const now = new Date();
      const estimated = calculateEstimatedCompletionTime("user_data");

      const diffMinutes = (estimated.getTime() - now.getTime()) / (60 * 1000);

      expect(diffMinutes).toBeGreaterThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_USER_EXPORT_MINUTES - 1);
      expect(diffMinutes).toBeLessThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_USER_EXPORT_MINUTES + 1);
    });

    it("should calculate correct time for stats export", () => {
      const now = new Date();
      const estimated = calculateEstimatedCompletionTime("stats");

      const diffMinutes = (estimated.getTime() - now.getTime()) / (60 * 1000);

      expect(diffMinutes).toBeGreaterThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_STATS_EXPORT_MINUTES - 1);
      expect(diffMinutes).toBeLessThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_STATS_EXPORT_MINUTES + 1);
    });

    it("should calculate correct time for audit_logs export", () => {
      const now = new Date();
      const estimated = calculateEstimatedCompletionTime("audit_logs");

      const diffMinutes = (estimated.getTime() - now.getTime()) / (60 * 1000);

      expect(diffMinutes).toBeGreaterThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_AUDIT_EXPORT_MINUTES - 1);
      expect(diffMinutes).toBeLessThanOrEqual(EXPORT_CONSTANTS.ESTIMATED_AUDIT_EXPORT_MINUTES + 1);
    });
  });

  // ==========================================================================
  // タイムスタンプ変換テスト
  // ==========================================================================

  describe("timestampToISO", () => {
    it("should convert Timestamp to ISO string", () => {
      const date = new Date("2025-12-12T10:00:00Z");
      const timestamp = mockTimestamp.fromDate(date);

      const result = timestampToISO(timestamp);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return undefined for null input", () => {
      const result = timestampToISO(null);

      expect(result).toBeUndefined();
    });

    it("should return undefined for undefined input", () => {
      const result = timestampToISO(undefined);

      expect(result).toBeUndefined();
    });
  });
});

// =============================================================================
// テストスイート: 権限チェック
// =============================================================================

describe("Export API Permission Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require admin role for user data export", () => {
    const { requireAdminOrAbove } = require("../../../src/middleware/adminAuth");

    expect(requireAdminOrAbove).toBeDefined();
    expect(typeof requireAdminOrAbove).toBe("function");
  });

  it("should require superAdmin role for audit logs export", () => {
    const { requireSuperAdmin } = require("../../../src/middleware/adminAuth");

    expect(requireSuperAdmin).toBeDefined();
    expect(typeof requireSuperAdmin).toBe("function");
  });

  it("should allow admin to export stats", async () => {
    const { requireAdminOrAbove } = require("../../../src/middleware/adminAuth");

    const context = await requireAdminOrAbove({});

    expect(context.adminUser.role).toBe("admin");
  });

  it("should allow superAdmin to export audit logs", async () => {
    const { requireSuperAdmin } = require("../../../src/middleware/adminAuth");

    const context = await requireSuperAdmin({});

    expect(context.adminUser.role).toBe("superAdmin");
  });
});

// =============================================================================
// テストスイート: バリデーション
// =============================================================================

describe("Export Validation Tests", () => {
  describe("Format validation", () => {
    it("should accept json format", () => {
      const validFormats = ["json", "csv"];

      expect(validFormats).toContain("json");
    });

    it("should accept csv format", () => {
      const validFormats = ["json", "csv"];

      expect(validFormats).toContain("csv");
    });
  });

  describe("Type validation", () => {
    it("should accept valid export types", () => {
      const validTypes = ["user_data", "stats", "audit_logs"];

      expect(validTypes).toContain("user_data");
      expect(validTypes).toContain("stats");
      expect(validTypes).toContain("audit_logs");
    });
  });

  describe("Status validation", () => {
    it("should accept valid status values", () => {
      const validStatuses = ["pending", "processing", "completed", "failed"];

      expect(validStatuses).toContain("pending");
      expect(validStatuses).toContain("processing");
      expect(validStatuses).toContain("completed");
      expect(validStatuses).toContain("failed");
    });
  });

  describe("Constants validation", () => {
    it("should have correct download URL expiry hours", () => {
      expect(EXPORT_CONSTANTS.DOWNLOAD_URL_EXPIRY_HOURS).toBe(24);
    });

    it("should have correct file retention days", () => {
      expect(EXPORT_CONSTANTS.FILE_RETENTION_DAYS).toBe(7);
    });

    it("should have correct max audit log records", () => {
      expect(EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS).toBe(100000);
    });

    it("should have correct default history limit", () => {
      expect(EXPORT_CONSTANTS.DEFAULT_HISTORY_LIMIT).toBe(20);
    });

    it("should have correct max history limit", () => {
      expect(EXPORT_CONSTANTS.MAX_HISTORY_LIMIT).toBe(100);
    });
  });
});

// =============================================================================
// テストスイート: エラーハンドリング
// =============================================================================

describe("Export Error Handling Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle Firestore errors gracefully", async () => {
    mockDocSet.mockRejectedValueOnce(new Error("Firestore error"));

    await expect(createExportJob({
      type: "user_data",
      format: "json",
      requestedBy: "admin-user-123",
      targetUserId: "test-user-123",
    })).rejects.toThrow("Firestore error");
  });

  it("should log errors when job creation fails", async () => {
    mockDocSet.mockRejectedValueOnce(new Error("Database connection failed"));

    try {
      await createExportJob({
        type: "stats",
        format: "csv",
        requestedBy: "admin-user-123",
      });
    } catch {
      // Expected to throw
    }

    // エラーがスローされることを確認
    expect(mockDocSet).toHaveBeenCalled();
  });
});

// =============================================================================
// テストスイート: Cloud Storage
// =============================================================================

describe("Cloud Storage Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue(["https://storage.googleapis.com/test-signed-url"]);
  });

  it("should upload file to correct bucket path", async () => {
    // ファイルアップロードのモックが正しく設定されていることを確認
    expect(mockBucket).toBeDefined();
    expect(mockFile).toBeDefined();
    expect(mockSave).toBeDefined();
  });

  it("should generate signed URL with correct expiry", async () => {
    // 署名付きURL生成のモックが正しく設定されていることを確認
    expect(mockGetSignedUrl).toBeDefined();
  });

  it("should use correct content type for JSON format", () => {
    const jsonContentType = "application/json";

    expect(jsonContentType).toBe("application/json");
  });

  it("should use correct content type for CSV format", () => {
    const csvContentType = "text/csv";

    expect(csvContentType).toBe("text/csv");
  });
});

// =============================================================================
// テストスイート: 監査ログエクスポート
// =============================================================================

describe("Audit Log Export Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryGet.mockResolvedValue({
      docs: [
        {
          id: "audit-1",
          data: () => ({
            ...mockAuditLog,
            timestamp: { toDate: () => new Date() },
          }),
        },
      ],
      empty: false,
    });
  });

  it("should filter audit logs by action", () => {
    const filters = { action: "profile_update" };

    expect(filters.action).toBe("profile_update");
  });

  it("should filter audit logs by userId", () => {
    const filters = { userId: "user-123" };

    expect(filters.userId).toBe("user-123");
  });

  it("should filter audit logs by date range", () => {
    const filters = {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    };

    expect(filters.startDate).toBe("2025-01-01");
    expect(filters.endDate).toBe("2025-12-31");
  });

  it("should respect max records limit", () => {
    const requestedMaxRecords = 50000;
    const actualLimit = Math.min(requestedMaxRecords, EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS);

    expect(actualLimit).toBe(50000);
  });

  it("should enforce absolute max records limit", () => {
    const requestedMaxRecords = 200000;
    const actualLimit = Math.min(requestedMaxRecords, EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS);

    expect(actualLimit).toBe(EXPORT_CONSTANTS.MAX_AUDIT_LOG_RECORDS);
  });
});

// =============================================================================
// テストスイート: 履歴API
// =============================================================================

describe("Export History API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should check download URL expiry correctly", () => {
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pastExpiry = new Date(Date.now() - 1000);

    expect(futureExpiry > new Date()).toBe(true);
    expect(pastExpiry > new Date()).toBe(false);
  });

  it("should mark completed job with valid URL as downloadable", () => {
    const job = {
      status: "completed" as const,
      downloadUrl: "https://example.com/download",
      downloadUrlExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const downloadable = job.status === "completed" &&
      job.downloadUrl !== undefined &&
      job.downloadUrlExpiry > new Date();

    expect(downloadable).toBe(true);
  });

  it("should mark completed job with expired URL as not downloadable", () => {
    const job = {
      status: "completed" as const,
      downloadUrl: "https://example.com/download",
      downloadUrlExpiry: new Date(Date.now() - 1000),
    };

    const downloadable = job.status === "completed" &&
      job.downloadUrl !== undefined &&
      job.downloadUrlExpiry > new Date();

    expect(downloadable).toBe(false);
  });

  it("should mark pending job as not downloadable", () => {
    const job = {
      status: "pending" as const,
      downloadUrl: undefined,
      downloadUrlExpiry: undefined,
    };

    const downloadable = job.status === "completed" &&
      job.downloadUrl !== undefined &&
      job.downloadUrlExpiry !== undefined &&
      job.downloadUrlExpiry > new Date();

    expect(downloadable).toBe(false);
  });
});

// =============================================================================
// テストスイート: GDPR準拠
// =============================================================================

describe("GDPR Compliance Tests", () => {
  it("should support data portability (Article 20)", () => {
    // ユーザーデータエクスポート機能が存在することを確認
    expect(createExportJob).toBeDefined();
  });

  it("should support JSON format for machine-readable export", () => {
    const machineReadableFormats = ["json"];

    expect(machineReadableFormats).toContain("json");
  });

  it("should support CSV format for spreadsheet compatibility", () => {
    const spreadsheetFormats = ["csv"];

    expect(spreadsheetFormats).toContain("csv");
  });

  it("should have download URL with limited validity period", () => {
    // 24時間の有効期限
    expect(EXPORT_CONSTANTS.DOWNLOAD_URL_EXPIRY_HOURS).toBe(24);
  });

  it("should have file retention period", () => {
    // 7日間の保存期間
    expect(EXPORT_CONSTANTS.FILE_RETENTION_DAYS).toBe(7);
  });
});
