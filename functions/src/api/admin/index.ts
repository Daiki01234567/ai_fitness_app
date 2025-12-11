/**
 * 管理者API Functions インデックス
 *
 * 管理者認証・ユーザー管理・検索・強制削除・利用統計・リアルタイム監視・
 * セキュリティ監視・データエクスポート・マスタデータ・セキュリティ設定の管理者API
 *
 * チケット041: 管理者認証基盤
 * チケット042: ユーザー管理API
 * チケット043: ユーザー検索API
 * チケット044: 強制削除API
 * チケット045: 利用統計API
 * チケット046: リアルタイム監視API
 * チケット047: セキュリティ監視API
 * チケット048: データエクスポートAPI
 * チケット049: マスタデータ管理API
 * チケット050: セキュリティ設定API
 *
 * @version 1.7.0
 * @date 2025-12-12
 */

// 管理者認証API（チケット041）
export {
  admin_setAdminClaims,
  admin_revokeAdminClaims,
  admin_listAdmins,
  admin_updateIpAllowlist,
} from "./auth";

// ユーザー管理API（チケット042）
export {
  admin_listUsers,
  admin_getUserDetail,
  admin_suspendUser,
  admin_restoreUser,
} from "./users";

// ユーザー検索API（チケット043）
export {
  admin_searchUsersByEmail,
  admin_searchUsersByUid,
  admin_searchUsersByName,
  admin_searchUsers,
} from "./users";

// 強制削除API（チケット044）
export {
  admin_forceDeleteUser,
  admin_getDeletePreview,
} from "./forceDelete";

// 利用統計API（チケット045）
export {
  admin_getActiveUsersStats,
  admin_getTrainingStats,
  admin_getUserStats,
  admin_getRetentionStats,
  admin_getDashboardStats,
} from "./stats";

// リアルタイム監視API（チケット046）
export {
  admin_getSystemHealth,
  admin_getErrorStats,
  admin_getRequestStats,
  admin_getPerformanceStats,
  admin_getMonitoringDashboard,
} from "./monitoring";

// セキュリティ監視API（チケット047）
export {
  admin_getSecurityDashboard,
  admin_listSecurityEvents,
  admin_listAlertRules,
  admin_createAlertRule,
  admin_updateAlertRule,
  admin_deleteAlertRule,
  admin_listIncidents,
  admin_getIncidentDetail,
  admin_createIncident,
  admin_updateIncident,
  admin_addIncidentAction,
} from "./security";

// データエクスポートAPI（チケット048）
export {
  admin_startUserExport,
  admin_getExportStatus,
  admin_exportStats,
  admin_exportAuditLogs,
  admin_listExportHistory,
} from "./export";

// マスタデータ管理API（チケット049）
export {
  admin_listExercises,
  admin_createExercise,
  admin_updateExercise,
  admin_listPlans,
  admin_updatePlan,
  admin_listAnnouncements,
  admin_createAnnouncement,
  admin_updateAnnouncement,
  admin_deleteAnnouncement,
  admin_getAppSettings,
  admin_updateAppSettings,
} from "./masterData";

// セキュリティ設定API（チケット050）
export {
  admin_getIpAllowlist,
  admin_addIpAllowlist,
  admin_removeIpAllowlist,
  admin_getIpBlocklist,
  admin_addIpBlocklist,
  admin_removeIpBlocklist,
  admin_getRateLimits,
  admin_updateRateLimits,
  admin_getAuthPolicy,
  admin_updateAuthPolicy,
  admin_getSecurityChangeHistory,
  admin_getSecuritySnapshot,
} from "./securitySettings";
