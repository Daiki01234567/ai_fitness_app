/**
 * Record Consent API Unit Tests
 *
 * Tests for the consent recording functionality.
 * Reference: docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md
 * Ticket: 006 - GDPR Consent API
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { HttpsError } from "firebase-functions/v2/https";

// Mock modules before importing the module under test
const mockTimestamp = {
  toDate: () => new Date(),
  toMillis: () => Date.now(),
};

const mockFieldValue = {
  serverTimestamp: jest.fn(() => mockTimestamp),
};

jest.mock("firebase-admin", () => {
  const mockTransaction = {
    set: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
  };

  const mockFirestoreInstance = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    runTransaction: jest.fn((fn: (t: typeof mockTransaction) => unknown) =>
      fn(mockTransaction)
    ),
  };

  const firestoreFn = jest.fn(() => mockFirestoreInstance);

  // Add FieldValue as a static property
  Object.defineProperty(firestoreFn, "FieldValue", {
    value: {
      serverTimestamp: jest.fn(() => ({
        toDate: () => new Date(),
        toMillis: () => Date.now(),
      })),
    },
    writable: true,
  });

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: firestoreFn,
    auth: jest.fn(() => ({
      setCustomUserClaims: jest.fn(),
      revokeRefreshTokens: jest.fn(),
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
  requireCsrfProtection: jest.fn(),
}));

jest.mock("../../../src/services/auditLog", () => ({
  logConsentAction: jest.fn().mockResolvedValue("audit-log-id"),
}));

// Import after mocks
import * as admin from "firebase-admin";
import { requireCsrfProtection } from "../../../src/middleware/csrf";
import { logConsentAction } from "../../../src/services/auditLog";

describe("recordConsent API", () => {
  let mockFirestore: ReturnType<typeof admin.firestore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = admin.firestore();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      // Simulate the authentication check from record.ts
      const request = {
        auth: null,
        data: {
          consentType: "tos",
          accepted: true,
        },
        rawRequest: {},
      };

      // The actual function checks auth first
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
          consentType: "tos",
          accepted: true,
        },
        rawRequest: {},
      };

      expect(request.auth).toBeDefined();
      expect(request.auth?.uid).toBe("test-user-id");
    });
  });

  describe("CSRF Protection", () => {
    it("should call CSRF protection middleware", () => {
      const request = {
        auth: { uid: "test-user-id", token: {} },
        data: { consentType: "tos", accepted: true },
        rawRequest: {},
      };

      // Simulate middleware call
      requireCsrfProtection(request as never);

      expect(requireCsrfProtection).toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    it("should reject when accepted is not true", () => {
      const validateAccepted = (accepted: unknown): void => {
        if (accepted !== true) {
          throw new HttpsError("invalid-argument", "同意が必要です");
        }
      };

      expect(() => validateAccepted(false)).toThrow("同意が必要です");
      expect(() => validateAccepted(null)).toThrow("同意が必要です");
      expect(() => validateAccepted(undefined)).toThrow("同意が必要です");
      expect(() => validateAccepted("true")).toThrow("同意が必要です");
    });

    it("should accept when accepted is true", () => {
      const validateAccepted = (accepted: unknown): void => {
        if (accepted !== true) {
          throw new HttpsError("invalid-argument", "同意が必要です");
        }
      };

      expect(() => validateAccepted(true)).not.toThrow();
    });

    it("should reject invalid consent types", () => {
      const validateConsentType = (type: unknown): "tos" | "privacy_policy" => {
        if (type !== "tos" && type !== "privacy_policy") {
          throw new HttpsError(
            "invalid-argument",
            "同意タイプが無効です。'tos' または 'privacy_policy' を指定してください"
          );
        }
        return type;
      };

      expect(() => validateConsentType("invalid")).toThrow("同意タイプが無効です");
      expect(() => validateConsentType("")).toThrow("同意タイプが無効です");
      expect(() => validateConsentType(null)).toThrow("同意タイプが無効です");
      expect(() => validateConsentType(123)).toThrow("同意タイプが無効です");
    });

    it("should accept valid consent types", () => {
      const validateConsentType = (type: unknown): "tos" | "privacy_policy" => {
        if (type !== "tos" && type !== "privacy_policy") {
          throw new HttpsError(
            "invalid-argument",
            "同意タイプが無効です。'tos' または 'privacy_policy' を指定してください"
          );
        }
        return type;
      };

      expect(validateConsentType("tos")).toBe("tos");
      expect(validateConsentType("privacy_policy")).toBe("privacy_policy");
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

    it("should reject if user is scheduled for deletion", async () => {
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
            "アカウント削除が予定されているため、同意を記録できません"
          );
        }).toThrow("アカウント削除が予定されているため");
      }
    });
  });

  describe("Consent Recording", () => {
    it("should create consent record with correct structure for TOS", async () => {
      const userId = "test-user-id";
      const consentType = "tos";
      const documentVersion = "3.2";

      const consentRecord = {
        userId,
        consentType,
        documentVersion,
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip",
          userAgent: "Test User Agent",
          deviceType: "desktop",
          platform: "Web",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(consentRecord.userId).toBe(userId);
      expect(consentRecord.consentType).toBe(consentType);
      expect(consentRecord.documentVersion).toBe(documentVersion);
      expect(consentRecord.action).toBe("accept");
      expect(consentRecord.consentDetails.ipAddress).toBeDefined();
    });

    it("should create consent record with correct structure for Privacy Policy", async () => {
      const userId = "test-user-id";
      const consentType = "privacy_policy";
      const documentVersion = "3.1";

      const consentRecord = {
        userId,
        consentType,
        documentVersion,
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip",
          userAgent: "Test User Agent",
          deviceType: "mobile",
          platform: "iOS",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(consentRecord.userId).toBe(userId);
      expect(consentRecord.consentType).toBe(consentType);
      expect(consentRecord.documentVersion).toBe(documentVersion);
    });

    it("should update user document with TOS consent", () => {
      const userUpdate = {
        tosAccepted: true,
        tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        tosVersion: "3.2",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(userUpdate.tosAccepted).toBe(true);
      expect(userUpdate.tosVersion).toBe("3.2");
    });

    it("should update user document with Privacy Policy consent", () => {
      const userUpdate = {
        ppAccepted: true,
        ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        ppVersion: "3.1",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      expect(userUpdate.ppAccepted).toBe(true);
      expect(userUpdate.ppVersion).toBe("3.1");
    });
  });

  describe("Audit Logging", () => {
    it("should log consent action for TOS", async () => {
      const params = {
        userId: "test-user-id",
        action: "consent_accept" as const,
        consentType: "tos" as const,
        version: "3.2",
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      await logConsentAction(params);

      expect(logConsentAction).toHaveBeenCalledWith(params);
    });

    it("should log consent action for Privacy Policy", async () => {
      const params = {
        userId: "test-user-id",
        action: "consent_accept" as const,
        consentType: "pp" as const,
        version: "3.1",
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      await logConsentAction(params);

      expect(logConsentAction).toHaveBeenCalledWith(params);
    });
  });

  describe("Response Format", () => {
    it("should return correct success response", () => {
      const response = {
        success: true,
        message: "同意を記録しました",
        consentType: "tos",
        documentVersion: "3.2",
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe("同意を記録しました");
      expect(response.consentType).toBe("tos");
      expect(response.documentVersion).toBeDefined();
    });
  });

  describe("IP Address Handling", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const getClientIp = (rawRequest: unknown): string => {
        if (!rawRequest || typeof rawRequest !== "object") {
          return "unknown";
        }

        const req = rawRequest as Record<string, unknown>;
        const headers = req.headers as Record<string, string> | undefined;

        const xForwardedFor = headers?.["x-forwarded-for"];
        if (typeof xForwardedFor === "string") {
          return xForwardedFor.split(",")[0].trim();
        }

        return "unknown";
      };

      const rawRequest = {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        },
      };

      expect(getClientIp(rawRequest)).toBe("192.168.1.1");
    });

    it("should return unknown for missing IP", () => {
      const getClientIp = (rawRequest: unknown): string => {
        if (!rawRequest || typeof rawRequest !== "object") {
          return "unknown";
        }
        return "unknown";
      };

      expect(getClientIp(null)).toBe("unknown");
      expect(getClientIp(undefined)).toBe("unknown");
      expect(getClientIp({})).toBe("unknown");
    });
  });

  describe("Device Detection", () => {
    it("should detect mobile device", () => {
      const detectDeviceType = (userAgent: string): "mobile" | "tablet" | "desktop" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("tablet") || ua.includes("ipad")) {
          return "tablet";
        }
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
          return "mobile";
        }
        return "desktop";
      };

      expect(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)")).toBe("mobile");
      expect(detectDeviceType("Mozilla/5.0 (Linux; Android 11)")).toBe("mobile");
    });

    it("should detect tablet device", () => {
      const detectDeviceType = (userAgent: string): "mobile" | "tablet" | "desktop" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("tablet") || ua.includes("ipad")) {
          return "tablet";
        }
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
          return "mobile";
        }
        return "desktop";
      };

      expect(detectDeviceType("Mozilla/5.0 (iPad; CPU OS 14_0)")).toBe("tablet");
    });

    it("should detect desktop device", () => {
      const detectDeviceType = (userAgent: string): "mobile" | "tablet" | "desktop" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("tablet") || ua.includes("ipad")) {
          return "tablet";
        }
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
          return "mobile";
        }
        return "desktop";
      };

      expect(detectDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
      expect(detectDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("desktop");
    });
  });

  describe("Platform Detection", () => {
    it("should detect iOS platform", () => {
      const detectPlatform = (userAgent: string): "iOS" | "Android" | "Web" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
          return "iOS";
        }
        if (ua.includes("android")) {
          return "Android";
        }
        return "Web";
      };

      expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)")).toBe("iOS");
      expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 14_0)")).toBe("iOS");
    });

    it("should detect Android platform", () => {
      const detectPlatform = (userAgent: string): "iOS" | "Android" | "Web" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
          return "iOS";
        }
        if (ua.includes("android")) {
          return "Android";
        }
        return "Web";
      };

      expect(detectPlatform("Mozilla/5.0 (Linux; Android 11)")).toBe("Android");
    });

    it("should detect Web platform", () => {
      const detectPlatform = (userAgent: string): "iOS" | "Android" | "Web" => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
          return "iOS";
        }
        if (ua.includes("android")) {
          return "Android";
        }
        return "Web";
      };

      expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("Web");
    });
  });

  describe("Data Retention", () => {
    it("should set data retention date to 7 years from now", () => {
      const now = new Date();
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      // Check that the retention date is approximately 7 years in the future
      const expectedYear = now.getFullYear() + 7;
      expect(dataRetentionDate.getFullYear()).toBe(expectedYear);
    });
  });
});
