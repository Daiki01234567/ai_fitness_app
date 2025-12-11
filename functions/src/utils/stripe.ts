/**
 * Stripe SDKの初期化ユーティリティ
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md に基づく
 *
 * セキュリティ要件:
 * - APIキーは環境変数から取得（Secret Manager使用）
 * - APIキーをログに出力しない
 * - PCI DSS準拠（カード情報は直接扱わない）
 */

import Stripe from "stripe";

import { logger } from "./logger";

/**
 * Stripe APIバージョン
 * 参照: https://stripe.com/docs/api/versioning
 */
const STRIPE_API_VERSION = "2025-04-30.basil";

/**
 * Stripe SDK インスタンス
 * 遅延初期化でコールドスタート対策
 */
let stripeInstance: Stripe | null = null;

/**
 * Stripe SDKインスタンスを取得
 * シングルトンパターンで実装
 *
 * @returns Stripe SDK インスタンス
 * @throws Error - STRIPE_SECRET_KEYが設定されていない場合
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    logger.error("Stripe initialization failed: STRIPE_SECRET_KEY is not set");
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Please set the environment variable.",
    );
  }

  // Test ModeかLive Modeかをログに記録（キー自体はログに出力しない）
  const isTestMode = secretKey.startsWith("sk_test_");
  logger.info("Stripe SDK initialized", {
    mode: isTestMode ? "test" : "live",
    apiVersion: STRIPE_API_VERSION,
  });

  stripeInstance = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    typescript: true,
    // タイムアウト設定（ミリ秒）
    timeout: 30000,
    // 自動リトライ設定
    maxNetworkRetries: 2,
    // テレメトリ送信を無効化（プライバシー考慮）
    telemetry: false,
  });

  return stripeInstance;
}

/**
 * Stripe Webhookシグネチャを検証
 *
 * @param payload - リクエストボディ（raw）
 * @param signature - stripe-signatureヘッダー
 * @returns 検証済みのStripeイベント
 * @throws Stripe.errors.StripeSignatureVerificationError - 検証失敗時
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("Webhook verification failed: STRIPE_WEBHOOK_SECRET is not set");
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured. Please set the environment variable.",
    );
  }

  const stripe = getStripeClient();

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    logger.info("Webhook signature verified", {
      eventType: event.type,
      eventId: event.id,
    });
    return event;
  } catch (error) {
    logger.error("Webhook signature verification failed", error as Error);
    throw error;
  }
}

/**
 * テスト用: Stripeインスタンスをリセット
 * 単体テストでモックを注入するために使用
 */
export function resetStripeClient(): void {
  stripeInstance = null;
}

/**
 * テスト用: Stripeインスタンスを設定
 * 単体テストでモックを注入するために使用
 */
export function setStripeClient(client: Stripe): void {
  stripeInstance = client;
}
