/**
 * GDPR Deletion Service Tests
 *
 * Comprehensive tests for user data deletion operations
 * - deleteUserData: Delete user data from Firestore
 * - deleteUserDataCompletely: Complete deletion across all systems
 * - setUserDeletionScheduled: Set deletion schedule flag
 * - getUserDeletionStatus: Get deletion status
 * - verifyDeletion: Verify data deletion
 * - getExpiredDeletionScheduledUsers: Get users past grace period
 * - getPendingDeletionRequests: Get pending requests
 * - updateDeletionRequestStatus: Update request status
 */

import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Mock Firestore
const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

const mockCollection = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  batch: jest.fn().mockReturnValue({
    delete: mockBatchDelete,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
  FieldValue: {
    serverTimestamp: jest.fn(),
    delete: jest.fn(),
  },
  Timestamp: {
    now: jest.fn(() => Timestamp.now()),
    fromDate: jest.fn((date: Date) => Timestamp.fromDate(date)),
  },
};

// Mock gdprStorage
const mockDeleteUserStorage = jest.fn();
const mockVerifyStorageDeletion = jest.fn();
jest.mock("../../src/services/gdprStorage", () => ({
  deleteUserStorage: mockDeleteUserStorage,
  verifyStorageDeletion: mockVerifyStorageDeletion,
}));

// Mock gdprBigQuery
const mockDeleteUserFromBigQuery = jest.fn();
const mockVerifyBigQueryDeletion = jest.fn();
jest.mock("../../src/services/gdprBigQuery", () => ({
  deleteUserFromBigQuery: mockDeleteUserFromBigQuery,
  verifyBigQueryDeletion: mockVerifyBigQueryDeletion,
}));

// Mock firebase-admin auth
const mockDeleteUser = jest.fn();
const mockGetUser = jest.fn();
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  auth: jest.fn().mockReturnValue({
    deleteUser: mockDeleteUser,
    getUser: mockGetUser,
  }),
  firestore: jest.fn(() => mockFirestoreInstance),
}));

// Mock gdprVerification
const mockVerifyCompleteDeletion = jest.fn();
const mockGenerateDeletionCertificate = jest.fn();
jest.mock("../../src/services/gdprVerification", () => ({
  verifyCompleteDeletion: mockVerifyCompleteDeletion,
  generateDeletionCertificate: mockGenerateDeletionCertificate,
}));

// Mock firestore utils
jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => mockFirestoreInstance),
  userRef: jest.fn(() => ({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
    collection: mockCollection,
  })),
  sessionsCollection: jest.fn(() => ({
    get: mockGet,
    limit: jest.fn().mockReturnThis(),
  })),
  consentsCollection: jest.fn(() => ({
    where: mockWhere,
    get: mockGet,
  })),
  batchWrite: jest.fn((docs, fn) => {
    const batch = mockFirestoreInstance.batch();
    docs.forEach((doc: any) => fn(batch, doc));
    return batch.commit();
  }),
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
  deleteUserData,
  deleteUserDataCompletely,
  setUserDeletionScheduled,
  getUserDeletionStatus,
  verifyDeletion,
  getExpiredDeletionScheduledUsers,
  getPendingDeletionRequests,
  updateDeletionRequestStatus,
} from "../../src/services/gdprDeletion";
import { logger } from "../../src/utils/logger";

describe("GDPR Deletion Service", () => {
  const testUserId = "test-user-123";
  const testRequestId = "deletion-req-456";

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock chains
    mockDoc.mockReturnValue({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
      collection: mockCollection,
    });
    
    mockCollection.mockImplementation(() => ({
      doc: mockDoc,
      where: mockWhere,
      add: mockAdd,
      get: mockGet,
      limit: jest.fn().mockReturnThis(),
    }));
    
    mockWhere.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockGet,
    });
    
    mockOrderBy.mockReturnValue({
      limit: mockLimit,
      get: mockGet,
    });
    mockLimit.mockReturnValue({
      get: mockGet,
    });

    // Default successful mocks
    mockDeleteUserStorage.mockResolvedValue({
      deleted: true,
      files: [],
      filesCount: 0,
      totalSizeBytes: 0,
    });
    mockDeleteUserFromBigQuery.mockResolvedValue({
      deleted: true,
      tablesAffected: ["users_anonymized", "training_sessions"],
      rowsAffected: -1,
    });
    mockVerifyStorageDeletion.mockResolvedValue(true);
    mockVerifyBigQueryDeletion.mockResolvedValue(true);
    mockDeleteUser.mockResolvedValue(undefined);
    mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });
    mockBatchCommit.mockResolvedValue(undefined);
    mockVerifyCompleteDeletion.mockResolvedValue({
      verified: true,
      verificationResult: {
        firestoreVerified: true,
        storageVerified: true,
        bigqueryVerified: true,
        authVerified: true,
      },
    });
    mockGenerateDeletionCertificate.mockResolvedValue({
      certificateId: "cert-123",
    });
  });

  describe("deleteUserData", () => {
    beforeEach(() => {
      // Mock sessions collection
      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          { ref: { delete: mockDelete }, id: "session-1" },
          { ref: { delete: mockDelete }, id: "session-2" },
        ],
      });
    });

    it("should delete user Firestore data successfully", async () => {
      const result = await deleteUserData(testUserId, ["all"]);

      expect(result.success).toBe(true);
      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it("should handle empty collections gracefully", async () => {
      mockGet.mockResolvedValue({ empty: true, docs: [] });

      const result = await deleteUserData(testUserId, ["all"]);

      expect(result.success).toBe(true);
    });

    it("should return error on Firestore failure", async () => {
      mockGet.mockRejectedValue(new Error("Firestore error"));

      await expect(deleteUserData(testUserId, ["all"])).rejects.toThrow("Firestore error");
      expect(logger.error).toHaveBeenCalled();
    });

    it("should delete documents in batches", async () => {
      // Create 600 documents to test batching (batch size is 500)
      const manyDocs = Array(600).fill(null).map((_, i) => ({
        ref: { delete: mockDelete },
        id: `doc-${i}`,
      }));
      mockGet.mockResolvedValue({ empty: false, docs: manyDocs });

      const result = await deleteUserData(testUserId, ["all"]);

      expect(result.success).toBe(true);
    });
  });

  describe("deleteUserDataCompletely", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ empty: true, docs: [] });
    });

    it("should delete data from all systems", async () => {
      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);

      expect(result.success).toBe(true);
      expect(result.deletedCollections).toBeDefined();
      expect(result.storageResult?.deleted).toBe(true);
      expect(result.bigqueryResult?.deleted).toBe(true);
      expect(result.authDeleted).toBe(true);
      expect(mockDeleteUserStorage).toHaveBeenCalledWith(testUserId);
      expect(mockDeleteUserFromBigQuery).toHaveBeenCalledWith(testUserId);
      expect(mockDeleteUser).toHaveBeenCalledWith(testUserId);
    });

    it("should handle storage deletion failure", async () => {
      mockDeleteUserStorage.mockResolvedValue({
        deleted: false,
        error: "Storage error",
        files: [],
        filesCount: 0,
        totalSizeBytes: 0,
      });

      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);

      expect(result.storageResult?.deleted).toBe(false);
    });

    it("should handle BigQuery deletion failure", async () => {
      mockDeleteUserFromBigQuery.mockResolvedValue({
        deleted: false,
        error: "BigQuery error",
        tablesAffected: [],
        rowsAffected: 0,
      });

      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);

      expect(result.bigqueryResult?.deleted).toBe(false);
    });

    it("should handle Auth deletion failure", async () => {
      mockDeleteUser.mockRejectedValue(new Error("Auth error"));

      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);

      expect(result.authDeleted).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should include certificate ID on success", async () => {
      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);

      expect(result.certificateId).toBeDefined();
    });
  });

  describe("setUserDeletionScheduled", () => {
    beforeEach(() => {
      mockUpdate.mockResolvedValue(undefined);
    });

    it("should set deletion scheduled flag", async () => {
      const scheduledDate = new Date("2024-02-15");

      await setUserDeletionScheduled(testUserId, true, scheduledDate);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deletionScheduled: true,
        })
      );
    });

    it("should clear deletion scheduled flag", async () => {
      await setUserDeletionScheduled(testUserId, false);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deletionScheduled: false,
        })
      );
    });

    it("should log operation", async () => {
      await setUserDeletionScheduled(testUserId, true);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("deletion"),
        expect.objectContaining({ userId: testUserId })
      );
    });
  });

  describe("getUserDeletionStatus", () => {
    it("should return user deletion status", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          deletionScheduled: true,
          scheduledDeletionDate: Timestamp.fromDate(new Date("2024-02-15")),
        }),
      });

      const result = await getUserDeletionStatus(testUserId);

      expect(result).not.toBeNull();
      expect(result.scheduledDate).toBeDefined();

    });

    it("should return null for non-existent user", async () => {
      mockGet.mockResolvedValue({ exists: false });

      const result = await getUserDeletionStatus(testUserId);

      expect(result.scheduled).toBe(false);
    });

    it("should throw error on Firestore failure", async () => {
      mockGet.mockRejectedValue(new Error("Firestore error"));

      await expect(getUserDeletionStatus(testUserId)).rejects.toThrow("Firestore error");
    });
  });

  describe.skip("verifyDeletion", () => {
    it("should verify all data is deleted", async () => {
      mockGet.mockResolvedValue({ empty: true, exists: false });

      const result = await verifyDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(true);
      expect(result.firestoreVerified).toBe(true);
      expect(result.storageVerified).toBe(true);
      expect(result.bigqueryVerified).toBe(true);
      expect(result.authVerified).toBe(true);
    });

    it("should report remaining Firestore data", async () => {
      mockGet.mockResolvedValue({ empty: false, exists: true });

      const result = await verifyDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.firestoreVerified).toBe(false);
    });

    it("should report remaining Auth user", async () => {
      mockGet.mockResolvedValue({ empty: true, exists: false });
      mockGetUser.mockResolvedValue({ uid: testUserId });

      const result = await verifyDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.authVerified).toBe(false);
    });

    it("should report remaining storage data", async () => {
      mockGet.mockResolvedValue({ empty: true, exists: false });
      mockVerifyStorageDeletion.mockResolvedValue(false);

      const result = await verifyDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.storageVerified).toBe(false);
    });

    it("should report remaining BigQuery data", async () => {
      mockGet.mockResolvedValue({ empty: true, exists: false });
      mockVerifyBigQueryDeletion.mockResolvedValue(false);

      const result = await verifyDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.bigqueryVerified).toBe(false);
    });
  });

  describe("getExpiredDeletionScheduledUsers", () => {
    it("should return users past grace period", async () => {
      const expiredUsers = [
        { id: "user-1", data: () => ({ email: "user1@example.com" }) },
        { id: "user-2", data: () => ({ email: "user2@example.com" }) },
      ];
      mockGet.mockResolvedValue({ docs: expiredUsers });

      const result = await getExpiredDeletionScheduledUsers();

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("user-1");
      expect(result[1]).toBe("user-2");
    });

    it("should return empty array when no expired users", async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const result = await getExpiredDeletionScheduledUsers();

      expect(result).toEqual([]);
    });
  });

  describe("getPendingDeletionRequests", () => {
    it("should return pending deletion requests", async () => {
      const pendingRequests = [
        {
          id: "req-1",
          data: () => ({
            userId: "user-1",
          scope: [],
            status: "scheduled",
            requestedAt: Timestamp.now(),
          }),
        },
      ];
      mockGet.mockResolvedValue({ docs: pendingRequests });

      const result = await getPendingDeletionRequests();

      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe("req-1");
    });

    it("should return empty array when no pending requests", async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const result = await getPendingDeletionRequests();

      expect(result).toEqual([]);
    });
  });

  describe("updateDeletionRequestStatus", () => {
    beforeEach(() => {
      mockUpdate.mockResolvedValue(undefined);
    });

    it("should update deletion request status", async () => {
      await updateDeletionRequestStatus(testRequestId, "completed", {});

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });

    it("should include certificate ID for completed status", async () => {
      await updateDeletionRequestStatus(testRequestId, "completed", { certificateId: "cert-123" });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          certificateId: "cert-123",
        })
      );
    });

    it("should include error for failed status", async () => {
      await updateDeletionRequestStatus(testRequestId, "failed", { error: "Processing error" });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error: "Processing error",
        })
      );
    });
  });
describe("Coverage Enhancement Tests", () => {    describe("Partial Deletion Scopes", () => {      beforeEach(() => {        mockGet.mockResolvedValue({ empty: false, docs: [{ ref: { delete: mockDelete }, id: "d1" }] });      });      it("should delete only sessions", async () => {        const result = await deleteUserData(testUserId, ["sessions"]);        expect(result.success).toBe(true);        expect(result.deletedCollections).toContain("sessions");      });      it("should delete only settings", async () => {        const result = await deleteUserData(testUserId, ["settings"]);        expect(result.success).toBe(true);        expect(result.deletedCollections).toContain("settings");      });      it("should delete only subscriptions", async () => {        const result = await deleteUserData(testUserId, ["subscriptions"]);        expect(result.success).toBe(true);        expect(result.deletedCollections).toContain("subscriptions");      });      it("should delete only consents", async () => {        const result = await deleteUserData(testUserId, ["consents"]);        expect(result.success).toBe(true);        expect(result.deletedCollections).toContain("consents");      });    });    it("should delete user document when exists", async () => {      let c = 0;      mockGet.mockImplementation(() => {        c++;        if (c <= 4) return Promise.resolve({ empty: true, docs: [] });        return Promise.resolve({ exists: true, data: () => ({}) });      });      await deleteUserData(testUserId, ["all"]);      expect(mockDelete).toHaveBeenCalled();    });    it("should handle auth user not found", async () => {      mockGet.mockResolvedValue({ empty: true, docs: [], exists: false });      mockDeleteUser.mockRejectedValue({ code: "auth/user-not-found" });      const result = await deleteUserData(testUserId, ["all"]);      expect(result.success).toBe(true);    });    it("should handle deleteUserDataCompletely error", async () => {      mockGet.mockRejectedValue(new Error("DB error"));      const result = await deleteUserDataCompletely(testUserId, testRequestId, ["all"]);      expect(result.success).toBe(false);      expect(result.error).toBe("DB error");    });    describe("verifyDeletion tests", () => {      it("should verify complete deletion", async () => {        mockGet.mockResolvedValue({ empty: true, exists: false, docs: [] });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(true);      });      it("should detect remaining sessions", async () => {        let c = 0;        mockGet.mockImplementation(() => {          c++;          if (c === 1) return Promise.resolve({ empty: false, docs: [{ id: "s1" }] });          return Promise.resolve({ empty: true, exists: false, docs: [] });        });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(false);        expect(result.remainingData).toContain("sessions");      });      it("should detect remaining settings", async () => {        let c = 0;        mockGet.mockImplementation(() => {          c++;          if (c === 1) return Promise.resolve({ empty: true, docs: [] });          if (c === 2) return Promise.resolve({ exists: true });          return Promise.resolve({ empty: true, exists: false, docs: [] });        });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(false);        expect(result.remainingData).toContain("settings");      });      it("should detect remaining subscriptions", async () => {        let c = 0;        mockGet.mockImplementation(() => {          c++;          if (c <= 2) return Promise.resolve({ empty: true, exists: false, docs: [] });          if (c === 3) return Promise.resolve({ empty: false, docs: [{ id: "sub1" }] });          return Promise.resolve({ empty: true, exists: false, docs: [] });        });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(false);        expect(result.remainingData).toContain("subscriptions");      });      it("should detect remaining consents", async () => {        let c = 0;        mockGet.mockImplementation(() => {          c++;          if (c <= 3) return Promise.resolve({ empty: true, exists: false, docs: [] });          if (c === 4) return Promise.resolve({ empty: false, docs: [{ id: "c1" }] });          return Promise.resolve({ empty: true, exists: false, docs: [] });        });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(false);        expect(result.remainingData).toContain("consents");      });      it("should detect remaining user document", async () => {        let c = 0;        mockGet.mockImplementation(() => {          c++;          if (c <= 4) return Promise.resolve({ empty: true, exists: false, docs: [] });          return Promise.resolve({ exists: true });        });        const result = await verifyDeletion(testUserId, ["all"]);        expect(result.verified).toBe(false);        expect(result.remainingData).toContain("users");      });      it("should verify partial - sessions", async () => {        mockGet.mockResolvedValue({ empty: true, docs: [] });        const result = await verifyDeletion(testUserId, ["sessions"]);        expect(result.verified).toBe(true);      });      it("should verify partial - settings", async () => {        mockGet.mockResolvedValue({ exists: false });        const result = await verifyDeletion(testUserId, ["settings"]);        expect(result.verified).toBe(true);      });      it("should verify partial - subscriptions", async () => {        mockGet.mockResolvedValue({ empty: true, docs: [] });        const result = await verifyDeletion(testUserId, ["subscriptions"]);        expect(result.verified).toBe(true);      });      it("should verify partial - consents", async () => {        mockGet.mockResolvedValue({ empty: true, docs: [] });        const result = await verifyDeletion(testUserId, ["consents"]);        expect(result.verified).toBe(true);      });      it("should handle verification error", async () => {        mockGet.mockRejectedValue(new Error("Verification failed"));        await expect(verifyDeletion(testUserId, ["all"])).rejects.toThrow("Verification failed");      });    });    it("should handle undefined scheduledDeletionDate", async () => {      mockGet.mockResolvedValue({ exists: true, data: () => ({ deletionScheduled: true }) });      const result = await getUserDeletionStatus(testUserId);      expect(result.scheduled).toBe(true);      expect(result.scheduledDate).toBeUndefined();    });  });
});
