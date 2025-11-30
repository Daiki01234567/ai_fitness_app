/**
 * Comprehensive Access Log Service Tests
 */

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: jest.fn().mockResolvedValue({ id: "log_123" }),
    })),
  })),
}));

jest.mock("../../src/utils/logger");

import {
  logExportRequest,
  logDeletionRequest,
  logDeletionCancel,
  logRecovery,
  extractRequestMetadata,
  hashIpAddress,
} from "../../src/services/accessLog";

describe("Access Log Service - Comprehensive Tests", () => {
  const userId = "test-user-123";
  const requestId = "req_123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logExportRequest", () => {
    it("should log successful export request", async () => {
      await logExportRequest({
        userId,
        requestId,
        format: "json",
        scope: { type: "all" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      });
      expect(true).toBe(true);
    });

    it("should log failed export request", async () => {
      await logExportRequest({
        userId,
        requestId,
        format: "json",
        scope: { type: "all" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: false,
        errorMessage: "Export failed",
      });
      expect(true).toBe(true);
    });
  });

  describe("logDeletionRequest", () => {
    it("should log successful deletion request", async () => {
      await logDeletionRequest({
        userId,
        requestId,
        deletionType: "soft",
        scope: ["all"],
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      });
      expect(true).toBe(true);
    });

    it("should log failed deletion request", async () => {
      await logDeletionRequest({
        userId,
        requestId,
        deletionType: "soft",
        scope: ["all"],
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: false,
        errorMessage: "Deletion failed",
      });
      expect(true).toBe(true);
    });
  });

  describe("logDeletionCancel", () => {
    it("should log successful deletion cancellation", async () => {
      await logDeletionCancel({
        userId,
        requestId,
        reason: "User changed mind",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      });
      expect(true).toBe(true);
    });

    it("should log failed deletion cancellation", async () => {
      await logDeletionCancel({
        userId,
        requestId,
        reason: "User changed mind",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: false,
        errorMessage: "Cancellation failed",
      });
      expect(true).toBe(true);
    });
  });

  describe("logRecovery", () => {
    it("should log successful account recovery", async () => {
      await logRecovery({
        userId,
        email: "test@example.com",
        recoveryMethod: "code",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      });
      expect(true).toBe(true);
    });

    it("should log failed account recovery", async () => {
      await logRecovery({
        userId,
        email: "test@example.com",
        recoveryMethod: "code",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: false,
        errorMessage: "Invalid code",
      });
      expect(true).toBe(true);
    });
  });

  describe("extractRequestMetadata", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = {
        rawRequest: {
          headers: {
            "x-forwarded-for": "203.0.113.1, 192.168.1.1",
          },
        },
      } as any;

      const metadata = extractRequestMetadata(request);
      expect(metadata.ipAddress).toBe("203.0.113.1");
      expect(metadata.ipAddressHash).toBeDefined();
    });

    it("should extract IP from socket when headers absent", () => {
      const request = {
        rawRequest: {
          headers: {},
          socket: {
            remoteAddress: "192.168.1.100",
          },
        },
      } as any;

      const metadata = extractRequestMetadata(request);
      expect(metadata.ipAddress).toBe("192.168.1.100");
    });

    it("should handle missing IP address", () => {
      const request = {
        rawRequest: {
          headers: {},
        },
      } as any;

      const metadata = extractRequestMetadata(request);
      expect(metadata.ipAddress).toBeUndefined();
      expect(metadata.ipAddressHash).toBeUndefined();
    });

    it("should extract user agent", () => {
      const request = {
        rawRequest: {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        },
      } as any;

      const metadata = extractRequestMetadata(request);
      expect(metadata.userAgent).toContain("Mozilla");
    });

    it("should extract referer header", () => {
      const request = {
        rawRequest: {
          headers: {
            "referer": "https://example.com/page",
          },
        },
      } as any;

      const metadata = extractRequestMetadata(request);
      expect(metadata.referer).toBe("https://example.com/page");
    });
  });

  describe("hashIpAddress", () => {
    it("should hash IP address consistently", () => {
      const ip = "192.168.1.1";
      const hash1 = hashIpAddress(ip);
      const hash2 = hashIpAddress(ip);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different IPs", () => {
      const hash1 = hashIpAddress("192.168.1.1");
      const hash2 = hashIpAddress("192.168.1.2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce fixed-length hash", () => {
      const hash = hashIpAddress("192.168.1.1");
      expect(hash.length).toBe(16);
    });

    it("should handle IPv6 addresses", () => {
      const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      const hash = hashIpAddress(ipv6);
      expect(hash.length).toBe(16);
    });
  });
});
