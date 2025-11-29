/**
 * 監査ログサービス
 *
 * セキュリティとコンプライアンスのための監査ログ機能を提供
 * GDPR 準拠とセキュリティ監視のためにすべての重要なユーザーアクションを記録
 *
 * 参照: docs/specs/03_API設計書_Firebase_Functions_v3_3.md Section 13.3
 *
 * @version 1.0.0
 * @date 2025-11-26
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// 型定義
// =============================================================================

/**
 * 監査ログアクションタイプ
 */
export type AuditAction =
  | "profile_update"
  | "profile_create"
  | "consent_accept"
  | "consent_withdraw"
  | "login"
  | "logout"
  | "password_change"
  | "password_reset"
  | "account_deletion_request"
  | "account_deletion_cancel"
  | "account_deleted"
  | "account_recovered"
  | "data_export_request"
  | "session_create"
  | "session_complete"
  | "settings_update"
  | "subscription_change"
  | "admin_action"
  | "security_event";

/**
 * 監査ログエントリーインターフェース
 */
export interface AuditLogEntry {
  /** ユーザー ID（プライバシーのためハッシュ化） */
  userId: string;
  /** アクションタイプ */
  action: AuditAction;
  /** 操作対象のリソースタイプ */
  resourceType: string;
  /** リソース ID（該当する場合） */
  resourceId?: string;
  /** 以前の値（更新の場合） */
  previousValues?: Record<string, unknown>;
  /** 新しい値（作成/更新の場合） */
  newValues?: Record<string, unknown>;
  /** 変更されたフィールド（更新の場合） */
  changedFields?: string[];
  /** IP アドレス（ハッシュ化） */
  ipAddressHash?: string;
  /** ユーザーエージェント */
  userAgent?: string;
  /** リクエストメタデータ */
  metadata?: Record<string, unknown>;
  /** タイムスタンプ */
  timestamp: FieldValue;
  /** 成功インジケーター */
  success: boolean;
  /** エラーメッセージ（失敗の場合） */
  errorMessage?: string;
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * プライバシーのために機密データをハッシュ化
 */
function hashForPrivacy(data: string): string {
  const crypto = require("crypto");
  const salt = process.env.AUDIT_SALT || "audit_default_salt";
  return crypto
    .createHash("sha256")
    .update(data + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * ログ用に値をサニタイズ（機密データを削除）
 */
function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "apiKey",
    "creditCard",
    "ssn",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 古いデータと新しいデータ間の変更されたフィールドを取得
 */
function getChangedFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
): string[] {
  const changedFields: string[] = [];

  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

// =============================================================================
// メイン関数
// =============================================================================

/**
 * 監査ログエントリーを作成
 *
 * @param entry - 作成する監査ログエントリー
 * @returns 作成されたドキュメント ID
 */
export async function createAuditLog(
  entry: Omit<AuditLogEntry, "timestamp">,
): Promise<string> {
  try {
    const logEntry: AuditLogEntry = {
      ...entry,
      // プライバシーのためにユーザー ID をハッシュ化
      userId: hashForPrivacy(entry.userId),
      // 値をサニタイズ
      previousValues: entry.previousValues
        ? sanitizeForLog(entry.previousValues)
        : undefined,
      newValues: entry.newValues
        ? sanitizeForLog(entry.newValues)
        : undefined,
      timestamp: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("auditLogs").add(logEntry);

    logger.info("Audit log created", {
      logId: docRef.id,
      action: entry.action,
      resourceType: entry.resourceType,
      success: entry.success,
    });

    return docRef.id;
  } catch (error) {
    // エラーをログ出力するがメイン操作は失敗させない
    logger.error("Failed to create audit log", error as Error, {
      action: entry.action,
      resourceType: entry.resourceType,
    });

    // 失敗を示す空文字列を返す
    return "";
  }
}

/**
 * プロフィール更新アクションをログ
 */
export async function logProfileUpdate(params: {
  userId: string;
  previousValues?: Record<string, unknown>;
  newValues: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return createAuditLog({
    userId: params.userId,
    action: "profile_update",
    resourceType: "user_profile",
    resourceId: params.userId,
    previousValues: params.previousValues,
    newValues: params.newValues,
    changedFields: params.previousValues
      ? getChangedFields(params.previousValues, params.newValues)
      : Object.keys(params.newValues),
    ipAddressHash: params.ipAddress ? hashForPrivacy(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
  });
}

/**
 * 同意アクションをログ
 */
export async function logConsentAction(params: {
  userId: string;
  action: "consent_accept" | "consent_withdraw";
  consentType: "tos" | "pp";
  version: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  return createAuditLog({
    userId: params.userId,
    action: params.action,
    resourceType: "consent",
    resourceId: `${params.consentType}_${params.version}`,
    newValues: {
      consentType: params.consentType,
      version: params.version,
    },
    ipAddressHash: params.ipAddress ? hashForPrivacy(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: true,
  });
}

/**
 * 認証アクションをログ
 */
export async function logAuthAction(params: {
  userId: string;
  action: "login" | "logout" | "password_change" | "password_reset";
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<string> {
  return createAuditLog({
    userId: params.userId,
    action: params.action,
    resourceType: "authentication",
    metadata: params.method ? { method: params.method } : undefined,
    ipAddressHash: params.ipAddress ? hashForPrivacy(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
  });
}

/**
 * セキュリティイベントをログ
 */
export async function logSecurityEvent(params: {
  userId: string;
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  return createAuditLog({
    userId: params.userId,
    action: "security_event",
    resourceType: "security",
    metadata: {
      eventType: params.eventType,
      severity: params.severity,
      ...params.details,
    },
    ipAddressHash: params.ipAddress ? hashForPrivacy(params.ipAddress) : undefined,
    userAgent: params.userAgent,
    success: true,
  });
}

/**
 * 管理者アクションをログ
 */
export async function logAdminAction(params: {
  adminUserId: string;
  targetUserId: string;
  action: string;
  details: Record<string, unknown>;
}): Promise<string> {
  return createAuditLog({
    userId: params.adminUserId,
    action: "admin_action",
    resourceType: "admin",
    resourceId: params.targetUserId,
    newValues: {
      adminAction: params.action,
      targetUser: hashForPrivacy(params.targetUserId),
      ...params.details,
    },
    success: true,
  });
}
