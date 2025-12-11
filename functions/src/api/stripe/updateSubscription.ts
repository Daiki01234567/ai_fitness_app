/**
 * サブスクリプション更新API
 * チケット034: サブスクリプション更新API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 *
 * 機能:
 * - サブスクリプションプランの変更
 * - 即時変更（proration有効）と次回請求時変更を選択可能
 * - Firestoreのサブスクリプション情報を更新
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
  ValidProrationBehaviors,
  ProrationBehavior,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * Price IDのバリデーション
 */
function isValidPriceId(priceId: unknown): priceId is string {
  return typeof priceId === "string" && priceId.startsWith("price_") && priceId.length > 6;
}

/**
 * Proration Behaviorのバリデーション
 */
function isValidProrationBehavior(behavior: unknown): behavior is ProrationBehavior {
  return typeof behavior === "string" &&
    ValidProrationBehaviors.includes(behavior as ProrationBehavior);
}

/**
 * サブスクリプション更新
 *
 * @param request - Callable Function リクエスト
 * @returns 更新後のサブスクリプション情報
 */
export const stripe_updateSubscription = onCall(
  {
    // レート制限: 10回/時（個別に設定）
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_updateSubscription",
      userId: request.auth?.uid,
    });

    childLogger.info("サブスクリプション更新開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    // リクエストデータの取得
    const data = request.data as UpdateSubscriptionRequest;
    const { newPriceId, prorationBehavior = "create_prorations" } = data;

    // バリデーション: newPriceId
    if (!isValidPriceId(newPriceId)) {
      childLogger.warn("無効なnewPriceId", { newPriceId });
      throw ValidationError.field(
        "newPriceId",
        "newPriceIdが無効です。price_で始まる有効な価格IDを指定してください",
        "format:price_*",
      ).toHttpsError();
    }

    // バリデーション: prorationBehavior
    if (!isValidProrationBehavior(prorationBehavior)) {
      childLogger.warn("無効なprorationBehavior", { prorationBehavior });
      throw ValidationError.field(
        "prorationBehavior",
        "prorationBehaviorが無効です。create_prorations, none, always_invoiceのいずれかを指定してください",
        "enum:create_prorations|none|always_invoice",
      ).toHttpsError();
    }

    try {
      // Firestoreからサブスクリプション情報を取得
      const db = admin.firestore();
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        childLogger.warn("ユーザードキュメントが見つかりません", { userId: uid });
        throw new HttpsError("not-found", "ユーザー情報が見つかりません");
      }

      const userData = userDoc.data();
      const subscriptionId = userData?.stripeSubscriptionId as string | undefined;

      // サブスクリプションの存在確認
      if (!subscriptionId) {
        childLogger.warn("サブスクリプションが見つかりません", { userId: uid });
        throw new HttpsError(
          "failed-precondition",
          "サブスクリプションが見つかりません",
        );
      }

      // Stripeでサブスクリプションを取得
      const stripe = getStripeClient();

      childLogger.info("現在のサブスクリプション取得中", { subscriptionId });
      const currentSubscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
      const currentSubscription = currentSubscriptionResponse as Stripe.Subscription;

      // サブスクリプションがアクティブか確認
      if (currentSubscription.status === "canceled") {
        childLogger.warn("解約済みのサブスクリプション", { subscriptionId });
        throw new HttpsError(
          "failed-precondition",
          "解約済みのサブスクリプションは更新できません",
        );
      }

      // 現在のサブスクリプションアイテムIDを取得
      const currentItemId = currentSubscription.items.data[0]?.id;
      if (!currentItemId) {
        childLogger.error("サブスクリプションアイテムが見つかりません", undefined, { subscriptionId });
        throw new HttpsError("internal", "サブスクリプション情報が不正です");
      }

      // Stripeでサブスクリプションを更新
      childLogger.info("サブスクリプション更新中", {
        subscriptionId,
        newPriceId,
        prorationBehavior,
      });

      const updatedSubscriptionResponse = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: prorationBehavior,
      });
      const updatedSubscription = updatedSubscriptionResponse as Stripe.Subscription;

      // Firestoreを更新
      await userRef.update({
        subscriptionPlan: newPriceId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      childLogger.info("サブスクリプション更新成功", {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        newPriceId,
      });

      // レスポンスメッセージの生成
      const message = prorationBehavior === "none"
        ? "次回請求時に新しいプランに変更されます"
        : "プランを変更しました";

      // current_period_end は items.data[0] から取得（Stripe v20+）
      const updatedItem = updatedSubscription.items.data[0];
      const currentPeriodEnd = updatedItem?.current_period_end ??
        (updatedSubscription.created + 30 * 24 * 60 * 60);

      const responseData: UpdateSubscriptionResponse = {
        subscriptionId: updatedSubscription.id,
        newPriceId: newPriceId,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
        message: message,
      };

      return success(responseData, message);
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // 価格IDが無効な場合
        if (error.type === "StripeInvalidRequestError") {
          if (error.message?.includes("price")) {
            throw new HttpsError(
              "invalid-argument",
              "無効な価格IDです",
            );
          }
          if (error.message?.includes("subscription")) {
            throw new HttpsError(
              "not-found",
              "サブスクリプションが見つかりません",
            );
          }
          throw new HttpsError(
            "invalid-argument",
            "リクエストが不正です",
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
            "決済サービスへの接続に失敗しました",
          );
        }

        throw new HttpsError("internal", "サブスクリプションの更新に失敗しました");
      }

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "サブスクリプションの更新に失敗しました");
    }
  },
);
