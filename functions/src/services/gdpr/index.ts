/**
 * GDPR サービスモジュール
 *
 * GDPR 準拠のデータエクスポートと削除処理を提供
 * Article 17 (削除権) および Article 20 (データポータビリティ権) に対応
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

// ヘルパー関数
export {
  safeTimestampToString,
  generateSignature,
  hashUserId,
  hashIpAddress,
  getExportBucketName,
  getUserUploadsBucketName,
  DEFAULT_AUDIT_SALT,
  DEFAULT_RECOVERY_SALT,
  DEFAULT_CERTIFICATE_SECRET,
} from "./helpers";

// データ収集関数
export {
  collectProfileData,
  collectSessionsData,
  collectSettingsData,
  collectSubscriptionsData,
  collectConsentsData,
} from "./collectors";

// データフォーマッター
export {
  transformToJSON,
  transformToCSV,
  sessionToCSVRow,
  convertProfileToCSV,
  convertSessionsToCSV,
  convertConsentsToCSV,
  convertSettingsToCSV,
  convertSubscriptionsToCSV,
  convertAnalyticsToCSV,
  escapeCSV,
} from "./formatters";

// バリデーター
export {
  hasRecentExportRequest,
  hasPendingDeletionRequest,
  countUserRecords,
} from "./validators";
