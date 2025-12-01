/**
 * Security Monitoring Service Error Handling Tests
 * 
 * Tests error paths to achieve 100% coverage:
 * - Line 293: cleanupRateLimitCache expired entries
 * - Line 495-499: createSecurityEvent error handling
 * - Line 528-531: resolveSecurityEvent error handling
 * - Line 563-564: getUnresolvedEvents error handling
 * - Line 623-624: getSecurityStats error handling
 */

import * as admin from "firebase-admin";

// Mock firebase-admin with error scenarios
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

jest.mock("firebase-admin", () => {
  const mockTimestamp = { toDate: () => new Date() };
  
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
    increment: jest.fn((n: number) => n),
  };

  const mockFirestore = {
    collection: mockCollection,
    FieldValue: mockFieldValue,
    Timestamp: {
      fromDate: jest.fn((d: Date) => ({
        toDate: () => d,
        toMillis: () => d.getTime(),
      })),
    },
  };

  const firestoreFn = jest.fn(() => mockFirestore);
  (firestoreFn as unknown as Record<string, unknown>).FieldValue = mockFieldValue;
  (firestoreFn as unknown as Record<string, unknown>).Timestamp = mockFirestore.Timestamp;

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

describe("Security Monitoring - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rate Limit Cache Cleanup", () => {
    it("deletes expired entries from cache (line 293)", () => {
      // Access internal rate limit cache and add expired entry
      const service: Record<string, unknown> = securityMonitoringService as unknown as Record<string, unknown>;
      const rateLimitCache = service.rateLimitCache as Map<string, { count: number; resetAt: number }>;
      
      // Add an expired entry (resetAt in the past)
      const expiredKey = "rate:/api/expired:user123";
      const expiredResetAt = Date.now() - 10000; // 10 seconds ago
      rateLimitCache.set(expiredKey, { count: 50, resetAt: expiredResetAt });
      
      // Add a non-expired entry
      const validKey = "rate:/api/valid:user456";
      const validResetAt = Date.now() + 60000; // 60 seconds from now
      rateLimitCache.set(validKey, { count: 10, resetAt: validResetAt });
      
      expect(rateLimitCache.has(expiredKey)).toBe(true);
      expect(rateLimitCache.has(validKey)).toBe(true);
      
      // Call cleanup - should remove expired entry
      securityMonitoringService.cleanupRateLimitCache();
      
      expect(rateLimitCache.has(expiredKey)).toBe(false);
      expect(rateLimitCache.has(validKey)).toBe(true);
    });
  });

  describe("createSecurityEvent Error Handling", () => {
    it("handles Firestore errors when creating security event (line 495-499)", async () => {
      const testError = new Error("Firestore add failed");
      
      // Setup mock to throw error
      mockCollection.mockReturnValue({
        add: mockAdd.mockRejectedValue(testError),
      });

      await expect(
        securityMonitoringService.createSecurityEvent({
          type: "SUSPICIOUS_ACTIVITY",
          severity: "medium",
          description: "Test error handling",
          indicators: { test: true },
        })
      ).rejects.toThrow("Firestore add failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create security event",
        testError,
        expect.objectContaining({
          type: "SUSPICIOUS_ACTIVITY",
          severity: "medium",
        })
      );
    });
  });

  describe("resolveSecurityEvent Error Handling", () => {
    it("handles Firestore errors when resolving security event (line 528-531)", async () => {
      const testError = new Error("Firestore update failed");
      
      // Setup mock to throw error
      mockDoc.mockReturnValue({
        update: mockUpdate.mockRejectedValue(testError),
      });
      mockCollection.mockReturnValue({
        doc: mockDoc,
      });

      await expect(
        securityMonitoringService.resolveSecurityEvent("event-456", "admin-user", "Test notes")
      ).rejects.toThrow("Firestore update failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to resolve security event",
        testError,
        expect.objectContaining({
          eventId: "event-456",
        })
      );
    });
  });

  describe("getUnresolvedEvents Error Handling", () => {
    it("returns empty array on Firestore error (line 563-564)", async () => {
      const testError = new Error("Firestore query failed");
      
      // Setup mock query chain to throw error
      const mockQuery = {
        where: jest.fn(function(this: unknown) { return this; }),
        orderBy: jest.fn(function(this: unknown) { return this; }),
        limit: jest.fn(function(this: unknown) { return this; }),
        get: mockGet.mockRejectedValue(testError),
      };
      
      mockCollection.mockReturnValue(mockQuery);

      const result = await securityMonitoringService.getUnresolvedEvents();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to get unresolved events",
        testError
      );
    });

    it("returns empty array on Firestore error with severity filter", async () => {
      const testError = new Error("Firestore query failed");
      
      const mockQuery = {
        where: jest.fn(function(this: unknown) { return this; }),
        orderBy: jest.fn(function(this: unknown) { return this; }),
        limit: jest.fn(function(this: unknown) { return this; }),
        get: mockGet.mockRejectedValue(testError),
      };
      
      mockCollection.mockReturnValue(mockQuery);

      const result = await securityMonitoringService.getUnresolvedEvents("critical");

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to get unresolved events",
        testError
      );
    });
  });

  describe("getSecurityStats Error Handling", () => {
    it("returns empty stats on Firestore error (line 623-624)", async () => {
      const testError = new Error("Firestore stats query failed");
      
      // Setup mock query chain to throw error
      const mockQuery = {
        where: jest.fn(function(this: unknown) { return this; }),
        get: mockGet.mockRejectedValue(testError),
      };
      
      mockCollection.mockReturnValue(mockQuery);

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-12-31");
      const result = await securityMonitoringService.getSecurityStats(startDate, endDate);

      expect(result).toEqual({
        totalEvents: 0,
        byType: {},
        bySeverity: {},
        unresolvedCount: 0,
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to get security stats",
        testError
      );
    });
  });
  describe("GDPR Violation Risk - Branch Coverage", () => {
    it("handles undefined indicators parameter (line 450, 458)", async () => {
      mockCollection.mockReturnValue({
        add: jest.fn(() => Promise.resolve({ id: "gdpr-event-123" })),
      });

      await securityMonitoringService.recordGdprViolationRisk(
        "GDPR violation test without indicators",
        "user-789"
      );

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "GDPR_VIOLATION_RISK",
          severity: "critical",
          description: "GDPR violation test without indicators",
          indicators: {},
        })
      );

      expect(errorReportingService.reportCritical).toHaveBeenCalledWith(
        "GDPR Violation Risk: GDPR violation test without indicators",
        expect.any(Error),
        { userId: "user-789" }
      );
    });

    it("handles undefined userId and indicators parameters", async () => {
      mockCollection.mockReturnValue({
        add: jest.fn(() => Promise.resolve({ id: "gdpr-event-456" })),
      });

      await securityMonitoringService.recordGdprViolationRisk(
        "GDPR violation test minimal params"
      );

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "GDPR_VIOLATION_RISK",
          severity: "critical",
          description: "GDPR violation test minimal params",
          indicators: {},
        })
      );

      expect(errorReportingService.reportCritical).toHaveBeenCalledWith(
        "GDPR Violation Risk: GDPR violation test minimal params",
        expect.any(Error),
        { userId: undefined }
      );
    });
  });
});
