/**
 * Stripe Webhook Handler - invoice.payment_succeeded
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 *
 * 支払い成功時のFirestore更新と履歴記録を処理
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { logger } from "../../utils/logger";
import { getStripeClient } from "../../utils/stripe";

// Invoice型の拡張（Stripe v20対応）
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

/**
 * 支払い成功イベントを処理
 *
 * @param invoice - Stripeインボイスオブジェクト
 * @throws Error - Firebase UIDが見つからない場合
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const childLogger = logger.child({
    functionName: "handleInvoicePaymentSucceeded",
    invoiceId: invoice.id,
    eventType: "invoice.payment_succeeded",
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

  try {
    const customer = await stripe.customers.retrieve(customerId);

    if ((customer as Stripe.DeletedCustomer).deleted) {
      childLogger.warn("Stripe customer has been deleted", {
        customerId,
        invoiceId: invoice.id,
      });
      return;
    }

    firebaseUID = (customer as Stripe.Customer).metadata?.firebaseUID;
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

  // Record payment in payments collection
  const paymentData: Record<string, unknown> = {
    userId: firebaseUID,
    invoiceId: invoice.id,
    subscriptionId: subscriptionId,
    customerId: customerId,
    amount: invoice.amount_paid,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    status: "succeeded",
    billingReason: invoice.billing_reason,
    invoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    paidAt: invoice.status_transitions?.paid_at
      ? admin.firestore.Timestamp.fromDate(
        new Date(invoice.status_transitions.paid_at * 1000),
      )
      : admin.firestore.FieldValue.serverTimestamp(),
    periodStart: invoice.period_start
      ? admin.firestore.Timestamp.fromDate(new Date(invoice.period_start * 1000))
      : null,
    periodEnd: invoice.period_end
      ? admin.firestore.Timestamp.fromDate(new Date(invoice.period_end * 1000))
      : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("payments").add(paymentData);

  // Update user's last payment timestamp
  await userRef.update({
    lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
    lastPaymentAmount: invoice.amount_paid,
    lastPaymentCurrency: invoice.currency,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Format amount for logging (convert from cents to main currency unit)
  const formattedAmount = (invoice.amount_paid / 100).toFixed(2);

  childLogger.info("Payment succeeded and recorded", {
    firebaseUID,
    invoiceId: invoice.id,
    subscriptionId: subscriptionId,
    amount: invoice.amount_paid,
    formattedAmount: `${formattedAmount} ${invoice.currency.toUpperCase()}`,
    billingReason: invoice.billing_reason,
    paidAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : null,
  });
}
