/**
 * データエクスポートAPI型定義
 *
 * 管理者によるユーザーデータ・統計データ・監査ログのエクスポート機能
 * GDPR Article 20 (データポータビリティ権) に準拠
 *
 * 参照: docs/common/tickets/048-data-export-api.md
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md - FR-028
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import { Timestamp } from "firebase-admin/firestore";

// =============================================================================
// エクスポートジョブ型定義
// =============================================================================

/**
 * エクスポートタイプ
 */
export type ExportJobType = "user_data" | "stats" | "audit_logs";

/**
 * エクスポートステータス
 */
export type ExportJobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * エクスポートフォーマット
 */
export type AdminExportFormat = "json" | "csv";

/**
 * エクスポートフィルター
 */
export interface ExportFilters {
  /** 開始日（ISO8601形式） */
  startDate?: string;
  /** 終了日（ISO8601形式） */
  endDate?: string;
  /** アクションフィルター（監査ログ用） */
  action?: string;
  /** ユーザーIDフィルター（監査ログ用） */
  userId?: string;
}

/**
 * エクスポートジョブドキュメント
 *
 * Firestore: exportJobs/{jobId}
 */
export interface ExportJob {
  /** ジョブID */
  id: string;
  /** エクスポートタイプ */
  type: ExportJobType;
  /** ステータス */
  status: ExportJobStatus;
  /** フォーマット */
  format: AdminExportFormat;
  /** リクエストした管理者ID */
  requestedBy: string;
  /** 対象ユーザーID（user_dataの場合） */
  targetUserId?: string;
  /** フィルター条件 */
  filters?: ExportFilters;
  /** ダウンロードURL（署名付き） */
  downloadUrl?: string;
  /** ダウンロードURL有効期限 */
  downloadUrlExpiry?: Timestamp;
  /** ファイルサイズ（バイト） */
  fileSize?: number;
  /** レコード数 */
  recordCount?: number;
  /** エラーメッセージ */
  errorMessage?: string;
  /** 作成日時 */
  createdAt: Timestamp;
  /** 処理開始日時 */
  processingStartedAt?: Timestamp;
  /** 完了日時 */
  completedAt?: Timestamp;
  /** 暗号化オプション */
  encrypted?: boolean;
}

// =============================================================================
// ユーザーデータエクスポートAPI型
// =============================================================================

/**
 * ユーザーデータエクスポート開始リクエスト
 */
export interface StartUserExportRequest {
  /** 対象ユーザーID */
  userId: string;
  /** フォーマット（デフォルト: json） */
  format?: AdminExportFormat;
  /** 暗号化するか（デフォルト: false） */
  encrypted?: boolean;
  /** 期間フィルター */
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

/**
 * ユーザーデータエクスポート開始レスポンス
 */
export interface StartUserExportResponse {
  /** ジョブID */
  jobId: string;
  /** ステータス */
  status: ExportJobStatus;
  /** 予想完了時間（ISO8601形式） */
  estimatedCompletionTime: string;
  /** メッセージ */
  message: string;
}

// =============================================================================
// エクスポート状態確認API型
// =============================================================================

/**
 * エクスポート状態確認リクエスト
 */
export interface GetExportStatusRequest {
  /** ジョブID */
  jobId: string;
}

/**
 * エクスポート状態確認レスポンス
 */
export interface GetExportStatusResponse {
  /** ジョブID */
  jobId: string;
  /** タイプ */
  type: ExportJobType;
  /** ステータス */
  status: ExportJobStatus;
  /** フォーマット */
  format: AdminExportFormat;
  /** 対象ユーザーID */
  targetUserId?: string;
  /** ダウンロードURL（完了時のみ） */
  downloadUrl?: string;
  /** ダウンロードURL有効期限（ISO8601形式） */
  downloadUrlExpiry?: string;
  /** ファイルサイズ（バイト） */
  fileSize?: number;
  /** レコード数 */
  recordCount?: number;
  /** エラーメッセージ（失敗時のみ） */
  errorMessage?: string;
  /** 作成日時（ISO8601形式） */
  createdAt: string;
  /** 完了日時（ISO8601形式） */
  completedAt?: string;
}

// =============================================================================
// 統計データエクスポートAPI型
// =============================================================================

/**
 * 統計データエクスポートリクエスト
 */
export interface ExportStatsRequest {
  /** フォーマット（デフォルト: csv） */
  format?: AdminExportFormat;
  /** 期間フィルター */
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  /** レポートタイプ */
  reportType?: "daily" | "weekly" | "monthly" | "summary";
}

/**
 * 統計データエクスポートレスポンス
 */
export interface ExportStatsResponse {
  /** ジョブID */
  jobId: string;
  /** ステータス */
  status: ExportJobStatus;
  /** 予想完了時間（ISO8601形式） */
  estimatedCompletionTime: string;
  /** メッセージ */
  message: string;
}

// =============================================================================
// 監査ログエクスポートAPI型
// =============================================================================

/**
 * 監査ログエクスポートリクエスト
 */
export interface ExportAuditLogsRequest {
  /** フォーマット（デフォルト: json） */
  format?: AdminExportFormat;
  /** 期間フィルター */
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  /** アクションフィルター（部分一致） */
  action?: string;
  /** ユーザーIDフィルター */
  userId?: string;
  /** 最大レコード数（デフォルト: 10000） */
  maxRecords?: number;
}

/**
 * 監査ログエクスポートレスポンス
 */
export interface ExportAuditLogsResponse {
  /** ジョブID */
  jobId: string;
  /** ステータス */
  status: ExportJobStatus;
  /** 予想完了時間（ISO8601形式） */
  estimatedCompletionTime: string;
  /** メッセージ */
  message: string;
}

// =============================================================================
// エクスポート履歴API型
// =============================================================================

/**
 * エクスポート履歴一覧リクエスト
 */
export interface ListExportHistoryRequest {
  /** エクスポートタイプフィルター */
  type?: ExportJobType;
  /** ステータスフィルター */
  status?: ExportJobStatus;
  /** 取得件数（デフォルト: 20、最大: 100） */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
}

/**
 * エクスポート履歴アイテム
 */
export interface ExportHistoryItem {
  /** ジョブID */
  jobId: string;
  /** タイプ */
  type: ExportJobType;
  /** ステータス */
  status: ExportJobStatus;
  /** フォーマット */
  format: AdminExportFormat;
  /** リクエストした管理者ID */
  requestedBy: string;
  /** 対象ユーザーID */
  targetUserId?: string;
  /** ファイルサイズ（バイト） */
  fileSize?: number;
  /** レコード数 */
  recordCount?: number;
  /** ダウンロード可能か（URLが有効か） */
  downloadable: boolean;
  /** 作成日時（ISO8601形式） */
  createdAt: string;
  /** 完了日時（ISO8601形式） */
  completedAt?: string;
}

/**
 * エクスポート履歴一覧レスポンス
 */
export interface ListExportHistoryResponse {
  /** 履歴一覧 */
  items: ExportHistoryItem[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 総件数 */
  totalCount: number;
}

// =============================================================================
// エクスポート定数
// =============================================================================

/**
 * エクスポート関連定数
 */
export const EXPORT_CONSTANTS = {
  /** ダウンロードURL有効期限（時間） */
  DOWNLOAD_URL_EXPIRY_HOURS: 24,
  /** エクスポートファイル保存期間（日） */
  FILE_RETENTION_DAYS: 7,
  /** 最大レコード数（監査ログ） */
  MAX_AUDIT_LOG_RECORDS: 100000,
  /** 最大レコード数（統計データ） */
  MAX_STATS_RECORDS: 500000,
  /** エクスポートジョブタイムアウト（分） */
  JOB_TIMEOUT_MINUTES: 30,
  /** デフォルト取得件数 */
  DEFAULT_HISTORY_LIMIT: 20,
  /** 最大取得件数 */
  MAX_HISTORY_LIMIT: 100,
  /** Cloud Storage バケットパス */
  EXPORT_BUCKET_PATH: "admin-exports",
  /** 推定完了時間（ユーザーデータ、分） */
  ESTIMATED_USER_EXPORT_MINUTES: 5,
  /** 推定完了時間（統計データ、分） */
  ESTIMATED_STATS_EXPORT_MINUTES: 10,
  /** 推定完了時間（監査ログ、分） */
  ESTIMATED_AUDIT_EXPORT_MINUTES: 15,
} as const;

// =============================================================================
// エクスポートアクション監査タイプ
// =============================================================================

/**
 * エクスポート関連の監査アクションタイプ
 */
export type ExportAuditAction =
  | "START_USER_EXPORT"
  | "START_STATS_EXPORT"
  | "START_AUDIT_LOG_EXPORT"
  | "CHECK_EXPORT_STATUS"
  | "LIST_EXPORT_HISTORY"
  | "DOWNLOAD_EXPORT";
