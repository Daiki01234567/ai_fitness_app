/**
 * GDPR 削除サービス
 *
 * ユーザーデータの削除処理を提供
 * - Firestore データの削除
 * - 削除の検証
 * - 削除フラグの管理
 *
 * GDPR Article 17 (削除権) に準拠
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as admin from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

import {
  DeletionScope,
  StorageDeletionResult,
  BigQueryDeletionResult,
  DeletionVerificationResult,
} from "../types/gdpr";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
  batchWrite,
} from "../utils/firestore";
import { logger } from "../utils/logger";

import { deleteUserStorage } from "./gdprStorage";
import { deleteUserFromBigQuery } from "./gdprBigQuery";
import {
  verifyCompleteDeletion,
  generateDeletionCertificate,
} from "./gdprVerification";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// 削除結果インターフェース
// =============================================================================

/**
 * 削除実行結果
 */
export interface DeletionResult {
  /** 削除成功 */
  success: boolean;
  /** 削除されたコレクション */
  deletedCollections: string[];
  /** Storage 削除結果 */
  storageResult?: StorageDeletionResult;
  /** BigQuery 削除結果 */
  bigqueryResult?: BigQueryDeletionResult;
  /** Auth 削除成功 */
  authDeleted?: boolean;
  /** 検証結果 */
  verificationResult?: DeletionVerificationResult;
  /** エラーメッセージ */
  error?: string;
}

/**
 * 完全削除結果
 */
export interface CompleteDeletionResult extends DeletionResult {
  /** 証明書 ID */
  certificateId?: string;
}

// =============================================================================
// コレクション削除関数
// =============================================================================

/**
 * ユーザーのサブコレクションを削除
 *
 * @param userId - ユーザー ID
 * @param collectionName - サブコレクション名
 *
 * @example
 * ```typescript
 * await deleteUserSubcollection("user123", "sessions");
 * ```
 */
async function deleteUserSubcollection(
  userId: string,
  collectionName: string,
): Promise<number> {
  const collectionRef = userRef(userId).collection(collectionName);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    return 0;
  }

  // Delete in batches (max 500 per batch)
  await batchWrite(snapshot.docs, (batch, doc) => {
    batch.delete(doc.ref);
  });

  logger.info("Subcollection deleted", {
    userId,
    collectionName,
    count: snapshot.size,
  });

  return snapshot.size;
}

/**
 * ユーザーの同意記録を削除
 *
 * consents コレクションはトップレベルなので、userId でフィルターして削除
 *
 * @param userId - ユーザー ID
 *
 * @example
 * ```typescript
 * await deleteConsentsForUser("user123");
 * ```
 */
async function deleteConsentsForUser(userId: string): Promise<number> {
  const snapshot = await consentsCollection()
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  await batchWrite(snapshot.docs, (batch, doc) => {
    batch.delete(doc.ref);
  });

  logger.info("Consents deleted", { userId, count: snapshot.size });
  return snapshot.size;
}

/**
 * ユーザードキュメント自体を削除
 *
 * @param userId - ユーザー ID
 *
 * @example
 * ```typescript
 * await deleteUserDocument("user123");
 * ```
 */
async function deleteUserDocument(userId: string): Promise<void> {
  const docRef = userRef(userId);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.delete();
    logger.info("User document deleted", { userId });
  }
}

/**
 * Firebase Auth ユーザーを削除
 *
 * @param userId - ユーザー ID
 * @returns 削除成功の場合 true
 *
 * @example
 * ```typescript
 * const deleted = await deleteAuthUser("user123");
 * ```
 */
async function deleteAuthUser(userId: string): Promise<boolean> {
  try {
    await admin.auth().deleteUser(userId);
    logger.info("Auth user deleted", { userId });
    return true;
  } catch (error) {
    // User may not exist or already deleted
    const err = error as { code?: string };
    if (err.code === "auth/user-not-found") {
      logger.info("Auth user not found (may already be deleted)", { userId });
      return true;
    }
    logger.warn("Failed to delete Auth user", { userId }, error as Error);
    return false;
  }
}

// =============================================================================
// メイン削除関数
// =============================================================================

/**
 * ユーザーの Firestore データを削除
 *
 * スコープに基づいて選択的にデータを削除する
 *
 * @param userId - 削除対象のユーザー ID
 * @param scope - 削除スコープ（"all" または個別のコレクション名）
 * @returns 削除結果
 *
 * @example
 * ```typescript
 * // 全データ削除
 * const result = await deleteUserData("user123", ["all"]);
 *
 * // 部分削除
 * const result = await deleteUserData("user123", ["sessions", "settings"]);
 * ```
 */
export async function deleteUserData(
  userId: string,
  scope: DeletionScope[],
): Promise<{ deletedCollections: string[]; success: boolean }> {
  const startTime = Date.now();
  logger.info("Starting user data deletion", { userId, scope });

  const deletedCollections: string[] = [];

  try {
    // Full deletion
    if (scope.includes("all")) {
      // Delete sessions subcollection
      await deleteUserSubcollection(userId, "sessions");
      deletedCollections.push("sessions");

      // Delete settings subcollection
      await deleteUserSubcollection(userId, "settings");
      deletedCollections.push("settings");

      // Delete subscriptions subcollection
      await deleteUserSubcollection(userId, "subscriptions");
      deletedCollections.push("subscriptions");

      // Delete consents (top-level collection)
      await deleteConsentsForUser(userId);
      deletedCollections.push("consents");

      // Delete user document
      await deleteUserDocument(userId);
      deletedCollections.push("users");

      // Delete Firebase Auth user
      const authDeleted = await deleteAuthUser(userId);
      if (authDeleted) {
        deletedCollections.push("auth");
      }
    } else {
      // Partial deletion based on scope
      if (scope.includes("sessions")) {
        await deleteUserSubcollection(userId, "sessions");
        deletedCollections.push("sessions");
      }

      if (scope.includes("settings")) {
        await deleteUserSubcollection(userId, "settings");
        deletedCollections.push("settings");
      }

      if (scope.includes("subscriptions")) {
        await deleteUserSubcollection(userId, "subscriptions");
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
 * 全サービスからユーザーデータを完全に削除
 *
 * Firestore、Storage、BigQuery、Auth の全てからデータを削除し、
 * 検証後に削除証明書を生成する
 *
 * @param userId - 削除対象のユーザー ID
 * @param deletionRequestId - 削除リクエスト ID
 * @param scope - 削除スコープ
 * @returns 完全削除結果
 *
 * @example
 * ```typescript
 * const result = await deleteUserDataCompletely("user123", "req_abc", ["all"]);
 * if (result.success && result.certificateId) {
 *   console.log(`Deletion certificate: ${result.certificateId}`);
 * }
 * ```
 */
export async function deleteUserDataCompletely(
  userId: string,
  deletionRequestId: string,
  scope: DeletionScope[],
): Promise<CompleteDeletionResult> {
  const startTime = Date.now();
  logger.info("Starting complete user data deletion", {
    userId,
    deletionRequestId,
    scope,
  });

  const result: CompleteDeletionResult = {
    success: false,
    deletedCollections: [],
  };

  try {
    // 1. Delete Firestore data
    const firestoreResult = await deleteUserData(userId, scope);
    result.deletedCollections = firestoreResult.deletedCollections;

    // 2. Delete Storage data
    result.storageResult = await deleteUserStorage(userId);

    // 3. Delete BigQuery data
    result.bigqueryResult = await deleteUserFromBigQuery(userId);

    // 4. Delete Auth user (if full deletion)
    if (scope.includes("all")) {
      result.authDeleted = await deleteAuthUser(userId);
    }

    // 5. Verify deletion
    const verification = await verifyCompleteDeletion(userId, scope);
    result.verificationResult = verification.verificationResult;

    // 6. Generate deletion certificate
    const certificate = await generateDeletionCertificate(
      userId,
      deletionRequestId,
      {
        firestoreCollections: result.deletedCollections,
        storageFilesCount: result.storageResult?.filesCount || 0,
        bigqueryRowsDeleted: result.bigqueryResult?.rowsAffected || 0,
        authDeleted: result.authDeleted || false,
      },
      verification.verificationResult,
    );

    result.certificateId = certificate.certificateId;
    result.success = verification.verified;

    logger.info("Complete user data deletion finished", {
      userId,
      deletionRequestId,
      durationMs: Date.now() - startTime,
      success: result.success,
      certificateId: result.certificateId,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    result.error = err.message;
    logger.error("Complete user data deletion failed", err, {
      userId,
      deletionRequestId,
    });
    return result;
  }
}

// =============================================================================
// 削除フラグ管理
// =============================================================================

/**
 * ユーザーに削除予定フラグを設定
 *
 * 30日間の猶予期間を設けるため、即座には削除せずフラグを設定する
 *
 * @param userId - ユーザー ID
 * @param scheduled - 削除予定かどうか
 * @param scheduledDate - 削除予定日時（オプション）
 *
 * @example
 * ```typescript
 * // 削除をスケジュール
 * const deletionDate = new Date();
 * deletionDate.setDate(deletionDate.getDate() + 30);
 * await setUserDeletionScheduled("user123", true, deletionDate);
 *
 * // 削除をキャンセル
 * await setUserDeletionScheduled("user123", false);
 * ```
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

/**
 * ユーザーが削除予定かどうかを確認
 *
 * @param userId - ユーザー ID
 * @returns 削除予定情報
 *
 * @example
 * ```typescript
 * const status = await getUserDeletionStatus("user123");
 * if (status.scheduled) {
 *   console.log(`Scheduled for deletion on: ${status.scheduledDate}`);
 * }
 * ```
 */
export async function getUserDeletionStatus(
  userId: string,
): Promise<{
  scheduled: boolean;
  scheduledDate?: Date;
}> {
  const userDoc = await userRef(userId).get();

  if (!userDoc.exists) {
    return { scheduled: false };
  }

  const data = userDoc.data();
  const scheduled = data?.deletionScheduled === true;
  const scheduledDate = data?.scheduledDeletionDate
    ? (data.scheduledDeletionDate as Timestamp).toDate()
    : undefined;

  return { scheduled, scheduledDate };
}

// =============================================================================
// 削除検証関数
// =============================================================================

/**
 * Firestore データの削除を検証
 *
 * @param userId - 検証対象のユーザー ID
 * @param scope - 削除スコープ
 * @returns 検証結果
 *
 * @example
 * ```typescript
 * const { verified, remainingData } = await verifyDeletion("user123", ["all"]);
 * ```
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

// =============================================================================
// 期限切れ削除リクエストの処理
// =============================================================================

/**
 * 期限切れの削除予定ユーザーを取得
 *
 * スケジュール関数から呼び出され、削除予定日を過ぎたユーザーを処理する
 *
 * @param limit - 取得する最大件数
 * @returns 削除対象のユーザー ID 配列
 *
 * @example
 * ```typescript
 * const userIds = await getExpiredDeletionScheduledUsers(100);
 * for (const userId of userIds) {
 *   await deleteUserDataCompletely(userId, `scheduled_${userId}`, ["all"]);
 * }
 * ```
 */
export async function getExpiredDeletionScheduledUsers(
  limit: number = 100,
): Promise<string[]> {
  const db = getFirestore();
  const now = Timestamp.now();

  const snapshot = await db
    .collection("users")
    .where("deletionScheduled", "==", true)
    .where("scheduledDeletionDate", "<=", now)
    .limit(limit)
    .get();

  const userIds = snapshot.docs.map((doc) => doc.id);

  logger.info("Found expired deletion scheduled users", {
    count: userIds.length,
  });

  return userIds;
}

/**
 * 削除リクエストコレクションから処理待ちのリクエストを取得
 *
 * @param limit - 取得する最大件数
 * @returns 処理対象の削除リクエスト
 */
export async function getPendingDeletionRequests(
  limit: number = 100,
): Promise<Array<{ requestId: string; userId: string; scope: DeletionScope[] }>> {
  const db = getFirestore();
  const now = Timestamp.now();

  const snapshot = await db
    .collection("deletionRequests")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", now)
    .limit(limit)
    .get();

  const requests = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      requestId: doc.id,
      userId: data.userId as string,
      scope: data.scope as DeletionScope[],
    };
  });

  logger.info("Found pending deletion requests", {
    count: requests.length,
  });

  return requests;
}

/**
 * 削除リクエストのステータスを更新
 *
 * @param requestId - リクエスト ID
 * @param status - 新しいステータス
 * @param additionalData - 追加データ
 */
export async function updateDeletionRequestStatus(
  requestId: string,
  status: "pending" | "scheduled" | "processing" | "completed" | "cancelled",
  additionalData?: Record<string, unknown>,
): Promise<void> {
  const db = getFirestore();

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
    ...additionalData,
  };

  if (status === "completed") {
    updateData.executedAt = FieldValue.serverTimestamp();
  }

  await db.collection("deletionRequests").doc(requestId).update(updateData);

  logger.info("Deletion request status updated", {
    requestId,
    status,
  });
}
