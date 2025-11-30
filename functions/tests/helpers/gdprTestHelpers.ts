/**
 * GDPR Test Helpers
 *
 * Test helper functions and mock data generation for GDPR tests
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

import { User, Session, Consent, UserSettings, Subscription } from "../../src/types/firestore";
import {
  ExportRequest,
  DeletionRequest,
  ExportFormat,
  ExportScopeType,
  DeletionType,
  RecoveryCode,
} from "../../src/types/gdpr";

/**
 * Create test user
 */
export async function createTestUser(
  userId: string,
  overrides?: Partial<User>,
): Promise<User> {
  const now = Timestamp.now();
  const userIdShort = userId.substr(0, 8);
  const userData: User = {
    nickname: "TestUser_" + userIdShort,
    email: "test" + userIdShort + "@example.com",
    tosAccepted: true,
    tosAcceptedAt: now,
    tosVersion: "3.2",
    ppAccepted: true,
    ppAcceptedAt: now,
    ppVersion: "3.1",
    deletionScheduled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  const db = admin.firestore();
  await db.collection("users").doc(userId).set(userData);

  return userData;
}

/**
 * Create test session
 */
export async function createTestSession(
  userId: string,
  overrides?: Partial<Session>,
): Promise<string> {
  const now = Timestamp.now();
  const sessionData: Session = {
    exerciseType: "squat",
    startTime: now,
    endTime: now,
    repCount: 10,
    totalScore: 850,
    averageScore: 85,
    duration: 300,
    status: "completed",
    sessionMetadata: {
      deviceInfo: {
        platform: "ios",
        model: "iPhone 14",
        osVersion: "17.0",
        screenWidth: 390,
        screenHeight: 844,
      },
      averageFps: 30,
      minFps: 25,
      frameDropCount: 5,
      totalFrames: 9000,
      poseConfidenceAverage: 0.95,
      appVersion: "1.0.0",
      mediaPipeVersion: "0.10.0",
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  const db = admin.firestore();
  const docRef = await db.collection("users").doc(userId).collection("sessions").add(sessionData);

  return docRef.id;
}

/**
 * Cleanup test user
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  // Delete subcollections
  const subcollections = ["sessions", "settings", "subscriptions"];
  for (const subcollection of subcollections) {
    const snapshot = await userRef.collection(subcollection).get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }

  await userRef.delete();

  // Delete related collections
  const collections = ["consents", "exportRequests", "deletionRequests"];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).where("userId", "==", userId).get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }
}

/**
 * Create mock export request
 */
export function createMockExportRequest(
  userId: string,
  format: ExportFormat = "json",
  scopeType: ExportScopeType = "all",
): ExportRequest {
  const now = Timestamp.now();
  const requestId = "export_" + userId + "_" + Date.now();

  return {
    userId,
    requestId,
    format,
    scope: { type: scopeType },
    status: "pending",
    requestedAt: now,
  };
}

/**
 * Create mock deletion request
 */
export function createMockDeletionRequest(
  userId: string,
  type: DeletionType = "soft",
): DeletionRequest {
  const now = Timestamp.now();
  const requestId = "deletion_" + userId + "_" + Date.now();
  const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const recoverDeadline = new Date(scheduledDate.getTime() - 60 * 60 * 1000);

  return {
    userId,
    requestId,
    type,
    scope: ["all"],
    requestedAt: now,
    scheduledAt: Timestamp.fromDate(scheduledDate),
    status: "scheduled",
    canRecover: type === "soft",
    recoverDeadline: type === "soft" ? Timestamp.fromDate(recoverDeadline) : undefined,
  };
}
