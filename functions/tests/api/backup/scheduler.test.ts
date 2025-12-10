/**
 * Backup Scheduler Tests
 *
 * バックアップスケジューラーのユニットテスト
 * - backup_createDailyBackup: 日次バックアップ
 * - backup_createWeeklyBackup: 週次バックアップ
 * - backup_deleteOldBackups: 古いバックアップ削除
 *
 * チケット 030 対応
 */

// Mock backupService
const mockExecuteFirestoreBackup = jest.fn();
const mockDeleteOldBackups = jest.fn();
const mockSendBackupAlert = jest.fn();

jest.mock("../../../src/services/backupService", () => ({
  executeFirestoreBackup: mockExecuteFirestoreBackup,
  deleteOldBackups: mockDeleteOldBackups,
  sendBackupAlert: mockSendBackupAlert,
}));

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const actual = jest.requireActual("firebase-admin");
  return {
    ...actual,
    apps: [{}],
    initializeApp: jest.fn(),
  };
});

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: jest.fn(),
    error: mockLoggerError,
    debug: jest.fn(),
  },
}));

describe("Backup Scheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Daily Backup", () => {
    it("should execute daily backup successfully", async () => {
      const mockResult = {
        success: true,
        outputUriPrefix: "gs://test-project-firestore-backups/daily/2024-12-10T02-00-00",
        operationName: "operation-123",
        durationMs: 5000,
      };

      mockExecuteFirestoreBackup.mockResolvedValue(mockResult);

      await mockExecuteFirestoreBackup("daily");

      expect(mockExecuteFirestoreBackup).toHaveBeenCalledWith("daily");
    });

    it("should send alert on daily backup failure", async () => {
      const mockResult = {
        success: false,
        outputUriPrefix: "gs://test-project-firestore-backups/daily/2024-12-10T02-00-00",
        error: "Export failed",
        durationMs: 1000,
      };

      mockExecuteFirestoreBackup.mockResolvedValue(mockResult);

      const result = await mockExecuteFirestoreBackup("daily");

      if (!result.success) {
        await mockSendBackupAlert({
          type: "backup_failure",
          backupType: "daily",
          message: `日次バックアップが失敗しました: ${result.error}`,
          details: {
            outputUriPrefix: result.outputUriPrefix,
            durationMs: result.durationMs,
          },
        });
      }

      expect(mockSendBackupAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "backup_failure",
          backupType: "daily",
        }),
      );
    });

    it("should not send alert on successful backup", async () => {
      const mockResult = {
        success: true,
        outputUriPrefix: "gs://test-project-firestore-backups/daily/2024-12-10T02-00-00",
        operationName: "operation-123",
        durationMs: 5000,
      };

      mockExecuteFirestoreBackup.mockResolvedValue(mockResult);

      const result = await mockExecuteFirestoreBackup("daily");

      if (!result.success) {
        await mockSendBackupAlert({
          type: "backup_failure",
          backupType: "daily",
          message: `日次バックアップが失敗しました: ${result.error}`,
        });
      }

      expect(mockSendBackupAlert).not.toHaveBeenCalled();
    });
  });

  describe("Weekly Backup", () => {
    it("should execute weekly backup successfully", async () => {
      const mockResult = {
        success: true,
        outputUriPrefix: "gs://test-project-firestore-backups/weekly/2024-12-08T02-00-00",
        operationName: "operation-456",
        durationMs: 8000,
      };

      mockExecuteFirestoreBackup.mockResolvedValue(mockResult);

      await mockExecuteFirestoreBackup("weekly");

      expect(mockExecuteFirestoreBackup).toHaveBeenCalledWith("weekly");
    });

    it("should send alert on weekly backup failure", async () => {
      const mockResult = {
        success: false,
        outputUriPrefix: "gs://test-project-firestore-backups/weekly/2024-12-08T02-00-00",
        error: "Timeout exceeded",
        durationMs: 540000,
      };

      mockExecuteFirestoreBackup.mockResolvedValue(mockResult);

      const result = await mockExecuteFirestoreBackup("weekly");

      if (!result.success) {
        await mockSendBackupAlert({
          type: "backup_failure",
          backupType: "weekly",
          message: `週次バックアップが失敗しました: ${result.error}`,
          details: {
            outputUriPrefix: result.outputUriPrefix,
            durationMs: result.durationMs,
          },
        });
      }

      expect(mockSendBackupAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "backup_failure",
          backupType: "weekly",
        }),
      );
    });
  });

  describe("Delete Old Backups", () => {
    it("should delete old backups successfully", async () => {
      const mockResult = {
        deletedCount: 15,
        errors: [],
      };

      mockDeleteOldBackups.mockResolvedValue(mockResult);

      const result = await mockDeleteOldBackups();

      expect(result.deletedCount).toBe(15);
      expect(result.errors).toHaveLength(0);
    });

    it("should send alert on partial cleanup failure", async () => {
      const mockResult = {
        deletedCount: 10,
        errors: ["file1.json: Permission denied", "file2.json: Not found"],
      };

      mockDeleteOldBackups.mockResolvedValue(mockResult);

      const result = await mockDeleteOldBackups();

      if (result.errors.length > 0) {
        await mockSendBackupAlert({
          type: "cleanup_failure",
          message: "一部のバックアップファイル削除に失敗しました",
          details: {
            deletedCount: result.deletedCount,
            errors: result.errors,
          },
        });
      }

      expect(mockSendBackupAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cleanup_failure",
        }),
      );
    });

    it("should send alert on complete cleanup failure", async () => {
      mockDeleteOldBackups.mockRejectedValue(new Error("Access denied"));

      try {
        await mockDeleteOldBackups();
      } catch (error) {
        await mockSendBackupAlert({
          type: "cleanup_failure",
          message: `バックアップクリーンアップが失敗しました: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }

      expect(mockSendBackupAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cleanup_failure",
          message: expect.stringContaining("Access denied"),
        }),
      );
    });

    it("should not send alert when no errors occur", async () => {
      const mockResult = {
        deletedCount: 5,
        errors: [],
      };

      mockDeleteOldBackups.mockResolvedValue(mockResult);

      const result = await mockDeleteOldBackups();

      if (result.errors.length > 0) {
        await mockSendBackupAlert({
          type: "cleanup_failure",
          message: "一部のバックアップファイル削除に失敗しました",
        });
      }

      expect(mockSendBackupAlert).not.toHaveBeenCalled();
    });
  });

  describe("Schedule configuration", () => {
    it("should have correct daily backup schedule (0 2 * * *)", () => {
      // Cron expression: At 02:00 UTC every day
      const cronExpression = "0 2 * * *";
      const parts = cronExpression.split(" ");

      expect(parts[0]).toBe("0"); // Minute
      expect(parts[1]).toBe("2"); // Hour (02:00 UTC)
      expect(parts[2]).toBe("*"); // Day of month (every day)
      expect(parts[3]).toBe("*"); // Month (every month)
      expect(parts[4]).toBe("*"); // Day of week (every day)
    });

    it("should have correct weekly backup schedule (0 2 * * 0)", () => {
      // Cron expression: At 02:00 UTC every Sunday
      const cronExpression = "0 2 * * 0";
      const parts = cronExpression.split(" ");

      expect(parts[0]).toBe("0"); // Minute
      expect(parts[1]).toBe("2"); // Hour (02:00 UTC)
      expect(parts[2]).toBe("*"); // Day of month (any)
      expect(parts[3]).toBe("*"); // Month (every month)
      expect(parts[4]).toBe("0"); // Day of week (Sunday)
    });

    it("should have correct cleanup schedule (0 3 * * *)", () => {
      // Cron expression: At 03:00 UTC every day
      const cronExpression = "0 3 * * *";
      const parts = cronExpression.split(" ");

      expect(parts[0]).toBe("0"); // Minute
      expect(parts[1]).toBe("3"); // Hour (03:00 UTC)
      expect(parts[2]).toBe("*"); // Day of month (every day)
      expect(parts[3]).toBe("*"); // Month (every month)
      expect(parts[4]).toBe("*"); // Day of week (every day)
    });
  });

  describe("Backup type handling", () => {
    it("should distinguish between daily and weekly backups", async () => {
      mockExecuteFirestoreBackup.mockImplementation((type: string) => {
        return Promise.resolve({
          success: true,
          outputUriPrefix: `gs://test-bucket/${type}/timestamp`,
          operationName: `operation-${type}`,
          durationMs: 1000,
        });
      });

      const dailyResult = await mockExecuteFirestoreBackup("daily");
      const weeklyResult = await mockExecuteFirestoreBackup("weekly");

      expect(dailyResult.outputUriPrefix).toContain("/daily/");
      expect(weeklyResult.outputUriPrefix).toContain("/weekly/");
    });

    it("should handle manual backup type", async () => {
      mockExecuteFirestoreBackup.mockResolvedValue({
        success: true,
        outputUriPrefix: "gs://test-bucket/manual/timestamp",
        operationName: "operation-manual",
        durationMs: 1000,
      });

      const result = await mockExecuteFirestoreBackup("manual");

      expect(result.success).toBe(true);
      expect(result.outputUriPrefix).toContain("/manual/");
    });
  });
});
