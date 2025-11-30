/**
 * GDPR Export Service Tests
 *
 * Comprehensive tests for data export functionality
 * - collectUserData: Collect user data for export
 * - transformToExportFormat: Transform data to JSON/CSV
 * - uploadExportFile: Upload export to storage
 * - generateReadmeContent: Generate README for export
 * - createExportArchive: Create ZIP archive
 * - uploadExportArchive: Upload archive to Cloud Storage
 * - executeFullExport: Execute full export process
 * - cleanupExpiredExports: Cleanup old exports
 */

import { PassThrough } from "stream";

// Mock archiver before imports
const mockArchiverAppend = jest.fn().mockReturnThis();
const mockArchiverFinalize = jest.fn();
const mockArchiverPipe = jest.fn().mockReturnThis();
const mockArchiverOn = jest.fn();

jest.mock("archiver", () => {
  return jest.fn().mockImplementation(() => {
    const mockArchiver = {
      append: mockArchiverAppend,
      finalize: mockArchiverFinalize,
      pipe: mockArchiverPipe,
      on: mockArchiverOn,
    };
    return mockArchiver;
  });
});

// Mock gdprStorage
const mockCollectStorageData = jest.fn();
const mockGetProfileImageBuffer = jest.fn();
jest.mock("../../src/services/gdprStorage", () => ({
  collectStorageData: mockCollectStorageData,
  getProfileImageBuffer: mockGetProfileImageBuffer,
}));

// Mock gdprBigQuery
const mockCollectBigQueryData = jest.fn();
jest.mock("../../src/services/gdprBigQuery", () => ({
  collectBigQueryData: mockCollectBigQueryData,
}));

// Mock collectors
const mockCollectProfileData = jest.fn();
const mockCollectSessionsData = jest.fn();
const mockCollectConsentsData = jest.fn();
const mockCollectSettingsData = jest.fn();
const mockCollectSubscriptionsData = jest.fn();
jest.mock("../../src/services/gdpr/collectors", () => ({
  collectProfileData: mockCollectProfileData,
  collectSessionsData: mockCollectSessionsData,
  collectConsentsData: mockCollectConsentsData,
  collectSettingsData: mockCollectSettingsData,
  collectSubscriptionsData: mockCollectSubscriptionsData,
}));

// Mock @google-cloud/storage
const mockSave = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockStorageDelete = jest.fn();
const mockGetFiles = jest.fn();
const mockGetMetadata = jest.fn();
const mockFileMock = jest.fn();
const mockBucketMock = jest.fn();

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: mockBucketMock,
  })),
}));

// Mock helpers
jest.mock("../../src/services/gdpr/helpers", () => ({
  getExportBucketName: jest.fn().mockReturnValue("test-project-gdpr-exports"),
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
  collectUserData,
  transformToExportFormat,
  uploadExportFile,
  generateReadmeContent,
  generateReadmeFromData,
  createExportArchive,
  uploadExportArchive,
  executeFullExport,
  cleanupExpiredExports,
} from "../../src/services/gdprExport";
import { logger } from "../../src/utils/logger";
import { ExportData } from "../../src/types/gdpr";

describe("GDPR Export Service", () => {
  const testUserId = "test-user-123";
  const testRequestId = "export-req-456";
  const testEmail = "test@example.com";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock bucket and file
    mockFileMock.mockReturnValue({
      save: mockSave,
      getSignedUrl: mockGetSignedUrl,
      delete: mockStorageDelete,
      getMetadata: mockGetMetadata,
    });
    mockBucketMock.mockReturnValue({
      file: mockFileMock,
      getFiles: mockGetFiles,
    });
    mockSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue(["https://storage.googleapis.com/signed-url"]);
    mockGetFiles.mockResolvedValue([[]]);
    mockGetMetadata.mockResolvedValue([{ timeCreated: new Date().toISOString() }]);

    // Default successful mocks
    mockCollectProfileData.mockResolvedValue({
      nickname: "TestUser",
      email: testEmail,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-15T00:00:00Z",
    });
    mockCollectSessionsData.mockResolvedValue([
      {
        sessionId: "session-1",
        exerciseType: "squat",
        startTime: "2024-01-10T10:00:00Z",
        repCount: 10,
        totalScore: 85,
        averageScore: 8.5,
        duration: 300,
        status: "completed",
      },
    ]);
    mockCollectConsentsData.mockResolvedValue([
      {
        documentType: "terms_of_service",
        documentVersion: "1.0",
        action: "accept",
        timestamp: "2024-01-01T00:00:00Z",
      },
    ]);
    mockCollectSettingsData.mockResolvedValue({
      notificationsEnabled: true,
      language: "ja",
      theme: "light",
      units: "metric",
      analyticsEnabled: true,
      crashReportingEnabled: true,
    });
    mockCollectSubscriptionsData.mockResolvedValue([]);
    mockCollectStorageData.mockResolvedValue({});
    mockCollectBigQueryData.mockResolvedValue({
      totalSessions: 10,
      totalReps: 100,
      averageScore: 85,
      exerciseBreakdown: { squat: 5, pushup: 5 },
      weeklyProgress: [],
      monthlyTrends: [],
    });
    mockGetProfileImageBuffer.mockResolvedValue(undefined);

    // Setup archiver mock to simulate successful completion
    mockArchiverOn.mockImplementation((event: string, callback: (arg?: unknown) => void) => {
      if (event === "error") {
        // Store error callback for later if needed
      }
      return { append: mockArchiverAppend, finalize: mockArchiverFinalize, pipe: mockArchiverPipe, on: mockArchiverOn };
    });
    mockArchiverFinalize.mockImplementation(() => {
      // Simulate finalize completing
      return Promise.resolve();
    });
  });

  describe("collectUserData", () => {
    it("should collect all user data with default scope", async () => {
      const result = await collectUserData(testUserId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.exportedAt).toBeDefined();
      expect(mockCollectProfileData).toHaveBeenCalledWith(testUserId);
      expect(mockCollectSessionsData).toHaveBeenCalled();
      expect(mockCollectConsentsData).toHaveBeenCalledWith(testUserId);
    });

    it("should collect data with explicit scope", async () => {
      const result = await collectUserData(testUserId, { type: "all" });

      expect(result).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.sessions).toBeDefined();
    });

    it("should collect data with options object", async () => {
      const result = await collectUserData(testUserId, {
        scope: { type: "all" },
        includeStorage: true,
        includeAnalytics: true,
      });

      expect(result).toBeDefined();
      expect(mockCollectStorageData).toHaveBeenCalledWith(testUserId);
      expect(mockCollectBigQueryData).toHaveBeenCalledWith(testUserId);
    });

    it("should skip storage when includeStorage is false", async () => {
      mockCollectStorageData.mockClear();

      const result = await collectUserData(testUserId, {
        scope: { type: "all" },
        includeStorage: false,
        includeAnalytics: true,
      });

      expect(result).toBeDefined();
      expect(mockCollectStorageData).not.toHaveBeenCalled();
    });

    it("should skip analytics when includeAnalytics is false", async () => {
      mockCollectBigQueryData.mockClear();

      const result = await collectUserData(testUserId, {
        scope: { type: "all" },
        includeStorage: true,
        includeAnalytics: false,
      });

      expect(result).toBeDefined();
      expect(mockCollectBigQueryData).not.toHaveBeenCalled();
    });

    it("should handle missing profile data", async () => {
      mockCollectProfileData.mockResolvedValue(null);

      const result = await collectUserData(testUserId);

      expect(result.profile).toBeUndefined();
    });

    it("should handle missing settings data", async () => {
      mockCollectSettingsData.mockResolvedValue(null);

      const result = await collectUserData(testUserId);

      expect(result.settings).toBeUndefined();
    });

    it("should include storage data when profileImage exists", async () => {
      mockCollectStorageData.mockResolvedValue({
        profileImage: {
          fileName: "profile.jpg",
          contentType: "image/jpeg",
          size: 1024,
          base64Data: "base64data",
        },
      });

      const result = await collectUserData(testUserId);

      expect(result.storage).toBeDefined();
      expect(result.storage?.profileImage).toBeDefined();
    });

    it("should include storage data when mediaFiles exist", async () => {
      mockCollectStorageData.mockResolvedValue({
        mediaFiles: [{ fileName: "video.mp4", path: "path", contentType: "video/mp4", size: 1000 }],
      });

      const result = await collectUserData(testUserId);

      expect(result.storage).toBeDefined();
      expect(result.storage?.mediaFiles).toHaveLength(1);
    });

    it("should not include storage when empty", async () => {
      mockCollectStorageData.mockResolvedValue({});

      const result = await collectUserData(testUserId);

      expect(result.storage).toBeUndefined();
    });

    it("should collect data with specific dataTypes", async () => {
      const result = await collectUserData(testUserId, {
        type: "all",
        dataTypes: ["profile", "sessions"],
      });

      expect(result).toBeDefined();
      expect(mockCollectProfileData).toHaveBeenCalled();
      expect(mockCollectSessionsData).toHaveBeenCalled();
    });

    it("should use default scope when options.scope is undefined", async () => {
      // Test with options object that has no scope property
      const result = await collectUserData(testUserId, {
        includeStorage: true,
        includeAnalytics: false,
      });

      expect(result).toBeDefined();
      // Should use default scope { type: "all" } when scope is not provided
      expect(mockCollectProfileData).toHaveBeenCalled();
    });

    it("should use default includeStorage=true when not specified in options", async () => {
      const result = await collectUserData(testUserId, {
        scope: { type: "all" },
        // includeStorage not specified - should default to true
      });

      expect(result).toBeDefined();
      expect(mockCollectStorageData).toHaveBeenCalled();
    });

    it("should use default includeAnalytics=true when not specified in options", async () => {
      const result = await collectUserData(testUserId, {
        scope: { type: "all" },
        // includeAnalytics not specified - should default to true
      });

      expect(result).toBeDefined();
      expect(mockCollectBigQueryData).toHaveBeenCalled();
    });

    it("should handle options with only scope and no include flags", async () => {
      const result = await collectUserData(testUserId, {
        scope: { type: "dateRange", startDate: new Date(), endDate: new Date() },
      });

      expect(result).toBeDefined();
      // Both includeStorage and includeAnalytics should default to true
      expect(mockCollectStorageData).toHaveBeenCalled();
      expect(mockCollectBigQueryData).toHaveBeenCalled();
    });
  });

  describe("transformToExportFormat", () => {
    const testData: ExportData = {
      exportedAt: "2024-01-15T10:00:00Z",
      userId: testUserId,
      format: "json",
      profile: {
        nickname: "TestUser",
        email: testEmail,
      },
      sessions: [
        {
          sessionId: "session-1",
          exerciseType: "squat",
          startTime: "2024-01-10T10:00:00Z",
          repCount: 10,
          totalScore: 85,
          averageScore: 8.5,
          duration: 300,
          status: "completed",
        },
      ],
      consents: [],
    };

    it("should transform data to JSON format", () => {
      const result = transformToExportFormat(testData, "json");

      expect(result).toContain("TestUser");
      expect(result).toContain("session-1");
      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should transform data to CSV format", () => {
      const result = transformToExportFormat(testData, "csv");

      // CSV should be a string
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle empty sessions array", () => {
      const emptyData = { ...testData, sessions: [] };
      const result = transformToExportFormat(emptyData, "json");

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should set format in data", () => {
      const dataCopy = { ...testData };
      transformToExportFormat(dataCopy, "csv");

      expect(dataCopy.format).toBe("csv");
    });
  });

  describe("generateReadmeContent", () => {
    it("should generate README content with all parameters", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["profile", "sessions"],
      );

      expect(readme).toContain("AI Fitness App");
      expect(readme).toContain("GDPR");
      expect(readme).toContain("JSON");
    });

    it("should include profile description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["profile"],
      );

      expect(readme).toContain("profile");
    });

    it("should include sessions description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["sessions"],
      );

      expect(readme).toContain("sessions");
    });

    it("should include consents description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["consents"],
      );

      expect(readme).toContain("consents");
    });

    it("should include settings description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["settings"],
      );

      expect(readme).toContain("settings");
    });

    it("should include subscriptions description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["subscriptions"],
      );

      expect(readme).toContain("subscriptions");
    });

    it("should include analytics description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["analytics"],
      );

      expect(readme).toContain("analytics");
    });

    it("should include media description when in scopes", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["media"],
      );

      expect(readme).toContain("media");
    });

    it("should show CSV format description", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "csv",
        ["profile"],
      );

      expect(readme).toContain("CSV");
      expect(readme).toContain("Excel");
    });

    it("should show JSON format description", () => {
      const readme = generateReadmeContent(
        testUserId,
        "2024-01-15T10:00:00Z",
        "json",
        ["profile"],
      );

      expect(readme).toContain("JSON");
    });
  });

  describe("generateReadmeFromData", () => {
    it("should generate README from data", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        profile: { nickname: "TestUser" },
        sessions: [{ sessionId: "session-1" }],
        consents: [],
      };

      const readme = generateReadmeFromData(testData, "json");

      expect(readme).toContain("AI Fitness App");
    });

    it("should include format in README", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
      };

      const jsonReadme = generateReadmeFromData(testData, "json");
      const csvReadme = generateReadmeFromData(testData, "csv");

      expect(jsonReadme).toContain("JSON");
      expect(csvReadme).toContain("CSV");
    });

    it("should detect profile in scopes", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        profile: { nickname: "Test" },
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("profile");
    });

    it("should detect sessions in scopes when not empty", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        sessions: [{ sessionId: "s1" }],
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("sessions");
    });

    it("should detect consents in scopes when not empty", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        consents: [{ documentType: "tos" }],
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("consents");
    });

    it("should detect settings in scopes", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        settings: { theme: "dark" },
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("settings");
    });

    it("should detect subscriptions in scopes when not empty", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        subscriptions: [{ plan: "pro" }],
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("subscriptions");
    });

    it("should detect analytics in scopes", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        analytics: { totalSessions: 10 },
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("analytics");
    });

    it("should detect media in scopes when profileImage exists", () => {
      const testData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "json",
        storage: { profileImage: { fileName: "p.jpg" } },
      };

      const readme = generateReadmeFromData(testData, "json");
      expect(readme).toContain("media");
    });
  });

  describe("uploadExportFile", () => {
    it("should upload file to storage and return result", async () => {
      const content = "test content";

      const result = await uploadExportFile(testUserId, testRequestId, content, "json");

      expect(result.downloadUrl).toBe("https://storage.googleapis.com/signed-url");
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.fileSizeBytes).toBe(Buffer.byteLength(content, "utf8"));
      expect(mockSave).toHaveBeenCalled();
    });

    it("should set correct content type for JSON", async () => {
      await uploadExportFile(testUserId, testRequestId, "content", "json");

      expect(mockSave).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contentType: "application/json",
        }),
      );
    });

    it("should set correct content type for CSV", async () => {
      await uploadExportFile(testUserId, testRequestId, "content", "csv");

      expect(mockSave).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contentType: "text/csv",
        }),
      );
    });

    it("should throw error on upload failure", async () => {
      mockSave.mockRejectedValue(new Error("Upload failed"));

      await expect(
        uploadExportFile(testUserId, testRequestId, "content", "json"),
      ).rejects.toThrow("Upload failed");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("createExportArchive", () => {
    const exportData: ExportData = {
      exportedAt: "2024-01-15T10:00:00Z",
      userId: testUserId,
      format: "json",
      profile: { nickname: "TestUser" },
      sessions: [],
      consents: [],
    };

    beforeEach(() => {
      // Setup mock to simulate PassThrough stream behavior
      mockArchiverPipe.mockImplementation((stream: PassThrough) => {
        // Simulate archive data being written
        setTimeout(() => {
          stream.write(Buffer.from("mock zip data"));
          stream.end();
        }, 10);
        return { append: mockArchiverAppend, finalize: mockArchiverFinalize, pipe: mockArchiverPipe, on: mockArchiverOn };
      });
    });

    it("should create ZIP archive", async () => {
      const result = await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: exportData,
        format: "json",
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(mockArchiverAppend).toHaveBeenCalled();
      expect(mockArchiverFinalize).toHaveBeenCalled();
    });

    it("should include README when includeReadme is true", async () => {
      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: exportData,
        format: "json",
        includeReadme: true,
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.stringContaining("AI Fitness App"),
        expect.objectContaining({ name: expect.stringContaining("README.txt") }),
      );
    });

    it("should skip README when includeReadme is false", async () => {
      mockArchiverAppend.mockClear();

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: exportData,
        format: "json",
        includeReadme: false,
      });

      // Should not have README appended
      const readmeCalls = mockArchiverAppend.mock.calls.filter(
        (call) => call[1]?.name?.includes("README"),
      );
      expect(readmeCalls.length).toBe(0);
    });

    it("should include profile image when provided", async () => {
      const profileImageBuffer = Buffer.from("fake image");

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: exportData,
        format: "json",
        profileImageBuffer,
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        profileImageBuffer,
        expect.objectContaining({ name: expect.stringContaining("profile_image") }),
      );
    });

    it("should include profile data", async () => {
      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: exportData,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.stringContaining("TestUser"),
        expect.objectContaining({ name: expect.stringContaining("profile.json") }),
      );
    });

    it("should include sessions data when present", async () => {
      const dataWithSessions: ExportData = {
        ...exportData,
        sessions: [{ sessionId: "s1", exerciseType: "squat" }],
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithSessions,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("sessions.json") }),
      );
    });

    it("should include consents data when present", async () => {
      const dataWithConsents: ExportData = {
        ...exportData,
        consents: [{ documentType: "tos" }],
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithConsents,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("consents.json") }),
      );
    });

    it("should include settings data when present", async () => {
      const dataWithSettings: ExportData = {
        ...exportData,
        settings: { theme: "dark" },
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithSettings,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("settings.json") }),
      );
    });

    it("should include subscriptions data when present", async () => {
      const dataWithSubscriptions: ExportData = {
        ...exportData,
        subscriptions: [{ plan: "pro" }],
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithSubscriptions,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("subscriptions.json") }),
      );
    });

    it("should include analytics data when present", async () => {
      const dataWithAnalytics: ExportData = {
        ...exportData,
        analytics: { totalSessions: 10 },
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithAnalytics,
        format: "json",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("analytics.json") }),
      );
    });

    it("should create CSV format archive with proper profile data", async () => {
      // Provide complete profile data for CSV conversion
      const csvExportData: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "csv",
        profile: {
          nickname: "TestUser",
          email: "test@example.com",
          displayName: "Test User",
          gender: "male",
          birthYear: 1990,
          heightCm: 175,
          weightKg: 70,
          fitnessGoal: "fitness",
          fitnessLevel: "intermediate",
        },
        sessions: [],
        consents: [],
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: csvExportData,
        format: "csv",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining(".csv") }),
      );
    });

    it("should include subscriptions in CSV format", async () => {
      // Provide complete data for CSV conversion (profile needs all fields)
      const dataWithSubscriptions: ExportData = {
        exportedAt: "2024-01-15T10:00:00Z",
        userId: testUserId,
        format: "csv",
        profile: {
          nickname: "TestUser",
          email: "test@example.com",
          displayName: "Test User",
          gender: "male",
          birthYear: 1990,
          heightCm: 175,
          weightKg: 70,
          fitnessGoal: "fitness",
          fitnessLevel: "intermediate",
        },
        sessions: [],
        consents: [],
        subscriptions: [
          {
            subscriptionId: "sub_123",
            productId: "premium_monthly",
            status: "active",
            platform: "ios",
            startDate: "2024-01-01T00:00:00Z",
            endDate: "2024-02-01T00:00:00Z",
            autoRenew: true,
          },
        ],
      };

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithSubscriptions,
        format: "csv",
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: expect.stringContaining("subscriptions.csv") }),
      );
    });

    it("should use png extension for PNG profile image", async () => {
      const dataWithPngProfile: ExportData = {
        ...exportData,
        storage: { profileImage: { contentType: "image/png" } },
      };
      const profileImageBuffer = Buffer.from("png image");

      await createExportArchive({
        userId: testUserId,
        requestId: testRequestId,
        data: dataWithPngProfile,
        format: "json",
        profileImageBuffer,
      });

      expect(mockArchiverAppend).toHaveBeenCalledWith(
        profileImageBuffer,
        expect.objectContaining({ name: expect.stringContaining(".png") }),
      );
    });

    it("should handle archiver error", async () => {
      mockArchiverOn.mockImplementation((event: string, callback: (err?: Error) => void) => {
        if (event === "error") {
          setTimeout(() => callback(new Error("Archive error")), 5);
        }
        return { append: mockArchiverAppend, finalize: mockArchiverFinalize, pipe: mockArchiverPipe, on: mockArchiverOn };
      });

      await expect(
        createExportArchive({
          userId: testUserId,
          requestId: testRequestId,
          data: exportData,
          format: "json",
        }),
      ).rejects.toThrow("Archive error");
    });
  });

  describe("uploadExportArchive", () => {
    it("should upload archive to storage", async () => {
      const archiveBuffer = Buffer.from("fake archive");

      const result = await uploadExportArchive(testUserId, testRequestId, archiveBuffer);

      expect(result.downloadUrl).toBe("https://storage.googleapis.com/signed-url");
      expect(result.fileSizeBytes).toBe(archiveBuffer.length);
      expect(mockSave).toHaveBeenCalledWith(archiveBuffer, expect.any(Object));
    });

    it("should set correct content type", async () => {
      const archiveBuffer = Buffer.from("fake archive");

      await uploadExportArchive(testUserId, testRequestId, archiveBuffer);

      expect(mockSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          contentType: "application/zip",
        }),
      );
    });

    it("should return expiration date", async () => {
      const archiveBuffer = Buffer.from("fake archive");

      const result = await uploadExportArchive(testUserId, testRequestId, archiveBuffer);

      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should throw error on upload failure", async () => {
      mockSave.mockRejectedValue(new Error("Upload failed"));

      await expect(
        uploadExportArchive(testUserId, testRequestId, Buffer.from("data")),
      ).rejects.toThrow("Upload failed");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("executeFullExport", () => {
    beforeEach(() => {
      // Setup mock to simulate PassThrough stream behavior
      mockArchiverPipe.mockImplementation((stream: PassThrough) => {
        setTimeout(() => {
          stream.write(Buffer.from("mock zip data"));
          stream.end();
        }, 10);
        return { append: mockArchiverAppend, finalize: mockArchiverFinalize, pipe: mockArchiverPipe, on: mockArchiverOn };
      });
    });

    it("should execute full export process", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBeDefined();
      expect(mockCollectProfileData).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it("should return record count", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.recordCount).toBeGreaterThanOrEqual(0);
    });

    it("should return file size", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.fileSizeBytes).toBeGreaterThan(0);
    });

    it("should return expiration date", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should handle export failure", async () => {
      mockCollectProfileData.mockRejectedValue(new Error("Collection failed"));

      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it("should include profile image when available", async () => {
      mockGetProfileImageBuffer.mockResolvedValue(Buffer.from("image"));

      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(true);
      expect(mockGetProfileImageBuffer).toHaveBeenCalledWith(testUserId);
    });
  });

  describe("cleanupExpiredExports", () => {
    it("should cleanup expired exports", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const expiredFiles = [
        {
          name: "exports/user1/export1.zip",
          getMetadata: jest.fn().mockResolvedValue([{ timeCreated: oldDate.toISOString() }]),
          delete: mockStorageDelete,
        },
        {
          name: "exports/user2/export2.zip",
          getMetadata: jest.fn().mockResolvedValue([{ timeCreated: oldDate.toISOString() }]),
          delete: mockStorageDelete,
        },
      ];
      mockGetFiles.mockResolvedValue([expiredFiles]);
      mockStorageDelete.mockResolvedValue(undefined);

      const result = await cleanupExpiredExports(7);

      expect(result).toBe(2);
      expect(mockStorageDelete).toHaveBeenCalledTimes(2);
    });

    it("should not delete files newer than cutoff", async () => {
      const recentDate = new Date();

      const recentFiles = [
        {
          name: "exports/user1/export1.zip",
          getMetadata: jest.fn().mockResolvedValue([{ timeCreated: recentDate.toISOString() }]),
          delete: mockStorageDelete,
        },
      ];
      mockGetFiles.mockResolvedValue([recentFiles]);

      const result = await cleanupExpiredExports(7);

      expect(result).toBe(0);
      expect(mockStorageDelete).not.toHaveBeenCalled();
    });

    it("should return 0 when no files exist", async () => {
      mockGetFiles.mockResolvedValue([[]]);

      const result = await cleanupExpiredExports(7);

      expect(result).toBe(0);
    });

    it("should use default days (3) when not specified", async () => {
      mockGetFiles.mockResolvedValue([[]]);

      const result = await cleanupExpiredExports();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalled();
    });

    it("should handle file processing error gracefully", async () => {
      const files = [
        {
          name: "exports/user1/export1.zip",
          getMetadata: jest.fn().mockRejectedValue(new Error("Metadata error")),
          delete: mockStorageDelete,
        },
      ];
      mockGetFiles.mockResolvedValue([files]);

      const result = await cleanupExpiredExports(7);

      expect(result).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should return 0 on getFiles error", async () => {
      mockGetFiles.mockRejectedValue(new Error("Storage error"));

      const result = await cleanupExpiredExports(7);

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Data format validation", () => {
    beforeEach(() => {
      mockArchiverPipe.mockImplementation((stream: PassThrough) => {
        setTimeout(() => {
          stream.write(Buffer.from("mock zip data"));
          stream.end();
        }, 10);
        return { append: mockArchiverAppend, finalize: mockArchiverFinalize, pipe: mockArchiverPipe, on: mockArchiverOn };
      });
    });

    it("should create valid JSON export", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(true);
    });

    it("should create valid CSV export", async () => {
      const result = await executeFullExport(testUserId, testRequestId, "csv", { type: "all" });

      expect(result.success).toBe(true);
    });

    it("should handle null values in data", async () => {
      mockCollectProfileData.mockResolvedValue(null);
      mockCollectSettingsData.mockResolvedValue(null);

      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(true);
    });

    it("should handle empty arrays", async () => {
      mockCollectSessionsData.mockResolvedValue([]);
      mockCollectConsentsData.mockResolvedValue([]);
      mockCollectSubscriptionsData.mockResolvedValue([]);

      const result = await executeFullExport(testUserId, testRequestId, "json", { type: "all" });

      expect(result.success).toBe(true);
    });
  });
});
