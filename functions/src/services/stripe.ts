/**
 * Stripe Customerサービス
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md に基づく
 *
 * 機能:
 * - Stripe Customerの作成または取得
 * - FirestoreへのCustomer ID保存
 * - エラーハンドリング（Stripe APIエラー対応）
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import {
  GetOrCreateStripeCustomerResponse,
  isStripeError,
  extractStripeErrorInfo,
} from "../types/stripe";
import { ExternalServiceError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getStripeClient } from "../utils/stripe";

/**
 * Stripe Customerを作成または取得する
 *
 * @param userId - Firebase Auth UID
 * @param email - ユーザーのメールアドレス
 * @returns Stripe Customer IDと新規作成かどうかのフラグ
 * @throws ExternalServiceError - Stripe APIエラー時
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<GetOrCreateStripeCustomerResponse> {
  const childLogger = logger.child({ userId, functionName: "getOrCreateStripeCustomer" });

  // Input validation
  if (!userId || typeof userId !== "string") {
    throw new Error("userId is required and must be a string");
  }
  if (!email || typeof email !== "string") {
    throw new Error("email is required and must be a string");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  try {
    // Step 1: Firestoreから既存のCustomer IDを確認
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      childLogger.warn("User document not found", { userId });
      throw new Error(`User document not found for userId: ${userId}`);
    }

    const userData = userDoc.data();
    const existingCustomerId = userData?.stripeCustomerId as string | undefined;

    if (existingCustomerId) {
      childLogger.info("Existing Stripe Customer found", {
        customerId: existingCustomerId,
      });

      // 既存Customerの有効性を確認（オプション：Stripe APIで検証）
      const isValid = await validateStripeCustomer(existingCustomerId);
      if (isValid) {
        return {
          customerId: existingCustomerId,
          isNew: false,
        };
      }

      childLogger.warn("Existing Stripe Customer is invalid, creating new one", {
        invalidCustomerId: existingCustomerId,
      });
    }

    // Step 2: Stripe APIで新しいCustomerを作成
    const stripe = getStripeClient();

    childLogger.info("Creating new Stripe Customer");

    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        firebaseUID: userId,
        createdAt: new Date().toISOString(),
      },
      description: `AI Fitness App User: ${userId}`,
    });

    childLogger.info("Stripe Customer created successfully", {
      customerId: customer.id,
    });

    // Step 3: FirestoreにCustomer IDを保存
    await userRef.update({
      stripeCustomerId: customer.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    childLogger.info("Stripe Customer ID saved to Firestore", {
      customerId: customer.id,
    });

    return {
      customerId: customer.id,
      isNew: true,
    };
  } catch (error) {
    // Stripe APIエラーを適切にハンドリング
    if (isStripeError(error)) {
      const errorInfo = extractStripeErrorInfo(error);
      childLogger.error("Stripe API error occurred", error, {
        stripeErrorType: errorInfo.type,
        stripeErrorCode: errorInfo.code,
      });

      // エラータイプに応じた処理
      throw createStripeExternalServiceError(error, errorInfo);
    }

    // その他のエラー
    if (error instanceof Error) {
      childLogger.error("Unexpected error in getOrCreateStripeCustomer", error);
      throw error;
    }

    // Unknown error
    childLogger.error("Unknown error in getOrCreateStripeCustomer", undefined, {
      error: String(error),
    });
    throw new Error("An unexpected error occurred while processing Stripe Customer");
  }
}

/**
 * Stripe Customer IDを取得（存在する場合のみ）
 *
 * @param userId - Firebase Auth UID
 * @returns Stripe Customer ID または null
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    return null;
  }

  const userData = userDoc.data();
  return (userData?.stripeCustomerId as string) || null;
}

/**
 * Stripe Customerの有効性を検証
 *
 * @param customerId - 検証するStripe Customer ID
 * @returns 有効な場合true
 */
async function validateStripeCustomer(customerId: string): Promise<boolean> {
  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(customerId);

    // deleted customerはobject型だがdeletedプロパティを持つ
    if ((customer as Stripe.DeletedCustomer).deleted) {
      return false;
    }

    return true;
  } catch (error) {
    if (isStripeError(error) && error.code === "resource_missing") {
      return false;
    }
    // その他のエラーは有効と見なす（ネットワークエラー等）
    logger.warn("Could not validate Stripe Customer, assuming valid", {
      customerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * FirestoreからStripe Customer IDを削除
 * アカウント削除時に使用
 *
 * @param userId - Firebase Auth UID
 */
export async function removeStripeCustomerId(userId: string): Promise<void> {
  const db = admin.firestore();
  await db.collection("users").doc(userId).update({
    stripeCustomerId: admin.firestore.FieldValue.delete(),
    stripeSubscriptionId: admin.firestore.FieldValue.delete(),
    subscriptionStatus: "free",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info("Stripe Customer ID removed from Firestore", { userId });
}

/**
 * Stripe Customerを削除
 * アカウント完全削除時に使用
 *
 * @param customerId - Stripe Customer ID
 */
export async function deleteStripeCustomer(customerId: string): Promise<void> {
  const stripe = getStripeClient();

  try {
    await stripe.customers.del(customerId);
    logger.info("Stripe Customer deleted", { customerId });
  } catch (error) {
    if (isStripeError(error) && error.code === "resource_missing") {
      logger.info("Stripe Customer already deleted or not found", { customerId });
      return;
    }
    throw error;
  }
}

/**
 * Stripeエラーから適切なExternalServiceErrorを生成
 */
function createStripeExternalServiceError(
  error: Stripe.errors.StripeError,
  errorInfo: ReturnType<typeof extractStripeErrorInfo>,
): ExternalServiceError {
  let message: string;

  switch (errorInfo.type) {
    case "StripeCardError":
      message = "カード処理中にエラーが発生しました";
      break;
    case "StripeRateLimitError":
      message = "リクエストが多すぎます。しばらく待ってから再試行してください";
      break;
    case "StripeInvalidRequestError":
      message = "リクエストが不正です。入力内容を確認してください";
      break;
    case "StripeAPIError":
      message = "決済サービスで一時的なエラーが発生しました";
      break;
    case "StripeConnectionError":
      message = "決済サービスへの接続に失敗しました";
      break;
    case "StripeAuthenticationError":
      message = "決済サービスの認証に失敗しました";
      break;
    default:
      message = "決済処理中にエラーが発生しました";
  }

  return new ExternalServiceError("Stripe", message, error);
}
