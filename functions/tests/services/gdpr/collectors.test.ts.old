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
});
