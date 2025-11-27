/**
 * Firebase Auth onCreate Trigger
 *
 * 新規ユーザー作成時の処理
 * - Usersコレクションにドキュメント作成
 * - デフォルト値の設定
 * - 同意管理の初期化
 *
 * @version 2.0.0
 * @date 2025-11-26
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { auth } from "firebase-functions/v1";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 新規ユーザー作成時のトリガー関数
 * Firebase Authでユーザーが作成されたときに自動実行される
 */
export const onUserCreate = auth
  .user()
  .onCreate(async (user) => {
    const { uid, email, phoneNumber, displayName, photoURL } = user;

    // DEBUG: Log function start
    console.log("onCreate triggered for user:", uid);
    logger.info(`Creating user document for UID: ${uid}`, {
      email,
      phoneNumber,
    });

    try {
      // トランザクションでユーザードキュメントを作成
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(uid);
        const userDoc = await transaction.get(userRef);

        // すでに存在する場合はスキップ（重複実行対策）
        if (userDoc.exists) {
          logger.warn(`User document already exists for UID: ${uid}`);
          return;
        }

        // ユーザードキュメントの作成
        const userData = {
          // 基本情報
          userId: uid,
          email: email || null,
          phoneNumber: phoneNumber || null,
          displayName: displayName || null,
          photoUrl: photoURL || null,

          // アカウント状態
          isActive: true,
          emailVerified: false,
          phoneVerified: !!phoneNumber,  // 電話番号があれば検証済みとする

          // GDPR同意管理（初期値）
          tosAccepted: false,
          tosAcceptedAt: null,
          tosVersion: null,
          ppAccepted: false,
          ppAcceptedAt: null,
          ppVersion: null,

          // 削除管理
          deletionScheduled: false,
          deletionScheduledAt: null,
          scheduledDeletionDate: null,

          // 強制ログアウト
          forceLogout: false,
          forceLogoutAt: null,

          // プロフィール（空オブジェクト）
          profile: {
            height: null,
            weight: null,
            birthday: null,
            gender: null,
            fitnessLevel: null,
            goals: [],
          },

          // 統計情報
          stats: {
            totalSessions: 0,
            totalExerciseTime: 0,
            lastSessionDate: null,
            streakDays: 0,
            bestStreak: 0,
          },

          // プラン情報（デフォルト: 無料プラン）
          subscription: {
            plan: "free",
            status: "active",
            startDate: FieldValue.serverTimestamp(),
            endDate: null,
            autoRenew: false,
          },

          // 使用量制限（無料プラン）
          dailyUsageCount: 0,
          lastUsageResetDate: FieldValue.serverTimestamp(),

          // メタデータ
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastLoginAt: FieldValue.serverTimestamp(),
        };

        // DEBUG: Log before document creation
        console.log("Creating user document...");
        transaction.set(userRef, userData);

        // 初期設定ドキュメントの作成（settings サブコレクション）
        const settingsRef = userRef.collection("settings").doc("preferences");
        const settingsData = {
          // 通知設定
          notifications: {
            email: {
              enabled: false,
              dailyReminder: false,
              weeklyReport: false,
              achievements: false,
            },
            push: {
              enabled: false,
              dailyReminder: false,
              achievements: false,
            },
          },

          // アプリ設定
          app: {
            theme: "system",  // light, dark, system
            language: "ja",
            soundEnabled: true,
            hapticEnabled: true,
          },

          // エクササイズ設定
          exercise: {
            restTimeBetweenSets: 60,  // 秒
            countdownBeforeStart: 3,  // 秒
            autoNextExercise: false,
            showFormTips: true,
          },

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(settingsRef, settingsData);

        // 同意ログの作成（Consents コレクション）
        const consentRef = db.collection("consents").doc();
        const consentData = {
          consentId: consentRef.id,
          userId: uid,
          type: "account_created",
          action: "create",
          version: "1.0.0",
          ipAddress: null,  // Cloud Functions からは取得できない
          userAgent: null,
          timestamp: FieldValue.serverTimestamp(),
        };

        transaction.set(consentRef, consentData);
      });

      // ウェルカムメール送信の準備（将来実装）
      // await sendWelcomeEmail(email);

      // DEBUG: Log success
      console.log("User document created successfully");
      logger.info(`Successfully created user document for UID: ${uid}`);
    } catch (error) {
      // DEBUG: Log error
      console.error("Error creating user document:", error);
      logger.error(`Failed to create user document for UID: ${uid}`, error);

      // エラーを再スロー（リトライのため）
      throw error;
    }
  });

/**
 * メールアドレス確認完了時の処理
 * カスタムクレームは設定しない（メール確認はデフォルト動作）
 */
export const onEmailVerified = onDocumentUpdated(
  {
    region: "asia-northeast1",
    document: "users/{userId}",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      return;
    }

    const userId = event.params.userId;

    // メール確認状態の変更を検知
    if (!before.emailVerified && after.emailVerified) {
      logger.info(`Email verified for user: ${userId}`);

      try {
        // FirebaseユーザーのemailVerifiedフラグを更新
        const user = await admin.auth().getUser(userId);
        if (!user.emailVerified) {
          await admin.auth().updateUser(userId, {
            emailVerified: true,
          });
        }
      } catch (error) {
        logger.error("Failed to update email verification status", error);
      }
    }
  },
);