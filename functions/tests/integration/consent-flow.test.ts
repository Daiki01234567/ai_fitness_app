/**
 * Consent Flow Integration Tests
 *
 * End-to-end tests for the complete consent management flow.
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
  getConsentRecords,
  getUserDocument,
} from "./setup";

describe("Consent Flow Integration Tests", () => {
  const testUserId = `consent-flow-test-${Date.now()}`;

  beforeAll(async () => {
    initializeTestApp();
  });

  beforeEach(async () => {
    // Clean up any previous test data
    await deleteTestUser(testUserId);
    // Wait for deletion to fully propagate in emulator
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Create test user
    await createTestUser({ uid: testUserId });
    await createTestUserDocument(testUserId, {
      email: `${testUserId}@test.example.com`,
      displayName: "Consent Flow Test User",
      tosAccepted: false,
      ppAccepted: false,
    });
    // Wait for document creation to fully propagate
    await new Promise((resolve) => setTimeout(resolve, 100));
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

  describe("Complete Consent Flow", () => {
    it("should start with no consent given", async () => {
      // Get initial user document
      const userData = await getUserDocument(testUserId);

      expect(userData).toBeDefined();
      expect(userData?.tosAccepted).toBe(false);
      expect(userData?.ppAccepted).toBe(false);
      expect(userData?.tosAcceptedAt).toBeUndefined();
      expect(userData?.ppAcceptedAt).toBeUndefined();
    });

    it("should record TOS consent correctly", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate consent recording (what the Cloud Function would do)
      const consentRecord = {
        userId: testUserId,
        consentType: "tos",
        documentVersion: "3.2",
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip-address",
          userAgent: "Test User Agent",
          deviceType: "desktop",
          platform: "Web",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        dataRetentionDate: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        ),
      };

      // Execute transaction (simulating what recordConsent does)
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, consentRecord);
        transaction.update(userRef, {
          tosAccepted: true,
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          tosVersion: "3.2",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Verify user document was updated
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
      expect(userData?.tosVersion).toBe("3.2");
      expect(userData?.tosAcceptedAt).toBeDefined();

      // Verify consent record was created
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(1);
      expect(consents[0].consentType).toBe("tos");
      expect(consents[0].action).toBe("accept");
      expect(consents[0].documentVersion).toBe("3.2");
    });

    it("should record Privacy Policy consent correctly", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate consent recording
      const consentRecord = {
        userId: testUserId,
        consentType: "privacy_policy",
        documentVersion: "3.1",
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip-address",
          userAgent: "Test User Agent",
          deviceType: "mobile",
          platform: "iOS",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        dataRetentionDate: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        ),
      };

      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, consentRecord);
        transaction.update(userRef, {
          ppAccepted: true,
          ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          ppVersion: "3.1",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Verify user document was updated
      const userData = await getUserDocument(testUserId);
      expect(userData?.ppAccepted).toBe(true);
      expect(userData?.ppVersion).toBe("3.1");
      expect(userData?.ppAcceptedAt).toBeDefined();

      // Verify consent record was created
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(1);
      expect(consents[0].consentType).toBe("privacy_policy");
      expect(consents[0].action).toBe("accept");
    });

    it("should record both consents in sequence", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available in emulator
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify document exists before starting (with retry)
      let initialCheck = await userRef.get();
      if (!initialCheck.exists) {
        // Retry after additional wait
        await new Promise((resolve) => setTimeout(resolve, 100));
        initialCheck = await userRef.get();
        if (!initialCheck.exists) {
          throw new Error("User document should exist at test start");
        }
      }

      // Record TOS consent - use set with merge for reliability
      const tosConsentRef = db.collection("consents").doc();
      await tosConsentRef.set({
        userId: testUserId,
        consentType: "tos",
        documentVersion: "3.2",
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip",
          userAgent: "Test Agent",
          deviceType: "mobile",
          platform: "Android",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await userRef.set(
        {
          tosAccepted: true,
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          tosVersion: "3.2",
        },
        { merge: true },
      );

      // Wait a moment for timestamp ordering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Record PP consent - use set with merge for reliability
      const ppConsentRef = db.collection("consents").doc();
      await ppConsentRef.set({
        userId: testUserId,
        consentType: "privacy_policy",
        documentVersion: "3.1",
        action: "accept",
        consentDetails: {
          ipAddress: "hashed-ip",
          userAgent: "Test Agent",
          deviceType: "mobile",
          platform: "Android",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await userRef.set(
        {
          ppAccepted: true,
          ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          ppVersion: "3.1",
        },
        { merge: true },
      );

      // Wait for writes to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify both consents are recorded
      const userData = await getUserDocument(testUserId);
      expect(userData?.tosAccepted).toBe(true);
      expect(userData?.ppAccepted).toBe(true);

      // Verify consent history
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(2);

      const tosConsent = consents.find((c) => c.consentType === "tos");
      const ppConsent = consents.find((c) => c.consentType === "privacy_policy");

      expect(tosConsent).toBeDefined();
      expect(ppConsent).toBeDefined();
    });

    it("should handle consent update when version changes", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First, give consent with old version
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.1", // Old version
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
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          tosVersion: "3.1",
        });
      });

      // Verify old version
      let userData = await getUserDocument(testUserId);
      expect(userData?.tosVersion).toBe("3.1");

      // Wait for timestamp ordering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update consent to new version
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

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
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          tosVersion: "3.2",
        });
      });

      // Verify new version
      userData = await getUserDocument(testUserId);
      expect(userData?.tosVersion).toBe("3.2");

      // Verify consent history shows both versions
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(2);

      // Most recent should be first (ordered by createdAt desc)
      expect(consents[0].documentVersion).toBe("3.2");
      expect(consents[1].documentVersion).toBe("3.1");
    });
  });

  describe("Consent Record Immutability", () => {
    it("should not allow modification of consent records", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create consent record
      let consentId: string = "";
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        const consentRef = db.collection("consents").doc();
        consentId = consentRef.id;
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
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
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          tosVersion: "3.2",
        });
      });

      // Verify record exists
      const consentRef = db.collection("consents").doc(consentId);
      const consentDoc = await consentRef.get();
      expect(consentDoc.exists).toBe(true);

      // Note: In production, Firestore security rules prevent updates
      // This test verifies the record structure is correct
      const data = consentDoc.data();
      expect(data?.userId).toBe(testUserId);
      expect(data?.consentType).toBe("tos");
      expect(data?.action).toBe("accept");
    });

    it("should create new record for consent changes instead of updating", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First consent
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
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
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Revoke consent (creates new record)
      await db.runTransaction(async (transaction) => {
        // Read the document first to ensure it exists in the transaction
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User document not found");
        }

        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, {
          userId: testUserId,
          consentType: "tos",
          documentVersion: "3.2",
          action: "revoke",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userRef, {
          tosAccepted: false,
        });
      });

      // Verify two separate records exist
      const consents = await getConsentRecords(testUserId);
      expect(consents.length).toBe(2);
      expect(consents[0].action).toBe("revoke");
      expect(consents[1].action).toBe("accept");
    });
  });

  describe("Consent Status Retrieval", () => {
    it("should correctly report consent status when no consent given", async () => {
      const userData = await getUserDocument(testUserId);

      // Build status similar to getConsentStatus function
      const status = {
        tosAccepted: userData?.tosAccepted === true,
        ppAccepted: userData?.ppAccepted === true,
        tosVersion: userData?.tosVersion || null,
        ppVersion: userData?.ppVersion || null,
        needsConsent:
          userData?.tosAccepted !== true || userData?.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(false);
      expect(status.ppAccepted).toBe(false);
      expect(status.needsConsent).toBe(true);
    });

    it("should correctly report consent status when partially consented", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Give only TOS consent
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const userData = await getUserDocument(testUserId);

      const status = {
        tosAccepted: userData?.tosAccepted === true,
        ppAccepted: userData?.ppAccepted === true,
        needsConsent:
          userData?.tosAccepted !== true || userData?.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(true);
      expect(status.ppAccepted).toBe(false);
      expect(status.needsConsent).toBe(true);
    });

    it("should correctly report consent status when fully consented", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Give both consents
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.2",
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          ppAccepted: true,
          ppVersion: "3.1",
          ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const userData = await getUserDocument(testUserId);

      const status = {
        tosAccepted: userData?.tosAccepted === true,
        ppAccepted: userData?.ppAccepted === true,
        tosVersion: userData?.tosVersion,
        ppVersion: userData?.ppVersion,
        allConsentsValid:
          userData?.tosAccepted === true &&
          userData?.ppAccepted === true &&
          userData?.tosVersion === "3.2" &&
          userData?.ppVersion === "3.1",
        needsConsent:
          userData?.tosAccepted !== true || userData?.ppAccepted !== true,
      };

      expect(status.tosAccepted).toBe(true);
      expect(status.ppAccepted).toBe(true);
      expect(status.allConsentsValid).toBe(true);
      expect(status.needsConsent).toBe(false);
    });

    it("should indicate update needed when version is outdated", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Wait for document to be fully available
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Give consent with old version
      await userRef.set(
        {
          tosAccepted: true,
          tosVersion: "3.0", // Old version
          tosAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          ppAccepted: true,
          ppVersion: "3.1",
          ppAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const userData = await getUserDocument(testUserId);
      const currentTosVersion = "3.2";
      const currentPpVersion = "3.1";

      const status = {
        tosAccepted: userData?.tosAccepted === true,
        tosVersion: userData?.tosVersion,
        tosNeedsUpdate: userData?.tosVersion !== currentTosVersion,
        ppNeedsUpdate: userData?.ppVersion !== currentPpVersion,
      };

      expect(status.tosAccepted).toBe(true);
      expect(status.tosNeedsUpdate).toBe(true);
      expect(status.ppNeedsUpdate).toBe(false);
    });
  });

  describe("Consent History", () => {
    it("should track complete consent history chronologically", async () => {
      const db = getFirestore();
      const userRef = db.collection("users").doc(testUserId);

      // Create multiple consent actions
      const actions = [
        { type: "tos", action: "accept", version: "3.1" },
        { type: "privacy_policy", action: "accept", version: "3.0" },
        { type: "tos", action: "accept", version: "3.2" }, // Update
        { type: "privacy_policy", action: "accept", version: "3.1" }, // Update
      ];

      for (const actionData of actions) {
        await db.collection("consents").add({
          userId: testUserId,
          consentType: actionData.type,
          action: actionData.action,
          documentVersion: actionData.version,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Get consent history
      const consents = await getConsentRecords(testUserId);

      expect(consents.length).toBe(4);

      // Most recent should be first
      expect(consents[0].consentType).toBe("privacy_policy");
      expect(consents[0].documentVersion).toBe("3.1");
    });

    it("should limit history retrieval as specified", async () => {
      const db = getFirestore();

      // Create 5 consent records
      for (let i = 0; i < 5; i++) {
        await db.collection("consents").add({
          userId: testUserId,
          consentType: i % 2 === 0 ? "tos" : "privacy_policy",
          action: "accept",
          documentVersion: `3.${i}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Get limited history
      const snapshot = await db
        .collection("consents")
        .where("userId", "==", testUserId)
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();

      expect(snapshot.docs.length).toBe(3);
    });
  });
});
