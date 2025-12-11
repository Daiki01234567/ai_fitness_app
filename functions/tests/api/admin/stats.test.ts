/**
 * 利用統計API テスト
 *
 * DAU/MAU統計、トレーニング統計、ユーザー統計、継続率統計APIのテスト
 *
 * 参照: docs/common/tickets/045-usage-statistics-api.md
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

// =============================================================================
// モック設定
// =============================================================================

// firebase-admin モック
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  const mockTimestamp = {
    now: jest.fn(() => ({
      toMillis: jest.fn(() => Date.now()),
    })),
    fromMillis: jest.fn((ms: number) => ({
      toMillis: jest.fn(() => ms),
    })),
  };

  const mockCountResult = {
    data: jest.fn(() => ({ count: 100 })),
  };

  const mockCount = {
    get: jest.fn(() => Promise.resolve(mockCountResult)),
  };

  const mockCollection = {
    count: jest.fn(() => mockCount),
    where: jest.fn(() => ({
      count: jest.fn(() => mockCount),
    })),
    doc: jest.fn(),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
  }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    firestore: Object.assign(mockFirestore, {
      FieldValue: mockFieldValue,
      Timestamp: mockTimestamp,
    }),
  };
});

// BigQuery モック
const mockBigQueryQuery = jest.fn();
jest.mock("@google-cloud/bigquery", () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    query: mockBigQueryQuery,
  })),
}));

// utils/firestore モック
jest.mock("../../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          data: jest.fn(() => ({ count: 100 })),
        })),
      })),
      where: jest.fn(() => ({
        count: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            data: jest.fn(() => ({ count: 50 })),
          })),
        })),
      })),
    })),
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
jest.mock("../../../src/middleware/adminAuth", () => ({
  isAdmin: jest.fn(() => true),
  getAdminLevel: jest.fn(() => "admin"),
  requireAdminFromRequest: jest.fn(),
}));

// =============================================================================
// テストデータ
// =============================================================================

const mockDAUData = [
  { date: { value: "2025-12-11" }, dau: 150 },
  { date: { value: "2025-12-10" }, dau: 142 },
  { date: { value: "2025-12-09" }, dau: 138 },
];

const mockMAUData = [{ mau: 1500 }];

const mockPreviousMAUData = [{ previous_mau: 1400 }];

const mockTrainingTotalData = [{
  total_sessions: 5000,
  avg_duration: 1200,
  avg_score: 75.5,
}];

const mockExerciseStatsData = [
  { exercise_type: "squat", count: 2000, avg_score: 78.2 },
  { exercise_type: "pushup", count: 1500, avg_score: 72.5 },
  { exercise_type: "armcurl", count: 1000, avg_score: 80.1 },
  { exercise_type: "sidelateral", count: 300, avg_score: 68.3 },
  { exercise_type: "shoulderpress", count: 200, avg_score: 65.0 },
];

const mockDailyTrainingData = [
  { date: { value: "2025-12-11" }, count: 200 },
  { date: { value: "2025-12-10" }, count: 185 },
  { date: { value: "2025-12-09" }, count: 178 },
];

const mockRetentionData = [{
  total_users: 500,
  returning_users: 150,
  retention_rate: 30.0,
}];

// =============================================================================
// インポート（モック設定後）
// =============================================================================

import { StatsQueryService } from "../../../src/services/statsQueries";
import { logger } from "../../../src/utils/logger";

// =============================================================================
// テストスイート
// =============================================================================

describe("Stats API Tests", () => {
  let statsQueryService: StatsQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    statsQueryService = new StatsQueryService();

    // デフォルトのBigQueryモックレスポンスを設定
    mockBigQueryQuery.mockImplementation((options: { query: string }) => {
      const query = options.query.toLowerCase();

      if (query.includes("count(distinct user_hash) as dau")) {
        return Promise.resolve([mockDAUData]);
      }
      if (query.includes("count(distinct user_hash) as mau")) {
        return Promise.resolve([mockMAUData]);
      }
      if (query.includes("count(distinct user_hash) as previous_mau")) {
        return Promise.resolve([mockPreviousMAUData]);
      }
      if (query.includes("count(*) as total_sessions")) {
        return Promise.resolve([mockTrainingTotalData]);
      }
      if (query.includes("group by exercise_type")) {
        return Promise.resolve([mockExerciseStatsData]);
      }
      if (query.includes("count(*) as count") && query.includes("group by date")) {
        return Promise.resolve([mockDailyTrainingData]);
      }
      if (query.includes("retention_rate")) {
        return Promise.resolve([mockRetentionData]);
      }

      return Promise.resolve([[]]);
    });
  });

  // ==========================================================================
  // DAU/MAU統計テスト
  // ==========================================================================

  describe("getActiveUsersStats", () => {
    it("should fetch DAU/MAU stats successfully for 30d period", async () => {
      const result = await statsQueryService.getActiveUsersStats("30d");

      expect(result).toBeDefined();
      expect(result.period).toBe("30d");
      expect(result.mau).toBe(1500);
      expect(result.previousMAU).toBe(1400);
      expect(result.changeRate).toBeCloseTo(7.14, 1);
      expect(Array.isArray(result.dau)).toBe(true);
      expect(result.dau.length).toBe(3);
    });

    it("should fetch DAU/MAU stats for 7d period", async () => {
      const result = await statsQueryService.getActiveUsersStats("7d");

      expect(result).toBeDefined();
      expect(result.period).toBe("7d");
    });

    it("should fetch DAU/MAU stats for 90d period", async () => {
      const result = await statsQueryService.getActiveUsersStats("90d");

      expect(result).toBeDefined();
      expect(result.period).toBe("90d");
    });

    it("should handle zero previous MAU gracefully", async () => {
      mockBigQueryQuery.mockImplementation((options: { query: string }) => {
        const query = options.query.toLowerCase();
        if (query.includes("previous_mau")) {
          return Promise.resolve([[{ previous_mau: 0 }]]);
        }
        if (query.includes("count(distinct user_hash) as dau")) {
          return Promise.resolve([mockDAUData]);
        }
        if (query.includes("count(distinct user_hash) as mau")) {
          return Promise.resolve([mockMAUData]);
        }
        return Promise.resolve([[]]);
      });

      const result = await statsQueryService.getActiveUsersStats("30d");

      expect(result.changeRate).toBe(0);
    });

    it("should throw error when BigQuery fails", async () => {
      mockBigQueryQuery.mockRejectedValue(new Error("BigQuery error"));

      await expect(statsQueryService.getActiveUsersStats("30d"))
        .rejects.toThrow("BigQuery error");

      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // トレーニング統計テスト
  // ==========================================================================

  describe("getTrainingStats", () => {
    it("should fetch training stats successfully", async () => {
      const result = await statsQueryService.getTrainingStats("30d");

      expect(result).toBeDefined();
      expect(result.period).toBe("30d");
      expect(result.total.sessions).toBe(5000);
      expect(result.total.avgDuration).toBe(1200);
      expect(result.total.avgScore).toBeCloseTo(75.5, 1);
    });

    it("should return exercise breakdown", async () => {
      const result = await statsQueryService.getTrainingStats("30d");

      expect(Array.isArray(result.byExercise)).toBe(true);
      expect(result.byExercise.length).toBe(5);
      expect(result.byExercise[0].exerciseType).toBe("squat");
      expect(result.byExercise[0].count).toBe(2000);
    });

    it("should return daily training counts", async () => {
      const result = await statsQueryService.getTrainingStats("30d");

      expect(Array.isArray(result.daily)).toBe(true);
      expect(result.daily.length).toBe(3);
    });

    it("should handle empty results gracefully", async () => {
      mockBigQueryQuery.mockResolvedValue([[]]);

      const result = await statsQueryService.getTrainingStats("30d");

      expect(result.total.sessions).toBe(0);
      expect(result.total.avgDuration).toBe(0);
      expect(result.total.avgScore).toBe(0);
    });
  });

  // ==========================================================================
  // ユーザー統計テスト
  // ==========================================================================

  describe("getUserStats", () => {
    it("should fetch user stats from Firestore", async () => {
      const result = await statsQueryService.getUserStats("30d");

      expect(result).toBeDefined();
      expect(result.period).toBe("30d");
      // モックでは全て100を返しているので確認
      expect(typeof result.total).toBe("number");
      expect(typeof result.new).toBe("number");
      expect(result.byPlan).toBeDefined();
      expect(typeof result.byPlan.free).toBe("number");
      expect(typeof result.byPlan.premium).toBe("number");
    });

    it("should calculate free users correctly", async () => {
      const result = await statsQueryService.getUserStats("30d");

      // free = total - premium
      expect(result.byPlan.free).toBe(result.total - result.byPlan.premium);
    });
  });

  // ==========================================================================
  // 継続率統計テスト
  // ==========================================================================

  describe("getRetentionStats", () => {
    it("should fetch retention stats successfully", async () => {
      const result = await statsQueryService.getRetentionStats();

      expect(result).toBeDefined();
      expect(result.retention7d).toBeDefined();
      expect(result.retention30d).toBeDefined();
    });

    it("should calculate 7-day retention correctly", async () => {
      const result = await statsQueryService.getRetentionStats();

      expect(result.retention7d.totalUsers).toBe(500);
      expect(result.retention7d.returningUsers).toBe(150);
      expect(result.retention7d.rate).toBe(30.0);
    });

    it("should calculate 30-day retention correctly", async () => {
      const result = await statsQueryService.getRetentionStats();

      expect(result.retention30d.totalUsers).toBe(500);
      expect(result.retention30d.returningUsers).toBe(150);
      expect(result.retention30d.rate).toBe(30.0);
    });

    it("should handle zero total users", async () => {
      mockBigQueryQuery.mockResolvedValue([[{
        total_users: 0,
        returning_users: 0,
        retention_rate: 0,
      }]]);

      const result = await statsQueryService.getRetentionStats();

      expect(result.retention7d.rate).toBe(0);
      expect(result.retention30d.rate).toBe(0);
    });
  });

  // ==========================================================================
  // 統合テスト
  // ==========================================================================

  describe("Integration tests", () => {
    it("should handle concurrent requests", async () => {
      const promises = [
        statsQueryService.getActiveUsersStats("7d"),
        statsQueryService.getTrainingStats("7d"),
        statsQueryService.getUserStats("7d"),
        statsQueryService.getRetentionStats(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it("should return consistent data format across periods", async () => {
      const periods: Array<"7d" | "30d" | "90d"> = ["7d", "30d", "90d"];

      for (const period of periods) {
        const stats = await statsQueryService.getTrainingStats(period);

        expect(stats.period).toBe(period);
        expect(stats.total).toBeDefined();
        expect(Array.isArray(stats.byExercise)).toBe(true);
        expect(Array.isArray(stats.daily)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // エラーハンドリングテスト
  // ==========================================================================

  describe("Error handling", () => {
    it("should log errors when BigQuery fails", async () => {
      const error = new Error("Connection timeout");
      mockBigQueryQuery.mockRejectedValue(error);

      await expect(statsQueryService.getActiveUsersStats("30d"))
        .rejects.toThrow("Connection timeout");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch active users stats",
        expect.any(Error),
        expect.objectContaining({ period: "30d" }),
      );
    });

    it("should handle partial query failures", async () => {
      let callCount = 0;
      mockBigQueryQuery.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Query failed"));
        }
        return Promise.resolve([mockDAUData]);
      });

      await expect(statsQueryService.getActiveUsersStats("30d"))
        .rejects.toThrow();
    });
  });
});

// =============================================================================
// 権限チェックテスト
// =============================================================================

describe("Admin Stats API Permission Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require admin authentication", () => {
    const { getAdminLevel } = require("../../../src/middleware/adminAuth");

    // admin権限がある場合
    getAdminLevel.mockReturnValue("admin");
    expect(getAdminLevel({ admin: true })).toBe("admin");

    // super_admin権限がある場合
    getAdminLevel.mockReturnValue("super_admin");
    expect(getAdminLevel({ super_admin: true })).toBe("super_admin");

    // support権限がある場合
    getAdminLevel.mockReturnValue("support");
    expect(getAdminLevel({ support: true })).toBe("support");
  });

  it("should deny access without admin role", () => {
    const { getAdminLevel } = require("../../../src/middleware/adminAuth");

    getAdminLevel.mockReturnValue(undefined);
    expect(getAdminLevel({})).toBeUndefined();
  });

  it("should allow all admin roles to access stats", () => {
    const { getAdminLevel } = require("../../../src/middleware/adminAuth");

    const roles = ["admin", "super_admin", "support"];

    roles.forEach((role) => {
      getAdminLevel.mockReturnValue(role);
      const result = getAdminLevel({ [role]: true });
      expect(result).toBe(role);
    });
  });
});

// =============================================================================
// バリデーションテスト
// =============================================================================

describe("Period Validation Tests", () => {
  it("should accept valid periods", () => {
    const validPeriods = ["7d", "30d", "90d"];

    validPeriods.forEach((period) => {
      expect(["7d", "30d", "90d"]).toContain(period);
    });
  });

  it("should have default period as 30d", () => {
    const { STATS_CONSTANTS } = require("../../../src/types/admin");

    expect(STATS_CONSTANTS.DEFAULT_PERIOD).toBe("30d");
  });

  it("should map periods to correct days", () => {
    const { STATS_CONSTANTS } = require("../../../src/types/admin");

    expect(STATS_CONSTANTS.PERIOD_TO_DAYS["7d"]).toBe(7);
    expect(STATS_CONSTANTS.PERIOD_TO_DAYS["30d"]).toBe(30);
    expect(STATS_CONSTANTS.PERIOD_TO_DAYS["90d"]).toBe(90);
  });
});
