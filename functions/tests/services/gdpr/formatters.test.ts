/**
 * GDPR formatters test
 */
import {
  transformToJSON,
  transformToCSV,
  escapeCSV,
  sessionToCSVRow,
  convertProfileToCSV,
  convertSessionsToCSV,
  convertConsentsToCSV,
  convertSettingsToCSV,
  convertSubscriptionsToCSV,
  convertAnalyticsToCSV,
} from "../../../src/services/gdpr/formatters";
import type {
  ExportData,
  ExportProfileData,
  ExportSessionData,
  ExportConsentData,
  ExportSettingsData,
  ExportSubscriptionData,
  BigQueryExportData,
} from "../../../src/types/gdpr";

describe("GDPR Formatters", () => {
  const mockProfile: ExportProfileData = {
    nickname: "TestUser",
    email: "test@example.com",
    birthYear: 1990,
    gender: "male",
    height: 175,
    weight: 70,
    fitnessLevel: "intermediate",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-15T10:30:00.000Z",
  };

  const mockSession: ExportSessionData = {
    sessionId: "session123",
    exerciseType: "squat",
    startTime: "2024-01-15T10:00:00.000Z",
    endTime: "2024-01-15T10:30:00.000Z",
    repCount: 10,
    totalScore: 850,
    averageScore: 85,
    duration: 1800,
    status: "completed",
  };

  const mockConsent: ExportConsentData = {
    documentType: "tos",
    documentVersion: "1.0",
    action: "accepted",
    timestamp: "2024-01-01T00:00:00.000Z",
  };

  const mockSettings: ExportSettingsData = {
    notificationsEnabled: true,
    reminderTime: "09:00",
    reminderDays: [1, 3, 5],
    language: "ja",
    theme: "light",
    units: "metric",
    analyticsEnabled: true,
    crashReportingEnabled: false,
  };

  const mockSubscription: ExportSubscriptionData = {
    plan: "premium",
    status: "active",
    startDate: "2024-01-01T00:00:00.000Z",
    expirationDate: "2024-12-31T23:59:59.999Z",
    store: "apple",
  };

  describe("escapeCSV", () => {
    it("returns value as-is when no special characters", () => {
      expect(escapeCSV("normal text")).toBe("normal text");
    });
    it("wraps value in quotes when contains comma", () => {
      expect(escapeCSV("Hello, World")).toBe('"Hello, World"');
    });
    it("escapes double quotes", () => {
      expect(escapeCSV('Say "Hello"')).toBe('"Say ""Hello"""');
    });
  });

  describe("transformToJSON", () => {
    it("converts export data to formatted JSON", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        profile: mockProfile,
        sessions: [mockSession],
        consents: [mockConsent],
        settings: mockSettings,
        subscriptions: [mockSubscription],
      };
      const json = transformToJSON(data);
      const parsed = JSON.parse(json);
      expect(parsed.userId).toBe("user123");
      expect(parsed.profile.nickname).toBe("TestUser");
    });
  });

  describe("sessionToCSVRow", () => {
    it("converts session to CSV row", () => {
      const row = sessionToCSVRow(mockSession);
      expect(row).toContain("session123");
      expect(row).toContain("squat");
    });
  });

  describe("convertProfileToCSV", () => {
    it("converts profile to CSV", () => {
      const csv = convertProfileToCSV(mockProfile);
      expect(csv).toContain("field,value");
      expect(csv).toContain("nickname,TestUser");
    });
  });

  describe("convertSessionsToCSV", () => {
    it("converts sessions array to CSV", () => {
      const csv = convertSessionsToCSV([mockSession]);
      expect(csv).toContain("sessionId,exerciseType");
    });
  });

  describe("convertConsentsToCSV", () => {
    it("converts consents array to CSV", () => {
      const csv = convertConsentsToCSV([mockConsent]);
      expect(csv).toContain("documentType,documentVersion");
    });
  });

  describe("convertSettingsToCSV", () => {
    it("converts settings to CSV", () => {
      const csv = convertSettingsToCSV(mockSettings);
      expect(csv).toContain("notificationsEnabled,true");
      expect(csv).toContain("reminderDays,1;3;5");
    });
  });

  describe("convertSubscriptionsToCSV", () => {
    it("converts subscriptions array to CSV", () => {
      const csv = convertSubscriptionsToCSV([mockSubscription]);
      expect(csv).toContain("plan,status");
    });
  });

  describe("convertAnalyticsToCSV", () => {
    it("converts analytics data to CSV", () => {
      const analytics: BigQueryExportData = {
        totalSessions: 100,
        totalReps: 1000,
        averageScore: 85.5,
        exerciseBreakdown: { squat: 50 },
        weeklyProgress: [{week: "2024-W01", sessions: 10, avgScore: 85}],
        monthlyTrends: [{month: "2024-01", sessions: 50, avgScore: 86}],
      };
      const csv = convertAnalyticsToCSV(analytics);
      expect(csv).toContain("# Summary");
      expect(csv).toContain("totalSessions,100");
    });
  });

  describe("transformToCSV", () => {
    it("converts full export data to CSV", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        profile: mockProfile,
        sessions: [mockSession],
        consents: [mockConsent],
        settings: mockSettings,
        subscriptions: [mockSubscription],
      };
      const csv = transformToCSV(data);
      expect(csv).toContain("# Profile Data");
      expect(csv).toContain("# Sessions Data");
    });
    it("handles export data without profile", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        profile: null,
        sessions: [],
        consents: [],
        settings: null,
        subscriptions: [],
      };
      const csv = transformToCSV(data);
      expect(csv).not.toContain("# Profile Data");
    });
  });
});
