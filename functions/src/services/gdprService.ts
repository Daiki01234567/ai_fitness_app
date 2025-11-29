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

import { Storage } from "@google-cloud/storage";
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
} from "../types/gdpr";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
  batchWrite,
} from "../utils/firestore";
import { logger } from "../utils/logger";

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
