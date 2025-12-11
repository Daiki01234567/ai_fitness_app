/**
 * 管理者認証API テスト
 *
 * チケット041: 管理者認証基盤のAPIテスト
 *
 * - admin_setAdminClaims: 管理者クレーム設定テスト
 * - admin_revokeAdminClaims: 管理者クレーム削除テスト
 * - admin_listAdmins: 管理者一覧取得テスト
 * - admin_updateIpAllowlist: IPアドレス許可リスト更新テスト
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import * as admin from "firebase-admin";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockUserRecord = (overrides: Partial<{
    uid: string;
    email: string;
    displayName: string;
    customClaims: Record<string, unknown>;
    multiFactor: { enrolledFactors: { factorId: string }[] };
    metadata: { creationTime: string };
  }> = {}) => ({
    uid: overrides.uid || "test-uid",
    email: overrides.email || "test@example.com",
    displayName: overrides.displayName || "Test User",
    customClaims: overrides.customClaims || {},
    multiFactor: overrides.multiFactor || { enrolledFactors: [{ factorId: "phone" }] },
    metadata: overrides.metadata || { creationTime: new Date().toISOString() },
  });

  const mockAuth = {
    getUser: jest.fn(() => Promise.resolve(mockUserRecord())),
    listUsers: jest.fn(() =>
      Promise.resolve({
        users: [mockUserRecord({ customClaims: { role: "admin" } })],
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
    delete: jest.fn(() => Promise.resolve()),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(() => Promise.resolve({ id: "log-123" })),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
    doc: jest.fn(() => mockDocRef),
  }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
  };
});

// Mock utils/firestore
jest.mock("../../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve({ exists: false })),
        delete: jest.fn(() => Promise.resolve()),
      })),
      add: jest.fn(() => Promise.resolve({ id: "log-123" })),
    })),
    doc: jest.fn(() => ({
      set: jest.fn(() => Promise.resolve()),
      get: jest.fn(() => Promise.resolve({ exists: false })),
      delete: jest.fn(() => Promise.resolve()),
    })),
  })),
}));

// Mock utils/logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
  },
}));

// Mock adminAuth middleware
jest.mock("../../../src/middleware/adminAuth", () => ({
  requireSuperAdmin: jest.fn(() =>
    Promise.resolve({
      adminUser: {
        uid: "super-admin-uid",
        role: "superAdmin",
        permissions: ["admin:create", "admin:update", "admin:delete"],
        email: "superadmin@example.com",
      },
      claims: {
        role: "superAdmin",
        permissions: ["admin:create", "admin:update", "admin:delete"],
        mfaVerified: true,
        lastLoginAt: Date.now(),
      },
      clientIp: "192.168.1.1",
      mfaVerified: true,
    })
  ),
  requireAdminOrAbove: jest.fn(() =>
    Promise.resolve({
      adminUser: {
        uid: "admin-uid",
        role: "admin",
        permissions: ["admin:list"],
        email: "admin@example.com",
      },
      claims: {
        role: "admin",
        permissions: ["admin:list"],
        mfaVerified: true,
        lastLoginAt: Date.now(),
      },
      clientIp: "192.168.1.1",
      mfaVerified: true,
    })
  ),
  executeAdminAuthAction: jest.fn(
    async <T>(
      _context: unknown,
      _action: string,
      _params: { targetUserId?: string; details: Record<string, unknown> },
      operation: () => Promise<T>
    ) => {
      return operation();
    }
  ),
}));

// Mock adminUtils
jest.mock("../../../src/utils/adminUtils", () => ({
  getPermissionsForRole: jest.fn((role: string) => {
    const permissionMap: Record<string, string[]> = {
      superAdmin: ["users:delete", "admin:create", "admin:update", "admin:delete"],
      admin: ["users:view", "users:suspend", "admin:list"],
      readOnlyAdmin: ["users:view", "stats:view"],
    };
    return permissionMap[role] || [];
  }),
  calculateClaimsExpiration: jest.fn(() => Date.now() + 90 * 24 * 60 * 60 * 1000),
  isValidIpAddress: jest.fn((ip: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)),
  isValidCidr: jest.fn((cidr: string) => /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidr)),
}));

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_, handler) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

// Import after mocks
import {
  admin_setAdminClaims,
  admin_revokeAdminClaims,
  admin_listAdmins,
  admin_updateIpAllowlist,
} from "../../../src/api/admin/auth";
import { requireSuperAdmin, requireAdminOrAbove } from "../../../src/middleware/adminAuth";

describe("Admin Authentication API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // admin_setAdminClaims Tests
  // ==========================================================================
  describe("admin_setAdminClaims", () => {
    const mockRequest = (data: unknown) => ({
      auth: {
        uid: "super-admin-uid",
        token: { role: "superAdmin" },
      },
      data,
      rawRequest: {
        ip: "192.168.1.1",
        headers: {},
      },
    });

    it("should set admin claims successfully", async () => {
      const request = mockRequest({
        targetUserId: "target-uid",
        role: "admin",
      });

      const result = await admin_setAdminClaims(request as never);

      expect(result.success).toBe(true);
      expect(result.role).toBe("admin");
      expect(result.message).toContain("target-uid");
      expect(admin.auth().setCustomUserClaims).toHaveBeenCalled();
    });

    it("should set superAdmin claims with expiration", async () => {
      const request = mockRequest({
        targetUserId: "target-uid",
        role: "superAdmin",
        expirationDays: 30,
      });

      const result = await admin_setAdminClaims(request as never);

      expect(result.success).toBe(true);
      expect(result.role).toBe("superAdmin");
    });

    it("should set readOnlyAdmin claims", async () => {
      const request = mockRequest({
        targetUserId: "target-uid",
        role: "readOnlyAdmin",
      });

      const result = await admin_setAdminClaims(request as never);

      expect(result.success).toBe(true);
      expect(result.role).toBe("readOnlyAdmin");
    });

    it("should throw error for missing targetUserId", async () => {
      const request = mockRequest({
        role: "admin",
      });

      await expect(admin_setAdminClaims(request as never)).rejects.toThrow(
        "対象ユーザーIDが必要です"
      );
    });

    it("should throw error for invalid role", async () => {
      const request = mockRequest({
        targetUserId: "target-uid",
        role: "invalidRole",
      });

      await expect(admin_setAdminClaims(request as never)).rejects.toThrow(
        "有効なロール"
      );
    });

    it("should throw error when trying to modify own claims", async () => {
      const request = mockRequest({
        targetUserId: "super-admin-uid",
        role: "admin",
      });

      await expect(admin_setAdminClaims(request as never)).rejects.toThrow(
        "自分自身の管理者権限は変更できません"
      );
    });

    it("should throw error when target user not found", async () => {
      (admin.auth().getUser as jest.Mock).mockRejectedValueOnce(
        new Error("User not found")
      );

      const request = mockRequest({
        targetUserId: "nonexistent-uid",
        role: "admin",
      });

      await expect(admin_setAdminClaims(request as never)).rejects.toThrow(
        "対象ユーザーが見つかりません"
      );
    });
  });

  // ==========================================================================
  // admin_revokeAdminClaims Tests
  // ==========================================================================
  describe("admin_revokeAdminClaims", () => {
    const mockRequest = (data: unknown) => ({
      auth: {
        uid: "super-admin-uid",
        token: { role: "superAdmin" },
      },
      data,
      rawRequest: {
        ip: "192.168.1.1",
        headers: {},
      },
    });

    it("should revoke admin claims successfully", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "target-uid",
        customClaims: {
          role: "admin",
          permissions: ["users:view"],
          mfaVerified: true,
          lastLoginAt: Date.now(),
        },
      });

      const request = mockRequest({
        targetUserId: "target-uid",
        reason: "管理者権限を削除するテスト理由です",
      });

      const result = await admin_revokeAdminClaims(request as never);

      expect(result.success).toBe(true);
      expect(result.message).toContain("target-uid");
      expect(admin.auth().setCustomUserClaims).toHaveBeenCalled();
    });

    it("should throw error for missing targetUserId", async () => {
      const request = mockRequest({
        reason: "テスト理由",
      });

      await expect(admin_revokeAdminClaims(request as never)).rejects.toThrow(
        "対象ユーザーIDが必要です"
      );
    });

    it("should throw error for short reason", async () => {
      const request = mockRequest({
        targetUserId: "target-uid",
        reason: "短い",
      });

      await expect(admin_revokeAdminClaims(request as never)).rejects.toThrow(
        "削除理由を10文字以上"
      );
    });

    it("should throw error when trying to revoke own claims", async () => {
      const request = mockRequest({
        targetUserId: "super-admin-uid",
        reason: "自分の権限を削除しようとしています",
      });

      await expect(admin_revokeAdminClaims(request as never)).rejects.toThrow(
        "自分自身の管理者権限は削除できません"
      );
    });
  });

  // ==========================================================================
  // admin_listAdmins Tests
  // ==========================================================================
  describe("admin_listAdmins", () => {
    const mockRequest = (data?: unknown) => ({
      auth: {
        uid: "admin-uid",
        token: { role: "admin" },
      },
      data,
      rawRequest: {
        ip: "192.168.1.1",
        headers: {},
      },
    });

    it("should list all admins", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          {
            uid: "admin-1",
            email: "admin1@example.com",
            displayName: "Admin One",
            customClaims: { role: "superAdmin" },
            multiFactor: { enrolledFactors: [{ factorId: "phone" }] },
            metadata: { creationTime: new Date().toISOString() },
          },
          {
            uid: "admin-2",
            email: "admin2@example.com",
            displayName: "Admin Two",
            customClaims: { role: "admin" },
            multiFactor: { enrolledFactors: [] },
            metadata: { creationTime: new Date().toISOString() },
          },
          {
            uid: "user-1",
            email: "user1@example.com",
            customClaims: {},
            multiFactor: { enrolledFactors: [] },
            metadata: { creationTime: new Date().toISOString() },
          },
        ],
        pageToken: undefined,
      });

      const request = mockRequest({});
      const result = await admin_listAdmins(request as never);

      expect(result.admins).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.admins[0].role).toBe("superAdmin");
      expect(result.admins[0].mfaEnrolled).toBe(true);
      expect(result.admins[1].role).toBe("admin");
      expect(result.admins[1].mfaEnrolled).toBe(false);
    });

    it("should filter by role", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [
          {
            uid: "admin-1",
            customClaims: { role: "superAdmin" },
            multiFactor: { enrolledFactors: [] },
            metadata: { creationTime: new Date().toISOString() },
          },
          {
            uid: "admin-2",
            customClaims: { role: "admin" },
            multiFactor: { enrolledFactors: [] },
            metadata: { creationTime: new Date().toISOString() },
          },
        ],
        pageToken: undefined,
      });

      const request = mockRequest({ role: "superAdmin" });
      const result = await admin_listAdmins(request as never);

      expect(result.admins).toHaveLength(1);
      expect(result.admins[0].uid).toBe("admin-1");
    });

    it("should respect limit", async () => {
      const manyAdmins = Array.from({ length: 150 }, (_, i) => ({
        uid: `admin-${i}`,
        customClaims: { role: "admin" },
        multiFactor: { enrolledFactors: [] },
        metadata: { creationTime: new Date().toISOString() },
      }));

      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: manyAdmins,
        pageToken: undefined,
      });

      const request = mockRequest({ limit: 50 });
      const result = await admin_listAdmins(request as never);

      expect(result.admins).toHaveLength(50);
      expect(result.totalCount).toBe(150);
    });
  });

  // ==========================================================================
  // admin_updateIpAllowlist Tests
  // ==========================================================================
  describe("admin_updateIpAllowlist", () => {
    const mockRequest = (data: unknown) => ({
      auth: {
        uid: "super-admin-uid",
        token: { role: "superAdmin" },
      },
      data,
      rawRequest: {
        ip: "192.168.1.1",
        headers: {},
      },
    });

    it("should update IP allowlist successfully", async () => {
      const request = mockRequest({
        allowedIps: ["192.168.1.1", "10.0.0.1"],
        allowedCidrs: ["192.168.0.0/24"],
        enabled: true,
      });

      const result = await admin_updateIpAllowlist(request as never);

      expect(result.success).toBe(true);
      expect(result.allowlist.allowedIps).toHaveLength(2);
      expect(result.allowlist.allowedCidrs).toHaveLength(1);
      expect(result.allowlist.enabled).toBe(true);
    });

    it("should disable IP allowlist", async () => {
      const request = mockRequest({
        allowedIps: [],
        allowedCidrs: [],
        enabled: false,
      });

      const result = await admin_updateIpAllowlist(request as never);

      expect(result.success).toBe(true);
      expect(result.allowlist.enabled).toBe(false);
    });

    it("should throw error for invalid IP address", async () => {
      const request = mockRequest({
        allowedIps: ["invalid-ip"],
        allowedCidrs: [],
        enabled: true,
      });

      await expect(admin_updateIpAllowlist(request as never)).rejects.toThrow(
        "無効なIPアドレス形式"
      );
    });

    it("should throw error for invalid CIDR", async () => {
      const request = mockRequest({
        allowedIps: [],
        allowedCidrs: ["invalid-cidr"],
        enabled: true,
      });

      await expect(admin_updateIpAllowlist(request as never)).rejects.toThrow(
        "無効なCIDR形式"
      );
    });

    it("should throw error for non-array allowedIps", async () => {
      const request = mockRequest({
        allowedIps: "not-array",
        allowedCidrs: [],
        enabled: true,
      });

      await expect(admin_updateIpAllowlist(request as never)).rejects.toThrow(
        "配列である必要があります"
      );
    });
  });

  // ==========================================================================
  // Permission Matrix Tests
  // ==========================================================================
  describe("Permission Matrix", () => {
    it("should require superAdmin for setAdminClaims", async () => {
      await admin_setAdminClaims({
        auth: { uid: "test", token: { role: "superAdmin" } },
        data: { targetUserId: "target", role: "admin" },
        rawRequest: { ip: "1.2.3.4", headers: {} },
      } as never);

      expect(requireSuperAdmin).toHaveBeenCalled();
    });

    it("should require superAdmin for revokeAdminClaims", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "target",
        customClaims: { role: "admin" },
      });

      await admin_revokeAdminClaims({
        auth: { uid: "test", token: { role: "superAdmin" } },
        data: { targetUserId: "target", reason: "テスト削除理由を入力しています" },
        rawRequest: { ip: "1.2.3.4", headers: {} },
      } as never);

      expect(requireSuperAdmin).toHaveBeenCalled();
    });

    it("should require admin or above for listAdmins", async () => {
      (admin.auth().listUsers as jest.Mock).mockResolvedValueOnce({
        users: [],
        pageToken: undefined,
      });

      await admin_listAdmins({
        auth: { uid: "test", token: { role: "admin" } },
        data: {},
        rawRequest: { ip: "1.2.3.4", headers: {} },
      } as never);

      expect(requireAdminOrAbove).toHaveBeenCalled();
    });

    it("should require superAdmin for updateIpAllowlist", async () => {
      await admin_updateIpAllowlist({
        auth: { uid: "test", token: { role: "superAdmin" } },
        data: { allowedIps: [], allowedCidrs: [], enabled: false },
        rawRequest: { ip: "1.2.3.4", headers: {} },
      } as never);

      expect(requireSuperAdmin).toHaveBeenCalled();
    });
  });
});
