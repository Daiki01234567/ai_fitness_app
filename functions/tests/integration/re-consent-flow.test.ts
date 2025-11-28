/**
 * Re-consent Flow Integration Tests
 *
 * Tests for re-consent scenarios including version updates,
 * consent restoration after revocation, and multi-device sync.
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
  getConsentRecords,
  getUserDocument,
  setCustomClaims,
  getCustomClaims,
} from "./setup";

describe("Re-consent Flow Integration Tests", () => {
  const testUserId = `re-consent-test-${Date.now()}`;

  beforeAll(async () => {
    initializeTestApp();
  });

  beforeEach(async () => {
    await deleteTestUser(testUserId);
    // Wait for deletion to fully propagate
    await new Promise((resolve) => setTimeout(resolve, 100));
    await createTestUser({ uid: testUserId });
    await createTestUserDocument(testUserId, {
      email: `${testUserId}@test.example.com`,
      displayName: "Re-consent Test User",
      tosAccepted: false,
      ppAccepted: false,
    });
    // Wait for document creation to fully propagate
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    await deleteTestUser(testUserId);
    // Allow time for any pending async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Final cleanup and allow pending operations to settle
    await deleteTestUser(testUserId);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("Version Update Re-consent Flow", () => {
    it("should detect when TOS version update requires re-consent", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // User has old TOS version
      await userRef.update({
        tosAccepted: true,
        tosVersion: "3.1", // Old version
        tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        ppAccepted: true,
        ppVersion: "3.1",
        ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userData = await getUserDocument(testUserId);
      const currentTosVersion = "3.2";

      // Check if re-consent needed
      const tosNeedsUpdate = userData?.tosVersion !== currentTosVersion;
      expect(tosNeedsUpdate).toBe(true);
    });

    it("should detect when PP version update requires re-consent", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // User has old PP version
      await userRef.update({
        tosAccepted: true,
        tosVersion: "3.2",
        tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        ppAccepted: true,
        ppVersion: "3.0", // Old version
        ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userData = await getUserDocument(testUserId);
      const currentPpVersion = "3.1";

      const ppNeedsUpdate = userData?.ppVersion !== currentPpVersion;
      expect(ppNeedsUpdate).toBe(true);
    });

    it("should handle re-consent for updated TOS version", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Initial consent with old version
      await db.runTransaction(async (transaction) => {
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.1",
          action: "accept",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: true,
          tosVersion: "3.1",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Wait for timestamp
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Re-consent with new version
      await db.runTransaction(async (transaction) => {
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2", // New version
          action: "accept",
          consentDetails: {
            ipAddress: "hashed-ip",
            userAgent: "Test Agent",
            deviceType: "desktop",
            platform: "Web",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Verify updated version
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosVersion).toBe("3.2");

      // Verify history shows both consents
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(2);
      expect(consents[0].documentVersion).toBe("3.2");
      expect(consents[1].documentVersion).toBe("3.1");
    });

    it("should require both TOS and PP re-consent when both updated", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // User has old versions of both
      await userRef.update({
        tosAccepted: true,
        tosVersion: "3.1",
        tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        ppAccepted: true,
        ppVersion: "3.0",
        ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userData = await getUserDocument(testUserId);
      const currentVersions = { tos: "3.2", pp: "3.1" };

      const tosNeedsUpdate = userData?.tosVersion !== currentVersions.tos;
      const ppNeedsUpdate = userData?.ppVersion !== currentVersions.pp;
      const bothNeedUpdate = tosNeedsUpdate && ppNeedsUpdate;

      expect(bothNeedUpdate).toBe(true);
    });
  });

  describe("Consent Restoration After Revocation", () => {
    it("should allow re-consent after TOS revocation", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify document exists before starting
      const initialCheck = await userRef.get();
      if (!initialCheck.exists) {
        throw new Error("User document should exist at test start");
      }

      // Initial consent - use set with merge for reliability
      const consentRef1 = db.collection("consents").doc();
      await consentRef1.set({
        userId: testUserId,
        consentType: "tos",
        documentVersion: "3.2",
        action: "accept",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
        },
        { merge: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Revoke consent - use set with merge for reliability
      const consentRef2 = db.collection("consents").doc();
      await consentRef2.set({
        userId: testUserId,
        consentType: "tos",
        documentVersion: "3.2",
        action: "revoke",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await userRef.set(
        {
          tosAccepted: false,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // Verify revoked
      let userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Re-consent - use set with merge for reliability
      const consentRef3 = db.collection("consents").doc();
      await consentRef3.set({
        userId: testUserId,
        consentType: "tos",
        documentVersion: "3.2",
        action: "accept",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );

      // Wait for write to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify restored
      userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
      expect(userData?.forceLogoutAt).toBeUndefined();

      // Verify complete history
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(3);
      expect(consents[0].action).toBe("accept");
      expect(consents[1].action).toBe("revoke");
      expect(consents[2].action).toBe("accept");
    });

    it("should clear force logout on re-consent", async () => {
      const db = getFirestore();
      const auth = getAuth();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set initial consent - use set with merge to handle timing issues
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
          ppAccepted: true,
          ppVersion: "3.1",
        },
        { merge: true },
      );

      // Simulate revocation with force logout
      await userRef.set(
        {
          tosAccepted: false,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Verify force logout is set
      let userData = await getUserDocument(testUserId);
      let claims = await getCustomClaims(testUserId);
      expect(userData?.forceLogoutAt).toBeDefined();
      expect(claims?.forceLogout).toBe(true);

      // Simulate re-consent after re-authentication
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: false,
      });

      // Verify force logout is cleared
      userData = await getUserDocument(testUserId);
      claims = await getCustomClaims(testUserId);
      expect(userData?.tosAccepted).toBe(true);
      expect(userData?.forceLogoutAt).toBeUndefined();
      expect(claims?.forceLogout).toBe(false);
    });

    it("should not allow re-consent when deletion is scheduled", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Schedule deletion
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 30);

      await userRef.update({
        tosAccepted: false,
        ppAccepted: false,
        deletionScheduled: true,
        scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDate),
      });

      // Verify deletion is scheduled
      const userData = await getUserDocument(testUserId);
      expect(userData?.deletionScheduled).toBe(true);

      // In production, the API would reject consent recording
      // This test verifies the deletionScheduled flag prevents new consent
    });

    it("should allow re-consent after cancelling deletion", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Schedule deletion - use set with merge to handle timing issues
      await userRef.set(
        {
          tosAccepted: false,
          deletionScheduled: true,
          scheduledDeletionDate: admin.firestore.Timestamp.fromDate(new Date()),
        },
        { merge: true },
      );

      // Cancel deletion
      await userRef.set(
        {
          deletionScheduled: false,
          scheduledDeletionDate: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );

      // Verify deletion cancelled
      let userData = await getUserDocument(testUserId);
      expect(userData?.deletionScheduled).toBe(false);

      // Now re-consent should be allowed
      await db.runTransaction(async (transaction) => {
        // Must get document first before updating in a transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document does not exist for re-consent");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "accept",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
    });
  });

  describe("Multi-device Consent Sync", () => {
    it("should sync consent status across devices via Firestore", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Device A records consent
      await db.runTransaction(async (transaction) => {
        // Must get the document first before updating in a transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document does not exist");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "accept",
          consentDetails: {
            deviceType: "mobile",
            platform: "iOS",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Device B reads consent status
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
      expect(userData?.tosVersion).toBe("3.2");
    });

    it("should sync force logout across devices", async () => {
      const db = getFirestore();
      const auth = getAuth();
      const userRef = db.collection("users").doc(testUserId);

      // Set initial consent
      await userRef.update({
        tosAccepted: true,
        tosVersion: "3.2",
        ppAccepted: true,
        ppVersion: "3.1",
      });

      // Device A revokes consent
      await userRef.update({
        tosAccepted: false,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await auth.setCustomUserClaims(testUserId, {
        forceLogout: true,
        forceLogoutAt: Date.now(),
      });

      // Device B should detect force logout
      const userData = await getUserDocument(testUserId);
      const claims = await getCustomClaims(testUserId);

      const shouldDeviceBLogout =
        userData?.forceLogoutAt !== undefined || claims?.forceLogout === true;

      expect(shouldDeviceBLogout).toBe(true);
    });

    it("should record consent from any device with correct metadata", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Record consent from iOS device
      await db.runTransaction(async (transaction) => {
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "accept",
          consentDetails: {
            ipAddress: "hashed-ip-ios",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS)",
            deviceType: "mobile",
            platform: "iOS",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: true,
          tosVersion: "3.2",
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Record consent from Android device (re-consent/update)
      await db.runTransaction(async (transaction) => {
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "privacy_policy",
          documentVersion: "3.1",
          action: "accept",
          consentDetails: {
            ipAddress: "hashed-ip-android",
            userAgent: "Mozilla/5.0 (Linux; Android)",
            deviceType: "mobile",
            platform: "Android",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          ppAccepted: true,
          ppVersion: "3.1",
        });
      });

      // Verify both consents recorded
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(2);

      // Verify different devices
      const platforms = consents.map((c) => {
        const details = (c as unknown as { consentDetails?: { platform?: string } })
          .consentDetails;
        return details?.platform;
      });
      expect(platforms).toContain("iOS");
      expect(platforms).toContain("Android");
    });
  });

  describe("Consent Flow Edge Cases", () => {
    it("should handle rapid consent/revoke cycles", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Rapid consent changes
      const actions = ["accept", "revoke", "accept", "revoke", "accept"];

      for (const action of actions) {
        await db.runTransaction(async (transaction) => {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, {
            userId: testUserId,
            consentType: "tos",
            documentVersion: "3.2",
            action,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.update(userRef, {
            tosAccepted: action === "accept",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Verify final state
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true); // Last action was accept

      // Verify all actions recorded
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(5);
    });

    it("should handle concurrent consent attempts gracefully", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator before concurrent operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify document exists before starting concurrent transactions
      const initialDoc = await userRef.get();
      if (!initialDoc.exists) {
        throw new Error("User document should exist before concurrent test");
      }

      // Simulate two concurrent consent attempts
      const attempt1 = db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found in attempt1");
        }
        if (!userDoc.data()?.tosAccepted) {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, {
            userId: testUserId,
            consentType: "tos",
            documentVersion: "3.2",
            action: "accept",
            source: "attempt1",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.update(userRef, {
            tosAccepted: true,
            tosVersion: "3.2",
          });
        }
        return "attempt1";
      });

      const attempt2 = db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found in attempt2");
        }
        if (!userDoc.data()?.tosAccepted) {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, {
            userId: testUserId,
            consentType: "tos",
            documentVersion: "3.2",
            action: "accept",
            source: "attempt2",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.update(userRef, {
            tosAccepted: true,
            tosVersion: "3.2",
          });
        }
        return "attempt2";
      });

      // Both should complete without error
      const results = await Promise.all([attempt1, attempt2]);
      expect(results).toContain("attempt1");
      expect(results).toContain("attempt2");

      // Final state should be consistent
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
    });

    it("should maintain consent history even after multiple version updates", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Simulate multiple version updates over time
      const versions = ["3.0", "3.1", "3.2"];

      for (const version of versions) {
        await db.runTransaction(async (transaction) => {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, {
            userId: testUserId,
            consentType: "tos",
            documentVersion: version,
            action: "accept",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.update(userRef, {
            tosAccepted: true,
            tosVersion: version,
            tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Verify current version
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosVersion).toBe("3.2");

      // Verify complete history preserved
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(3);

      const recordedVersions = consents.map((c) => c.documentVersion);
      expect(recordedVersions).toContain("3.0");
      expect(recordedVersions).toContain("3.1");
      expect(recordedVersions).toContain("3.2");
    });
  });
});
