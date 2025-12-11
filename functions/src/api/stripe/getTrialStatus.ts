/**
 * トライアル状態取得API
 * チケット036: 無料トライアル管理API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 * docs/common/tickets/036-free-trial-api.md
 *
 * 機能:
 * - Firestoreからサブスクリプション情報を取得
 * - Stripe APIでトライアル残り日数を計算
 * - トライアル終了予定日を返却
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  GetTrialStatusResponse,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * トライアル残り日数を計算
 *
 * @param trialEnd - トライアル終了日（Unixタイムスタンプ）
 * @returns 残り日数（0以上の整数）
 */
function calculateDaysRemaining(trialEnd: number): number {
  const now = new Date();
  const trialEndDate = new Date(trialEnd * 1000);
  const diff = trialEndDate.getTime() - now.getTime();
  // Negative days should return 0
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * トライアル状態取得
 *
 * @param request - Callable Function リクエスト
 * @returns トライアル状態詳細情報
 */
export const stripe_getTrialStatus = onCall(
  {
    // NFR-001: 応答時間200ms以内を目標
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_getTrialStatus",
      userId: request.auth?.uid,
    });

    childLogger.info("トライアル状態取得開始");

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

        const responseData: GetTrialStatusResponse = {
          isTrialing: false,
          hasSubscription: false,
        };

        return success(responseData);
      }

      // Stripeからサブスクリプション詳細を取得
      childLogger.info("Stripeからサブスクリプション取得中", { subscriptionId });

      const stripe = getStripeClient();
      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
      const subscription = subscriptionResponse as Stripe.Subscription;

      // トライアル状態を判定
      const isTrialing = subscription.status === "trialing";
      const trialEnd = subscription.trial_end;

      // レスポンスデータを構築
      const responseData: GetTrialStatusResponse = {
        isTrialing,
        hasSubscription: true,
      };

      // トライアル中の場合、詳細情報を追加
      if (trialEnd) {
        const trialEndDate = new Date(trialEnd * 1000);
        responseData.trialEnd = trialEndDate.toISOString();
        responseData.willBeChargedAt = trialEndDate.toISOString();

        if (isTrialing) {
          responseData.daysRemaining = calculateDaysRemaining(trialEnd);
        }
      }

      childLogger.info("トライアル状態取得成功", {
        subscriptionId: subscription.id,
        status: subscription.status,
        isTrialing,
        daysRemaining: responseData.daysRemaining,
      });

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

          const responseData: GetTrialStatusResponse = {
            isTrialing: false,
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

        throw new HttpsError("internal", "トライアル状態の取得に失敗しました");
      }

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "トライアル状態の取得に失敗しました");
    }
  },
);
