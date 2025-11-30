/**
 * GDPR データフォーマッター
 *
 * エクスポートデータを JSON/CSV 形式に変換するための関数群
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import {
  ExportData,
  ExportProfileData,
  ExportSessionData,
  ExportConsentData,
  ExportSettingsData,
  ExportSubscriptionData,
  BigQueryExportData,
} from "../../types/gdpr";

// =============================================================================
// メイン変換関数
// =============================================================================

/**
 * エクスポートデータを JSON 形式に変換
 *
 * @param data - エクスポートデータ
 * @returns JSON 文字列（整形済み）
 *
 * @example
 * ```typescript
 * const jsonString = transformToJSON(exportData);
 * ```
 */
export function transformToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * エクスポートデータを CSV 形式に変換
 *
 * セクション区切りコメント付きの複合 CSV を生成
 *
 * @param data - エクスポートデータ
 * @returns CSV 文字列
 *
 * @example
 * ```typescript
 * const csvString = transformToCSV(exportData);
 * ```
 */
export function transformToCSV(data: ExportData): string {
  const lines: string[] = [];

  // Profile section
  if (data.profile) {
    lines.push("# Profile Data");
    lines.push("field,value");
    lines.push(`nickname,${data.profile.nickname}`);
    lines.push(`email,${data.profile.email}`);
    lines.push(`birthYear,${data.profile.birthYear || ""}`);
    lines.push(`gender,${data.profile.gender || ""}`);
    lines.push(`height,${data.profile.height || ""}`);
    lines.push(`weight,${data.profile.weight || ""}`);
    lines.push(`fitnessLevel,${data.profile.fitnessLevel || ""}`);
    lines.push(`createdAt,${data.profile.createdAt}`);
    lines.push(`updatedAt,${data.profile.updatedAt}`);
    lines.push("");
  }

  // Sessions section
  if (data.sessions && data.sessions.length > 0) {
    lines.push("# Sessions Data");
    lines.push("sessionId,exerciseType,startTime,endTime,repCount,totalScore,averageScore,duration,status");
    for (const session of data.sessions) {
      lines.push(sessionToCSVRow(session));
    }
    lines.push("");
  }

  // Consents section
  if (data.consents && data.consents.length > 0) {
    lines.push("# Consents Data");
    lines.push("documentType,documentVersion,action,timestamp");
    for (const consent of data.consents) {
      lines.push([
        consent.documentType,
        consent.documentVersion,
        consent.action,
        consent.timestamp,
      ].join(","));
    }
    lines.push("");
  }

  // Settings section
  if (data.settings) {
    lines.push("# Settings Data");
    lines.push("field,value");
    lines.push(`notificationsEnabled,${data.settings.notificationsEnabled}`);
    lines.push(`reminderTime,${data.settings.reminderTime || ""}`);
    lines.push(`language,${data.settings.language}`);
    lines.push(`theme,${data.settings.theme}`);
    lines.push(`units,${data.settings.units}`);
    lines.push(`analyticsEnabled,${data.settings.analyticsEnabled}`);
    lines.push(`crashReportingEnabled,${data.settings.crashReportingEnabled}`);
    lines.push("");
  }

  // Subscriptions section
  if (data.subscriptions && data.subscriptions.length > 0) {
    lines.push("# Subscriptions Data");
    lines.push("plan,status,startDate,expirationDate,store");
    for (const sub of data.subscriptions) {
      lines.push([
        sub.plan,
        sub.status,
        sub.startDate,
        sub.expirationDate,
        sub.store,
      ].join(","));
    }
  }

  return lines.join("\n");
}

// =============================================================================
// 個別データ型の CSV 変換関数
// =============================================================================

/**
 * セッションデータを CSV 行に変換
 *
 * @param session - セッションデータ
 * @returns CSV 行文字列
 */
export function sessionToCSVRow(session: ExportSessionData): string {
  return [
    session.sessionId,
    session.exerciseType,
    session.startTime,
    session.endTime || "",
    session.repCount.toString(),
    session.totalScore.toString(),
    session.averageScore.toString(),
    session.duration.toString(),
    session.status,
  ].join(",");
}

/**
 * プロフィールデータを CSV に変換
 *
 * @param profile - プロフィールデータ
 * @returns CSV 文字列
 *
 * @example
 * ```typescript
 * const csv = convertProfileToCSV(profileData);
 * ```
 */
export function convertProfileToCSV(profile: ExportProfileData): string {
  const lines = [
    "field,value",
    `nickname,${escapeCSV(profile.nickname)}`,
    `email,${escapeCSV(profile.email)}`,
    `birthYear,${profile.birthYear || ""}`,
    `gender,${escapeCSV(profile.gender || "")}`,
    `height,${profile.height || ""}`,
    `weight,${profile.weight || ""}`,
    `fitnessLevel,${escapeCSV(profile.fitnessLevel || "")}`,
    `createdAt,${profile.createdAt}`,
    `updatedAt,${profile.updatedAt}`,
  ];
  return lines.join("\n");
}

/**
 * セッションデータ配列を CSV に変換
 *
 * @param sessions - セッションデータの配列
 * @returns CSV 文字列（ヘッダー付き）
 *
 * @example
 * ```typescript
 * const csv = convertSessionsToCSV(sessionsData);
 * ```
 */
export function convertSessionsToCSV(sessions: ExportSessionData[]): string {
  const header = "sessionId,exerciseType,startTime,endTime,repCount,totalScore,averageScore,duration,status";
  const rows = sessions.map(
    (s) =>
      `${s.sessionId},${s.exerciseType},${s.startTime},${s.endTime || ""},${s.repCount},${s.totalScore},${s.averageScore},${s.duration},${s.status}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 同意データ配列を CSV に変換
 *
 * @param consents - 同意データの配列
 * @returns CSV 文字列（ヘッダー付き）
 *
 * @example
 * ```typescript
 * const csv = convertConsentsToCSV(consentsData);
 * ```
 */
export function convertConsentsToCSV(consents: ExportConsentData[]): string {
  const header = "documentType,documentVersion,action,timestamp";
  const rows = consents.map(
    (c) => `${c.documentType},${c.documentVersion},${c.action},${c.timestamp}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 設定データを CSV に変換
 *
 * @param settings - 設定データ
 * @returns CSV 文字列
 *
 * @example
 * ```typescript
 * const csv = convertSettingsToCSV(settingsData);
 * ```
 */
export function convertSettingsToCSV(settings: ExportSettingsData): string {
  const lines = [
    "field,value",
    `notificationsEnabled,${settings.notificationsEnabled}`,
    `reminderTime,${settings.reminderTime || ""}`,
    `reminderDays,${settings.reminderDays?.join(";") || ""}`,
    `language,${settings.language}`,
    `theme,${settings.theme}`,
    `units,${settings.units}`,
    `analyticsEnabled,${settings.analyticsEnabled}`,
    `crashReportingEnabled,${settings.crashReportingEnabled}`,
  ];
  return lines.join("\n");
}

/**
 * サブスクリプションデータ配列を CSV に変換
 *
 * @param subscriptions - サブスクリプションデータの配列
 * @returns CSV 文字列（ヘッダー付き）
 *
 * @example
 * ```typescript
 * const csv = convertSubscriptionsToCSV(subscriptionsData);
 * ```
 */
export function convertSubscriptionsToCSV(subscriptions: ExportSubscriptionData[]): string {
  const header = "plan,status,startDate,expirationDate,store";
  const rows = subscriptions.map(
    (s) => `${s.plan},${s.status},${s.startDate},${s.expirationDate},${s.store}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 分析データを CSV に変換
 *
 * 複数セクション（サマリー、種目別、週次、月次）を含む CSV を生成
 *
 * @param analytics - BigQuery からのエクスポートデータ
 * @returns CSV 文字列
 *
 * @example
 * ```typescript
 * const csv = convertAnalyticsToCSV(analyticsData);
 * ```
 */
export function convertAnalyticsToCSV(analytics: BigQueryExportData): string {
  const lines: string[] = [];

  // Summary section
  lines.push("# Summary");
  lines.push("metric,value");
  lines.push(`totalSessions,${analytics.totalSessions}`);
  lines.push(`totalReps,${analytics.totalReps}`);
  lines.push(`averageScore,${analytics.averageScore.toFixed(2)}`);
  lines.push("");

  // Exercise breakdown section
  lines.push("# Exercise Breakdown");
  lines.push("exerciseType,sessionCount");
  for (const [exerciseType, count] of Object.entries(analytics.exerciseBreakdown)) {
    lines.push(`${exerciseType},${count}`);
  }
  lines.push("");

  // Weekly progress section
  if (analytics.weeklyProgress.length > 0) {
    lines.push("# Weekly Progress");
    lines.push("week,sessions,avgScore");
    for (const w of analytics.weeklyProgress) {
      lines.push(`${w.week},${w.sessions},${w.avgScore.toFixed(2)}`);
    }
    lines.push("");
  }

  // Monthly trends section
  if (analytics.monthlyTrends.length > 0) {
    lines.push("# Monthly Trends");
    lines.push("month,sessions,avgScore");
    for (const m of analytics.monthlyTrends) {
      lines.push(`${m.month},${m.sessions},${m.avgScore.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * CSV 用に文字列をエスケープ
 *
 * カンマ、ダブルクォート、改行を含む値を適切にエスケープ
 *
 * @param value - エスケープ対象の文字列
 * @returns エスケープ済み文字列
 *
 * @example
 * ```typescript
 * escapeCSV("Hello, World")  // '"Hello, World"'
 * escapeCSV('Say "Hello"')   // '"Say ""Hello"""'
 * escapeCSV("Normal")        // "Normal"
 * ```
 */
export function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
