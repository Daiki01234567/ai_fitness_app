/**
 * Revoke Consent API
 *
 * Revokes user consent for Terms of Service or Privacy Policy.
 * Triggers force logout and optionally initiates data deletion.
 *
 * Legal basis: GDPR Article 7(3), EDPB Guidelines 05/2020
 * Reference: docs/specs/00_要件定義書_v3_3.md (FR-002-1)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireStrictCsrfProtection } from "../../middleware/csrf";
import { logConsentAction, logSecurityEvent } from "../../services/auditLog";
import { logger } from "../../utils/logger";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Consent type
 */
type ConsentType = "tos" | "privacy_policy" | "all";

/**
 * Revoke consent request data
 */
interface RevokeConsentRequest {
  consentType: ConsentType;
  requestDataDeletion?: boolean;
  reason?: string;
}

/**
 * Extract client IP from request
 */
function getClientIp(rawRequest: unknown): string {
  if (!rawRequest || typeof rawRequest !== "object") {
    return "unknown";
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  const xForwardedFor = headers?.["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = headers?.["x-real-ip"];
  if (typeof xRealIp === "string") {
    return xRealIp;
  }

  return "unknown";
}

/**
 * Extract user agent from request
 */
function getUserAgent(rawRequest: unknown): string {
  if (!rawRequest || typeof rawRequest !== "object") {
    return "unknown";
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  return headers?.["user-agent"] || "unknown";
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Detect platform from user agent
 */
function detectPlatform(userAgent: string): "iOS" | "Android" | "Web" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    return "iOS";
  }
  if (ua.includes("android")) {
    return "Android";
  }
  return "Web";
}

/**
 * Hash IP address for privacy
 */
function hashIpAddress(ip: string): string {
  const crypto = require("crypto");
  const salt = process.env.CONSENT_SALT || "consent_default_salt";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Validate consent type for revocation
 */
function validateConsentType(type: unknown): ConsentType {
  if (type !== "tos" && type !== "privacy_policy" && type !== "all") {
    throw new HttpsError(
      "invalid-argument",
      "同意タイプが無効です。'tos', 'privacy_policy', または 'all' を指定してください",
    );
  }
  return type;
}

/**
 * Revoke consent callable function
 *
 * Revokes user consent and triggers force logout.
 * Optionally creates a data deletion request.
 */
export const revokeConsent = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true, // Enable CORS for web clients
  },
  async (request: CallableRequest<RevokeConsentRequest>) => {
    // Strict CSRF Protection for sensitive operation
    requireStrictCsrfProtection(request);

    // Check authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data;

    const consentType = validateConsentType(data.consentType);
    const requestDataDeletion = data.requestDataDeletion === true;
    const reason = typeof data.reason === "string" ? data.reason.substring(0, 500) : undefined;

    // Extract request metadata
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);
    const deviceType = detectDeviceType(userAgent);
    const platform = detectPlatform(userAgent);

    logger.info("Revoking consent", {
      userId,
      consentType,
      requestDataDeletion,
    });

    try {
      // Check if user exists
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // Check if already deleted
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が既に予定されています",
        );
      }

      // Calculate data retention date (7 years from now)
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      // Consent details for revocation record
      const consentDetails = {
        ipAddress: hashIpAddress(clientIp),
        userAgent,
        deviceType,
        platform,
      };

      // Prepare user update
      const userUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        forceLogoutAt: FieldValue.serverTimestamp(),
      };

      // Consent records to create
      const consentRecords: Record<string, unknown>[] = [];

      if (consentType === "tos" || consentType === "all") {
        userUpdate.tosAccepted = false;
        userUpdate.tosAcceptedAt = null;

        consentRecords.push({
          userId,
          consentType: "tos",
          documentVersion: userData?.tosVersion || "unknown",
          action: "revoke",
          consentDetails,
          reason,
          createdAt: FieldValue.serverTimestamp(),
          dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
        });
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        userUpdate.ppAccepted = false;
        userUpdate.ppAcceptedAt = null;

        consentRecords.push({
          userId,
          consentType: "privacy_policy",
          documentVersion: userData?.ppVersion || "unknown",
          action: "revoke",
          consentDetails,
          reason,
          createdAt: FieldValue.serverTimestamp(),
          dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
        });
      }

      // If data deletion requested, create deletion request
      let deletionRequestId: string | undefined;
      if (requestDataDeletion) {
        const scheduledDeletionDate = new Date();
        scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

        userUpdate.deletionScheduled = true;
        userUpdate.scheduledDeletionDate = Timestamp.fromDate(scheduledDeletionDate);
      }

      // Execute transaction
      await db.runTransaction(async (transaction) => {
        // Create consent revocation records
        for (const record of consentRecords) {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, record);
        }

        // Create data deletion request if requested
        if (requestDataDeletion) {
          const scheduledDeletionDate = new Date();
          scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

          const deletionRef = db.collection("dataDeletionRequests").doc();
          deletionRequestId = deletionRef.id;

          transaction.set(deletionRef, {
            userId,
            status: "pending",
            requestedAt: FieldValue.serverTimestamp(),
            scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
            reason: reason || "consent_revoked",
            exportRequested: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Update user document
        transaction.update(userRef, userUpdate);
      });

      // Set force logout custom claim
      try {
        await auth.setCustomUserClaims(userId, {
          ...(request.auth.token || {}),
          forceLogout: true,
          forceLogoutAt: Date.now(),
        });
      } catch (claimError) {
        logger.error("Failed to set force logout claim", claimError as Error, { userId });
        // Continue - the forceLogoutAt field in Firestore will also trigger logout
      }

      // Log consent withdrawal (async)
      const auditPromises: Promise<string>[] = [];

      if (consentType === "tos" || consentType === "all") {
        auditPromises.push(
          logConsentAction({
            userId,
            action: "consent_withdraw",
            consentType: "tos",
            version: userData?.tosVersion || "unknown",
            ipAddress: clientIp,
            userAgent,
          }),
        );
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        auditPromises.push(
          logConsentAction({
            userId,
            action: "consent_withdraw",
            consentType: "pp",
            version: userData?.ppVersion || "unknown",
            ipAddress: clientIp,
            userAgent,
          }),
        );
      }

      // Log security event for consent revocation
      auditPromises.push(
        logSecurityEvent({
          userId,
          eventType: "consent_revoked",
          severity: "medium",
          details: {
            consentType,
            requestDataDeletion,
            deletionRequestId,
          },
          ipAddress: clientIp,
          userAgent,
        }),
      );

      Promise.all(auditPromises).catch((error) => {
        logger.warn("Failed to create audit logs for consent revocation", { error });
      });

      logger.info("Consent revoked successfully", {
        userId,
        consentType,
        requestDataDeletion,
        deletionRequestId,
      });

      return {
        success: true,
        message: "同意を撤回しました。ログアウトされます。",
        consentType,
        forceLogout: true,
        deletionScheduled: requestDataDeletion,
        deletionRequestId,
      };
    } catch (error) {
      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to revoke consent", error as Error, { userId, consentType });
      throw new HttpsError("internal", "同意の撤回に失敗しました");
    }
  },
);
