/**
 * GDPR アカウント復元サービス
 *
 * 削除予定アカウントの復元機能を提供
 * - 復元コードの生成・検証
 * - アカウント復元処理
 * - 期限切れコードのクリーンアップ
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as crypto from "crypto";

import { Timestamp, FieldValue } from "firebase-admin/firestore";

import {
  GDPR_CONSTANTS,
  RecoveryCode,
  RecoveryCodeStatus,
  DeletionRequest,
  DeletionRequestStatus,
} from "../types/gdpr";
import { getFirestore } from "../utils/firestore";
import { logger } from "../utils/logger";

import { hashIpAddress } from "./gdpr/helpers";

// =============================================================================
// コレクション参照
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

// =============================================================================
// 復元コード生成・保存
// =============================================================================

/**
 * 6桁の復元コードを生成
 *
 * 暗号学的に安全な乱数を使用して生成
 *
 * @returns 6桁の数字文字列（000000-999999）
 *
 * @example
 * ```typescript
 * const code = generateRecoveryCode();
 * // "123456"
 * ```
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
 * 復元コードを Firestore に保存
 *
 * 既存の未使用コードは自動的に無効化される
 *
 * @param userId - ユーザー ID
 * @param email - メールアドレス
 * @param code - 復元コード
 * @param deletionRequestId - 関連する削除リクエスト ID（オプション）
 * @param ipAddress - リクエスト元 IP アドレス（オプション、ハッシュ化して保存）
 * @returns 保存されたコード ID と有効期限
 *
 * @example
 * ```typescript
 * const { codeId, expiresAt } = await saveRecoveryCode(
 *   "user123",
 *   "user@example.com",
 *   "123456",
 *   "deletion_req_123"
 * );
 * ```
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
 *
 * @param userId - ユーザー ID
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

// =============================================================================
// 復元コード検証
// =============================================================================

/**
 * 復元コードを検証
 *
 * コードの有効性をチェックし、試行回数を追跡する
 *
 * @param email - メールアドレス
 * @param code - 復元コード
 * @returns 検証結果（有効性、残り試行回数、コード情報、削除リクエスト情報）
 *
 * @example
 * ```typescript
 * const result = await verifyRecoveryCode("user@example.com", "123456");
 * if (result.valid) {
 *   // 復元処理を実行
 * } else {
 *   console.log(`Remaining attempts: ${result.remainingAttempts}`);
 * }
 * ```
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

// =============================================================================
// アカウント復元実行
// =============================================================================

/**
 * アカウント復元を実行
 *
 * 以下の処理を行う:
 * 1. 復元コードの再検証
 * 2. ユーザーの削除予定フラグを解除
 * 3. 削除リクエストをキャンセル
 * 4. 復元コードを使用済みに更新
 *
 * @param email - メールアドレス
 * @param code - 復元コード
 * @returns 復元結果
 *
 * @example
 * ```typescript
 * const result = await executeAccountRecovery("user@example.com", "123456");
 * if (result.success) {
 *   console.log(result.message);
 * }
 * ```
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

// =============================================================================
// 削除予定ユーザー検索
// =============================================================================

/**
 * メールアドレスで削除予定のユーザーを検索
 *
 * 復元可能な削除リクエストを持つユーザーを検索する
 *
 * @param email - メールアドレス
 * @returns ユーザー ID と削除リクエスト（見つからない場合は null）
 *
 * @example
 * ```typescript
 * const result = await findScheduledDeletionByEmail("user@example.com");
 * if (result) {
 *   console.log(`User ${result.userId} is scheduled for deletion`);
 * }
 * ```
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

// =============================================================================
// 復元メール送信
// =============================================================================

/**
 * 復元メールを送信（開発環境ではログ出力）
 *
 * NOTE: 現在は同期関数として実装。メール送信サービス導入時に async に変更すること。
 *
 * @param email - 送信先メールアドレス
 * @param code - 復元コード
 * @param expiresAt - 有効期限
 *
 * @example
 * ```typescript
 * sendRecoveryEmail("user@example.com", "123456", new Date("2024-01-16T10:00:00Z"));
 * ```
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

// =============================================================================
// クリーンアップ
// =============================================================================

/**
 * 期限切れの復元コードをクリーンアップ
 *
 * スケジュール関数から呼び出されることを想定
 *
 * @returns クリーンアップされたコード数
 *
 * @example
 * ```typescript
 * const cleanedCount = await cleanupExpiredRecoveryCodes();
 * console.log(`Cleaned up ${cleanedCount} expired codes`);
 * ```
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
