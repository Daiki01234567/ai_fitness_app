/**
 * Stripe Webhook ハンドラー
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 *
 * Stripeから送信されるWebhookイベントを受信し、
 * イベントタイプに応じた処理を実行します。
 *
 * セキュリティ要件:
 * - Stripeシグネチャ検証必須
 * - べき等性を担保（重複イベント防止）
 * - リトライ対応（Stripeは最大3日間リトライ）
 *
 * 処理するイベント:
 * - customer.subscription.created: サブスクリプション作成
 * - customer.subscription.updated: サブスクリプション更新
 * - customer.subscription.deleted: サブスクリプション削除
 * - invoice.payment_succeeded: 支払い成功
 * - invoice.payment_failed: 支払い失敗
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { logger } from "../../utils/logger";
import { verifyWebhookSignature } from "../../utils/stripe";

import { handleInvoicePaymentFailed } from "./invoicePaymentFailed";
import { handleInvoicePaymentSucceeded } from "./invoicePaymentSucceeded";
import { handleSubscriptionCreated } from "./subscriptionCreated";
import { handleSubscriptionDeleted } from "./subscriptionDeleted";
import { handleSubscriptionUpdated } from "./subscriptionUpdated";

/**
 * 処理対象のイベントタイプ
 */
const SUPPORTED_EVENT_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
] as const;

type SupportedEventType = typeof SUPPORTED_EVENT_TYPES[number];

/**
 * イベントが処理対象かどうかを判定
 */
function isSupportedEventType(eventType: string): eventType is SupportedEventType {
  return SUPPORTED_EVENT_TYPES.includes(eventType as SupportedEventType);
}

/**
 * イベントが既に処理済みかどうかを確認（べき等性担保）
 *
 * @param eventId - StripeイベントID
 * @returns 処理済みの場合true
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const db = admin.firestore();
  const eventDoc = await db.collection("webhookEvents").doc(eventId).get();
  return eventDoc.exists;
}

/**
 * イベントを処理済みとしてマーク（べき等性担保）
 *
 * @param eventId - StripeイベントID
 * @param eventType - イベントタイプ
 * @param status - 処理結果ステータス
 * @param error - エラー情報（失敗時）
 */
async function markEventAsProcessed(
  eventId: string,
  eventType: string,
  status: "success" | "failed" | "skipped",
  error?: string,
): Promise<void> {
  const db = admin.firestore();
  await db.collection("webhookEvents").doc(eventId).set({
    eventId: eventId,
    eventType: eventType,
    status: status,
    error: error || null,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * イベントデータからサブスクリプションオブジェクトを取得
 */
function getSubscription(event: Stripe.Event): Stripe.Subscription {
  return event.data.object as Stripe.Subscription;
}

/**
 * イベントデータからインボイスオブジェクトを取得
 */
function getInvoice(event: Stripe.Event): Stripe.Invoice {
  return event.data.object as Stripe.Invoice;
}

/**
 * Stripe Webhook エンドポイント
 *
 * HTTPメソッド: POST
 * 認証: Stripeシグネチャ検証
 * URL: https://asia-northeast1-{project-id}.cloudfunctions.net/stripe_webhook
 *
 * @see https://stripe.com/docs/webhooks
 */
export const stripe_webhook = onRequest(
  {
    region: "asia-northeast1",
    maxInstances: 10,
    memory: "256MiB",
    timeoutSeconds: 60,
    // CORS設定: WebhookはStripeからのみ受信するため不要
    cors: false,
  },
  async (req, res) => {
    const childLogger = logger.child({
      functionName: "stripe_webhook",
      method: req.method,
    });

    // POSTメソッドのみ許可
    if (req.method !== "POST") {
      childLogger.warn("Invalid HTTP method", { method: req.method });
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Stripeシグネチャを取得
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      childLogger.error("Stripe signature header is missing");
      res.status(400).send("Webhook Error: No signature");
      return;
    }

    let event: Stripe.Event;

    // シグネチャ検証
    try {
      event = verifyWebhookSignature(req.rawBody, signature);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      childLogger.error("Webhook signature verification failed", err as Error);
      res.status(400).send(`Webhook Error: ${errorMessage}`);
      return;
    }

    childLogger.info("Webhook event received", {
      eventId: event.id,
      eventType: event.type,
      apiVersion: event.api_version,
      created: new Date(event.created * 1000).toISOString(),
    });

    // 処理対象外のイベントはスキップ
    if (!isSupportedEventType(event.type)) {
      childLogger.debug("Unsupported event type, skipping", {
        eventId: event.id,
        eventType: event.type,
      });
      res.json({
        received: true,
        processed: false,
        reason: "unsupported_event_type",
      });
      return;
    }

    // べき等性チェック: 既に処理済みのイベントはスキップ
    try {
      if (await isEventProcessed(event.id)) {
        childLogger.info("Event already processed, skipping", {
          eventId: event.id,
          eventType: event.type,
        });
        res.json({ received: true, processed: false, reason: "already_processed" });
        return;
      }
    } catch (checkError) {
      childLogger.warn("Failed to check event processing status", {
        eventId: event.id,
        error: checkError instanceof Error ? checkError.message : String(checkError),
      });
      // Continue processing even if check fails
    }

    // イベントタイプ別に処理を振り分け
    try {
      switch (event.type) {
        case "customer.subscription.created":
          await handleSubscriptionCreated(getSubscription(event));
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(getSubscription(event));
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(getSubscription(event));
          break;

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(getInvoice(event));
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(getInvoice(event));
          break;
      }

      // 処理成功をマーク
      await markEventAsProcessed(event.id, event.type, "success");

      childLogger.info("Webhook event processed successfully", {
        eventId: event.id,
        eventType: event.type,
      });

      res.json({ received: true, processed: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      childLogger.error("Webhook event processing failed", error as Error, {
        eventId: event.id,
        eventType: event.type,
      });

      // 処理失敗をマーク（リトライ時に再処理されないように）
      try {
        await markEventAsProcessed(event.id, event.type, "failed", errorMessage);
      } catch (markError) {
        childLogger.error("Failed to mark event as failed", markError as Error, {
          eventId: event.id,
        });
      }

      // Stripeにエラーを通知（リトライを促す場合は5xx、促さない場合は2xx）
      // Firebase UIDが見つからない等の永続的なエラーは2xxを返してリトライを防止
      const isPermanentError = errorMessage.includes("Firebase UID not found") ||
        errorMessage.includes("User document not found");

      if (isPermanentError) {
        childLogger.warn("Permanent error, not retrying", {
          eventId: event.id,
          reason: errorMessage,
        });
        res.json({ received: true, processed: false, error: errorMessage });
      } else {
        // 一時的なエラーは500を返してStripeにリトライを促す
        res.status(500).json({ received: false, error: errorMessage });
      }
    }
  },
);
