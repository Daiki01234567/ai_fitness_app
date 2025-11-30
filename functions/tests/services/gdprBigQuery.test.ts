/**
 * GDPR BigQuery Service Tests
 *
 * Comprehensive tests for BigQuery analytics data operations
 * - deleteUserFromBigQuery: Delete user data from BigQuery tables
 * - verifyBigQueryDeletion: Verify user data is deleted from BigQuery
 * - collectBigQueryData: Collect analytics data for export
 */

// Mock bigquery service before imports
const mockDeleteUserData = jest.fn();
const mockRunQuery = jest.fn();

jest.mock("../../src/services/bigquery", () => ({
  bigQueryService: {
    deleteUserData: mockDeleteUserData,
    runQuery: mockRunQuery,
  },
}));

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  deleteUserFromBigQuery,
  verifyBigQueryDeletion,
  collectBigQueryData,
} from "../../src/services/gdprBigQuery";
import { logger } from "../../src/utils/logger";

describe("GDPR BigQuery Service", () => {
  const testUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.GCLOUD_PROJECT;
    delete process.env.ANONYMIZATION_SALT;
  });

  describe("deleteUserFromBigQuery", () => {
    it("should delete user data from BigQuery tables successfully", async () => {
      mockDeleteUserData.mockResolvedValue(undefined);

      const result = await deleteUserFromBigQuery(testUserId);

      expect(result.deleted).toBe(true);
      expect(result.tablesAffected).toContain("users_anonymized");
      expect(result.tablesAffected).toContain("training_sessions");
      expect(result.rowsAffected).toBe(-1); // Exact count not available
      expect(mockDeleteUserData).toHaveBeenCalledWith(testUserId);
      expect(logger.info).toHaveBeenCalledWith(
        "BigQuery user data deletion completed",
        expect.objectContaining({
          userId: testUserId,
          tablesAffected: ["users_anonymized", "training_sessions"],
        })
      );
    });

    it("should return error when deletion fails", async () => {
      const errorMessage = "BigQuery deletion failed";
      mockDeleteUserData.mockRejectedValue(new Error(errorMessage));

      const result = await deleteUserFromBigQuery(testUserId);

      expect(result.deleted).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.rowsAffected).toBe(0);
      expect(result.tablesAffected).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle unknown error type", async () => {
      mockDeleteUserData.mockRejectedValue("String error");

      const result = await deleteUserFromBigQuery(testUserId);

      expect(result.deleted).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should log timing information", async () => {
      mockDeleteUserData.mockResolvedValue(undefined);

      await deleteUserFromBigQuery(testUserId);

      expect(logger.info).toHaveBeenCalledWith(
        "BigQuery user data deletion completed",
        expect.objectContaining({
          durationMs: expect.any(Number),
        })
      );
    });
  });

  describe("verifyBigQueryDeletion", () => {
    it("should return true when no data exists for user", async () => {
      // Return zero counts for all queries
      mockRunQuery.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      const result = await verifyBigQueryDeletion(testUserId);

      expect(result).toBe(true);
      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(*)"),
        expect.objectContaining({ userHash: expect.any(String) })
      );
    });

    it("should return false when data still exists in users_anonymized", async () => {
      mockRunQuery.mockResolvedValue([{ count: 1 }, { count: 0 }]);

      const result = await verifyBigQueryDeletion(testUserId);

      expect(result).toBe(false);
    });

    it("should return false when data still exists in training_sessions", async () => {
      mockRunQuery.mockResolvedValue([{ count: 0 }, { count: 5 }]);

      const result = await verifyBigQueryDeletion(testUserId);

      expect(result).toBe(false);
    });

    it("should return false when data exists in both tables", async () => {
      mockRunQuery.mockResolvedValue([{ count: 1 }, { count: 3 }]);

      const result = await verifyBigQueryDeletion(testUserId);

      expect(result).toBe(false);
    });

    it("should return true on error (table might not exist)", async () => {
      mockRunQuery.mockRejectedValue(new Error("Table not found"));

      const result = await verifyBigQueryDeletion(testUserId);

      // Returns true because table not existing means data doesn't exist
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should use correct project ID from environment", async () => {
      process.env.GCLOUD_PROJECT = "custom-project";
      mockRunQuery.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await verifyBigQueryDeletion(testUserId);

      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.stringContaining("custom-project.fitness_analytics"),
        expect.any(Object)
      );
    });

    it("should use default project ID when not set", async () => {
      delete process.env.GCLOUD_PROJECT;
      mockRunQuery.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await verifyBigQueryDeletion(testUserId);

      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.stringContaining("tokyo-list-478804-e5.fitness_analytics"),
        expect.any(Object)
      );
    });

    it("should hash user ID with anonymization salt", async () => {
      process.env.ANONYMIZATION_SALT = "test_salt";
      mockRunQuery.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await verifyBigQueryDeletion(testUserId);

      // Verify userHash is passed (16-character hex string)
      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        })
      );
    });
  });

  describe("collectBigQueryData", () => {
    const mockAggregateResult = [
      {
        total_sessions: 50,
        total_reps: 500,
        avg_score: 85.5,
      },
    ];

    const mockExerciseResult = [
      { exercise_type: "squat", session_count: 20 },
      { exercise_type: "pushup", session_count: 15 },
      { exercise_type: "plank", session_count: 15 },
    ];

    const mockWeeklyResult = [
      { week: "2024-W01", sessions: 5, avg_score: 82.0 },
      { week: "2024-W02", sessions: 7, avg_score: 88.0 },
    ];

    const mockMonthlyResult = [
      { month: "2024-01", sessions: 20, avg_score: 85.0 },
      { month: "2024-02", sessions: 25, avg_score: 87.0 },
    ];

    it("should collect comprehensive analytics data", async () => {
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockExerciseResult)
        .mockResolvedValueOnce(mockWeeklyResult)
        .mockResolvedValueOnce(mockMonthlyResult);

      const result = await collectBigQueryData(testUserId);

      expect(result).not.toBeNull();
      expect(result?.totalSessions).toBe(50);
      expect(result?.totalReps).toBe(500);
      expect(result?.averageScore).toBe(85.5);

      // Exercise breakdown
      expect(result?.exerciseBreakdown).toEqual({
        squat: 20,
        pushup: 15,
        plank: 15,
      });

      // Weekly progress
      expect(result?.weeklyProgress).toHaveLength(2);
      expect(result?.weeklyProgress[0]).toEqual({
        week: "2024-W01",
        sessions: 5,
        avgScore: 82.0,
      });

      // Monthly trends
      expect(result?.monthlyTrends).toHaveLength(2);
      expect(result?.monthlyTrends[0]).toEqual({
        month: "2024-01",
        sessions: 20,
        avgScore: 85.0,
      });
    });

    it("should handle empty aggregate result", async () => {
      mockRunQuery
        .mockResolvedValueOnce([]) // Empty aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await collectBigQueryData(testUserId);

      expect(result).not.toBeNull();
      expect(result?.totalSessions).toBe(0);
      expect(result?.totalReps).toBe(0);
      expect(result?.averageScore).toBe(0);
      expect(result?.exerciseBreakdown).toEqual({});
      expect(result?.weeklyProgress).toEqual([]);
      expect(result?.monthlyTrends).toEqual([]);
    });

    it("should handle null values in results", async () => {
      mockRunQuery
        .mockResolvedValueOnce([{
          total_sessions: null,
          total_reps: null,
          avg_score: null,
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ week: "2024-W01", sessions: 1, avg_score: null }])
        .mockResolvedValueOnce([]);

      const result = await collectBigQueryData(testUserId);

      expect(result?.totalSessions).toBe(0);
      expect(result?.totalReps).toBe(0);
      expect(result?.averageScore).toBe(0);
      expect(result?.weeklyProgress[0].avgScore).toBe(0);
    });

    it("should return null on error", async () => {
      mockRunQuery.mockRejectedValue(new Error("Query failed"));

      const result = await collectBigQueryData(testUserId);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to collect BigQuery data",
        expect.any(Error),
        expect.objectContaining({ userId: testUserId })
      );
    });

    it("should execute queries in parallel", async () => {
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockExerciseResult)
        .mockResolvedValueOnce(mockWeeklyResult)
        .mockResolvedValueOnce(mockMonthlyResult);

      await collectBigQueryData(testUserId);

      // All 4 queries should be called
      expect(mockRunQuery).toHaveBeenCalledTimes(4);
    });

    it("should log timing information", async () => {
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockExerciseResult)
        .mockResolvedValueOnce(mockWeeklyResult)
        .mockResolvedValueOnce(mockMonthlyResult);

      await collectBigQueryData(testUserId);

      expect(logger.info).toHaveBeenCalledWith(
        "BigQuery data collection completed",
        expect.objectContaining({
          durationMs: expect.any(Number),
          totalSessions: 50,
        })
      );
    });

    it("should use correct user hash in queries", async () => {
      process.env.ANONYMIZATION_SALT = "test_salt";
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await collectBigQueryData(testUserId);

      // All queries should use the same userHash
      const calls = mockRunQuery.mock.calls;
      const userHashes = calls.map((call) => call[1]?.userHash);
      expect(new Set(userHashes).size).toBe(1); // All same hash
      expect(userHashes[0]).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should handle partial query failures gracefully", async () => {
      // When Promise.all fails, the whole collection fails
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockRejectedValueOnce(new Error("Exercise query failed"))
        .mockResolvedValueOnce(mockWeeklyResult)
        .mockResolvedValueOnce(mockMonthlyResult);

      const result = await collectBigQueryData(testUserId);

      // Should return null since Promise.all rejects if any promise rejects
      expect(result).toBeNull();
    });

    it("should handle undefined aggregate values", async () => {
      mockRunQuery
        .mockResolvedValueOnce([undefined]) // Undefined first element
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await collectBigQueryData(testUserId);

      expect(result?.totalSessions).toBe(0);
      expect(result?.totalReps).toBe(0);
      expect(result?.averageScore).toBe(0);
    });

    it("should handle multiple exercise types correctly", async () => {
      const manyExercises = [
        { exercise_type: "squat", session_count: 10 },
        { exercise_type: "pushup", session_count: 8 },
        { exercise_type: "plank", session_count: 5 },
        { exercise_type: "lunge", session_count: 3 },
        { exercise_type: "deadlift", session_count: 2 },
      ];
      mockRunQuery
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(manyExercises)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await collectBigQueryData(testUserId);

      expect(Object.keys(result?.exerciseBreakdown || {}).length).toBe(5);
      expect(result?.exerciseBreakdown.squat).toBe(10);
      expect(result?.exerciseBreakdown.deadlift).toBe(2);
    });
  });

  describe("Additional Branch Coverage", () => {
    it("should handle null avg_score in monthly trends", async () => {
      mockRunQuery
        .mockResolvedValueOnce([{ total_sessions: 10, total_reps: 100, avg_score: 85 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ month: "2024-01", sessions: 5, avg_score: null }]);

      const result = await collectBigQueryData(testUserId);

      expect(result).not.toBeNull();
      expect(result?.monthlyTrends[0].avgScore).toBe(0);
    });
  });
});
