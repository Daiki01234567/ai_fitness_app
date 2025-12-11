/**
 * 管理者認証ユーティリティ
 *
 * 管理者認証基盤のヘルパー関数
 * - ロール別権限取得
 * - ロール判定
 * - IPアドレス検証
 * - 監査ログ記録
 *
 * 参照: docs/common/tickets/041-admin-auth.md
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import {
  AdminRole,
  AdminPermissionType,
  AdminAuditAction,
  AdminAuditLog,
  IpAllowlistDocument,
  IpValidationResult,
  MfaValidationResult,
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_ROLE_HIERARCHY,
  ADMIN_AUTH_CONSTANTS,
} from "../types/admin";

import { getFirestore } from "./firestore";
import { logger } from "./logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// =============================================================================
// ロール・権限関連
// =============================================================================

/**
 * ロール別の権限リストを取得
 *
 * @param role - 管理者ロール
 * @returns 権限リスト
 */
export function getPermissionsForRole(role: AdminRole): AdminPermissionType[] {
  return ADMIN_ROLE_PERMISSIONS[role] || [];
}

/**
 * 指定したロールが必要なロールレベル以上かを判定
 *
 * @param currentRole - 現在のロール
 * @param requiredRole - 必要なロール
 * @returns 必要なロールレベル以上ならtrue
 */
export function hasRequiredRole(currentRole: AdminRole, requiredRole: AdminRole): boolean {
  const currentLevel = ADMIN_ROLE_HIERARCHY[currentRole] || 0;
  const requiredLevel = ADMIN_ROLE_HIERARCHY[requiredRole] || 0;
  return currentLevel >= requiredLevel;
}

/**
 * 指定したロールが有効な管理者ロールかを判定
 *
 * @param role - チェックするロール
 * @returns 有効な管理者ロールならtrue
 */
export function isValidAdminRole(role: unknown): role is AdminRole {
  return (
    typeof role === "string" &&
    (role === "superAdmin" || role === "admin" || role === "readOnlyAdmin")
  );
}

/**
 * 指定した権限を持っているかを判定
 *
 * @param role - 管理者ロール
 * @param permission - 必要な権限
 * @returns 権限を持っていればtrue
 */
export function hasPermission(role: AdminRole, permission: AdminPermissionType): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

// =============================================================================
// IPアドレス検証
// =============================================================================

/**
 * IPアドレスが許可リストに含まれるかを判定
 *
 * @param ip - 検証するIPアドレス
 * @returns IPアドレス検証結果
 */
export async function isAllowedIp(ip: string | undefined): Promise<IpValidationResult> {
  // IPアドレスが取得できない場合
  if (!ip) {
    return {
      allowed: false,
      errorMessage: "IPアドレスを取得できません",
    };
  }

  try {
    const doc = await db.doc(ADMIN_AUTH_CONSTANTS.IP_ALLOWLIST_DOC_PATH).get();

    // 許可リストが設定されていない場合は許可（開発環境対応）
    if (!doc.exists) {
      logger.warn("IP allowlist not configured, allowing all IPs");
      return {
        allowed: true,
        matchedRule: "NO_ALLOWLIST_CONFIGURED",
      };
    }

    const data = doc.data() as IpAllowlistDocument;

    // 許可リストが無効化されている場合は全て許可
    if (!data.enabled) {
      return {
        allowed: true,
        matchedRule: "ALLOWLIST_DISABLED",
      };
    }

    // 完全一致チェック
    if (data.allowedIps.includes(ip)) {
      return {
        allowed: true,
        matchedRule: `IP:${ip}`,
      };
    }

    // CIDR範囲チェック
    for (const cidr of data.allowedCidrs) {
      if (isIpInCidr(ip, cidr)) {
        return {
          allowed: true,
          matchedRule: `CIDR:${cidr}`,
        };
      }
    }

    // 許可リストに含まれない
    return {
      allowed: false,
      errorMessage: "このIPアドレスからのアクセスは許可されていません",
    };
  } catch (error) {
    logger.error("IP allowlist check failed", error as Error, { ip });
    // エラー時は拒否（セキュリティ優先）
    return {
      allowed: false,
      errorMessage: "IP許可リストの確認中にエラーが発生しました",
    };
  }
}

/**
 * IPアドレスがCIDR範囲内かを判定
 *
 * @param ip - IPアドレス
 * @param cidr - CIDR表記（例: 192.168.1.0/24）
 * @returns CIDR範囲内ならtrue
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * IPアドレスを数値に変換
 *
 * @param ip - IPアドレス（ドット表記）
 * @returns 数値表現
 */
function ipToNumber(ip: string): number {
  const parts = ip.split(".");
  return (
    (parseInt(parts[0], 10) << 24) |
    (parseInt(parts[1], 10) << 16) |
    (parseInt(parts[2], 10) << 8) |
    parseInt(parts[3], 10)
  );
}

/**
 * IPアドレス形式の検証
 *
 * @param ip - 検証するIPアドレス
 * @returns 有効なIPv4形式ならtrue
 */
export function isValidIpAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * CIDR形式の検証
 *
 * @param cidr - 検証するCIDR表記
 * @returns 有効なCIDR形式ならtrue
 */
export function isValidCidr(cidr: string): boolean {
  const parts = cidr.split("/");
  if (parts.length !== 2) {
    return false;
  }

  const [ip, bits] = parts;
  if (!isValidIpAddress(ip)) {
    return false;
  }

  const bitsNum = parseInt(bits, 10);
  return !isNaN(bitsNum) && bitsNum >= 0 && bitsNum <= 32;
}

// =============================================================================
// MFA検証
// =============================================================================

/**
 * ユーザーのMFA設定状況を検証
 *
 * @param uid - ユーザーID
 * @returns MFA検証結果
 */
export async function verifyMfaStatus(uid: string): Promise<MfaValidationResult> {
  try {
    const user = await admin.auth().getUser(uid);

    // Firebase AuthのmultiFactor情報を取得
    const enrolledFactors = user.multiFactor?.enrolledFactors || [];
    const isEnrolled = enrolledFactors.length > 0;

    // MFA要素のタイプを取得
    const factorTypes = enrolledFactors.map((factor) => factor.factorId);

    return {
      enrolled: isEnrolled,
      verified: isEnrolled, // ログイン時にMFAを通過していれば検証済み
      enrolledFactors: factorTypes,
    };
  } catch (error) {
    logger.error("MFA status verification failed", error as Error, { uid });
    return {
      enrolled: false,
      verified: false,
      errorMessage: "MFA状態の確認中にエラーが発生しました",
    };
  }
}

/**
 * MFAが必須かどうかをチェック
 *
 * 管理者はMFA必須のため、常にtrueを返す
 *
 * @returns MFAが必須ならtrue
 */
export function isMfaRequired(): boolean {
  // 管理者はMFA必須（NFR-038）
  return true;
}

// =============================================================================
// 監査ログ
// =============================================================================

/**
 * 管理者操作の監査ログを記録
 *
 * @param params - ログパラメータ
 * @returns 作成されたログID
 */
export async function logAdminAuthAction(params: {
  performedBy: string;
  performerRole: AdminRole;
  action: AdminAuditAction;
  targetUserId?: string;
  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  performerIp?: string;
}): Promise<string> {
  try {
    const logEntry: Omit<AdminAuditLog, "id" | "timestamp"> & { timestamp: FieldValue } = {
      performedBy: params.performedBy,
      performerRole: params.performerRole,
      performerIp: params.performerIp,
      action: params.action,
      targetUserId: params.targetUserId,
      details: params.details,
      success: params.success,
      errorMessage: params.errorMessage,
      timestamp: FieldValue.serverTimestamp(),
    };

    // undefined値を除外
    const cleanEntry = Object.fromEntries(
      Object.entries(logEntry).filter(([, v]) => v !== undefined),
    );

    const docRef = await db.collection(ADMIN_AUTH_CONSTANTS.AUDIT_LOG_COLLECTION).add(cleanEntry);

    logger.info("Admin audit log created", {
      logId: docRef.id,
      action: params.action,
      performedBy: params.performedBy,
      targetUserId: params.targetUserId,
      success: params.success,
    });

    return docRef.id;
  } catch (error) {
    logger.error("Failed to create admin audit log", error as Error, {
      action: params.action,
      performedBy: params.performedBy,
    });
    return "";
  }
}

// =============================================================================
// クレーム有効期限
// =============================================================================

/**
 * クレームの有効期限を計算
 *
 * @param expirationDays - 有効期限（日数）
 * @returns 有効期限のUnixタイムスタンプ（ミリ秒）
 */
export function calculateClaimsExpiration(expirationDays?: number): number {
  const days = expirationDays || ADMIN_AUTH_CONSTANTS.DEFAULT_CLAIMS_EXPIRATION_DAYS;
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

/**
 * クレームが期限切れかどうかをチェック
 *
 * @param expiresAt - 有効期限（Unixタイムスタンプ、ミリ秒）
 * @returns 期限切れならtrue
 */
export function isClaimsExpired(expiresAt?: number): boolean {
  if (!expiresAt) {
    return false; // 有効期限が設定されていない場合は期限切れではない
  }
  return Date.now() > expiresAt;
}

// =============================================================================
// セキュリティアラート
// =============================================================================

/**
 * セキュリティアラートを送信
 *
 * 許可されていないIPからのアクセスなど、セキュリティイベントを記録
 *
 * @param params - アラートパラメータ
 */
export async function sendSecurityAlert(params: {
  type: "UNAUTHORIZED_IP_ACCESS" | "MFA_NOT_ENROLLED" | "CLAIMS_EXPIRED" | "INVALID_ROLE";
  userId?: string;
  ip?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  logger.security({
    eventType: params.type,
    severity: "high",
    description: `Security alert: ${params.type}`,
    sourceIp: params.ip,
    indicators: {
      userId: params.userId,
      ...params.details,
    },
  });

  // 将来的にはSlack/Email通知を実装
  // TODO: Implement notification to admin channel
}

// =============================================================================
// リクエストからIP取得
// =============================================================================

/**
 * リクエストからIPアドレスを抽出
 *
 * Cloud Functions環境ではX-Forwarded-Forヘッダーを使用
 *
 * @param rawRequest - 生のHTTPリクエスト
 * @returns IPアドレス
 */
export function extractIpFromRequest(rawRequest?: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  if (!rawRequest) {
    return undefined;
  }

  // X-Forwarded-Forヘッダーから取得（プロキシ経由の場合）
  const forwardedFor = rawRequest.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // 最初のIPが元のクライアントIP
    return ips.split(",")[0].trim();
  }

  // 直接接続の場合
  return rawRequest.ip;
}
