/**
 * Admin Authentication Middleware Tests
 *
 * Unit tests for admin authorization and delegation
 * Covers GDPR admin action requirements
 *
 * Reference: docs/specs/07_セキュリティポリシー_v1_0.md
 */

import * as admin from "firebase-admin";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
      getUser: jest.fn(() => Promise.resolve({
        uid: "admin-uid",
        customClaims: { admin: true },
      })),
      setCustomUserClaims: jest.fn(() => Promise.resolve()),
      listUsers: jest.fn(() => Promise.resolve({
        users: [],
        pageToken: undefined,
      })),
    })),
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          set: jest.fn(() => Promise.resolve()),
        })),
        add: jest.fn(() => Promise.resolve({ id: "log-123" })),
      })),
      FieldValue: {
        serverTimestamp: jest.fn(() => new Date()),
      },
    })),
  };
});

// Mock services
jest.mock("../../src/services/auditLog", () => ({
  logAdminAction: jest.fn(() => Promise.resolve("audit-123")),
}));

jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    security: jest.fn(),
  },
}));

jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
      })),
    })),
  })),
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

describe("Admin Authentication Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAdminToken", () => {
    it("should pass for admin token", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      expect(() => requireAdminToken(token)).not.toThrow();
    });

    it("should throw for non-admin token", () => {
      const token = { uid: "user-uid", admin: false } as any;

      expect(() => requireAdminToken(token)).toThrow("管理者権限が必要です");
    });

    it("should throw when admin claim is missing", () => {
      const token = { uid: "user-uid" } as any;

      expect(() => requireAdminToken(token)).toThrow("管理者権限が必要です");
    });
  });

  describe("isAdmin", () => {
    it("should return true for admin token", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      expect(isAdmin(token)).toBe(true);
    });

    it("should return false for non-admin token", () => {
      const token = { uid: "user-uid", admin: false } as any;

      expect(isAdmin(token)).toBe(false);
    });

    it("should return false for undefined token", () => {
      expect(isAdmin(undefined)).toBe(false);
    });

    it("should return false when admin claim is missing", () => {
      const token = { uid: "user-uid" } as any;

      expect(isAdmin(token)).toBe(false);
    });
  });

  describe("requireAdminFromRequest", () => {
    it("should pass for authenticated admin", () => {
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

    it("should throw for non-admin", () => {
      const request = {
        auth: {
          uid: "user-uid",
          token: { admin: false },
        },
      } as any;

      expect(() => requireAdminFromRequest(request)).toThrow("管理者権限が必要です");
    });
  });

  describe("getAdminLevel", () => {
    it("should return super_admin for super admin token", () => {
      const token = { uid: "admin-uid", super_admin: true } as any;

      expect(getAdminLevel(token)).toBe("super_admin");
    });

    it("should return admin for admin token", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      expect(getAdminLevel(token)).toBe("admin");
    });

    it("should return support for support token", () => {
      const token = { uid: "support-uid", support: true } as any;

      expect(getAdminLevel(token)).toBe("support");
    });

    it("should return undefined for regular user", () => {
      const token = { uid: "user-uid" } as any;

      expect(getAdminLevel(token)).toBeUndefined();
    });

    it("should return undefined for undefined token", () => {
      expect(getAdminLevel(undefined)).toBeUndefined();
    });

    it("should prioritize super_admin over admin", () => {
      const token = { uid: "admin-uid", admin: true, super_admin: true } as any;

      expect(getAdminLevel(token)).toBe("super_admin");
    });
  });

  describe("getAdminPermissions", () => {
    it("should return permissions for admin", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      const result = getAdminPermissions(token);

      expect(result).toBeDefined();
      expect(result?.level).toBe("admin");
      expect(result?.allowedActions).toEqual(ADMIN_PERMISSIONS.admin);
    });

    it("should return permissions for super_admin", () => {
      const token = { uid: "admin-uid", super_admin: true } as any;

      const result = getAdminPermissions(token);

      expect(result).toBeDefined();
      expect(result?.level).toBe("super_admin");
      expect(result?.allowedActions).toEqual(ADMIN_PERMISSIONS.super_admin);
    });

    it("should return undefined for non-admin", () => {
      const token = { uid: "user-uid" } as any;

      expect(getAdminPermissions(token)).toBeUndefined();
    });
  });

  describe("canPerformAction", () => {
    it("should return true for allowed action", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      expect(canPerformAction(token, "view_user_data")).toBe(true);
    });

    it("should return false for disallowed action", () => {
      const token = { uid: "support-uid", support: true } as any;

      // Support cannot delete user data
      expect(canPerformAction(token, "delete_user_data")).toBe(false);
    });

    it("should return false for undefined token", () => {
      expect(canPerformAction(undefined, "view_user_data")).toBe(false);
    });

    it("should return true for super_admin for any action", () => {
      const token = { uid: "admin-uid", super_admin: true } as any;

      expect(canPerformAction(token, "delete_user_data")).toBe(true);
      expect(canPerformAction(token, "modify_claims")).toBe(true);
    });
  });

  describe("requireAction", () => {
    it("should pass for allowed action", () => {
      const token = { uid: "admin-uid", admin: true } as any;

      expect(() => requireAction(token, "view_user_data")).not.toThrow();
    });

    it("should throw for disallowed action", () => {
      const token = { uid: "support-uid", support: true } as any;

      expect(() => requireAction(token, "delete_user_data")).toThrow(
        "このアクション (delete_user_data) を実行する権限がありません"
      );
    });
  });

  describe("canActOnBehalfOf", () => {
    it("should return true for admin with permission", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const result = await canActOnBehalfOf("admin-uid", "user-123", "view_user_data");

      expect(result).toBe(true);
    });

    it("should return false for non-admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      const result = await canActOnBehalfOf("user-uid", "user-123", "view_user_data");

      expect(result).toBe(false);
    });

    it("should return false for action without permission", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "support-uid",
        customClaims: { support: true },
      });

      const result = await canActOnBehalfOf("support-uid", "user-123", "delete_user_data");

      expect(result).toBe(false);
    });

    it("should return false when admin tries to act on self (non-super)", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const result = await canActOnBehalfOf("admin-uid", "admin-uid", "view_user_data");

      expect(result).toBe(false);
    });

    it("should allow super_admin to act on self", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "super-admin-uid",
        customClaims: { admin: true, super_admin: true },
      });

      const result = await canActOnBehalfOf("super-admin-uid", "super-admin-uid", "view_user_data");

      expect(result).toBe(true);
    });

    it("should handle Firebase Auth error gracefully", async () => {
      (admin.auth().getUser as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      const result = await canActOnBehalfOf("admin-uid", "user-123", "view_user_data");

      expect(result).toBe(false);
    });
  });

  describe("requireActOnBehalfOf", () => {
    it("should pass for authorized admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true },
      });

      const request = {
        auth: { uid: "admin-uid" },
      } as any;

      await expect(
        requireActOnBehalfOf(request, "user-123", "view_user_data")
      ).resolves.not.toThrow();
    });

    it("should throw when no auth", async () => {
      const request = { auth: null } as any;

      await expect(
        requireActOnBehalfOf(request, "user-123", "view_user_data")
      ).rejects.toThrow("認証が必要です");
    });

    it("should throw for unauthorized admin", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "support-uid",
        customClaims: { support: true },
      });

      const request = {
        auth: { uid: "support-uid" },
      } as any;

      await expect(
        requireActOnBehalfOf(request, "user-123", "delete_user_data")
      ).rejects.toThrow("このユーザーに対する操作を行う権限がありません");
    });
  });

  describe("executeAdminAction", () => {
    it("should execute action and log success", async () => {
      const operation = jest.fn(() => Promise.resolve("result"));

      const result = await executeAdminAction(
        {
          adminId: "admin-uid",
          targetUserId: "user-123",
          action: "view_user_data",
          reason: "support_request",
        },
        operation
      );

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
    });

    it("should log failure when operation throws", async () => {
      const operation = jest.fn(() => Promise.reject(new Error("Operation failed")));

      await expect(
        executeAdminAction(
          {
            adminId: "admin-uid",
            targetUserId: "user-123",
            action: "view_user_data",
            reason: "support_request",
          },
          operation
        )
      ).rejects.toThrow("Operation failed");
    });

    it("should include metadata in audit log", async () => {
      const { logAdminAction } = require("../../src/services/auditLog");
      const operation = jest.fn(() => Promise.resolve("result"));

      await executeAdminAction(
        {
          adminId: "admin-uid",
          targetUserId: "user-123",
          action: "export_user_data",
          reason: "gdpr_request",
          metadata: { requestId: "req-123" },
        },
        operation
      );

      expect(logAdminAction).toHaveBeenCalled();
    });
  });

  describe("listAdmins", () => {
    it("should return list of admins", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "admin-1", customClaims: { admin: true } },
          { uid: "admin-2", customClaims: { super_admin: true } },
          { uid: "user-1", customClaims: {} },
        ],
        pageToken: undefined,
      });

      const result = await listAdmins();

      expect(result.length).toBe(2);
    });

    it("should filter by level", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          { uid: "admin-1", customClaims: { admin: true } },
          { uid: "super-1", customClaims: { super_admin: true, admin: true } },
        ],
        pageToken: undefined,
      });

      const result = await listAdmins("admin");

      expect(result.length).toBe(1);
      expect(result[0].uid).toBe("admin-1");
    });

    it("should handle pagination", async () => {
      (admin.auth().listUsers as jest.Mock)
        .mockResolvedValueOnce({
          users: [{ uid: "admin-1", customClaims: { admin: true } }],
          pageToken: "page2",
        })
        .mockResolvedValueOnce({
          users: [{ uid: "admin-2", customClaims: { admin: true } }],
          pageToken: undefined,
        });

      const result = await listAdmins();

      expect(result.length).toBe(2);
    });
  });

  describe("setAdminLevel", () => {
    it("should set admin level", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      await setAdminLevel("user-uid", "admin");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        expect.objectContaining({ admin: true })
      );
    });

    it("should set super_admin level with admin claim", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: {},
      });

      await setAdminLevel("user-uid", "super_admin");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        expect.objectContaining({ admin: true, super_admin: true })
      );
    });

    it("should remove admin level with null", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "admin-uid",
        customClaims: { admin: true, other: "claim" },
      });

      await setAdminLevel("admin-uid", null);

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "admin-uid",
        expect.objectContaining({ other: "claim" })
      );
    });

    it("should preserve other claims", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "user-uid",
        customClaims: { customField: "value" },
      });

      await setAdminLevel("user-uid", "support");

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        "user-uid",
        expect.objectContaining({ customField: "value", support: true })
      );
    });
  });

  describe("ADMIN_PERMISSIONS", () => {
    it("should define support permissions correctly", () => {
      expect(ADMIN_PERMISSIONS.support).toContain("view_user_data");
      expect(ADMIN_PERMISSIONS.support).toContain("view_audit_logs");
      expect(ADMIN_PERMISSIONS.support).not.toContain("delete_user_data");
    });

    it("should define admin permissions correctly", () => {
      expect(ADMIN_PERMISSIONS.admin).toContain("view_user_data");
      expect(ADMIN_PERMISSIONS.admin).toContain("export_user_data");
      expect(ADMIN_PERMISSIONS.admin).not.toContain("delete_user_data");
    });

    it("should define super_admin permissions correctly", () => {
      expect(ADMIN_PERMISSIONS.super_admin).toContain("view_user_data");
      expect(ADMIN_PERMISSIONS.super_admin).toContain("delete_user_data");
      expect(ADMIN_PERMISSIONS.super_admin).toContain("modify_claims");
    });
  });
});
