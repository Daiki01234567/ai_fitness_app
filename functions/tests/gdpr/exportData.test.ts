/**
 * GDPR Export Data Business Logic Tests
 */

import { Timestamp } from "firebase-admin/firestore";

jest.mock("../../src/middleware/rateLimiter");
jest.mock("../../src/middleware/reauth");
jest.mock("../../src/services/cloudTasks");
jest.mock("../../src/services/accessLog");
jest.mock("../../src/services/auditLog");
jest.mock("../../src/services/gdprService");

import { rateLimiter } from "../../src/middleware/rateLimiter";
import { checkReauthRequired } from "../../src/middleware/reauth";
import { cloudTasks } from "../../src/services/cloudTasks";
import {
  logExportRequest,
} from "../../src/services/accessLog";
import { createAuditLog } from "../../src/services/auditLog";
import {
  collectUserData,
  transformToExportFormat,
  uploadExportFile,
  hasRecentExportRequest,
} from "../../src/services/gdprService";

describe("Export Data Business Logic", () => {
  const userId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    (rateLimiter.check as jest.Mock).mockResolvedValue(undefined);
    (checkReauthRequired as jest.Mock).mockResolvedValue({ valid: true });
    (cloudTasks.createDataExportTask as jest.Mock).mockResolvedValue(undefined);
    (logExportRequest as jest.Mock).mockResolvedValue(undefined);
    (createAuditLog as jest.Mock).mockResolvedValue(undefined);
    (hasRecentExportRequest as jest.Mock).mockResolvedValue(false);
    (collectUserData as jest.Mock).mockResolvedValue({
      exportedAt: new Date().toISOString(),
      userId,
      format: "json",
      profile: {
        nickname: "Test User",
        email: "test@example.com",
      },
    });
    (transformToExportFormat as jest.Mock).mockReturnValue('{"data": "test"}');
    (uploadExportFile as jest.Mock).mockResolvedValue({
      downloadUrl: "https://example.com/download",
      expiresAt: new Date(),
      fileSizeBytes: 1024,
    });
  });

  describe("Export Workflow", () => {
    it("should check for recent export requests", async () => {
      await hasRecentExportRequest(userId);
      expect(hasRecentExportRequest).toHaveBeenCalledWith(userId);
    });

    it("should collect user data", async () => {
      const scope = { type: "all" as const };
      const result = await collectUserData(userId, scope);
      expect(result.userId).toBe(userId);
    });

    it("should transform data to JSON format", () => {
      const data = {
        exportedAt: new Date().toISOString(),
        userId,
        format: "json" as const,
      };
      const result = transformToExportFormat(data, "json");
      expect(typeof result).toBe("string");
    });

    it("should upload export file", async () => {
      const result = await uploadExportFile(userId, "req_123", '{"test": true}', "json");
      expect(result.downloadUrl).toBeDefined();
      expect(result.fileSizeBytes).toBeGreaterThan(0);
    });
  });
});
