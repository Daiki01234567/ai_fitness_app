/**
 * Firebase Auth Custom Claims Management
 *
 * カスタムクレームの設定・更新・削除
 * - admin: 管理者権限
 * - forceLogout: 強制ログアウト
 * - その他の権限管理
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
 * カスタムクレームを設定する関数
 * 管理者のみ呼び出し可能
 */
export const setCustomClaims = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "認証が必要です"
      );
    }

    // 管理者権限チェック
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "管理者権限が必要です"
      );
    }

    const { targetUserId, claims } = data;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "有効なユーザーIDが必要です"
      );
    }

    if (!claims || typeof claims !== "object") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "有効なクレームオブジェクトが必要です"
      );
    }

    functions.logger.info(`Setting custom claims for user: ${targetUserId}`, {
      claims,
      requestedBy: context.auth.uid,
    });

    try {
      // 現在のユーザー情報を取得
      const userRecord = await admin.auth().getUser(targetUserId);

      // 既存のカスタムクレームを取得
      const currentClaims = userRecord.customClaims || {};

      // 新しいクレームをマージ
      const updatedClaims = {
        ...currentClaims,
        ...claims,
        lastUpdated: Date.now(),
        updatedBy: context.auth.uid,
      };

      // カスタムクレームを設定
      await admin.auth().setCustomUserClaims(targetUserId, updatedClaims);

      // Firestoreにもクレームの変更を記録（監査ログ）
      await db.collection("customClaimsLogs").add({
        targetUserId,
        previousClaims: currentClaims,
        newClaims: updatedClaims,
        changes: claims,
        updatedBy: context.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 特定のクレームに対する追加処理
      if (claims.forceLogout === true) {
        // 強制ログアウトフラグをFirestoreにも設定
        await db.collection("users").doc(targetUserId).update({
          forceLogout: true,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutBy: context.auth.uid,
          forceLogoutReason: claims.forceLogoutReason || "管理者による強制ログアウト",
        });

        functions.logger.info(`Force logout set for user: ${targetUserId}`);
      }

      if (claims.admin === true) {
        // 管理者権限付与の通知
        functions.logger.info(`Admin privileges granted to user: ${targetUserId}`);

        // 管理者権限付与をFirestoreに記録
        await db.collection("adminUsers").doc(targetUserId).set({
          userId: targetUserId,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          grantedBy: context.auth.uid,
          isActive: true,
        });
      }

      return {
        success: true,
        message: "カスタムクレームを設定しました",
        targetUserId,
        claims: updatedClaims,
      };
    } catch (error) {
      functions.logger.error("Failed to set custom claims", error);
      throw new functions.https.HttpsError(
        "internal",
        `カスタムクレームの設定に失敗しました: ${error}`
      );
    }
  });

/**
 * カスタムクレームを削除する関数
 * 管理者のみ呼び出し可能
 */
export const removeCustomClaims = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "認証が必要です"
      );
    }

    // 管理者権限チェック
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "管理者権限が必要です"
      );
    }

    const { targetUserId, claimKeys } = data;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "有効なユーザーIDが必要です"
      );
    }

    if (!claimKeys || !Array.isArray(claimKeys)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "削除するクレームキーの配列が必要です"
      );
    }

    functions.logger.info(`Removing custom claims for user: ${targetUserId}`, {
      claimKeys,
      requestedBy: context.auth.uid,
    });

    try {
      // 現在のユーザー情報を取得
      const userRecord = await admin.auth().getUser(targetUserId);

      // 既存のカスタムクレームを取得
      const currentClaims = userRecord.customClaims || {};

      // 指定されたキーを削除
      const updatedClaims = { ...currentClaims };
      for (const key of claimKeys) {
        delete updatedClaims[key];
      }

      // メタデータを追加
      updatedClaims.lastUpdated = Date.now();
      updatedClaims.updatedBy = context.auth.uid;

      // カスタムクレームを更新
      await admin.auth().setCustomUserClaims(targetUserId, updatedClaims);

      // 監査ログを記録
      await db.collection("customClaimsLogs").add({
        targetUserId,
        previousClaims: currentClaims,
        newClaims: updatedClaims,
        removedKeys: claimKeys,
        updatedBy: context.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 特定のクレーム削除に対する追加処理
      if (claimKeys.includes("forceLogout")) {
        // 強制ログアウトフラグをFirestoreでも解除
        await db.collection("users").doc(targetUserId).update({
          forceLogout: false,
          forceLogoutClearedAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutClearedBy: context.auth.uid,
        });

        functions.logger.info(`Force logout cleared for user: ${targetUserId}`);
      }

      if (claimKeys.includes("admin")) {
        // 管理者権限を無効化
        await db.collection("adminUsers").doc(targetUserId).update({
          isActive: false,
          revokedAt: admin.firestore.FieldValue.serverTimestamp(),
          revokedBy: context.auth.uid,
        });

        functions.logger.info(`Admin privileges revoked for user: ${targetUserId}`);
      }

      return {
        success: true,
        message: "カスタムクレームを削除しました",
        targetUserId,
        removedKeys: claimKeys,
        claims: updatedClaims,
      };
    } catch (error) {
      functions.logger.error("Failed to remove custom claims", error);
      throw new functions.https.HttpsError(
        "internal",
        `カスタムクレームの削除に失敗しました: ${error}`
      );
    }
  });

/**
 * ユーザーのカスタムクレームを取得する関数
 * 本人または管理者が呼び出し可能
 */
export const getCustomClaims = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "認証が必要です"
      );
    }

    const { targetUserId } = data;
    const requestingUserId = context.auth.uid;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "有効なユーザーIDが必要です"
      );
    }

    // 権限チェック（本人または管理者）
    if (targetUserId !== requestingUserId && !context.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "自分のクレームのみ取得可能です"
      );
    }

    try {
      // ユーザー情報を取得
      const userRecord = await admin.auth().getUser(targetUserId);

      return {
        success: true,
        userId: targetUserId,
        claims: userRecord.customClaims || {},
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
      };
    } catch (error) {
      functions.logger.error("Failed to get custom claims", error);
      throw new functions.https.HttpsError(
        "internal",
        `カスタムクレームの取得に失敗しました: ${error}`
      );
    }
  });

/**
 * 同意撤回時の強制ログアウト処理
 * Firestoreトリガーで自動実行
 */
export const onConsentWithdrawn = functions
  .region("asia-northeast1")
  .firestore
  .document("consents/{consentId}")
  .onCreate(async (snap, context) => {
    const consent = snap.data();

    // 同意撤回の場合のみ処理
    if (consent.action !== "withdraw") {
      return;
    }

    const { userId, type } = consent;

    functions.logger.info(`Consent withdrawn for user: ${userId}`, { type });

    try {
      // 強制ログアウトのカスタムクレームを設定
      const userRecord = await admin.auth().getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      await admin.auth().setCustomUserClaims(userId, {
        ...currentClaims,
        forceLogout: true,
        forceLogoutReason: `${type}の同意撤回`,
        lastUpdated: Date.now(),
      });

      // Firestoreにも記録
      await db.collection("users").doc(userId).update({
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogoutReason: `${type}の同意撤回`,
      });

      functions.logger.info(`Force logout set due to consent withdrawal: ${userId}`);
    } catch (error) {
      functions.logger.error("Failed to set force logout on consent withdrawal", error);
    }
  });