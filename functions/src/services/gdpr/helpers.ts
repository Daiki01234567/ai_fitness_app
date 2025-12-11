/**
 * GDPR ヘルパー関数
 *
 * 暗号化、ハッシュ化、ユーティリティ関数を提供
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 */

import * as crypto from "crypto";

import { Timestamp } from "firebase-admin/firestore";

// =============================================================================
// 定数
// =============================================================================

/**
 * デフォルトの監査用ソルト
 * 本番環境では環境変数 AUDIT_SALT を設定すること
 */
export const DEFAULT_AUDIT_SALT = "audit_default_salt";

/**
 * デフォルトの復元コード用ソルト
 * 本番環境では環境変数 AUDIT_SALT を設定すること
 */
export const DEFAULT_RECOVERY_SALT = "recovery_default_salt";

/**
 * デフォルトの証明書署名シークレット
 * 本番環境では環境変数 CERTIFICATE_SIGNING_SECRET を設定すること
 */
export const DEFAULT_CERTIFICATE_SECRET = "gdpr_certificate_default_secret";

// =============================================================================
// タイムスタンプ変換
// =============================================================================

/**
 * Firestore タイムスタンプから ISO 文字列への安全な変換
 *
 * @param timestamp - Firestore Timestamp または undefined/null
 * @returns ISO 8601 形式の日時文字列、または空文字列
 *
 * @example
 * ```typescript
 * const isoString = safeTimestampToString(doc.data().createdAt);
 * // "2024-01-15T10:30:00.000Z" または ""
 * ```
 */
export function safeTimestampToString(timestamp: Timestamp | undefined | null): string {
  if (!timestamp) {
    return "";
  }
  return timestamp.toDate().toISOString();
}

// =============================================================================
// 暗号化・ハッシュ化関数
// =============================================================================

/**
 * 署名を生成（HMAC-SHA256）
 *
 * 削除証明書などの改ざん検知に使用
 *
 * @param data - 署名対象のデータ文字列
 * @returns HMAC-SHA256 署名（16進数文字列）
 *
 * @example
 * ```typescript
 * const signature = generateSignature(JSON.stringify(certificateData));
 * ```
 */
export function generateSignature(data: string): string {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET || DEFAULT_CERTIFICATE_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}

/**
 * ユーザー ID をハッシュ化
 *
 * 監査ログや証明書でユーザーを特定可能にしつつ、直接の ID 露出を防ぐ
 *
 * @param userId - ハッシュ化対象のユーザー ID
 * @returns SHA-256 ハッシュの先頭16文字
 *
 * @example
 * ```typescript
 * const userIdHash = hashUserId("user123");
 * // "a1b2c3d4e5f6g7h8"
 * ```
 */
export function hashUserId(userId: string): string {
  const salt = process.env.AUDIT_SALT || DEFAULT_AUDIT_SALT;
  return crypto
    .createHash("sha256")
    .update(userId + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * IP アドレスをハッシュ化
 *
 * 復元コードの不正利用検知に使用。直接の IP アドレス保存を避ける
 *
 * @param ipAddress - ハッシュ化対象の IP アドレス
 * @returns SHA-256 ハッシュの先頭16文字
 *
 * @example
 * ```typescript
 * const ipHash = hashIpAddress("192.168.1.1");
 * ```
 */
export function hashIpAddress(ipAddress: string): string {
  const salt = process.env.AUDIT_SALT || DEFAULT_RECOVERY_SALT;
  return crypto
    .createHash("sha256")
    .update(ipAddress + salt)
    .digest("hex")
    .substring(0, 16);
}

// =============================================================================
// バケット名取得関数
// =============================================================================

/**
 * エクスポート用バケット名を取得
 *
 * @returns Cloud Storage バケット名
 */
export function getExportBucketName(): string {
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  return `${projectId}-gdpr-exports`;
}

/**
 * ユーザーアップロード用バケット名を取得
 *
 * @returns Cloud Storage バケット名
 */
export function getUserUploadsBucketName(): string {
  const projectId = process.env.GCLOUD_PROJECT || "tokyo-list-478804-e5";
  return `${projectId}-user-uploads`;
}
