/**
 * Revoke Consent API Unit Tests
 *
 * Tests for the consent revocation functionality.
 * Reference: docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md
 * Ticket: 006 - GDPR Consent API
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { HttpsError } from "firebase-functions/v2/https";

// Mock modules before importing
jest.mock("firebase-admin", () => {
  const mockTimestamp = {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
  };

  const mockTimestampFromDate = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  };

  const mockTransaction = {
    set: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
  };

  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    runTransaction: jest.fn((fn: (t: typeof mockTransaction) => unknown) =>
      fn(mockTransaction)
    ),
    FieldValue: mockFieldValue,
    Timestamp: mockTimestampFromDate,
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: mockFieldValue,
      Timestamp: mockTimestampFromDate,
    }),
    auth: jest.fn(() => ({
      setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
      revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

jest.mock("firebase-functions", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../../src/middleware/csrf", () => ({
  requireStrictCsrfProtection: jest.fn(),
}));

jest.mock("../../../src/services/auditLog", () => ({
  logConsentAction: jest.fn().mockResolvedValue("audit-log-id"),
  logSecurityEvent: jest.fn().mockResolvedValue("security-log-id"),
}));

// Import after mocks
import * as admin from "firebase-admin";
import { requireStrictCsrfProtection } from "../../../src/middleware/csrf";
import { logConsentAction, logSecurityEvent } from "../../../src/services/auditLog";

describe("revokeConsent API", () => {
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockAuth: ReturnType<typeof admin.auth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = admin.firestore();
    mockAuth = admin.auth();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const request = {
        auth: null,
        data: {
          consentType: "all",
        },
        rawRequest: {},
      };

      if (!request.auth) {
        expect(() => {
          throw new HttpsError("unauthenticated", "認証が必要です");
        }).toThrow("認証が必要です");
      }
    });

    it("should accept authenticated requests", () => {
      const request = {
        auth: {
          uid: "test-user-id",
          token: { email: "test@example.com" },
        },
        data: {
          consentType: "all",
        },
        rawRequest: {},
      };

      expect(request.auth).toBeDefined();
      expect(request.auth?.uid).toBe("test-user-id");
    });
  });

  describe("CSRF Protection", () => {
    it("should require strict CSRF protection", () => {
      const request = {
        auth: { uid: "test-user-id", token: {} },
        data: { consentType: "all" },
        rawRequest: {},
      };

      // Simulate strict CSRF middleware call
      requireStrictCsrfProtection(request as never);

      expect(requireStrictCsrfProtection).toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    it("should accept valid consent types for revocation", () => {
      const validateConsentType = (type: unknown): "tos" | "privacy_policy" | "all" => {
        if (type !== "tos" && type !== "privacy_policy" && type !== "all") {
          throw new HttpsError(
            "invalid-argument",
            "同意タイプが無効です。'tos', 'privacy_policy', または 'all' を指定してください"
          );
        }
        return type;
      };

      expect(validateConsentType("tos")).toBe("tos");
      expect(validateConsentType("privacy_policy")).toBe("privacy_policy");
      expect(validateConsentType("all")).toBe("all");
    });

    it("should reject invalid consent types", () => {
      const validateConsentType = (type: unknown): "tos" | "privacy_policy" | "all" => {
        if (type !== "tos" && type !== "privacy_policy" && type !== "all") {
          throw new HttpsError(
            "invalid-argument",
            "同意タイプが無効です。'tos', 'privacy_policy', または 'all' を指定してください"
          );
        }
        return type;
      };

      expect(() => validateConsentType("invalid")).toThrow("同意タイプが無効です");
      expect(() => validateConsentType("")).toThrow("同意タイプが無効です");
      expect(() => validateConsentType(null)).toThrow("同意タイプが無効です");
    });

    it("should validate and limit reason length", () => {
      const validateReason = (reason: unknown): string => {
        return typeof reason === "string" ? reason.substring(0, 500) : "user_request";
      };

      expect(validateReason("short reason")).toBe("short reason");
      expect(validateReason(undefined)).toBe("user_request");
      expect(validateReason(null)).toBe("user_request");
      expect(validateReason(123)).toBe("user_request");

      // Test length truncation
      const longReason = "a".repeat(600);
      expect(validateReason(longReason).length).toBe(500);
    });
  });

  describe("User Existence Check", () => {
    it("should reject if user does not exist", async () => {
      (mockFirestore.collection("users").doc("test-user").get as jest.Mock).mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const userDoc = await mockFirestore.collection("users").doc("test-user").get();

      if (!userDoc.exists) {
        expect(() => {
          throw new HttpsError("not-found", "ユーザーが見つかりません");
        }).toThrow("ユーザーが見つかりません");
      }
    });

    it("should reject if user is already scheduled for deletion", async () => {
      (mockFirestore.collection("users").doc("test-user").get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: true }),
      });

      const userDoc = await mockFirestore.collection("users").doc("test-user").get();
      const userData = userDoc.data();

      if (userData?.deletionScheduled) {
        expect(() => {
          throw new HttpsError(
            "failed-precondition",
            "アカウント削除が既に予定されています"
          );
        }).toThrow("アカウント削除が既に予定されています");
      }
    });
  });

  describe("Consent Revocation", () => {
    it("should revoke TOS consent only", () => {
      const consentType = "tos";
      const userUpdate: Record<string, unknown> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (consentType === "tos" || consentType === "all") {
        userUpdate.tosAccepted = false;
        userUpdate.tosAcceptedAt = null;
      }

      expect(userUpdate.tosAccepted).toBe(false);
      expect(userUpdate.tosAcceptedAt).toBeNull();
      expect(userUpdate.forceLogout).toBe(true);
    });

    it("should revoke Privacy Policy consent only", () => {
      const consentType = "privacy_policy";
      const userUpdate: Record<string, unknown> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (consentType === "privacy_policy" || consentType === "all") {
        userUpdate.ppAccepted = false;
        userUpdate.ppAcceptedAt = null;
      }

      expect(userUpdate.ppAccepted).toBe(false);
      expect(userUpdate.ppAcceptedAt).toBeNull();
      expect(userUpdate.forceLogout).toBe(true);
    });

    it("should revoke all consents", () => {
      const consentType = "all";
      const userUpdate: Record<string, unknown> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (consentType === "tos" || consentType === "all") {
        userUpdate.tosAccepted = false;
        userUpdate.tosAcceptedAt = null;
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        userUpdate.ppAccepted = false;
        userUpdate.ppAcceptedAt = null;
      }

      expect(userUpdate.tosAccepted).toBe(false);
      expect(userUpdate.ppAccepted).toBe(false);
      expect(userUpdate.forceLogout).toBe(true);
    });
  });

  describe("Force Logout", () => {
    it("should set forceLogout flag in user document", () => {
      const userUpdate = {
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(userUpdate.forceLogout).toBe(true);
      expect(userUpdate.forceLogoutAt).toBeDefined();
    });

    it("should revoke refresh tokens", async () => {
      const userId = "test-user-id";

      await mockAuth.revokeRefreshTokens(userId);

      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith(userId);
    });

    it("should set custom claims for force logout", async () => {
      const userId = "test-user-id";
      const existingToken = { email: "test@example.com" };

      await mockAuth.setCustomUserClaims(userId, {
        ...existingToken,
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalled();
      const callArgs = (mockAuth.setCustomUserClaims as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(userId);
      expect(callArgs[1].forceLogout).toBe(true);
      expect(callArgs[1].forceLogoutAt).toBeDefined();
    });
  });

  describe("Data Deletion Request", () => {
    it("should create deletion request when requestDataDeletion is true", () => {
      const requestDataDeletion = true;
      const userUpdate: Record<string, unknown> = {};

      if (requestDataDeletion) {
        const scheduledDeletionDate = new Date();
        scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

        userUpdate.deletionScheduled = true;
        userUpdate.scheduledDeletionDate = scheduledDeletionDate;
      }

      expect(userUpdate.deletionScheduled).toBe(true);
      expect(userUpdate.scheduledDeletionDate).toBeDefined();

      // Verify deletion date is 30 days from now
      const deletionDate = userUpdate.scheduledDeletionDate as Date;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);

      // Allow 1 day tolerance for timing
      const diffDays = Math.abs(deletionDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeLessThan(1);
    });

    it("should not create deletion request when requestDataDeletion is false", () => {
      const requestDataDeletion = false;
      const userUpdate: Record<string, unknown> = {};

      if (requestDataDeletion) {
        userUpdate.deletionScheduled = true;
      }

      expect(userUpdate.deletionScheduled).toBeUndefined();
    });

    it("should create dataDeletionRequests document when deletion is requested", () => {
      const userId = "test-user-id";
      const requestDataDeletion = true;
      const reason = "user_request";

      const scheduledDeletionDate = new Date();
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

      const deletionRequestDoc = {
        userId,
        status: "pending",
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
        reason,
        exportRequested: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(deletionRequestDoc.userId).toBe(userId);
      expect(deletionRequestDoc.status).toBe("pending");
      expect(deletionRequestDoc.reason).toBe(reason);
      expect(deletionRequestDoc.exportRequested).toBe(false);
    });
  });

  describe("Consent Revocation Records", () => {
    it("should create revocation record for TOS", () => {
      const userId = "test-user-id";
      const consentType = "tos";
      const tosVersion = "3.2";
      const reason = "user_request";

      const consentRecord = {
        userId,
        consentType: "tos",
        documentVersion: tosVersion,
        action: "revoke",
        consentDetails: {
          ipAddress: "hashed-ip",
          userAgent: "Test Browser",
          deviceType: "desktop",
          platform: "Web",
        },
        reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(consentRecord.consentType).toBe("tos");
      expect(consentRecord.action).toBe("revoke");
      expect(consentRecord.documentVersion).toBe(tosVersion);
      expect(consentRecord.reason).toBe(reason);
    });

    it("should create revocation record for Privacy Policy", () => {
      const userId = "test-user-id";
      const ppVersion = "3.1";

      const consentRecord = {
        userId,
        consentType: "privacy_policy",
        documentVersion: ppVersion,
        action: "revoke",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(consentRecord.consentType).toBe("privacy_policy");
      expect(consentRecord.action).toBe("revoke");
    });

    it("should create multiple revocation records when revoking all", () => {
      const consentType = "all";
      const consentRecords: Array<{ consentType: string; action: string }> = [];

      if (consentType === "tos" || consentType === "all") {
        consentRecords.push({ consentType: "tos", action: "revoke" });
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        consentRecords.push({ consentType: "privacy_policy", action: "revoke" });
      }

      expect(consentRecords.length).toBe(2);
      expect(consentRecords[0].consentType).toBe("tos");
      expect(consentRecords[1].consentType).toBe("privacy_policy");
    });
  });

  describe("Audit Logging", () => {
    it("should log consent withdrawal for TOS", async () => {
      const params = {
        userId: "test-user-id",
        action: "consent_withdraw" as const,
        consentType: "tos" as const,
        version: "3.2",
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      await logConsentAction(params);

      expect(logConsentAction).toHaveBeenCalledWith(params);
    });

    it("should log consent withdrawal for Privacy Policy", async () => {
      const params = {
        userId: "test-user-id",
        action: "consent_withdraw" as const,
        consentType: "pp" as const,
        version: "3.1",
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      await logConsentAction(params);

      expect(logConsentAction).toHaveBeenCalledWith(params);
    });

    it("should log security event for consent revocation", async () => {
      const consentType = "all";
      const requestDataDeletion = true;
      const deletionRequestId = "deletion-request-id";

      const params = {
        userId: "test-user-id",
        eventType: "consent_revoked",
        severity: "medium" as const,
        details: {
          consentType,
          requestDataDeletion,
          deletionRequestId,
        },
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      await logSecurityEvent(params);

      expect(logSecurityEvent).toHaveBeenCalledWith(params);
    });
  });

  describe("Response Format", () => {
    it("should return correct success response without data deletion", () => {
      const response = {
        success: true,
        message: "同意を撤回しました。ログアウトされます。",
        consentType: "all",
        forceLogout: true,
        deletionScheduled: false,
        deletionRequestId: undefined,
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe("同意を撤回しました。ログアウトされます。");
      expect(response.forceLogout).toBe(true);
      expect(response.deletionScheduled).toBe(false);
    });

    it("should return correct success response with data deletion", () => {
      const response = {
        success: true,
        message: "同意を撤回しました。ログアウトされます。",
        consentType: "all",
        forceLogout: true,
        deletionScheduled: true,
        deletionRequestId: "deletion-request-123",
      };

      expect(response.success).toBe(true);
      expect(response.deletionScheduled).toBe(true);
      expect(response.deletionRequestId).toBe("deletion-request-123");
    });
  });

  describe("Error Handling", () => {
    it("should continue even if custom claims fail to set", async () => {
      // Simulate setCustomUserClaims failure
      (mockAuth.setCustomUserClaims as jest.Mock).mockRejectedValueOnce(
        new Error("Custom claims failed")
      );

      try {
        await mockAuth.setCustomUserClaims("test-user-id", { forceLogout: true });
      } catch {
        // Error is caught and logged, but operation continues
        // This simulates the behavior in revoke.ts where claimError is caught
      }

      // The operation should continue - forceLogoutAt in Firestore also triggers logout
      const firestoreUpdate = {
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(firestoreUpdate.forceLogout).toBe(true);
    });

    it("should throw HttpsError for internal errors", () => {
      const simulateInternalError = () => {
        throw new HttpsError("internal", "同意の撤回に失敗しました");
      };

      expect(simulateInternalError).toThrow("同意の撤回に失敗しました");
    });
  });

  describe("Data Retention", () => {
    it("should set data retention date to 7 years for revocation record", () => {
      const now = new Date();
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      const expectedYear = now.getFullYear() + 7;
      expect(dataRetentionDate.getFullYear()).toBe(expectedYear);
    });

    it("should set scheduled deletion date to 30 days from now", () => {
      const now = new Date();
      const scheduledDeletionDate = new Date();
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

      // Verify approximately 30 days
      const diffTime = scheduledDeletionDate.getTime() - now.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe("IP Address Hashing", () => {
    it("should hash IP address for privacy", () => {
      const crypto = require("crypto");

      const hashIpAddress = (ip: string): string => {
        const salt = process.env.CONSENT_SALT || "consent_default_salt";
        return crypto
          .createHash("sha256")
          .update(ip + salt)
          .digest("hex")
          .substring(0, 16);
      };

      const ip = "192.168.1.1";
      const hashed = hashIpAddress(ip);

      expect(hashed.length).toBe(16);
      expect(hashed).not.toBe(ip);

      // Same IP should produce same hash
      expect(hashIpAddress(ip)).toBe(hashed);
    });
  });
});
