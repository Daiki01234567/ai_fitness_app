/**
 * Setup Intent作成API
 * チケット037: 課金失敗時の再試行
 *
 * docs/common/tickets/037-payment-retry.md に基づく
 *
 * 機能:
 * - カード更新を促すためのSetup Intentを作成
 * - ユーザーがカード情報を更新してから再試行可能
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import {
  CreateSetupIntentResponse,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * Stripe Setup Intent作成
 * カード情報更新を促すためにSetup Intentを作成
 *
 * @param request - Callable Function リクエスト（パラメータなし、認証情報から自動取得）
 * @returns Setup Intent Client Secret
 */
export const stripe_createSetupIntent = onCall(
  {
    // レート制限: 過度な作成を防止
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_createSetupIntent",
      userId: request.auth?.uid,
    });

    childLogger.info("Setup Intent作成開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    try {
      // Firestoreからユーザー情報を取得
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        childLogger.warn("ユーザードキュメントが見つかりません", { userId: uid });
        throw NotFoundError.user(uid).toHttpsError();
      }

      const userData = userDoc.data();
      const customerId = userData?.stripeCustomerId as string | undefined;

      if (!customerId) {
        childLogger.warn("Stripe Customerが見つかりません", { userId: uid });
        throw new HttpsError(
          "not-found",
          "Stripe Customerが見つかりません。サブスクリプションを開始してから実行してください",
        );
      }

      // Stripe Setup Intentを作成
      const stripe = getStripeClient();

      childLogger.info("Setup Intent作成中", { customerId });

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session", // 将来の自動課金に使用
        metadata: {
          firebaseUID: uid,
          purpose: "card_update",
          createdAt: new Date().toISOString(),
        },
      });

      if (!setupIntent.client_secret) {
        childLogger.error("Setup Intent作成失敗: client_secretがありません");
        throw new HttpsError("internal", "支払い方法の更新準備に失敗しました");
      }

      childLogger.info("Setup Intent作成成功", {
        setupIntentId: setupIntent.id,
      });

      const responseData: CreateSetupIntentResponse = {
        clientSecret: setupIntent.client_secret,
      };

      return success(responseData, "カード更新の準備が完了しました");
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // エラータイプに応じた適切なメッセージ
        if (error.type === "StripeInvalidRequestError") {
          if (error.message?.includes("customer")) {
            throw new HttpsError(
              "not-found",
              "Stripe Customerが見つかりません。サポートにお問い合わせください",
            );
          }
          throw new HttpsError(
            "invalid-argument",
            "リクエストが不正です。入力内容を確認してください",
          );
        }

        if (error.type === "StripeRateLimitError") {
          throw new HttpsError(
            "resource-exhausted",
            "リクエストが多すぎます。しばらく待ってから再試行してください",
          );
        }

        if (error.type === "StripeConnectionError") {
          throw new HttpsError(
            "unavailable",
            "決済サービスへの接続に失敗しました。しばらく待ってから再試行してください",
          );
        }

        throw new HttpsError("internal", "支払い方法の更新準備に失敗しました");
      }

      // HttpsErrorはそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "支払い方法の更新準備に失敗しました");
    }
  },
);
