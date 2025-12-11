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
  | "view_audit_logs"
  // マスタデータ管理（チケット049）
  | "view_master_data"
  | "edit_master_data"
  // セキュリティ設定管理（チケット050）
  | "manage_security";

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
    "view_master_data",
  ],
  admin: [
    "view_user_data",
    "export_user_data",
    "suspend_user",
    "restore_user",
    "force_logout",
    "view_audit_logs",
    "view_master_data",
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
    "view_master_data",
    "edit_master_data",
    "manage_security",
  ],
};

// =============================================================================
// セキュリティ監視型定義（チケット047）
// =============================================================================

/**
 * セキュリティイベントタイプ
 */
export type SecurityEventType =
  | "LOGIN_FAILURE_BURST"       // ログイン失敗の連続
  | "SUSPICIOUS_IP"             // 不審なIPからのアクセス
  | "BRUTE_FORCE_ATTEMPT"       // ブルートフォース攻撃
  | "ACCOUNT_TAKEOVER_ATTEMPT"  // アカウント乗っ取り試行
  | "UNUSUAL_API_PATTERN"       // 異常なAPI呼び出し
  | "ADMIN_ACCESS_ANOMALY"      // 管理者アクセスの異常
  | "DATA_EXFILTRATION_RISK"    // データ流出リスク
  | "RATE_LIMIT_EXCEEDED"       // レート制限超過
  | "UNAUTHORIZED_ACCESS"       // 権限外アクセス
  | "SESSION_HIJACK_RISK";      // セッションハイジャックリスク

/**
 * セキュリティイベントの重要度
 */
export type SecuritySeverity = "low" | "medium" | "high" | "critical";

/**
 * セキュリティイベントのステータス
 */
export type SecurityEventStatus =
  | "new"
  | "acknowledged"
  | "investigating"
  | "resolved"
  | "false_positive";

/**
 * セキュリティイベント
 */
export interface SecurityEvent {
  /** イベントID */
  id: string;
  /** イベントタイプ */
  type: SecurityEventType;
  /** 重要度 */
  severity: SecuritySeverity;
  /** タイトル */
  title: string;
  /** 説明 */
  description: string;
  /** ソースIPアドレス */
  sourceIp: string;
  /** 関連ユーザーID */
  userId?: string;
  /** ユーザーエージェント */
  userAgent?: string;
  /** 対象エンドポイント */
  endpoint?: string;
  /** 詳細情報 */
  details: Record<string, unknown>;
  /** ステータス */
  status: SecurityEventStatus;
  /** 検出日時 */
  detectedAt: Timestamp;
  /** 解決日時 */
  resolvedAt?: Timestamp;
  /** 解決者ID */
  resolvedBy?: string;
  /** 関連インシデントID */
  incidentId?: string;
}

/**
 * アラート条件オペレーター
 */
export type AlertConditionOperator = "gt" | "gte" | "lt" | "lte" | "eq";

/**
 * アラート条件
 */
export interface AlertCondition {
  /** 監視対象メトリクス */
  metric: string;
  /** 比較オペレーター */
  operator: AlertConditionOperator;
  /** 閾値 */
  threshold: number;
  /** 時間窓（分） */
  timeWindowMinutes: number;
}

/**
 * アラート通知タイプ
 */
export type AlertNotificationType = "email" | "slack" | "webhook";

/**
 * アラート通知設定
 */
export interface AlertNotification {
  /** 通知タイプ */
  type: AlertNotificationType;
  /** 送信先（メールアドレス、SlackチャンネルID、WebhookURL） */
  target: string;
  /** 有効フラグ */
  enabled: boolean;
}

/**
 * アラートルール
 */
export interface AlertRule {
  /** ルールID */
  id: string;
  /** ルール名 */
  name: string;
  /** 説明 */
  description: string;
  /** 有効フラグ */
  enabled: boolean;
  /** 対象イベントタイプ */
  eventType: SecurityEventType;
  /** アラート条件 */
  conditions: AlertCondition[];
  /** 重要度 */
  severity: SecuritySeverity;
  /** 通知設定 */
  notifications: AlertNotification[];
  /** クールダウン時間（分） */
  cooldownMinutes: number;
  /** 作成日時 */
  createdAt: Timestamp;
  /** 作成者ID */
  createdBy: string;
  /** 更新日時 */
  updatedAt: Timestamp;
}

/**
 * インシデントカテゴリ
 */
export type IncidentCategory =
  | "DATA_BREACH"
  | "UNAUTHORIZED_ACCESS"
  | "MALWARE"
  | "DDOS"
  | "PHISHING"
  | "INSIDER_THREAT"
  | "CONFIGURATION_ERROR"
  | "OTHER";

/**
 * セキュリティインシデントステータス
 *
 * Note: firestore.tsにも同名の型があるため、セキュリティ監視用として独自定義
 */
export type SecurityIncidentStatus =
  | "open"
  | "investigating"
  | "contained"
  | "resolved"
  | "closed";

/**
 * インシデント対応アクション
 */
export interface IncidentAction {
  /** アクションID */
  id: string;
  /** アクション内容 */
  action: string;
  /** 実行者ID */
  performedBy: string;
  /** 実行日時 */
  performedAt: Timestamp;
  /** メモ */
  notes: string;
}

/**
 * インシデント
 */
export interface Incident {
  /** インシデントID */
  id: string;
  /** タイトル */
  title: string;
  /** 説明 */
  description: string;
  /** 重要度 */
  severity: SecuritySeverity;
  /** ステータス */
  status: SecurityIncidentStatus;
  /** カテゴリ */
  category: IncidentCategory;
  /** 影響を受けたユーザー数 */
  affectedUsers: number;
  /** 影響を受けたシステム */
  affectedSystems: string[];
  /** 関連セキュリティイベントID */
  relatedEvents: string[];
  /** 担当者ID */
  assignee?: string;
  /** 対応履歴 */
  timeline: IncidentAction[];
  /** 検出日時 */
  detectedAt: Timestamp;
  /** 封じ込め日時 */
  containedAt?: Timestamp;
  /** 解決日時 */
  resolvedAt?: Timestamp;
  /** クローズ日時 */
  closedAt?: Timestamp;
  /** 根本原因 */
  rootCause?: string;
  /** 対策 */
  remediation?: string;
  /** 教訓 */
  lessonsLearned?: string;
  /** 作成日時 */
  createdAt: Timestamp;
  /** 作成者ID */
  createdBy: string;
  /** 更新日時 */
  updatedAt: Timestamp;
}

/**
 * 脅威レベル
 */
export type ThreatLevel = "low" | "medium" | "high" | "critical";

// =============================================================================
// セキュリティ監視APIリクエスト/レスポンス型
// =============================================================================

/**
 * セキュリティダッシュボードレスポンス
 */
export interface SecurityDashboardResponse {
  /** サマリー情報 */
  summary: {
    /** 脅威レベル */
    threatLevel: ThreatLevel;
    /** 直近24時間のイベント数 */
    eventsLast24h: number;
    /** 直近7日間のイベント数 */
    eventsLast7d: number;
    /** アクティブなインシデント数 */
    activeIncidents: number;
    /** クリティカルイベント数 */
    criticalEvents: number;
    /** ハイイベント数 */
    highEvents: number;
  };
  /** ログインセキュリティ情報 */
  loginSecurity: {
    /** 直近24時間のログイン失敗数 */
    failuresLast24h: number;
    /** 不審なIP数 */
    suspiciousIpCount: number;
    /** ブロックされたIP数 */
    blockedIps: number;
  };
  /** 最近のイベント */
  recentEvents: SecurityEventSummary[];
  /** アラート情報 */
  alerts: {
    /** アクティブなアラート数 */
    activeAlerts: number;
    /** 直近24時間にトリガーされたアラート数 */
    triggeredLast24h: number;
  };
  /** 生成日時（ISO8601） */
  generatedAt: string;
}

/**
 * セキュリティイベントサマリー（ダッシュボード用）
 */
export interface SecurityEventSummary {
  /** イベントID */
  id: string;
  /** イベントタイプ */
  type: SecurityEventType;
  /** 重要度 */
  severity: SecuritySeverity;
  /** タイトル */
  title: string;
  /** 検出日時（ISO8601） */
  detectedAt: string;
  /** ステータス */
  status: SecurityEventStatus;
}

/**
 * セキュリティイベント一覧リクエスト
 */
export interface ListSecurityEventsRequest {
  /** 取得件数（デフォルト: 20, 最大: 100） */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
  /** 重要度フィルタ */
  severity?: SecuritySeverity;
  /** ステータスフィルタ */
  status?: SecurityEventStatus;
  /** イベントタイプフィルタ */
  type?: SecurityEventType;
  /** 開始日時（ISO8601） */
  startDate?: string;
  /** 終了日時（ISO8601） */
  endDate?: string;
}

/**
 * セキュリティイベント一覧レスポンス
 */
export interface ListSecurityEventsResponse {
  /** イベント一覧 */
  events: SecurityEventSummary[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 総件数 */
  totalCount: number;
}

/**
 * アラートルール作成リクエスト
 */
export interface CreateAlertRuleRequest {
  /** ルール名 */
  name: string;
  /** 説明 */
  description: string;
  /** 対象イベントタイプ */
  eventType: SecurityEventType;
  /** アラート条件 */
  conditions: AlertCondition[];
  /** 重要度 */
  severity: SecuritySeverity;
  /** 通知設定 */
  notifications: AlertNotification[];
  /** クールダウン時間（分） */
  cooldownMinutes: number;
}

/**
 * アラートルール更新リクエスト
 */
export interface UpdateAlertRuleRequest {
  /** ルールID */
  ruleId: string;
  /** ルール名 */
  name?: string;
  /** 説明 */
  description?: string;
  /** 有効フラグ */
  enabled?: boolean;
  /** アラート条件 */
  conditions?: AlertCondition[];
  /** 重要度 */
  severity?: SecuritySeverity;
  /** 通知設定 */
  notifications?: AlertNotification[];
  /** クールダウン時間（分） */
  cooldownMinutes?: number;
}

/**
 * アラートルール一覧リクエスト
 */
export interface ListAlertRulesRequest {
  /** 取得件数 */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
  /** 有効フラグでフィルタ */
  enabled?: boolean;
  /** イベントタイプでフィルタ */
  eventType?: SecurityEventType;
}

/**
 * アラートルール一覧レスポンス
 */
export interface ListAlertRulesResponse {
  /** ルール一覧 */
  rules: AlertRuleSummary[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 総件数 */
  totalCount: number;
}

/**
 * アラートルールサマリー
 */
export interface AlertRuleSummary {
  /** ルールID */
  id: string;
  /** ルール名 */
  name: string;
  /** 説明 */
  description: string;
  /** 有効フラグ */
  enabled: boolean;
  /** 対象イベントタイプ */
  eventType: SecurityEventType;
  /** 重要度 */
  severity: SecuritySeverity;
  /** 作成日時（ISO8601） */
  createdAt: string;
}

/**
 * インシデント作成リクエスト
 */
export interface CreateIncidentRequest {
  /** タイトル */
  title: string;
  /** 説明 */
  description: string;
  /** 重要度 */
  severity: SecuritySeverity;
  /** カテゴリ */
  category: IncidentCategory;
  /** 影響を受けたシステム */
  affectedSystems?: string[];
  /** 関連セキュリティイベントID */
  relatedEvents?: string[];
}

/**
 * インシデント更新リクエスト
 */
export interface UpdateIncidentRequest {
  /** インシデントID */
  incidentId: string;
  /** ステータス */
  status?: SecurityIncidentStatus;
  /** 担当者ID */
  assignee?: string;
  /** 根本原因 */
  rootCause?: string;
  /** 対策 */
  remediation?: string;
  /** 教訓 */
  lessonsLearned?: string;
  /** 影響を受けたユーザー数 */
  affectedUsers?: number;
}

/**
 * インシデントアクション追加リクエスト
 */
export interface AddIncidentActionRequest {
  /** インシデントID */
  incidentId: string;
  /** アクション内容 */
  action: string;
  /** メモ */
  notes: string;
}

/**
 * インシデント一覧リクエスト
 */
export interface ListIncidentsRequest {
  /** 取得件数 */
  limit?: number;
  /** ページネーションカーソル */
  cursor?: string;
  /** ステータスフィルタ */
  status?: SecurityIncidentStatus;
  /** 重要度フィルタ */
  severity?: SecuritySeverity;
  /** カテゴリフィルタ */
  category?: IncidentCategory;
}

/**
 * インシデント一覧レスポンス
 */
export interface ListIncidentsResponse {
  /** インシデント一覧 */
  incidents: IncidentSummary[];
  /** 次ページカーソル */
  nextCursor?: string;
  /** 総件数 */
  totalCount: number;
}

/**
 * インシデントサマリー
 */
export interface IncidentSummary {
  /** インシデントID */
  id: string;
  /** タイトル */
  title: string;
  /** 重要度 */
  severity: SecuritySeverity;
  /** ステータス */
  status: SecurityIncidentStatus;
  /** カテゴリ */
  category: IncidentCategory;
  /** 影響を受けたユーザー数 */
  affectedUsers: number;
  /** 担当者ID */
  assignee?: string;
  /** 検出日時（ISO8601） */
  detectedAt: string;
  /** 作成日時（ISO8601） */
  createdAt: string;
}

/**
 * インシデント詳細レスポンス
 */
export interface IncidentDetailResponse {
  /** インシデント情報 */
  incident: {
    id: string;
    title: string;
    description: string;
    severity: SecuritySeverity;
    status: SecurityIncidentStatus;
    category: IncidentCategory;
    affectedUsers: number;
    affectedSystems: string[];
    relatedEvents: string[];
    assignee?: string;
    timeline: Array<{
      id: string;
      action: string;
      performedBy: string;
      performedAt: string;
      notes: string;
    }>;
    detectedAt: string;
    containedAt?: string;
    resolvedAt?: string;
    closedAt?: string;
    rootCause?: string;
    remediation?: string;
    lessonsLearned?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
  };
}

// =============================================================================
// セキュリティ監視定数
// =============================================================================

/**
 * セキュリティ監視関連定数
 */
export const SECURITY_MONITORING_CONSTANTS = {
  /** デフォルト取得件数 */
  DEFAULT_LIMIT: 20,
  /** 最大取得件数 */
  MAX_LIMIT: 100,
  /** セキュリティイベントコレクション */
  SECURITY_EVENTS_COLLECTION: "securityEvents",
  /** アラートルールコレクション */
  ALERT_RULES_COLLECTION: "alertRules",
  /** インシデントコレクション */
  INCIDENTS_COLLECTION: "incidents",
  /** アラート履歴コレクション */
  ALERT_HISTORY_COLLECTION: "alertHistory",
  /** ブロックIPコレクション */
  BLOCKED_IPS_COLLECTION: "blockedIps",
  /** 脅威レベル判定閾値 */
  THREAT_LEVEL_THRESHOLDS: {
    CRITICAL_EVENTS_FOR_CRITICAL: 1,
    HIGH_EVENTS_FOR_CRITICAL: 3,
    HIGH_EVENTS_FOR_HIGH: 1,
    MEDIUM_EVENTS_FOR_HIGH: 5,
    MEDIUM_EVENTS_FOR_MEDIUM: 2,
  },
  /** ログイン失敗検知閾値 */
  LOGIN_FAILURE_THRESHOLDS: {
    BURST_COUNT: 5,
    BRUTE_FORCE_COUNT: 10,
    TIME_WINDOW_MINUTES: 5,
    BLOCK_DURATION_MINUTES: 30,
  },
} as const;

/**
 * セキュリティ監視アクションタイプ
 */
export type SecurityMonitoringActionType =
  | "view_security_dashboard"
  | "view_security_events"
  | "view_alert_rules"
  | "create_alert_rule"
  | "update_alert_rule"
  | "delete_alert_rule"
  | "view_incidents"
  | "create_incident"
  | "update_incident"
  | "add_incident_action";
