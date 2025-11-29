/**
 * GDPR データエクスポート・削除 型定義
 *
 * GDPR Article 17 (削除権) および Article 20 (データポータビリティ権) に準拠した
 * データエクスポートと削除機能のための型定義
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { Timestamp } from "firebase-admin/firestore";

// =============================================================================
// エクスポートリクエスト関連型
// =============================================================================

/**
 * エクスポートフォーマット
 */
export type ExportFormat = "json" | "csv";

/**
 * エクスポートスコープタイプ
 */
export type ExportScopeType = "all" | "dateRange" | "specific";

/**
 * エクスポートステータス
 */
export type ExportStatus = "pending" | "processing" | "completed" | "failed";

/**
 * エクスポートスコープ設定
 */
export interface ExportScope {
  /** スコープタイプ */
  type: ExportScopeType;
  /** 開始日（dateRange の場合） */
  startDate?: Timestamp;
  /** 終了日（dateRange の場合） */
  endDate?: Timestamp;
  /** データタイプ（specific の場合） */
  dataTypes?: ExportDataType[];
}

/**
 * エクスポート可能なデータタイプ
 */
export type ExportDataType =
  | "profile"
  | "sessions"
  | "consents"
  | "settings"
  | "subscriptions";

/**
 * /exportRequests/{requestId} のエクスポートリクエストドキュメント
 */
export interface ExportRequest {
  /** ユーザー ID */
  userId: string;
  /** リクエスト ID */
  requestId: string;
  /** エクスポートフォーマット */
  format: ExportFormat;
  /** エクスポートスコープ */
  scope: ExportScope;
  /** ステータス */
  status: ExportStatus;
  /** リクエスト日時 */
  requestedAt: Timestamp;
  /** 完了日時 */
  completedAt?: Timestamp;
  /** ダウンロード URL（署名付き） */
  downloadUrl?: string;
  /** ダウンロード URL 有効期限 */
  expiresAt?: Timestamp;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 処理開始日時 */
  processingStartedAt?: Timestamp;
  /** ファイルサイズ（バイト） */
  fileSizeBytes?: number;
  /** 処理されたレコード数 */
  recordCount?: number;
}

// =============================================================================
// 削除リクエスト関連型
// =============================================================================

/**
 * 削除タイプ
 */
export type DeletionType = "soft" | "hard" | "partial";

/**
 * 削除ステータス
 */
export type DeletionRequestStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "completed"
  | "cancelled";

/**
 * 削除スコープ（部分削除時に使用）
 */
export type DeletionScope =
  | "all"
  | "sessions"
  | "consents"
  | "settings"
  | "subscriptions";

/**
 * /deletionRequests/{requestId} の削除リクエストドキュメント
 */
export interface DeletionRequest {
  /** ユーザー ID */
  userId: string;
  /** リクエスト ID */
  requestId: string;
  /** 削除タイプ */
  type: DeletionType;
  /** 削除スコープ */
  scope: DeletionScope[];
  /** 削除理由（オプション） */
  reason?: string;
  /** リクエスト日時 */
  requestedAt: Timestamp;
  /** 削除予定日時 */
  scheduledAt: Timestamp;
  /** 削除実行日時 */
  executedAt?: Timestamp;
  /** ステータス */
  status: DeletionRequestStatus;
  /** 復元可能かどうか */
  canRecover: boolean;
  /** 復元期限 */
  recoverDeadline?: Timestamp;
  /** 復元日時 */
  recoveredAt?: Timestamp;
  /** キャンセル日時 */
  cancelledAt?: Timestamp;
  /** キャンセル理由 */
  cancellationReason?: string;
  /** 関連するエクスポートリクエスト ID */
  exportRequestId?: string;
  /** 削除完了確認 */
  deletionVerified?: boolean;
  /** 削除されたコレクション */
  deletedCollections?: string[];
  /** エラーメッセージ */
  error?: string;
}

// =============================================================================
// エクスポートデータ構造
// =============================================================================

/**
 * エクスポート用プロフィールデータ
 */
export interface ExportProfileData {
  nickname: string;
  email: string;
  birthYear?: number;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessLevel?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * エクスポート用セッションデータ
 */
export interface ExportSessionData {
  sessionId: string;
  exerciseType: string;
  startTime: string;
  endTime?: string;
  repCount: number;
  totalScore: number;
  averageScore: number;
  duration: number;
  status: string;
}

/**
 * エクスポート用同意データ
 */
export interface ExportConsentData {
  documentType: string;
  documentVersion: string;
  action: string;
  timestamp: string;
}

/**
 * エクスポート用設定データ
 */
export interface ExportSettingsData {
  notificationsEnabled: boolean;
  reminderTime?: string;
  reminderDays?: number[];
  language: string;
  theme: string;
  units: string;
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
}

/**
 * エクスポート用サブスクリプションデータ
 */
export interface ExportSubscriptionData {
  plan: string;
  status: string;
  startDate: string;
  expirationDate: string;
  store: string;
}

/**
 * エクスポート全体データ
 */
export interface ExportData {
  exportedAt: string;
  userId: string;
  format: ExportFormat;
  profile?: ExportProfileData;
  sessions?: ExportSessionData[];
  consents?: ExportConsentData[];
  settings?: ExportSettingsData;
  subscriptions?: ExportSubscriptionData[];
}

// =============================================================================
// API リクエスト/レスポンス型
// =============================================================================

/**
 * エクスポートリクエスト API リクエスト
 */
export interface RequestDataExportApiRequest {
  format?: ExportFormat;
  scope?: {
    type?: ExportScopeType;
    startDate?: string;
    endDate?: string;
    dataTypes?: ExportDataType[];
  };
}

/**
 * エクスポートリクエスト API レスポンス
 */
export interface RequestDataExportApiResponse {
  requestId: string;
  status: ExportStatus;
  estimatedCompletionTime: string;
  message: string;
}

/**
 * エクスポートステータス取得 API レスポンス
 */
export interface GetExportStatusApiResponse {
  requestId: string;
  status: ExportStatus;
  downloadUrl?: string;
  expiresAt?: string;
  recordCount?: number;
  fileSizeBytes?: number;
  error?: string;
}

/**
 * 削除リクエスト API リクエスト
 */
export interface RequestDeletionApiRequest {
  type?: DeletionType;
  scope?: DeletionScope[];
  reason?: string;
  exportDataFirst?: boolean;
}

/**
 * 削除リクエスト API レスポンス
 */
export interface RequestDeletionApiResponse {
  requestId: string;
  scheduledDeletionDate: string;
  canRecover: boolean;
  recoverDeadline: string;
  exportRequestId?: string;
  message: string;
}

/**
 * 削除キャンセル API リクエスト
 */
export interface CancelDeletionApiRequest {
  requestId: string;
  reason?: string;
}

/**
 * 削除キャンセル API レスポンス
 */
export interface CancelDeletionApiResponse {
  requestId: string;
  status: DeletionRequestStatus;
  message: string;
}

/**
 * 削除ステータス取得 API レスポンス
 */
export interface GetDeletionStatusApiResponse {
  requestId: string;
  status: DeletionRequestStatus;
  type: DeletionType;
  scheduledAt: string;
  canRecover: boolean;
  recoverDeadline?: string;
  executedAt?: string;
  error?: string;
}

// =============================================================================
// アカウント復元関連型
// =============================================================================

/**
 * 復元コードステータス
 */
export type RecoveryCodeStatus = "pending" | "verified" | "used" | "expired" | "invalidated";

/**
 * /recoveryCodes/{codeId} の復元コードドキュメント
 */
export interface RecoveryCode {
  /** ユーザー ID */
  userId: string;
  /** メールアドレス */
  email: string;
  /** 復元コード（6桁数字） */
  code: string;
  /** ステータス */
  status: RecoveryCodeStatus;
  /** 作成日時 */
  createdAt: Timestamp;
  /** 有効期限 */
  expiresAt: Timestamp;
  /** 試行回数 */
  attempts: number;
  /** 最大試行回数 */
  maxAttempts: number;
  /** 関連する削除リクエスト ID */
  deletionRequestId?: string;
  /** 使用日時 */
  usedAt?: Timestamp;
  /** IP アドレスハッシュ（セキュリティ用） */
  ipAddressHash?: string;
}

/**
 * 復元コードリクエスト API リクエスト
 */
export interface RecoveryCodeRequest {
  email: string;
}

/**
 * 復元コードリクエスト API レスポンス
 */
export interface RecoveryCodeResponse {
  success: boolean;
  message: string;
  expiresAt?: string; // ISO8601
}

/**
 * 復元コード検証 API リクエスト
 */
export interface VerifyCodeRequest {
  email: string;
  code: string;
}

/**
 * 復元コード検証 API レスポンス
 */
export interface VerifyCodeResponse {
  valid: boolean;
  remainingAttempts?: number;
  deletionInfo?: {
    requestId: string;
    scheduledAt: string;
    daysRemaining: number;
  };
}

/**
 * アカウント復元実行 API リクエスト
 */
export interface RecoverAccountRequest {
  email: string;
  code: string;
}

/**
 * アカウント復元実行 API レスポンス
 */
export interface RecoverAccountResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// 定数
// =============================================================================

/**
 * GDPR 関連定数
 */
export const GDPR_CONSTANTS = {
  /** 削除猶予期間（日数） */
  DELETION_GRACE_PERIOD_DAYS: 30,
  /** エクスポート処理タイムアウト（時間） */
  EXPORT_TIMEOUT_HOURS: 72,
  /** ダウンロードURL有効期限（時間） */
  DOWNLOAD_URL_EXPIRY_HOURS: 48,
  /** エクスポートリクエスト間隔制限（時間） */
  EXPORT_RATE_LIMIT_HOURS: 24,
  /** 削除リクエスト間隔制限（日数） */
  DELETION_RATE_LIMIT_DAYS: 1,
  /** 復元コード有効期限（時間） */
  RECOVERY_CODE_EXPIRY_HOURS: 24,
  /** 復元コード最大試行回数 */
  RECOVERY_CODE_MAX_ATTEMPTS: 5,
  /** 復元コードリクエスト間隔制限（時間） */
  RECOVERY_CODE_RATE_LIMIT_HOURS: 1,
  /** 復元コードリクエスト回数制限 */
  RECOVERY_CODE_RATE_LIMIT_COUNT: 3,
} as const;
