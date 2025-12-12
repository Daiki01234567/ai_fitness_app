/**
 * Stripe API Functions インデックス
 *
 * Phase 3: 課金機能実装
 * チケット032-040: サブスクリプション管理・課金履歴・領収書API
 *
 * docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md 8章
 */

// Checkout Session作成（チケット032）
export { stripe_createCheckoutSession } from "./createCheckoutSession";

// サブスクリプション取得（チケット033）
export { stripe_getSubscription } from "./getSubscription";

// サブスクリプション更新（チケット034）
export { stripe_updateSubscription } from "./updateSubscription";

// サブスクリプション解約（チケット035）
export { stripe_cancelSubscription } from "./cancelSubscription";

// トライアル状態取得（チケット036）
export { stripe_getTrialStatus } from "./getTrialStatus";

// Setup Intent作成（チケット037）
export { stripe_createSetupIntent } from "./createSetupIntent";

// 課金履歴取得（チケット039）
export { stripe_getBillingHistory } from "./getBillingHistory";

// 領収書再送信（チケット040）
export { stripe_resendReceipt } from "./resendReceipt";
