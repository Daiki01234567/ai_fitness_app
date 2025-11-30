/**
 * GDPR ヘルパー関数のテスト
 */
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  safeTimestampToString,
  generateSignature,
  hashUserId,
  hashIpAddress,
  getExportBucketName,
  getUserUploadsBucketName,
  DEFAULT_AUDIT_SALT,
  DEFAULT_RECOVERY_SALT,
  DEFAULT_CERTIFICATE_SECRET,
} from "../../../src/services/gdpr/helpers";

describe("GDPR Helpers", () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterAll(() => { process.env = originalEnv; });

  describe("safeTimestampToString", () => {
    it("converts valid Timestamp to ISO string", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const timestamp = Timestamp.fromDate(date);
      expect(safeTimestampToString(timestamp)).toBe("2024-01-15T10:30:00.000Z");
    });
    it("returns empty string for null timestamp", () => {
      expect(safeTimestampToString(null)).toBe("");
    });
    it("returns empty string for undefined timestamp", () => {
      expect(safeTimestampToString(undefined)).toBe("");
    });
    it("handles timestamp with milliseconds", () => {
      const date = new Date("2024-06-20T15:45:30.123Z");
      const timestamp = Timestamp.fromDate(date);
      expect(safeTimestampToString(timestamp)).toBe("2024-06-20T15:45:30.123Z");
    });
  });

  describe("generateSignature", () => {
    it("generates HMAC-SHA256 signature", () => {
      const signature = generateSignature("test data");
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[0-9a-f]+$/);
    });
    it("generates consistent signatures", () => {
      const sig1 = generateSignature("data");
      const sig2 = generateSignature("data");
      expect(sig1).toBe(sig2);
    });
    it("generates different signatures for different inputs", () => {
      const sig1 = generateSignature("data1");
      const sig2 = generateSignature("data2");
      expect(sig1).not.toBe(sig2);
    });
    it("uses custom secret from env", () => {
      process.env.CERTIFICATE_SIGNING_SECRET = "custom";
      const customSig = generateSignature("test");
      delete process.env.CERTIFICATE_SIGNING_SECRET;
      const defaultSig = generateSignature("test");
      expect(customSig).not.toBe(defaultSig);
    });
    it("handles empty string", () => {
      const signature = generateSignature("");
      expect(signature).toHaveLength(64);
    });
  });

  describe("hashUserId", () => {
    it("generates 16-character hash", () => {
      const hash = hashUserId("user123");
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
    it("generates consistent hashes", () => {
      const hash1 = hashUserId("user456");
      const hash2 = hashUserId("user456");
      expect(hash1).toBe(hash2);
    });
    it("generates different hashes for different user IDs", () => {
      const hash1 = hashUserId("user123");
      const hash2 = hashUserId("user456");
      expect(hash1).not.toBe(hash2);
    });
    it("uses custom salt from env", () => {
      process.env.AUDIT_SALT = "custom_salt";
      const customHash = hashUserId("user789");
      delete process.env.AUDIT_SALT;
      const defaultHash = hashUserId("user789");
      expect(customHash).not.toBe(defaultHash);
    });
    it("handles empty user ID", () => {
      const hash = hashUserId("");
      expect(hash).toHaveLength(16);
    });
  });

  describe("hashIpAddress", () => {
    it("generates 16-character hash", () => {
      const hash = hashIpAddress("192.168.1.1");
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
    it("generates consistent hashes", () => {
      const hash1 = hashIpAddress("10.0.0.1");
      const hash2 = hashIpAddress("10.0.0.1");
      expect(hash1).toBe(hash2);
    });
    it("generates different hashes for different IPs", () => {
      const hash1 = hashIpAddress("192.168.1.1");
      const hash2 = hashIpAddress("192.168.1.2");
      expect(hash1).not.toBe(hash2);
    });
    it("handles IPv6 addresses", () => {
      const hash = hashIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      expect(hash).toHaveLength(16);
    });
  });

  describe("Bucket Names", () => {
    it("returns default export bucket name", () => {
      delete process.env.GCLOUD_PROJECT;
      expect(getExportBucketName()).toBe("tokyo-list-478804-e5-gdpr-exports");
    });
    it("returns custom export bucket name", () => {
      process.env.GCLOUD_PROJECT = "custom-project";
      expect(getExportBucketName()).toBe("custom-project-gdpr-exports");
    });
    it("returns default uploads bucket name", () => {
      delete process.env.GCLOUD_PROJECT;
      expect(getUserUploadsBucketName()).toBe("tokyo-list-478804-e5-user-uploads");
    });
    it("returns custom uploads bucket name", () => {
      process.env.GCLOUD_PROJECT = "custom-project";
      expect(getUserUploadsBucketName()).toBe("custom-project-user-uploads");
    });
  });

  describe("Constants", () => {
    it("exports correct default values", () => {
      expect(DEFAULT_AUDIT_SALT).toBe("audit_default_salt");
      expect(DEFAULT_RECOVERY_SALT).toBe("recovery_default_salt");
      expect(DEFAULT_CERTIFICATE_SECRET).toBe("gdpr_certificate_default_secret");
    });
  });
});
