/**
 * Record Consent API
 *
 * Records user consent for Terms of Service and Privacy Policy.
 * Creates immutable consent records in the consents collection.
 *
 * Legal basis: GDPR Article 7, EDPB Guidelines 05/2020
 * Reference: docs/specs/02_Firestoreデータベース設計書_v3_3.md Section 6
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { logConsentAction } from "../../services/auditLog";
import { logger } from "../../utils/logger";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Current document versions
const CURRENT_TOS_VERSION = "3.2";
const CURRENT_PP_VERSION = "3.1";

/**
 * Consent type
 */
type ConsentType = "tos" | "privacy_policy";

/**
 * Record consent request data
 */
interface RecordConsentRequest {
  consentType: ConsentType;
  accepted: boolean;
}

/**
 * Consent details for audit trail
 */
interface ConsentDetails {
  ipAddress: string;
  userAgent: string;
  deviceType: "mobile" | "tablet" | "desktop";
  platform: "iOS" | "Android" | "Web";
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
 * Get document version for consent type
 */
function getDocumentVersion(consentType: ConsentType): string {
  return consentType === "tos" ? CURRENT_TOS_VERSION : CURRENT_PP_VERSION;
}

/**
 * Validate consent type
 */
function validateConsentType(type: unknown): ConsentType {
  if (type !== "tos" && type !== "privacy_policy") {
    throw new HttpsError(
      "invalid-argument",
      "同意タイプが無効です。'tos' または 'privacy_policy' を指定してください",
    );
  }
  return type;
}

/**
 * Record consent callable function
 *
 * Records user consent for Terms of Service or Privacy Policy.
 * Creates an immutable consent record and updates the user document.
 */
export const recordConsent = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Enable CORS for web clients
  },
  async (request: CallableRequest<RecordConsentRequest>) => {
    // CSRF Protection
    requireCsrfProtection(request);

    // Check authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data;

    // Validate input
    if (data.accepted !== true) {
      throw new HttpsError("invalid-argument", "同意が必要です");
    }

    const consentType = validateConsentType(data.consentType);
    const documentVersion = getDocumentVersion(consentType);

    // Extract request metadata
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);
    const deviceType = detectDeviceType(userAgent);
    const platform = detectPlatform(userAgent);

    logger.info("Recording consent", {
      userId,
      consentType,
      documentVersion,
    });

    try {
      // Check if user exists
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // Check if deletion is scheduled
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されているため、同意を記録できません",
        );
      }

      // Create consent details
      const consentDetails: ConsentDetails = {
        ipAddress: hashIpAddress(clientIp),
        userAgent,
        deviceType,
        platform,
      };

      // Calculate data retention date (7 years from now)
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      // Create consent record
      const consentRecord = {
        userId,
        consentType,
        documentVersion,
        action: "accept",
        consentDetails,
        createdAt: FieldValue.serverTimestamp(),
        dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
      };

      // Prepare user update based on consent type
      const userUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (consentType === "tos") {
        userUpdate.tosAccepted = true;
        userUpdate.tosAcceptedAt = FieldValue.serverTimestamp();
        userUpdate.tosVersion = documentVersion;
      } else {
        userUpdate.ppAccepted = true;
        userUpdate.ppAcceptedAt = FieldValue.serverTimestamp();
        userUpdate.ppVersion = documentVersion;
      }

      // Execute transaction
      await db.runTransaction(async (transaction) => {
        // Create consent record
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, consentRecord);

        // Update user document
        transaction.update(userRef, userUpdate);
      });

      // Log consent action (async)
      logConsentAction({
        userId,
        action: "consent_accept",
        consentType: consentType === "tos" ? "tos" : "pp",
        version: documentVersion,
        ipAddress: clientIp,
        userAgent,
      }).catch((error) => {
        logger.warn("Failed to create audit log for consent", { error });
      });

      logger.info("Consent recorded successfully", {
        userId,
        consentType,
        documentVersion,
      });

      return {
        success: true,
        message: "同意を記録しました",
        consentType,
        documentVersion,
      };
    } catch (error) {
      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to record consent", error as Error, { userId, consentType });
      throw new HttpsError("internal", "同意の記録に失敗しました");
    }
  },
);
