/**
 * Stripe Webhook Handler - customer.subscription.updated
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 *
 * サブスクリプション更新時のFirestore更新を処理
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
 * ステータスマッピング
 * Stripeのサブスクリプションステータスをアプリ内ステータスに変換
 */
const STATUS_MAP: Record<string, string> = {
  active: "premium",
  trialing: "premium",
  past_due: "past_due",
  canceled: "free",
  incomplete: "free",
  incomplete_expired: "free",
  unpaid: "past_due",
  paused: "free",
};

/**
 * サブスクリプション更新イベントを処理
 *
 * @param subscription - Stripeサブスクリプションオブジェクト
 * @throws Error - Firebase UIDが見つからない場合
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const childLogger = logger.child({
    functionName: "handleSubscriptionUpdated",
    subscriptionId: subscription.id,
    eventType: "customer.subscription.updated",
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

  // Get previous status for comparison
  const previousData = userDoc.data() as { subscriptionStatus?: string } | undefined;
  const previousStatus = previousData?.subscriptionStatus;

  // Determine new subscription status
  const appStatus = STATUS_MAP[subscription.status] || "free";

  // Extract period timestamps from subscription
  // Stripe v20+ uses different property structure
  const subscriptionAny = subscription as unknown as {
    current_period_end?: number;
  };
  const periodEnd = subscriptionAny.current_period_end;

  // Determine plan name from price
  let planName: string | null = null;
  if (subscription.items?.data?.length > 0) {
    const interval = subscription.items.data[0].price.recurring?.interval;
    if (interval === "year") {
      planName = "premium_annual";
    } else if (interval === "month") {
      planName = "premium_monthly";
    }
  }

  // Build update data
  const updateData: FirestoreUpdateData = {
    subscriptionStatus: appStatus,
    stripeSubscriptionId: subscription.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (periodEnd) {
    updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(
      new Date(periodEnd * 1000),
    );
  }

  // Only update plan if determined
  if (planName) {
    updateData.subscriptionPlan = planName;
  }

  // Handle cancel_at_period_end flag
  if (subscription.cancel_at_period_end) {
    updateData.subscriptionCancelAtPeriodEnd = true;
    if (subscription.cancel_at) {
      updateData.subscriptionCancelAt = admin.firestore.Timestamp.fromDate(
        new Date(subscription.cancel_at * 1000),
      );
    }
  } else {
    // Clear cancel flags if subscription is no longer set to cancel
    updateData.subscriptionCancelAtPeriodEnd = false;
    updateData.subscriptionCancelAt = null;
  }

  await userRef.update(updateData);

  childLogger.info("Subscription updated and user document updated", {
    firebaseUID,
    subscriptionId: subscription.id,
    previousStatus,
    newStatus: appStatus,
    stripeStatus: subscription.status,
    planName,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });

  // Log status transition for monitoring
  if (previousStatus && previousStatus !== appStatus) {
    childLogger.info("Subscription status changed", {
      firebaseUID,
      transition: `${previousStatus} -> ${appStatus}`,
      stripeStatus: subscription.status,
    });
  }
}
