/**
 * 課金履歴取得API
 * チケット039: 課金履歴API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 *
 * 機能:
 * - Firestoreから顧客IDを取得
 * - Stripe APIでInvoice一覧を取得
 * - ページネーション対応（limit, startingAfter）
 * - 領収書PDFのダウンロードURL提供
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  GetBillingHistoryRequest,
  GetBillingHistoryResponse,
  BillingHistoryPayment,
  isStripeError,
} from "../../types/stripe";
import { AuthenticationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * リクエストパラメータのバリデーション
 *
 * @param data - リクエストデータ
 * @returns バリデーション済みのパラメータ
 */
function validateRequest(data: unknown): GetBillingHistoryRequest {
  const result: GetBillingHistoryRequest = {};

  if (typeof data !== "object" || data === null) {
    return result;
  }

  const requestData = data as Record<string, unknown>;

  // limit のバリデーション
  if (requestData.limit !== undefined) {
    if (typeof requestData.limit !== "number") {
      throw new HttpsError("invalid-argument", "limitは数値で指定してください");
    }
    if (requestData.limit < 1 || requestData.limit > 100) {
      throw new HttpsError("invalid-argument", "limitは1から100の範囲で指定してください");
    }
    result.limit = requestData.limit;
  }

  // startingAfter のバリデーション
  if (requestData.startingAfter !== undefined) {
    if (typeof requestData.startingAfter !== "string") {
      throw new HttpsError("invalid-argument", "startingAfterは文字列で指定してください");
    }
    if (!requestData.startingAfter.startsWith("in_")) {
      throw new HttpsError("invalid-argument", "無効なstartingAfterの形式です");
    }
    result.startingAfter = requestData.startingAfter;
  }

  return result;
}

/**
 * 課金履歴取得
 *
 * @param request - Callable Function リクエスト
 * @returns 課金履歴一覧
 */
export const stripe_getBillingHistory = onCall(
  {
    // レート制限: 50回/時（個別に設定）
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_getBillingHistory",
      userId: request.auth?.uid,
    });

    childLogger.info("課金履歴取得開始");

    // 認証チェック
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    try {
      // リクエストパラメータのバリデーション
      const { limit = 10, startingAfter } = validateRequest(request.data);

      // Firestoreから顧客IDを取得
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        childLogger.warn("ユーザードキュメントが見つかりません", { userId: uid });
        throw new HttpsError("not-found", "ユーザー情報が見つかりません");
      }

      const userData = userDoc.data();
      const customerId = userData?.stripeCustomerId as string | undefined;

      // 顧客IDがない場合は空の結果を返す
      if (!customerId) {
        childLogger.info("Stripe顧客IDなし", { userId: uid });

        const responseData: GetBillingHistoryResponse = {
          payments: [],
          hasMore: false,
        };

        return success(responseData);
      }

      // Stripe APIでInvoice一覧を取得
      childLogger.info("Stripeから課金履歴取得中", { customerId, limit });

      const stripe = getStripeClient();
      const invoiceListParams: {
        customer: string;
        limit: number;
        starting_after?: string;
        status?: "paid" | "open" | "void" | "uncollectible";
      } = {
        customer: customerId,
        limit: limit,
      };

      if (startingAfter) {
        invoiceListParams.starting_after = startingAfter;
      }

      const invoices = await stripe.invoices.list(invoiceListParams);

      // Invoice データを BillingHistoryPayment 形式に変換
      const payments: BillingHistoryPayment[] = invoices.data.map((invoice: Stripe.Invoice) => {
        // 支払い日時を取得（paid_atがない場合はcreated日時を使用）
        let paidAt: string | null = null;
        if (invoice.status_transitions?.paid_at) {
          paidAt = new Date(invoice.status_transitions.paid_at * 1000).toISOString();
        } else if (invoice.status === "paid" && invoice.created) {
          paidAt = new Date(invoice.created * 1000).toISOString();
        }

        // 説明を取得（最初のline itemの説明、なければデフォルト）
        const description =
          invoice.lines?.data?.[0]?.description ||
          invoice.description ||
          "サブスクリプション";

        return {
          id: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status || "unknown",
          paidAt: paidAt,
          invoicePdfUrl: invoice.invoice_pdf || null,
          description: description,
        };
      });

      // 次のページ用のカーソルを設定
      const nextCursor = invoices.has_more && invoices.data.length > 0
        ? invoices.data[invoices.data.length - 1].id
        : undefined;

      childLogger.info("課金履歴取得成功", {
        paymentCount: payments.length,
        hasMore: invoices.has_more,
      });

      const responseData: GetBillingHistoryResponse = {
        payments: payments,
        hasMore: invoices.has_more,
        nextCursor: nextCursor,
      };

      return success(responseData);
    } catch (error) {
      // Stripe APIエラーのハンドリング
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        // 顧客が見つからない場合
        if (error.code === "resource_missing") {
          childLogger.warn("Stripeで顧客が見つかりません");

          const responseData: GetBillingHistoryResponse = {
            payments: [],
            hasMore: false,
          };

          return success(responseData);
        }

        // 無効なリクエストパラメータの場合
        if (error.type === "StripeInvalidRequestError") {
          childLogger.warn("無効なStripeリクエスト", { message: error.message });

          // starting_afterが無効な場合は空の結果を返す
          const responseData: GetBillingHistoryResponse = {
            payments: [],
            hasMore: false,
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

        throw new HttpsError("internal", "課金履歴の取得に失敗しました");
      }

      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      // その他のエラー
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "課金履歴の取得に失敗しました");
    }
  },
);
