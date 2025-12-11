/**
 * API Functions インデックス
 *
 * AI Fitness App 用の HTTP callable 関数
 * ドメイン別に整理:
 * - auth: 認証（サインアップ、サインイン）
 * - user: ユーザープロフィール管理
 * - training: トレーニングセッション管理
 * - gdpr: GDPR 準拠（データエクスポート、削除）
 * - settings: ユーザー設定
 * - subscription: サブスクリプション管理
 * - analytics: BigQuery分析API
 */

// 認証
export * from "./auth";

// ユーザー管理
export * from "./users";

// 同意管理
export * from "./consent";

// トレーニングセッション
export * from "./training";

// GDPR 準拠
export * from "./gdpr";

// ユーザー設定
export * from "./settings";

// サブスクリプション管理（Stripe API）
export * from "./stripe";

// 分析API（BigQuery）
export * from "./analytics";

// フィードバック管理
export * from "./feedback";

// 通知管理（Ticket 022, 023, 026）
export * from "./notification";

// バックアップ管理（Ticket 030）
export * from "./backup";

// 管理者API（Ticket 041, 042, 043, 044, 045）
export * from "./admin";
