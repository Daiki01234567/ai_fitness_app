/**
 * Admin Authentication Middleware Tests
 *
 * Unit tests for admin-level authentication and authorization
 * Covers admin permission levels, actions, and audit logging
 *
 * Reference: docs/specs/07_セキュリティポリシー_v1_0.md
 */

import * as admin from "firebase-admin";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockUserRecord = {
    uid: "admin-uid",
    email: "admin@example.com",
    customClaims: { admin: true },
  };

  const mockAuth = {
    getUser: jest.fn(() => Promise.resolve(mockUserRecord)),
    listUsers: jest.fn(() =>
      Promise.resolve({
        users: [mockUserRecord],
        pageToken: undefined,
      })
    ),
    setCustomUserClaims: jest.fn(() => Promise.resolve()),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  const mockDocRef = {
    set: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => Promise.resolve({ exists: false })),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(() => Promise.resolve({ id: "log-123" })),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
  }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
  };
});

// Mock utils/firestore
jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

// Mock services/auditLog
jest.mock("../../src/services/auditLog", () => ({
  logAdminAction: jest.fn(() => Promise.resolve("audit-123")),
}));

// Mock utils/logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
  },
}));

// Import after mocks
import {
  requireAdminToken,
  isAdmin,
  requireAdminFromRequest,
  getAdminLevel,
  getAdminPermissions,
  canPerformAction,
  requireAction,
  canActOnBehalfOf,
  requireActOnBehalfOf,
  executeAdminAction,
  listAdmins,
  setAdminLevel,
} from "../../src/middleware/adminAuth";
import { ADMIN_PERMISSIONS } from "../../src/types/security";
import { logger } from "../../src/utils/logger";

describe("Admin Authentication Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAdminToken", () => {
    it("should pass for admin token", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      expect(() => requireAdminToken(auth)).not.toThrow();
    });

    it("should throw AuthorizationError for non-admin token", () => {
      const auth = { uid: "user-uid", admin: false } as any;
      expect(() => requireAdminToken(auth)).toThrow("管理者権限が必要です");
      expect(logger.warn).toHaveBeenCalledWith("Admin access denied", {
        userId: "user-uid",
      });
    });

    it("should throw when admin claim is undefined", () => {
      const auth = { uid: "user-uid" } as any;
      expect(() => requireAdminToken(auth)).toThrow("管理者権限が必要です");
    });
  });

  describe("isAdmin", () => {
    it("should return true for admin", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      expect(isAdmin(auth)).toBe(true);
    });

    it("should return false for non-admin", () => {
      const auth = { uid: "user-uid", admin: false } as any;
      expect(isAdmin(auth)).toBe(false);
    });

    it("should return false for undefined auth", () => {
      expect(isAdmin(undefined)).toBe(false);
    });

    it("should return false for missing admin claim", () => {
      const auth = { uid: "user-uid" } as any;
      expect(isAdmin(auth)).toBe(false);
    });
  });

  describe("requireAdminFromRequest", () => {
    it("should pass for authenticated admin request", () => {
      const request = {
        auth: {
          uid: "admin-uid",
          token: { admin: true },
        },
      } as any;
      expect(() => requireAdminFromRequest(request)).not.toThrow();
    });

    it("should throw when no auth", () => {
      const request = { auth: null } as any;
      expect(() => requireAdminFromRequest(request)).toThrow("認証が必要です");
    });

    it("should throw when not admin", () => {
      const request = {
        auth: {
          uid: "user-uid",
          token: { admin: false },
        },
      } as any;
      expect(() => requireAdminFromRequest(request)).toThrow(
        "管理者権限が必要です"
      );
    });
  });

  describe("getAdminLevel", () => {
    it("should return super_admin for super_admin claim", () => {
      const auth = { uid: "admin-uid", super_admin: true } as any;
      expect(getAdminLevel(auth)).toBe("super_admin");
    });

    it("should return admin for admin claim", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      expect(getAdminLevel(auth)).toBe("admin");
    });

    it("should return support for support claim", () => {
      const auth = { uid: "support-uid", support: true } as any;
      expect(getAdminLevel(auth)).toBe("support");
    });

    it("should return undefined for no admin claims", () => {
      const auth = { uid: "user-uid" } as any;
      expect(getAdminLevel(auth)).toBeUndefined();
    });

    it("should return undefined for undefined auth", () => {
      expect(getAdminLevel(undefined)).toBeUndefined();
    });

    it("should prioritize super_admin over admin", () => {
      const auth = { uid: "admin-uid", super_admin: true, admin: true } as any;
      expect(getAdminLevel(auth)).toBe("super_admin");
    });
  });

  describe("getAdminPermissions", () => {
    it("should return permissions for admin", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      const permissions = getAdminPermissions(auth);

      expect(permissions).toBeDefined();
      expect(permissions?.level).toBe("admin");
      expect(permissions?.allowedActions).toEqual(ADMIN_PERMISSIONS.admin);
    });

    it("should return permissions for super_admin", () => {
      const auth = { uid: "admin-uid", super_admin: true } as any;
      const permissions = getAdminPermissions(auth);

      expect(permissions).toBeDefined();
      expect(permissions?.level).toBe("super_admin");
      expect(permissions?.allowedActions).toEqual(ADMIN_PERMISSIONS.super_admin);
    });

    it("should return permissions for support", () => {
      const auth = { uid: "support-uid", support: true } as any;
      const permissions = getAdminPermissions(auth);

      expect(permissions).toBeDefined();
      expect(permissions?.level).toBe("support");
      expect(permissions?.allowedActions).toEqual(ADMIN_PERMISSIONS.support);
    });

    it("should return undefined for non-admin", () => {
      const auth = { uid: "user-uid" } as any;
      expect(getAdminPermissions(auth)).toBeUndefined();
    });

    it("should return undefined for undefined auth", () => {
      expect(getAdminPermissions(undefined)).toBeUndefined();
    });
  });

  describe("canPerformAction", () => {
    it("should return true for allowed action", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      expect(canPerformAction(auth, "view_user_data")).toBe(true);
    });

    it("should return false for disallowed action", () => {
      const auth = { uid: "support-uid", support: true } as any;
      // support cannot delete_user_data
      expect(canPerformAction(auth, "delete_user_data")).toBe(false);
    });

    it("should return false for non-admin", () => {
      const auth = { uid: "user-uid" } as any;
      expect(canPerformAction(auth, "view_user_data")).toBe(false);
    });

    it("should return false for undefined auth", () => {
      expect(canPerformAction(undefined, "view_user_data")).toBe(false);
    });

    it("super_admin can perform all actions", () => {
      const auth = { uid: "admin-uid", super_admin: true } as any;
      expect(canPerformAction(auth, "delete_user_data")).toBe(true);
      expect(canPerformAction(auth, "modify_claims")).toBe(true);
    });
  });

  describe("requireAction", () => {
    it("should pass for allowed action", () => {
      const auth = { uid: "admin-uid", admin: true } as any;
      expect(() => requireAction(auth, "view_user_data")).not.toThrow();
    });

    it("should throw for disallowed action", () => {
      const auth = { uid: "support-uid", support: true } as any;
      expect(() => requireAction(auth, "delete_user_data")).toThrow(
        "このアクション (delete_user_data) を実行する権限がありません"
      );
      expect(logger.warn).toHaveBeenCalledWith("Admin action denied", {
        userId: "support-uid",
        action: "delete_user_data",
        level: "support",
      });
    });

    it("should throw for non-admin", () => {
      const auth = { uid: "user-uid" } as any;
      expect(() => requireAction(auth, "view_user_data")).toThrow();
    });
  });

  describe("canActOnBehalfOf", () => {
    it("should return true for admin with permission", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const result = await canActOnBehalfOf(
        "admin-uid",
        "target-uid",
        "view_user_data"
      );
      expect(result).toBe(true);
    });

    it("should return false for non-admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      const result = await canActOnBehalfOf(
        "user-uid",
        "target-uid",
        "view_user_data"
      );
      expect(result).toBe(false);
    });

    it("should return false for disallowed action", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "support-uid",
        customClaims: { support: true },
      });

      const result = await canActOnBehalfOf(
        "support-uid",
        "target-uid",
        "delete_user_data"
      );
      expect(result).toBe(false);
    });

    it("should return false for self-action by non-super_admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const result = await canActOnBehalfOf(
        "admin-uid",
        "admin-uid",
        "view_user_data"
      );
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Admin cannot perform action on self",
        { adminId: "admin-uid", action: "view_user_data" }
      );
    });

    it("should allow self-action for super_admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "super-admin-uid",
        customClaims: { super_admin: true },
      });

      const result = await canActOnBehalfOf(
        "super-admin-uid",
        "super-admin-uid",
        "view_user_data"
      );
      expect(result).toBe(true);
    });

    it("should return false on Firebase Auth error", async () => {
      (admin.auth().getUser as jest.Mock).mockRejectedValueOnce(
        new Error("Firebase error")
      );

      const result = await canActOnBehalfOf(
        "admin-uid",
        "target-uid",
        "view_user_data"
      );
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should use default action view_user_data", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const result = await canActOnBehalfOf("admin-uid", "target-uid");
      expect(result).toBe(true);
    });
  });

  describe("requireActOnBehalfOf", () => {
    it("should pass for authorized admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const request = { auth: { uid: "admin-uid" } } as any;
      await expect(
        requireActOnBehalfOf(request, "target-uid", "view_user_data")
      ).resolves.not.toThrow();
    });

    it("should throw when no auth", async () => {
      const request = { auth: null } as any;
      await expect(
        requireActOnBehalfOf(request, "target-uid", "view_user_data")
      ).rejects.toThrow("認証が必要です");
    });

    it("should throw when not authorized", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      const request = { auth: { uid: "user-uid" } } as any;
      await expect(
        requireActOnBehalfOf(request, "target-uid", "view_user_data")
      ).rejects.toThrow("このユーザーに対する操作を行う権限がありません");
    });
  });

  describe("executeAdminAction", () => {
    it("should execute action and log success", async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await executeAdminAction(
        {
          adminId: "admin-uid",
          targetUserId: "target-uid",
          action: "view_user_data",
          reason: "test reason",
          metadata: { test: true },
        },
        operation
      );

      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("Admin action started", {
        adminId: "admin-uid",
        targetUserId: "target-uid",
        action: "view_user_data",
        reason: "test reason",
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Admin action completed",
        expect.objectContaining({
          adminId: "admin-uid",
          targetUserId: "target-uid",
          action: "view_user_data",
        })
      );
    });

    it("should log failure and rethrow error", async () => {
      const error = new Error("Operation failed");
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        executeAdminAction(
          {
            adminId: "admin-uid",
            targetUserId: "target-uid",
            action: "delete_user_data",
            reason: "test deletion",
          },
          operation
        )
      ).rejects.toThrow("Operation failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Admin action failed",
        error,
        expect.objectContaining({
          adminId: "admin-uid",
          targetUserId: "target-uid",
          action: "delete_user_data",
        })
      );
    });
  });

  describe("listAdmins", () => {
    it("should list all admins when no level specified", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "admin-1", customClaims: { admin: true } },
          { uid: "support-1", customClaims: { support: true } },
          { uid: "super-1", customClaims: { super_admin: true } },
          { uid: "user-1", customClaims: {} },
        ],
        pageToken: undefined,
      });

      const admins = await listAdmins();
      expect(admins).toHaveLength(3);
    });

    it("should filter by super_admin level", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "admin-1", customClaims: { admin: true } },
          { uid: "super-1", customClaims: { super_admin: true } },
        ],
        pageToken: undefined,
      });

      const admins = await listAdmins("super_admin");
      expect(admins).toHaveLength(1);
      expect(admins[0].uid).toBe("super-1");
    });

    it("should filter by admin level (excluding super_admin)", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "admin-1", customClaims: { admin: true } },
          { uid: "super-1", customClaims: { super_admin: true, admin: true } },
        ],
        pageToken: undefined,
      });

      const admins = await listAdmins("admin");
      expect(admins).toHaveLength(1);
      expect(admins[0].uid).toBe("admin-1");
    });

    it("should filter by support level (excluding admin)", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "support-1", customClaims: { support: true } },
          { uid: "admin-1", customClaims: { admin: true, support: true } },
        ],
        pageToken: undefined,
      });

      const admins = await listAdmins("support");
      expect(admins).toHaveLength(1);
      expect(admins[0].uid).toBe("support-1");
    });

    it("should handle pagination", async () => {
      (admin.auth().listUsers as jest.Mock)
        .mockResolvedValueOnce({
          users: [{ uid: "admin-1", customClaims: { admin: true } }],
          pageToken: "next-page",
        })
        .mockResolvedValueOnce({
          users: [{ uid: "admin-2", customClaims: { admin: true } }],
          pageToken: undefined,
        });

      const admins = await listAdmins();
      expect(admins).toHaveLength(2);
      expect(admin.auth().listUsers).toHaveBeenCalledTimes(2);
    });

    it("should handle users with undefined customClaims", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "user-1", customClaims: undefined },
          { uid: "admin-1", customClaims: { admin: true } },
        ],
        pageToken: undefined,
      });

      const admins = await listAdmins();
      expect(admins).toHaveLength(1);
    });
  });

  describe("setAdminLevel", () => {
    it("should set admin level", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: { existingClaim: true },
      });

      await setAdminLevel("user-uid", "admin");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        { existingClaim: true, admin: true }
      );
      expect(logger.security).toHaveBeenCalledWith("Admin level changed", {
        userId: "user-uid",
        newLevel: "admin",
      });
    });

    it("should set super_admin level with admin claim", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      await setAdminLevel("user-uid", "super_admin");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        { admin: true, super_admin: true }
      );
    });

    it("should set support level", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      await setAdminLevel("user-uid", "support");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        { support: true }
      );
    });

    it("should remove admin levels when level is null", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true, super_admin: true, otherClaim: true },
      });

      await setAdminLevel("admin-uid", null);

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "admin-uid",
        { otherClaim: true }
      );
      expect(logger.security).toHaveBeenCalledWith("Admin level changed", {
        userId: "admin-uid",
        newLevel: "none",
      });
    });

    it("should handle undefined customClaims", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: undefined,
      });

      await setAdminLevel("user-uid", "admin");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        { admin: true }
      );
    });
  });

  describe("ADMIN_PERMISSIONS", () => {
    it("should have correct permissions for support", () => {
      expect(ADMIN_PERMISSIONS.support).toContain("view_user_data");
      expect(ADMIN_PERMISSIONS.support).toContain("view_audit_logs");
      expect(ADMIN_PERMISSIONS.support).not.toContain("delete_user_data");
    });

    it("should have correct permissions for admin", () => {
      expect(ADMIN_PERMISSIONS.admin).toContain("view_user_data");
      expect(ADMIN_PERMISSIONS.admin).toContain("export_user_data");
      expect(ADMIN_PERMISSIONS.admin).toContain("suspend_user");
      expect(ADMIN_PERMISSIONS.admin).not.toContain("delete_user_data");
      expect(ADMIN_PERMISSIONS.admin).not.toContain("modify_claims");
    });

    it("should have correct permissions for super_admin", () => {
      expect(ADMIN_PERMISSIONS.super_admin).toContain("delete_user_data");
      expect(ADMIN_PERMISSIONS.super_admin).toContain("modify_claims");
      expect(ADMIN_PERMISSIONS.super_admin.length).toBeGreaterThan(
        ADMIN_PERMISSIONS.admin.length
      );
    });
  });
});
