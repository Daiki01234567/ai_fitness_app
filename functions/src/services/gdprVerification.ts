/**
 * GDPR 削除検証・証明書サービス
 *
 * 削除の検証と証明書の生成・管理機能を提供
 * - 全サービスにわたる削除検証
 * - 削除証明書の生成と署名
 * - 証明書の取得と検証
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as crypto from "crypto";

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import {
  DeletionVerificationResult,
  DeletionCertificate,
} from "../types/gdpr";
import {
  getFirestore,
  userRef,
  sessionsCollection,
  consentsCollection,
} from "../utils/firestore";
import { logger } from "../utils/logger";

import { verifyStorageDeletion } from "./gdprStorage";
import { verifyBigQueryDeletion } from "./gdprBigQuery";
import {
  generateSignature,
  hashUserId,
} from "./gdpr/helpers";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// 削除検証関数
// =============================================================================

/**
 * Firestore データの削除を検証
 *
 * 指定されたスコープのデータが削除されているかを確認する
 *
 * @param userId - 検証対象のユーザー ID
 * @param scope - 削除スコープ
 * @returns 検証結果（verified: 削除完了、remainingData: 残存データ）
 *
 * @example
 * ```typescript
 * const { verified, remainingData } = await verifyFirestoreDeletion("user123", ["all"]);
 * if (!verified) {
 *   console.error("Remaining data:", remainingData);
 * }
 * ```
 */
export async function verifyFirestoreDeletion(
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

    logger.info("Firestore deletion verification completed", {
      userId,
      scope,
      verified,
      remainingData,
    });

    return { verified, remainingData };
  } catch (error) {
    logger.error("Failed to verify Firestore deletion", error as Error, { userId, scope });
    throw error;
  }
}

/**
 * Firebase Auth ユーザーの削除を検証
 *
 * @param userId - 検証対象のユーザー ID
 * @returns 削除が完了している場合は true
 *
 * @example
 * ```typescript
 * const isAuthDeleted = await verifyAuthDeletion("user123");
 * ```
 */
export async function verifyAuthDeletion(userId: string): Promise<boolean> {
  try {
    await admin.auth().getUser(userId);
    // If getUser succeeds, user still exists
    return false;
  } catch {
    // User not found - deletion verified
    return true;
  }
}

/**
 * 全サービスにわたる削除を検証
 *
 * Firestore、Storage、BigQuery、Auth の全てで削除が完了しているかを検証する
 *
 * @param userId - 検証対象のユーザー ID
 * @param scope - 削除スコープ
 * @returns 詳細な検証結果
 *
 * @example
 * ```typescript
 * const result = await verifyCompleteDeletion("user123", ["all"]);
 * if (result.verified) {
 *   console.log("All data has been deleted");
 * } else {
 *   console.error("Remaining:", result.remainingData);
 * }
 * ```
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

  // Firestore verification
  const { verified: firestoreVerified, remainingData: firestoreRemaining } =
    await verifyFirestoreDeletion(userId, scope);

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
  const authVerified = await verifyAuthDeletion(userId);
  if (!authVerified) {
    remainingData.push("auth:user-record");
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
 * 削除証明書コレクション参照
 */
function deletionCertificatesCollection() {
  return getFirestore().collection("deletionCertificates");
}

/**
 * 証明書 ID を生成
 *
 * @returns 一意の証明書 ID
 */
function generateCertificateId(): string {
  return `cert_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * 削除証明書を生成
 *
 * GDPR 準拠のため、削除完了を証明する署名付き証明書を生成する
 *
 * @param userId - 削除されたユーザー ID
 * @param deletionRequestId - 削除リクエスト ID
 * @param deletedData - 削除されたデータの詳細
 * @param verificationResult - 検証結果
 * @returns 削除証明書
 *
 * @example
 * ```typescript
 * const certificate = await generateDeletionCertificate(
 *   "user123",
 *   "req_abc123",
 *   {
 *     firestoreCollections: ["users", "sessions"],
 *     storageFilesCount: 5,
 *     bigqueryRowsDeleted: 100,
 *     authDeleted: true,
 *   },
 *   { firestore: true, storage: true, bigquery: true, auth: true }
 * );
 * ```
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
  const certificateId = generateCertificateId();
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
  await deletionCertificatesCollection().doc(certificateId).set({
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
 *
 * @example
 * ```typescript
 * const certificate = await getDeletionCertificate("cert_123456_abcd");
 * if (certificate) {
 *   console.log(`Certificate issued at: ${certificate.issuedAt}`);
 * }
 * ```
 */
export async function getDeletionCertificate(
  certificateId: string,
): Promise<DeletionCertificate | null> {
  const doc = await deletionCertificatesCollection().doc(certificateId).get();

  if (!doc.exists) {
    logger.info("Deletion certificate not found", { certificateId });
    return null;
  }

  return doc.data() as DeletionCertificate;
}

/**
 * ユーザーの削除証明書を検索
 *
 * @param userIdHash - ハッシュ化されたユーザー ID
 * @returns 削除証明書の配列
 *
 * @example
 * ```typescript
 * const userHash = hashUserId("user123");
 * const certificates = await findCertificatesByUserHash(userHash);
 * ```
 */
export async function findCertificatesByUserHash(
  userIdHash: string,
): Promise<DeletionCertificate[]> {
  const snapshot = await deletionCertificatesCollection()
    .where("userIdHash", "==", userIdHash)
    .orderBy("issuedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => doc.data() as DeletionCertificate);
}

/**
 * 削除証明書の署名を検証
 *
 * 証明書の改ざんを検出するため、署名を検証する
 *
 * @param certificate - 検証する証明書
 * @returns 署名が有効な場合は true
 *
 * @example
 * ```typescript
 * const certificate = await getDeletionCertificate("cert_123");
 * if (certificate && verifyCertificateSignature(certificate)) {
 *   console.log("Certificate is valid");
 * }
 * ```
 */
export function verifyCertificateSignature(certificate: DeletionCertificate): boolean {
  // Recreate the certificate data that was signed
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

  const isValid = certificate.signature === expectedSignature;

  if (!isValid) {
    logger.warn("Certificate signature verification failed", {
      certificateId: certificate.certificateId,
    });
  }

  return isValid;
}

/**
 * 証明書の完全な検証を実行
 *
 * 署名の検証と証明書の存在確認を行う
 *
 * @param certificateId - 証明書 ID
 * @returns 検証結果
 *
 * @example
 * ```typescript
 * const result = await validateCertificate("cert_123");
 * if (result.valid) {
 *   console.log("Certificate is authentic");
 * }
 * ```
 */
export async function validateCertificate(
  certificateId: string,
): Promise<{
  valid: boolean;
  certificate: DeletionCertificate | null;
  error?: string;
}> {
  const certificate = await getDeletionCertificate(certificateId);

  if (!certificate) {
    return {
      valid: false,
      certificate: null,
      error: "証明書が見つかりません",
    };
  }

  if (!verifyCertificateSignature(certificate)) {
    return {
      valid: false,
      certificate,
      error: "証明書の署名が無効です",
    };
  }

  return {
    valid: true,
    certificate,
  };
}
