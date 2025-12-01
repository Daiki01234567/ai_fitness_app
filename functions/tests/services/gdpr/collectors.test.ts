/**
 * GDPR collectors test
 */
import { Timestamp } from "firebase-admin/firestore";

const mockUserData = {
  nickname: "TestUser",
  email: "test@example.com",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const mockSettingsData = {
  notificationsEnabled: true,
  language: "ja",
  theme: "light",
  units: "metric",
  analyticsEnabled: true,
  crashReportingEnabled: false,
};

jest.mock("../../../src/utils/firestore", () => ({
  userRef: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({
      exists: true,
      data: () => mockUserData,
    })),
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          exists: true,
          data: () => mockSettingsData,
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
      })),
    })),
  })),
  sessionsCollection: jest.fn(() => ({
    orderBy: jest.fn(function() { return this; }),
    where: jest.fn(function() { return this; }),
    get: jest.fn(() => Promise.resolve({ docs: [] })),
  })),
  consentsCollection: jest.fn(() => ({
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
      })),
    })),
  })),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  collectProfileData,
  collectSessionsData,
  collectSettingsData,
  collectSubscriptionsData,
  collectConsentsData,
} from "../../../src/services/gdpr/collectors";

describe("GDPR Collectors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("collectProfileData", () => {
    it("collects user profile data", async () => {
      const profile = await collectProfileData("user123");
      expect(profile).not.toBeNull();
      expect(profile?.nickname).toBe("TestUser");
    });
  });

  describe("collectSessionsData", () => {
    it("collects sessions data with all scope", async () => {
      const sessions = await collectSessionsData("user123", { type: "all" });
      expect(Array.isArray(sessions)).toBe(true);
    });
    
    it("collects sessions data with date range", async () => {
      const sessions = await collectSessionsData("user123", {
        type: "dateRange",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      });
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe("collectSettingsData", () => {
    it("collects settings data", async () => {
      const settings = await collectSettingsData("user123");
      expect(settings).not.toBeNull();
      expect(settings?.language).toBe("ja");
    });
  });

  describe("collectSubscriptionsData", () => {
    it("collects subscriptions data", async () => {
      const subs = await collectSubscriptionsData("user123");
      expect(Array.isArray(subs)).toBe(true);
    });
  });

  describe("collectConsentsData", () => {
    it("collects consents data", async () => {
      const consents = await collectConsentsData("user123");
      expect(Array.isArray(consents)).toBe(true);
    });
  });

  describe("collectProfileData - error handling", () => {
    it("returns null when user does not exist", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      userRef.mockReturnValueOnce({
        get: jest.fn(() => Promise.resolve({ exists: false })),
      });
      
      const profile = await collectProfileData("nonexistent");
      expect(profile).toBeNull();
    });

    it("throws error when Firestore read fails", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      const { logger } = require("../../../src/utils/logger");
      const error = new Error("Firestore read failed");
      
      userRef.mockReturnValueOnce({
        get: jest.fn(() => Promise.reject(error)),
      });
      
      await expect(collectProfileData("user123")).rejects.toThrow("Firestore read failed");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("collectSessionsData - error handling", () => {
    it("processes session documents", async () => {
      const { Timestamp } = require("firebase-admin/firestore");
      const { sessionsCollection } = require("../../../src/utils/firestore");
      
      const mockSessionData = {
        exerciseType: "squat",
        startTime: Timestamp.now(),
        endTime: Timestamp.now(),
        repCount: 10,
        totalScore: 850,
        averageScore: 85,
        duration: 60,
        status: "completed",
      };

      sessionsCollection.mockReturnValueOnce({
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({
          docs: [
            { id: "s1", data: () => mockSessionData },
            { id: "s2", data: () => ({ ...mockSessionData, exerciseType: "pushup" }) },
          ],
        })),
      });

      const sessions = await collectSessionsData("user123", { type: "all" });
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe("s1");
    });

    it("throws error when Firestore query fails", async () => {
      const { sessionsCollection } = require("../../../src/utils/firestore");
      const { logger } = require("../../../src/utils/logger");
      const error = new Error("Firestore query failed");
      
      sessionsCollection.mockReturnValueOnce({
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.reject(error)),
      });
      
      await expect(collectSessionsData("user123", { type: "all" })).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("collectSettingsData - error handling", () => {
    it("returns null when settings do not exist", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      
      userRef.mockReturnValueOnce({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ exists: false })),
          })),
        })),
      });
      
      const settings = await collectSettingsData("user123");
      expect(settings).toBeNull();
    });

    it("throws error when Firestore read fails", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      const { logger } = require("../../../src/utils/logger");
      const error = new Error("Settings read failed");
      
      userRef.mockReturnValueOnce({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(() => Promise.reject(error)),
          })),
        })),
      });
      
      await expect(collectSettingsData("user123")).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("collectSubscriptionsData - error handling", () => {
    it("processes subscription documents", async () => {
      const { Timestamp } = require("firebase-admin/firestore");
      const { userRef } = require("../../../src/utils/firestore");
      
      const mockSubData = {
        plan: "premium",
        status: "active",
        startDate: Timestamp.now(),
        expirationDate: Timestamp.now(),
        store: "google_play",
      };

      userRef.mockReturnValueOnce({
        collection: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
              docs: [
                { id: "sub1", data: () => mockSubData },
                { id: "sub2", data: () => ({ ...mockSubData, plan: "basic" }) },
              ],
            })),
          })),
        })),
      });

      const subs = await collectSubscriptionsData("user123");
      expect(subs).toHaveLength(2);
      expect(subs[0].plan).toBe("premium");
    });

    it("throws error when Firestore query fails", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      const { logger } = require("../../../src/utils/logger");
      const error = new Error("Subscriptions query failed");
      
      userRef.mockReturnValueOnce({
        collection: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn(() => Promise.reject(error)),
          })),
        })),
      });
      
      await expect(collectSubscriptionsData("user123")).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("collectConsentsData - error handling", () => {
    it("processes consent documents", async () => {
      const { Timestamp } = require("firebase-admin/firestore");
      const { consentsCollection } = require("../../../src/utils/firestore");
      
      const mockConsentData = {
        userId: "user123",
        documentType: "tos",
        documentVersion: "1.0",
        action: "accept",
        timestamp: Timestamp.now(),
      };

      consentsCollection.mockReturnValueOnce({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
              docs: [
                { id: "c1", data: () => mockConsentData },
                { id: "c2", data: () => ({ ...mockConsentData, documentType: "privacy_policy" }) },
              ],
            })),
          })),
        })),
      });

      const consents = await collectConsentsData("user123");
      expect(consents).toHaveLength(2);
      expect(consents[0].documentType).toBe("tos");
    });

    it("throws error when Firestore query fails", async () => {
      const { consentsCollection } = require("../../../src/utils/firestore");
      const { logger } = require("../../../src/utils/logger");
      const error = new Error("Consents query failed");
      
      consentsCollection.mockReturnValueOnce({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn(() => Promise.reject(error)),
          })),
        })),
      });
      
      await expect(collectConsentsData("user123")).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
