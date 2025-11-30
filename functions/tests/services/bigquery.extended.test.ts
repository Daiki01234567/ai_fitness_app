/**
 * BigQuery Service Tests - Extended Coverage
 */

const mockDocRef = {
  delete: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
};

const mockDocs = [
  {
    id: "dlq1",
    ref: mockDocRef,
    data: () => ({
      sourceCollection: "users",
      sourceDocumentId: "doc1",
      sourceData: { user_hash: "hash1" },
      status: "dead_letter",
      retryCount: 1,
    }),
  },
  {
    id: "dlq2",
    ref: mockDocRef,
    data: () => ({
      sourceCollection: "sessions",
      sourceDocumentId: "doc2",
      sourceData: { session_id: "sess1" },
      status: "dead_letter",
      retryCount: 2,
    }),
  },
];

let mockInsertFn: jest.Mock;
let mockQueryFn: jest.Mock;
jest.mock("@google-cloud/bigquery", () => {
  mockInsertFn = jest.fn(() => Promise.resolve());
  mockQueryFn = jest.fn(() =>
    Promise.resolve([
      [{ total_users: 100, total_sessions: 500, overall_avg_score: 85.5 }],
    ])
  );

  const mockTable = {
    insert: mockInsertFn,
  };
  const mockDataset = {
    table: jest.fn(() => mockTable),
  };
  const mockBigQuery = {
    dataset: jest.fn(() => mockDataset),
    query: mockQueryFn,
  };
  return { BigQuery: jest.fn(() => mockBigQuery) };
});

const mockFieldValue = {
  increment: jest.fn((n: number) => n),
  serverTimestamp: jest.fn(() => new Date()),
};

jest.mock("firebase-admin", () => {
  const firestoreFn = jest.fn(() => ({
    FieldValue: mockFieldValue,
  }));
  (firestoreFn as unknown as Record<string, unknown>).FieldValue =
    mockFieldValue;
  return {
    apps: [{ name: "test" }],
    initializeApp: jest.fn(),
    firestore: firestoreFn,
  };
});

let mockSnapshotEmpty = false;
let mockDLQDocs = mockDocs;

jest.mock("../../src/utils/firestore", () => ({
  bigquerySyncFailuresCollection: jest.fn(() => ({
    add: jest.fn(() => Promise.resolve({ id: "f1" })),
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            empty: mockSnapshotEmpty,
            docs: mockSnapshotEmpty ? [] : mockDLQDocs,
            size: mockSnapshotEmpty ? 0 : mockDLQDocs.length,
          })
        ),
      })),
    })),
  })),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock("../../src/utils/logger");

import { BigQuery } from "@google-cloud/bigquery";
import { BigQueryService } from "../../src/services/bigquery";
import { logger } from "../../src/utils/logger";
import { User, Session } from "../../src/types/firestore";
describe("BigQuery Service Extended", () => {
  let service: BigQueryService;
  let mockBigQuery: ReturnType<typeof BigQuery>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshotEmpty = false;
    mockDLQDocs = mockDocs;
    // Reset mock implementations to default
    mockInsertFn.mockReset();
    mockInsertFn.mockResolvedValue(undefined);
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([
      [{ total_users: 100, total_sessions: 500, overall_avg_score: 85.5 }],
    ]);
    mockDocRef.delete.mockReset();
    mockDocRef.delete.mockResolvedValue(undefined);
    mockDocRef.update.mockReset();
    mockDocRef.update.mockResolvedValue(undefined);
    process.env.GCLOUD_PROJECT = "test-project";
    process.env.ANONYMIZATION_SALT = "test-salt";
    service = new BigQueryService("test-project");
    mockBigQuery = (BigQuery as jest.MockedClass<typeof BigQuery>).mock
      .results[0].value;
  });

  describe("Constructor", () => {
    it("uses provided projectId", () => {
      const s = new BigQueryService("my-project");
      expect(s).toBeDefined();
    });

    it("uses env var when projectId not provided", () => {
      process.env.GCLOUD_PROJECT = "env-project";
      const s = new BigQueryService();
      expect(s).toBeDefined();
    });

    it("handles missing projectId and env var", () => {
      delete process.env.GCLOUD_PROJECT;
      const s = new BigQueryService();
      expect(s).toBeDefined();
    });
  });

  describe("anonymizeUser", () => {
    it("anonymizes user data with all fields", () => {
      const user: Partial<User> = {
        birthYear: 1990,
        gender: "male",
        fitnessLevel: "intermediate",
        createdAt: { toDate: () => new Date("2025-01-01") } as any,
      };
      const result = service.anonymizeUser("user123", user as User);
      expect(result.birth_year_range).toBe("1990s");
      expect(result.gender).toBe("male");
      expect(result.fitness_level).toBe("intermediate");
      expect(result.user_hash).toBeDefined();
      expect(result.region).toBe("JP");
    });

    it("handles missing birthYear", () => {
      const user: Partial<User> = {
        gender: "female",
        fitnessLevel: "beginner",
      };
      const result = service.anonymizeUser("user456", user as User);
      expect(result.birth_year_range).toBe("unknown");
    });

    it("handles missing gender", () => {
      const user: Partial<User> = {
        birthYear: 1985,
        fitnessLevel: "advanced",
      };
      const result = service.anonymizeUser("user789", user as User);
      expect(result.gender).toBe("unknown");
    });

    it("handles missing fitnessLevel", () => {
      const user: Partial<User> = {
        birthYear: 2000,
        gender: "other",
      };
      const result = service.anonymizeUser("user999", user as User);
      expect(result.fitness_level).toBe("unknown");
    });

    it("handles missing createdAt", () => {
      const user: Partial<User> = {
        birthYear: 1995,
        gender: "male",
      };
      const result = service.anonymizeUser("user111", user as User);
      expect(result.created_at).toBeDefined();
    });

    it("generates consistent hash for same userId", () => {
      const user: Partial<User> = { birthYear: 1990 };
      const result1 = service.anonymizeUser("same-user", user as User);
      const result2 = service.anonymizeUser("same-user", user as User);
      expect(result1.user_hash).toBe(result2.user_hash);
    });

    it("generates different hash for different userIds", () => {
      const user: Partial<User> = { birthYear: 1990 };
      const result1 = service.anonymizeUser("user-a", user as User);
      const result2 = service.anonymizeUser("user-b", user as User);
      expect(result1.user_hash).not.toBe(result2.user_hash);
    });
  });
  describe("transformSession", () => {
    it("transforms session with all metadata", () => {
      const session: Partial<Session> = {
        exerciseType: "squat",
        repCount: 10,
        averageScore: 85.5,
        totalScore: 855,
        duration: 120,
        sessionMetadata: {
          averageFps: 30,
          deviceInfo: {
            platform: "ios",
            model: "iPhone 14",
            osVersion: "17.0",
          },
          appVersion: "1.0.0",
        },
        createdAt: { toDate: () => new Date("2025-06-15") } as any,
      };
      const result = service.transformSession(
        "user1",
        "session1",
        session as Session
      );
      expect(result.exercise_type).toBe("squat");
      expect(result.rep_count).toBe(10);
      expect(result.average_score).toBe(85.5);
      expect(result.total_score).toBe(855);
      expect(result.duration_seconds).toBe(120);
      expect(result.average_fps).toBe(30);
      expect(result.device_platform).toBe("ios");
      expect(result.app_version).toBe("1.0.0");
      expect(result.session_id).toBeDefined();
      expect(result.user_hash).toBeDefined();
    });

    it("handles missing sessionMetadata", () => {
      const session: Partial<Session> = {
        exerciseType: "pushup",
        repCount: 20,
        averageScore: 90,
        totalScore: 1800,
        duration: 60,
      };
      const result = service.transformSession(
        "user2",
        "session2",
        session as Session
      );
      expect(result.average_fps).toBe(0);
      expect(result.device_platform).toBe("unknown");
      expect(result.device_model_hash).toBeDefined();
      expect(result.app_version).toBe("unknown");
    });

    it("handles missing deviceInfo", () => {
      const session: Partial<Session> = {
        exerciseType: "curl",
        repCount: 15,
        averageScore: 75,
        totalScore: 1125,
        duration: 90,
        sessionMetadata: {
          averageFps: 25,
          appVersion: "2.0.0",
        },
      };
      const result = service.transformSession(
        "user3",
        "session3",
        session as Session
      );
      expect(result.device_platform).toBe("unknown");
    });

    it("handles missing createdAt", () => {
      const session: Partial<Session> = {
        exerciseType: "squat",
        repCount: 5,
        averageScore: 80,
        totalScore: 400,
        duration: 30,
      };
      const result = service.transformSession(
        "user4",
        "session4",
        session as Session
      );
      expect(result.created_at).toBeDefined();
    });
  });

  describe("insertRows", () => {
    it("inserts rows successfully", async () => {
      await service.insertRows("test_table", [{ data: "test" }]);
      expect(mockInsertFn).toHaveBeenCalledWith(
        [{ data: "test" }],
        { skipInvalidRows: false, ignoreUnknownValues: false }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "BigQuery insert successful",
        expect.objectContaining({ table: "test_table", rowCount: 1 })
      );
    });

    it("skips empty rows array", async () => {
      await service.insertRows("test_table", []);
      expect(mockInsertFn).not.toHaveBeenCalled();
    });

    it("handles insert failure", async () => {
      const error = new Error("Insert failed");
      (error as NodeJS.ErrnoException).code = "BQ_ERROR";
      mockInsertFn.mockRejectedValueOnce(error);

      await expect(
        service.insertRows("test_table", [{ data: "test" }])
      ).rejects.toThrow("Insert failed");
      expect(logger.error).toHaveBeenCalledWith(
        "BigQuery insert failed",
        error,
        expect.objectContaining({ table: "test_table" })
      );
    });

    it("handles insert failure with errors array", async () => {
      const error = new Error("Partial insert failed") as Error & {
        errors: unknown[];
      };
      error.errors = [{ row: 0, reason: "invalid" }];
      mockInsertFn.mockRejectedValueOnce(error);

      await expect(
        service.insertRows("test_table", [{ data: "test" }])
      ).rejects.toThrow("Partial insert failed");
    });
  });
  describe("syncUser", () => {
    it("syncs user data to BigQuery", async () => {
      const user: Partial<User> = {
        birthYear: 1988,
        gender: "female",
        fitnessLevel: "beginner",
        createdAt: { toDate: () => new Date() } as any,
      };
      await service.syncUser("user123", user as User);
      expect(mockInsertFn).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe("syncSession", () => {
    it("syncs session data to BigQuery", async () => {
      const session: Partial<Session> = {
        exerciseType: "squat",
        repCount: 10,
        averageScore: 85,
        totalScore: 850,
        duration: 120,
        createdAt: { toDate: () => new Date() } as any,
      };
      await service.syncSession("user123", "session456", session as Session);
      expect(mockInsertFn).toHaveBeenCalled();
    });
  });

  describe("syncWithRetry", () => {
    it("succeeds on first attempt", async () => {
      const result = await service.syncWithRetry(
        "users",
        "doc1",
        { data: "test" },
        3
      );
      expect(result).toBe(true);
      expect(mockInsertFn).toHaveBeenCalledTimes(1);
    });

    it("succeeds on retry", async () => {
      mockInsertFn
        .mockRejectedValueOnce(new Error("Temp fail"))
        .mockResolvedValueOnce(undefined);

      const result = await service.syncWithRetry(
        "sessions",
        "doc2",
        { data: "test" },
        3
      );
      expect(result).toBe(true);
      expect(mockInsertFn).toHaveBeenCalledTimes(2);
    });

    it("sends to DLQ after max retries", async () => {
      mockInsertFn.mockRejectedValue(new Error("Persistent fail"));

      const result = await service.syncWithRetry(
        "users",
        "doc3",
        { data: "test" },
        3
      );
      expect(result).toBe(false);
      expect(mockInsertFn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        "Sync failure sent to DLQ",
        expect.any(Error),
        expect.objectContaining({ collection: "users", documentId: "doc3" })
      );
    });

    it("returns false for unknown collection", async () => {
      const result = await service.syncWithRetry(
        "unknown_collection",
        "doc4",
        { data: "test" },
        3
      );
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Unknown collection for BigQuery sync",
        { collection: "unknown_collection" }
      );
    });

    it("uses default maxRetries", async () => {
      const result = await service.syncWithRetry("users", "doc5", {
        data: "test",
      });
      expect(result).toBe(true);
    });
  });

  describe("processDLQItems", () => {
    it("returns 0 when DLQ is empty", async () => {
      mockSnapshotEmpty = true;
      const result = await service.processDLQItems();
      expect(result).toBe(0);
    });

    it("processes DLQ items successfully", async () => {
      mockSnapshotEmpty = false;
      const result = await service.processDLQItems(100);
      expect(result).toBe(2);
      expect(mockDocRef.delete).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        "DLQ processing completed",
        expect.objectContaining({ processed: 2, total: 2 })
      );
    });

    it("handles processing failure and updates status", async () => {
      mockSnapshotEmpty = false;
      mockInsertFn.mockRejectedValue(new Error("Still failing"));

      const result = await service.processDLQItems(50);
      expect(result).toBe(0);
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" })
      );
    });

    it("uses default limit", async () => {
      mockSnapshotEmpty = true;
      await service.processDLQItems();
    });
  });
  describe("deleteUserData", () => {
    it("deletes user data from both tables", async () => {
      await service.deleteUserData("user123");
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        "User data deleted from BigQuery",
        expect.objectContaining({ userHash: expect.any(String) })
      );
    });

    it("handles delete failure", async () => {
      mockQueryFn.mockRejectedValueOnce(new Error("Delete failed"));
      await expect(service.deleteUserData("user123")).rejects.toThrow(
        "Delete failed"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to delete user data from BigQuery",
        expect.any(Error),
        expect.objectContaining({ userHash: expect.any(String) })
      );
    });
  });

  describe("runQuery", () => {
    it("runs query and returns results", async () => {
      mockQueryFn.mockResolvedValueOnce([[{ count: 42 }]]);
      const result = await service.runQuery<{ count: number }>(
        "SELECT COUNT(*) as count FROM table"
      );
      expect(result).toEqual([{ count: 42 }]);
    });

    it("runs query with params", async () => {
      mockQueryFn.mockResolvedValueOnce([[{ user: "hash123" }]]);
      const result = await service.runQuery<{ user: string }>(
        "SELECT * FROM users WHERE user_hash = @hash",
        { hash: "hash123" }
      );
      expect(result).toEqual([{ user: "hash123" }]);
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "SELECT * FROM users WHERE user_hash = @hash",
          params: { hash: "hash123" },
        })
      );
    });

    it("returns empty array for no results", async () => {
      mockQueryFn.mockResolvedValueOnce([[]]);
      const result = await service.runQuery<{ data: string }>("SELECT * FROM empty_table");
      expect(result).toEqual([]);
    });
  });

  describe("getAggregateStats", () => {
    it("returns aggregate statistics", async () => {
      mockQueryFn
        .mockResolvedValueOnce([
          [{ total_users: 100, total_sessions: 500, overall_avg_score: 85.5 }],
        ])
        .mockResolvedValueOnce([
          [
            { exercise_type: "squat", avg_score: 80 },
            { exercise_type: "pushup", avg_score: 90 },
          ],
        ]);

      const stats = await service.getAggregateStats();
      expect(stats.totalUsers).toBe(100);
      expect(stats.totalSessions).toBe(500);
      expect(stats.avgSessionsPerUser).toBe(5);
      expect(stats.avgScoreByExercise).toEqual({
        squat: 80,
        pushup: 90,
      });
    });

    it("handles zero users", async () => {
      mockQueryFn
        .mockResolvedValueOnce([[{ total_users: 0, total_sessions: 0 }]])
        .mockResolvedValueOnce([[]]);

      const stats = await service.getAggregateStats();
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.avgSessionsPerUser).toBe(0);
      expect(stats.avgScoreByExercise).toEqual({});
    });

    it("handles missing stats row", async () => {
      mockQueryFn.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      const stats = await service.getAggregateStats();
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.avgSessionsPerUser).toBe(0);
    });
  });
});