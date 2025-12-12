/**
 * 領収書再送信API
 * チケット040: 領収書生成・送信
 *
 * docs/common/tickets/040-receipt-generation.md
 *
 * 機能:
 * - 過去の領収書をユーザーのメールアドレスに再送信
 * - レート制限（1日5回まで）
 * - Invoice所有権の検証
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import { sendReceiptEmail, maskEmail } from "../../services/email/receiptEmail";
import { ResendReceiptRequest, ResendReceiptResponse, isStripeError } from "../../types/stripe";
import { AuthenticationError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";
import { getStripeClient } from "../../utils/stripe";

/**
 * 1日あたりの再送信上限
 */
const DAILY_RESEND_LIMIT = 5;

/**
 * リクエストパラメータのバリデーション
 *
 * @param data - リクエストデータ
 * @returns バリデーション済みのパラメータ
 * @throws HttpsError - バリデーション失敗時
 */
function validateRequest(data: unknown): ResendReceiptRequest {
  if (typeof data !== "object" || data === null) {
    throw new HttpsError("invalid-argument", "リクエストデータが不正です");
  }

  const requestData = data as Record<string, unknown>;
  const { invoiceId } = requestData;

  if (!invoiceId || typeof invoiceId !== "string") {
    throw new HttpsError("invalid-argument", "Invoice IDは必須です");
  }

  // Stripe Invoice ID format check
  if (!invoiceId.startsWith("in_")) {
    throw new HttpsError("invalid-argument", "無効なInvoice IDの形式です");
  }

  return { invoiceId };
}

/**
 * レート制限をチェック
 *
 * @param db - Firestore instance
 * @param userId - ユーザーID
 * @returns レート制限に達しているかどうか
 */
async function checkRateLimit(
  db: FirebaseFirestore.Firestore,
  userId: string,
): Promise<boolean> {
  // Get start of today (JST)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const resendCount = await db
    .collection("receiptEmails")
    .where("userId", "==", userId)
    .where("type", "==", "resend")
    .where("sentAt", ">=", admin.firestore.Timestamp.fromDate(today))
    .count()
    .get();

  return resendCount.data().count >= DAILY_RESEND_LIMIT;
}

/**
 * 領収書再送信 Callable Function
 *
 * @param request - Callable Function リクエスト
 * @returns 送信結果
 */
export const stripe_resendReceipt = onCall(
  {
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const childLogger = logger.child({
      functionName: "stripe_resendReceipt",
      userId: request.auth?.uid,
    });

    childLogger.info("領収書再送信リクエスト開始");

    // Authentication check
    if (!request.auth) {
      childLogger.warn("認証なしでのアクセス試行");
      throw new AuthenticationError().toHttpsError();
    }

    const uid = request.auth.uid;

    try {
      // Validate request
      const { invoiceId } = validateRequest(request.data);
      childLogger.info("リクエストバリデーション成功", { invoiceId });

      const db = admin.firestore();

      // Check rate limit
      const rateLimitExceeded = await checkRateLimit(db, uid);
      if (rateLimitExceeded) {
        childLogger.warn("レート制限超過", { userId: uid });
        throw new HttpsError(
          "resource-exhausted",
          `領収書の再送信は1日${DAILY_RESEND_LIMIT}回までです`,
        );
      }

      // Get user information
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        childLogger.warn("ユーザードキュメントが見つかりません", { userId: uid });
        throw new HttpsError("not-found", "ユーザー情報が見つかりません");
      }

      const userData = userDoc.data();
      const customerId = userData?.stripeCustomerId as string | undefined;
      const email = userData?.email as string | undefined;

      if (!customerId) {
        childLogger.warn("Stripe顧客IDなし", { userId: uid });
        throw new HttpsError("failed-precondition", "課金情報がありません");
      }

      if (!email) {
        childLogger.warn("メールアドレスなし", { userId: uid });
        throw new HttpsError("failed-precondition", "メールアドレスが設定されていません");
      }

      // Retrieve invoice from Stripe
      childLogger.info("Stripeからインボイス取得中", { invoiceId });
      const stripe = getStripeClient();
      const invoice = await stripe.invoices.retrieve(invoiceId);

      // Verify ownership
      const invoiceCustomerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;

      if (invoiceCustomerId !== customerId) {
        childLogger.warn("不正な領収書アクセス試行", {
          userId: uid,
          invoiceId,
          expectedCustomerId: customerId,
          actualCustomerId: invoiceCustomerId,
        });
        throw new HttpsError("permission-denied", "この領収書にアクセスする権限がありません");
      }

      // Check if invoice PDF exists
      if (!invoice.invoice_pdf) {
        childLogger.warn("領収書PDFなし", { invoiceId });
        throw new HttpsError("not-found", "領収書PDFが見つかりません");
      }

      // Send receipt email
      const sent = await sendReceiptEmail({
        userId: uid,
        email: email,
        invoiceId: invoice.id,
        invoicePdfUrl: invoice.invoice_pdf,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        type: "resend",
      });

      if (!sent) {
        childLogger.error("領収書メール送信失敗", undefined, { invoiceId });
        throw new HttpsError("internal", "領収書の送信に失敗しました");
      }

      // Prepare response
      const maskedEmail = maskEmail(email);
      const sentAt = new Date().toISOString();

      childLogger.info("領収書再送信成功", {
        invoiceId,
        email: maskedEmail,
      });

      const responseData: ResendReceiptResponse = {
        sent: true,
        invoiceId: invoice.id,
        email: maskedEmail,
        sentAt: sentAt,
      };

      return success(responseData);
    } catch (error) {
      // Handle Stripe API errors
      if (isStripeError(error)) {
        childLogger.error("Stripe APIエラー", error, {
          type: error.type,
          code: error.code,
        });

        if (error.code === "resource_missing") {
          throw new HttpsError("not-found", "指定されたInvoiceが見つかりません");
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

        throw new HttpsError("internal", "領収書の取得に失敗しました");
      }

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Unexpected error
      childLogger.error("予期しないエラー", error as Error);
      throw new HttpsError("internal", "領収書の再送信に失敗しました");
    }
  },
);
