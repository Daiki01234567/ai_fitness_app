/**
 * GDPR エクスポートサービス
 *
 * ユーザーデータのエクスポート処理を提供
 * - データ収集と変換
 * - ZIP アーカイブ作成
 * - Cloud Storage へのアップロード
 *
 * GDPR Article 20 (データポータビリティ権) に準拠
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { PassThrough } from "stream";

import { Storage } from "@google-cloud/storage";
import archiver from "archiver";

import {
  ExportData,
  ExportFormat,
  ExportScope,
  ExportArchiveOptions,
  GDPR_CONSTANTS,
} from "../types/gdpr";
import { logger } from "../utils/logger";

import { collectStorageData, getProfileImageBuffer } from "./gdprStorage";
import { collectBigQueryData } from "./gdprBigQuery";
import {
  collectProfileData,
  collectSessionsData,
  collectSettingsData,
  collectSubscriptionsData,
  collectConsentsData,
} from "./gdpr/collectors";
import {
  transformToJSON,
  transformToCSV,
  convertProfileToCSV,
  convertSessionsToCSV,
  convertConsentsToCSV,
  convertSettingsToCSV,
  convertSubscriptionsToCSV,
  convertAnalyticsToCSV,
} from "./gdpr/formatters";
import { getExportBucketName } from "./gdpr/helpers";

// Cloud Storage client
const storage = new Storage();

// =============================================================================
// データ収集関数
// =============================================================================

/**
 * ユーザーデータを収集（エクスポート用）
 *
 * 指定されたスコープに基づいてユーザーデータを収集する
 *
 * @param userId - 収集対象のユーザー ID
 * @param scopeOrOptions - エクスポートスコープ、または収集オプション
 * @returns エクスポートデータ
 *
 * @example
 * ```typescript
 * // 全データを収集（スコープのみ指定 - 後方互換性）
 * const data = await collectUserData("user123", { type: "all" });
 *
 * // 日付範囲でフィルター
 * const data = await collectUserData("user123", {
 *   type: "dateRange",
 *   startDate: new Date("2024-01-01"),
 *   endDate: new Date("2024-12-31"),
 * });
 * ```
 */
export async function collectUserData(
  userId: string,
  scopeOrOptions?: ExportScope | {
    scope?: ExportScope;
    includeStorage?: boolean;
    includeAnalytics?: boolean;
  },
): Promise<ExportData> {
  const startTime = Date.now();

  // Determine if scopeOrOptions is an ExportScope or options object
  // ExportScope has a 'type' property (required), options object does not
  let scope: ExportScope;
  let includeStorage = true;
  let includeAnalytics = true;

  if (!scopeOrOptions) {
    // No argument provided, use defaults
    scope = { type: "all" };
  } else if ("type" in scopeOrOptions) {
    // It's an ExportScope (has 'type' property)
    scope = scopeOrOptions as ExportScope;
  } else {
    // It's an options object
    const options = scopeOrOptions as {
      scope?: ExportScope;
      includeStorage?: boolean;
      includeAnalytics?: boolean;
    };
    scope = options.scope || { type: "all" };
    includeStorage = options.includeStorage ?? true;
    includeAnalytics = options.includeAnalytics ?? true;
  }

  logger.info("Collecting user data for export", {
    userId,
    scope,
    includeStorage,
    includeAnalytics,
  });

  const dataTypes = scope.dataTypes || [
    "profile",
    "sessions",
    "consents",
    "settings",
    "subscriptions",
  ];

  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    userId: userId,
    format: "json", // Will be overwritten later
  };

  // Collect data in parallel
  const collectPromises: Promise<void>[] = [];

  if (dataTypes.includes("profile")) {
    collectPromises.push(
      collectProfileData(userId).then((data) => {
        if (data) {
          exportData.profile = data;
        }
      }),
    );
  }

  if (dataTypes.includes("sessions")) {
    collectPromises.push(
      collectSessionsData(userId, scope).then((data) => {
        exportData.sessions = data;
      }),
    );
  }

  if (dataTypes.includes("consents")) {
    collectPromises.push(
      collectConsentsData(userId).then((data) => {
        exportData.consents = data;
      }),
    );
  }

  if (dataTypes.includes("settings")) {
    collectPromises.push(
      collectSettingsData(userId).then((data) => {
        if (data) {
          exportData.settings = data;
        }
      }),
    );
  }

  if (dataTypes.includes("subscriptions")) {
    collectPromises.push(
      collectSubscriptionsData(userId).then((data) => {
        exportData.subscriptions = data;
      }),
    );
  }

  // Collect Storage data
  if (includeStorage) {
    collectPromises.push(
      collectStorageData(userId).then((data) => {
        if (data.profileImage || (data.mediaFiles && data.mediaFiles.length > 0)) {
          exportData.storage = data;
        }
      }),
    );
  }

  // Collect BigQuery analytics data
  if (includeAnalytics) {
    collectPromises.push(
      collectBigQueryData(userId).then((data) => {
        if (data) {
          exportData.analytics = data;
        }
      }),
    );
  }

  await Promise.all(collectPromises);

  logger.info("User data collection completed", {
    userId,
    durationMs: Date.now() - startTime,
    profileIncluded: !!exportData.profile,
    sessionsCount: exportData.sessions?.length || 0,
    consentsCount: exportData.consents?.length || 0,
    settingsIncluded: !!exportData.settings,
    subscriptionsCount: exportData.subscriptions?.length || 0,
    storageIncluded: !!exportData.storage,
    analyticsIncluded: !!exportData.analytics,
  });

  return exportData;
}

// =============================================================================
// データ変換関数
// =============================================================================

/**
 * エクスポートデータをフォーマットに変換
 *
 * @param data - エクスポートデータ
 * @param format - 出力フォーマット（json または csv）
 * @returns フォーマット済み文字列
 *
 * @example
 * ```typescript
 * const jsonString = transformToExportFormat(data, "json");
 * const csvString = transformToExportFormat(data, "csv");
 * ```
 */
export function transformToExportFormat(data: ExportData, format: ExportFormat): string {
  data.format = format;

  if (format === "csv") {
    return transformToCSV(data);
  }
  return transformToJSON(data);
}

// =============================================================================
// ファイルアップロード関数
// =============================================================================

/**
 * エクスポートファイルを Cloud Storage にアップロードし、署名付き URL を生成
 *
 * @param userId - ユーザー ID
 * @param requestId - リクエスト ID
 * @param content - ファイル内容
 * @param format - ファイルフォーマット
 * @returns ダウンロード URL と有効期限
 *
 * @example
 * ```typescript
 * const result = await uploadExportFile("user123", "req_abc", jsonContent, "json");
 * console.log(`Download: ${result.downloadUrl}`);
 * console.log(`Expires: ${result.expiresAt}`);
 * ```
 */
export async function uploadExportFile(
  userId: string,
  requestId: string,
  content: string,
  format: ExportFormat,
): Promise<{ downloadUrl: string; expiresAt: Date; fileSizeBytes: number }> {
  const bucketName = getExportBucketName();
  const fileName = `exports/${userId}/${requestId}/export.${format}`;
  const expiresAt = new Date(
    Date.now() + GDPR_CONSTANTS.DOWNLOAD_URL_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Upload file
    await file.save(content, {
      contentType: format === "json" ? "application/json" : "text/csv",
      metadata: {
        userId,
        requestId,
        exportedAt: new Date().toISOString(),
      },
    });

    // Generate signed URL
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: expiresAt,
    });

    const fileSizeBytes = Buffer.byteLength(content, "utf8");

    logger.info("Export file uploaded", {
      userId,
      requestId,
      fileName,
      fileSizeBytes,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      downloadUrl: signedUrl,
      expiresAt,
      fileSizeBytes,
    };
  } catch (error) {
    logger.error("Failed to upload export file", error as Error, {
      userId,
      requestId,
      bucketName,
    });
    throw error;
  }
}

// =============================================================================
// README 生成関数
// =============================================================================

/**
 * README ファイルの内容を生成
 *
 * エクスポートアーカイブに含める説明ファイルを生成する
 *
 * @param userId - ユーザー ID
 * @param exportDate - エクスポート日時
 * @param format - エクスポートフォーマット
 * @param scopes - 含まれるデータスコープ
 * @returns README テキスト
 *
 * @example
 * ```typescript
 * const readme = generateReadmeContent(
 *   "user123",
 *   new Date().toISOString(),
 *   "json",
 *   ["profile", "sessions"]
 * );
 * ```
 */
export function generateReadmeContent(
  userId: string,
  exportDate: string,
  format: ExportFormat,
  scopes: string[],
): string {
  const lines: string[] = [
    "=" .repeat(60),
    "AI Fitness App - データエクスポート",
    "=" .repeat(60),
    "",
    "このアーカイブには、あなたのAI Fitness Appのデータが含まれています。",
    "",
    "-" .repeat(40),
    "エクスポート情報",
    "-" .repeat(40),
    `エクスポート日時: ${exportDate}`,
    `データフォーマット: ${format.toUpperCase()}`,
    `ユーザーID: ${userId.substring(0, 8)}...（セキュリティのため一部非表示）`,
    "",
    "-" .repeat(40),
    "含まれるデータ",
    "-" .repeat(40),
  ];

  if (scopes.includes("profile")) {
    lines.push("- profile." + format + ": プロフィール情報（名前、身体情報等）");
  }

  if (scopes.includes("sessions")) {
    lines.push("- sessions." + format + ": トレーニングセッション履歴");
  }

  if (scopes.includes("consents")) {
    lines.push("- consents." + format + ": 同意記録");
  }

  if (scopes.includes("settings")) {
    lines.push("- settings." + format + ": アプリ設定");
  }

  if (scopes.includes("subscriptions")) {
    lines.push("- subscriptions." + format + ": サブスクリプション履歴");
  }

  if (scopes.includes("analytics")) {
    lines.push("- analytics." + format + ": 分析結果（統計情報、進捗データ）");
  }

  if (scopes.includes("media")) {
    lines.push("- media/: メディアファイル（プロフィール画像等）");
  }

  lines.push("");
  lines.push("-" .repeat(40));
  lines.push("データフォーマットの説明");
  lines.push("-" .repeat(40));

  if (format === "json") {
    lines.push("各ファイルはJSON形式で保存されています。");
    lines.push("任意のテキストエディタまたはJSONビューアで開くことができます。");
  } else {
    lines.push("各ファイルはCSV形式で保存されています。");
    lines.push("Microsoft Excel、Google スプレッドシート等で開くことができます。");
  }

  lines.push("");
  lines.push("-" .repeat(40));
  lines.push("GDPR / 個人情報保護法について");
  lines.push("-" .repeat(40));
  lines.push("このエクスポートはGDPR第20条（データポータビリティ権）に基づいて提供されています。");
  lines.push("");
  lines.push("データの取り扱いについて:");
  lines.push("- このデータはあなたの個人情報を含みます。");
  lines.push("- 安全な場所に保管し、不要になったら削除してください。");
  lines.push("- 第三者への共有時は十分ご注意ください。");
  lines.push("");
  lines.push("データ削除をご希望の場合:");
  lines.push("- アプリ内の「設定」→「アカウント削除」から申請できます。");
  lines.push("- 削除後30日間は復元可能です。");
  lines.push("");
  lines.push("-" .repeat(40));
  lines.push("お問い合わせ");
  lines.push("-" .repeat(40));
  lines.push("データに関するご質問は、アプリ内のお問い合わせフォームまたは");
  lines.push("プライバシーポリシーに記載のメールアドレスまでご連絡ください。");
  lines.push("");
  lines.push("=" .repeat(60));
  lines.push("(c) AI Fitness App - All rights reserved");
  lines.push("=" .repeat(60));

  return lines.join("\n");
}

/**
 * エクスポートデータから README を生成
 *
 * @param data - エクスポートデータ
 * @param format - エクスポートフォーマット
 * @returns README テキスト
 */
export function generateReadmeFromData(data: ExportData, format: ExportFormat): string {
  const scopes: string[] = [];

  if (data.profile) scopes.push("profile");
  if (data.sessions && data.sessions.length > 0) scopes.push("sessions");
  if (data.consents && data.consents.length > 0) scopes.push("consents");
  if (data.settings) scopes.push("settings");
  if (data.subscriptions && data.subscriptions.length > 0) scopes.push("subscriptions");
  if (data.analytics) scopes.push("analytics");
  if (data.storage?.profileImage) scopes.push("media");

  return generateReadmeContent(data.userId, data.exportedAt, format, scopes);
}

// =============================================================================
// ZIP アーカイブ作成関数
// =============================================================================

/**
 * エクスポートデータの ZIP アーカイブを作成
 *
 * @param options - アーカイブオプション
 * @returns ZIP ファイルの Buffer
 *
 * @example
 * ```typescript
 * const profileImageBuffer = await getProfileImageBuffer("user123");
 * const archiveBuffer = await createExportArchive({
 *   userId: "user123",
 *   requestId: "req_abc",
 *   data: exportData,
 *   format: "json",
 *   profileImageBuffer,
 *   includeReadme: true,
 * });
 * ```
 */
export async function createExportArchive(options: ExportArchiveOptions): Promise<Buffer> {
  const { userId, requestId, data, format, profileImageBuffer, includeReadme = true } = options;
  const startTime = Date.now();

  logger.info("Creating export archive", {
    userId,
    requestId,
    format,
    includeReadme,
    hasProfileImage: !!profileImageBuffer,
  });

  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk: Buffer) => buffers.push(chunk));
    passThrough.on("end", () => {
      const result = Buffer.concat(buffers);
      logger.info("Export archive created", {
        userId,
        requestId,
        sizeBytes: result.length,
        durationMs: Date.now() - startTime,
      });
      resolve(result);
    });
    passThrough.on("error", reject);

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    archive.on("error", reject);
    archive.pipe(passThrough);

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const folderName = `export_${dateStr}`;

    // Add README.txt
    if (includeReadme) {
      const readmeContent = generateReadmeFromData(data, format);
      archive.append(readmeContent, { name: `${folderName}/README.txt` });
    }

    // Add profile data
    if (data.profile) {
      const profileContent =
        format === "json"
          ? JSON.stringify(data.profile, null, 2)
          : convertProfileToCSV(data.profile);
      archive.append(profileContent, { name: `${folderName}/profile.${format}` });
    }

    // Add sessions data
    if (data.sessions && data.sessions.length > 0) {
      const sessionsContent =
        format === "json"
          ? JSON.stringify(data.sessions, null, 2)
          : convertSessionsToCSV(data.sessions);
      archive.append(sessionsContent, { name: `${folderName}/sessions.${format}` });
    }

    // Add consents data
    if (data.consents && data.consents.length > 0) {
      const consentsContent =
        format === "json"
          ? JSON.stringify(data.consents, null, 2)
          : convertConsentsToCSV(data.consents);
      archive.append(consentsContent, { name: `${folderName}/consents.${format}` });
    }

    // Add settings data
    if (data.settings) {
      const settingsContent =
        format === "json"
          ? JSON.stringify(data.settings, null, 2)
          : convertSettingsToCSV(data.settings);
      archive.append(settingsContent, { name: `${folderName}/settings.${format}` });
    }

    // Add subscriptions data
    if (data.subscriptions && data.subscriptions.length > 0) {
      const subscriptionsContent =
        format === "json"
          ? JSON.stringify(data.subscriptions, null, 2)
          : convertSubscriptionsToCSV(data.subscriptions);
      archive.append(subscriptionsContent, { name: `${folderName}/subscriptions.${format}` });
    }

    // Add analytics data
    if (data.analytics) {
      const analyticsContent =
        format === "json"
          ? JSON.stringify(data.analytics, null, 2)
          : convertAnalyticsToCSV(data.analytics);
      archive.append(analyticsContent, { name: `${folderName}/analytics.${format}` });
    }

    // Add profile image
    if (profileImageBuffer) {
      const imageExt = data.storage?.profileImage?.contentType?.includes("png") ? "png" : "jpg";
      archive.append(profileImageBuffer, { name: `${folderName}/media/profile_image.${imageExt}` });
    }

    archive.finalize();
  });
}

/**
 * ZIP ファイルを Cloud Storage にアップロードし、署名付き URL を生成
 *
 * @param userId - ユーザー ID
 * @param requestId - リクエスト ID
 * @param archiveBuffer - ZIP ファイルの Buffer
 * @returns ダウンロード URL と有効期限
 *
 * @example
 * ```typescript
 * const result = await uploadExportArchive("user123", "req_abc", archiveBuffer);
 * console.log(`Download: ${result.downloadUrl}`);
 * ```
 */
export async function uploadExportArchive(
  userId: string,
  requestId: string,
  archiveBuffer: Buffer,
): Promise<{ downloadUrl: string; expiresAt: Date; fileSizeBytes: number }> {
  const bucketName = getExportBucketName();
  const fileName = `exports/${userId}/${requestId}/export.zip`;
  const expiresAt = new Date(
    Date.now() + GDPR_CONSTANTS.DOWNLOAD_URL_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Upload the archive
    await file.save(archiveBuffer, {
      contentType: "application/zip",
      metadata: {
        userId,
        requestId,
        exportedAt: new Date().toISOString(),
      },
    });

    // Generate signed URL
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: expiresAt,
    });

    logger.info("Export archive uploaded", {
      userId,
      requestId,
      fileName,
      fileSizeBytes: archiveBuffer.length,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      downloadUrl: signedUrl,
      expiresAt,
      fileSizeBytes: archiveBuffer.length,
    };
  } catch (error) {
    logger.error("Failed to upload export archive", error as Error, {
      userId,
      requestId,
      bucketName,
    });
    throw error;
  }
}

// =============================================================================
// 完全エクスポート処理
// =============================================================================

/**
 * 完全なエクスポート処理を実行
 *
 * データ収集からアーカイブ作成、アップロードまでを一括で処理する
 *
 * @param userId - ユーザー ID
 * @param requestId - リクエスト ID
 * @param format - エクスポートフォーマット
 * @param scope - エクスポートスコープ
 * @returns エクスポート結果
 *
 * @example
 * ```typescript
 * const result = await executeFullExport("user123", "req_abc", "json", { type: "all" });
 * if (result.success) {
 *   console.log(`Download: ${result.downloadUrl}`);
 * }
 * ```
 */
export async function executeFullExport(
  userId: string,
  requestId: string,
  format: ExportFormat,
  scope: ExportScope,
): Promise<{
  success: boolean;
  downloadUrl?: string;
  expiresAt?: Date;
  fileSizeBytes?: number;
  recordCount?: number;
  error?: string;
}> {
  const startTime = Date.now();

  logger.info("Starting full export process", {
    userId,
    requestId,
    format,
    scope,
  });

  try {
    // 1. Collect user data
    const exportData = await collectUserData(userId, {
      scope,
      includeStorage: true,
      includeAnalytics: true,
    });

    // 2. Get profile image buffer for archive
    const profileImageBuffer = await getProfileImageBuffer(userId);

    // 3. Create archive
    const archiveBuffer = await createExportArchive({
      userId,
      requestId,
      data: exportData,
      format,
      profileImageBuffer,
      includeReadme: true,
    });

    // 4. Upload archive
    const uploadResult = await uploadExportArchive(userId, requestId, archiveBuffer);

    // Calculate record count
    const recordCount =
      (exportData.profile ? 1 : 0) +
      (exportData.sessions?.length || 0) +
      (exportData.consents?.length || 0) +
      (exportData.settings ? 1 : 0) +
      (exportData.subscriptions?.length || 0);

    logger.info("Full export process completed", {
      userId,
      requestId,
      durationMs: Date.now() - startTime,
      fileSizeBytes: uploadResult.fileSizeBytes,
      recordCount,
    });

    return {
      success: true,
      downloadUrl: uploadResult.downloadUrl,
      expiresAt: uploadResult.expiresAt,
      fileSizeBytes: uploadResult.fileSizeBytes,
      recordCount,
    };
  } catch (error) {
    const err = error as Error;
    logger.error("Full export process failed", err, {
      userId,
      requestId,
    });

    return {
      success: false,
      error: err.message,
    };
  }
}

// =============================================================================
// 期限切れエクスポートのクリーンアップ
// =============================================================================

/**
 * 期限切れのエクスポートファイルを削除
 *
 * スケジュール関数から呼び出され、有効期限を過ぎたエクスポートファイルを削除する
 *
 * @param daysOld - 何日前のファイルを削除するか
 * @returns 削除されたファイル数
 *
 * @example
 * ```typescript
 * const deletedCount = await cleanupExpiredExports(3);
 * console.log(`Deleted ${deletedCount} expired export files`);
 * ```
 */
export async function cleanupExpiredExports(daysOld: number = 3): Promise<number> {
  const bucketName = getExportBucketName();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  logger.info("Starting expired exports cleanup", {
    bucketName,
    cutoffDate: cutoffDate.toISOString(),
  });

  try {
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: "exports/" });

    let deletedCount = 0;

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const createdAt = new Date(metadata.timeCreated as string);

        if (createdAt < cutoffDate) {
          await file.delete();
          deletedCount++;
        }
      } catch (error) {
        logger.warn("Failed to process export file for cleanup", {
          fileName: file.name,
        }, error as Error);
      }
    }

    logger.info("Expired exports cleanup completed", {
      deletedCount,
    });

    return deletedCount;
  } catch (error) {
    logger.error("Expired exports cleanup failed", error as Error);
    return 0;
  }
}
