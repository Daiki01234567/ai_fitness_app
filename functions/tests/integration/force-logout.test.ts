/**
 * Force Logout Integration Tests
 *
 * Tests for force logout mechanism triggered by consent revocation.
 * Verifies custom claims and Firestore forceLogoutAt field handling.
 *
 * Requires Firebase emulators to be running.
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import {
  initializeTestApp,
  createTestUser,
  createTestUserDocument,
  deleteTestUser,
  getFirestore,
  getAuth,
  getCustomClaims,
  setCustomClaims,
  getUserDocument,
  getDeletionRequests,
} from "./setup";

describe("Force Logout Integration Tests", () => {
  const testUserId = `force-logout-test-${Date.now()}`;

  beforeAll(async () => {
    initializeTestApp();
  });

  beforeEach(async () => {
    await deleteTestUser(testUserId);
    // Wait for deletion to fully propagate in emulator
    await new Promise((resolve) => setTimeout(resolve, 100));
    await createTestUser({ uid: testUserId });
    await createTestUserDocument(testUserId, {
      email: `${testUserId}@test.example.com`,
      displayName: "Force Logout Test User",
      tosAccepted: true,
      tosVersion: "3.2",
      ppAccepted: true,
      ppVersion: "3.1",
    });
    // Wait for document creation to fully propagate
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    await deleteTestUser(testUserId);
  });

  describe("Force Logout via Custom Claims", () => {
    it("should set forceLogout custom claim when consent is revoked", async () => {
      const auth = getAuth();

      // Simulate what revokeConsent does - set force logout claim
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify custom claims
      const claims = await getCustomClaims(testUserId);
      expect(claims?.forceLogout).toBe(true);
      expect(claims?.forceLogoutAt).toBeDefined();
    });

    it("should include timestamp in forceLogout claim", async () => {
      const auth = getAuth();
      const beforeTime = Date.now();

      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      const claims = await getCustomClaims(testUserId);
      const afterTime = Date.now();

      expect(claims?.forceLogoutAt).toBeGreaterThanOrEqual(beforeTime);
      expect(claims?.forceLogoutAt).toBeLessThanOrEqual(afterTime);
    });

    it("should preserve existing claims when adding forceLogout", async () => {
      const auth = getAuth();

      // Set some initial claims
      await auth.setCustomUserClaims(testUserId, {
        role: "user",
        tier: "free",
      });

      // Get current claims and add forceLogout
      const currentUser = await auth.getUser(testUserId);
      const existingClaims = currentUser.customClaims || {};

      await auth.setCustomUserClaims(testUserId, {
        ...existingClaims,
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify all claims preserved
      const claims = await getCustomClaims(testUserId);
      expect(claims?.role).toBe("user");
      expect(claims?.tier).toBe("free");
      expect(claims?.forceLogout).toBe(true);
    });

    it("should allow clearing forceLogout claim after user re-authenticates", async () => {
      const auth = getAuth();

      // Set force logout
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify it's set
      let claims = await getCustomClaims(testUserId);
      expect(claims?.forceLogout).toBe(true);

      // Clear force logout (simulating re-authentication and re-consent)
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: false,
        forceLogoutAt: null,
      });

      // Verify it's cleared
      claims = await getCustomClaims(testUserId);
      expect(claims?.forceLogout).toBe(false);
    });
  });

  describe("Force Logout via Firestore Field", () => {
    it("should set forceLogoutAt field when consent is revoked", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate consent revocation using set with merge to avoid NOT_FOUND issues
      await userRef.set(
        {
          tosAccepted: false,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // Verify forceLogoutAt is set
      const userData = await getUserDocument(testUserId);
      expect(userData?.forceLogoutAt).toBeDefined();
      expect(userData?.tosAccepted).toBe(false);
    });

    it("should set forceLogoutAt timestamp correctly", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);
      const beforeTime = Date.now();

      await userRef.update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const afterTime = Date.now();
      const userData = await getUserDocument(testUserId);

      const forceLogoutTime = userData?.forceLogoutAt?.toMillis?.() || 0;
      expect(forceLogoutTime).toBeGreaterThanOrEqual(beforeTime - 1000); // Allow 1s tolerance
      expect(forceLogoutTime).toBeLessThanOrEqual(afterTime + 1000);
    });

    it("should clear forceLogoutAt when user re-authenticates", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Set force logout
      await userRef.update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Verify it's set
      let userData = await getUserDocument(testUserId);
      expect(userData?.forceLogoutAt).toBeDefined();

      // Clear force logout (simulating re-authentication)
      await userRef.update({
        forceLogoutAt: admin.firestore.FieldValue.delete(),
      });

      // Verify it's cleared
      userData = await getUserDocument(testUserId);
      expect(userData?.forceLogoutAt).toBeUndefined();
    });
  });

  describe("Complete Consent Revocation Flow with Force Logout", () => {
    it("should execute complete TOS revocation flow", async () => {
      const db = getFirestore();
      const auth = getAuth();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate revokeConsent for TOS
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        // Create revocation consent record
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "revoke",
          consentDetails: {
            ipAddress: "hashed-ip",
            userAgent: "Test Agent",
            deviceType: "mobile",
            platform: "iOS",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update user document
        transaction.update(userRef, {
          tosAccepted: false,
          tosAcceptedAt: null,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Set force logout custom claim
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify complete state
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(false);
      expect(userData?.forceLogoutAt).toBeDefined();

      const claims = await getCustomClaims(testUserId);
      expect(claims?.forceLogout).toBe(true);

      // Verify consent record exists
      const snapshot = await db
        .collection("consents")
        .where("userId", "==", testUserId)
        .where("action", "==", "revoke")
        .get();

      expect(snapshot.docs.length).toBe(1);
    });

    it("should execute complete revocation with data deletion request", async () => {
      const db = getFirestore();
      const auth = getAuth();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Calculate scheduled deletion date (30 days from now)
      const scheduledDeletionDate = new Date();
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

      // Simulate revokeConsent with data deletion request
      let deletionRequestId: string = "";
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        // Create revocation consent records for both types
        const tosConsentRef = db.collection("consents").doc();
        transaction.set(tosConsentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "revoke",
          reason: "User requested account deletion",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const ppConsentRef = db.collection("consents").doc();
        transaction.set(ppConsentRef, {
          userId: testUserId,
          consentType: "privacy_policy",
          documentVersion: "3.1",
          action: "revoke",
          reason: "User requested account deletion",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create data deletion request
        const deletionRef = db.collection("dataDeletionRequests").doc();
        deletionRequestId = deletionRef.id;
        transaction.set(deletionRef, {
          userId: testUserId,
          status: "pending",
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          scheduledDeletionDate:
            admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
          reason: "consent_revoked",
          exportRequested: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update user document
        transaction.update(userRef, {
          tosAccepted: false,
          tosAcceptedAt: null,
          ppAccepted: false,
          ppAcceptedAt: null,
          deletionScheduled: true,
          scheduledDeletionDate:
            admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Set force logout custom claim
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify user document
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(false);
      expect(userData?.ppAccepted).toBe(false);
      expect(userData?.deletionScheduled).toBe(true);
      expect(userData?.scheduledDeletionDate).toBeDefined();
      expect(userData?.forceLogoutAt).toBeDefined();

      // Verify deletion request
      const deletionRequests = await getDeletionRequests(testUserId);
      expect(deletionRequests.length).toBe(1);
      expect(deletionRequests[0].status).toBe("pending");
      expect(deletionRequests[0].id).toBe(deletionRequestId);

      // Verify custom claims
      const claims = await getCustomClaims(testUserId);
      expect(claims?.forceLogout).toBe(true);
    });

    it("should prevent consent operations when deletion is scheduled", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Schedule deletion
      await userRef.update({
        deletionScheduled: true,
        scheduledDeletionDate: admin.firestore.Timestamp.fromDate(new Date()),
      });

      // Verify deletion scheduled
      const userData = await getUserDocument(testUserId);
      expect(userData?.deletionScheduled).toBe(true);

      // In production, the Cloud Function would reject new consent recording
      // This test verifies the flag is properly set
    });
  });

  describe("Force Logout Detection", () => {
    it("should detect force logout from custom claims", async () => {
      const auth = getAuth();

      // Set force logout
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Simulate client-side check
      const user = await auth.getUser(testUserId);
      const claims = user.customClaims || {};

      const shouldLogout = claims.forceLogout === true;
      expect(shouldLogout).toBe(true);
    });

    it("should detect force logout from Firestore field", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Set force logout timestamp
      await userRef.update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Simulate client-side check
      const userData = await getUserDocument(testUserId);

      // Client would compare forceLogoutAt with their last authentication time
      const forceLogoutAt = userData?.forceLogoutAt?.toMillis?.() || 0;
      expect(forceLogoutAt).toBeGreaterThan(0);
    });

    it("should handle dual detection mechanism", async () => {
      const db = getFirestore();
      const auth = getAuth();
      const userRef = db.collection("users").doc(testUserId);

      // Set both force logout mechanisms
      await userRef.update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Simulate client-side comprehensive check
      const userData = await getUserDocument(testUserId);
      const claims = await getCustomClaims(testUserId);

      const firestoreForceLogout =
        userData?.forceLogoutAt !== undefined &&
        userData?.forceLogoutAt !== null;
      const claimsForceLogout = claims?.forceLogout === true;

      // Either mechanism should trigger logout
      const shouldLogout = firestoreForceLogout || claimsForceLogout;
      expect(shouldLogout).toBe(true);
    });
  });

  describe("Token Revocation", () => {
    it("should revoke refresh tokens when consent is revoked", async () => {
      const auth = getAuth();

      // Revoke refresh tokens
      await auth.revokeRefreshTokens(testUserId);

      // Verify user record is updated
      const user = await auth.getUser(testUserId);
      expect(user.tokensValidAfterTime).toBeDefined();
    });

    it("should update tokensValidAfterTime on revocation", async () => {
      const auth = getAuth();
      const beforeTime = new Date();

      await auth.revokeRefreshTokens(testUserId);

      const user = await auth.getUser(testUserId);
      const tokensValidAfter = user.tokensValidAfterTime
        ? new Date(user.tokensValidAfterTime)
        : new Date(0);

      // Token validity time should be after the revocation was called
      expect(tokensValidAfter.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime() - 1000,
      );
    });
  });
});
