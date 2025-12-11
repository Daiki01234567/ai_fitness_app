/**
 * Stripe Webhook Handler - customer.subscription.created
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md - 8.2章
 *
 * サブスクリプション作成時のFirestore更新を処理
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
 * サブスクリプション作成イベントを処理
 *
 * @param subscription - Stripeサブスクリプションオブジェクト
 * @throws Error - Firebase UIDが見つからない場合
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const childLogger = logger.child({
    functionName: "handleSubscriptionCreated",
    subscriptionId: subscription.id,
    eventType: "customer.subscription.created",
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

  // Determine subscription status
  const appStatus = STATUS_MAP[subscription.status] || "free";

  // Extract period timestamps from subscription
  // Stripe v20+ uses different property structure
  const subscriptionAny = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = subscriptionAny.current_period_start;
  const periodEnd = subscriptionAny.current_period_end;

  // Determine plan name from price
  let planName: string | null = null;
  if (subscription.items?.data?.length > 0) {
    // Determine plan based on price interval
    const interval = subscription.items.data[0].price.recurring?.interval;
    if (interval === "year") {
      planName = "premium_annual";
    } else if (interval === "month") {
      planName = "premium_monthly";
    }
  }

  // Update user document
  const updateData: FirestoreUpdateData = {
    subscriptionStatus: appStatus,
    stripeSubscriptionId: subscription.id,
    subscriptionPlan: planName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (periodStart) {
    updateData.subscriptionStartDate = admin.firestore.Timestamp.fromDate(
      new Date(periodStart * 1000),
    );
  }

  if (periodEnd) {
    updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(
      new Date(periodEnd * 1000),
    );
  }

  await userRef.update(updateData);

  childLogger.info("Subscription created and user document updated", {
    firebaseUID,
    subscriptionId: subscription.id,
    status: subscription.status,
    appStatus,
    planName,
    periodStart: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
}
