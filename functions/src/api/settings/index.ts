/**
 * ユーザー設定 API Functions インデックス
 *
 * ユーザー設定の取得・更新エンドポイント
 * - 音声設定: enabled, volume, speed
 * - 表示設定: theme, showCameraGuide, showProgressBar
 * - プライバシー設定: dataSharingForAnalytics, dataSharingForML
 *
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md
 * 参照: docs/expo/tickets/025-settings-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

export { settings_getSettings } from "./get";
export { settings_updateSettings } from "./update";
