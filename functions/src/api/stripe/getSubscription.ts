/**
 * サブスクリプション取得API
 * チケット033: サブスクリプション確認API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 *
 * 機能:
 * - Firestoreからサブスクリプション情報を取得
 * - Stripe APIで最新のサブスクリプション詳細を取得
 * - トライアル情報を含む詳細情報を返却
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  StripeGetSubscriptionResponse,
  StripeSubscriptionDetail,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * サブスクリプション情報取得
 *
 * @param request - Callable Function リクエスト
 * @returns サブスクリプション詳細情報
 */
export const stripe_getSubscription = onCall(
  {
    // レート制限: 50回/時（個別に設定）
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_getSubscription",
      userId: request.auth?.uid,
    });

    childLogger.info("サブスクリプション情報取得開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    try {
      // Firestoreからサブスクリプション情報を取得
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        childLogger.warn("ユーザードキュメントが見つかりません", { userId: uid });
        throw new HttpsError("not-found", "ユーザー情報が見つかりません");
      }

      const userData = userDoc.data();
      const subscriptionId = userData?.stripeSubscriptionId as string | undefined;

      // サブスクリプションがない場合
      if (!subscriptionId) {
        childLogger.info("サブスクリプションなし", { userId: uid });

        const responseData: StripeGetSubscriptionResponse = {
          hasSubscription: false,
        };

        return success(responseData);
      }

      // Stripeからサブスクリプション詳細を取得
      childLogger.info("Stripeからサブスクリプション取得中", { subscriptionId });

      const stripe = getStripeClient();
      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
      // Stripe Response を Subscription として扱う
      const subscription = subscriptionResponse as Stripe.Subscription;

      // サブスクリプション詳細を構築
      // Stripe v20+では current_period_start/end は SubscriptionItem にある
      const priceItem = subscription.items.data[0];
      const productId = priceItem?.price?.product;
      const planName = priceItem?.price?.nickname ||
        (typeof productId === "string" ? productId : "Premium");

      // current_period_start/end は items.data[0] から取得
      const currentPeriodStart = priceItem?.current_period_start ?? subscription.created;
      const currentPeriodEnd = priceItem?.current_period_end ?? (subscription.created + 30 * 24 * 60 * 60);

      const subscriptionDetail: StripeSubscriptionDetail = {
        id: subscription.id,
        status: subscription.status,
        planName: planName,
        currentPeriodStart: new Date(currentPeriodStart * 1000).toISOString(),
        currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };

      // トライアル中の場合、トライアル終了日を追加
      if (subscription.trial_end) {
        subscriptionDetail.trialEnd = new Date(
          subscription.trial_end * 1000,
        ).toISOString();
      }

      childLogger.info("サブスクリプション情報取得成功", {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      const responseData: StripeGetSubscriptionResponse = {
        hasSubscription: true,
        subscription: subscriptionDetail,
      };

      return success(responseData);
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // サブスクリプションが見つからない場合
        if (error.code === "resource_missing") {
          childLogger.warn("Stripeでサブスクリプションが見つかりません");

          const responseData: StripeGetSubscriptionResponse = {
            hasSubscription: false,
          };

          return success(responseData);
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

        throw new HttpsError("internal", "サブスクリプション情報の取得に失敗しました");
      }

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "サブスクリプション情報の取得に失敗しました");
    }
  },
);
