/**
 * 管理者API型定義
 *
 * 管理者認証基盤、ユーザー管理・検索・強制削除APIのリクエスト/レスポンス型定義
 *
 * 参照: docs/common/tickets/041-admin-auth.md
 * 参照: docs/common/tickets/042-admin-user-management-api.md
 * 参照: docs/common/tickets/043-admin-user-search-api.md
 * 参照: docs/common/tickets/044-force-delete-api.md
 *
 * @version 1.2.0
 * @date 2025-12-11
 */

import { Timestamp } from "firebase-admin/firestore";

// =============================================================================
// 管理者認証基盤型定義（チケット041）
// =============================================================================

/**
 * 管理者ロールの種類
 *
 * superAdmin: すべての機能にアクセス可能（最高権限）
 * admin: ユーザー管理、データ閲覧、通知送信が可能
 * readOnlyAdmin: データ閲覧のみ可能（変更不可）
 */
export type AdminRole = "superAdmin" | "admin" | "readOnlyAdmin";

/**
 * 管理者カスタムクレーム
 * Firebase Auth のカスタムクレームとして設定される
 */
export interface AdminClaims {
  /** 管理者ロール */
  role: AdminRole;
  /** 許可された権限一覧 */
  permissions: AdminPermissionType[];
  /** MFA認証済みフラグ */
  mfaVerified: boolean;
  /** 最終ログイン日時（Unix timestamp） */
  lastLoginAt: number;
  /** クレーム有効期限（Unix timestamp） */
  expiresAt?: number;
}

/**
 * 管理者ユーザー情報（ミドルウェアでリクエストに追加される）
 */
export interface AdminUser {
  /** ユーザー ID */
  uid: string;
  /** 管理者ロール */
  role: AdminRole;
  /** 許可された権限一覧 */
  permissions: AdminPermissionType[];
  /** メールアドレス */
  email?: string;
  /** 表示名 */
  displayName?: string;
}

/**
 * 管理者権限タイプ
 */
export type AdminPermissionType =
  // ユーザー管理
  | "users:list"
  | "users:view"
  | "users:suspend"
  | "users:restore"
  | "users:delete"
  // 統計データ
  | "stats:view"
  // 監査ログ
  | "audit:view"
  | "audit:export"
  // 通知
  | "notifications:send"
  // マスタデータ
  | "master:view"
  | "master:edit"
  // 管理者管理
  | "admin:list"
  | "admin:create"
  | "admin:update"
  | "admin:delete"
  // セキュリティ設定
  | "security:view"
  | "security:edit";

/**
 * ロール別権限マッピング
 * チケット041の権限マトリクスに基づく
 */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermissionType[]> = {
  superAdmin: [
    "users:list", "users:view", "users:suspend", "users:restore", "users:delete",
    "stats:view",
    "audit:view", "audit:export",
    "notifications:send",
    "master:view", "master:edit",
    "admin:list", "admin:create", "admin:update", "admin:delete",
    "security:view", "security:edit",
  ],
  admin: [
    "users:list", "users:view", "users:suspend", "users:restore",
    "stats:view",
    "audit:view", "audit:export",
    "notifications:send",
    "master:view",
    "admin:list",
  ],
  readOnlyAdmin: [
    "users:list", "users:view",
    "stats:view",
    "audit:view",
    "master:view",
  ],
};

/**
 * ロール階層（数値が大きいほど上位権限）
 */
export const ADMIN_ROLE_HIERARCHY: Record<AdminRole, number> = {
  readOnlyAdmin: 1,
  admin: 2,
  superAdmin: 3,
};

// =============================================================================
// IPアドレス制限型定義
// =============================================================================

/**
 * IPアドレス許可リストドキュメント
 * Firestore: adminSettings/ipAllowlist
 */
export interface IpAllowlistDocument {
  /** 許可されたIPアドレス一覧 */
  allowedIps: string[];
  /** 許可されたCIDR範囲一覧 */
  allowedCidrs: string[];
  /** 許可リストが有効か */
  enabled: boolean;
  /** 最終更新日時 */
  updatedAt: Timestamp;
  /** 更新者UID */
  updatedBy: string;
}

/**
 * IPアドレス検証結果
 */
export interface IpValidationResult {
  /** 許可されているか */
  allowed: boolean;
  /** 許可理由（一致したIPまたはCIDR） */
  matchedRule?: string;
  /** エラーメッセージ */
  errorMessage?: string;
}

// =============================================================================
// MFA関連型定義
// =============================================================================

/**
 * MFA検証結果
 */
export interface MfaValidationResult {
  /** MFA設定済みか */
  enrolled: boolean;
  /** MFA検証済みか */
  verified: boolean;
  /** 登録されているMFA要素 */
  enrolledFactors?: string[];
  /** エラーメッセージ */
  errorMessage?: string;
}

// =============================================================================
// 管理者認証API型定義
// =============================================================================

/**
 * 管理者クレーム設定リクエスト
 */
export interface SetAdminClaimsRequest {
  /** 対象ユーザーID */
  targetUserId: string;
  /** 設定するロール */
  role: AdminRole;
  /** クレーム有効期限（日数、オプション） */
  expirationDays?: number;
}

/**
 * 管理者クレーム設定レスポンス
 */
export interface SetAdminClaimsResponse {
  /** 成功フラグ */
  success: boolean;
  /** 設定されたロール */
  role: AdminRole;
  /** 付与された権限 */
  permissions: AdminPermissionType[];
  /** メッセージ */
  message: string;
}

/**
 * 管理者クレーム削除リクエスト
 */
export interface RevokeAdminClaimsRequest {
  /** 対象ユーザーID */
  targetUserId: string;
  /** 削除理由 */
  reason: string;
}

/**
 * 管理者クレーム削除レスポンス
 */
export interface RevokeAdminClaimsResponse {
  /** 成功フラグ */
  success: boolean;
  /** メッセージ */
  message: string;
}

/**
 * 管理者一覧取得リクエスト
 */
export interface ListAdminUsersRequest {
  /** ロールでフィルタ（オプション） */
  role?: AdminRole;
  /** 取得件数制限（デフォルト: 100） */
  limit?: number;
  /** ページネーショントークン */
  pageToken?: string;
}

/**
 * 管理者一覧アイテム
 */
export interface AdminListItem {
  /** ユーザーID */
  uid: string;
  /** メールアドレス */
  email?: string;
  /** 表示名 */
  displayName?: string;
  /** ロール */
  role: AdminRole;
  /** MFA設定状況 */
  mfaEnrolled: boolean;
  /** 最終ログイン日時 */
  lastLoginAt?: number;
  /** アカウント作成日時 */
  createdAt?: string;
}

/**
 * 管理者一覧取得レスポンス
 */
export interface ListAdminUsersResponse {
  /** 管理者一覧 */
  admins: AdminListItem[];
  /** 次ページトークン */
  nextPageToken?: string;
  /** 総件数 */
  totalCount: number;
}

/**
 * IP許可リスト更新リクエスト
 */
export interface UpdateIpAllowlistRequest {
  /** 許可するIPアドレス一覧 */
  allowedIps: string[];
  /** 許可するCIDR範囲一覧 */
  allowedCidrs: string[];
  /** 許可リストを有効化するか */
  enabled: boolean;
}

/**
 * IP許可リスト更新レスポンス
 */
export interface UpdateIpAllowlistResponse {
  /** 成功フラグ */
  success: boolean;
  /** メッセージ */
  message: string;
  /** 更新後の許可リスト */
  allowlist: {
    allowedIps: string[];
    allowedCidrs: string[];
    enabled: boolean;
  };
}

// =============================================================================
// 管理者監査ログ型定義
// =============================================================================

/**
 * 管理者操作監査ログ
 */
export interface AdminAuditLog {
  /** ログID */
  id?: string;
  /** 実行者UID */
  performedBy: string;
  /** 実行者ロール */
  performerRole: AdminRole;
  /** 実行者IP */
  performerIp?: string;
  /** 操作タイプ */
  action: AdminAuditAction;
  /** 対象ユーザーUID（該当する場合） */
  targetUserId?: string;
  /** 操作詳細 */
  details: Record<string, unknown>;
  /** 操作結果 */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  errorMessage?: string;
  /** タイムスタンプ */
  timestamp: Timestamp;
}

/**
 * 管理者監査アクションタイプ
 */
export type AdminAuditAction =
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "SET_ADMIN_CLAIMS"
  | "REVOKE_ADMIN_CLAIMS"
  | "UPDATE_IP_ALLOWLIST"
  | "VIEW_USER_DATA"
  | "SUSPEND_USER"
  | "RESTORE_USER"
  | "DELETE_USER"
  | "FORCE_DELETE_USER"
  | "SEND_NOTIFICATION"
  | "EDIT_MASTER_DATA"
  | "EXPORT_AUDIT_LOGS"
  | "SECURITY_SETTING_CHANGE";

// =============================================================================
// 管理者認証エラーコード
// =============================================================================

/**
 * 管理者認証エラーコード
 */
export const ADMIN_AUTH_ERROR_CODES = {
  /** 認証トークンなし */
  NO_TOKEN: "ADMIN_NO_TOKEN",
  /** 無効なトークン */
  INVALID_TOKEN: "ADMIN_INVALID_TOKEN",
  /** 管理者権限なし */
  NOT_ADMIN: "ADMIN_NOT_ADMIN",
  /** ロール不足 */
  INSUFFICIENT_ROLE: "ADMIN_INSUFFICIENT_ROLE",
  /** MFA未設定 */
  MFA_NOT_ENROLLED: "ADMIN_MFA_NOT_ENROLLED",
  /** MFA未検証 */
  MFA_NOT_VERIFIED: "ADMIN_MFA_NOT_VERIFIED",
  /** IPアドレス不許可 */
  IP_NOT_ALLOWED: "ADMIN_IP_NOT_ALLOWED",
  /** クレーム期限切れ */
  CLAIMS_EXPIRED: "ADMIN_CLAIMS_EXPIRED",
  /** 自己操作禁止 */
  SELF_OPERATION_DENIED: "ADMIN_SELF_OPERATION_DENIED",
} as const;

export type AdminAuthErrorCode = typeof ADMIN_AUTH_ERROR_CODES[keyof typeof ADMIN_AUTH_ERROR_CODES];

// =============================================================================
// 管理者認証定数
// =============================================================================

/**
 * 管理者認証関連定数
 */
export const ADMIN_AUTH_CONSTANTS = {
  /** 管理者クレームデフォルト有効期限（日） */
  DEFAULT_CLAIMS_EXPIRATION_DAYS: 90,
  /** IPアドレス許可リストドキュメントパス */
  IP_ALLOWLIST_DOC_PATH: "adminSettings/ipAllowlist",
  /** 監査ログコレクション */
  AUDIT_LOG_COLLECTION: "adminAuditLogs",
  /** 管理者ユーザーコレクション */
  ADMIN_USERS_COLLECTION: "adminUsers",
  /** 管理者一覧取得のデフォルト制限 */
  DEFAULT_LIST_LIMIT: 100,
  /** 管理者一覧取得の最大制限 */
  MAX_LIST_LIMIT: 500,
} as const;

// =============================================================================
// ユーザー状態・プラン型
// =============================================================================

/**
 * ユーザー状態
 */
export type UserStatus = "active" | "suspended" | "deletionScheduled";

/**
 * ユーザープラン
 */
export type UserPlan = "free" | "premium";

// =============================================================================
// ユーザー管理API型（チケット042）
// =============================================================================

/**
 * 管理者用ユーザーサマリー
 *
 * ユーザー一覧表示用の簡易情報
 */
export interface AdminUserSummary {
  /** ユーザーID */
  userId: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  displayName: string | null;
  /** ユーザー状態 */
  status: UserStatus;
  /** プラン */
  plan: UserPlan;
  /** 作成日時（ISO8601） */
  createdAt: string;
  /** 最終ログイン日時（ISO8601） */
  lastLoginAt: string | null;
  /** セッション数 */
  sessionCount: number;
}

/**
 * 管理者用ユーザー詳細
 *
 * ユーザー詳細表示用の完全情報
 */
export interface AdminUserDetail extends AdminUserSummary {
  /** ニックネーム */
  nickname: string | null;
  /** 生年 */
  birthYear?: number;
  /** 性別 */
  gender?: string;
  /** 身長（cm） */
  height?: number;
  /** 体重（kg） */
  weight?: number;
  /** フィットネスレベル */
  fitnessLevel?: string;
  /** 利用規約同意フラグ */
  tosAccepted: boolean;
  /** プライバシーポリシー同意フラグ */
  ppAccepted: boolean;
  /** 停止理由（停止中の場合） */
  suspendReason?: string;
  /** 停止日時（停止中の場合、ISO8601） */
  suspendedAt?: string;
  /** 削除予定日（削除予定の場合、ISO8601） */
  scheduledDeletionDate?: string;
  /** 更新日時（ISO8601） */
  updatedAt: string;
  /** Firebase Authメタデータ */
  authMetadata?: {
    /** メール認証済みフラグ */
    emailVerified: boolean;
    /** 認証プロバイダー */
    providers: string[];
    /** 無効化フラグ */
    disabled: boolean;
  };
}

/**
 * ユーザー一覧取得リクエスト
 */
export interface ListUsersRequest {
  /** 取得件数（デフォルト: 20、最大: 100） */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
  /** ソート項目 */
  sortBy?: "createdAt" | "lastLoginAt" | "displayName";
  /** ソート順序 */
  sortOrder?: "asc" | "desc";
  /** ステータスフィルタ */
  status?: UserStatus;
  /** プランフィルタ */
  plan?: UserPlan;
}

/**
 * ユーザー一覧取得レスポンス
 */
export interface ListUsersResponse {
  /** ユーザー一覧 */
  users: AdminUserSummary[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 総件数 */
  totalCount: number;
  /** 取得件数 */
  limit: number;
}

/**
 * ユーザー詳細取得リクエスト
 */
export interface GetUserDetailRequest {
  /** ユーザーID */
  userId: string;
}

/**
 * ユーザー詳細取得レスポンス
 */
export interface GetUserDetailResponse {
  /** ユーザー詳細 */
  user: AdminUserDetail;
}

/**
 * ユーザー停止リクエスト
 */
export interface SuspendUserRequest {
  /** 対象ユーザーID */
  userId: string;
  /** 停止理由（必須、監査ログ用） */
  reason: string;
  /** ユーザーへの通知フラグ（デフォルト: true） */
  notifyUser?: boolean;
}

/**
 * ユーザー停止レスポンス
 */
export interface SuspendUserResponse {
  /** ユーザーID */
  userId: string;
  /** 停止日時（ISO8601） */
  suspendedAt: string;
  /** メッセージ */
  message: string;
}

/**
 * ユーザー復帰リクエスト
 */
export interface RestoreUserRequest {
  /** 対象ユーザーID */
  userId: string;
  /** 復帰理由（必須、監査ログ用） */
  reason: string;
  /** ユーザーへの通知フラグ（デフォルト: true） */
  notifyUser?: boolean;
}

/**
 * ユーザー復帰レスポンス
 */
export interface RestoreUserResponse {
  /** ユーザーID */
  userId: string;
  /** 復帰日時（ISO8601） */
  restoredAt: string;
  /** メッセージ */
  message: string;
}

// =============================================================================
// ユーザー検索API型（チケット043）
// =============================================================================

/**
 * ユーザー検索リクエスト（共通）
 */
export interface SearchUsersRequest {
  /** メールアドレス検索 */
  email?: string;
  /** ユーザーID検索 */
  userId?: string;
  /** 表示名検索 */
  displayName?: string;
  /** 完全一致フラグ（デフォルト: false = 部分一致） */
  exactMatch?: boolean;
  /** 取得件数（デフォルト: 20、最大: 100） */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
}

/**
 * メール検索リクエスト
 */
export interface SearchByEmailRequest {
  /** メールアドレス */
  email: string;
  /** 完全一致フラグ */
  exactMatch?: boolean;
  /** 取得件数 */
  limit?: number;
}

/**
 * UID検索リクエスト
 */
export interface SearchByUidRequest {
  /** ユーザーID */
  userId: string;
}

/**
 * 名前検索リクエスト
 */
export interface SearchByNameRequest {
  /** 表示名（部分一致） */
  displayName: string;
  /** 取得件数 */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
}

/**
 * ユーザー検索レスポンス
 */
export interface SearchUsersResponse {
  /** 検索結果 */
  users: AdminUserSummary[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 検索結果件数 */
  resultCount: number;
  /** 検索クエリ */
  query: {
    email?: string;
    userId?: string;
    displayName?: string;
    exactMatch: boolean;
  };
}

// =============================================================================
// 監査ログ用型
// =============================================================================

/**
 * 管理者操作タイプ（ユーザー管理用）
 */
export type AdminUserActionType =
  | "list_users"
  | "view_user_detail"
  | "suspend_user"
  | "restore_user"
  | "search_users";

/**
 * 管理者操作ログエントリー
 */
export interface AdminUserActionLog {
  /** 管理者ID */
  adminId: string;
  /** 操作タイプ */
  actionType: AdminUserActionType;
  /** 対象ユーザーID（該当する場合） */
  targetUserId?: string;
  /** 操作理由 */
  reason?: string;
  /** 操作日時（ISO8601） */
  timestamp: string;
  /** 操作結果 */
  success: boolean;
  /** 追加メタデータ */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 強制削除API型定義（チケット044）
// =============================================================================

/**
 * 強制削除リクエスト
 *
 * superAdminがユーザーを即座に完全削除するためのリクエスト
 * GDPR対応や法的要請に対応するため、30日間の猶予期間を待たずに削除
 */
export interface ForceDeleteRequest {
  /** 削除対象のユーザーID */
  userId: string;
  /** 削除理由（監査ログ用、必須） */
  reason: string;
  /** 確認コード（ユーザーIDの最初の8文字、誤操作防止） */
  confirmationCode: string;
}

/**
 * 削除プレビューレスポンス
 *
 * 削除前に対象データの概要を確認するためのレスポンス
 */
export interface DeletePreviewResponse {
  /** ユーザーID */
  userId: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  displayName: string | null;
  /** アカウント作成日時（ISO8601） */
  createdAt: string;
  /** トレーニングセッション数 */
  sessionCount: number;
  /** Stripeアカウントの有無 */
  hasStripeAccount: boolean;
  /** サブスクリプションステータス */
  subscriptionStatus: string | null;
  /** 確認コード（ユーザーIDの最初の8文字） */
  confirmationCode: string;
  /** 同意レコード数 */
  consentCount: number;
  /** 最終ログイン日時（ISO8601） */
  lastLoginAt: string | null;
  /** 削除予定フラグ */
  deletionScheduled: boolean;
}

/**
 * 強制削除レスポンス
 */
export interface ForceDeleteResponse {
  /** 削除成功 */
  success: boolean;
  /** メッセージ */
  message: string;
  /** 削除されたユーザーID */
  deletedUserId: string;
  /** バックアップID（監査ログ参照用） */
  backupId?: string;
}

// =============================================================================
// ユーザーバックアップ型定義
// =============================================================================

/**
 * ユーザーバックアップデータ
 *
 * 削除前に作成されるバックアップ（監査ログに保存）
 */
export interface UserBackupData {
  /** ユーザーID */
  userId: string;
  /** ユーザードキュメントデータ */
  userData: UserBackupDocument | null;
  /** セッションデータ */
  sessions: SessionBackupData[];
  /** 同意レコード */
  consents: ConsentBackupData[];
  /** Stripe顧客情報 */
  stripeData?: StripeBackupData;
  /** バックアップ作成日時（ISO8601） */
  backupAt: string;
  /** バックアップ理由 */
  reason: string;
  /** バックアップ実行者ID */
  performedBy: string;
}

/**
 * ユーザードキュメントバックアップ
 */
export interface UserBackupDocument {
  /** ニックネーム */
  nickname?: string;
  /** メールアドレス */
  email?: string;
  /** プロフィール画像URL */
  photoURL?: string;
  /** 生年 */
  birthYear?: number;
  /** 性別 */
  gender?: string;
  /** 身長（cm） */
  height?: number;
  /** 体重（kg） */
  weight?: number;
  /** フィットネスレベル */
  fitnessLevel?: string;
  /** 利用規約同意 */
  tosAccepted?: boolean;
  /** 利用規約同意日時 */
  tosAcceptedAt?: string;
  /** プライバシーポリシー同意 */
  ppAccepted?: boolean;
  /** プライバシーポリシー同意日時 */
  ppAcceptedAt?: string;
  /** 作成日時 */
  createdAt?: string;
  /** 更新日時 */
  updatedAt?: string;
  /** 最終ログイン日時 */
  lastLoginAt?: string;
  /** サブスクリプションステータス */
  subscriptionStatus?: string;
  /** Stripe顧客ID */
  stripeCustomerId?: string;
}

/**
 * セッションバックアップデータ
 */
export interface SessionBackupData {
  /** セッションID */
  sessionId: string;
  /** セッションデータ（任意） */
  data: Record<string, unknown>;
}

/**
 * 同意バックアップデータ
 */
export interface ConsentBackupData {
  /** 同意ID */
  consentId: string;
  /** 同意データ */
  data: Record<string, unknown>;
}

/**
 * Stripeバックアップデータ
 */
export interface StripeBackupData {
  /** Stripe顧客ID */
  customerId: string | null;
  /** サブスクリプションID */
  subscriptionId?: string | null;
  /** サブスクリプションステータス */
  subscriptionStatus?: string | null;
}

// =============================================================================
// 完全削除結果型定義
// =============================================================================

/**
 * 完全削除実行結果
 */
export interface ForceDeleteResult {
  /** 削除成功 */
  success: boolean;
  /** 削除されたコレクション */
  deletedCollections: string[];
  /** Auth削除成功 */
  authDeleted: boolean;
  /** BigQuery匿名化成功 */
  bigQueryAnonymized: boolean;
  /** Stripe顧客削除成功 */
  stripeDeleted: boolean;
  /** Storage削除成功 */
  storageDeleted: boolean;
  /** バックアップID */
  backupId: string;
  /** エラーメッセージ（部分的な失敗の場合） */
  errors?: string[];
}

// =============================================================================
// 強制削除監査ログ型定義
// =============================================================================

/**
 * 強制削除監査ログエントリー
 */
export interface ForceDeleteAuditLog {
  /** アクションタイプ */
  action: "FORCE_DELETE_USER";
  /** 実行者ID */
  performedBy: string;
  /** 対象ユーザーID */
  targetUser: string;
  /** 削除理由 */
  reason: string;
  /** バックアップデータ */
  backupData: UserBackupData;
  /** 削除結果 */
  deleteResult: ForceDeleteResult;
  /** タイムスタンプ */
  timestamp: Timestamp;
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Firestoreタイムスタンプを安全にISO文字列に変換
 *
 * @param timestamp - Firestoreタイムスタンプまたはタイムスタンプ互換オブジェクト
 * @returns ISO8601形式の日時文字列、またはnull
 */
export function timestampToString(
  timestamp: Timestamp | { toDate: () => Date } | undefined | null,
): string | null {
  if (!timestamp) {
    return null;
  }
  try {
    if ("toDate" in timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 確認コードを生成
 *
 * ユーザーIDの最初の8文字を確認コードとして使用
 *
 * @param userId - ユーザーID
 * @returns 確認コード（8文字）
 */
export function generateConfirmationCode(userId: string): string {
  return userId.substring(0, 8);
}

/**
 * 確認コードを検証
 *
 * @param userId - ユーザーID
 * @param confirmationCode - 入力された確認コード
 * @returns 一致する場合true
 */
export function validateConfirmationCode(
  userId: string,
  confirmationCode: string,
): boolean {
  return generateConfirmationCode(userId) === confirmationCode;
}

// =============================================================================
// 利用統計API型（チケット045）
// =============================================================================

/**
 * 統計リクエストパラメータ
 */
export interface StatsRequest {
  /** 集計期間（7日、30日、90日） */
  period?: StatsPeriod;
}

/**
 * 期間設定
 */
export type StatsPeriod = "7d" | "30d" | "90d";

// =============================================================================
// アクティブユーザー統計
// =============================================================================

/**
 * 日次アクティブユーザー
 */
export interface DailyActiveUsers {
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** アクティブユーザー数 */
  count: number;
}

/**
 * DAU/MAU統計
 */
export interface ActiveUsersStats {
  /** 日次アクティブユーザー（DAU）のリスト */
  dau: DailyActiveUsers[];
  /** 月次アクティブユーザー数（MAU） */
  mau: number;
  /** 前期間のMAU */
  previousMAU: number;
  /** MAUの増減率（%） */
  changeRate: number;
  /** 集計期間 */
  period: string;
}

// =============================================================================
// トレーニング統計
// =============================================================================

/**
 * トレーニング総計
 */
export interface TrainingTotal {
  /** 総セッション数 */
  sessions: number;
  /** 平均トレーニング時間（秒） */
  avgDuration: number;
  /** 平均スコア（0-100） */
  avgScore: number;
}

/**
 * 種目別トレーニング統計
 */
export interface TrainingByExercise {
  /** 種目タイプ */
  exerciseType: string;
  /** セッション数 */
  count: number;
  /** 平均スコア */
  avgScore: number;
}

/**
 * 日別トレーニング統計
 */
export interface DailyTraining {
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** セッション数 */
  count: number;
}

/**
 * トレーニング統計
 */
export interface TrainingStats {
  /** 総計 */
  total: TrainingTotal;
  /** 種目別統計 */
  byExercise: TrainingByExercise[];
  /** 日別統計 */
  daily: DailyTraining[];
  /** 集計期間 */
  period: string;
}

// =============================================================================
// ユーザー統計（Firestore集計用）
// =============================================================================

/**
 * プラン別ユーザー数
 */
export interface UsersByPlan {
  /** 無料プランユーザー数 */
  free: number;
  /** プレミアムプランユーザー数 */
  premium: number;
}

/**
 * ユーザー統計（管理者向け）
 */
export interface AdminUserStats {
  /** 総ユーザー数 */
  total: number;
  /** 新規ユーザー数（期間内） */
  new: number;
  /** プラン別ユーザー数 */
  byPlan: UsersByPlan;
  /** 削除予定ユーザー数 */
  deletionScheduled: number;
  /** 無効化ユーザー数 */
  disabled: number;
  /** 集計期間 */
  period: string;
}

// =============================================================================
// 継続率統計
// =============================================================================

/**
 * 継続率詳細
 */
export interface RetentionDetail {
  /** 対象ユーザー総数 */
  totalUsers: number;
  /** 復帰ユーザー数 */
  returningUsers: number;
  /** 継続率（%） */
  rate: number;
}

/**
 * 継続率統計
 */
export interface RetentionStats {
  /** 7日間継続率 */
  retention7d: RetentionDetail;
  /** 30日間継続率 */
  retention30d: RetentionDetail;
}

// =============================================================================
// ダッシュボード統計
// =============================================================================

/**
 * ダッシュボード統計（全統計をまとめたもの）
 */
export interface DashboardStats {
  /** アクティブユーザー統計 */
  activeUsers: ActiveUsersStats;
  /** トレーニング統計 */
  training: TrainingStats;
  /** ユーザー統計 */
  users: AdminUserStats;
  /** 継続率統計 */
  retention: RetentionStats;
  /** 集計期間 */
  period: string;
  /** 統計生成日時（ISO8601形式） */
  generatedAt: string;
}

// =============================================================================
// BigQuery クエリ結果型
// =============================================================================

/**
 * DAUクエリ結果
 */
export interface DAUQueryResult {
  date: { value: string };
  dau: number;
}

/**
 * MAUクエリ結果
 */
export interface MAUQueryResult {
  mau: number;
}

/**
 * 前期間MAUクエリ結果
 */
export interface PreviousMAUQueryResult {
  previous_mau: number;
}

/**
 * トレーニング総計クエリ結果
 */
export interface TrainingTotalQueryResult {
  total_sessions: number;
  avg_duration: number;
  avg_score: number;
}

/**
 * 種目別統計クエリ結果
 */
export interface ExerciseStatsQueryResult {
  exercise_type: string;
  count: number;
  avg_score: number;
}

/**
 * 日別トレーニングクエリ結果
 */
export interface DailyTrainingQueryResult {
  date: { value: string };
  count: number;
}

/**
 * 継続率クエリ結果
 */
export interface RetentionQueryResult {
  total_users: number;
  returning_users: number;
  retention_rate: number;
}

// =============================================================================
// 統計API定数
// =============================================================================

/**
 * 統計API関連定数
 */
export const STATS_CONSTANTS = {
  /** デフォルト期間 */
  DEFAULT_PERIOD: "30d" as StatsPeriod,
  /** キャッシュTTL（5分） */
  CACHE_TTL_MS: 5 * 60 * 1000,
  /** BigQuery Project ID */
  BIGQUERY_PROJECT_ID: "tokyo-list-478804-e5",
  /** BigQuery Dataset */
  BIGQUERY_DATASET: "fitness_analytics",
  /** BigQuery Sessions Table */
  BIGQUERY_SESSIONS_TABLE: "sessions",
  /** 期間を日数に変換するマッピング */
  PERIOD_TO_DAYS: {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  } as const,
} as const;

/**
 * 統計APIアクションタイプ
 */
export type StatsActionType =
  | "view_active_users_stats"
  | "view_training_stats"
  | "view_user_stats"
  | "view_retention_stats"
  | "view_dashboard_stats";
