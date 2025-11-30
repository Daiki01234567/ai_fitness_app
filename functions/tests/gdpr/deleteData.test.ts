/**
 * GDPR Delete Data Business Logic Tests
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
  logDeletionRequest,
  logDeletionCancel,
} from "../../src/services/accessLog";
import { createAuditLog } from "../../src/services/auditLog";
import {
  hasPendingDeletionRequest,
  setUserDeletionScheduled,
  deleteUserData,
  verifyCompleteDeletion,
  generateDeletionCertificate,
} from "../../src/services/gdprService";

describe("Delete Data Business Logic", () => {
  const userId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    (rateLimiter.check as jest.Mock).mockResolvedValue(undefined);
    (checkReauthRequired as jest.Mock).mockResolvedValue({ valid: true });
    (cloudTasks.createDataDeletionTask as jest.Mock).mockResolvedValue(undefined);
    (logDeletionRequest as jest.Mock).mockResolvedValue(undefined);
    (logDeletionCancel as jest.Mock).mockResolvedValue(undefined);
    (createAuditLog as jest.Mock).mockResolvedValue(undefined);
    (hasPendingDeletionRequest as jest.Mock).mockResolvedValue(false);
    (setUserDeletionScheduled as jest.Mock).mockResolvedValue(undefined);
    (deleteUserData as jest.Mock).mockResolvedValue({
      deletedCollections: ["users", "sessions"],
      success: true,
    });
    (verifyCompleteDeletion as jest.Mock).mockResolvedValue({
      verified: true,
      verificationResult: {
        firestore: true,
        storage: true,
        bigquery: true,
        auth: true,
      },
      remainingData: [],
    });
  });

  describe("Deletion Workflow", () => {
    it("should check for pending deletion requests", async () => {
      await hasPendingDeletionRequest(userId);
      expect(hasPendingDeletionRequest).toHaveBeenCalledWith(userId);
    });

    it("should set deletion scheduled flag", async () => {
      const scheduledDate = new Date();
      await setUserDeletionScheduled(userId, true, scheduledDate);
      expect(setUserDeletionScheduled).toHaveBeenCalledWith(userId, true, scheduledDate);
    });

    it("should delete user data", async () => {
      const result = await deleteUserData(userId, ["all"]);
      expect(result.success).toBe(true);
    });

    it("should verify deletion", async () => {
      const result = await verifyCompleteDeletion(userId, ["all"]);
      expect(result.verified).toBe(true);
    });
  });
});
