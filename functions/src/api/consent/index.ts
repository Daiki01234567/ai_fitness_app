/**
 * 同意 API Functions インデックス
 *
 * GDPR 準拠の同意管理エンドポイント
 * - 基本機能: 同意記録、撤回、状態取得（チケット006）
 * - 拡張機能: 履歴一覧、監査ログ検索、統計（チケット020）
 *
 * 参照: docs/specs/00_要件定義書_v3_3.md (FR-024, FR-024-1)
 * 参照: docs/common/tickets/020-gdpr-consent-api.md
 *
 * @version 1.1.0
 * @date 2025-12-10
 */

// Basic consent management (Ticket 006)
export { recordConsent } from "./record";
export { revokeConsent } from "./revoke";
export { getConsentStatus } from "./status";

// Extended consent features (Ticket 020)
export { consent_getHistory } from "./history";
export { consent_searchAuditLogs } from "./auditLogs";
export { consent_getStatistics } from "./statistics";
