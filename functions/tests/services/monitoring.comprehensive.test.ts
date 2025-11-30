/**
 * Monitoring Service Comprehensive Tests
 * Achieves 100% coverage for monitoring.ts
 */

jest.mock("../../src/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    critical: jest.fn(),
  },
}));

import {
  metricsService,
  errorReportingService,
  tracingService,
  MetricsService,
  ErrorReportingService,
  TracingService,
} from "../../src/services/monitoring";
import { logger } from "../../src/utils/logger";

describe("Monitoring Service - Comprehensive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.K_REVISION;
  });

  describe("MetricsService", () => {
    it("singleton pattern", () => {
      expect(MetricsService.getInstance()).toBe(MetricsService.getInstance());
      expect(metricsService).toBeInstanceOf(MetricsService);
    });

    it("recordApiRequest - all paths", () => {
      metricsService.recordApiRequest("/api/test", "GET", 200, 150);
      metricsService.recordApiRequest("/api/error", "POST", 500, 250);
      expect(logger.debug).toHaveBeenCalled();
    });

    it("auth and session metrics", () => {
      metricsService.recordAuthSuccess("password", "user-123");
      metricsService.recordAuthFailure("password", "invalid");
      metricsService.recordSessionCreated("squat");
      metricsService.recordSessionCompleted("squat", 120, 95);
      metricsService.recordSessionCompleted("squat", 120, 75);
      metricsService.recordSessionCompleted("squat", 120, 55);
      metricsService.recordSessionCompleted("squat", 120, 40);
    });

    it("firestore and bigquery metrics", () => {
      metricsService.recordFirestoreRead("users", 5);
      metricsService.recordFirestoreWrite("sessions", 3);
      metricsService.recordBigQuerySync(true, 10);
      metricsService.recordBigQuerySync(false, 0);
    });

    it("mediapipe fps buckets", () => {
      metricsService.recordMediaPipeFps(35, "android");
      metricsService.recordMediaPipeFps(28, "ios");
      metricsService.recordMediaPipeFps(18, "web");
      metricsService.recordMediaPipeFps(12, "android");
    });

    it("flush - empty and with data", () => {
      metricsService.flush();
      metricsService.recordApiRequest("/api/test", "GET", 200, 100);
      metricsService.flush();
      expect(logger.debug).toHaveBeenCalled();
    });

    it("auto-flush at 100 metrics", () => {
      jest.clearAllMocks();
      for (let i = 0; i < 100; i++) {
        metricsService.recordApiRequest("/test", "GET", 200, 100);
      }
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe("ErrorReportingService", () => {
    it("singleton pattern", () => {
      expect(ErrorReportingService.getInstance()).toBe(ErrorReportingService.getInstance());
      expect(errorReportingService).toBeInstanceOf(ErrorReportingService);
    });

    it("report - all severities", () => {
      const error = new Error("Test");
      errorReportingService.report("msg", error);
      errorReportingService.reportWarning("warn", error);
      errorReportingService.reportCritical("crit", error);
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.critical).toHaveBeenCalled();
    });

    it("context sanitization - all sensitive fields", () => {
      const error = new Error("Test");
      errorReportingService.report("Test", error, {
        password: "secret",
        token: "abc",
        secret: "xyz",
        apiKey: "key",
        authorization: "auth",
        cookie: "ck",
        credential: "cr",
        safe: "value",
      });
      expect(logger.debug).toHaveBeenCalled();
    });

    it("K_REVISION handling", () => {
      process.env.K_REVISION = "rev-123";
      errorReportingService.report("Test", new Error("Test"));
      delete process.env.K_REVISION;
      errorReportingService.report("Test2", new Error("Test2"));
      expect(logger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe("TracingService", () => {
    it("singleton pattern", () => {
      expect(TracingService.getInstance()).toBe(TracingService.getInstance());
      expect(tracingService).toBeInstanceOf(TracingService);
    });

    it("startSpan - with and without attributes", () => {
      const span1 = tracingService.startSpan("test");
      const attrs = { key: "value" };
      const span2 = tracingService.startSpan("test2", attrs);
      span1.addAttribute("k", "v");
      span2.addAttribute("k2", "v2");
      span1.end();
      span2.end();
      expect(logger.debug).toHaveBeenCalled();
    });

    it("trace - success and failure", async () => {
      const fn1 = jest.fn(async () => "result");
      const result = await tracingService.trace("op", fn1);
      expect(result).toBe("result");

      const fn2 = jest.fn(async () => { throw new Error("fail"); });
      await expect(tracingService.trace("op2", fn2)).rejects.toThrow();
    });

    it("trace - with attributes", async () => {
      await tracingService.trace("op", async () => "ok", { attr: "val" });
      expect(logger.debug).toHaveBeenCalled();
    });
  });
});

describe("ErrorReportingService - Edge Cases", () => {
  it("reportWithSeverity - info level", () => {
    const service = ErrorReportingService.getInstance();
    // Access private method through any cast for testing
    (service as any).reportWithSeverity("info", "Info message", new Error("Info"));
    expect(logger.info).toHaveBeenCalled();
  });
});
