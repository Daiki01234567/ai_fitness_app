/**
 * ユーザー設定取得 API
 *
 * 認証済みユーザーの設定を取得
 * 設定が存在しない場合はデフォルト値を返す
 *
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuth } from "../../middleware/auth";
import { requireCsrfProtection } from "../../middleware/csrf";
import { userRef } from "../../utils/firestore";
import { logger } from "../../utils/logger";

/**
 * デフォルト設定値
 */
export const DEFAULT_SETTINGS = {
  audio: {
    enabled: true,
    volume: 70,
    speed: 1.0,
  },
  display: {
    theme: "auto" as const,
    showCameraGuide: true,
    showProgressBar: true,
  },
  privacy: {
    dataSharingForAnalytics: false,
    dataSharingForML: false,
  },
};

/**
 * 音声設定インターフェース
 */
export interface AudioSettings {
  enabled: boolean;
  volume: number;
  speed: number;
}

/**
 * 表示設定インターフェース
 */
export interface DisplaySettings {
  theme: "light" | "dark" | "auto";
  showCameraGuide: boolean;
  showProgressBar: boolean;
}

/**
 * プライバシー設定インターフェース
 */
export interface PrivacySettings {
  dataSharingForAnalytics: boolean;
  dataSharingForML: boolean;
}

/**
 * 完全な設定インターフェース
 */
export interface UserSettingsData {
  audio: AudioSettings;
  display: DisplaySettings;
  privacy: PrivacySettings;
}

/**
 * Firestore に保存される設定データの型
 */
interface StoredSettings {
  audio?: Partial<AudioSettings>;
  display?: Partial<DisplaySettings>;
  privacy?: Partial<PrivacySettings>;
}

/**
 * 設定レスポンスインターフェース
 */
interface GetSettingsResponse {
  success: boolean;
  settings: UserSettingsData;
}

/**
 * 設定取得 callable 関数
 *
 * 認証済みユーザーの設定を取得
 * 設定が存在しない場合はデフォルト値を返す
 */
export const settings_getSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request: CallableRequest): Promise<GetSettingsResponse> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Require authentication
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    logger.info("Getting user settings", { userId });

    try {
      // Check if user exists
      const userDocRef = userRef(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      // Get settings from user document
      const userData = userDoc.data() as { settings?: StoredSettings } | undefined;
      const storedSettings: StoredSettings = userData?.settings ?? {};

      // Merge stored settings with defaults
      const settings: UserSettingsData = {
        audio: {
          ...DEFAULT_SETTINGS.audio,
          ...(storedSettings.audio ?? {}),
        },
        display: {
          ...DEFAULT_SETTINGS.display,
          ...(storedSettings.display ?? {}),
        },
        privacy: {
          ...DEFAULT_SETTINGS.privacy,
          ...(storedSettings.privacy ?? {}),
        },
      };

      logger.info("User settings retrieved", { userId });

      return {
        success: true,
        settings,
      };
    } catch (error) {
      // Rethrow HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to get user settings", error as Error, { userId });
      throw new HttpsError("internal", "設定の取得に失敗しました");
    }
  },
);
