/**
 * Firebase Auth Custom Claims Management
 *
 * カスタムクレームの設定・更新・削除
 * - admin: 管理者権限
 * - forceLogout: 強制ログアウト
 * - その他の権限管理
 *
 * @version 2.0.0
 * @date 2025-11-26
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

import { requireStrictCsrfProtection } from "../middleware/csrf";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// リクエストインターフェース
interface SetClaimsRequest {
  targetUserId: string;
  claims: Record<string, unknown>;
}

interface RemoveClaimsRequest {
  targetUserId: string;
  claimKeys: string[];
}

interface GetClaimsRequest {
  targetUserId: string;
}

/**
 * カスタムクレームを設定する関数
 * 管理者のみ呼び出し可能
 */
export const setCustomClaims = onCall(
  { region: "asia-northeast1", cors: true },
  async (request: CallableRequest<SetClaimsRequest>) => {
    // CSRF保護（機密操作のためストリクトモード）
    requireStrictCsrfProtection(request);

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // 管理者権限チェック
    if (!request.auth.token.admin) {
      throw new HttpsError("permission-denied", "管理者権限が必要です");
    }

    const { targetUserId, claims } = request.data;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "有効なユーザーIDが必要です");
    }

    if (!claims || typeof claims !== "object") {
      throw new HttpsError("invalid-argument", "有効なクレームオブジェクトが必要です");
    }

    logger.info(`Setting custom claims for user: ${targetUserId}`, {
      claims,
      requestedBy: request.auth.uid,
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
        updatedBy: request.auth.uid,
      };

      // カスタムクレームを設定
      await admin.auth().setCustomUserClaims(targetUserId, updatedClaims);

      // Firestore にもクレームの変更を記録（監査ログ）
      await db.collection("customClaimsLogs").add({
        targetUserId,
        previousClaims: currentClaims,
        newClaims: updatedClaims,
        changes: claims,
        updatedBy: request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 特定のクレームに対する追加処理
      if (claims.forceLogout === true) {
        // 強制ログアウトフラグを Firestore にも設定
        await db.collection("users").doc(targetUserId).update({
          forceLogout: true,
          forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutBy: request.auth.uid,
          forceLogoutReason:
            (claims.forceLogoutReason as string) || "管理者による強制ログアウト",
        });

        logger.info(`Force logout set for user: ${targetUserId}`);
      }

      if (claims.admin === true) {
        // 管理者権限付与の通知
        logger.info(`Admin privileges granted to user: ${targetUserId}`);

        // 管理者権限付与を Firestore に記録
        await db.collection("adminUsers").doc(targetUserId).set({
          userId: targetUserId,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          grantedBy: request.auth.uid,
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
      logger.error("Failed to set custom claims", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError(
        "internal",
        `カスタムクレームの設定に失敗しました: ${message}`,
      );
    }
  },
);

/**
 * カスタムクレームを削除する関数
 * 管理者のみ呼び出し可能
 */
export const removeCustomClaims = onCall(
  { region: "asia-northeast1", cors: true },
  async (request: CallableRequest<RemoveClaimsRequest>) => {
    // CSRF保護（機密操作のためストリクトモード）
    requireStrictCsrfProtection(request);

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // 管理者権限チェック
    if (!request.auth.token.admin) {
      throw new HttpsError("permission-denied", "管理者権限が必要です");
    }

    const { targetUserId, claimKeys } = request.data;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "有効なユーザーIDが必要です");
    }

    if (!claimKeys || !Array.isArray(claimKeys)) {
      throw new HttpsError("invalid-argument", "削除するクレームキーの配列が必要です");
    }

    logger.info(`Removing custom claims for user: ${targetUserId}`, {
      claimKeys,
      requestedBy: request.auth.uid,
    });

    try {
      // 現在のユーザー情報を取得
      const userRecord = await admin.auth().getUser(targetUserId);

      // 既存のカスタムクレームを取得
      const currentClaims = userRecord.customClaims || {};

      // 指定されたキーを削除
      const updatedClaims: Record<string, unknown> = { ...currentClaims };
      for (const key of claimKeys) {
        delete updatedClaims[key];
      }

      // メタデータを追加
      updatedClaims.lastUpdated = Date.now();
      updatedClaims.updatedBy = request.auth.uid;

      // カスタムクレームを更新
      await admin.auth().setCustomUserClaims(targetUserId, updatedClaims);

      // 監査ログを記録
      await db.collection("customClaimsLogs").add({
        targetUserId,
        previousClaims: currentClaims,
        newClaims: updatedClaims,
        removedKeys: claimKeys,
        updatedBy: request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 特定のクレーム削除に対する追加処理
      if (claimKeys.includes("forceLogout")) {
        // 強制ログアウトフラグを Firestore でも解除
        await db.collection("users").doc(targetUserId).update({
          forceLogout: false,
          forceLogoutClearedAt: admin.firestore.FieldValue.serverTimestamp(),
          forceLogoutClearedBy: request.auth.uid,
        });

        logger.info(`Force logout cleared for user: ${targetUserId}`);
      }

      if (claimKeys.includes("admin")) {
        // 管理者権限を無効化
        await db.collection("adminUsers").doc(targetUserId).update({
          isActive: false,
          revokedAt: admin.firestore.FieldValue.serverTimestamp(),
          revokedBy: request.auth.uid,
        });

        logger.info(`Admin privileges revoked for user: ${targetUserId}`);
      }

      return {
        success: true,
        message: "カスタムクレームを削除しました",
        targetUserId,
        removedKeys: claimKeys,
        claims: updatedClaims,
      };
    } catch (error) {
      logger.error("Failed to remove custom claims", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError(
        "internal",
        `カスタムクレームの削除に失敗しました: ${message}`,
      );
    }
  },
);

/**
 * ユーザーのカスタムクレームを取得する関数
 * 本人または管理者が呼び出し可能
 */
export const getCustomClaims = onCall(
  { region: "asia-northeast1", cors: true },
  async (request: CallableRequest<GetClaimsRequest>) => {
    // CSRF保護
    requireStrictCsrfProtection(request);

    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const { targetUserId } = request.data;
    const requestingUserId = request.auth.uid;

    // 入力検証
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "有効なユーザーIDが必要です");
    }

    // 権限チェック（本人または管理者）
    if (targetUserId !== requestingUserId && !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "自分のクレームのみ取得可能です");
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
      logger.error("Failed to get custom claims", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError(
        "internal",
        `カスタムクレームの取得に失敗しました: ${message}`,
      );
    }
  },
);

/**
 * 同意撤回時の強制ログアウト処理
 * Firestore トリガーで自動実行
 */
export const onConsentWithdrawn = onDocumentCreated(
  {
    region: "asia-northeast1",
    document: "consents/{consentId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      return;
    }

    const consent = snap.data();

    // 同意撤回の場合のみ処理
    if (consent.action !== "withdraw") {
      return;
    }

    const userId = consent.userId as string;
    const type = consent.type as string;

    logger.info(`Consent withdrawn for user: ${userId}`, { type });

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

      // Firestore にも記録
      await db.collection("users").doc(userId).update({
        forceLogout: true,
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogoutReason: `${type}の同意撤回`,
      });

      logger.info(`Force logout set due to consent withdrawal: ${userId}`);
    } catch (error) {
      logger.error("Failed to set force logout on consent withdrawal", error);
    }
  },
);
