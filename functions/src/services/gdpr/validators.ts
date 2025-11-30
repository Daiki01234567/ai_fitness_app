/**
 * GDPR バリデーター
 *
 * レート制限、重複チェック、レコード数カウントなどの検証関数
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { Timestamp } from "firebase-admin/firestore";

import { GDPR_CONSTANTS } from "../../types/gdpr";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
} from "../../utils/firestore";

// =============================================================================
// エクスポートレート制限
// =============================================================================

/**
 * 最近のエクスポートリクエストがあるかチェック
 *
 * レート制限として、一定時間内の重複リクエストを防止
 *
 * @param userId - チェック対象のユーザー ID
 * @returns 最近のリクエストが存在する場合は true
 *
 * @example
 * ```typescript
 * if (await hasRecentExportRequest(userId)) {
 *   throw new Error("エクスポートリクエストは24時間に1回までです");
 * }
 * ```
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

// =============================================================================
// 削除リクエストチェック
// =============================================================================

/**
 * 保留中の削除リクエストがあるかチェック
 *
 * 削除処理中のユーザーに対する重複リクエストを防止
 *
 * @param userId - チェック対象のユーザー ID
 * @returns 保留中のリクエストが存在する場合は true
 *
 * @example
 * ```typescript
 * if (await hasPendingDeletionRequest(userId)) {
 *   throw new Error("既に削除リクエストが処理中です");
 * }
 * ```
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

// =============================================================================
// レコード数カウント
// =============================================================================

/**
 * ユーザーのレコード数をカウント
 *
 * エクスポートサイズの見積もりや削除確認に使用
 *
 * @param userId - カウント対象のユーザー ID
 * @returns 合計レコード数
 *
 * @example
 * ```typescript
 * const totalRecords = await countUserRecords(userId);
 * console.log(`このユーザーには ${totalRecords} 件のレコードがあります`);
 * ```
 */
export async function countUserRecords(userId: string): Promise<number> {
  let count = 0;

  // Profile count (1 or 0)
  const userDoc = await userRef(userId).get();
  if (userDoc.exists) {
    count += 1;
  }

  // Sessions count
  const sessionsSnapshot = await sessionsCollection(userId).count().get();
  count += sessionsSnapshot.data().count;

  // Consents count
  const consentsSnapshot = await consentsCollection()
    .where("userId", "==", userId)
    .count()
    .get();
  count += consentsSnapshot.data().count;

  // Settings count (1 or 0)
  const settingsDoc = await userRef(userId).collection("settings").doc("default").get();
  if (settingsDoc.exists) {
    count += 1;
  }

  // Subscriptions count
  const subsSnapshot = await userRef(userId).collection("subscriptions").count().get();
  count += subsSnapshot.data().count;

  return count;
}
