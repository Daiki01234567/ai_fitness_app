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
 */

// 認証
export * from "./auth";

// ユーザー管理
export * from "./users";

// 同意管理
export * from "./consent";

// トレーニングセッション
// export * from "./training";

// GDPR 準拠
export * from "./gdpr";

// ユーザー設定
// export * from "./settings";

// サブスクリプション管理
// export * from "./subscription";
