/**
 * 通知 API Functions インデックス
 *
 * プッシュ通知関連のエンドポイント
 * - FCMトークン管理（チケット022）
 * - 通知設定管理（チケット022）
 * - スケジュール通知（チケット023）
 *
 * 参照: docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

/* eslint-disable camelcase */

// FCMトークン管理
export { notification_updateFCMToken } from "./updateFCMToken";

// 通知設定管理
export {
  notification_updateSettings,
  notification_getSettings,
} from "./settings";

// スケジュール通知
export {
  notification_sendTrainingReminders,
  notification_sendDeletionNotices,
} from "./scheduler";

/* eslint-enable camelcase */
