/**
 * GDPR Verification Service Tests
 *
 * Comprehensive tests for deletion verification and certificates
 * - verifyFirestoreDeletion: Verify Firestore data is deleted
 * - verifyAuthDeletion: Verify Firebase Auth user is deleted
 * - verifyCompleteDeletion: Verify deletion across all systems
 * - generateDeletionCertificate: Generate signed deletion certificate
 * - getDeletionCertificate: Get deletion certificate by ID
 * - findCertificatesByUserHash: Find certificates by user hash
 * - verifyCertificateSignature: Verify certificate signature
 * - validateCertificate: Complete certificate validation
 */

// Mock firebase-admin
const mockGetUser = jest.fn();
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  auth: jest.fn().mockReturnValue({
    getUser: mockGetUser,
  }),
}));

// Mock Firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
};

jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn().mockReturnValue(mockFirestoreInstance),
  userRef: jest.fn().mockImplementation((userId: string) => ({
    get: mockGet,
    collection: jest.fn().mockReturnValue({
      doc: mockDoc,
      limit: mockLimit,
      get: mockGet,
    }),
  })),
  sessionsCollection: jest.fn().mockReturnValue({
    limit: mockLimit,
  }),
  consentsCollection: jest.fn().mockReturnValue({
    where: mockWhere,
  }),
}));

// Mock gdprStorage
const mockVerifyStorageDeletion = jest.fn();
jest.mock("../../src/services/gdprStorage", () => ({
  verifyStorageDeletion: mockVerifyStorageDeletion,
}));

// Mock gdprBigQuery
const mockVerifyBigQueryDeletion = jest.fn();
jest.mock("../../src/services/gdprBigQuery", () => ({
  verifyBigQueryDeletion: mockVerifyBigQueryDeletion,
}));

// Mock helpers
const mockGenerateSignature = jest.fn().mockReturnValue("mock_signature_12345");
const mockHashUserId = jest.fn().mockReturnValue("hashed_user_id");
jest.mock("../../src/services/gdpr/helpers", () => ({
  generateSignature: mockGenerateSignature,
  hashUserId: mockHashUserId,
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
  verifyFirestoreDeletion,
  verifyAuthDeletion,
  verifyCompleteDeletion,
  generateDeletionCertificate,
  getDeletionCertificate,
  findCertificatesByUserHash,
  verifyCertificateSignature,
  validateCertificate,
} from "../../src/services/gdprVerification";
import { logger } from "../../src/utils/logger";
import { DeletionVerificationResult } from "../../src/types/gdpr";

describe("GDPR Verification Service", () => {
  const testUserId = "test-user-123";
  const testDeletionRequestId = "deletion-req-456";
  const testCertificateId = "cert_1234567890_abcdef12";

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock chains
    mockCollection.mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
      orderBy: mockOrderBy,
      get: mockGet,
    });
    mockDoc.mockReturnValue({
      get: mockGet,
      set: mockSet,
    });
    mockWhere.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockGet,
    });
    mockOrderBy.mockReturnValue({
      get: mockGet,
    });
    mockLimit.mockReturnValue({
      get: mockGet,
    });

    // Reset environment
    delete process.env.GCLOUD_PROJECT;
  });

  describe("verifyFirestoreDeletion", () => {
    it("should return verified when all data is deleted (scope: all)", async () => {
      // All queries return empty
      mockGet.mockResolvedValue({ empty: true, exists: false });

      const result = await verifyFirestoreDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(true);
      expect(result.remainingData).toEqual([]);
    });

    it("should return remaining sessions when not deleted", async () => {
      // Sessions exist, others deleted
      mockGet
        .mockResolvedValueOnce({ empty: false }) // sessions
        .mockResolvedValueOnce({ exists: false }) // settings
        .mockResolvedValueOnce({ empty: true }) // subscriptions
        .mockResolvedValueOnce({ empty: true }) // consents
        .mockResolvedValueOnce({ exists: false }); // users

      const result = await verifyFirestoreDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.remainingData).toContain("sessions");
    });

    it("should return remaining settings when not deleted", async () => {
      mockGet
        .mockResolvedValueOnce({ empty: true }) // sessions
        .mockResolvedValueOnce({ exists: true }) // settings exists
        .mockResolvedValueOnce({ empty: true }) // subscriptions
        .mockResolvedValueOnce({ empty: true }) // consents
        .mockResolvedValueOnce({ exists: false }); // users

      const result = await verifyFirestoreDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.remainingData).toContain("settings");
    });

    it("should return remaining user document when not deleted", async () => {
      mockGet
        .mockResolvedValueOnce({ empty: true }) // sessions
        .mockResolvedValueOnce({ exists: false }) // settings
        .mockResolvedValueOnce({ empty: true }) // subscriptions
        .mockResolvedValueOnce({ empty: true }) // consents
        .mockResolvedValueOnce({ exists: true }); // users still exists

      const result = await verifyFirestoreDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.remainingData).toContain("users");
    });

    it("should verify only specified scopes", async () => {
      mockGet.mockResolvedValue({ empty: true, exists: false });

      const result = await verifyFirestoreDeletion(testUserId, ["sessions", "settings"]);

      expect(result.verified).toBe(true);
      expect(result.remainingData).toEqual([]);
    });

    it("should throw error on Firestore failure", async () => {
      mockGet.mockRejectedValue(new Error("Firestore error"));

      await expect(verifyFirestoreDeletion(testUserId, ["sessions"])).rejects.toThrow(
        "Firestore error"
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("verifyAuthDeletion", () => {
    it("should return true when user is deleted", async () => {
      mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });

      const result = await verifyAuthDeletion(testUserId);

      expect(result).toBe(true);
    });

    it("should return false when user still exists", async () => {
      mockGetUser.mockResolvedValue({ uid: testUserId });

      const result = await verifyAuthDeletion(testUserId);

      expect(result).toBe(false);
    });

    it("should return true on any auth error (user not found)", async () => {
      mockGetUser.mockRejectedValue(new Error("Some auth error"));

      const result = await verifyAuthDeletion(testUserId);

      expect(result).toBe(true);
    });
  });

  describe("verifyCompleteDeletion", () => {
    beforeEach(() => {
      // Default: all verifications pass
      mockGet.mockResolvedValue({ empty: true, exists: false });
      mockVerifyStorageDeletion.mockResolvedValue(true);
      mockVerifyBigQueryDeletion.mockResolvedValue(true);
      mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });
    });

    it("should verify complete deletion successfully", async () => {
      const result = await verifyCompleteDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(true);
      expect(result.verificationResult.firestore).toBe(true);
      expect(result.verificationResult.storage).toBe(true);
      expect(result.verificationResult.bigquery).toBe(true);
      expect(result.verificationResult.auth).toBe(true);
      expect(result.remainingData).toEqual([]);
    });

    it("should report remaining storage data", async () => {
      mockVerifyStorageDeletion.mockResolvedValue(false);

      const result = await verifyCompleteDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.verificationResult.storage).toBe(false);
      expect(result.remainingData).toContain("storage:user-files");
    });

    it("should report remaining BigQuery data", async () => {
      mockVerifyBigQueryDeletion.mockResolvedValue(false);

      const result = await verifyCompleteDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.verificationResult.bigquery).toBe(false);
      expect(result.remainingData).toContain("bigquery:user-data");
    });

    it("should report remaining Auth user", async () => {
      mockGetUser.mockResolvedValue({ uid: testUserId });

      const result = await verifyCompleteDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.verificationResult.auth).toBe(false);
      expect(result.remainingData).toContain("auth:user-record");
    });

    it("should report multiple remaining data sources", async () => {
      mockVerifyStorageDeletion.mockResolvedValue(false);
      mockVerifyBigQueryDeletion.mockResolvedValue(false);
      mockGetUser.mockResolvedValue({ uid: testUserId });
      mockGet.mockResolvedValueOnce({ empty: false }); // sessions remain

      const result = await verifyCompleteDeletion(testUserId, ["all"]);

      expect(result.verified).toBe(false);
      expect(result.remainingData.length).toBeGreaterThan(1);
    });

    it("should log verification results", async () => {
      await verifyCompleteDeletion(testUserId, ["all"]);

      expect(logger.info).toHaveBeenCalledWith(
        "Complete deletion verification",
        expect.objectContaining({
          userId: testUserId,
          verified: true,
        })
      );
    });
  });

  describe("generateDeletionCertificate", () => {
    const deletedData = {
      firestoreCollections: ["users", "sessions", "consents"],
      storageFilesCount: 5,
      bigqueryRowsDeleted: 100,
      authDeleted: true,
    };

    const verificationResult: DeletionVerificationResult = {
      firestore: true,
      storage: true,
      bigquery: true,
      auth: true,
    };

    beforeEach(() => {
      mockSet.mockResolvedValue(undefined);
    });

    it("should generate certificate with correct data", async () => {
      const certificate = await generateDeletionCertificate(
        testUserId,
        testDeletionRequestId,
        deletedData,
        verificationResult
      );

      expect(certificate.certificateId).toMatch(/^cert_\d+_[0-9a-f]{16}$/);
      expect(certificate.userIdHash).toBe("hashed_user_id");
      expect(certificate.deletionRequestId).toBe(testDeletionRequestId);
      expect(certificate.deletedData).toEqual(deletedData);
      expect(certificate.verificationResult).toEqual(verificationResult);
      expect(certificate.signature).toBe("mock_signature_12345");
      expect(certificate.signatureAlgorithm).toBe("HMAC-SHA256");
    });

    it("should store certificate in Firestore", async () => {
      await generateDeletionCertificate(
        testUserId,
        testDeletionRequestId,
        deletedData,
        verificationResult
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          userIdHash: "hashed_user_id",
          deletionRequestId: testDeletionRequestId,
          signatureAlgorithm: "HMAC-SHA256",
        })
      );
    });

    it("should include issuedAt and issuedBy", async () => {
      process.env.GCLOUD_PROJECT = "test-project";

      const certificate = await generateDeletionCertificate(
        testUserId,
        testDeletionRequestId,
        deletedData,
        verificationResult
      );

      expect(certificate.issuedAt).toBeDefined();
      expect(certificate.issuedBy).toContain("AI Fitness App");
      expect(certificate.issuedBy).toContain("test-project");
    });

    it("should log certificate generation", async () => {
      await generateDeletionCertificate(
        testUserId,
        testDeletionRequestId,
        deletedData,
        verificationResult
      );

      expect(logger.info).toHaveBeenCalledWith(
        "Deletion certificate generated",
        expect.objectContaining({
          userIdHash: "hashed_user_id",
          deletionRequestId: testDeletionRequestId,
        })
      );
    });
  });

  describe("getDeletionCertificate", () => {
    it("should return certificate when found", async () => {
      const mockCertificate = {
        certificateId: testCertificateId,
        userIdHash: "hashed_user_id",
        deletedAt: "2024-01-15T10:00:00Z",
      };
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockCertificate,
      });

      const result = await getDeletionCertificate(testCertificateId);

      expect(result).toEqual(mockCertificate);
    });

    it("should return null when not found", async () => {
      mockGet.mockResolvedValue({ exists: false });

      const result = await getDeletionCertificate("non-existent-id");

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        "Deletion certificate not found",
        expect.any(Object)
      );
    });
  });

  describe("findCertificatesByUserHash", () => {
    it("should return certificates for user hash", async () => {
      const certificates = [
        { certificateId: "cert_1", userIdHash: "hashed_user_id" },
        { certificateId: "cert_2", userIdHash: "hashed_user_id" },
      ];
      mockGet.mockResolvedValue({
        docs: certificates.map((c) => ({ data: () => c })),
      });

      const result = await findCertificatesByUserHash("hashed_user_id");

      expect(result).toHaveLength(2);
      expect(result[0].certificateId).toBe("cert_1");
    });

    it("should return empty array when no certificates found", async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const result = await findCertificatesByUserHash("unknown_hash");

      expect(result).toEqual([]);
    });
  });

  describe("verifyCertificateSignature", () => {
    it("should return true for valid signature", () => {
      // Mock generateSignature to return the same signature as in the certificate
      mockGenerateSignature.mockReturnValue("valid_signature");

      const certificate = {
        certificateId: testCertificateId,
        userIdHash: "hashed_user_id",
        deletedAt: "2024-01-15T10:00:00Z",
        deletionRequestId: testDeletionRequestId,
        deletedData: {
          firestoreCollections: ["users"],
          storageFilesCount: 0,
          bigqueryRowsDeleted: 0,
          authDeleted: true,
        },
        verificationResult: {
          firestore: true,
          storage: true,
          bigquery: true,
          auth: true,
        },
        signature: "valid_signature",
        signatureAlgorithm: "HMAC-SHA256",
        issuedAt: "2024-01-15T10:00:00Z",
        issuedBy: "AI Fitness App",
      };

      const result = verifyCertificateSignature(certificate);

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      mockGenerateSignature.mockReturnValue("expected_signature");

      const certificate = {
        certificateId: testCertificateId,
        userIdHash: "hashed_user_id",
        deletedAt: "2024-01-15T10:00:00Z",
        deletionRequestId: testDeletionRequestId,
        deletedData: {
          firestoreCollections: ["users"],
          storageFilesCount: 0,
          bigqueryRowsDeleted: 0,
          authDeleted: true,
        },
        verificationResult: {
          firestore: true,
          storage: true,
          bigquery: true,
          auth: true,
        },
        signature: "tampered_signature",
        signatureAlgorithm: "HMAC-SHA256",
        issuedAt: "2024-01-15T10:00:00Z",
        issuedBy: "AI Fitness App",
      };

      const result = verifyCertificateSignature(certificate);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Certificate signature verification failed",
        expect.any(Object)
      );
    });
  });

  describe("validateCertificate", () => {
    it("should return valid for existing certificate with valid signature", async () => {
      const mockCertificate = {
        certificateId: testCertificateId,
        userIdHash: "hashed_user_id",
        deletedAt: "2024-01-15T10:00:00Z",
        deletionRequestId: testDeletionRequestId,
        deletedData: {
          firestoreCollections: ["users"],
          storageFilesCount: 0,
          bigqueryRowsDeleted: 0,
          authDeleted: true,
        },
        verificationResult: {
          firestore: true,
          storage: true,
          bigquery: true,
          auth: true,
        },
        signature: "valid_signature",
        signatureAlgorithm: "HMAC-SHA256",
        issuedAt: "2024-01-15T10:00:00Z",
        issuedBy: "AI Fitness App",
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockCertificate,
      });
      mockGenerateSignature.mockReturnValue("valid_signature");

      const result = await validateCertificate(testCertificateId);

      expect(result.valid).toBe(true);
      expect(result.certificate).toEqual(mockCertificate);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid when certificate not found", async () => {
      mockGet.mockResolvedValue({ exists: false });

      const result = await validateCertificate("non-existent-id");

      expect(result.valid).toBe(false);
      expect(result.certificate).toBeNull();
      expect(result.error).toContain("見つかりません");
    });

    it("should return invalid when signature is invalid", async () => {
      const mockCertificate = {
        certificateId: testCertificateId,
        userIdHash: "hashed_user_id",
        deletedAt: "2024-01-15T10:00:00Z",
        deletionRequestId: testDeletionRequestId,
        deletedData: {
          firestoreCollections: ["users"],
          storageFilesCount: 0,
          bigqueryRowsDeleted: 0,
          authDeleted: true,
        },
        verificationResult: {
          firestore: true,
          storage: true,
          bigquery: true,
          auth: true,
        },
        signature: "tampered_signature",
        signatureAlgorithm: "HMAC-SHA256",
        issuedAt: "2024-01-15T10:00:00Z",
        issuedBy: "AI Fitness App",
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockCertificate,
      });
      mockGenerateSignature.mockReturnValue("different_signature");

      const result = await validateCertificate(testCertificateId);

      expect(result.valid).toBe(false);
      expect(result.certificate).toEqual(mockCertificate);
      expect(result.error).toContain("署名が無効");
    });
  });

  describe("Additional Branch Coverage", () => {
    describe("verifyFirestoreDeletion - subscriptions and consents", () => {
      it("should detect remaining subscriptions", async () => {
        mockGet
          .mockResolvedValueOnce({ empty: true }) // sessions
          .mockResolvedValueOnce({ exists: false }) // settings
          .mockResolvedValueOnce({ empty: false }) // subscriptions remain
          .mockResolvedValueOnce({ empty: true }) // consents
          .mockResolvedValueOnce({ exists: false }); // users

        const result = await verifyFirestoreDeletion(testUserId, ["all"]);

        expect(result.verified).toBe(false);
        expect(result.remainingData).toContain("subscriptions");
      });

      it("should detect remaining consents", async () => {
        mockGet
          .mockResolvedValueOnce({ empty: true }) // sessions
          .mockResolvedValueOnce({ exists: false }) // settings
          .mockResolvedValueOnce({ empty: true }) // subscriptions
          .mockResolvedValueOnce({ empty: false }) // consents remain
          .mockResolvedValueOnce({ exists: false }); // users

        const result = await verifyFirestoreDeletion(testUserId, ["all"]);

        expect(result.verified).toBe(false);
        expect(result.remainingData).toContain("consents");
      });
    });
  });
});
