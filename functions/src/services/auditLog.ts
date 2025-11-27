/**
 * Audit Log Service
 *
 * Provides audit logging functionality for security and compliance.
 * Records all significant user actions for GDPR compliance and security monitoring.
 *
 * Based on: docs/specs/03_API設計書_Firebase_Functions_v3_3.md Section 13.3
 *
 * @version 1.0.0
 * @date 2025-11-26
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { logger } from "../utils/logger";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// Types
// =============================================================================

/**
 * Audit log action types
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
  | "data_export_request"
  | "session_create"
  | "session_complete"
  | "settings_update"
  | "subscription_change"
  | "admin_action"
  | "security_event";

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  /** User ID (hashed for privacy) */
  userId: string;
  /** Action type */
  action: AuditAction;
  /** Resource type being acted upon */
  resourceType: string;
  /** Resource ID (if applicable) */
  resourceId?: string;
  /** Previous values (for updates) */
  previousValues?: Record<string, unknown>;
  /** New values (for creates/updates) */
  newValues?: Record<string, unknown>;
  /** Changed fields (for updates) */
  changedFields?: string[];
  /** IP address (hashed) */
  ipAddressHash?: string;
  /** User agent */
  userAgent?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: FieldValue;
  /** Success indicator */
  success: boolean;
  /** Error message (if failed) */
  errorMessage?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Hash sensitive data for privacy
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
 * Sanitize values for logging (remove sensitive data)
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
 * Get changed fields between old and new data
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
// Main Functions
// =============================================================================

/**
 * Create an audit log entry
 *
 * @param entry - The audit log entry to create
 * @returns The created document ID
 */
export async function createAuditLog(
  entry: Omit<AuditLogEntry, "timestamp">,
): Promise<string> {
  try {
    const logEntry: AuditLogEntry = {
      ...entry,
      // Hash user ID for privacy
      userId: hashForPrivacy(entry.userId),
      // Sanitize values
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
    // Log error but don't fail the main operation
    logger.error("Failed to create audit log", error as Error, {
      action: entry.action,
      resourceType: entry.resourceType,
    });

    // Return empty string to indicate failure
    return "";
  }
}

/**
 * Log a profile update action
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
 * Log a consent action
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
 * Log an authentication action
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
 * Log a security event
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
 * Log admin action
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
