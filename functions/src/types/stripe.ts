/**
 * Stripe関連の型定義
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md に基づく
 */

import Stripe from "stripe";

/**
 * Stripe Customer作成/取得リクエスト
 */
export interface GetOrCreateStripeCustomerRequest {
  userId: string;
  email: string;
}

/**
 * Stripe Customer作成/取得レスポンス
 */
export interface GetOrCreateStripeCustomerResponse {
  customerId: string;
  isNew: boolean;
}

/**
 * Stripe Checkout Session作成リクエスト
 */
export interface CreateCheckoutSessionRequest {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Stripe Checkout Session作成レスポンス
 */
export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string | null;
}

/**
 * サブスクリプション更新データ
 */
export interface SubscriptionUpdateData {
  subscriptionStatus: "free" | "premium" | "premium_annual";
  stripeSubscriptionId: string | null;
  subscriptionStartDate?: FirebaseFirestore.Timestamp;
  subscriptionEndDate?: FirebaseFirestore.Timestamp;
  subscriptionPlan?: string;
}

/**
 * Stripe Webhookイベントタイプ
 */
export type StripeWebhookEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_succeeded"
  | "invoice.payment_failed"
  | "checkout.session.completed";

/**
 * Stripe APIエラー情報
 */
export interface StripeErrorInfo {
  type: string;
  code?: string;
  message: string;
  param?: string;
  statusCode?: number;
}

/**
 * Stripe APIエラーかどうかを判定するtype guard
 */
export function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Stripeエラーから情報を抽出
 */
export function extractStripeErrorInfo(error: Stripe.errors.StripeError): StripeErrorInfo {
  return {
    type: error.type,
    code: error.code,
    message: error.message,
    param: error.param,
    statusCode: error.statusCode,
  };
}

/**
 * Stripe Customerメタデータ
 */
export interface StripeCustomerMetadata {
  firebaseUID: string;
  createdAt?: string;
}

/**
 * Firestoreユーザードキュメントに保存するStripe関連フィールド
 */
export interface UserStripeFields {
  stripeCustomerId: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus: "free" | "premium" | "premium_annual" | "expired" | "cancelled";
  subscriptionPlan?: string | null;
  subscriptionStartDate?: FirebaseFirestore.Timestamp;
  subscriptionEndDate?: FirebaseFirestore.Timestamp;
}

/**
 * Stripe価格プランID（環境によって異なる）
 */
export interface StripePriceIds {
  monthlyPremium: string;
  annualPremium: string;
}

/**
 * サブスクリプション取得リクエスト
 * パラメータなし（認証情報から自動取得）
 */
export type StripeGetSubscriptionRequest = Record<string, never>;

/**
 * サブスクリプション詳細情報
 */
export interface StripeSubscriptionDetail {
  id: string;
  status: string;
  planName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

/**
 * Stripe サブスクリプション取得レスポンス
 */
export interface StripeGetSubscriptionResponse {
  hasSubscription: boolean;
  subscription?: StripeSubscriptionDetail;
}

/**
 * サブスクリプション更新リクエスト
 */
export interface UpdateSubscriptionRequest {
  newPriceId: string;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}

/**
 * サブスクリプション更新レスポンス
 */
export interface UpdateSubscriptionResponse {
  subscriptionId: string;
  newPriceId: string;
  status: string;
  currentPeriodEnd: string;
  message: string;
}

/**
 * サブスクリプション解約リクエスト
 */
export interface CancelSubscriptionRequest {
  cancelImmediately?: boolean;
}

/**
 * サブスクリプション解約レスポンス
 */
export interface CancelSubscriptionResponse {
  subscriptionId: string;
  status: string;
  cancelAt?: string;
  message: string;
}

/**
 * Proration Behavior バリデーション用の値
 */
export const ValidProrationBehaviors = [
  "create_prorations",
  "none",
  "always_invoice",
] as const;

export type ProrationBehavior = typeof ValidProrationBehaviors[number];

/**
 * トライアル状態取得リクエスト
 * パラメータなし（認証情報から自動取得）
 */
export type GetTrialStatusRequest = Record<string, never>;

/**
 * トライアル状態取得レスポンス
 * docs/common/tickets/036-free-trial-api.md に基づく
 */
export interface GetTrialStatusResponse {
  isTrialing: boolean;
  trialEnd?: string;
  daysRemaining?: number;
  willBeChargedAt?: string;
  hasSubscription: boolean;
}

/**
 * 課金履歴取得リクエスト
 * docs/common/tickets/039-billing-history-api.md に基づく
 */
export interface GetBillingHistoryRequest {
  limit?: number;           // 取得件数（デフォルト: 10、最大: 100）
  startingAfter?: string;   // ページネーション用（Invoice ID）
}

/**
 * 課金履歴の支払い情報
 */
export interface BillingHistoryPayment {
  id: string;               // Invoice ID
  amount: number;           // 支払い金額（円）
  currency: string;         // 通貨（'jpy'）
  status: string;           // 'paid', 'open', 'void', 'uncollectible', 'unknown'
  paidAt: string | null;    // 支払い日時（ISO 8601形式）
  invoicePdfUrl: string | null;  // 領収書PDF URL
  description: string;      // 支払い内容
}

/**
 * 課金履歴取得レスポンス
 */
export interface GetBillingHistoryResponse {
  payments: BillingHistoryPayment[];
  hasMore: boolean;         // 次のページがあるか
  nextCursor?: string;      // 次のページ用のカーソル
}

/**
 * Setup Intent作成リクエスト
 * docs/common/tickets/037-payment-retry.md に基づく
 * パラメータなし（認証情報から自動取得）
 */
export type CreateSetupIntentRequest = Record<string, never>;

/**
 * Setup Intent作成レスポンス
 * docs/common/tickets/037-payment-retry.md に基づく
 */
export interface CreateSetupIntentResponse {
  clientSecret: string;  // Setup Intent Client Secret
}

/**
 * 領収書メール送信パラメータ
 * docs/common/tickets/040-receipt-generation.md に基づく
 */
export interface SendReceiptEmailParams {
  userId: string;
  email: string;
  invoiceId: string;
  invoicePdfUrl: string;
  amount: number;
  currency: string;
  type: "auto" | "resend";
}

/**
 * 領収書再送信リクエスト
 * docs/common/tickets/040-receipt-generation.md に基づく
 */
export interface ResendReceiptRequest {
  invoiceId: string;  // 再送信するInvoice ID
}

/**
 * 領収書再送信レスポンス
 * docs/common/tickets/040-receipt-generation.md に基づく
 */
export interface ResendReceiptResponse {
  sent: boolean;            // 送信成功フラグ
  invoiceId: string;        // Invoice ID
  email: string;            // 送信先メールアドレス（マスク済み）
  sentAt: string;           // 送信日時（ISO 8601形式）
}

/**
 * 領収書メール履歴（Firestoreスキーマ）
 * docs/common/tickets/040-receipt-generation.md に基づく
 */
export interface ReceiptEmail {
  id: string;                      // ドキュメントID
  userId: string;                  // ユーザーID
  invoiceId: string;               // Stripe Invoice ID
  email: string;                   // 送信先メールアドレス
  status: "sent" | "failed";       // 送信ステータス
  type: "auto" | "resend";         // 自動送信 or 再送信
  invoicePdfUrl: string;           // 領収書PDF URL
  amount: number;                  // 金額
  currency: string;                // 通貨
  sentAt: FirebaseFirestore.Timestamp;          // 送信日時
  errorMessage?: string;           // エラー時のメッセージ
  createdAt: FirebaseFirestore.Timestamp;       // 作成日時
}
