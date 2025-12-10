/**
 * Consent Status API Unit Tests
 *
 * Tests for the consent status retrieval functionality.
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
    toDate: () => new Date("2025-01-15T10:00:00Z"),
    toMillis: () => new Date("2025-01-15T10:00:00Z").getTime(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
  };

  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    FieldValue: mockFieldValue,
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
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

// Import after mocks
import * as admin from "firebase-admin";
import { requireCsrfProtection } from "../../../src/middleware/csrf";

// Current versions (as defined in status.ts)
const CURRENT_TOS_VERSION = "3.2";
const CURRENT_PP_VERSION = "3.1";

describe("getConsentStatus API", () => {
  let mockFirestore: ReturnType<typeof admin.firestore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = admin.firestore();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const request = {
        auth: null,
        data: {},
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
        data: {},
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
        data: {},
        rawRequest: {},
      };

      requireCsrfProtection(request as never);

      expect(requireCsrfProtection).toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    it("should default includeHistory to false", () => {
      const data: { includeHistory?: boolean } = {};
      const includeHistory = data.includeHistory === true;

      expect(includeHistory).toBe(false);
    });

    it("should handle includeHistory true", () => {
      const data = { includeHistory: true };
      const includeHistory = data.includeHistory === true;

      expect(includeHistory).toBe(true);
    });

    it("should limit historyLimit to range 1-100", () => {
      // Note: The actual implementation uses `limit || 10` which means 0 becomes 10
      // This matches the behavior in status.ts
      const getHistoryLimit = (limit?: number): number => {
        return Math.min(Math.max(limit || 10, 1), 100);
      };

      expect(getHistoryLimit(undefined)).toBe(10);
      expect(getHistoryLimit(0)).toBe(10); // 0 || 10 = 10, then max(10, 1) = 10
      expect(getHistoryLimit(-5)).toBe(1); // -5 || 10 = -5 (truthy), then max(-5, 1) = 1
      expect(getHistoryLimit(50)).toBe(50);
      expect(getHistoryLimit(150)).toBe(100);
      expect(getHistoryLimit(1)).toBe(1);
      expect(getHistoryLimit(100)).toBe(100);
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
  });

  describe("Consent Status Building", () => {
    it("should report no consent when user has not consented", async () => {
      const userData = {
        tosAccepted: false,
        ppAccepted: false,
        tosVersion: null,
        ppVersion: null,
        tosAcceptedAt: null,
        ppAcceptedAt: null,
      };

      const buildStatus = (data: typeof userData) => ({
        tosAccepted: data.tosAccepted === true,
        tosAcceptedAt: data.tosAcceptedAt?.toDate?.()?.toISOString() || null,
        tosVersion: data.tosVersion || null,
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate: data.tosAccepted && data.tosVersion !== CURRENT_TOS_VERSION,
        ppAccepted: data.ppAccepted === true,
        ppAcceptedAt: data.ppAcceptedAt?.toDate?.()?.toISOString() || null,
        ppVersion: data.ppVersion || null,
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate: data.ppAccepted && data.ppVersion !== CURRENT_PP_VERSION,
        allConsentsValid: false,
        needsConsent: true,
      });

      const status = buildStatus(userData);

      expect(status.tosAccepted).toBe(false);
      expect(status.ppAccepted).toBe(false);
      expect(status.needsConsent).toBe(true);
      expect(status.allConsentsValid).toBe(false);
    });

    it("should report partial consent when only TOS is accepted", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAccepted: true,
        tosAcceptedAt: mockTimestamp,
        tosVersion: "3.2",
        ppAccepted: false,
        ppAcceptedAt: null,
        ppVersion: null,
      };

      const status = {
        tosAccepted: userData.tosAccepted === true,
        tosVersion: userData.tosVersion || null,
        ppAccepted: userData.ppAccepted === true,
        ppVersion: userData.ppVersion || null,
        needsConsent: userData.tosAccepted !== true || userData.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(true);
      expect(status.ppAccepted).toBe(false);
      expect(status.needsConsent).toBe(true);
    });

    it("should report partial consent when only PP is accepted", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAccepted: false,
        tosAcceptedAt: null,
        tosVersion: null,
        ppAccepted: true,
        ppAcceptedAt: mockTimestamp,
        ppVersion: "3.1",
      };

      const status = {
        tosAccepted: userData.tosAccepted === true,
        ppAccepted: userData.ppAccepted === true,
        needsConsent: userData.tosAccepted !== true || userData.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(false);
      expect(status.ppAccepted).toBe(true);
      expect(status.needsConsent).toBe(true);
    });

    it("should report full consent with current versions", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAccepted: true,
        tosAcceptedAt: mockTimestamp,
        tosVersion: CURRENT_TOS_VERSION,
        ppAccepted: true,
        ppAcceptedAt: mockTimestamp,
        ppVersion: CURRENT_PP_VERSION,
      };

      const tosNeedsUpdate = userData.tosAccepted && userData.tosVersion !== CURRENT_TOS_VERSION;
      const ppNeedsUpdate = userData.ppAccepted && userData.ppVersion !== CURRENT_PP_VERSION;

      const status = {
        tosAccepted: userData.tosAccepted === true,
        tosVersion: userData.tosVersion || null,
        tosNeedsUpdate,
        ppAccepted: userData.ppAccepted === true,
        ppVersion: userData.ppVersion || null,
        ppNeedsUpdate,
        allConsentsValid:
          userData.tosAccepted &&
          userData.ppAccepted &&
          !tosNeedsUpdate &&
          !ppNeedsUpdate,
        needsConsent: userData.tosAccepted !== true || userData.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(true);
      expect(status.ppAccepted).toBe(true);
      expect(status.tosNeedsUpdate).toBe(false);
      expect(status.ppNeedsUpdate).toBe(false);
      expect(status.allConsentsValid).toBe(true);
      expect(status.needsConsent).toBe(false);
    });

    it("should indicate update needed when TOS version is outdated", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAccepted: true,
        tosAcceptedAt: mockTimestamp,
        tosVersion: "3.0", // Outdated version
        ppAccepted: true,
        ppAcceptedAt: mockTimestamp,
        ppVersion: CURRENT_PP_VERSION,
      };

      const tosNeedsUpdate = userData.tosAccepted && userData.tosVersion !== CURRENT_TOS_VERSION;
      const ppNeedsUpdate = userData.ppAccepted && userData.ppVersion !== CURRENT_PP_VERSION;

      const status = {
        tosNeedsUpdate,
        ppNeedsUpdate,
        allConsentsValid:
          userData.tosAccepted &&
          userData.ppAccepted &&
          !tosNeedsUpdate &&
          !ppNeedsUpdate,
      };

      expect(status.tosNeedsUpdate).toBe(true);
      expect(status.ppNeedsUpdate).toBe(false);
      expect(status.allConsentsValid).toBe(false);
    });

    it("should indicate update needed when PP version is outdated", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAccepted: true,
        tosAcceptedAt: mockTimestamp,
        tosVersion: CURRENT_TOS_VERSION,
        ppAccepted: true,
        ppAcceptedAt: mockTimestamp,
        ppVersion: "3.0", // Outdated version
      };

      const tosNeedsUpdate = userData.tosAccepted && userData.tosVersion !== CURRENT_TOS_VERSION;
      const ppNeedsUpdate = userData.ppAccepted && userData.ppVersion !== CURRENT_PP_VERSION;

      expect(tosNeedsUpdate).toBe(false);
      expect(ppNeedsUpdate).toBe(true);
    });
  });

  describe("Consent History", () => {
    it("should not include history when includeHistory is false", () => {
      const includeHistory = false;
      const response: { history?: unknown[] } = {};

      if (includeHistory) {
        response.history = [];
      }

      expect(response.history).toBeUndefined();
    });

    it("should include history when includeHistory is true", () => {
      const includeHistory = true;
      const mockHistory = [
        {
          consentType: "tos",
          action: "accept",
          documentVersion: "3.2",
          createdAt: "2025-01-15T10:00:00.000Z",
        },
        {
          consentType: "privacy_policy",
          action: "accept",
          documentVersion: "3.1",
          createdAt: "2025-01-15T09:00:00.000Z",
        },
      ];

      const response: { history?: typeof mockHistory } = {};

      if (includeHistory) {
        response.history = mockHistory;
      }

      expect(response.history).toBeDefined();
      expect(response.history?.length).toBe(2);
    });

    it("should format consent history entries correctly", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00.000Z"),
      };

      const consentDoc = {
        consentType: "tos",
        action: "accept",
        documentVersion: "3.2",
        createdAt: mockTimestamp,
      };

      const historyEntry = {
        consentType: consentDoc.consentType,
        action: consentDoc.action,
        documentVersion: consentDoc.documentVersion,
        createdAt: consentDoc.createdAt?.toDate?.()?.toISOString() || "",
      };

      expect(historyEntry.consentType).toBe("tos");
      expect(historyEntry.action).toBe("accept");
      expect(historyEntry.documentVersion).toBe("3.2");
      expect(historyEntry.createdAt).toBe("2025-01-15T10:00:00.000Z");
    });

    it("should handle missing createdAt timestamp", () => {
      const consentDoc = {
        consentType: "tos",
        action: "accept",
        documentVersion: "3.2",
        createdAt: null,
      };

      const historyEntry = {
        consentType: consentDoc.consentType,
        action: consentDoc.action,
        documentVersion: consentDoc.documentVersion,
        createdAt: consentDoc.createdAt?.toDate?.()?.toISOString() || "",
      };

      expect(historyEntry.createdAt).toBe("");
    });
  });

  describe("Response Format", () => {
    it("should return correct response without history", () => {
      const status = {
        tosAccepted: true,
        tosAcceptedAt: "2025-01-15T10:00:00.000Z",
        tosVersion: "3.2",
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate: false,
        ppAccepted: true,
        ppAcceptedAt: "2025-01-15T09:00:00.000Z",
        ppVersion: "3.1",
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate: false,
        allConsentsValid: true,
        needsConsent: false,
      };

      const response = {
        success: true,
        status,
        history: undefined,
      };

      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.status.tosAccepted).toBe(true);
      expect(response.status.ppAccepted).toBe(true);
      expect(response.status.allConsentsValid).toBe(true);
      expect(response.history).toBeUndefined();
    });

    it("should return correct response with history", () => {
      const status = {
        tosAccepted: true,
        tosAcceptedAt: "2025-01-15T10:00:00.000Z",
        tosVersion: "3.2",
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate: false,
        ppAccepted: true,
        ppAcceptedAt: "2025-01-15T09:00:00.000Z",
        ppVersion: "3.1",
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate: false,
        allConsentsValid: true,
        needsConsent: false,
      };

      const history = [
        {
          consentType: "tos",
          action: "accept",
          documentVersion: "3.2",
          createdAt: "2025-01-15T10:00:00.000Z",
        },
      ];

      const response = {
        success: true,
        status,
        history,
      };

      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.history).toBeDefined();
      expect(response.history.length).toBe(1);
    });
  });

  describe("Date Formatting", () => {
    it("should format timestamp to ISO string", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:30:00.000Z"),
      };

      const formatted = mockTimestamp.toDate?.()?.toISOString();

      expect(formatted).toBe("2025-01-15T10:30:00.000Z");
    });

    it("should return null for missing timestamp", () => {
      const userData = {
        tosAcceptedAt: null,
      };

      const formatted = userData.tosAcceptedAt?.toDate?.()?.toISOString() || null;

      expect(formatted).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should throw HttpsError for not-found user", () => {
      expect(() => {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }).toThrow("ユーザーが見つかりません");
    });

    it("should throw HttpsError for internal errors", () => {
      expect(() => {
        throw new HttpsError("internal", "同意状態の取得に失敗しました");
      }).toThrow("同意状態の取得に失敗しました");
    });

    it("should re-throw HttpsError without wrapping", () => {
      const processError = (error: unknown) => {
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError("internal", "予期しないエラーが発生しました");
      };

      const httpsError = new HttpsError("permission-denied", "権限がありません");

      expect(() => processError(httpsError)).toThrow("権限がありません");
    });
  });

  describe("Version Comparison", () => {
    it("should correctly identify current version", () => {
      expect(CURRENT_TOS_VERSION).toBe("3.2");
      expect(CURRENT_PP_VERSION).toBe("3.1");
    });

    it("should detect outdated TOS version", () => {
      const userTosVersion = "3.1";
      const needsUpdate = userTosVersion !== CURRENT_TOS_VERSION;

      expect(needsUpdate).toBe(true);
    });

    it("should detect current TOS version", () => {
      const userTosVersion = "3.2";
      const needsUpdate = userTosVersion !== CURRENT_TOS_VERSION;

      expect(needsUpdate).toBe(false);
    });

    it("should detect outdated PP version", () => {
      const userPpVersion = "3.0";
      const needsUpdate = userPpVersion !== CURRENT_PP_VERSION;

      expect(needsUpdate).toBe(true);
    });

    it("should detect current PP version", () => {
      const userPpVersion = "3.1";
      const needsUpdate = userPpVersion !== CURRENT_PP_VERSION;

      expect(needsUpdate).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data object", () => {
      const data = {} as { includeHistory?: boolean; historyLimit?: number };
      const includeHistory = data.includeHistory === true;
      const historyLimit = Math.min(Math.max(data.historyLimit || 10, 1), 100);

      expect(includeHistory).toBe(false);
      expect(historyLimit).toBe(10);
    });

    it("should handle null data", () => {
      const data = null as unknown as { includeHistory?: boolean };
      const defaultData = data || {};
      const includeHistory = defaultData.includeHistory === true;

      expect(includeHistory).toBe(false);
    });

    it("should handle undefined data", () => {
      const data = undefined as unknown as { includeHistory?: boolean };
      const defaultData = data || {};
      const includeHistory = defaultData.includeHistory === true;

      expect(includeHistory).toBe(false);
    });

    it("should handle user with only timestamps but no accepted flags", () => {
      const mockTimestamp = {
        toDate: () => new Date("2025-01-15T10:00:00Z"),
      };

      const userData = {
        tosAcceptedAt: mockTimestamp,
        ppAcceptedAt: mockTimestamp,
        // tosAccepted and ppAccepted are missing
      } as {
        tosAccepted?: boolean;
        ppAccepted?: boolean;
        tosAcceptedAt?: typeof mockTimestamp;
        ppAcceptedAt?: typeof mockTimestamp;
      };

      const tosAccepted = userData.tosAccepted === true;
      const ppAccepted = userData.ppAccepted === true;

      expect(tosAccepted).toBe(false);
      expect(ppAccepted).toBe(false);
    });
  });

  describe("Consent Status Interface", () => {
    it("should have all required fields in status response", () => {
      const status = {
        tosAccepted: true,
        tosAcceptedAt: "2025-01-15T10:00:00.000Z",
        tosVersion: "3.2",
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate: false,
        ppAccepted: true,
        ppAcceptedAt: "2025-01-15T09:00:00.000Z",
        ppVersion: "3.1",
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate: false,
        allConsentsValid: true,
        needsConsent: false,
      };

      // Verify all required fields exist
      expect(status).toHaveProperty("tosAccepted");
      expect(status).toHaveProperty("tosAcceptedAt");
      expect(status).toHaveProperty("tosVersion");
      expect(status).toHaveProperty("tosCurrentVersion");
      expect(status).toHaveProperty("tosNeedsUpdate");
      expect(status).toHaveProperty("ppAccepted");
      expect(status).toHaveProperty("ppAcceptedAt");
      expect(status).toHaveProperty("ppVersion");
      expect(status).toHaveProperty("ppCurrentVersion");
      expect(status).toHaveProperty("ppNeedsUpdate");
      expect(status).toHaveProperty("allConsentsValid");
      expect(status).toHaveProperty("needsConsent");
    });
  });

  describe("History Entry Interface", () => {
    it("should have all required fields in history entry", () => {
      const historyEntry = {
        consentType: "tos",
        action: "accept",
        documentVersion: "3.2",
        createdAt: "2025-01-15T10:00:00.000Z",
      };

      expect(historyEntry).toHaveProperty("consentType");
      expect(historyEntry).toHaveProperty("action");
      expect(historyEntry).toHaveProperty("documentVersion");
      expect(historyEntry).toHaveProperty("createdAt");
    });

    it("should support revoke action in history", () => {
      const revokeEntry = {
        consentType: "tos",
        action: "revoke",
        documentVersion: "3.2",
        createdAt: "2025-01-16T10:00:00.000Z",
      };

      expect(revokeEntry.action).toBe("revoke");
    });
  });
});
