/**
 * Export Data API Tests
 */

import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

jest.mock("firebase-admin");
jest.mock("../../src/middleware/rateLimiter");
jest.mock("../../src/middleware/reauth");
jest.mock("../../src/services/cloudTasks");
jest.mock("../../src/services/accessLog");
jest.mock("../../src/services/auditLog");
jest.mock("../../src/services/gdprService");

import { gdpr_requestDataExport, gdpr_getExportStatus } from "../../src/api/gdpr/exportData";

describe("Export Data API", () => {
  const mockFirestore = admin.firestore() as jest.Mocked<admin.firestore.Firestore>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("gdpr_requestDataExport", () => {
    it("should create export request for authenticated user", async () => {
      const request = {
        data: { format: "json", scope: { type: "all" } },
        auth: { uid: "test-uid" },
        rawRequest: { headers: {} },
      };

      const mockDoc = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDoc),
      });

      const result = await (gdpr_requestDataExport as any)(request);

      expect(result).toHaveProperty("requestId");
      expect(result.status).toBe("pending");
    });

    it("should reject unauthenticated requests", async () => {
      const request = {
        data: { format: "json" },
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect((gdpr_requestDataExport as any)(request)).rejects.toThrow();
    });
  });

  describe("gdpr_getExportStatus", () => {
    it("should return status for own requests", async () => {
      const exportRequest = {
        userId: "test-uid",
        requestId: "export_123",
        status: "completed",
        downloadUrl: "https://example.com/download",
      };

      const mockDoc = {
        exists: true,
        data: () => exportRequest,
      };

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc),
        }),
      });

      const request = {
        data: { requestId: "export_123" },
        auth: { uid: "test-uid" },
        rawRequest: { headers: {} },
      };

      const result = await (gdpr_getExportStatus as any)(request);

      expect(result.requestId).toBe("export_123");
      expect(result.status).toBe("completed");
    });

    it("should reject access to other user requests", async () => {
      const exportRequest = {
        userId: "other-user",
        requestId: "export_123",
        status: "completed",
      };

      const mockDoc = {
        exists: true,
        data: () => exportRequest,
      };

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc),
        }),
      });

      const request = {
        data: { requestId: "export_123" },
        auth: { uid: "test-uid" },
        rawRequest: { headers: {} },
      };

      await expect((gdpr_getExportStatus as any)(request)).rejects.toThrow(HttpsError);
    });
  });
});
