/**
 * セキュリティ関連型定義
 *
 * 認証・認可、アクセスログ、管理者操作に関する型定義
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { Timestamp } from "firebase-admin/firestore";

// =============================================================================
// 再認証関連型
// =============================================================================

/**
 * 再認証リクエスト
 */
export interface ReauthRequest {
  /** パスワード（再認証用） */
  password?: string;
  /** 最近の認証が必要か */
  recentAuthRequired?: boolean;
  /** ID トークン（Firebase Auth から） */
  idToken?: string;
}

/**
 * 再認証レスポンス
 */
export interface ReauthResponse {
  /** 認証が有効か */
  valid: boolean;
  /** メッセージ */
  message?: string;
  /** 最終認証時刻（ISO8601） */
  lastAuthTime?: string;
  /** 再認証が必要か */
  requiresReauth?: boolean;
}

/**
 * 再認証設定
 */
export interface ReauthConfig {
  /** 最大経過時間（分） */
  maxAgeMinutes: number;
  /** 重要操作時に必須か */
  requiredForSensitiveOps: boolean;
}

/**
 * 重要操作タイプ
 */
export type SensitiveOperationType =
  | "account_deletion"
  | "data_export"
  | "password_change"
  | "email_change"
  | "admin_action";

// =============================================================================
// アクセスログ関連型
// =============================================================================

/**
 * アクセスログアクションタイプ
 */
export type AccessLogAction =
  | "export_download"
  | "export_request"
  | "deletion_request"
  | "deletion_cancel"
  | "recovery"
  | "admin_view"
  | "admin_action"
  | "sensitive_op";

/**
 * アクセスログエントリー
 */
export interface AccessLogEntry {
  /** ログ ID */
  logId?: string;
  /** ユーザー ID */
  userId: string;
  /** アクション */
  action: AccessLogAction;
  /** リソース ID */
  resourceId: string;
  /** リソースタイプ */
  resourceType?: string;
  /** IP アドレス（ハッシュ化） */
  ipAddressHash?: string;
  /** ユーザーエージェント */
  userAgent?: string;
  /** タイムスタンプ */
  timestamp?: Timestamp;
  /** 成功したか */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  errorMessage?: string;
  /** メタデータ */
  metadata?: Record<string, unknown>;
}

/**
 * アクセスログ取得オプション
 */
export interface GetAccessLogsOptions {
  /** 取得件数制限 */
  limit?: number;
  /** アクション種別でフィルタ */
  action?: AccessLogAction;
  /** 開始日時 */
  startDate?: Date;
  /** 終了日時 */
  endDate?: Date;
  /** リソースタイプ */
  resourceType?: string;
}

/**
 * アクセスログ集計結果
 */
export interface AccessLogSummary {
  /** アクション別カウント */
  actionCounts: Record<AccessLogAction, number>;
  /** 成功率 */
  successRate: number;
  /** 期間 */
  period: {
    start: string;
    end: string;
  };
}

// =============================================================================
// 管理者操作関連型
// =============================================================================

/**
 * 管理者アクションタイプ
 */
export type AdminActionType =
  | "view_user_data"
  | "export_user_data"
  | "delete_user_data"
  | "suspend_user"
  | "restore_user"
  | "modify_claims"
  | "force_logout"
  | "view_audit_logs";

/**
 * 管理者操作リクエスト
 */
export interface AdminActionRequest {
  /** 管理者 ID */
  adminId: string;
  /** 対象ユーザー ID */
  targetUserId: string;
  /** アクションタイプ */
  actionType: AdminActionType;
  /** 理由（監査用） */
  reason: string;
  /** メタデータ */
  metadata?: Record<string, unknown>;
}

/**
 * 管理者操作結果
 */
export interface AdminActionResult {
  /** 操作 ID */
  operationId: string;
  /** 成功したか */
  success: boolean;
  /** メッセージ */
  message: string;
  /** 実行日時 */
  executedAt: string;
  /** 変更内容 */
  changes?: Record<string, unknown>;
}

/**
 * 管理者権限レベル
 */
export type AdminLevel = "support" | "admin" | "super_admin";

/**
 * 管理者権限定義
 */
export interface AdminPermissions {
  /** 権限レベル */
  level: AdminLevel;
  /** 許可されたアクション */
  allowedActions: AdminActionType[];
  /** スコープ制限 */
  scopeRestrictions?: {
    /** 対象リージョン */
    regions?: string[];
    /** 対象ユーザープラン */
    userPlans?: string[];
  };
}

// =============================================================================
// リクエストメタデータ型
// =============================================================================

/**
 * リクエストメタデータ（セキュリティ用）
 */
export interface RequestSecurityMetadata {
  /** IP アドレス（生データ） */
  ipAddress?: string;
  /** IP アドレス（ハッシュ化） */
  ipAddressHash?: string;
  /** ユーザーエージェント */
  userAgent?: string;
  /** リファラー */
  referer?: string;
  /** リクエスト ID */
  requestId?: string;
  /** タイムスタンプ */
  timestamp: string;
  /** 地理情報（オプション） */
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

// =============================================================================
// セッション関連型
// =============================================================================

/**
 * セッション情報
 */
export interface SessionInfo {
  /** セッション ID */
  sessionId: string;
  /** ユーザー ID */
  userId: string;
  /** 作成日時 */
  createdAt: string;
  /** 最終認証日時 */
  lastAuthAt: string;
  /** 有効期限 */
  expiresAt: string;
  /** デバイス情報 */
  deviceInfo?: {
    platform: string;
    browser?: string;
    os?: string;
  };
  /** IP アドレスハッシュ */
  ipAddressHash?: string;
  /** アクティブか */
  isActive: boolean;
}

// =============================================================================
// 定数
// =============================================================================

/**
 * セキュリティ関連定数
 */
export const SECURITY_CONSTANTS = {
  /** 再認証の最大経過時間（分） */
  REAUTH_MAX_AGE_MINUTES: 5,
  /** 重要操作用の最大経過時間（分） */
  SENSITIVE_OP_MAX_AGE_MINUTES: 5,
  /** アクセスログ保存期間（日） */
  ACCESS_LOG_RETENTION_DAYS: 90,
  /** IP アドレスハッシュ用ソルト環境変数 */
  IP_HASH_SALT_ENV: "IP_HASH_SALT",
  /** 管理者操作ログ保存期間（日） */
  ADMIN_ACTION_LOG_RETENTION_DAYS: 365,
  /** 最大ログイン試行回数 */
  MAX_LOGIN_ATTEMPTS: 5,
  /** アカウントロック時間（分） */
  ACCOUNT_LOCK_MINUTES: 30,
} as const;

/**
 * 管理者権限マッピング
 */
export const ADMIN_PERMISSIONS: Record<AdminLevel, AdminActionType[]> = {
  support: [
    "view_user_data",
    "view_audit_logs",
  ],
  admin: [
    "view_user_data",
    "export_user_data",
    "suspend_user",
    "restore_user",
    "force_logout",
    "view_audit_logs",
  ],
  // eslint-disable-next-line camelcase -- Firebase Auth custom claim naming convention
  super_admin: [
    "view_user_data",
    "export_user_data",
    "delete_user_data",
    "suspend_user",
    "restore_user",
    "modify_claims",
    "force_logout",
    "view_audit_logs",
  ],
};
