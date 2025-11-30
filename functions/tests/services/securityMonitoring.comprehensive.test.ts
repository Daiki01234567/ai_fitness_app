/**
 * Security Monitoring Service Comprehensive Tests
 */

// Mock firebase-admin with proper FieldValue static property
jest.mock("firebase-admin", () => {
  const mockTimestamp = { toDate: () => new Date() };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
    increment: jest.fn((n: number) => n),
  };

  const mockFirestore = {
    collection: jest.fn(() => ({
      add: jest.fn(() => Promise.resolve({ id: "event-123" })),
      doc: jest.fn(() => ({
        update: jest.fn(() => Promise.resolve()),
      })),
      where: jest.fn(function (this: unknown) {
        return this;
      }),
      orderBy: jest.fn(function (this: unknown) {
        return this;
      }),
      limit: jest.fn(function (this: unknown) {
        return this;
      }),
      get: jest.fn(() =>
        Promise.resolve({
          empty: false,
          size: 2,
          docs: [
            {
              id: "e1",
              data: () => ({
                type: "BRUTE_FORCE",
                severity: "high",
                resolved: false,
              }),
            },
            {
              id: "e2",
              data: () => ({
                type: "ANOMALY",
                severity: "medium",
                resolved: false,
              }),
            },
          ],
        })
      ),
    })),
    FieldValue: mockFieldValue,
    Timestamp: {
      fromDate: jest.fn((d: Date) => ({
        toDate: () => d,
        toMillis: () => d.getTime(),
      })),
    },
  };

  // Create the firestore function that also has static FieldValue
  const firestoreFn = jest.fn(() => mockFirestore);
  (firestoreFn as unknown as Record<string, unknown>).FieldValue =
    mockFieldValue;
  (firestoreFn as unknown as Record<string, unknown>).Timestamp =
    mockFirestore.Timestamp;

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: firestoreFn,
  };
});

jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
    bruteForceDetected: jest.fn(),
    massDataDownload: jest.fn(),
    rateLimitExceeded: jest.fn(),
    unauthorizedAccessAttempt: jest.fn(),
  },
}));

jest.mock("../../src/services/monitoring", () => ({
  metricsService: { recordAuthFailure: jest.fn() },
  errorReportingService: { reportCritical: jest.fn() },
}));

import { securityMonitoringService } from "../../src/services/securityMonitoring";
import { logger } from "../../src/utils/logger";
import { errorReportingService } from "../../src/services/monitoring";

describe("Security Monitoring - Comprehensive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Brute Force", () => {
    it("records failure and blocks", async () => {
      const r1 = await securityMonitoringService.recordLoginFailure(
        "u1",
        "1.1.1.1",
        "u1"
      );
      expect(r1.blocked).toBe(false);

      for (let i = 0; i < 5; i++) {
        await securityMonitoringService.recordLoginFailure("u2", "1.1.1.2");
      }
      const r2 = await securityMonitoringService.recordLoginFailure("u2");
      expect(r2.blocked).toBe(true);
    });

    it("clears and checks lock", async () => {
      for (let i = 0; i < 5; i++)
        await securityMonitoringService.recordLoginFailure("u3");
      expect(securityMonitoringService.isAccountLocked("u3")).toBe(true);
      securityMonitoringService.clearLoginFailures("u3");
      expect(securityMonitoringService.isAccountLocked("u3")).toBe(false);
    });

    it("expires lock window", () => {
      const service: Record<string, unknown> =
        securityMonitoringService as unknown as Record<string, unknown>;
      const failedLoginAttempts = service.failedLoginAttempts as Map<
        string,
        { count: number; lastAttempt: number }
      >;
      failedLoginAttempts.set("login:u4", {
        count: 5,
        lastAttempt: Date.now() - 400000,
      });
      expect(securityMonitoringService.isAccountLocked("u4")).toBe(false);
    });
  });

  describe("Rate Limit", () => {
    it("allows and blocks", () => {
      const r1 = securityMonitoringService.checkRateLimit("u1", "/api/test");
      expect(r1.allowed).toBe(true);

      for (let i = 0; i < 100; i++) {
        securityMonitoringService.checkRateLimit("u2", "/api/test2");
      }
      const r2 = securityMonitoringService.checkRateLimit("u2", "/api/test2");
      expect(r2.allowed).toBe(false);
    });

    it("custom config", () => {
      const r = securityMonitoringService.checkRateLimit("u3", "/api/c", {
        windowSeconds: 30,
        maxRequests: 5,
      });
      expect(r.allowed).toBe(true);
    });

    it("cleanup cache", () => {
      securityMonitoringService.cleanupRateLimitCache();
    });
  });

  describe("Data Access", () => {
    it("flags mass download", async () => {
      const r1 = await securityMonitoringService.recordDataAccess(
        "u1",
        "sessions",
        50
      );
      expect(r1.flagged).toBe(false);
      const r2 = await securityMonitoringService.recordDataAccess(
        "u2",
        "sessions",
        150,
        "1.1.1.1"
      );
      expect(r2.flagged).toBe(true);
    });
  });

  describe("Unauthorized Access", () => {
    it("records attempts", async () => {
      await securityMonitoringService.recordUnauthorizedAccess(
        "u1",
        "/admin",
        "admin",
        "1.1.1.1"
      );
      await securityMonitoringService.recordPrivilegeEscalation(
        "u2",
        "user",
        "admin",
        "2.2.2.2"
      );
      expect(logger.security).toHaveBeenCalled();
    });
  });

  describe("Anomaly", () => {
    it("records all severities", async () => {
      await securityMonitoringService.recordAnomaly("Low", "low", {});
      await securityMonitoringService.recordAnomaly("Med", "medium", {}, "u1");
      await securityMonitoringService.recordAnomaly(
        "High",
        "high",
        {},
        "u2",
        "1.1.1.1"
      );
      await securityMonitoringService.recordGdprViolationRisk(
        "GDPR risk",
        "u3",
        {}
      );
      expect(errorReportingService.reportCritical).toHaveBeenCalled();
    });
  });

  describe("Event Management", () => {
    it("creates and resolves events", async () => {
      const id = await securityMonitoringService.createSecurityEvent({
        type: "SUSPICIOUS_ACTIVITY",
        severity: "low",
        description: "Test",
        indicators: {},
      });
      expect(id).toBe("event-123");

      await securityMonitoringService.resolveSecurityEvent(
        "e1",
        "admin",
        "note"
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it("gets unresolved events", async () => {
      const events1 = await securityMonitoringService.getUnresolvedEvents();
      const events2 =
        await securityMonitoringService.getUnresolvedEvents("high");
      expect(events1.length).toBeGreaterThan(0);
    });

    it("gets security stats", async () => {
      const stats = await securityMonitoringService.getSecurityStats(
        new Date("2025-01-01"),
        new Date("2025-12-31")
      );
      expect(stats.totalEvents).toBeDefined();
      expect(stats.byType).toBeDefined();
    });
  });

  describe("Helpers", () => {
    it("geoLocation stub", () => {
      const geo = securityMonitoringService.getGeoLocation("1.1.1.1");
      expect(geo).toEqual({});
    });
  });
});
