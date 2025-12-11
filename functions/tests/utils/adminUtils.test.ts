/**
 * 管理者ユーティリティ テスト
 *
 * チケット041: 管理者認証基盤のユーティリティ関数テスト
 *
 * - ロール・権限関連関数
 * - IPアドレス検証関数
 * - MFA検証関数
 * - 監査ログ関数
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import * as admin from "firebase-admin";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockUserRecord = {
    uid: "test-uid",
    multiFactor: {
      enrolledFactors: [{ factorId: "phone" }],
    },
  };

  const mockAuth = {
    getUser: jest.fn(() => Promise.resolve(mockUserRecord)),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  const mockDocRef = {
    set: jest.fn(() => Promise.resolve()),
    get: jest.fn(() =>
      Promise.resolve({
        exists: true,
        data: () => ({
          allowedIps: ["192.168.1.1"],
          allowedCidrs: ["10.0.0.0/8"],
          enabled: true,
        }),
      })
    ),
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
jest.mock("../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            exists: true,
            data: () => ({
              allowedIps: ["192.168.1.1"],
              allowedCidrs: ["10.0.0.0/8"],
              enabled: true,
            }),
          })
        ),
      })),
      add: jest.fn(() => Promise.resolve({ id: "log-123" })),
    })),
    doc: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          exists: true,
          data: () => ({
            allowedIps: ["192.168.1.1"],
            allowedCidrs: ["10.0.0.0/8"],
            enabled: true,
          }),
        })
      ),
    })),
  })),
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
  getPermissionsForRole,
  hasRequiredRole,
  isValidAdminRole,
  hasPermission,
  isIpInCidr,
  isValidIpAddress,
  isValidCidr,
  verifyMfaStatus,
  calculateClaimsExpiration,
  isClaimsExpired,
  extractIpFromRequest,
} from "../../src/utils/adminUtils";
import { ADMIN_AUTH_CONSTANTS } from "../../src/types/admin";

describe("Admin Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Role and Permission Tests
  // ==========================================================================
  describe("getPermissionsForRole", () => {
    it("should return all permissions for superAdmin", () => {
      const permissions = getPermissionsForRole("superAdmin");
      expect(permissions).toContain("users:delete");
      expect(permissions).toContain("admin:create");
      expect(permissions).toContain("security:edit");
    });

    it("should return limited permissions for admin", () => {
      const permissions = getPermissionsForRole("admin");
      expect(permissions).toContain("users:list");
      expect(permissions).toContain("users:suspend");
      expect(permissions).not.toContain("users:delete");
      expect(permissions).not.toContain("admin:create");
    });

    it("should return read-only permissions for readOnlyAdmin", () => {
      const permissions = getPermissionsForRole("readOnlyAdmin");
      expect(permissions).toContain("users:list");
      expect(permissions).toContain("users:view");
      expect(permissions).toContain("stats:view");
      expect(permissions).not.toContain("users:suspend");
      expect(permissions).not.toContain("users:delete");
    });
  });

  describe("hasRequiredRole", () => {
    it("should return true when current role equals required role", () => {
      expect(hasRequiredRole("admin", "admin")).toBe(true);
    });

    it("should return true when current role is higher than required", () => {
      expect(hasRequiredRole("superAdmin", "admin")).toBe(true);
      expect(hasRequiredRole("admin", "readOnlyAdmin")).toBe(true);
      expect(hasRequiredRole("superAdmin", "readOnlyAdmin")).toBe(true);
    });

    it("should return false when current role is lower than required", () => {
      expect(hasRequiredRole("readOnlyAdmin", "admin")).toBe(false);
      expect(hasRequiredRole("admin", "superAdmin")).toBe(false);
      expect(hasRequiredRole("readOnlyAdmin", "superAdmin")).toBe(false);
    });
  });

  describe("isValidAdminRole", () => {
    it("should return true for valid admin roles", () => {
      expect(isValidAdminRole("superAdmin")).toBe(true);
      expect(isValidAdminRole("admin")).toBe(true);
      expect(isValidAdminRole("readOnlyAdmin")).toBe(true);
    });

    it("should return false for invalid roles", () => {
      expect(isValidAdminRole("invalid")).toBe(false);
      expect(isValidAdminRole("user")).toBe(false);
      expect(isValidAdminRole("")).toBe(false);
      expect(isValidAdminRole(null)).toBe(false);
      expect(isValidAdminRole(undefined)).toBe(false);
      expect(isValidAdminRole(123)).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("should return true when role has permission", () => {
      expect(hasPermission("superAdmin", "users:delete")).toBe(true);
      expect(hasPermission("admin", "users:suspend")).toBe(true);
    });

    it("should return false when role lacks permission", () => {
      expect(hasPermission("admin", "users:delete")).toBe(false);
      expect(hasPermission("readOnlyAdmin", "users:suspend")).toBe(false);
    });
  });

  // ==========================================================================
  // IP Address Validation Tests
  // ==========================================================================
  describe("isValidIpAddress", () => {
    it("should return true for valid IPv4 addresses", () => {
      expect(isValidIpAddress("192.168.1.1")).toBe(true);
      expect(isValidIpAddress("10.0.0.1")).toBe(true);
      expect(isValidIpAddress("172.16.0.1")).toBe(true);
      expect(isValidIpAddress("0.0.0.0")).toBe(true);
      expect(isValidIpAddress("255.255.255.255")).toBe(true);
    });

    it("should return false for invalid IP addresses", () => {
      expect(isValidIpAddress("256.1.1.1")).toBe(false);
      expect(isValidIpAddress("192.168.1")).toBe(false);
      expect(isValidIpAddress("192.168.1.1.1")).toBe(false);
      expect(isValidIpAddress("abc.def.ghi.jkl")).toBe(false);
      expect(isValidIpAddress("")).toBe(false);
    });
  });

  describe("isValidCidr", () => {
    it("should return true for valid CIDR notation", () => {
      expect(isValidCidr("192.168.0.0/24")).toBe(true);
      expect(isValidCidr("10.0.0.0/8")).toBe(true);
      expect(isValidCidr("172.16.0.0/16")).toBe(true);
      expect(isValidCidr("0.0.0.0/0")).toBe(true);
      expect(isValidCidr("192.168.1.1/32")).toBe(true);
    });

    it("should return false for invalid CIDR notation", () => {
      expect(isValidCidr("192.168.0.0")).toBe(false);
      expect(isValidCidr("192.168.0.0/33")).toBe(false);
      expect(isValidCidr("256.168.0.0/24")).toBe(false);
      expect(isValidCidr("192.168.0.0/")).toBe(false);
      expect(isValidCidr("/24")).toBe(false);
    });
  });

  describe("isIpInCidr", () => {
    it("should return true when IP is in CIDR range", () => {
      expect(isIpInCidr("192.168.1.100", "192.168.1.0/24")).toBe(true);
      expect(isIpInCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
      expect(isIpInCidr("172.16.255.255", "172.16.0.0/16")).toBe(true);
    });

    it("should return false when IP is not in CIDR range", () => {
      expect(isIpInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false);
      expect(isIpInCidr("11.0.0.1", "10.0.0.0/8")).toBe(false);
    });

    it("should handle /32 (single IP)", () => {
      expect(isIpInCidr("192.168.1.1", "192.168.1.1/32")).toBe(true);
      expect(isIpInCidr("192.168.1.2", "192.168.1.1/32")).toBe(false);
    });

    it("should handle /0 (all IPs)", () => {
      expect(isIpInCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
      expect(isIpInCidr("255.255.255.255", "0.0.0.0/0")).toBe(true);
    });

    it("should return false for invalid inputs", () => {
      expect(isIpInCidr("invalid", "192.168.1.0/24")).toBe(false);
      expect(isIpInCidr("192.168.1.1", "invalid")).toBe(false);
    });
  });

  // ==========================================================================
  // MFA Verification Tests
  // ==========================================================================
  describe("verifyMfaStatus", () => {
    it("should return enrolled and verified when MFA is set up", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [{ factorId: "phone" }],
        },
      });

      const result = await verifyMfaStatus("test-uid");

      expect(result.enrolled).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.enrolledFactors).toContain("phone");
    });

    it("should return not enrolled when no MFA factors", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [],
        },
      });

      const result = await verifyMfaStatus("test-uid");

      expect(result.enrolled).toBe(false);
      expect(result.verified).toBe(false);
    });

    it("should handle missing multiFactor property", async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValueOnce({
        uid: "test-uid",
      });

      const result = await verifyMfaStatus("test-uid");

      expect(result.enrolled).toBe(false);
      expect(result.verified).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      (admin.auth().getUser as jest.Mock).mockRejectedValueOnce(
        new Error("User not found")
      );

      const result = await verifyMfaStatus("nonexistent-uid");

      expect(result.enrolled).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  // ==========================================================================
  // Claims Expiration Tests
  // ==========================================================================
  describe("calculateClaimsExpiration", () => {
    it("should use default expiration days when not specified", () => {
      const expiration = calculateClaimsExpiration();
      const expectedDays = ADMIN_AUTH_CONSTANTS.DEFAULT_CLAIMS_EXPIRATION_DAYS;
      const expectedMs = expectedDays * 24 * 60 * 60 * 1000;

      // Should be approximately now + 90 days
      expect(expiration).toBeGreaterThan(Date.now());
      expect(expiration).toBeLessThanOrEqual(Date.now() + expectedMs + 1000);
    });

    it("should use custom expiration days", () => {
      const customDays = 30;
      const expiration = calculateClaimsExpiration(customDays);
      const expectedMs = customDays * 24 * 60 * 60 * 1000;

      expect(expiration).toBeGreaterThan(Date.now());
      expect(expiration).toBeLessThanOrEqual(Date.now() + expectedMs + 1000);
    });
  });

  describe("isClaimsExpired", () => {
    it("should return false when claims have not expired", () => {
      const futureTime = Date.now() + 1000 * 60 * 60; // 1 hour from now
      expect(isClaimsExpired(futureTime)).toBe(false);
    });

    it("should return true when claims have expired", () => {
      const pastTime = Date.now() - 1000 * 60 * 60; // 1 hour ago
      expect(isClaimsExpired(pastTime)).toBe(true);
    });

    it("should return false when expiresAt is undefined", () => {
      expect(isClaimsExpired(undefined)).toBe(false);
    });

    it("should return false when expiresAt is 0 (treated as not set)", () => {
      // 0 is falsy, so it's treated as "not set" and returns false
      expect(isClaimsExpired(0)).toBe(false);
    });
  });

  // ==========================================================================
  // Request IP Extraction Tests
  // ==========================================================================
  describe("extractIpFromRequest", () => {
    it("should extract IP from X-Forwarded-For header", () => {
      const request = {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        },
      };

      expect(extractIpFromRequest(request)).toBe("1.2.3.4");
    });

    it("should extract IP from X-Forwarded-For array", () => {
      const request = {
        headers: {
          "x-forwarded-for": ["1.2.3.4", "5.6.7.8"],
        },
      };

      expect(extractIpFromRequest(request)).toBe("1.2.3.4");
    });

    it("should fall back to request.ip", () => {
      const request = {
        ip: "9.10.11.12",
        headers: {},
      };

      expect(extractIpFromRequest(request)).toBe("9.10.11.12");
    });

    it("should return undefined for empty request", () => {
      expect(extractIpFromRequest(undefined)).toBeUndefined();
      expect(extractIpFromRequest({})).toBeUndefined();
    });
  });
});
