/**
 * Stripe Webhook Handler - customer.subscription.deleted
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 *
 * サブスクリプション削除（キャンセル完了）時のFirestore更新を処理
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { logger } from "../../utils/logger";

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

/**
 * サブスクリプション削除イベントを処理
 *
 * @param subscription - Stripeサブスクリプションオブジェクト
 * @throws Error - Firebase UIDが見つからない場合
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const childLogger = logger.child({
    functionName: "handleSubscriptionDeleted",
    subscriptionId: subscription.id,
    eventType: "customer.subscription.deleted",
  });

  const firebaseUID = subscription.metadata?.firebaseUID;

  if (!firebaseUID) {
    childLogger.error("Firebase UID not found in subscription metadata", undefined, {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    });
    throw new Error(`Firebase UID not found for subscription: ${subscription.id}`);
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(firebaseUID);

  // Check if user exists
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    childLogger.error("User document not found", undefined, {
      firebaseUID,
      subscriptionId: subscription.id,
    });
    throw new Error(`User document not found for firebaseUID: ${firebaseUID}`);
  }

  // Get previous status for logging
  const previousData = userDoc.data() as {
    subscriptionStatus?: string;
    subscriptionPlan?: string;
  } | undefined;
  const previousStatus = previousData?.subscriptionStatus;
  const previousPlan = previousData?.subscriptionPlan;

  // Update user document - revert to free tier
  const updateData: FirestoreUpdateData = {
    subscriptionStatus: "free",
    subscriptionPlan: null,
    stripeSubscriptionId: null,
    subscriptionEndDate: null,
    subscriptionCancelAtPeriodEnd: false,
    subscriptionCancelAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userRef.update(updateData);

  childLogger.info("Subscription deleted and user reverted to free tier", {
    firebaseUID,
    subscriptionId: subscription.id,
    previousStatus,
    previousPlan,
    stripeStatus: subscription.status,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    endedAt: subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : null,
  });

  // Store cancellation record for analytics
  try {
    await db.collection("subscriptionHistory").add({
      userId: firebaseUID,
      subscriptionId: subscription.id,
      event: "subscription_deleted",
      previousStatus,
      previousPlan,
      canceledAt: subscription.canceled_at
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.canceled_at * 1000))
        : null,
      endedAt: subscription.ended_at
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.ended_at * 1000))
        : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    childLogger.debug("Subscription cancellation recorded in history", {
      firebaseUID,
      subscriptionId: subscription.id,
    });
  } catch (historyError) {
    // Don't fail the webhook for history recording errors
    childLogger.warn("Failed to record subscription cancellation history", {
      firebaseUID,
      subscriptionId: subscription.id,
      error: historyError instanceof Error ? historyError.message : String(historyError),
    });
  }
}
