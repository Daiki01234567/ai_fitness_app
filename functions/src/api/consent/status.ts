/**
 * Get Consent Status API
 *
 * Retrieves current consent status and consent history for a user.
 *
 * Legal basis: GDPR Article 7(1), 15(1)(a)
 * Reference: docs/specs/00_要件定義書_v3_3.md (FR-024)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
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
 * Consent status request data
 */
interface GetConsentStatusRequest {
  includeHistory?: boolean;
  historyLimit?: number;
}

/**
 * Consent status response
 */
interface ConsentStatus {
  tosAccepted: boolean;
  tosAcceptedAt: string | null;
  tosVersion: string | null;
  tosCurrentVersion: string;
  tosNeedsUpdate: boolean;
  ppAccepted: boolean;
  ppAcceptedAt: string | null;
  ppVersion: string | null;
  ppCurrentVersion: string;
  ppNeedsUpdate: boolean;
  allConsentsValid: boolean;
  needsConsent: boolean;
}

/**
 * Consent history entry
 */
interface ConsentHistoryEntry {
  consentType: string;
  action: string;
  documentVersion: string;
  createdAt: string;
}

/**
 * Get consent status callable function
 *
 * Retrieves the current consent status for the authenticated user.
 * Optionally includes consent history.
 */
export const getConsentStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Enable CORS for web clients
  },
  async (request: CallableRequest<GetConsentStatusRequest>) => {
    // CSRF Protection
    requireCsrfProtection(request);

    // Check authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data || {};
    const includeHistory = data.includeHistory === true;
    const historyLimit = Math.min(Math.max(data.historyLimit || 10, 1), 100);

    logger.info("Getting consent status", {
      userId,
      includeHistory,
    });

    try {
      // Get user document
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data()!;

      // Build consent status
      const tosAccepted = userData.tosAccepted === true;
      const ppAccepted = userData.ppAccepted === true;
      const tosVersion = userData.tosVersion || null;
      const ppVersion = userData.ppVersion || null;

      // Check if updates are needed
      const tosNeedsUpdate = tosAccepted && tosVersion !== CURRENT_TOS_VERSION;
      const ppNeedsUpdate = ppAccepted && ppVersion !== CURRENT_PP_VERSION;

      const consentStatus: ConsentStatus = {
        tosAccepted,
        tosAcceptedAt: userData.tosAcceptedAt?.toDate?.()?.toISOString() || null,
        tosVersion,
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate,
        ppAccepted,
        ppAcceptedAt: userData.ppAcceptedAt?.toDate?.()?.toISOString() || null,
        ppVersion,
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate,
        allConsentsValid: tosAccepted && ppAccepted && !tosNeedsUpdate && !ppNeedsUpdate,
        needsConsent: !tosAccepted || !ppAccepted,
      };

      // Get consent history if requested
      let history: ConsentHistoryEntry[] = [];
      if (includeHistory) {
        const consentsSnapshot = await db
          .collection("consents")
          .where("userId", "==", userId)
          .orderBy("createdAt", "desc")
          .limit(historyLimit)
          .get();

        history = consentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            consentType: data.consentType,
            action: data.action,
            documentVersion: data.documentVersion,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || "",
          };
        });
      }

      logger.info("Consent status retrieved", {
        userId,
        tosAccepted,
        ppAccepted,
        needsConsent: consentStatus.needsConsent,
      });

      return {
        success: true,
        status: consentStatus,
        history: includeHistory ? history : undefined,
      };
    } catch (error) {
      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to get consent status", error as Error, { userId });
      throw new HttpsError("internal", "同意状態の取得に失敗しました");
    }
  },
);
