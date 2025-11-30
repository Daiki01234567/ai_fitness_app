/**
 * GDPR API インデックス
 *
 * GDPR 準拠機能のエントリーポイント
 * - データエクスポート (Article 20: データポータビリティ権)
 * - データ削除 (Article 17: 削除権)
 * - アカウント復元 (削除猶予期間内の復元機能)
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

// データエクスポート API
export {
  gdpr_requestDataExport,
  gdpr_getExportStatus,
  gdpr_processDataExport,
  gdpr_getExportRequests,
} from "./exportData";

// データ削除 API
export {
  gdpr_requestAccountDeletion,
  gdpr_cancelDeletion,
  gdpr_getDeletionStatus,
  gdpr_processDataDeletion,
  gdpr_getDeletionRequests,
  gdpr_getDeletionCertificate,
} from "./deleteData";

// アカウント復元 API
export {
  gdpr_requestRecoveryCode,
  gdpr_verifyRecoveryCode,
  gdpr_recoverAccount,
} from "./recoverData";
