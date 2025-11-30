/**
 * Integration Test Setup
 *
 * Configuration for Firebase emulator-based integration tests.
 * Uses firebase-admin to connect to emulators.
 *
 * @version 1.1.0
 * @date 2025-11-30
 */

import * as admin from "firebase-admin";

// Emulator configuration
const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const FUNCTIONS_EMULATOR_HOST = "127.0.0.1:5001";

// Test project ID
export const TEST_PROJECT_ID = "ai-fitness-c38f0";

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
process.env.FUNCTIONS_EMULATOR_HOST = FUNCTIONS_EMULATOR_HOST;
process.env.GCLOUD_PROJECT = TEST_PROJECT_ID;
process.env.CONSENT_SALT = "test-consent-salt";

// Initialize Firebase Admin for emulator
let app: admin.app.App | undefined;

export function initializeTestApp(): admin.app.App {
  if (app) {
    return app;
  }

  // Clear any existing apps
  admin.apps.forEach((existingApp) => {
    if (existingApp) {
      existingApp.delete();
    }
  });

  app = admin.initializeApp({
    projectId: TEST_PROJECT_ID,
  });

  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  if (!app) {
    initializeTestApp();
  }
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  if (!app) {
    initializeTestApp();
  }
  return admin.auth();
}

/**
 * Create a test user in Firebase Auth emulator
 */
export async function createTestUser(options: {
  uid?: string;
  email?: string;
  password?: string;
  displayName?: string;
}): Promise<admin.auth.UserRecord> {
  const auth = getAuth();
  const uid = options.uid || `test-user-${Date.now()}`;
  const email = options.email || `${uid}@test.example.com`;
  const password = options.password || "test-password-123";

  try {
    // Try to get existing user first
    const existingUser = await auth.getUser(uid);
    return existingUser;
  } catch {
    // User doesn't exist, create new one
    return auth.createUser({
      uid,
      email,
      password,
      displayName: options.displayName || "Test User",
      emailVerified: true,
    });
  }
}

/**
 * Create a test user document in Firestore
 * Waits for the document to be confirmed in Firestore before returning.
 */
export async function createTestUserDocument(
  userId: string,
  data?: Partial<{
    email: string;
    displayName: string;
    tosAccepted: boolean;
    tosAcceptedAt: admin.firestore.Timestamp;
    tosVersion: string;
    ppAccepted: boolean;
    ppAcceptedAt: admin.firestore.Timestamp;
    ppVersion: string;
    deletionScheduled: boolean;
  }>,
): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);

  const defaultData = {
    email: `${userId}@test.example.com`,
    displayName: "Test User",
    tosAccepted: false,
    ppAccepted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userRef.set({ ...defaultData, ...data });

  // Wait for document to be confirmed in Firestore
  // This prevents race conditions where transactions fail with NOT_FOUND
  let retries = 0;
  const maxRetries = 10;
  while (retries < maxRetries) {
    const doc = await userRef.get();
    if (doc.exists) {
      // Small additional delay to ensure emulator has fully committed the write
      await new Promise((resolve) => setTimeout(resolve, 20));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    retries++;
  }
  throw new Error(`Failed to confirm document creation for user ${userId}`);
}

/**
 * Delete a test user from Auth and Firestore
 * Waits for deletion to be confirmed before returning.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const auth = getAuth();
  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);

  // Delete Firestore data
  try {
    await userRef.delete();
  } catch {
    // Ignore if not exists
  }

  // Delete consent records
  try {
    const consents = await db
      .collection("consents")
      .where("userId", "==", userId)
      .get();
    if (!consents.empty) {
      const batch = db.batch();
      consents.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch {
    // Ignore if no consents
  }

  // Delete data deletion requests
  try {
    const deletionRequests = await db
      .collection("dataDeletionRequests")
      .where("userId", "==", userId)
      .get();
    if (!deletionRequests.empty) {
      const batch = db.batch();
      deletionRequests.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch {
    // Ignore if no requests
  }

  // Delete Auth user
  try {
    await auth.deleteUser(userId);
  } catch {
    // Ignore if not exists
  }

  // Wait for user document deletion to be confirmed
  // This prevents race conditions with subsequent createTestUserDocument calls
  let retries = 0;
  const maxRetries = 10;
  while (retries < maxRetries) {
    const doc = await userRef.get();
    if (!doc.exists) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    retries++;
  }
}

/**
 * Clear all test data from emulators
 */
export async function clearTestData(): Promise<void> {
  const db = getFirestore();

  // Collections to clear
  const collections = [
    "users",
    "consents",
    "dataDeletionRequests",
    "auditLogs",
  ];

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(500).get();
      if (snapshot.empty) continue;

      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Get custom claims for a user
 */
export async function getCustomClaims(
  userId: string,
): Promise<Record<string, unknown> | undefined> {
  const auth = getAuth();
  const user = await auth.getUser(userId);
  return user.customClaims;
}

/**
 * Set custom claims for a user
 */
export async function setCustomClaims(
  userId: string,
  claims: Record<string, unknown>,
): Promise<void> {
  const auth = getAuth();
  await auth.setCustomUserClaims(userId, claims);
}

/**
 * Get consent records for a user
 */
export async function getConsentRecords(userId: string): Promise<
  Array<{
    id: string;
    consentType: string;
    action: string;
    documentVersion: string;
    createdAt: admin.firestore.Timestamp;
  }>
> {
  const db = getFirestore();
  const snapshot = await db
    .collection("consents")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<{
    id: string;
    consentType: string;
    action: string;
    documentVersion: string;
    createdAt: admin.firestore.Timestamp;
  }>;
}

/**
 * Get user document from Firestore
 */
export async function getUserDocument(
  userId: string,
): Promise<admin.firestore.DocumentData | undefined> {
  const db = getFirestore();
  const doc = await db.collection("users").doc(userId).get();
  return doc.data();
}

/**
 * Get data deletion requests for a user
 */
export async function getDeletionRequests(userId: string): Promise<
  Array<{
    id: string;
    status: string;
    requestedAt: admin.firestore.Timestamp;
    scheduledDeletionDate: admin.firestore.Timestamp;
  }>
> {
  const db = getFirestore();
  const snapshot = await db
    .collection("dataDeletionRequests")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<{
    id: string;
    status: string;
    requestedAt: admin.firestore.Timestamp;
    scheduledDeletionDate: admin.firestore.Timestamp;
  }>;
}

// Global test setup
beforeAll(async () => {
  initializeTestApp();
});

// Global test timeout for integration tests (longer than unit tests)
jest.setTimeout(30000);
