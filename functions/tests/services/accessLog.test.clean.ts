/**
 * Audit Log Service Tests
 *
 * Unit tests for audit logging functionality
 * Covers GDPR compliance requirements for audit trails
 *
 * Reference: docs/specs/07_セキュリティポリシー_v1_0.md
 */

import * as admin from "firebase-admin";

// Mock setup must come before imports
jest.mock("firebase-admin", () => {
  const mockTimestamp = {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
  };

  const mockDocRef = {
    id: "audit-log-123",
  };

  const mockFirestore = {
    collection: jest.fn(() => ({
      add: jest.fn(() => Promise.resolve(mockDocRef)),
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ docs: [] })),
          })),
        })),
      })),
    })),
    FieldValue: mockFieldValue,
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    app: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    auth: jest.fn(() => ({
      getUser: jest.fn(() => Promise.resolve({ uid: "test-uid" })),
    })),
  };
});

// Import after mocks
import {
  createAuditLog,
  logProfileUpdate,
  logConsentAction,
  logAuthAction,
  logSecurityEvent,
  logAdminAction,
  AuditAction,
} from "../../src/services/auditLog";

describe("Audit Log Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAuditLog", () => {
    it("should create an audit log entry successfully", async () => {
      const entry = {
        userId: "user-123",
        action: "profile_update" as AuditAction,
        resourceType: "user_profile",
        success: true,
      };

      const result = await createAuditLog(entry);

      expect(result).toBe("audit-log-123");
      expect(admin.firestore().collection).toHaveBeenCalledWith("auditLogs");
    });

    it("should hash userId for privacy", async () => {
      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      expect(mockAdd).toHaveBeenCalled();

      const loggedEntry = mockAdd.mock.calls[0][0];
      // userId should be hashed (not the original)
      expect(loggedEntry.userId).not.toBe("user-123");
      expect(loggedEntry.userId.length).toBe(16); // SHA256 truncated to 16 chars
    });

    it("should sanitize sensitive fields in values", async () => {
      const entry = {
        userId: "user-123",
        action: "profile_update" as AuditAction,
        resourceType: "user_profile",
        previousValues: {
          password: "secret123",
          email: "test@example.com",
        },
        newValues: {
          password: "newSecret456",
          email: "new@example.com",
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.previousValues.password).toBe("[REDACTED]");
      expect(loggedEntry.newValues.password).toBe("[REDACTED]");
      expect(loggedEntry.previousValues.email).toBe("test@example.com");
    });

    it("should include timestamp in entry", async () => {
      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.timestamp).toBeDefined();
    });

    it("should return empty string on error", async () => {
      // Mock error
      const mockCollection = admin.firestore().collection as jest.Mock;
      mockCollection.mockImplementationOnce(() => {
        throw new Error("Firestore error");
      });

      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        success: true,
      };

      const result = await createAuditLog(entry);

      expect(result).toBe("");
    });

    it("should include error message for failed actions", async () => {
      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        success: false,
        errorMessage: "Invalid credentials",
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.success).toBe(false);
      expect(loggedEntry.errorMessage).toBe("Invalid credentials");
    });

    it("should include metadata when provided", async () => {
      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        metadata: {
          method: "password",
          deviceType: "mobile",
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.metadata).toEqual({
        method: "password",
        deviceType: "mobile",
      });
    });
  });

  describe("logProfileUpdate", () => {
    it("should log profile update with changed fields", async () => {
      const params = {
        userId: "user-123",
        previousValues: { displayName: "Old Name", email: "old@test.com" },
        newValues: { displayName: "New Name", email: "old@test.com" },
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("profile_update");
      expect(loggedEntry.resourceType).toBe("user_profile");
      expect(loggedEntry.changedFields).toContain("displayName");
      expect(loggedEntry.changedFields).not.toContain("email");
    });

    it("should hash IP address for privacy", async () => {
      const params = {
        userId: "user-123",
        newValues: { displayName: "Test" },
        ipAddress: "192.168.1.1",
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.ipAddressHash).not.toBe("192.168.1.1");
      expect(loggedEntry.ipAddressHash.length).toBe(16);
    });

    it("should include user agent when provided", async () => {
      const params = {
        userId: "user-123",
        newValues: { displayName: "Test" },
        userAgent: "Mozilla/5.0",
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.userAgent).toBe("Mozilla/5.0");
    });
  });

  describe("logConsentAction", () => {
    it("should log consent acceptance", async () => {
      const params = {
        userId: "user-123",
        action: "consent_accept" as const,
        consentType: "tos" as const,
        version: "1.0.0",
      };

      await logConsentAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("consent_accept");
      expect(loggedEntry.resourceType).toBe("consent");
      expect(loggedEntry.resourceId).toBe("tos_1.0.0");
      expect(loggedEntry.newValues.consentType).toBe("tos");
      expect(loggedEntry.newValues.version).toBe("1.0.0");
    });

    it("should log consent withdrawal", async () => {
      const params = {
        userId: "user-123",
        action: "consent_withdraw" as const,
        consentType: "pp" as const,
        version: "2.0.0",
      };

      await logConsentAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("consent_withdraw");
      expect(loggedEntry.resourceId).toBe("pp_2.0.0");
    });
  });

  describe("logAuthAction", () => {
    it("should log login action", async () => {
      const params = {
        userId: "user-123",
        action: "login" as const,
        method: "password",
        success: true,
      };

      await logAuthAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("login");
      expect(loggedEntry.resourceType).toBe("authentication");
      expect(loggedEntry.metadata.method).toBe("password");
    });

    it("should log failed login attempt", async () => {
      const params = {
        userId: "user-123",
        action: "login" as const,
        success: false,
        errorMessage: "Invalid password",
      };

      await logAuthAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.success).toBe(false);
      expect(loggedEntry.errorMessage).toBe("Invalid password");
    });

    it("should log password change", async () => {
      const params = {
        userId: "user-123",
        action: "password_change" as const,
        success: true,
      };

      await logAuthAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("password_change");
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security event with severity", async () => {
      const params = {
        userId: "user-123",
        eventType: "suspicious_login",
        severity: "high" as const,
        details: {
          location: "unknown",
          attempts: 5,
        },
      };

      await logSecurityEvent(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("security_event");
      expect(loggedEntry.metadata.eventType).toBe("suspicious_login");
      expect(loggedEntry.metadata.severity).toBe("high");
      expect(loggedEntry.metadata.attempts).toBe(5);
    });

    it("should handle critical severity events", async () => {
      const params = {
        userId: "user-123",
        eventType: "account_compromise",
        severity: "critical" as const,
        details: {
          reason: "password_leaked",
        },
      };

      await logSecurityEvent(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.metadata.severity).toBe("critical");
    });
  });

  describe("logAdminAction", () => {
    it("should log admin action with target user", async () => {
      const params = {
        adminUserId: "admin-123",
        targetUserId: "user-456",
        action: "view_user_data" as const,
        details: {
          reason: "support_request",
        },
      };

      await logAdminAction(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.action).toBe("admin_action");
      expect(loggedEntry.resourceType).toBe("admin_operation");
    });
  });

  describe("Sensitive Data Handling", () => {
    it("should redact password fields", async () => {
      const entry = {
        userId: "user-123",
        action: "profile_update" as AuditAction,
        resourceType: "user",
        newValues: {
          password: "secret123",
          passwordHash: "hash123",
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.newValues.password).toBe("[REDACTED]");
      expect(loggedEntry.newValues.passwordHash).toBe("[REDACTED]");
    });

    it("should redact token fields", async () => {
      const entry = {
        userId: "user-123",
        action: "login" as AuditAction,
        resourceType: "authentication",
        newValues: {
          accessToken: "abc123",
          refreshToken: "xyz789",
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.newValues.accessToken).toBe("[REDACTED]");
      expect(loggedEntry.newValues.refreshToken).toBe("[REDACTED]");
    });

    it("should redact api key fields", async () => {
      const entry = {
        userId: "user-123",
        action: "settings_update" as AuditAction,
        resourceType: "settings",
        newValues: {
          apiKey: "key-123",
          apiKeySecret: "secret-456",
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.newValues.apiKey).toBe("[REDACTED]");
      expect(loggedEntry.newValues.apiKeySecret).toBe("[REDACTED]");
    });

    it("should handle nested sensitive fields", async () => {
      const entry = {
        userId: "user-123",
        action: "profile_update" as AuditAction,
        resourceType: "user",
        newValues: {
          settings: {
            password: "nested-secret",
            displayName: "Test",
          },
        },
        success: true,
      };

      await createAuditLog(entry);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.newValues.settings.password).toBe("[REDACTED]");
      expect(loggedEntry.newValues.settings.displayName).toBe("Test");
    });
  });

  describe("Changed Fields Detection", () => {
    it("should detect changed string fields", async () => {
      const params = {
        userId: "user-123",
        previousValues: { name: "Old", email: "same@test.com" },
        newValues: { name: "New", email: "same@test.com" },
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.changedFields).toEqual(["name"]);
    });

    it("should detect changed object fields", async () => {
      const params = {
        userId: "user-123",
        previousValues: { settings: { theme: "light" } },
        newValues: { settings: { theme: "dark" } },
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.changedFields).toContain("settings");
    });

    it("should detect all fields as changed for new data", async () => {
      const params = {
        userId: "user-123",
        newValues: { name: "Test", email: "test@test.com" },
        success: true,
      };

      await logProfileUpdate(params);

      const mockAdd = admin.firestore().collection("auditLogs").add as jest.Mock;
      const loggedEntry = mockAdd.mock.calls[0][0];

      expect(loggedEntry.changedFields).toContain("name");
      expect(loggedEntry.changedFields).toContain("email");
    });
  });
});
