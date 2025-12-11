/**
 * Checkout Session作成API
 * チケット032: サブスクリプション作成API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8.1章
 *
 * 機能:
 * - Stripe Checkout Sessionを作成
 * - 7日間の無料トライアルを自動適用
 * - プロモーションコード入力を許可
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";

import { getOrCreateStripeCustomer } from "../../services/stripe";
import {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * Price IDのバリデーション
 * price_で始まる文字列であることを確認
 */
function isValidPriceId(priceId: unknown): priceId is string {
  return typeof priceId === "string" && priceId.startsWith("price_") && priceId.length > 6;
}

/**
 * URLのバリデーション
 * 有効なHTTP/HTTPS URLであることを確認
 */
function isValidUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Stripe Checkout Session作成
 *
 * @param request - Callable Function リクエスト
 * @returns Checkout Session IDとURL
 */
export const stripe_createCheckoutSession = onCall(
  {
    // レート制限: 10回/時（個別に設定）
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_createCheckoutSession",
      userId: request.auth?.uid,
    });

    childLogger.info("Checkout Session作成開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || "";

    // リクエストデータの取得
    const data = request.data as CreateCheckoutSessionRequest;
    const { priceId, successUrl, cancelUrl } = data;

    // バリデーション: priceId
    if (!isValidPriceId(priceId)) {
      childLogger.warn("無効なpriceId", { priceId });
      throw ValidationError.field(
        "priceId",
        "priceIdが無効です。price_で始まる有効な価格IDを指定してください",
        "format:price_*",
      ).toHttpsError();
    }

    // バリデーション: successUrl
    if (!isValidUrl(successUrl)) {
      childLogger.warn("無効なsuccessUrl", { successUrl });
      throw ValidationError.field(
        "successUrl",
        "successUrlが無効です。有効なURLを指定してください",
        "format:url",
      ).toHttpsError();
    }

    // バリデーション: cancelUrl
    if (!isValidUrl(cancelUrl)) {
      childLogger.warn("無効なcancelUrl", { cancelUrl });
      throw ValidationError.field(
        "cancelUrl",
        "cancelUrlが無効です。有効なURLを指定してください",
        "format:url",
      ).toHttpsError();
    }

    try {
      // Stripe Customerを取得または作成
      childLogger.info("Stripe Customer取得/作成中");
      const { customerId } = await getOrCreateStripeCustomer(uid, email);

      // Stripe Checkout Sessionを作成
      const stripe = getStripeClient();

      childLogger.info("Checkout Session作成中", { customerId, priceId });

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          trial_period_days: 7, // 7日間無料トライアル
          metadata: {
            firebaseUID: uid,
          },
        },
        allow_promotion_codes: true, // プロモーションコード入力を許可
        locale: "ja", // 日本語表示
        billing_address_collection: "required", // 請求先住所を要求
      });

      childLogger.info("Checkout Session作成成功", {
        sessionId: session.id,
        hasUrl: !!session.url,
      });

      const responseData: CreateCheckoutSessionResponse = {
        sessionId: session.id,
        url: session.url,
      };

      return success(responseData, "決済セッションを作成しました");
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // エラータイプに応じた適切なメッセージ
        if (error.type === "StripeInvalidRequestError") {
          if (error.message?.includes("price")) {
            throw new HttpsError(
              "invalid-argument",
              "無効な価格IDです。正しい価格IDを指定してください",
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

        throw new HttpsError("internal", "決済セッションの作成に失敗しました");
      }

      // その他のエラー
      if (error instanceof HttpsError) {
        throw error;
      }

      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "決済セッションの作成に失敗しました");
    }
  },
);
