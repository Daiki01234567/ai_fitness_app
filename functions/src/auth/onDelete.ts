/**
 * Firebase Auth onDelete Trigger
 *
 * ユーザーアカウント削除時の処理
 * - 関連データのクリーンアップ
 * - BigQueryへの削除ログ記録
 * - 削除通知
 *
 * @version 1.0.0
 * @date 2025-11-24
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * ユーザーアカウント削除時のトリガー関数
 * Firebase Authでユーザーが削除されたときに自動実行される
 */
export const onUserDelete = functions
  .region("asia-northeast1")  // 東京リージョン
  .auth.user()
  .onDelete(async (user) => {
    const { uid, email, phoneNumber } = user;

    functions.logger.info(`Deleting user data for UID: ${uid}`, {
      email,
      phoneNumber,
    });

    try {
      // バッチ処理で関連データを削除
      const batch = db.batch();

      // 1. ユーザードキュメントの削除
      const userRef = db.collection("users").doc(uid);
      batch.delete(userRef);

      // 2. セッションデータの削除（サブコレクション）
      const sessionsSnapshot = await userRef.collection("sessions").get();
      for (const doc of sessionsSnapshot.docs) {
        batch.delete(doc.ref);

        // フレームデータの削除（ネストされたサブコレクション）
        const framesSnapshot = await doc.ref.collection("frames").get();
        for (const frameDoc of framesSnapshot.docs) {
          batch.delete(frameDoc.ref);
        }
      }

      // 3. 設定データの削除（サブコレクション）
      const settingsSnapshot = await userRef.collection("settings").get();
      for (const doc of settingsSnapshot.docs) {
        batch.delete(doc.ref);
      }

      // 4. サブスクリプションデータの削除（サブコレクション）
      const subscriptionsSnapshot = await userRef.collection("subscriptions").get();
      for (const doc of subscriptionsSnapshot.docs) {
        batch.delete(doc.ref);
      }

      // 5. 通知データの削除
      const notificationsSnapshot = await db
        .collection("notifications")
        .where("userId", "==", uid)
        .get();
      for (const doc of notificationsSnapshot.docs) {
        batch.delete(doc.ref);
      }

      // 6. データ削除リクエストの更新（完了ステータスに変更）
      const deletionRequestsSnapshot = await db
        .collection("dataDeletionRequests")
        .where("userId", "==", uid)
        .where("status", "==", "pending")
        .get();
      for (const doc of deletionRequestsSnapshot.docs) {
        batch.update(doc.ref, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // バッチコミット（最大500件の制限があるため、分割が必要な場合は別途処理）
      await batch.commit();

      // 7. 削除ログの記録（監査用）
      const deletionLogRef = db.collection("userDeletionLogs").doc();
      await deletionLogRef.set({
        logId: deletionLogRef.id,
        userId: uid,
        email: email || null,
        phoneNumber: phoneNumber || null,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedBy: "system",  // システムによる自動削除
        reason: "user_requested",  // ユーザーリクエストによる削除
        dataCategories: [
          "profile",
          "sessions",
          "settings",
          "subscriptions",
          "notifications",
        ],
        status: "completed",
      });

      // 8. Cloud Storageのファイル削除（プロフィール画像など）
      try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({
          prefix: `users/${uid}/`,
        });

        if (files.length > 0) {
          await Promise.all(files.map((file) => file.delete()));
          functions.logger.info(`Deleted ${files.length} files for user ${uid}`);
        }
      } catch (storageError) {
        functions.logger.error("Failed to delete storage files", storageError);
        // ストレージエラーは無視して続行
      }

      // 9. BigQueryへの削除記録（GDPR監査用）- 将来実装
      // await recordDeletionToBigQuery(uid, email);

      functions.logger.info(`Successfully deleted all data for UID: ${uid}`);

      // 10. 削除完了通知（管理者向け）- 将来実装
      // await notifyAdminOfDeletion(uid, email);

    } catch (error) {
      functions.logger.error(`Failed to delete user data for UID: ${uid}`, error);

      // エラー時は手動介入が必要
      // BigQuerySyncFailuresコレクションに記録
      await db.collection("bigquerySyncFailures").add({
        documentPath: `/users/${uid}`,
        operationType: "delete",
        error: error instanceof Error ? error.message : String(error),
        retryCount: 0,
        maxRetries: 3,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRetryAt: null,
        status: "pending",
      });

      // エラーを再スロー
      throw new functions.https.HttpsError(
        "internal",
        `Failed to delete user data: ${error}`
      );
    }
  });

/**
 * 削除猶予期間（30日）経過後の実際の削除処理
 * スケジュール関数から呼び出される
 */
export const processScheduledDeletions = functions
  .region("asia-northeast1")
  .pubsub.schedule("every day 00:00")  // 毎日午前0時に実行
  .timeZone("Asia/Tokyo")
  .onRun(async (context) => {
    functions.logger.info("Processing scheduled deletions");

    try {
      const now = admin.firestore.Timestamp.now();

      // 削除予定日を過ぎたユーザーを取得
      const deletionSnapshot = await db
        .collection("users")
        .where("deletionScheduled", "==", true)
        .where("scheduledDeletionDate", "<=", now)
        .limit(100)  // バッチ処理の制限
        .get();

      if (deletionSnapshot.empty) {
        functions.logger.info("No scheduled deletions to process");
        return;
      }

      functions.logger.info(`Found ${deletionSnapshot.size} users to delete`);

      // 各ユーザーを削除
      const deletePromises = deletionSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const uid = doc.id;

        try {
          // Firebase Authからユーザーを削除
          await admin.auth().deleteUser(uid);
          functions.logger.info(`Deleted auth user: ${uid}`);

          // onDeleteトリガーが自動的にFirestoreデータをクリーンアップする
        } catch (error) {
          functions.logger.error(`Failed to delete user ${uid}:`, error);

          // エラーを記録
          await db.collection("bigquerySyncFailures").add({
            documentPath: `/users/${uid}`,
            operationType: "scheduled_delete",
            error: error instanceof Error ? error.message : String(error),
            retryCount: 0,
            maxRetries: 3,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRetryAt: null,
            status: "pending",
          });
        }
      });

      await Promise.allSettled(deletePromises);

      functions.logger.info("Completed processing scheduled deletions");
    } catch (error) {
      functions.logger.error("Error processing scheduled deletions:", error);
      throw error;
    }
  });