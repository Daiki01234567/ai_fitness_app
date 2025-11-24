/**
 * Firebase Auth Functions Index
 *
 * 認証関連の関数をエクスポート
 *
 * @version 1.0.0
 * @date 2025-11-24
 */

// ユーザー作成・削除トリガー
export { onUserCreate, onEmailVerified } from "./onCreate";
export { onUserDelete, processScheduledDeletions } from "./onDelete";

// カスタムクレーム管理
export {
  setCustomClaims,
  removeCustomClaims,
  getCustomClaims,
  onConsentWithdrawn,
} from "./customClaims";