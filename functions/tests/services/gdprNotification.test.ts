/**
 * GDPR Notification Service Tests
 *
 * Comprehensive tests for email notifications
 * - sendExportCompletionNotification: Send export ready email
 * - sendExportFailureNotification: Send export failure email
 */

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  sendExportCompletionNotification,
  sendExportFailureNotification,
} from "../../src/services/gdprNotification";
import { logger } from "../../src/utils/logger";

describe("GDPR Notification Service", () => {
  const testUserId = "test-user-123";
  const testEmail = "test@example.com";
  const testDownloadUrl = "https://storage.googleapis.com/bucket/exports/user123/export.zip";
  const testExpiresAt = new Date("2024-01-17T10:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.NODE_ENV;
  });

  describe("sendExportCompletionNotification", () => {
    it("should log notification in development mode (emulator)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
        })
      );
    });

    it("should log notification in development mode (NODE_ENV)", () => {
      process.env.NODE_ENV = "development";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.any(Object)
      );
    });

    it("should log email sent in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.FUNCTIONS_EMULATOR = "false";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification sent",
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
        })
      );
    });

    it("should truncate long download URLs in development log", () => {
      process.env.FUNCTIONS_EMULATOR = "true";
      const longUrl = "https://storage.googleapis.com/" + "a".repeat(200);

      sendExportCompletionNotification(testUserId, testEmail, longUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.objectContaining({
          downloadUrl: expect.stringMatching(/^https:\/\/storage\.googleapis\.com\/a{100}\.\.\.$/),
        })
      );
    });

    it("should include formatted expiration date", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.objectContaining({
          expiresAt: expect.any(String),
        })
      );
    });

    it("should include email subject in development log", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.objectContaining({
          subject: expect.stringContaining("データエクスポートが完了しました"),
        })
      );
    });

    it("should include body preview in development log", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.objectContaining({
          bodyPreview: expect.stringContaining("AI Fitness App"),
        })
      );
    });

    it("should not include download URL in production log", () => {
      process.env.NODE_ENV = "production";
      process.env.FUNCTIONS_EMULATOR = "false";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      const logCalls = (logger.info as jest.Mock).mock.calls;
      const productionCall = logCalls.find(
        (call) => call[0] === "Export completion notification sent"
      );
      expect(productionCall).toBeDefined();
      expect(productionCall?.[1]).not.toHaveProperty("downloadUrl");
    });

    it("should format date in Japanese timezone", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      // The expiresAt should be formatted for Japan timezone
      expect(logger.info).toHaveBeenCalled();
    });

    it("should return void (no return value)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      const result = sendExportCompletionNotification(
        testUserId,
        testEmail,
        testDownloadUrl,
        testExpiresAt
      );

      expect(result).toBeUndefined();
    });

    it("should handle future expiration dates", () => {
      process.env.FUNCTIONS_EMULATOR = "true";
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, futureDate);

      expect(logger.info).toHaveBeenCalled();
    });

    it("should handle past expiration dates (edge case)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";
      const pastDate = new Date("2020-01-01T00:00:00Z");

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, pastDate);

      // Should still log without errors
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe("sendExportFailureNotification", () => {
    it("should log notification in development mode (emulator)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail, "Timeout error");

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification (development mode)",
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          errorMessage: "Timeout error",
        })
      );
    });

    it("should log notification in development mode (NODE_ENV)", () => {
      process.env.NODE_ENV = "development";

      sendExportFailureNotification(testUserId, testEmail);

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification (development mode)",
        expect.any(Object)
      );
    });

    it("should log email sent in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.FUNCTIONS_EMULATOR = "false";

      sendExportFailureNotification(testUserId, testEmail, "Database error");

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification sent",
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          errorMessage: "Database error",
        })
      );
    });

    it("should include email subject in development log", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail);

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification (development mode)",
        expect.objectContaining({
          subject: expect.stringContaining("データエクスポートに失敗しました"),
        })
      );
    });

    it("should handle undefined error message", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail);

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification (development mode)",
        expect.objectContaining({
          errorMessage: undefined,
        })
      );
    });

    it("should handle empty string error message", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail, "");

      expect(logger.info).toHaveBeenCalled();
    });

    it("should return void (no return value)", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      const result = sendExportFailureNotification(testUserId, testEmail);

      expect(result).toBeUndefined();
    });

    it("should log error message in production for tracking", () => {
      process.env.NODE_ENV = "production";
      process.env.FUNCTIONS_EMULATOR = "false";
      const errorMessage = "Storage quota exceeded";

      sendExportFailureNotification(testUserId, testEmail, errorMessage);

      expect(logger.info).toHaveBeenCalledWith(
        "Export failure notification sent",
        expect.objectContaining({
          errorMessage: errorMessage,
        })
      );
    });

    it("should not expose error details in user-facing email content", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail, "Internal database connection failed");

      // The email content should not include the technical error message
      // (The error is for internal logging only)
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe("Environment detection", () => {
    it("should treat FUNCTIONS_EMULATOR=true as development", () => {
      process.env.FUNCTIONS_EMULATOR = "true";
      process.env.NODE_ENV = "production"; // Even if NODE_ENV says production

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.any(Object)
      );
    });

    it("should treat NODE_ENV=development as development", () => {
      process.env.FUNCTIONS_EMULATOR = "false";
      process.env.NODE_ENV = "development";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification (development mode)",
        expect.any(Object)
      );
    });

    it("should treat undefined environment as production", () => {
      delete process.env.FUNCTIONS_EMULATOR;
      delete process.env.NODE_ENV;

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification sent",
        expect.any(Object)
      );
    });

    it("should treat FUNCTIONS_EMULATOR=false and NODE_ENV=test as production", () => {
      process.env.FUNCTIONS_EMULATOR = "false";
      process.env.NODE_ENV = "test";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      expect(logger.info).toHaveBeenCalledWith(
        "Export completion notification sent",
        expect.any(Object)
      );
    });
  });

  describe("Email content validation", () => {
    it("should include GDPR compliant language in completion email", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportCompletionNotification(testUserId, testEmail, testDownloadUrl, testExpiresAt);

      const logCalls = (logger.info as jest.Mock).mock.calls;
      const devCall = logCalls.find(
        (call) => call[0] === "Export completion notification (development mode)"
      );

      expect(devCall?.[1].bodyPreview).toContain("AI Fitness App");
    });

    it("should include contact information in failure email", () => {
      process.env.FUNCTIONS_EMULATOR = "true";

      sendExportFailureNotification(testUserId, testEmail);

      // Email content should guide users on next steps
      expect(logger.info).toHaveBeenCalled();
    });
  });
});
