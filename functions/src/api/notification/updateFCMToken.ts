/**
 * FCMトークン更新 API
 *
 * ユーザーのFCMトークンを更新
 * チケット 022 対応
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuthWithWritePermission } from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import { UpdateFCMTokenRequest } from "../../types/notification";
import { userRef } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * FCMトークンのバリデーション
 */
function validateFCMToken(token: unknown): string {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "FCMトークンは空でない文字列である必要があります",
    );
  }

  // FCMトークンの基本的な形式チェック
  const trimmedToken = token.trim();

  // FCMトークンは通常152文字以上
  if (trimmedToken.length < 100) {
    throw new HttpsError(
      "invalid-argument",
      "FCMトークンの形式が不正です",
    );
  }

  return trimmedToken;
}

/* eslint-disable camelcase */
/**
 * FCMトークン更新 callable 関数
 *
 * ユーザーのFCMトークンを更新して、プッシュ通知を受信できるようにする
 */
export const notification_updateFCMToken = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request: CallableRequest<UpdateFCMTokenRequest>) => {
    // 認証と書き込み権限を確認
    const authContext = await requireAuthWithWritePermission(request);
    const userId = authContext.uid;

    // レート制限チェック
    await rateLimiter.check("NOTIFICATION_FCM_UPDATE", userId);

    // 入力をバリデート
    const fcmToken = validateFCMToken(request.data?.fcmToken);

    logger.info("Updating FCM token", { userId });

    try {
      // ユーザーの存在確認
      const userDoc = await userRef(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      // FCMトークンを更新
      await userRef(userId).update({
        fcmToken,
        fcmTokenUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("FCM token updated successfully", { userId });

      return {
        success: true,
        message: "FCMトークンを更新しました",
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to update FCM token", error as Error, { userId });
      throw new HttpsError("internal", "FCMトークンの更新に失敗しました");
    }
  },
);
/* eslint-enable camelcase */
