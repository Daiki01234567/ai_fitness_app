/**
 * ユーザー削除サービス
 *
 * ユーザーデータの完全削除とバックアップ機能を提供
 * - 強制削除（superAdmin専用）
 * - 削除前データバックアップ
 * - 監査ログ記録
 *
 * GDPR Article 17 (削除権) に準拠
 *
 * 参照: docs/common/tickets/044-force-delete-api.md
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md - FR-043
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import {
  UserBackupData,
  UserBackupDocument,
  SessionBackupData,
  ConsentBackupData,
  StripeBackupData,
  ForceDeleteResult,
  timestampToString,
} from "../types/admin";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
  batchWrite,
} from "../utils/firestore";
import { logger } from "../utils/logger";

import { deleteUserFromBigQuery } from "./gdprBigQuery";
import { deleteUserStorage } from "./gdprStorage";
import { deleteStripeCustomer, getStripeCustomerId } from "./stripe";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// バックアップ機能
// =============================================================================

/**
 * ユーザーデータをバックアップ
 *
 * 削除前に全ユーザーデータを収集し、バックアップデータを作成
 * 監査ログに保存するため、機密データを含む
 *
 * @param userId - バックアップ対象のユーザーID
 * @param reason - バックアップ理由
 * @param performedBy - 実行者ID
 * @returns バックアップデータ
 *
 * @example
 * ```typescript
 * const backup = await backupUserData("user123", "GDPR削除要求", "admin123");
 * ```
 */
export async function backupUserData(
  userId: string,
  reason: string,
  performedBy: string,
): Promise<UserBackupData> {
  const startTime = Date.now();
  logger.info("ユーザーデータのバックアップを開始", { userId, performedBy });

  const db = getFirestore();

  // 1. ユーザードキュメントを取得
  const userDoc = await userRef(userId).get();
  let userData: UserBackupDocument | null = null;

  if (userDoc.exists) {
    const data = userDoc.data();
    userData = {
      nickname: data?.nickname,
      email: data?.email,
      photoURL: data?.photoURL,
      birthYear: data?.birthYear,
      gender: data?.gender,
      height: data?.height,
      weight: data?.weight,
      fitnessLevel: data?.fitnessLevel,
      tosAccepted: data?.tosAccepted,
      tosAcceptedAt: timestampToString(data?.tosAcceptedAt) ?? undefined,
      ppAccepted: data?.ppAccepted,
      ppAcceptedAt: timestampToString(data?.ppAcceptedAt) ?? undefined,
      createdAt: timestampToString(data?.createdAt) ?? undefined,
      updatedAt: timestampToString(data?.updatedAt) ?? undefined,
      lastLoginAt: timestampToString(data?.lastLoginAt) ?? undefined,
      subscriptionStatus: data?.subscriptionStatus,
      stripeCustomerId: data?.stripeCustomerId,
    };
  }

  // 2. セッションデータを取得
  const sessionsSnapshot = await sessionsCollection(userId).get();
  const sessions: SessionBackupData[] = sessionsSnapshot.docs.map((doc) => ({
    sessionId: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));

  // 3. 同意レコードを取得
  const consentsSnapshot = await consentsCollection()
    .where("userId", "==", userId)
    .get();
  const consents: ConsentBackupData[] = consentsSnapshot.docs.map((doc) => ({
    consentId: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));

  // 4. Stripeデータを取得
  let stripeData: StripeBackupData | undefined;
  const stripeCustomerDoc = await db.collection("stripeCustomers").doc(userId).get();
  if (stripeCustomerDoc.exists) {
    const stripeDocData = stripeCustomerDoc.data();
    stripeData = {
      customerId: stripeDocData?.customerId || null,
      subscriptionId: stripeDocData?.subscriptionId,
      subscriptionStatus: stripeDocData?.subscriptionStatus,
    };
  }

  const backup: UserBackupData = {
    userId,
    userData,
    sessions,
    consents,
    stripeData,
    backupAt: new Date().toISOString(),
    reason,
    performedBy,
  };

  logger.info("ユーザーデータのバックアップが完了", {
    userId,
    sessionsCount: sessions.length,
    consentsCount: consents.length,
    hasStripeData: !!stripeData,
    durationMs: Date.now() - startTime,
  });

  return backup;
}

// =============================================================================
// 完全削除機能
// =============================================================================

/**
 * ユーザーと関連データを完全に削除
 *
 * 以下のデータを削除:
 * - Firebase Authentication ユーザー
 * - Firestore users ドキュメント
 * - サブコレクション（sessions, settings, subscriptions）
 * - 同意レコード（consents）
 * - BigQuery データ（匿名化）
 * - Stripe 顧客データ
 * - Cloud Storage ファイル
 *
 * @param userId - 削除対象のユーザーID
 * @param performedBy - 実行者ID
 * @param reason - 削除理由
 * @param backupId - バックアップID（監査ログ参照用）
 * @returns 削除結果
 *
 * @example
 * ```typescript
 * const result = await deleteUserCompletely(
 *   "user123",
 *   "admin123",
 *   "GDPR削除要求",
 *   "backup-abc123"
 * );
 * ```
 */
export async function deleteUserCompletely(
  userId: string,
  performedBy: string,
  reason: string,
  backupId: string,
): Promise<ForceDeleteResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const deletedCollections: string[] = [];

  logger.info("ユーザーの完全削除を開始", { userId, performedBy, reason });

  const db = getFirestore();

  // 1. Firestore サブコレクションを削除
  try {
    // sessions サブコレクション
    const sessionsSnapshot = await sessionsCollection(userId).get();
    if (!sessionsSnapshot.empty) {
      await batchWrite(sessionsSnapshot.docs, (batch, doc) => {
        batch.delete(doc.ref);
      });
      deletedCollections.push("sessions");
      logger.info("sessionsサブコレクションを削除", {
        userId,
        count: sessionsSnapshot.size,
      });
    }

    // settings サブコレクション
    const settingsSnapshot = await userRef(userId).collection("settings").get();
    if (!settingsSnapshot.empty) {
      await batchWrite(settingsSnapshot.docs, (batch, doc) => {
        batch.delete(doc.ref);
      });
      deletedCollections.push("settings");
    }

    // subscriptions サブコレクション
    const subscriptionsSnapshot = await userRef(userId).collection("subscriptions").get();
    if (!subscriptionsSnapshot.empty) {
      await batchWrite(subscriptionsSnapshot.docs, (batch, doc) => {
        batch.delete(doc.ref);
      });
      deletedCollections.push("subscriptions");
    }
  } catch (error) {
    const errorMsg = `Firestoreサブコレクション削除失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("Firestoreサブコレクション削除失敗", error as Error, { userId });
  }

  // 2. 同意レコードを削除（トップレベルコレクション）
  try {
    const consentsSnapshot = await consentsCollection()
      .where("userId", "==", userId)
      .get();
    if (!consentsSnapshot.empty) {
      await batchWrite(consentsSnapshot.docs, (batch, doc) => {
        batch.delete(doc.ref);
      });
      deletedCollections.push("consents");
      logger.info("同意レコードを削除", { userId, count: consentsSnapshot.size });
    }
  } catch (error) {
    const errorMsg = `同意レコード削除失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("同意レコード削除失敗", error as Error, { userId });
  }

  // 3. ユーザードキュメントを削除
  try {
    const userDoc = await userRef(userId).get();
    if (userDoc.exists) {
      await userRef(userId).delete();
      deletedCollections.push("users");
      logger.info("ユーザードキュメントを削除", { userId });
    }
  } catch (error) {
    const errorMsg = `ユーザードキュメント削除失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("ユーザードキュメント削除失敗", error as Error, { userId });
  }

  // 4. Firebase Authentication からユーザーを削除
  let authDeleted = false;
  try {
    await admin.auth().deleteUser(userId);
    authDeleted = true;
    logger.info("Firebase Authenticationからユーザーを削除", { userId });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "auth/user-not-found") {
      // Already deleted, consider success
      authDeleted = true;
      logger.info("Firebase Authenticationユーザーは既に削除済み", { userId });
    } else {
      const errorMsg = `Firebase Authentication削除失敗: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      logger.error("Firebase Authentication削除失敗", error as Error, { userId });
    }
  }

  // 5. BigQuery データを匿名化
  let bigQueryAnonymized = false;
  try {
    const bigQueryResult = await deleteUserFromBigQuery(userId);
    bigQueryAnonymized = bigQueryResult.deleted;
    if (bigQueryAnonymized) {
      logger.info("BigQueryデータを匿名化", { userId });
    }
  } catch (error) {
    const errorMsg = `BigQuery匿名化失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("BigQuery匿名化失敗", error as Error, { userId });
  }

  // 6. Stripe 顧客データを削除
  let stripeDeleted = false;
  try {
    const customerId = await getStripeCustomerId(userId);
    if (customerId) {
      await deleteStripeCustomer(customerId);
      stripeDeleted = true;
      logger.info("Stripe顧客データを削除", { userId, customerId });

      // stripeCustomersコレクションからも削除
      await db.collection("stripeCustomers").doc(userId).delete();
    } else {
      // No Stripe customer, consider success
      stripeDeleted = true;
    }
  } catch (error) {
    const errorMsg = `Stripe顧客削除失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("Stripe顧客削除失敗", error as Error, { userId });
  }

  // 7. Cloud Storage ファイルを削除
  let storageDeleted = false;
  try {
    const storageResult = await deleteUserStorage(userId);
    storageDeleted = storageResult.deleted;
    if (storageDeleted) {
      logger.info("Cloud Storageファイルを削除", {
        userId,
        filesCount: storageResult.filesCount,
      });
    }
  } catch (error) {
    const errorMsg = `Cloud Storage削除失敗: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error("Cloud Storage削除失敗", error as Error, { userId });
  }

  const success = errors.length === 0;

  logger.info("ユーザーの完全削除が完了", {
    userId,
    performedBy,
    success,
    deletedCollections,
    authDeleted,
    bigQueryAnonymized,
    stripeDeleted,
    storageDeleted,
    errorsCount: errors.length,
    durationMs: Date.now() - startTime,
  });

  return {
    success,
    deletedCollections,
    authDeleted,
    bigQueryAnonymized,
    stripeDeleted,
    storageDeleted,
    backupId,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// =============================================================================
// 監査ログ機能
// =============================================================================

/**
 * 強制削除の監査ログを記録
 *
 * @param params - 監査ログパラメータ
 * @returns 監査ログID
 */
export async function logForceDeleteAudit(params: {
  performedBy: string;
  targetUser: string;
  reason: string;
  backupData: UserBackupData;
  deleteResult: ForceDeleteResult;
}): Promise<string> {
  const db = getFirestore();

  const auditLog = {
    action: "FORCE_DELETE_USER",
    performedBy: params.performedBy,
    targetUser: params.targetUser,
    reason: params.reason,
    backupData: params.backupData,
    deleteResult: params.deleteResult,
    timestamp: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("auditLogs").add(auditLog);

  logger.info("強制削除の監査ログを記録", {
    auditLogId: docRef.id,
    targetUser: params.targetUser,
    performedBy: params.performedBy,
  });

  return docRef.id;
}

// =============================================================================
// 削除プレビュー機能
// =============================================================================

/**
 * 削除対象データのプレビュー情報を取得
 *
 * @param userId - 対象ユーザーID
 * @returns プレビュー情報
 */
export async function getDeletePreviewData(userId: string): Promise<{
  sessionCount: number;
  consentCount: number;
  hasStripeAccount: boolean;
  stripeCustomerId: string | null;
}> {
  const db = getFirestore();

  // セッション数をカウント
  const sessionsSnapshot = await sessionsCollection(userId).count().get();
  const sessionCount = sessionsSnapshot.data().count;

  // 同意レコード数をカウント
  const consentsSnapshot = await consentsCollection()
    .where("userId", "==", userId)
    .count()
    .get();
  const consentCount = consentsSnapshot.data().count;

  // Stripe顧客情報を確認
  const stripeDoc = await db.collection("stripeCustomers").doc(userId).get();
  const hasStripeAccount = stripeDoc.exists;
  const stripeCustomerId = stripeDoc.exists
    ? (stripeDoc.data()?.customerId as string) || null
    : null;

  return {
    sessionCount,
    consentCount,
    hasStripeAccount,
    stripeCustomerId,
  };
}
