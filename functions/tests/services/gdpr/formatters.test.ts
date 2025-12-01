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
      expect(csv).not.toContain("# Profile Data");
    });

    // Additional coverage tests for transformToCSV
    it("includes consents section when consents array is not empty", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        consents: [mockConsent, {
          documentType: "privacy_policy",
          documentVersion: "2.0",
          action: "accepted",
          timestamp: "2024-01-02T00:00:00.000Z",
        }],
      };
      const csv = transformToCSV(data);
      expect(csv).toContain("# Consents Data");
      expect(csv).toContain("documentType,documentVersion,action,timestamp");
      expect(csv).toContain("tos,1.0,accepted");
      expect(csv).toContain("privacy_policy,2.0,accepted");
    });

    it("includes settings section with all fields", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        settings: mockSettings,
      };
      const csv = transformToCSV(data);
      expect(csv).toContain("# Settings Data");
      expect(csv).toContain("notificationsEnabled,true");
      expect(csv).toContain("reminderTime,09:00");
      expect(csv).toContain("language,ja");
      expect(csv).toContain("theme,light");
      expect(csv).toContain("units,metric");
      expect(csv).toContain("analyticsEnabled,true");
      expect(csv).toContain("crashReportingEnabled,false");
    });

    it("handles settings without reminderTime", () => {
      const settingsWithoutReminder: ExportSettingsData = {
        notificationsEnabled: false,
        language: "en",
        theme: "dark",
        units: "imperial",
        analyticsEnabled: false,
        crashReportingEnabled: true,
      };
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        settings: settingsWithoutReminder,
      };
      const csv = transformToCSV(data);
      expect(csv).toContain("reminderTime,");
      expect(csv).toContain("notificationsEnabled,false");
    });

    it("includes subscriptions section when subscriptions array is not empty", () => {
      const data: ExportData = {
        exportedAt: "2024-01-15T10:30:00.000Z",
        userId: "user123",
        subscriptions: [mockSubscription, {
          plan: "basic",
          status: "expired",
          startDate: "2023-01-01T00:00:00.000Z",
          expirationDate: "2023-12-31T23:59:59.999Z",
          store: "google",
        }],
      };
      const csv = transformToCSV(data);
      expect(csv).toContain("# Subscriptions Data");
      expect(csv).toContain("plan,status,startDate,expirationDate,store");
      expect(csv).toContain("premium,active");
      expect(csv).toContain("basic,expired");
    });
  });

  // Additional coverage tests for escapeCSV
  describe("escapeCSV - Additional Coverage", () => {
    it("wraps value in quotes when contains newline", () => {
      const input = "Hello\nWorld";
      expect(escapeCSV(input)).toContain('"');
    });

    it("escapes double quotes and wraps when contains comma", () => {
      expect(escapeCSV('Name: "John", Age: 30')).toBe('"Name: ""John"", Age: 30"');
    });
  });

  // Additional coverage tests for convertAnalyticsToCSV
  describe("convertAnalyticsToCSV - Additional Coverage", () => {
    it("includes weekly progress section when array is not empty", () => {
      const analytics: BigQueryExportData = {
        totalSessions: 100,
        totalReps: 1000,
        averageScore: 85.5,
        exerciseBreakdown: { squat: 50, pushup: 50 },
        weeklyProgress: [
          { week: "2024-W01", sessions: 10, avgScore: 85.5 },
          { week: "2024-W02", sessions: 15, avgScore: 87.3 },
        ],
        monthlyTrends: [],
      };
      const csv = convertAnalyticsToCSV(analytics);
      expect(csv).toContain("# Weekly Progress");
      expect(csv).toContain("week,sessions,avgScore");
      expect(csv).toContain("2024-W01,10,85.50");
      expect(csv).toContain("2024-W02,15,87.30");
    });

    it("includes monthly trends section when array is not empty", () => {
      const analytics: BigQueryExportData = {
        totalSessions: 100,
        totalReps: 1000,
        averageScore: 85.5,
        exerciseBreakdown: { squat: 50, pushup: 50 },
        weeklyProgress: [],
        monthlyTrends: [
          { month: "2024-01", sessions: 50, avgScore: 86.2 },
          { month: "2024-02", sessions: 50, avgScore: 84.8 },
        ],
      };
      const csv = convertAnalyticsToCSV(analytics);
      expect(csv).toContain("# Monthly Trends");
      expect(csv).toContain("month,sessions,avgScore");
      expect(csv).toContain("2024-01,50,86.20");
      expect(csv).toContain("2024-02,50,84.80");
    });

    it("excludes weekly progress section when array is empty", () => {
      const analytics: BigQueryExportData = {
        totalSessions: 100,
        totalReps: 1000,
        averageScore: 85.5,
        exerciseBreakdown: { squat: 100 },
        weeklyProgress: [],
        monthlyTrends: [],
      };
      const csv = convertAnalyticsToCSV(analytics);
      expect(csv).not.toContain("# Weekly Progress");
    });

    it("excludes monthly trends section when array is empty", () => {
      const analytics: BigQueryExportData = {
        totalSessions: 100,
        totalReps: 1000,
        averageScore: 85.5,
        exerciseBreakdown: { squat: 100 },
        weeklyProgress: [],
        monthlyTrends: [],
      };
      const csv = convertAnalyticsToCSV(analytics);
      expect(csv).not.toContain("# Monthly Trends");
    });
  });
});
