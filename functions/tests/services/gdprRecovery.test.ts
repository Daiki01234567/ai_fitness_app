/**
 * GDPR Recovery Service Tests
 *
 * Comprehensive tests for account recovery functionality
 * - generateRecoveryCode: Generate 6-digit recovery code
 * - saveRecoveryCode: Save recovery code to Firestore
 * - verifyRecoveryCode: Verify valid recovery code
 * - executeAccountRecovery: Restore account from deletion
 * - findScheduledDeletionByEmail: Find scheduled deletion user
 * - sendRecoveryEmail: Send recovery code email
 * - cleanupExpiredRecoveryCodes: Cleanup expired codes
 */

import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Mock Firestore
const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockRunTransaction = jest.fn();

const mockFirestoreInstance = {
  collection: jest.fn().mockImplementation(() => ({
    doc: mockDoc,
    where: mockWhere,
    add: mockAdd,
    get: mockGet,
  })),
  batch: jest.fn().mockReturnValue({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
  runTransaction: mockRunTransaction,
};

jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn().mockReturnValue(mockFirestoreInstance),
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

// Mock helpers
jest.mock("../../src/services/gdpr/helpers", () => ({
  hashIpAddress: jest.fn().mockReturnValue("hashed_ip_12345"),
}));

import {
  generateRecoveryCode,
  saveRecoveryCode,
  verifyRecoveryCode,
  executeAccountRecovery,
  findScheduledDeletionByEmail,
  sendRecoveryEmail,
  cleanupExpiredRecoveryCodes,
} from "../../src/services/gdprRecovery";
import { logger } from "../../src/utils/logger";
import { GDPR_CONSTANTS } from "../../src/types/gdpr";

describe("GDPR Recovery Service", () => {
  const testUserId = "test-user-123";
  const testEmail = "test@example.com";
  const testCode = "123456";

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock chains
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
      ref: { path: "recoveryCodes/test-code-id" },
    });
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

    // Reset environment
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.NODE_ENV;
  });

  describe("generateRecoveryCode", () => {
    it("should generate 6-digit recovery code", () => {
      const code = generateRecoveryCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it("should generate different codes on each call", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRecoveryCode());
      }
      // Should have many unique codes (allowing some collisions)
      expect(codes.size).toBeGreaterThan(90);
    });

    it("should pad codes with leading zeros", () => {
      // Test multiple times to increase chance of getting a small number
      const codes: string[] = [];
      for (let i = 0; i < 100; i++) {
        codes.push(generateRecoveryCode());
      }
      // All codes should be exactly 6 characters
      codes.forEach((code) => {
        expect(code.length).toBe(6);
      });
    });

    it("should only contain digits", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRecoveryCode();
        expect(/^\d+$/.test(code)).toBe(true);
      }
    });
  });

  describe("saveRecoveryCode", () => {
    beforeEach(() => {
      // Mock invalidation query (no existing codes)
      mockGet.mockResolvedValue({ empty: true, docs: [] });
      // Mock add
      mockAdd.mockResolvedValue({ id: "new-code-id" });
    });

    it("should save recovery code with correct data", async () => {
      const result = await saveRecoveryCode(
        testUserId,
        testEmail,
        testCode,
        "deletion-req-123",
        "192.168.1.1"
      );

      expect(result.codeId).toBe("new-code-id");
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          code: testCode,
          status: "pending",
          attempts: 0,
          maxAttempts: GDPR_CONSTANTS.RECOVERY_CODE_MAX_ATTEMPTS,
          deletionRequestId: "deletion-req-123",
          ipAddressHash: "hashed_ip_12345",
        })
      );
    });

    it("should set correct expiration time", async () => {
      const before = Date.now();
      const result = await saveRecoveryCode(testUserId, testEmail, testCode);
      const after = Date.now();

      const expectedMinExpiry = before + GDPR_CONSTANTS.RECOVERY_CODE_EXPIRY_HOURS * 60 * 60 * 1000;
      const expectedMaxExpiry = after + GDPR_CONSTANTS.RECOVERY_CODE_EXPIRY_HOURS * 60 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it("should invalidate existing pending codes", async () => {
      // Mock existing pending codes
      const existingDocs = [
        { ref: { update: mockUpdate } },
        { ref: { update: mockUpdate } },
      ];
      mockGet.mockResolvedValue({ empty: false, docs: existingDocs, size: 2 });
      mockBatchCommit.mockResolvedValue(undefined);

      await saveRecoveryCode(testUserId, testEmail, testCode);

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Existing recovery codes invalidated",
        expect.objectContaining({ userId: testUserId, count: 2 })
      );
    });

    it("should handle missing optional parameters", async () => {
      await saveRecoveryCode(testUserId, testEmail, testCode);

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          deletionRequestId: undefined,
          ipAddressHash: undefined,
        })
      );
    });

    it("should log code creation", async () => {
      await saveRecoveryCode(testUserId, testEmail, testCode);

      expect(logger.info).toHaveBeenCalledWith(
        "Recovery code created",
        expect.objectContaining({
          userId: testUserId,
          codeId: "new-code-id",
        })
      );
    });
  });

  describe("verifyRecoveryCode", () => {
    const mockRecoveryCode = {
      userId: testUserId,
      email: testEmail,
      code: testCode,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600000)), // 1 hour from now
      deletionRequestId: "deletion-req-123",
    };

    it("should verify valid code successfully", async () => {
      const mockDocRef = { update: mockUpdate };

      // First query: exact match found
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => mockRecoveryCode,
          ref: mockDocRef,
        }],
      });

      // Second query: deletion request (when deletionRequestId exists)
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          userId: testUserId,
          status: "pending",
        }),
      });

      const result = await verifyRecoveryCode(testEmail, testCode);

      expect(result.valid).toBe(true);
      expect(result.recoveryCode).toBeDefined();
      expect(result.deletionRequest).toBeDefined();
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "verified",
        attempts: 1,
      });
    });

    it("should return invalid when code not found and no email match", async () => {
      // First query: exact match empty
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      // Second query: email only search also empty
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await verifyRecoveryCode(testEmail, "wrong-code");

      expect(result.valid).toBe(false);
      expect(result.remainingAttempts).toBeUndefined();
    });

    it("should increment attempts on wrong code", async () => {
      const mockDocRef = { update: mockUpdate };

      // First query: exact match empty
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      // Second query: email only returns a code
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => ({ ...mockRecoveryCode, attempts: 2 }),
          ref: mockDocRef,
        }],
      });

      const result = await verifyRecoveryCode(testEmail, "wrong-code");

      expect(result.valid).toBe(false);
      expect(result.remainingAttempts).toBe(2); // 5 - 3 = 2
      expect(mockUpdate).toHaveBeenCalledWith({ attempts: 3 });
    });

    it("should invalidate code after max attempts", async () => {
      const mockDocRef = { update: mockUpdate };

      // First query: exact match empty
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      // Second query: email only returns the code at max-1 attempts
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => ({ ...mockRecoveryCode, attempts: 4, maxAttempts: 5 }),
          ref: mockDocRef,
        }],
      });

      const result = await verifyRecoveryCode(testEmail, "wrong-code");

      expect(result.valid).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(mockUpdate).toHaveBeenCalledWith({
        attempts: 5,
        status: "invalidated",
      });
      expect(logger.warn).toHaveBeenCalledWith(
        "Recovery code invalidated due to max attempts",
        expect.any(Object)
      );
    });

    it("should return invalid for expired code", async () => {
      const expiredCode = {
        ...mockRecoveryCode,
        expiresAt: Timestamp.fromDate(new Date(Date.now() - 3600000)), // 1 hour ago
      };
      const mockDocRef = { update: mockUpdate };

      // First query: exact match found but expired
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => expiredCode,
          ref: mockDocRef,
        }],
      });

      const result = await verifyRecoveryCode(testEmail, testCode);

      expect(result.valid).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({ status: "expired" });
      expect(logger.info).toHaveBeenCalledWith("Recovery code expired", expect.any(Object));
    });

    it("should find deletion request by userId when deletionRequestId is missing", async () => {
      const codeWithoutDeletionId = {
        ...mockRecoveryCode,
        deletionRequestId: undefined,
      };
      const mockDocRef = { update: mockUpdate };

      // First query: exact match found
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => codeWithoutDeletionId,
          ref: mockDocRef,
        }],
      });

      // Second query: search by userId for deletion request
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => ({
            userId: testUserId,
            status: "pending",
          }),
        }],
      });

      const result = await verifyRecoveryCode(testEmail, testCode);

      expect(result.valid).toBe(true);
      expect(result.deletionRequest).toBeDefined();
    });
  });

  describe("executeAccountRecovery", () => {
    it("should recover account successfully", async () => {
      const mockDocRef = { update: mockUpdate };

      // Mock verifyRecoveryCode internal calls
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => ({
            userId: testUserId,
            email: testEmail,
            code: testCode,
            status: "pending",
            attempts: 0,
            maxAttempts: 5,
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
            deletionRequestId: "deletion-req-123",
          }),
          ref: mockDocRef,
        }],
      });

      // Deletion request fetch
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          userId: testUserId,
          requestId: "deletion-req-123",
          status: "pending",
        }),
      });

      // Mock transaction
      mockRunTransaction.mockImplementation(async (callback: (t: unknown) => Promise<void>) => {
        const mockTransaction = {
          update: jest.fn(),
        };
        await callback(mockTransaction);
        return undefined;
      });

      const result = await executeAccountRecovery(testEmail, testCode);

      expect(result.success).toBe(true);
      expect(result.message).toContain("復元されました");
      expect(logger.info).toHaveBeenCalledWith(
        "Account recovery completed",
        expect.objectContaining({ userId: testUserId, email: testEmail })
      );
    });

    it("should return failure for invalid code", async () => {
      // Mock verifyRecoveryCode returning invalid
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await executeAccountRecovery(testEmail, "wrong-code");

      expect(result.success).toBe(false);
      expect(result.message).toContain("無効または期限切れ");
    });

    it("should handle transaction failure", async () => {
      const mockDocRef = { update: mockUpdate };

      // Mock valid verification
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: "code-id",
          data: () => ({
            userId: testUserId,
            email: testEmail,
            code: testCode,
            status: "pending",
            attempts: 0,
            maxAttempts: 5,
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
          }),
          ref: mockDocRef,
        }],
      });

      // Deletion request fetch
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      // Mock transaction failure
      mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

      const result = await executeAccountRecovery(testEmail, testCode);

      expect(result.success).toBe(false);
      expect(result.message).toContain("エラーが発生しました");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("findScheduledDeletionByEmail", () => {
    it("should find scheduled deletion user", async () => {
      // First query: user query
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: testUserId }],
      });

      // Second query: deletion request query
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => ({
            userId: testUserId,
            requestId: "deletion-req-123",
            status: "pending",
            canRecover: true,
            recoverDeadline: Timestamp.fromDate(new Date(Date.now() + 86400000)),
          }),
        }],
      });

      const result = await findScheduledDeletionByEmail(testEmail);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(testUserId);
      expect(result?.deletionRequest).toBeDefined();
    });

    it("should return null when user not found", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await findScheduledDeletionByEmail(testEmail);

      expect(result).toBeNull();
    });

    it("should return null when no deletion request found", async () => {
      // User found
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: testUserId }],
      });

      // Deletion request not found
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await findScheduledDeletionByEmail(testEmail);

      expect(result).toBeNull();
    });

    it("should return null when recovery deadline has passed", async () => {
      // User found
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: testUserId }],
      });

      // Deletion request with expired deadline
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => ({
            userId: testUserId,
            requestId: "deletion-req-123",
            status: "pending",
            canRecover: true,
            recoverDeadline: Timestamp.fromDate(new Date(Date.now() - 86400000)), // Yesterday
          }),
        }],
      });

      const result = await findScheduledDeletionByEmail(testEmail);

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        "Recovery deadline passed",
        expect.any(Object)
      );
    });

    it("should handle missing recovery deadline", async () => {
      // User found
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: testUserId }],
      });

      // Deletion request without deadline
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => ({
            userId: testUserId,
            requestId: "deletion-req-123",
            status: "pending",
            canRecover: true,
            // No recoverDeadline
          }),
        }],
      });

      const result = await findScheduledDeletionByEmail(testEmail);

      expect(result).not.toBeNull();
    });
  });

  describe("sendRecoveryEmail", () => {
    const expiresAt = new Date(Date.now() + 86400000);

    it("should log email in development mode (emulator)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendRecoveryEmail(testEmail, testCode, expiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Recovery email (development mode)",
        expect.objectContaining({
          email: testEmail,
          code: testCode,
        })
      );
    });

    it("should log email in development mode (NODE_ENV)", () => {
      process.env.NODE_ENV = "development";

      sendRecoveryEmail(testEmail, testCode, expiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Recovery email (development mode)",
        expect.any(Object)
      );
    });

    it("should log email sent in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.FUNCTIONS_EMULATOR = "false";

      sendRecoveryEmail(testEmail, testCode, expiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Recovery email sent",
        expect.objectContaining({
          email: testEmail,
        })
      );
    });

    it("should include expiration info in log", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendRecoveryEmail(testEmail, testCode, expiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          expiresAt: expiresAt.toISOString(),
        })
      );
    });
  });

  describe("cleanupExpiredRecoveryCodes", () => {
    it("should cleanup expired codes", async () => {
      const expiredDocs = [
        { ref: { update: mockUpdate } },
        { ref: { update: mockUpdate } },
        { ref: { update: mockUpdate } },
      ];

      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: expiredDocs,
        size: 3,
      });
      mockBatchCommit.mockResolvedValue(undefined);

      const result = await cleanupExpiredRecoveryCodes();

      expect(result).toBe(3);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        "Expired recovery codes cleaned up",
        expect.objectContaining({ count: 3 })
      );
    });

    it("should return 0 when no expired codes", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await cleanupExpiredRecoveryCodes();

      expect(result).toBe(0);
      expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    it("should update status to expired", async () => {
      const mockRef = { update: mockUpdate };
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: mockRef }],
        size: 1,
      });
      mockBatchCommit.mockResolvedValue(undefined);

      await cleanupExpiredRecoveryCodes();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        mockRef,
        { status: "expired" }
      );
    });
  });
});
