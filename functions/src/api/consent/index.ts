/**
 * 同意 API Functions インデックス
 *
 * GDPR 準拠の同意管理エンドポイント
 * 参照: docs/specs/00_要件定義書_v3_3.md (FR-024, FR-024-1)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

export { recordConsent } from "./record";
export { revokeConsent } from "./revoke";
export { getConsentStatus } from "./status";
