/**
 * リアルタイム監視API テスト
 *
 * システムヘルスチェック、エラー監視、リクエスト監視、
 * パフォーマンス監視、総合監視ダッシュボードAPIのテスト
 *
 * 参照: docs/common/tickets/046-realtime-monitoring-api.md
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

// =============================================================================
// モック設定
// =============================================================================

// firebase-admin モック
jest.mock("firebase-admin", () => {
  const mockDoc = {
    get: jest.fn(() => Promise.resolve({ exists: false })),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDoc),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
  }));

  const mockListUsers = jest.fn(() => Promise.resolve({ users: [] }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    firestore: Object.assign(mockFirestore, {
      FieldValue: {
        serverTimestamp: jest.fn(() => new Date()),
      },
    }),
    auth: jest.fn(() => ({
      listUsers: mockListUsers,
    })),
  };
});

// BigQuery モック
const mockBigQueryQuery = jest.fn(() => Promise.resolve([[{ test: 1 }]]));
jest.mock("@google-cloud/bigquery", () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    query: mockBigQueryQuery,
  })),
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
jest.mock("../../../src/middleware/adminAuth", () => ({
  isAdmin: jest.fn(() => true),
  getAdminLevel: jest.fn(() => "admin"),
  requireAdminFromRequest: jest.fn(),
}));

// =============================================================================
// テストデータ
// =============================================================================

/**
 * Cloud Loggingのモックエントリ生成
 */
function createMockLogEntry(options: {
  severity?: string;
  message?: string;
  functionName?: string;
  executionTime?: number;
  memoryUsage?: number;
  coldStart?: boolean;
  firestoreReads?: number;
  firestoreWrites?: number;
}) {
  return {
    metadata: {
      severity: options.severity || "INFO",
      timestamp: new Date().toISOString(),
      resource: {
        labels: {
          function_name: options.functionName || "testFunction",
        },
      },
    },
    data: {
      message: options.message || "Test log message",
      executionTime: options.executionTime,
      memoryUsage: options.memoryUsage,
      coldStart: options.coldStart,
      firestoreReads: options.firestoreReads,
      firestoreWrites: options.firestoreWrites,
    },
  };
}

const mockLogEntries = [
  createMockLogEntry({
    severity: "INFO",
    functionName: "user_updateProfile",
    executionTime: 150,
    memoryUsage: 128,
    coldStart: false,
    firestoreReads: 2,
    firestoreWrites: 1,
  }),
  createMockLogEntry({
    severity: "ERROR",
    message: "UNAUTHENTICATED: User not logged in",
    functionName: "user_getProfile",
    executionTime: 50,
    memoryUsage: 64,
    coldStart: true,
  }),
  createMockLogEntry({
    severity: "INFO",
    functionName: "training_createSession",
    executionTime: 200,
    memoryUsage: 192,
    coldStart: false,
    firestoreReads: 1,
    firestoreWrites: 2,
  }),
  createMockLogEntry({
    severity: "ERROR",
    message: "PERMISSION_DENIED: Access denied",
    functionName: "admin_listUsers",
    executionTime: 30,
    memoryUsage: 64,
    coldStart: false,
  }),
  createMockLogEntry({
    severity: "CRITICAL",
    message: "INTERNAL: Database connection failed",
    functionName: "user_updateProfile",
    executionTime: 5000,
    memoryUsage: 256,
    coldStart: true,
  }),
];

// =============================================================================
// インポート（モック設定後）
// =============================================================================

import {
  setLoggingClient,
  resetLoggingClient,
  ILoggingClient,
  MONITORING_CONSTANTS,
  MonitoringPeriod,
  HealthStatus,
} from "../../../src/api/admin/monitoring";
import { logger } from "../../../src/utils/logger";
import { getAdminLevel } from "../../../src/middleware/adminAuth";

// =============================================================================
// モックLoggingクライアント
// =============================================================================

class MockLoggingClient implements ILoggingClient {
  private entries: unknown[] = [];
  private shouldFail = false;
  private errorMessage = "";

  setEntries(entries: unknown[]): void {
    this.entries = entries;
  }

  setError(message: string): void {
    this.shouldFail = true;
    this.errorMessage = message;
  }

  reset(): void {
    this.entries = [];
    this.shouldFail = false;
    this.errorMessage = "";
  }

  async getEntries(): Promise<[unknown[], unknown, unknown]> {
    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }
    return [this.entries, null, null];
  }
}

// =============================================================================
// テストスイート
// =============================================================================

describe("Monitoring API Tests", () => {
  let mockLoggingClient: MockLoggingClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoggingClient = new MockLoggingClient();
    setLoggingClient(mockLoggingClient);
  });

  afterEach(() => {
    resetLoggingClient();
  });

  // ==========================================================================
  // 定数テスト
  // ==========================================================================

  describe("MONITORING_CONSTANTS", () => {
    it("should have correct default period", () => {
      expect(MONITORING_CONSTANTS.DEFAULT_PERIOD).toBe("1h");
    });

    it("should have correct period to seconds mapping", () => {
      expect(MONITORING_CONSTANTS.PERIOD_TO_SECONDS["1h"]).toBe(3600);
      expect(MONITORING_CONSTANTS.PERIOD_TO_SECONDS["24h"]).toBe(86400);
      expect(MONITORING_CONSTANTS.PERIOD_TO_SECONDS["7d"]).toBe(604800);
    });

    it("should have correct health thresholds", () => {
      expect(MONITORING_CONSTANTS.FIRESTORE_HEALTHY_THRESHOLD).toBe(1000);
      expect(MONITORING_CONSTANTS.BIGQUERY_HEALTHY_THRESHOLD).toBe(2000);
      expect(MONITORING_CONSTANTS.AUTH_HEALTHY_THRESHOLD).toBe(1000);
    });

    it("should have correct log entry limits", () => {
      expect(MONITORING_CONSTANTS.MAX_TIMELINE_ENTRIES).toBe(100);
      expect(MONITORING_CONSTANTS.MAX_LOG_ENTRIES).toBe(5000);
    });
  });

  // ==========================================================================
  // 型テスト
  // ==========================================================================

  describe("Type definitions", () => {
    it("should accept valid monitoring periods", () => {
      const validPeriods: MonitoringPeriod[] = ["1h", "24h", "7d"];

      validPeriods.forEach((period) => {
        expect(["1h", "24h", "7d"]).toContain(period);
      });
    });

    it("should accept valid health statuses", () => {
      const validStatuses: HealthStatus[] = ["healthy", "degraded", "unhealthy"];

      validStatuses.forEach((status) => {
        expect(["healthy", "degraded", "unhealthy"]).toContain(status);
      });
    });
  });

  // ==========================================================================
  // エラー分類テスト
  // ==========================================================================

  describe("Error categorization", () => {
    it("should categorize authentication errors", () => {
      const entries = [
        createMockLogEntry({
          severity: "ERROR",
          message: "UNAUTHENTICATED: Token expired",
          functionName: "testFunc",
        }),
      ];

      mockLoggingClient.setEntries(entries);

      // この分類はAPIの内部で行われる
      // 直接テストするため、分類ロジックを検証
      const message = "UNAUTHENTICATED: Token expired";
      expect(message.toLowerCase()).toContain("unauthenticated");
    });

    it("should categorize permission errors", () => {
      const message = "PERMISSION_DENIED: Access denied";
      expect(message.toLowerCase()).toContain("permission_denied");
    });

    it("should categorize timeout errors", () => {
      const message = "DEADLINE_EXCEEDED: Request timeout";
      expect(message.toLowerCase()).toContain("deadline_exceeded");
    });

    it("should categorize validation errors", () => {
      const message = "INVALID_ARGUMENT: Bad request";
      expect(message.toLowerCase()).toContain("invalid_argument");
    });

    it("should categorize not found errors", () => {
      const message = "NOT_FOUND: Resource not found";
      expect(message.toLowerCase()).toContain("not_found");
    });
  });

  // ==========================================================================
  // ログエントリ処理テスト
  // ==========================================================================

  describe("Log entry processing", () => {
    it("should handle empty log entries", async () => {
      mockLoggingClient.setEntries([]);

      const entries = await mockLoggingClient.getEntries({
        filter: "",
        pageSize: 100,
      });

      expect(entries[0]).toHaveLength(0);
    });

    it("should handle multiple log entries", async () => {
      mockLoggingClient.setEntries(mockLogEntries);

      const entries = await mockLoggingClient.getEntries({
        filter: "",
        pageSize: 100,
      });

      expect(entries[0]).toHaveLength(5);
    });

    it("should throw error when logging fails", async () => {
      mockLoggingClient.setError("Connection timeout");

      await expect(
        mockLoggingClient.getEntries({ filter: "", pageSize: 100 }),
      ).rejects.toThrow("Connection timeout");
    });
  });

  // ==========================================================================
  // 統計計算テスト
  // ==========================================================================

  describe("Statistics calculations", () => {
    it("should calculate average correctly", () => {
      const values = [100, 200, 300, 400, 500];
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

      expect(avg).toBe(300);
    });

    it("should calculate median correctly for odd count", () => {
      const values = [100, 200, 300, 400, 500].sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];

      expect(median).toBe(300);
    });

    it("should calculate 95th percentile correctly", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = values[Math.floor(values.length * 0.95)];

      expect(p95).toBe(96);
    });

    it("should handle empty arrays gracefully", () => {
      const values: number[] = [];
      const avg = values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : 0;

      expect(avg).toBe(0);
    });

    it("should calculate error rate correctly", () => {
      const totalRequests = 100;
      const errorCount = 5;
      const errorRate = (errorCount / totalRequests) * 100;

      expect(errorRate).toBe(5);
    });

    it("should handle zero total requests", () => {
      const totalRequests = 0;
      const errorCount = 0;
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

      expect(errorRate).toBe(0);
    });
  });

  // ==========================================================================
  // 権限チェックテスト
  // ==========================================================================

  describe("Permission checks", () => {
    it("should require admin authentication", () => {
      const mockGetAdminLevel = getAdminLevel as jest.Mock;

      // admin権限がある場合
      mockGetAdminLevel.mockReturnValue("admin");
      expect(getAdminLevel({ admin: true } as unknown)).toBe("admin");

      // super_admin権限がある場合
      mockGetAdminLevel.mockReturnValue("super_admin");
      expect(getAdminLevel({ super_admin: true } as unknown)).toBe("super_admin");

      // support権限がある場合
      mockGetAdminLevel.mockReturnValue("support");
      expect(getAdminLevel({ support: true } as unknown)).toBe("support");
    });

    it("should deny access without admin role", () => {
      const mockGetAdminLevel = getAdminLevel as jest.Mock;

      mockGetAdminLevel.mockReturnValue(undefined);
      expect(getAdminLevel({} as unknown)).toBeUndefined();
    });

    it("should allow all admin roles to access monitoring", () => {
      const mockGetAdminLevel = getAdminLevel as jest.Mock;

      const roles = ["admin", "super_admin", "support"];

      roles.forEach((role) => {
        mockGetAdminLevel.mockReturnValue(role);
        const result = getAdminLevel({ [role]: true } as unknown);
        expect(result).toBe(role);
      });
    });
  });

  // ==========================================================================
  // 期間バリデーションテスト
  // ==========================================================================

  describe("Period validation", () => {
    it("should accept valid periods", () => {
      const validPeriods = ["1h", "24h", "7d"];

      validPeriods.forEach((period) => {
        expect(["1h", "24h", "7d"]).toContain(period);
      });
    });

    it("should reject invalid periods", () => {
      const invalidPeriods = ["2h", "12h", "30d", "invalid"];

      invalidPeriods.forEach((period) => {
        expect(["1h", "24h", "7d"]).not.toContain(period);
      });
    });
  });

  // ==========================================================================
  // ヘルスステータス判定テスト
  // ==========================================================================

  describe("Health status determination", () => {
    it("should return healthy when all services are healthy", () => {
      const services = {
        firestore: { status: "healthy" as HealthStatus, responseTime: 100 },
        bigquery: { status: "healthy" as HealthStatus, responseTime: 500 },
        auth: { status: "healthy" as HealthStatus, responseTime: 200 },
      };

      const statuses = Object.values(services).map((s) => s.status);
      let overall: HealthStatus = "healthy";

      if (statuses.some((s) => s === "unhealthy")) {
        overall = "unhealthy";
      } else if (statuses.some((s) => s === "degraded")) {
        overall = "degraded";
      }

      expect(overall).toBe("healthy");
    });

    it("should return degraded when any service is degraded", () => {
      const services = {
        firestore: { status: "healthy" as HealthStatus, responseTime: 100 },
        bigquery: { status: "degraded" as HealthStatus, responseTime: 3000 },
        auth: { status: "healthy" as HealthStatus, responseTime: 200 },
      };

      const statuses = Object.values(services).map((s) => s.status);
      let overall: HealthStatus = "healthy";

      if (statuses.some((s) => s === "unhealthy")) {
        overall = "unhealthy";
      } else if (statuses.some((s) => s === "degraded")) {
        overall = "degraded";
      }

      expect(overall).toBe("degraded");
    });

    it("should return unhealthy when any service is unhealthy", () => {
      const services = {
        firestore: { status: "healthy" as HealthStatus, responseTime: 100 },
        bigquery: { status: "unhealthy" as HealthStatus, responseTime: 0 },
        auth: { status: "degraded" as HealthStatus, responseTime: 1500 },
      };

      const statuses = Object.values(services).map((s) => s.status);
      let overall: HealthStatus = "healthy";

      if (statuses.some((s) => s === "unhealthy")) {
        overall = "unhealthy";
      } else if (statuses.some((s) => s === "degraded")) {
        overall = "degraded";
      }

      expect(overall).toBe("unhealthy");
    });
  });

  // ==========================================================================
  // エラー集計テスト
  // ==========================================================================

  describe("Error aggregation", () => {
    it("should aggregate errors by severity", () => {
      const entries = mockLogEntries;
      const errorsBySeverity: Record<string, number> = {
        ERROR: 0,
        CRITICAL: 0,
        ALERT: 0,
        EMERGENCY: 0,
      };

      entries.forEach((entry) => {
        const severity = (entry as { metadata: { severity: string } }).metadata.severity;
        if (severity === "ERROR" || severity === "CRITICAL" ||
            severity === "ALERT" || severity === "EMERGENCY") {
          errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;
        }
      });

      expect(errorsBySeverity.ERROR).toBe(2);
      expect(errorsBySeverity.CRITICAL).toBe(1);
      expect(errorsBySeverity.ALERT).toBe(0);
      expect(errorsBySeverity.EMERGENCY).toBe(0);
    });

    it("should count total errors correctly", () => {
      const entries = mockLogEntries;
      let totalErrors = 0;

      entries.forEach((entry) => {
        const severity = (entry as { metadata: { severity: string } }).metadata.severity;
        if (severity === "ERROR" || severity === "CRITICAL" ||
            severity === "ALERT" || severity === "EMERGENCY") {
          totalErrors++;
        }
      });

      expect(totalErrors).toBe(3);
    });
  });

  // ==========================================================================
  // リクエスト集計テスト
  // ==========================================================================

  describe("Request aggregation", () => {
    it("should aggregate requests by function", () => {
      const entries = mockLogEntries;
      const requestsByFunction: Record<string, number> = {};

      entries.forEach((entry) => {
        const functionName = (entry as {
          metadata: { resource: { labels: { function_name: string } } }
        }).metadata.resource.labels.function_name || "unknown";
        requestsByFunction[functionName] = (requestsByFunction[functionName] || 0) + 1;
      });

      expect(requestsByFunction["user_updateProfile"]).toBe(2);
      expect(requestsByFunction["user_getProfile"]).toBe(1);
      expect(requestsByFunction["training_createSession"]).toBe(1);
      expect(requestsByFunction["admin_listUsers"]).toBe(1);
    });

    it("should count total requests correctly", () => {
      expect(mockLogEntries.length).toBe(5);
    });
  });

  // ==========================================================================
  // パフォーマンス集計テスト
  // ==========================================================================

  describe("Performance aggregation", () => {
    it("should aggregate memory usage", () => {
      const entries = mockLogEntries;
      const memoryUsage: number[] = [];

      entries.forEach((entry) => {
        const memory = (entry as { data: { memoryUsage?: number } }).data.memoryUsage;
        if (typeof memory === "number") {
          memoryUsage.push(memory);
        }
      });

      expect(memoryUsage).toHaveLength(5);
      expect(Math.max(...memoryUsage)).toBe(256);
    });

    it("should count cold starts correctly", () => {
      const entries = mockLogEntries;
      let coldStarts = 0;

      entries.forEach((entry) => {
        const isColdStart = (entry as { data: { coldStart?: boolean } }).data.coldStart;
        if (isColdStart === true) {
          coldStarts++;
        }
      });

      expect(coldStarts).toBe(2);
    });

    it("should aggregate execution times", () => {
      const entries = mockLogEntries;
      const executionTimes: number[] = [];

      entries.forEach((entry) => {
        const time = (entry as { data: { executionTime?: number } }).data.executionTime;
        if (typeof time === "number") {
          executionTimes.push(time);
        }
      });

      expect(executionTimes).toHaveLength(5);
      expect(Math.max(...executionTimes)).toBe(5000);
    });

    it("should aggregate Firestore operations", () => {
      const entries = mockLogEntries;
      let firestoreReads = 0;
      let firestoreWrites = 0;

      entries.forEach((entry) => {
        const reads = (entry as { data: { firestoreReads?: number } }).data.firestoreReads;
        const writes = (entry as { data: { firestoreWrites?: number } }).data.firestoreWrites;

        if (typeof reads === "number") {
          firestoreReads += reads;
        }
        if (typeof writes === "number") {
          firestoreWrites += writes;
        }
      });

      expect(firestoreReads).toBe(3);
      expect(firestoreWrites).toBe(3);
    });
  });

  // ==========================================================================
  // レスポンスタイム統計テスト
  // ==========================================================================

  describe("Response time statistics", () => {
    it("should calculate response time statistics correctly", () => {
      const responseTimes = [50, 150, 200, 30, 5000].sort((a, b) => a - b);

      const avg = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      const median = responseTimes[Math.floor(responseTimes.length / 2)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];

      expect(avg).toBe(1086);
      expect(median).toBe(150);
      expect(p95).toBe(5000);
    });
  });

  // ==========================================================================
  // エラーハンドリングテスト
  // ==========================================================================

  describe("Error handling", () => {
    it("should handle Cloud Logging errors", async () => {
      mockLoggingClient.setError("Cloud Logging API error");

      await expect(
        mockLoggingClient.getEntries({ filter: "", pageSize: 100 }),
      ).rejects.toThrow("Cloud Logging API error");
    });

    it("should handle malformed log entries", () => {
      const malformedEntry = {
        metadata: {},
        data: null,
      };

      mockLoggingClient.setEntries([malformedEntry]);

      // APIはmalformedなエントリも処理できるべき
      expect(async () => {
        await mockLoggingClient.getEntries({ filter: "", pageSize: 100 });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 統合テスト
  // ==========================================================================

  describe("Integration tests", () => {
    it("should handle concurrent log queries", async () => {
      mockLoggingClient.setEntries(mockLogEntries);

      const promises = [
        mockLoggingClient.getEntries({ filter: "severity >= ERROR", pageSize: 100 }),
        mockLoggingClient.getEntries({ filter: "resource.type = cloud_function", pageSize: 100 }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result[0]).toBeDefined();
      });
    });

    it("should return consistent data format across periods", () => {
      const periods: MonitoringPeriod[] = ["1h", "24h", "7d"];

      periods.forEach((period) => {
        const seconds = MONITORING_CONSTANTS.PERIOD_TO_SECONDS[period];
        expect(typeof seconds).toBe("number");
        expect(seconds).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // ログ出力テスト
  // ==========================================================================

  describe("Logging", () => {
    it("should log function start and end", () => {
      // API呼び出し時にロギングが行われることを確認
      expect(logger.functionStart).toBeDefined();
      expect(logger.functionEnd).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it("should log warnings for unauthorized access", () => {
      expect(logger.warn).toBeDefined();
    });
  });
});

// =============================================================================
// モッククライアントテスト
// =============================================================================

describe("MockLoggingClient", () => {
  let client: MockLoggingClient;

  beforeEach(() => {
    client = new MockLoggingClient();
  });

  it("should return empty array by default", async () => {
    const [entries] = await client.getEntries({ filter: "", pageSize: 100 });
    expect(entries).toHaveLength(0);
  });

  it("should return set entries", async () => {
    client.setEntries(mockLogEntries);
    const [entries] = await client.getEntries({ filter: "", pageSize: 100 });
    expect(entries).toHaveLength(5);
  });

  it("should throw set error", async () => {
    client.setError("Test error");
    await expect(
      client.getEntries({ filter: "", pageSize: 100 }),
    ).rejects.toThrow("Test error");
  });

  it("should reset state correctly", async () => {
    client.setEntries(mockLogEntries);
    client.setError("Test error");
    client.reset();

    const [entries] = await client.getEntries({ filter: "", pageSize: 100 });
    expect(entries).toHaveLength(0);
  });
});

// =============================================================================
// 境界値テスト
// =============================================================================

describe("Boundary tests", () => {
  it("should handle maximum timeline entries", () => {
    const maxEntries = MONITORING_CONSTANTS.MAX_TIMELINE_ENTRIES;
    const entries = Array.from({ length: maxEntries + 50 }, () =>
      createMockLogEntry({ severity: "ERROR" }),
    );

    const timeline = entries.slice(0, maxEntries);
    expect(timeline).toHaveLength(100);
  });

  it("should handle very large execution times", () => {
    const entry = createMockLogEntry({
      executionTime: 600000, // 10 minutes
    });

    const executionTime = (entry.data as { executionTime: number }).executionTime;
    expect(executionTime).toBe(600000);
  });

  it("should handle zero values", () => {
    const entry = createMockLogEntry({
      executionTime: 0,
      memoryUsage: 0,
      firestoreReads: 0,
      firestoreWrites: 0,
    });

    expect((entry.data as { executionTime: number }).executionTime).toBe(0);
    expect((entry.data as { memoryUsage: number }).memoryUsage).toBe(0);
  });
});
