/**
 * AI Fitness App - Cloud Functions エントリーポイント
 *
 * AI Fitness App のすべての Cloud Functions をエクスポートするモジュール。
 * 関数はドメインごとに整理されている:
 * - auth: 認証とユーザーライフサイクル
 * - api: HTTP callable 関数
 * - triggers: Firestore トリガー
 * - scheduled: スケジュールされたメンテナンスタスク
 *
 * @see https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Firebase Admin SDK を初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * グローバル関数設定
 *
 * 個別に上書きされない限り、すべての関数に適用される設定:
 * - region: asia-northeast1（東京）日本市場向け
 * - maxInstances: 10 コスト制御のため
 * - memory: 256MB デフォルト
 * - timeoutSeconds: 60秒
 * - minInstances: 0 コスト最適化のため（コールドスタートは許容）
 *
 * 重要な関数（auth）は minInstances: 1 で上書きする場合がある
 */
setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
});

// ========================================
// Auth 関数（ユーザーライフサイクル）
// ========================================
// - auth_onCreate: サインアップ時にユーザードキュメントを作成
// - auth_onDelete: アカウント削除時のクリーンアップ
// - auth_setCustomClaims: カスタムクレームを設定（管理者のみ）
export * from "./auth";

// ========================================
// API 関数（HTTP Callable）
// ========================================
// - user_updateProfile: ユーザープロフィールを更新
// TODO: Implement remaining:
// - user_getProfile
// - training_createSession, training_getSessions
// - gdpr_requestDataExport, gdpr_requestAccountDeletion
// - settings_get, settings_update
// - subscription_getStatus, subscription_verifyPurchase
export * from "./api";

// ========================================
// Firestore トリガー
// ========================================
// - triggers_onConsentCreated: 同意の作成/撤回を処理
// - triggers_onUserConsentWithdrawn: 全同意の撤回を監視
export * from "./triggers";

// ========================================
// スケジュール関数
// ========================================
// 実装時にコメントを解除:
// - scheduled_processDeletedUsers: 30日間の削除クリーンアップ
// - scheduled_cleanupRateLimits: 期限切れレート制限レコードを削除
// - scheduled_processDLQ: 失敗した BigQuery 同期をリトライ
// export * from "./scheduled";

// ========================================
// Webhook ハンドラー
// ========================================
// 実装時にコメントを解除:
// - webhook_revenueCat: サブスクリプションイベントを処理
// export * from "./webhooks";
