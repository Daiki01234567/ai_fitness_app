/**
 * Test Data Seeding Script for Firebase Emulator
 *
 * This script creates test data in the Firebase emulator environment.
 * It creates test users in Firebase Auth and corresponding documents in Firestore.
 *
 * Prerequisites:
 * - Firebase emulator must be running: `firebase emulators:start`
 * - Auth emulator on port 9099
 * - Firestore emulator on port 8080
 *
 * Usage:
 *   cd functions
 *   npx ts-node --project tsconfig.json tests/helpers/seed-data.ts
 *
 * Created test users:
 *   - user1@example.com (password123) - Regular user with 2 sessions
 *   - premium@example.com (password123) - Premium user with 3 sessions
 *   - newuser@example.com (password123) - New user without sessions
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Configure emulator hosts
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// Initialize Firebase Admin SDK
// Note: projectId must match the Firebase project used in emulator
admin.initializeApp({
  projectId: "tokyo-list-478804-e5",
});

const db = admin.firestore();
const auth = admin.auth();

// Valid exercise types as defined in src/types/firestore.ts
type ExerciseType = "squat" | "armcurl" | "sideraise" | "shoulderpress" | "pushup";

/**
 * Create a test user in both Auth and Firestore
 *
 * @param email - User email address
 * @param password - User password
 * @param displayName - Display name shown in the app
 * @returns The UID of the created user
 */
async function createTestUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    // Create corresponding document in Firestore users collection
    // Schema based on docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
    await db.collection("users").doc(userRecord.uid).set({
      email,
      displayName,
      nickname: displayName,
      tosAccepted: true,
      ppAccepted: true,
      tosAcceptedAt: Timestamp.now(),
      ppAcceptedAt: Timestamp.now(),
      tosVersion: "1.0",
      ppVersion: "1.0",
      deletionScheduled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      profile: {
        height: null,
        weight: null,
        gender: null,
        fitnessLevel: "beginner",
      },
    });

    console.log(`ユーザー作成完了: ${email} (UID: ${userRecord.uid})`);
    return userRecord.uid;
  } catch (error) {
    // Handle duplicate user error gracefully
    if ((error as { code?: string }).code === "auth/email-already-exists") {
      console.log(`ユーザー既存: ${email} - スキップします`);
      const existingUser = await auth.getUserByEmail(email);
      return existingUser.uid;
    }
    throw error;
  }
}

/**
 * Create a test training session for a user
 *
 * @param userId - The UID of the user
 * @param exerciseType - Type of exercise (squat, pushup, armcurl, sideraise, shoulderpress)
 * @returns The ID of the created session document
 */
async function createTestSession(
  userId: string,
  exerciseType: ExerciseType
): Promise<string> {
  const sessionRef = db.collection("users").doc(userId).collection("sessions").doc();

  // Session schema based on docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
  await sessionRef.set({
    sessionId: sessionRef.id,
    userId,
    exerciseType,
    startTime: Timestamp.now(),
    endTime: Timestamp.now(),
    status: "completed",
    repCount: 10,
    setCount: 3,
    totalScore: 850,
    averageScore: 85,
    duration: 300,
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
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log(`セッション作成完了: ${exerciseType} (ID: ${sessionRef.id})`);
  return sessionRef.id;
}

/**
 * Main entry point - creates all test data
 */
async function main(): Promise<void> {
  console.log("===== テストデータ作成開始 =====\n");
  console.log("エミュレータ設定:");
  console.log(`  - Auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  - Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log("");

  try {
    // Test User 1: Regular user with basic sessions
    const user1Id = await createTestUser(
      "user1@example.com",
      "password123",
      "テストユーザー1"
    );
    await createTestSession(user1Id, "squat");
    await createTestSession(user1Id, "pushup");

    console.log("");

    // Test User 2: Premium user (simulated) with all exercise types
    const user2Id = await createTestUser(
      "premium@example.com",
      "password123",
      "プレミアムユーザー"
    );
    await createTestSession(user2Id, "armcurl");
    await createTestSession(user2Id, "sideraise");
    await createTestSession(user2Id, "shoulderpress");

    console.log("");

    // Test User 3: New user without any sessions
    await createTestUser(
      "newuser@example.com",
      "password123",
      "新規ユーザー"
    );

    console.log("\n===== テストデータ作成完了 =====");
    console.log("\n作成したユーザー:");
    console.log("  - user1@example.com (password123) - 一般ユーザー、2セッション");
    console.log("  - premium@example.com (password123) - プレミアムユーザー、3セッション");
    console.log("  - newuser@example.com (password123) - 新規ユーザー、セッションなし");
    console.log("\nエミュレータUIで確認: http://localhost:4000");

  } catch (error) {
    console.error("\nエラーが発生しました:");
    if (error instanceof Error) {
      console.error(`  メッセージ: ${error.message}`);
      if (error.message.includes("ECONNREFUSED")) {
        console.error("\n[ヒント] Firebaseエミュレータが起動していない可能性があります。");
        console.error("        別のターミナルで `firebase emulators:start` を実行してください。");
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }

  process.exit(0);
}

// Execute main function
main();
