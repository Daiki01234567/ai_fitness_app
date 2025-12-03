/**
 * 同意 Firestore トリガー
 *
 * 同意関連のドキュメント変更を処理
 * 主に同意撤回の通知に使用
 *
 * 法的根拠: GDPR 第7条(3)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * トリガー: 同意レコード作成時
 *
 * 同意撤回が記録された時、ユーザーが適切にログアウトされ
 * 通知されることを保証
 */
export const onConsentCreated = onDocumentCreated(
  {
    document: "consents/{consentId}",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data in consent creation event");
      return;
    }

    const consentData = snapshot.data();
    const consentId = event.params.consentId;

    // 撤回のみを処理
    if (consentData.action !== "revoke") {
      logger.info("Consent action is not revoke, skipping", {
        consentId,
        action: consentData.action,
      });
      return;
    }

    const userId = consentData.userId;
    const consentType = consentData.consentType;

    logger.info("Processing consent revocation", {
      consentId,
      userId,
      consentType,
    });

    try {
      // ユーザーに強制ログアウトフラグが設定されているか確認
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        logger.warn("User not found for consent revocation", { userId });
        return;
      }

      const userData = userDoc.data()!;

      // forceLogoutAt が設定されていない場合、ここで設定
      if (!userData.forceLogoutAt) {
        await userRef.update({
          forceLogoutAt: FieldValue.serverTimestamp(),
        });

        logger.info("Set forceLogoutAt for user", { userId });
      }

      // カスタムクレームが設定されていることを確認
      try {
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};

        if (!currentClaims.forceLogout) {
          await auth.setCustomUserClaims(userId, {
            ...currentClaims,
            forceLogout: true,
            forceLogoutAt: Date.now(),
          });

          logger.info("Set forceLogout custom claim", { userId });
        }
      } catch (authError) {
        logger.error("Failed to set custom claims", authError as Error, { userId });
      }

      // ユーザー用の通知を作成
      const notificationRef = db.collection("notifications").doc();
      await notificationRef.set({
        userId,
        type: "system",
        title: "同意撤回完了",
        body: consentType === "tos"
          ? "利用規約への同意が撤回されました。アプリを使用するには再度同意が必要です。"
          : "プライバシーポリシーへの同意が撤回されました。アプリを使用するには再度同意が必要です。",
        data: {
          consentId,
          consentType,
        },
        read: false,
        sentAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      logger.info("Created notification for consent revocation", {
        userId,
        consentId,
      });

      // 再認証を強制するためにすべてのリフレッシュトークンを取り消す
      try {
        await auth.revokeRefreshTokens(userId);
        logger.info("Revoked refresh tokens for user", { userId });
      } catch (revokeError) {
        logger.warn("Failed to revoke refresh tokens", { error: revokeError, userId });
      }

      logger.info("Consent revocation processed successfully", {
        consentId,
        userId,
      });
    } catch (error) {
      logger.error("Failed to process consent revocation", error as Error, {
        consentId,
        userId,
      });
      throw error;
    }
  },
);

/**
 * トリガー: 同意撤回時（全ての同意）
 *
 * 全ての同意を撤回したユーザーを監視し、
 * 追加の処理が必要かどうかを確認
 */
export const onUserConsentWithdrawn = onDocumentCreated(
  {
    document: "consents/{consentId}",
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const consentData = snapshot.data();

    // 撤回のみを処理
    if (consentData.action !== "revoke") {
      return;
    }

    const userId = consentData.userId;

    try {
      // ユーザーに残りの同意があるかチェック
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return;
      }

      const userData = userDoc.data()!;

      // 両方の同意が撤回された場合、コンプライアンス追跡用にログ出力
      if (!userData.tosAccepted && !userData.ppAccepted) {
        logger.info("User has revoked all consents", {
          userId,
          deletionScheduled: userData.deletionScheduled,
        });

        // 必要に応じてコンプライアンス追跡に追加
        // これにより追加の GDPR プロセスがトリガーされる可能性がある
      }
    } catch (error) {
      logger.error("Failed to check user consent status", error as Error, { userId });
    }
  },
);
