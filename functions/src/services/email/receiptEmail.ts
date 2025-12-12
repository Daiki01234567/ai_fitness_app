/**
 * 領収書メール送信サービス
 * チケット040: 領収書生成・送信
 *
 * docs/common/tickets/040-receipt-generation.md
 *
 * 機能:
 * - Firebase Extensions (Trigger Email) を使用したメール送信
 * - Firestore (receiptEmails) への送信履歴記録
 * - 金額フォーマット（JPYは円表示、他は小数点以下2桁）
 */

import * as admin from "firebase-admin";

import { SendReceiptEmailParams } from "../../types/stripe";
import { logger } from "../../utils/logger";

/**
 * 金額をフォーマットする
 * JPYは円表示（小数点なし）、他の通貨は小数点以下2桁
 *
 * @param amount - 金額（Stripeは最小単位で返す）
 * @param currency - 通貨コード
 * @returns フォーマット済みの金額文字列
 */
export function formatAmount(amount: number, currency: string): string {
  const lowerCurrency = currency.toLowerCase();

  // JPYは最小単位が円なのでそのまま表示
  if (lowerCurrency === "jpy") {
    return `${amount.toLocaleString("ja-JP")}円`;
  }

  // その他の通貨は100で割って小数点以下2桁
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * メールアドレスをマスクする
 * 例: test@example.com -> t***t@example.com
 *
 * @param email - メールアドレス
 * @returns マスク済みメールアドレス
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");

  if (!domain) {
    return email; // Invalid email format, return as-is
  }

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * 領収書メールを送信する
 *
 * Firebase Extensions (Trigger Email) を使用してメールを送信し、
 * Firestoreに送信履歴を記録する。
 *
 * @param params - 送信パラメータ
 * @returns 送信成功かどうか
 */
export async function sendReceiptEmail(
  params: SendReceiptEmailParams,
): Promise<boolean> {
  const db = admin.firestore();
  const childLogger = logger.child({
    functionName: "sendReceiptEmail",
    userId: params.userId,
    invoiceId: params.invoiceId,
    type: params.type,
  });

  try {
    childLogger.info("領収書メール送信開始", {
      email: maskEmail(params.email),
      amount: params.amount,
      currency: params.currency,
    });

    // Format date for email template
    const dateString = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Mail collection for Firebase Extensions - Trigger Email
    // This extension watches the 'mail' collection and sends emails
    await db.collection("mail").add({
      to: params.email,
      template: {
        name: "receipt",
        data: {
          invoiceId: params.invoiceId,
          invoicePdfUrl: params.invoicePdfUrl,
          amount: formatAmount(params.amount, params.currency),
          currency: params.currency.toUpperCase(),
          date: dateString,
        },
      },
    });

    // Record successful send in receiptEmails collection
    await db.collection("receiptEmails").add({
      userId: params.userId,
      invoiceId: params.invoiceId,
      email: params.email,
      status: "sent",
      type: params.type,
      invoicePdfUrl: params.invoicePdfUrl,
      amount: params.amount,
      currency: params.currency,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    childLogger.info("領収書メール送信成功", {
      email: maskEmail(params.email),
    });

    return true;
  } catch (error) {
    childLogger.error("領収書メール送信失敗", error as Error, {
      email: maskEmail(params.email),
    });

    // Record failed send in receiptEmails collection
    try {
      await db.collection("receiptEmails").add({
        userId: params.userId,
        invoiceId: params.invoiceId,
        email: params.email,
        status: "failed",
        type: params.type,
        invoicePdfUrl: params.invoicePdfUrl,
        amount: params.amount,
        currency: params.currency,
        errorMessage: (error as Error).message,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (recordError) {
      // Log but don't fail if recording fails
      childLogger.error("送信失敗記録の保存に失敗", recordError as Error);
    }

    return false;
  }
}
