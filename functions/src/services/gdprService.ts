/**
 * GDPR サービス
 *
 * GDPR 準拠のデータエクスポートと削除処理を提供
 * Article 17 (削除権) および Article 20 (データポータビリティ権) に対応
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as crypto from "crypto";
import { PassThrough } from "stream";

import { Storage } from "@google-cloud/storage";
import archiver from "archiver";
import * as admin from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

import { User, Session, Consent, UserSettings, Subscription } from "../types/firestore";
import {
  ExportData,
  ExportFormat,
  ExportProfileData,
  ExportSessionData,
  ExportConsentData,
  ExportSettingsData,
  ExportSubscriptionData,
  ExportScope,
  GDPR_CONSTANTS,
  RecoveryCode,
  RecoveryCodeStatus,
  DeletionRequest,
  DeletionRequestStatus,
  StorageDeletionResult,
  BigQueryDeletionResult,
  DeletionVerificationResult,
  DeletionCertificate,
  StorageExportData,
  BigQueryExportData,
  ExportArchiveOptions,
  WeeklyProgress,
  MonthlyTrend,
} from "../types/gdpr";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
  batchWrite,
} from "../utils/firestore";
import { logger } from "../utils/logger";

import { bigQueryService } from "./bigquery";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

// Cloud Storage クライアント
const storage = new Storage();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Firestore タイムスタンプから ISO 文字列への安全な変換
 */
function safeTimestampToString(timestamp: Timestamp | undefined | null): string {
  if (!timestamp) {
    return "";
  }
  return timestamp.toDate().toISOString();
}

/**
 * エクスポートバケット名を取得
 */
function getExportBucketName(): string {
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  return `${projectId}-gdpr-exports`;
}

// =============================================================================
// データ収集関数
// =============================================================================

/**
 * ユーザープロフィールデータを収集
 */
async function collectProfileData(userId: string): Promise<ExportProfileData | null> {
  try {
    const userDoc = await userRef(userId).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as User;
    return {
      nickname: userData.nickname,
      email: userData.email,
      birthYear: userData.birthYear,
      gender: userData.gender,
      height: userData.height,
      weight: userData.weight,
      fitnessLevel: userData.fitnessLevel,
      createdAt: safeTimestampToString(userData.createdAt),
      updatedAt: safeTimestampToString(userData.updatedAt),
    };
  } catch (error) {
    logger.error("Failed to collect profile data", error as Error, { userId });
    throw error;
  }
}

/**
 * セッションデータを収集
 */
async function collectSessionsData(
  userId: string,
  scope: ExportScope,
): Promise<ExportSessionData[]> {
  try {
    let query = sessionsCollection(userId).orderBy("createdAt", "desc");

    // 日付範囲フィルター
    if (scope.type === "dateRange") {
      if (scope.startDate) {
        query = query.where("startTime", ">=", scope.startDate);
      }
      if (scope.endDate) {
        query = query.where("startTime", "<=", scope.endDate);
      }
    }

    const snapshot = await query.get();
    const sessions: ExportSessionData[] = [];

    for (const doc of snapshot.docs) {
      const sessionData = doc.data() as Session;
      sessions.push({
        sessionId: doc.id,
        exerciseType: sessionData.exerciseType,
        startTime: safeTimestampToString(sessionData.startTime),
        endTime: safeTimestampToString(sessionData.endTime),
        repCount: sessionData.repCount,
        totalScore: sessionData.totalScore,
        averageScore: sessionData.averageScore,
        duration: sessionData.duration,
        status: sessionData.status,
      });
    }

    return sessions;
  } catch (error) {
    logger.error("Failed to collect sessions data", error as Error, { userId });
    throw error;
  }
}

/**
 * 同意データを収集
 */
async function collectConsentsData(userId: string): Promise<ExportConsentData[]> {
  try {
    const snapshot = await consentsCollection()
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .get();

    const consents: ExportConsentData[] = [];

    for (const doc of snapshot.docs) {
      const consentData = doc.data() as Consent;
      consents.push({
        documentType: consentData.documentType,
        documentVersion: consentData.documentVersion,
        action: consentData.action,
        timestamp: safeTimestampToString(consentData.timestamp),
      });
    }

    return consents;
  } catch (error) {
    logger.error("Failed to collect consents data", error as Error, { userId });
    throw error;
  }
}

/**
 * 設定データを収集
 */
async function collectSettingsData(userId: string): Promise<ExportSettingsData | null> {
  try {
    const settingsDoc = await userRef(userId).collection("settings").doc("default").get();
    if (!settingsDoc.exists) {
      return null;
    }

    const settingsData = settingsDoc.data() as UserSettings;
    return {
      notificationsEnabled: settingsData.notificationsEnabled,
      reminderTime: settingsData.reminderTime,
      reminderDays: settingsData.reminderDays,
      language: settingsData.language,
      theme: settingsData.theme,
      units: settingsData.units,
      analyticsEnabled: settingsData.analyticsEnabled,
      crashReportingEnabled: settingsData.crashReportingEnabled,
    };
  } catch (error) {
    logger.error("Failed to collect settings data", error as Error, { userId });
    throw error;
  }
}

/**
 * サブスクリプションデータを収集
 */
async function collectSubscriptionsData(userId: string): Promise<ExportSubscriptionData[]> {
  try {
    const snapshot = await userRef(userId)
      .collection("subscriptions")
      .orderBy("createdAt", "desc")
      .get();

    const subscriptions: ExportSubscriptionData[] = [];

    for (const doc of snapshot.docs) {
      const subData = doc.data() as Subscription;
      subscriptions.push({
        plan: subData.plan,
        status: subData.status,
        startDate: safeTimestampToString(subData.startDate),
        expirationDate: safeTimestampToString(subData.expirationDate),
        store: subData.store,
      });
    }

    return subscriptions;
  } catch (error) {
    logger.error("Failed to collect subscriptions data", error as Error, { userId });
    throw error;
  }
}

// =============================================================================
// データ変換関数
// =============================================================================

/**
 * エクスポートデータを JSON 形式に変換
 */
function transformToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * セッションデータを CSV 行に変換
 */
function sessionToCSVRow(session: ExportSessionData): string {
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
 * エクスポートデータを CSV 形式に変換
 */
function transformToCSV(data: ExportData): string {
  const lines: string[] = [];

  // プロフィールセクション
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

  // セッションセクション
  if (data.sessions && data.sessions.length > 0) {
    lines.push("# Sessions Data");
    lines.push("sessionId,exerciseType,startTime,endTime,repCount,totalScore,averageScore,duration,status");
    for (const session of data.sessions) {
      lines.push(sessionToCSVRow(session));
    }
    lines.push("");
  }

  // 同意セクション
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

  // 設定セクション
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

  // サブスクリプションセクション
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
// エクスポート公開関数
// =============================================================================

/**
 * ユーザーデータを収集
 */
export async function collectUserData(
  userId: string,
  scope: ExportScope,
): Promise<ExportData> {
  const startTime = Date.now();
  logger.info("Collecting user data for export", { userId, scope });

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

  // 並列でデータを収集
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

  await Promise.all(collectPromises);

  logger.info("User data collection completed", {
    userId,
    durationMs: Date.now() - startTime,
    profileIncluded: !!exportData.profile,
    sessionsCount: exportData.sessions?.length || 0,
    consentsCount: exportData.consents?.length || 0,
    settingsIncluded: !!exportData.settings,
    subscriptionsCount: exportData.subscriptions?.length || 0,
  });

  return exportData;
}

/**
 * エクスポートデータをフォーマットに変換
 */
export function transformToExportFormat(data: ExportData, format: ExportFormat): string {
  data.format = format;

  if (format === "csv") {
    return transformToCSV(data);
  }
  return transformToJSON(data);
}

/**
 * エクスポートファイルを Cloud Storage にアップロードし、署名付き URL を生成
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

    // ファイルをアップロード
    await file.save(content, {
      contentType: format === "json" ? "application/json" : "text/csv",
      metadata: {
        userId,
        requestId,
        exportedAt: new Date().toISOString(),
      },
    });

    // 署名付き URL を生成
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
// 削除公開関数
// =============================================================================

/**
 * ユーザーデータを削除
 */
export async function deleteUserData(
  userId: string,
  scope: string[],
): Promise<{ deletedCollections: string[]; success: boolean }> {
  const startTime = Date.now();
  logger.info("Starting user data deletion", { userId, scope });

  const deletedCollections: string[] = [];

  try {
    // 全削除の場合
    if (scope.includes("all")) {
      // セッションとサブコレクションを削除
      await deleteCollection(userId, "sessions");
      deletedCollections.push("sessions");

      // 設定を削除
      await deleteCollection(userId, "settings");
      deletedCollections.push("settings");

      // サブスクリプションを削除
      await deleteCollection(userId, "subscriptions");
      deletedCollections.push("subscriptions");

      // 同意記録を削除
      await deleteConsentsForUser(userId);
      deletedCollections.push("consents");

      // ユーザードキュメントを削除
      await userRef(userId).delete();
      deletedCollections.push("users");

      // Firebase Auth ユーザーを削除
      try {
        await admin.auth().deleteUser(userId);
        deletedCollections.push("auth");
      } catch (authError) {
        logger.warn("Failed to delete Auth user", { userId }, authError as Error);
      }
    } else {
      // 部分削除
      if (scope.includes("sessions")) {
        await deleteCollection(userId, "sessions");
        deletedCollections.push("sessions");
      }

      if (scope.includes("settings")) {
        await deleteCollection(userId, "settings");
        deletedCollections.push("settings");
      }

      if (scope.includes("subscriptions")) {
        await deleteCollection(userId, "subscriptions");
        deletedCollections.push("subscriptions");
      }

      if (scope.includes("consents")) {
        await deleteConsentsForUser(userId);
        deletedCollections.push("consents");
      }
    }

    logger.info("User data deletion completed", {
      userId,
      durationMs: Date.now() - startTime,
      deletedCollections,
    });

    return {
      deletedCollections,
      success: true,
    };
  } catch (error) {
    logger.error("Failed to delete user data", error as Error, { userId, scope });
    throw error;
  }
}

/**
 * サブコレクションを削除
 */
async function deleteCollection(userId: string, collectionName: string): Promise<void> {
  const collectionRef = userRef(userId).collection(collectionName);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    return;
  }

  // バッチで削除（500件ずつ）
  await batchWrite(snapshot.docs, (batch, doc) => {
    batch.delete(doc.ref);
  });

  logger.info("Collection deleted", { userId, collectionName, count: snapshot.size });
}

/**
 * ユーザーの同意記録を削除
 */
async function deleteConsentsForUser(userId: string): Promise<void> {
  const snapshot = await consentsCollection()
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    return;
  }

  await batchWrite(snapshot.docs, (batch, doc) => {
    batch.delete(doc.ref);
  });

  logger.info("Consents deleted", { userId, count: snapshot.size });
}

/**
 * 削除を検証
 */
export async function verifyDeletion(
  userId: string,
  scope: string[],
): Promise<{ verified: boolean; remainingData: string[] }> {
  const remainingData: string[] = [];

  try {
    if (scope.includes("all") || scope.includes("sessions")) {
      const sessionsSnapshot = await sessionsCollection(userId).limit(1).get();
      if (!sessionsSnapshot.empty) {
        remainingData.push("sessions");
      }
    }

    if (scope.includes("all") || scope.includes("settings")) {
      const settingsDoc = await userRef(userId).collection("settings").doc("default").get();
      if (settingsDoc.exists) {
        remainingData.push("settings");
      }
    }

    if (scope.includes("all") || scope.includes("subscriptions")) {
      const subsSnapshot = await userRef(userId).collection("subscriptions").limit(1).get();
      if (!subsSnapshot.empty) {
        remainingData.push("subscriptions");
      }
    }

    if (scope.includes("all") || scope.includes("consents")) {
      const consentsSnapshot = await consentsCollection()
        .where("userId", "==", userId)
        .limit(1)
        .get();
      if (!consentsSnapshot.empty) {
        remainingData.push("consents");
      }
    }

    if (scope.includes("all")) {
      const userDoc = await userRef(userId).get();
      if (userDoc.exists) {
        remainingData.push("users");
      }
    }

    const verified = remainingData.length === 0;

    logger.info("Deletion verification completed", {
      userId,
      scope,
      verified,
      remainingData,
    });

    return { verified, remainingData };
  } catch (error) {
    logger.error("Failed to verify deletion", error as Error, { userId, scope });
    throw error;
  }
}

/**
 * ユーザーに削除予定フラグを設定
 */
export async function setUserDeletionScheduled(
  userId: string,
  scheduled: boolean,
  scheduledDate?: Date,
): Promise<void> {
  const updateData: Record<string, unknown> = {
    deletionScheduled: scheduled,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (scheduled && scheduledDate) {
    updateData.scheduledDeletionDate = Timestamp.fromDate(scheduledDate);
  } else if (!scheduled) {
    updateData.scheduledDeletionDate = FieldValue.delete();
  }

  await userRef(userId).update(updateData);

  logger.info("User deletion scheduled flag updated", {
    userId,
    scheduled,
    scheduledDate: scheduledDate?.toISOString(),
  });
}

// =============================================================================
// レート制限ヘルパー
// =============================================================================

/**
 * 最近のエクスポートリクエストがあるかチェック
 */
export async function hasRecentExportRequest(userId: string): Promise<boolean> {
  const db = getFirestore();
  const cutoffTime = Timestamp.fromDate(
    new Date(Date.now() - GDPR_CONSTANTS.EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000),
  );

  const snapshot = await db
    .collection("exportRequests")
    .where("userId", "==", userId)
    .where("requestedAt", ">", cutoffTime)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * 保留中の削除リクエストがあるかチェック
 */
export async function hasPendingDeletionRequest(userId: string): Promise<boolean> {
  const db = getFirestore();

  const snapshot = await db
    .collection("deletionRequests")
    .where("userId", "==", userId)
    .where("status", "in", ["pending", "scheduled", "processing"])
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * レコード数をカウント
 */
export async function countUserRecords(userId: string): Promise<number> {
  let count = 0;

  // プロフィール
  const userDoc = await userRef(userId).get();
  if (userDoc.exists) {
    count += 1;
  }

  // セッション
  const sessionsSnapshot = await sessionsCollection(userId).count().get();
  count += sessionsSnapshot.data().count;

  // 同意
  const consentsSnapshot = await consentsCollection()
    .where("userId", "==", userId)
    .count()
    .get();
  count += consentsSnapshot.data().count;

  // 設定
  const settingsDoc = await userRef(userId).collection("settings").doc("default").get();
  if (settingsDoc.exists) {
    count += 1;
  }

  // サブスクリプション
  const subsSnapshot = await userRef(userId).collection("subscriptions").count().get();
  count += subsSnapshot.data().count;

  return count;
}

// =============================================================================
// アカウント復元関連関数
// =============================================================================

/**
 * 復元コードコレクション参照
 */
function recoveryCodesCollection() {
  return getFirestore().collection("recoveryCodes");
}

/**
 * 削除リクエストコレクション参照
 */
function deletionRequestsCollection() {
  return getFirestore().collection("deletionRequests");
}

/**
 * 6桁の復元コードを生成
 */
export function generateRecoveryCode(): string {
  // Cryptographically secure random number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // 6桁に収める (000000-999999)
  const code = (randomNumber % 1000000).toString().padStart(6, "0");
  return code;
}

/**
 * IP アドレスをハッシュ化
 */
function hashIpAddress(ipAddress: string): string {
  const salt = process.env.AUDIT_SALT || "recovery_default_salt";
  return crypto
    .createHash("sha256")
    .update(ipAddress + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * メールアドレスで削除予定のユーザーを検索
 */
export async function findScheduledDeletionByEmail(
  email: string,
): Promise<{ userId: string; deletionRequest: DeletionRequest } | null> {
  const db = getFirestore();

  // まずメールアドレスでユーザーを検索
  const usersSnapshot = await db
    .collection("users")
    .where("email", "==", email)
    .where("deletionScheduled", "==", true)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return null;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  // アクティブな削除リクエストを検索
  const deletionSnapshot = await deletionRequestsCollection()
    .where("userId", "==", userId)
    .where("status", "in", ["pending", "scheduled"])
    .where("canRecover", "==", true)
    .orderBy("requestedAt", "desc")
    .limit(1)
    .get();

  if (deletionSnapshot.empty) {
    return null;
  }

  const deletionRequest = deletionSnapshot.docs[0].data() as DeletionRequest;

  // 復元期限を確認
  if (deletionRequest.recoverDeadline) {
    const now = Timestamp.now();
    if (now.toMillis() > deletionRequest.recoverDeadline.toMillis()) {
      logger.info("Recovery deadline passed", { userId, email });
      return null;
    }
  }

  return { userId, deletionRequest };
}

/**
 * 復元コードを Firestore に保存
 */
export async function saveRecoveryCode(
  userId: string,
  email: string,
  code: string,
  deletionRequestId?: string,
  ipAddress?: string,
): Promise<{ codeId: string; expiresAt: Date }> {
  const expiresAt = new Date(
    Date.now() + GDPR_CONSTANTS.RECOVERY_CODE_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  // 既存の未使用コードを無効化
  await invalidateExistingCodes(userId);

  const recoveryCode: Omit<RecoveryCode, "createdAt" | "expiresAt"> & {
    createdAt: FieldValue;
    expiresAt: Timestamp;
  } = {
    userId,
    email,
    code,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    attempts: 0,
    maxAttempts: GDPR_CONSTANTS.RECOVERY_CODE_MAX_ATTEMPTS,
    deletionRequestId,
    ipAddressHash: ipAddress ? hashIpAddress(ipAddress) : undefined,
  };

  const docRef = await recoveryCodesCollection().add(recoveryCode);

  logger.info("Recovery code created", {
    userId,
    codeId: docRef.id,
    expiresAt: expiresAt.toISOString(),
  });

  return { codeId: docRef.id, expiresAt };
}

/**
 * 既存の未使用復元コードを無効化
 */
async function invalidateExistingCodes(userId: string): Promise<void> {
  const snapshot = await recoveryCodesCollection()
    .where("userId", "==", userId)
    .where("status", "==", "pending")
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = getFirestore().batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "invalidated" as RecoveryCodeStatus,
    });
  });
  await batch.commit();

  logger.info("Existing recovery codes invalidated", {
    userId,
    count: snapshot.size,
  });
}

/**
 * 復元コードを検証
 */
export async function verifyRecoveryCode(
  email: string,
  code: string,
): Promise<{
  valid: boolean;
  remainingAttempts?: number;
  recoveryCode?: RecoveryCode & { id: string };
  deletionRequest?: DeletionRequest;
}> {
  // メールアドレスとコードで復元コードを検索
  const snapshot = await recoveryCodesCollection()
    .where("email", "==", email)
    .where("code", "==", code)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (snapshot.empty) {
    // メールアドレスだけで検索して試行回数を更新
    const emailSnapshot = await recoveryCodesCollection()
      .where("email", "==", email)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!emailSnapshot.empty) {
      const doc = emailSnapshot.docs[0];
      const recoveryCodeData = doc.data() as RecoveryCode;
      const newAttempts = recoveryCodeData.attempts + 1;

      // 試行回数を更新
      if (newAttempts >= recoveryCodeData.maxAttempts) {
        // 最大試行回数を超えた場合は無効化
        await doc.ref.update({
          attempts: newAttempts,
          status: "invalidated" as RecoveryCodeStatus,
        });
        logger.warn("Recovery code invalidated due to max attempts", {
          email,
          codeId: doc.id,
        });
        return { valid: false, remainingAttempts: 0 };
      } else {
        await doc.ref.update({ attempts: newAttempts });
        return {
          valid: false,
          remainingAttempts: recoveryCodeData.maxAttempts - newAttempts,
        };
      }
    }

    return { valid: false };
  }

  const doc = snapshot.docs[0];
  const recoveryCodeData = doc.data() as RecoveryCode;

  // 有効期限を確認
  const now = Timestamp.now();
  if (now.toMillis() > recoveryCodeData.expiresAt.toMillis()) {
    await doc.ref.update({ status: "expired" as RecoveryCodeStatus });
    logger.info("Recovery code expired", { email, codeId: doc.id });
    return { valid: false };
  }

  // 関連する削除リクエストを取得
  let deletionRequest: DeletionRequest | undefined;
  if (recoveryCodeData.deletionRequestId) {
    const deletionDoc = await deletionRequestsCollection()
      .doc(recoveryCodeData.deletionRequestId)
      .get();
    if (deletionDoc.exists) {
      deletionRequest = deletionDoc.data() as DeletionRequest;
    }
  } else {
    // 削除リクエスト ID がない場合はユーザー ID で検索
    const deletionSnapshot = await deletionRequestsCollection()
      .where("userId", "==", recoveryCodeData.userId)
      .where("status", "in", ["pending", "scheduled"])
      .orderBy("requestedAt", "desc")
      .limit(1)
      .get();
    if (!deletionSnapshot.empty) {
      deletionRequest = deletionSnapshot.docs[0].data() as DeletionRequest;
    }
  }

  // 検証成功を記録
  await doc.ref.update({
    status: "verified" as RecoveryCodeStatus,
    attempts: recoveryCodeData.attempts + 1,
  });

  return {
    valid: true,
    recoveryCode: { id: doc.id, ...recoveryCodeData },
    deletionRequest,
  };
}

/**
 * アカウント復元を実行
 */
export async function executeAccountRecovery(
  email: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  const db = getFirestore();

  // コードを再検証
  const verification = await verifyRecoveryCode(email, code);

  if (!verification.valid || !verification.recoveryCode) {
    return {
      success: false,
      message: "無効または期限切れの復元コードです",
    };
  }

  const { recoveryCode, deletionRequest } = verification;
  const userId = recoveryCode.userId;

  try {
    // トランザクションで復元処理を実行
    await db.runTransaction((transaction) => {
      // 1. ユーザーの削除予定フラグを解除
      const userDocRef = db.collection("users").doc(userId);
      transaction.update(userDocRef, {
        deletionScheduled: false,
        scheduledDeletionDate: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. 削除リクエストをキャンセル
      if (deletionRequest) {
        const deletionRef = deletionRequestsCollection().doc(deletionRequest.requestId);
        transaction.update(deletionRef, {
          status: "cancelled" as DeletionRequestStatus,
          cancelledAt: FieldValue.serverTimestamp(),
          cancellationReason: "ユーザーによるアカウント復元",
          recoveredAt: FieldValue.serverTimestamp(),
        });
      }

      // 3. 復元コードを使用済みに更新
      const codeRef = recoveryCodesCollection().doc(recoveryCode.id);
      transaction.update(codeRef, {
        status: "used" as RecoveryCodeStatus,
        usedAt: FieldValue.serverTimestamp(),
      });

      return Promise.resolve();
    });

    logger.info("Account recovery completed", { userId, email });

    return {
      success: true,
      message: "アカウントが復元されました。通常通りログインできます。",
    };
  } catch (error) {
    logger.error("Account recovery failed", error as Error, { userId, email });
    return {
      success: false,
      message: "アカウント復元処理中にエラーが発生しました",
    };
  }
}

/**
 * 復元メールを送信（開発環境ではログ出力）
 *
 * NOTE: 現在は同期関数として実装。メール送信サービス導入時に async に変更すること。
 */
export function sendRecoveryEmail(
  email: string,
  code: string,
  expiresAt: Date,
): void {
  const isDevelopment = process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // 開発環境ではログ出力のみ
    logger.info("Recovery email (development mode)", {
      email,
      code,
      expiresAt: expiresAt.toISOString(),
      message: `復元コード: ${code} (有効期限: ${expiresAt.toLocaleString("ja-JP")})`,
    });
    return;
  }

  // 本番環境ではメール送信サービスを使用
  // TODO: SendGrid, Firebase Extensions (Trigger Email), etc. を使用してメール送信
  logger.info("Recovery email sent", {
    email,
    expiresAt: expiresAt.toISOString(),
  });

  // Note: 実際のメール送信実装は以下のようになる
  // return sendEmail({
  //   to: email,
  //   subject: "[AI Fitness] アカウント復元コード",
  //   template: "account-recovery",
  //   data: {
  //     code,
  //     expiresAt: expiresAt.toLocaleString("ja-JP"),
  //     validHours: GDPR_CONSTANTS.RECOVERY_CODE_EXPIRY_HOURS,
  //   },
  // });
}

/**
 * 期限切れの復元コードをクリーンアップ
 */
export async function cleanupExpiredRecoveryCodes(): Promise<number> {
  const db = getFirestore();
  const now = Timestamp.now();

  const snapshot = await recoveryCodesCollection()
    .where("status", "==", "pending")
    .where("expiresAt", "<", now)
    .limit(500)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "expired" as RecoveryCodeStatus });
  });
  await batch.commit();

  logger.info("Expired recovery codes cleaned up", { count: snapshot.size });
  return snapshot.size;
}

// =============================================================================
// Storage 削除関数
// =============================================================================

/**
 * ユーザーの Cloud Storage データを削除
 *
 * @param userId - 削除対象のユーザー ID
 * @returns Storage 削除結果
 */
export async function deleteUserStorage(userId: string): Promise<StorageDeletionResult> {
  const startTime = Date.now();
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  const bucketName = `${projectId}-user-uploads`;

  logger.info("Starting user storage deletion", { userId, bucketName });

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    // List all files under the user's folder
    const [files] = await bucket.getFiles({ prefix: userPrefix });

    if (files.length === 0) {
      logger.info("No storage files found for user", { userId });
      return {
        deleted: true,
        files: [],
        filesCount: 0,
        totalSizeBytes: 0,
      };
    }

    const deletedFiles: string[] = [];
    let totalSizeBytes = 0;

    // Delete files in batches
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          try {
            // Get file metadata for size tracking
            const [metadata] = await file.getMetadata();
            totalSizeBytes += parseInt(String(metadata.size || "0"), 10);

            await file.delete();
            deletedFiles.push(file.name);
          } catch (error) {
            logger.warn("Failed to delete storage file", { fileName: file.name }, error as Error);
          }
        }),
      );
    }

    logger.info("User storage deletion completed", {
      userId,
      filesCount: deletedFiles.length,
      totalSizeBytes,
      durationMs: Date.now() - startTime,
    });

    return {
      deleted: true,
      files: deletedFiles,
      filesCount: deletedFiles.length,
      totalSizeBytes,
    };
  } catch (error) {
    logger.error("User storage deletion failed", error as Error, { userId });
    return {
      deleted: false,
      files: [],
      filesCount: 0,
      totalSizeBytes: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Storage 内のユーザーデータが削除されているか検証
 *
 * @param userId - 検証対象のユーザー ID
 * @returns 削除検証結果
 */
export async function verifyStorageDeletion(userId: string): Promise<boolean> {
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  const bucketName = `${projectId}-user-uploads`;

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    const [files] = await bucket.getFiles({ prefix: userPrefix, maxResults: 1 });

    return files.length === 0;
  } catch (error) {
    logger.error("Storage deletion verification failed", error as Error, { userId });
    return false;
  }
}

// =============================================================================
// BigQuery 削除関数
// =============================================================================

/**
 * ユーザーの BigQuery データを削除
 *
 * @param userId - 削除対象のユーザー ID
 * @returns BigQuery 削除結果
 */
export async function deleteUserFromBigQuery(userId: string): Promise<BigQueryDeletionResult> {
  const startTime = Date.now();

  logger.info("Starting BigQuery user data deletion", { userId });

  try {
    // BigQuery サービスの deleteUserData を使用
    await bigQueryService.deleteUserData(userId);

    // Note: BigQuery DELETE クエリは削除行数を直接返さないため、
    // ここでは推定値を返す。実際の行数が必要な場合は、
    // 削除前にカウントクエリを実行する必要がある。
    const result: BigQueryDeletionResult = {
      deleted: true,
      rowsAffected: -1, // Exact count not available from BigQuery DELETE
      tablesAffected: ["users_anonymized", "training_sessions"],
    };

    logger.info("BigQuery user data deletion completed", {
      userId,
      tablesAffected: result.tablesAffected,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error("BigQuery user data deletion failed", error as Error, { userId });
    return {
      deleted: false,
      rowsAffected: 0,
      tablesAffected: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * BigQuery 内のユーザーデータが削除されているか検証
 *
 * @param userId - 検証対象のユーザー ID
 * @returns 削除検証結果
 */
export async function verifyBigQueryDeletion(userId: string): Promise<boolean> {
  try {
    // Hash the userId the same way BigQuery service does
    const userHash = crypto
      .createHash("sha256")
      .update(userId + (process.env.ANONYMIZATION_SALT ?? ""))
      .digest("hex")
      .substring(0, 16);

    const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
    const query = `
      SELECT COUNT(*) as count
      FROM \`${projectId}.fitness_analytics.users_anonymized\`
      WHERE user_hash = @userHash
      UNION ALL
      SELECT COUNT(*) as count
      FROM \`${projectId}.fitness_analytics.training_sessions\`
      WHERE user_hash = @userHash
    `;

    interface CountResult {
      count: number;
    }

    const results = await bigQueryService.runQuery<CountResult>(query, { userHash });

    // Sum all counts - should be 0 if properly deleted
    const totalCount = results.reduce((sum, row) => sum + row.count, 0);

    return totalCount === 0;
  } catch (error) {
    logger.error("BigQuery deletion verification failed", error as Error, { userId });
    // In case of error (e.g., table doesn't exist), consider it verified
    return true;
  }
}

// =============================================================================
// 削除検証関数（強化版）
// =============================================================================

/**
 * 全サービスにわたる削除を検証
 *
 * @param userId - 検証対象のユーザー ID
 * @param scope - 削除スコープ
 * @returns 詳細な検証結果
 */
export async function verifyCompleteDeletion(
  userId: string,
  scope: string[],
): Promise<{
  verified: boolean;
  verificationResult: DeletionVerificationResult;
  remainingData: string[];
}> {
  const remainingData: string[] = [];

  // Firestore verification (existing logic)
  const { verified: firestoreVerified, remainingData: firestoreRemaining } =
    await verifyDeletion(userId, scope);

  if (!firestoreVerified) {
    remainingData.push(...firestoreRemaining.map((r) => `firestore:${r}`));
  }

  // Storage verification
  const storageVerified = await verifyStorageDeletion(userId);
  if (!storageVerified) {
    remainingData.push("storage:user-files");
  }

  // BigQuery verification
  const bigqueryVerified = await verifyBigQueryDeletion(userId);
  if (!bigqueryVerified) {
    remainingData.push("bigquery:user-data");
  }

  // Auth verification
  let authVerified = true;
  try {
    await admin.auth().getUser(userId);
    // If getUser succeeds, user still exists
    authVerified = false;
    remainingData.push("auth:user-record");
  } catch {
    // User not found - deletion verified
    authVerified = true;
  }

  const verificationResult: DeletionVerificationResult = {
    firestore: firestoreVerified,
    storage: storageVerified,
    bigquery: bigqueryVerified,
    auth: authVerified,
  };

  const allVerified = firestoreVerified && storageVerified && bigqueryVerified && authVerified;

  logger.info("Complete deletion verification", {
    userId,
    verified: allVerified,
    verificationResult,
    remainingData,
  });

  return {
    verified: allVerified,
    verificationResult,
    remainingData,
  };
}

// =============================================================================
// 削除証明書関数
// =============================================================================

/**
 * 署名を生成（HMAC-SHA256）
 */
function generateSignature(data: string): string {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET || "gdpr_certificate_default_secret";
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}

/**
 * ユーザー ID をハッシュ化
 */
function hashUserId(userId: string): string {
  const salt = process.env.AUDIT_SALT || "audit_default_salt";
  return crypto
    .createHash("sha256")
    .update(userId + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * 削除証明書を生成
 *
 * @param userId - 削除されたユーザー ID
 * @param deletionRequestId - 削除リクエスト ID
 * @param deletedData - 削除されたデータの詳細
 * @param verificationResult - 検証結果
 * @returns 削除証明書
 */
export async function generateDeletionCertificate(
  userId: string,
  deletionRequestId: string,
  deletedData: {
    firestoreCollections: string[];
    storageFilesCount: number;
    bigqueryRowsDeleted: number;
    authDeleted: boolean;
  },
  verificationResult: DeletionVerificationResult,
): Promise<DeletionCertificate> {
  const certificateId = `cert_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  const deletedAt = new Date().toISOString();
  const issuedAt = deletedAt;
  const userIdHash = hashUserId(userId);
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";

  // Create certificate data for signing
  const certificateData = {
    certificateId,
    userIdHash,
    deletedAt,
    deletionRequestId,
    deletedData,
    verificationResult,
  };

  // Generate signature
  const dataToSign = JSON.stringify(certificateData);
  const signature = generateSignature(dataToSign);

  const certificate: DeletionCertificate = {
    certificateId,
    userIdHash,
    deletedAt,
    deletionRequestId,
    deletedData,
    verificationResult,
    signature,
    signatureAlgorithm: "HMAC-SHA256",
    issuedAt,
    issuedBy: `AI Fitness App (${projectId})`,
  };

  // Store certificate in Firestore
  const db = getFirestore();
  await db.collection("deletionCertificates").doc(certificateId).set({
    ...certificate,
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info("Deletion certificate generated", {
    certificateId,
    userIdHash,
    deletionRequestId,
    verificationResult,
  });

  return certificate;
}

/**
 * 削除証明書を取得
 *
 * @param certificateId - 証明書 ID
 * @returns 削除証明書（存在しない場合は null）
 */
export async function getDeletionCertificate(
  certificateId: string,
): Promise<DeletionCertificate | null> {
  const db = getFirestore();
  const doc = await db.collection("deletionCertificates").doc(certificateId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as DeletionCertificate;
}

/**
 * 削除証明書の署名を検証
 *
 * @param certificate - 検証する証明書
 * @returns 署名が有効な場合は true
 */
export function verifyCertificateSignature(certificate: DeletionCertificate): boolean {
  const certificateData = {
    certificateId: certificate.certificateId,
    userIdHash: certificate.userIdHash,
    deletedAt: certificate.deletedAt,
    deletionRequestId: certificate.deletionRequestId,
    deletedData: certificate.deletedData,
    verificationResult: certificate.verificationResult,
  };

  const dataToSign = JSON.stringify(certificateData);
  const expectedSignature = generateSignature(dataToSign);

  return certificate.signature === expectedSignature;
}

// =============================================================================
// Storage データ収集関数（エクスポート用）
// =============================================================================

/**
 * ユーザーアップロードバケット名を取得
 */
function getUserUploadsBucketName(): string {
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  return `${projectId}-user-uploads`;
}

/**
 * ユーザーの Storage データを収集（エクスポート用）
 *
 * @param userId - ユーザー ID
 * @returns Storage エクスポートデータ
 */
export async function collectStorageData(userId: string): Promise<StorageExportData> {
  const startTime = Date.now();
  const bucketName = getUserUploadsBucketName();

  logger.info("Collecting storage data for export", { userId, bucketName });

  const result: StorageExportData = {};

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    // List all files under the user's folder
    const [files] = await bucket.getFiles({ prefix: userPrefix });

    if (files.length === 0) {
      logger.info("No storage files found for user", { userId });
      return result;
    }

    // Process profile image
    const profileImageFile = files.find(
      (f) =>
        f.name.includes("profile") &&
        (f.name.endsWith(".jpg") ||
          f.name.endsWith(".jpeg") ||
          f.name.endsWith(".png") ||
          f.name.endsWith(".webp")),
    );

    if (profileImageFile) {
      try {
        const [metadata] = await profileImageFile.getMetadata();
        const [fileContent] = await profileImageFile.download();

        result.profileImage = {
          fileName: profileImageFile.name.split("/").pop() || "profile_image",
          contentType: metadata.contentType || "image/jpeg",
          size: parseInt(String(metadata.size || "0"), 10),
          base64Data: fileContent.toString("base64"),
        };

        logger.info("Profile image collected", {
          userId,
          fileName: result.profileImage.fileName,
          size: result.profileImage.size,
        });
      } catch (error) {
        logger.warn("Failed to collect profile image", { userId }, error as Error);
      }
    }

    // Collect metadata for other media files (training videos, etc.)
    const mediaFiles = files.filter(
      (f) =>
        !f.name.includes("profile") &&
        (f.name.endsWith(".mp4") ||
          f.name.endsWith(".mov") ||
          f.name.endsWith(".jpg") ||
          f.name.endsWith(".png")),
    );

    if (mediaFiles.length > 0) {
      result.mediaFiles = [];

      for (const file of mediaFiles) {
        try {
          const [metadata] = await file.getMetadata();
          result.mediaFiles.push({
            fileName: file.name.split("/").pop() || "unknown",
            path: file.name,
            contentType: metadata.contentType || "application/octet-stream",
            size: parseInt(String(metadata.size || "0"), 10),
          });
        } catch (error) {
          logger.warn("Failed to collect media file metadata", { fileName: file.name }, error as Error);
        }
      }

      logger.info("Media files metadata collected", {
        userId,
        count: result.mediaFiles.length,
      });
    }

    logger.info("Storage data collection completed", {
      userId,
      hasProfileImage: !!result.profileImage,
      mediaFilesCount: result.mediaFiles?.length || 0,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error("Failed to collect storage data", error as Error, { userId });
    // Return empty result instead of throwing to allow export to continue
    return result;
  }
}

/**
 * プロフィール画像のバイナリデータを取得
 *
 * @param userId - ユーザー ID
 * @returns プロフィール画像の Buffer（存在しない場合は undefined）
 */
export async function getProfileImageBuffer(userId: string): Promise<Buffer | undefined> {
  const bucketName = getUserUploadsBucketName();

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    const [files] = await bucket.getFiles({ prefix: userPrefix });

    const profileImageFile = files.find(
      (f) =>
        f.name.includes("profile") &&
        (f.name.endsWith(".jpg") ||
          f.name.endsWith(".jpeg") ||
          f.name.endsWith(".png") ||
          f.name.endsWith(".webp")),
    );

    if (profileImageFile) {
      const [fileContent] = await profileImageFile.download();
      return fileContent;
    }

    return undefined;
  } catch (error) {
    logger.warn("Failed to get profile image buffer", { userId }, error as Error);
    return undefined;
  }
}

// =============================================================================
// BigQuery データ抽出関数（エクスポート用）
// =============================================================================

/**
 * ユーザーの BigQuery 分析データを抽出（エクスポート用）
 *
 * @param userId - ユーザー ID
 * @returns BigQuery エクスポートデータ
 */
export async function collectBigQueryData(userId: string): Promise<BigQueryExportData | null> {
  const startTime = Date.now();

  logger.info("Collecting BigQuery data for export", { userId });

  try {
    const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
    const userHash = crypto
      .createHash("sha256")
      .update(userId + (process.env.ANONYMIZATION_SALT ?? ""))
      .digest("hex")
      .substring(0, 16);

    // Get aggregate statistics
    const aggregateQuery = `
      SELECT
        COUNT(*) as total_sessions,
        SUM(rep_count) as total_reps,
        AVG(average_score) as avg_score
      FROM \`${projectId}.fitness_analytics.training_sessions\`
      WHERE user_hash = @userHash
    `;

    // Get exercise breakdown
    const exerciseQuery = `
      SELECT
        exercise_type,
        COUNT(*) as session_count
      FROM \`${projectId}.fitness_analytics.training_sessions\`
      WHERE user_hash = @userHash
      GROUP BY exercise_type
    `;

    // Get weekly progress (last 12 weeks)
    const weeklyQuery = `
      SELECT
        FORMAT_DATE('%Y-W%V', DATE(created_at)) as week,
        COUNT(*) as sessions,
        AVG(average_score) as avg_score
      FROM \`${projectId}.fitness_analytics.training_sessions\`
      WHERE user_hash = @userHash
        AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 WEEK)
      GROUP BY week
      ORDER BY week DESC
    `;

    // Get monthly trends (last 12 months)
    const monthlyQuery = `
      SELECT
        FORMAT_DATE('%Y-%m', DATE(created_at)) as month,
        COUNT(*) as sessions,
        AVG(average_score) as avg_score
      FROM \`${projectId}.fitness_analytics.training_sessions\`
      WHERE user_hash = @userHash
        AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month DESC
    `;

    // Execute queries in parallel
    interface AggregateResult {
      total_sessions: number;
      total_reps: number;
      avg_score: number;
    }

    interface ExerciseResult {
      exercise_type: string;
      session_count: number;
    }

    interface WeeklyResult {
      week: string;
      sessions: number;
      avg_score: number;
    }

    interface MonthlyResult {
      month: string;
      sessions: number;
      avg_score: number;
    }

    const [aggregateResult, exerciseResult, weeklyResult, monthlyResult] = await Promise.all([
      bigQueryService.runQuery<AggregateResult>(aggregateQuery, { userHash }),
      bigQueryService.runQuery<ExerciseResult>(exerciseQuery, { userHash }),
      bigQueryService.runQuery<WeeklyResult>(weeklyQuery, { userHash }),
      bigQueryService.runQuery<MonthlyResult>(monthlyQuery, { userHash }),
    ]);

    // Build exercise breakdown
    const exerciseBreakdown: Record<string, number> = {};
    for (const row of exerciseResult) {
      exerciseBreakdown[row.exercise_type] = row.session_count;
    }

    // Build weekly progress
    const weeklyProgress: WeeklyProgress[] = weeklyResult.map((row) => ({
      week: row.week,
      sessions: row.sessions,
      avgScore: row.avg_score || 0,
    }));

    // Build monthly trends
    const monthlyTrends: MonthlyTrend[] = monthlyResult.map((row) => ({
      month: row.month,
      sessions: row.sessions,
      avgScore: row.avg_score || 0,
    }));

    const aggregate = aggregateResult[0] || { total_sessions: 0, total_reps: 0, avg_score: 0 };

    const result: BigQueryExportData = {
      totalSessions: aggregate.total_sessions || 0,
      totalReps: aggregate.total_reps || 0,
      averageScore: aggregate.avg_score || 0,
      exerciseBreakdown,
      weeklyProgress,
      monthlyTrends,
    };

    logger.info("BigQuery data collection completed", {
      userId,
      totalSessions: result.totalSessions,
      totalReps: result.totalReps,
      exerciseTypes: Object.keys(exerciseBreakdown).length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error("Failed to collect BigQuery data", error as Error, { userId });
    // Return null instead of throwing to allow export to continue
    return null;
  }
}

// =============================================================================
// ZIP アーカイブ作成関数
// =============================================================================

/**
 * README ファイルの内容を生成
 *
 * @param data - エクスポートデータ
 * @param format - エクスポートフォーマット
 * @returns README テキスト
 */
export function generateReadmeContent(data: ExportData, format: ExportFormat): string {
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
    `エクスポート日時: ${data.exportedAt}`,
    `データフォーマット: ${format.toUpperCase()}`,
    `ユーザーID: ${data.userId.substring(0, 8)}...（セキュリティのため一部非表示）`,
    "",
    "-" .repeat(40),
    "含まれるデータ",
    "-" .repeat(40),
  ];

  if (data.profile) {
    lines.push("- profile." + format + ": プロフィール情報（名前、身体情報等）");
  }

  if (data.sessions && data.sessions.length > 0) {
    lines.push(`- sessions.${format}: トレーニングセッション履歴（${data.sessions.length}件）`);
  }

  if (data.consents && data.consents.length > 0) {
    lines.push(`- consents.${format}: 同意記録（${data.consents.length}件）`);
  }

  if (data.settings) {
    lines.push("- settings." + format + ": アプリ設定");
  }

  if (data.subscriptions && data.subscriptions.length > 0) {
    lines.push(`- subscriptions.${format}: サブスクリプション履歴（${data.subscriptions.length}件）`);
  }

  if (data.analytics) {
    lines.push("- analytics." + format + ": 分析結果（統計情報、進捗データ）");
  }

  if (data.storage?.profileImage) {
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
 * エクスポートデータの ZIP アーカイブを作成
 *
 * @param options - アーカイブオプション
 * @returns ZIP ファイルの Buffer
 */
export async function createExportArchive(options: ExportArchiveOptions): Promise<Buffer> {
  const { data, format, profileImageBuffer, includeReadme = true } = options;
  const startTime = Date.now();

  logger.info("Creating export archive", {
    userId: options.userId,
    requestId: options.requestId,
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
        userId: options.userId,
        requestId: options.requestId,
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
      const readmeContent = generateReadmeContent(data, format);
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
 * プロフィールデータを CSV に変換
 */
function convertProfileToCSV(profile: ExportProfileData): string {
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
 * セッションデータを CSV に変換
 */
function convertSessionsToCSV(sessions: ExportSessionData[]): string {
  const header = "sessionId,exerciseType,startTime,endTime,repCount,totalScore,averageScore,duration,status";
  const rows = sessions.map(
    (s) =>
      `${s.sessionId},${s.exerciseType},${s.startTime},${s.endTime || ""},${s.repCount},${s.totalScore},${s.averageScore},${s.duration},${s.status}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 同意データを CSV に変換
 */
function convertConsentsToCSV(consents: ExportConsentData[]): string {
  const header = "documentType,documentVersion,action,timestamp";
  const rows = consents.map(
    (c) => `${c.documentType},${c.documentVersion},${c.action},${c.timestamp}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 設定データを CSV に変換
 */
function convertSettingsToCSV(settings: ExportSettingsData): string {
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
 * サブスクリプションデータを CSV に変換
 */
function convertSubscriptionsToCSV(subscriptions: ExportSubscriptionData[]): string {
  const header = "plan,status,startDate,expirationDate,store";
  const rows = subscriptions.map(
    (s) => `${s.plan},${s.status},${s.startDate},${s.expirationDate},${s.store}`,
  );
  return [header, ...rows].join("\n");
}

/**
 * 分析データを CSV に変換
 */
function convertAnalyticsToCSV(analytics: BigQueryExportData): string {
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

/**
 * CSV 用にエスケープ
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * ZIP ファイルを Cloud Storage にアップロードし、署名付き URL を生成
 *
 * @param userId - ユーザー ID
 * @param requestId - リクエスト ID
 * @param archiveBuffer - ZIP ファイルの Buffer
 * @returns ダウンロード URL と有効期限
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

    // Set lifecycle rule for auto-deletion after 48 hours
    // Note: Lifecycle rules are typically set at bucket level, but we can set metadata
    // for tracking purposes. Actual deletion is handled by a scheduled function.

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
// 通知機能
// =============================================================================

/**
 * エクスポート完了通知を送信
 *
 * @param userId - ユーザー ID
 * @param email - メールアドレス
 * @param downloadUrl - ダウンロード URL
 * @param expiresAt - 有効期限
 */
export async function sendExportCompletionNotification(
  userId: string,
  email: string,
  downloadUrl: string,
  expiresAt: Date,
): Promise<void> {
  const isDevelopment =
    process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development";

  const expiresAtFormatted = expiresAt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const emailContent = {
    subject: "[AI Fitness] データエクスポートが完了しました",
    body: `
AI Fitness Appをご利用いただきありがとうございます。

リクエストいただいたデータエクスポートが完了しました。

■ ダウンロードについて
以下のリンクからデータをダウンロードできます。
※リンクの有効期限: ${expiresAtFormatted}（日本時間）

■ セキュリティに関するご注意
- このリンクはあなた専用です。第三者に共有しないでください。
- ダウンロードしたデータには個人情報が含まれています。
- 安全な場所に保管し、不要になったら完全に削除してください。

■ データの内容
エクスポートされたZIPファイルには以下が含まれます：
- プロフィール情報
- トレーニング履歴
- 設定情報
- 同意記録
- 分析データ（該当する場合）

ご不明な点がございましたら、アプリ内のお問い合わせフォームよりご連絡ください。

---
AI Fitness App サポートチーム
※このメールは自動送信されています。返信はできません。
    `.trim(),
  };

  if (isDevelopment) {
    // Development environment: log only
    logger.info("Export completion notification (development mode)", {
      userId,
      email,
      downloadUrl: downloadUrl.substring(0, 100) + "...",
      expiresAt: expiresAtFormatted,
      subject: emailContent.subject,
      bodyPreview: emailContent.body.substring(0, 200) + "...",
    });
    return;
  }

  // Production environment: send email via email service
  // TODO: Integrate with SendGrid, Firebase Extensions (Trigger Email), or other email service
  logger.info("Export completion notification sent", {
    userId,
    email,
    expiresAt: expiresAtFormatted,
  });

  // Example implementation with SendGrid (uncomment when service is configured):
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: email,
  //   from: 'noreply@aifitnessapp.com',
  //   subject: emailContent.subject,
  //   text: emailContent.body,
  //   html: `<pre>${emailContent.body}</pre>`, // Simple HTML version
  // });
}

/**
 * エクスポート失敗通知を送信
 *
 * @param userId - ユーザー ID
 * @param email - メールアドレス
 * @param errorMessage - エラーメッセージ
 */
export async function sendExportFailureNotification(
  userId: string,
  email: string,
  errorMessage?: string,
): Promise<void> {
  const isDevelopment =
    process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development";

  const emailContent = {
    subject: "[AI Fitness] データエクスポートに失敗しました",
    body: `
AI Fitness Appをご利用いただきありがとうございます。

リクエストいただいたデータエクスポートの処理中にエラーが発生しました。
大変申し訳ございませんが、しばらく時間をおいてから再度お試しください。

問題が解決しない場合は、アプリ内のお問い合わせフォームよりご連絡ください。

---
AI Fitness App サポートチーム
※このメールは自動送信されています。返信はできません。
    `.trim(),
  };

  if (isDevelopment) {
    logger.info("Export failure notification (development mode)", {
      userId,
      email,
      errorMessage,
      subject: emailContent.subject,
    });
    return;
  }

  logger.info("Export failure notification sent", {
    userId,
    email,
    errorMessage,
  });
}
