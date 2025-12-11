/**
 * 管理者API Functions インデックス
 *
 * 管理者認証・ユーザー管理・検索・強制削除・利用統計の管理者API
 *
 * チケット041: 管理者認証基盤
 * チケット042: ユーザー管理API
 * チケット043: ユーザー検索API
 * チケット044: 強制削除API
 * チケット045: 利用統計API
 *
 * @version 1.3.0
 * @date 2025-12-11
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
