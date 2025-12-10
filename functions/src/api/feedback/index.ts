/**
 * フィードバック API Functions インデックス
 *
 * ユーザーフィードバック管理エンドポイント
 * - フィードバック送信（レート制限: 10件/日）
 * - ユーザー本人のフィードバック一覧取得
 *
 * 参照: docs/expo/tickets/024-user-feedback-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

// Submit feedback
// eslint-disable-next-line camelcase
export { feedback_submitFeedback } from "./submit";

// List user's own feedbacks
// eslint-disable-next-line camelcase
export { feedback_listMyFeedbacks } from "./list";

// Re-export types for external use
export type {
  FeedbackType,
  FeedbackDeviceInfo,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
} from "./submit";

export type {
  ListMyFeedbacksRequest,
  ListMyFeedbacksResponse,
  FeedbackItem,
} from "./list";
