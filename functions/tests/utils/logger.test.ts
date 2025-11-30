/**
 * Logger Utilities Tests
 * 
 * 構造化ロギングユーティリティのユニットテスト
 * 参照仕様: docs/specs/07_セキュリティポリシー_v1_0.md
 */

import * as functions from "firebase-functions";
import { Logger, ChildLogger, logger } from "../../src/utils/logger";

// Mock firebase-functions logger
jest.mock("firebase-functions", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Logger Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.clearContext();
  });

  describe("Logger singleton", () => {
    it("should return the same instance", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("setContext", () => {
    it("should set global context", () => {
      logger.setContext({ userId: "user-123" });
      logger.info("Test");
      const logEntry = (functions.logger.info as jest.Mock).mock.calls[0][0];
      expect(logEntry.context).toEqual({ userId: "user-123" });
    });
  });

  describe("clearContext", () => {
    it("should clear all context", () => {
      logger.setContext({ userId: "user-123" });
      logger.clearContext();
      logger.info("Test");
      const logEntry = (functions.logger.info as jest.Mock).mock.calls[0][0];
      expect(logEntry.context).toBeUndefined();
    });
  });

  describe("child", () => {
    it("should create child logger", () => {
      const childLogger = logger.child({ userId: "user-456" });
      childLogger.info("Child message");
      const logEntry = (functions.logger.info as jest.Mock).mock.calls[0][0];
      expect(logEntry.context.userId).toBe("user-456");
    });
  });

  describe("debug", () => {
    it("should log debug message", () => {
      logger.debug("Debug", { key: "value" });
      expect(functions.logger.debug).toHaveBeenCalled();
    });
  });

  describe("info", () => {
    it("should log info message", () => {
      logger.info("Info", { count: 42 });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("should log warning with error", () => {
      const error = new Error("Test");
      logger.warn("Warning", {}, error);
      const logEntry = (functions.logger.warn as jest.Mock).mock.calls[0][0];
      expect(logEntry.error.message).toBe("Test");
    });
  });

  describe("error", () => {
    it("should log error with Error object", () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error);
      expect(functions.logger.error).toHaveBeenCalled();
    });
  });

  describe("functionStart", () => {
    it("should log function start", () => {
      logger.functionStart("testFunction", { param: "value" });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("functionEnd", () => {
    it("should log function end with duration", () => {
      logger.functionEnd("testFunction", 1234, { result: "success" });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("apiRequest", () => {
    it("should log API request", () => {
      logger.apiRequest("POST", "/api/users", "user-123", { limit: 10 });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("apiResponse", () => {
    it("should log API response", () => {
      logger.apiResponse(200, 123, { resourceId: "123" });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("security", () => {
    it("should log security event with string", () => {
      logger.security("Suspicious", { ip: "1.2.3.4" });
      expect(functions.logger.warn).toHaveBeenCalled();
    });

    it("should log security event with object", () => {
      logger.security({
        eventType: "Brute Force",
        severity: "high",
        description: "Failed logins",
        sourceIp: "1.2.3.4",
        indicators: { attempts: 5 },
      });
      expect(functions.logger.warn).toHaveBeenCalled();
    });
  });

  describe("critical", () => {
    it("should log critical error", () => {
      const error = new Error("Critical");
      logger.critical("Failure", error, { dbHost: "db.example.com" });
      expect(functions.logger.error).toHaveBeenCalled();
    });
  });

  describe("bruteForceDetected", () => {
    it("should log brute force", () => {
      logger.bruteForceDetected("192.168.1.1", 10, "user-123");
      expect(functions.logger.warn).toHaveBeenCalled();
    });
  });

  describe("rateLimitExceeded", () => {
    it("should log rate limit", () => {
      logger.rateLimitExceeded("user-123", "/api/sessions", 100, 60);
      expect(functions.logger.warn).toHaveBeenCalled();
    });
  });

  describe("massDataDownload", () => {
    it("should log mass download", () => {
      logger.massDataDownload("user-123", 1000, "sessions", "1.2.3.4");
      expect(functions.logger.warn).toHaveBeenCalled();
    });
  });

  describe("unauthorizedAccessAttempt", () => {
    it("should log unauthorized access", () => {
      logger.unauthorizedAccessAttempt("user-123", "/admin", "admin", "1.2.3.4");
      expect(functions.logger.warn).toHaveBeenCalled();
    });
  });

  describe("performance", () => {
    it("should log performance metric", () => {
      logger.performance("responseTime", 123.45, "ms", { query: "SELECT" });
      expect(functions.logger.info).toHaveBeenCalled();
    });
  });

  describe("ChildLogger", () => {
    it("should log with child context", () => {
      const child = logger.child({ userId: "user-123" });
      child.debug("Debug");
      child.info("Info");
      child.warn("Warn");
      child.error("Error");
      expect(functions.logger.debug).toHaveBeenCalled();
      expect(functions.logger.info).toHaveBeenCalled();
      expect(functions.logger.warn).toHaveBeenCalled();
      expect(functions.logger.error).toHaveBeenCalled();
    });

    it("should handle errors in child logger", () => {
      const child = logger.child({ userId: "user-123" });
      const error = new Error("Child error");
      child.warn("Warn", {}, error);
      child.error("Error", error);
      expect(functions.logger.warn).toHaveBeenCalled();
      expect(functions.logger.error).toHaveBeenCalled();
    });
  });
});
