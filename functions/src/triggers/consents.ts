/**
 * Consent Firestore Triggers
 *
 * Handles consent-related document changes.
 * Primarily used for consent withdrawal notifications.
 *
 * Legal basis: GDPR Article 7(3)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { logger } from "../utils/logger";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Trigger: On consent record created
 *
 * When a consent revocation is recorded, ensures the user
 * is properly logged out and notified.
 */
export const onConsentCreated = onDocumentCreated(
  {
    document: "consents/{consentId}",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data in consent creation event");
      return;
    }

    const consentData = snapshot.data();
    const consentId = event.params.consentId;

    // Only process revocations
    if (consentData.action !== "revoke") {
      logger.info("Consent action is not revoke, skipping", {
        consentId,
        action: consentData.action,
      });
      return;
    }

    const userId = consentData.userId;
    const consentType = consentData.consentType;

    logger.info("Processing consent revocation", {
      consentId,
      userId,
      consentType,
    });

    try {
      // Verify user has force logout flag set
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        logger.warn("User not found for consent revocation", { userId });
        return;
      }

      const userData = userDoc.data()!;

      // If forceLogoutAt is not set, set it now
      if (!userData.forceLogoutAt) {
        await userRef.update({
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("Set forceLogoutAt for user", { userId });
      }

      // Ensure custom claims are set
      try {
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};

        if (!currentClaims.forceLogout) {
          await auth.setCustomUserClaims(userId, {
            ...currentClaims,
            forceLogout: true,
            forceLogoutAt: Date.now(),
          });

          logger.info("Set forceLogout custom claim", { userId });
        }
      } catch (authError) {
        logger.error("Failed to set custom claims", authError as Error, { userId });
      }

      // Create notification for the user
      const notificationRef = db.collection("notifications").doc();
      await notificationRef.set({
        userId,
        type: "system",
        title: "同意撤回完了",
        body: consentType === "tos"
          ? "利用規約への同意が撤回されました。アプリを使用するには再度同意が必要です。"
          : "プライバシーポリシーへの同意が撤回されました。アプリを使用するには再度同意が必要です。",
        data: {
          consentId,
          consentType,
        },
        read: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Created notification for consent revocation", {
        userId,
        consentId,
      });

      // Revoke all refresh tokens to force re-authentication
      try {
        await auth.revokeRefreshTokens(userId);
        logger.info("Revoked refresh tokens for user", { userId });
      } catch (revokeError) {
        logger.warn("Failed to revoke refresh tokens", { error: revokeError, userId });
      }

      logger.info("Consent revocation processed successfully", {
        consentId,
        userId,
      });
    } catch (error) {
      logger.error("Failed to process consent revocation", error as Error, {
        consentId,
        userId,
      });
      throw error;
    }
  },
);

/**
 * Trigger: On consent withdrawal (all consents)
 *
 * Monitors for users who have revoked all consents
 * and may need additional processing.
 */
export const onUserConsentWithdrawn = onDocumentCreated(
  {
    document: "consents/{consentId}",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const consentData = snapshot.data();

    // Only process revocations
    if (consentData.action !== "revoke") {
      return;
    }

    const userId = consentData.userId;

    try {
      // Check if user has any remaining consents
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return;
      }

      const userData = userDoc.data()!;

      // If both consents are revoked, log for compliance tracking
      if (!userData.tosAccepted && !userData.ppAccepted) {
        logger.info("User has revoked all consents", {
          userId,
          deletionScheduled: userData.deletionScheduled,
        });

        // Add to compliance tracking if needed
        // This could trigger additional GDPR processes
      }
    } catch (error) {
      logger.error("Failed to check user consent status", error as Error, { userId });
    }
  },
);
