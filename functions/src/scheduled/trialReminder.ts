/**
 * トライアル終了前リマインダー通知
 * チケット036: 無料トライアル管理API
 *
 * docs/common/tickets/036-free-trial-api.md
 *
 * 機能:
 * - 毎日午前9時（JST）に実行
 * - トライアル終了3日前のユーザーに通知を送る
 * - Cloud Scheduler を使用
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import Stripe from "stripe";

import { logger } from "../utils/logger";
import { getStripeClient } from "../utils/stripe";

/**
 * トライアル終了3日前の日数
 */
const REMINDER_DAYS_BEFORE = 3;

/**
 * トライアルリマインダー通知を送信
 *
 * @param userId - ユーザーID
 * @param trialEnd - トライアル終了日
 */
async function sendTrialReminderNotification(
  userId: string,
  trialEnd: Date,
): Promise<void> {
  const db = admin.firestore();

  // 通知ドキュメントを作成（通知システムは別チケットで実装）
  const notification = {
    userId,
    type: "trial_ending_reminder",
    title: "トライアル期間終了のお知らせ",
    body: `無料トライアル期間が${formatDate(trialEnd)}に終了します。引き続きプレミアム機能をご利用いただくには、お支払い方法をご確認ください。`,
    data: {
      trialEnd: trialEnd.toISOString(),
      daysRemaining: REMINDER_DAYS_BEFORE,
    },
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection("notifications").add(notification);
    logger.info("トライアルリマインダー通知を作成しました", {
      userId,
      trialEnd: trialEnd.toISOString(),
    });
  } catch (error) {
    logger.error("通知の作成に失敗しました", error as Error, { userId });
    throw error;
  }
}

/**
 * 日付を日本語形式でフォーマット
 *
 * @param date - 日付
 * @returns フォーマットされた日付文字列
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
}

/**
 * トライアル残り日数を計算
 *
 * @param trialEnd - トライアル終了日（Date）
 * @param now - 現在日時
 * @returns 残り日数（整数）
 */
function calculateDaysRemaining(trialEnd: Date, now: Date): number {
  const diff = trialEnd.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * トライアル終了前リマインダースケジューラー
 *
 * 毎日午前9時（JST）に実行
 * トライアル終了3日前のユーザーに通知を送る
 */
export const scheduled_trialReminder = onSchedule(
  {
    schedule: "0 9 * * *", // 毎日午前9時（JST）
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 540, // 9分
  },
  async () => {
    const startTime = Date.now();
    const now = new Date();

    logger.info("トライアルリマインダー処理を開始", {
      timestamp: now.toISOString(),
      reminderDaysBefore: REMINDER_DAYS_BEFORE,
    });

    const db = admin.firestore();

    try {
      // Firestoreからトライアル中のユーザーを取得
      const usersSnapshot = await db
        .collection("users")
        .where("subscriptionStatus", "==", "trialing")
        .get();

      if (usersSnapshot.empty) {
        logger.info("トライアル中のユーザーがいません");
        return;
      }

      logger.info("トライアル中のユーザーを取得", {
        count: usersSnapshot.size,
      });

      const stripe = getStripeClient();
      const notificationPromises: Promise<void>[] = [];
      let notifiedCount = 0;
      let errorCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const subscriptionId = userData.stripeSubscriptionId as string | undefined;

        if (!subscriptionId) {
          logger.warn("サブスクリプションIDがありません", { userId });
          continue;
        }

        try {
          // Stripeからサブスクリプション詳細を取得
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
          const subscription = subscriptionResponse as Stripe.Subscription;

          // トライアル中でない場合はスキップ
          if (subscription.status !== "trialing") {
            continue;
          }

          // トライアル終了日がない場合はスキップ
          if (!subscription.trial_end) {
            continue;
          }

          const trialEnd = new Date(subscription.trial_end * 1000);
          const daysRemaining = calculateDaysRemaining(trialEnd, now);

          // トライアル終了3日前のユーザーに通知
          if (daysRemaining === REMINDER_DAYS_BEFORE) {
            logger.info("リマインダー対象ユーザーを検出", {
              userId,
              trialEnd: trialEnd.toISOString(),
              daysRemaining,
            });

            notificationPromises.push(
              sendTrialReminderNotification(userId, trialEnd)
                .then(() => {
                  notifiedCount++;
                })
                .catch((error) => {
                  logger.error("リマインダー送信失敗", error as Error, { userId });
                  errorCount++;
                }),
            );
          }
        } catch (error) {
          logger.error("ユーザーのトライアル状態取得に失敗", error as Error, {
            userId,
            subscriptionId,
          });
          errorCount++;
        }
      }

      // すべての通知処理を完了待ち
      await Promise.all(notificationPromises);

      const duration = Date.now() - startTime;

      logger.info("トライアルリマインダー処理を完了", {
        totalUsers: usersSnapshot.size,
        notifiedCount,
        errorCount,
        durationMs: duration,
      });
    } catch (error) {
      logger.error("トライアルリマインダー処理に失敗", error as Error);
      throw error;
    }
  },
);
