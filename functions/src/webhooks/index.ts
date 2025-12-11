/**
 * Webhook ハンドラーモジュール
 *
 * 外部サービスからのWebhookを処理するモジュールをエクスポート
 *
 * 現在サポートしているWebhook:
 * - Stripe: 決済イベント（サブスクリプション、支払い）
 *
 * 将来的に追加予定:
 * - RevenueCat: 緊急時の代替決済（必要に応じて）
 */

// ========================================
// Stripe Webhook
// ========================================
// - stripe_webhook: Stripeイベントを受信
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_succeeded
//   - invoice.payment_failed
export { stripe_webhook } from "./stripe";
