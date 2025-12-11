/**
 * Stripe Webhook Handler - invoice.payment_failed
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 * チケット037（支払い失敗リカバリー）と連携
 *
 * 支払い失敗時の処理とユーザー通知を実行
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { logger } from "../../utils/logger";
import { getStripeClient } from "../../utils/stripe";

// Firestore UpdateData型
type FirestoreUpdateData = {
  [key: string]:
    | admin.firestore.FieldValue
    | string
    | number
    | boolean
    | null
    | admin.firestore.Timestamp;
};

// Invoice型の拡張（Stripe v20対応）
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
  charge?: string | Stripe.Charge | null;
}

/**
 * 支払い失敗の理由をユーザーフレンドリーなメッセージに変換
 */
const FAILURE_REASON_MAP: Record<string, string> = {
  card_declined: "カードが拒否されました",
  insufficient_funds: "残高不足です",
  expired_card: "カードの有効期限が切れています",
  incorrect_cvc: "CVCコードが正しくありません",
  processing_error: "決済処理中にエラーが発生しました",
  incorrect_number: "カード番号が正しくありません",
  authentication_required: "追加の認証が必要です",
  generic_decline: "カードが拒否されました",
};

/**
 * 支払い失敗イベントを処理
 *
 * @param invoice - Stripeインボイスオブジェクト
 * @throws Error - Firebase UIDが見つからない場合
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const childLogger = logger.child({
    functionName: "handleInvoicePaymentFailed",
    invoiceId: invoice.id,
    eventType: "invoice.payment_failed",
  });

  // Cast to extended type to access subscription
  const invoiceData = invoice as InvoiceWithSubscription;
  const subscriptionId = typeof invoiceData.subscription === "string"
    ? invoiceData.subscription
    : invoiceData.subscription?.id;

  // Skip if invoice is not related to a subscription
  if (!subscriptionId) {
    childLogger.debug("Invoice is not related to a subscription, skipping", {
      invoiceId: invoice.id,
      billingReason: invoice.billing_reason,
    });
    return;
  }

  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    childLogger.error("Customer ID not found in invoice", undefined, {
      invoiceId: invoice.id,
    });
    throw new Error(`Customer ID not found in invoice: ${invoice.id}`);
  }

  // Get Firebase UID from Stripe customer
  const stripe = getStripeClient();
  let firebaseUID: string | undefined;
  let customerEmail: string | undefined;

  try {
    const customer = await stripe.customers.retrieve(customerId);

    if ((customer as Stripe.DeletedCustomer).deleted) {
      childLogger.warn("Stripe customer has been deleted", {
        customerId,
        invoiceId: invoice.id,
      });
      return;
    }

    const stripeCustomer = customer as Stripe.Customer;
    firebaseUID = stripeCustomer.metadata?.firebaseUID;
    customerEmail = stripeCustomer.email || undefined;
  } catch (customerError) {
    childLogger.error("Failed to retrieve Stripe customer", customerError as Error, {
      customerId,
      invoiceId: invoice.id,
    });
    throw customerError;
  }

  if (!firebaseUID) {
    childLogger.error("Firebase UID not found in customer metadata", undefined, {
      customerId,
      invoiceId: invoice.id,
    });
    throw new Error(`Firebase UID not found for customer: ${customerId}`);
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(firebaseUID);

  // Check if user exists
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    childLogger.error("User document not found", undefined, {
      firebaseUID,
      invoiceId: invoice.id,
    });
    throw new Error(`User document not found for firebaseUID: ${firebaseUID}`);
  }

  // Extract failure reason from charge
  let failureCode = "unknown";
  let failureMessage = "支払いに失敗しました";

  // Try to get charge details if available
  const chargeId = typeof invoiceData.charge === "string"
    ? invoiceData.charge
    : invoiceData.charge?.id;

  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      failureCode = charge.failure_code || "unknown";
      failureMessage = charge.failure_message || "支払いに失敗しました";
    } catch {
      childLogger.debug("Could not retrieve charge details", {
        chargeId,
        invoiceId: invoice.id,
      });
    }
  }

  const userFriendlyMessage = FAILURE_REASON_MAP[failureCode] || failureMessage;

  // Record failed payment
  const paymentData: Record<string, unknown> = {
    userId: firebaseUID,
    invoiceId: invoice.id,
    subscriptionId: subscriptionId,
    customerId: customerId,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    billingReason: invoice.billing_reason,
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: invoice.next_payment_attempt
      ? admin.firestore.Timestamp.fromDate(
        new Date(invoice.next_payment_attempt * 1000),
      )
      : null,
    failureCode: failureCode,
    failureMessage: failureMessage,
    userFriendlyMessage: userFriendlyMessage,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("payments").add(paymentData);

  // Update user document with payment failure information
  const updateData: FirestoreUpdateData = {
    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentFailureReason: userFriendlyMessage,
    paymentFailureCode: failureCode,
    paymentAttemptCount: invoice.attempt_count,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If multiple attempts failed, update subscription status
  // Stripe typically retries up to 4 times over ~3 weeks
  if (invoice.attempt_count >= 2) {
    updateData.subscriptionStatus = "past_due";
    childLogger.warn("Multiple payment attempts failed, marking subscription as past_due", {
      firebaseUID,
      attemptCount: invoice.attempt_count,
    });
  }

  await userRef.update(updateData);

  // Create notification for user
  try {
    await db.collection("notifications").add({
      userId: firebaseUID,
      type: "payment_failed",
      title: "お支払いに失敗しました",
      body: userFriendlyMessage,
      data: {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
        nextAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (notificationError) {
    childLogger.warn("Failed to create payment failure notification", {
      firebaseUID,
      error: notificationError instanceof Error
        ? notificationError.message
        : String(notificationError),
    });
  }

  // Format amount for logging
  const formattedAmount = (invoice.amount_due / 100).toFixed(2);

  childLogger.warn("Payment failed", {
    firebaseUID,
    invoiceId: invoice.id,
    subscriptionId: subscriptionId,
    amount: invoice.amount_due,
    formattedAmount: `${formattedAmount} ${invoice.currency.toUpperCase()}`,
    attemptCount: invoice.attempt_count,
    failureCode,
    failureMessage,
    nextPaymentAttempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : "none",
    customerEmail,
  });
}
