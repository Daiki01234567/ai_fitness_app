/**
 * サブスクリプション解約API
 * チケット035: サブスクリプション解約API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 *
 * 機能:
 * - 即時解約と期間終了時解約の切り替え
 * - Stripe APIでサブスクリプションをキャンセル
 * - Firestoreのサブスクリプション情報を更新
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * サブスクリプション解約
 *
 * @param request - Callable Function リクエスト
 * @returns 解約結果情報
 */
export const stripe_cancelSubscription = onCall(
  {
    // レート制限: 10回/時（個別に設定）
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_cancelSubscription",
      userId: request.auth?.uid,
    });

    childLogger.info("サブスクリプション解約開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    // リクエストデータの取得
    const data = request.data as CancelSubscriptionRequest;
    const cancelImmediately = data?.cancelImmediately === true;

    childLogger.info("解約モード", { cancelImmediately });

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

      const stripe = getStripeClient();

      if (cancelImmediately) {
        // 即時解約
        childLogger.info("即時解約実行中", { subscriptionId });

        const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

        // Firestoreを更新（即時解約なのでサブスクリプション情報をクリア）
        await userRef.update({
          subscriptionStatus: "free",
          subscriptionPlan: null,
          stripeSubscriptionId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        childLogger.info("即時解約成功", {
          subscriptionId: canceledSubscription.id,
          status: canceledSubscription.status,
        });

        const responseData: CancelSubscriptionResponse = {
          subscriptionId: canceledSubscription.id,
          status: "canceled",
          message: "サブスクリプションを解約しました",
        };

        return success(responseData, "サブスクリプションを解約しました");
      } else {
        // 期間終了時に解約（デフォルト）
        childLogger.info("期間終了時解約設定中", { subscriptionId });

        const canceledSubscriptionResponse = await stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
          },
        );
        const canceledSubscription = canceledSubscriptionResponse as Stripe.Subscription;

        // Firestoreを更新（解約予定フラグのみ更新、サブスクリプション情報は維持）
        await userRef.update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // current_period_end は items.data[0] から取得（Stripe v20+）
        const subscriptionItem = canceledSubscription.items.data[0];
        const currentPeriodEnd = subscriptionItem?.current_period_end ??
          (canceledSubscription.created + 30 * 24 * 60 * 60);

        const cancelAt = new Date(currentPeriodEnd * 1000);

        childLogger.info("期間終了時解約設定成功", {
          subscriptionId: canceledSubscription.id,
          cancelAt: cancelAt.toISOString(),
        });

        // 日本語フォーマットで日付を表示
        const cancelAtFormatted = cancelAt.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const message = `${cancelAtFormatted}にサブスクリプションが解約されます`;

        const responseData: CancelSubscriptionResponse = {
          subscriptionId: canceledSubscription.id,
          status: "active",
          cancelAt: cancelAt.toISOString(),
          message: message,
        };

        return success(responseData, message);
      }
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // サブスクリプションが見つからない場合
        if (error.code === "resource_missing") {
          throw new HttpsError(
            "not-found",
            "サブスクリプションが見つかりません",
          );
        }

        // 既に解約済みの場合
        if (error.message?.includes("already canceled")) {
          throw new HttpsError(
            "failed-precondition",
            "既に解約済みです",
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

        throw new HttpsError("internal", "サブスクリプションの解約に失敗しました");
      }

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "サブスクリプションの解約に失敗しました");
    }
  },
);
