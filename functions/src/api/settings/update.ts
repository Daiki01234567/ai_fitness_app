/**
 * ユーザー設定更新 API
 *
 * 認証済みユーザーの設定を更新
 * ネストされたフィールドをドット記法で更新
 *
 * 参照: docs/common/specs/02-1_機能要件_v1_0.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuth, requireWritePermission } from "../../middleware/auth";
import { requireCsrfProtection } from "../../middleware/csrf";
import { rateLimiter } from "../../middleware/rateLimiter";
import { userRef } from "../../utils/firestore";
import { logger } from "../../utils/logger";

import {
  AudioSettings,
  DEFAULT_SETTINGS,
  DisplaySettings,
  PrivacySettings,
  UserSettingsData,
} from "./get";

/**
 * 設定更新リクエストインターフェース
 */
interface UpdateSettingsRequest {
  audio?: {
    enabled?: boolean;
    volume?: number;
    speed?: number;
  };
  display?: {
    theme?: "light" | "dark" | "auto";
    showCameraGuide?: boolean;
    showProgressBar?: boolean;
  };
  privacy?: {
    dataSharingForAnalytics?: boolean;
    dataSharingForML?: boolean;
  };
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
 * 設定更新レスポンスインターフェース
 */
interface UpdateSettingsResponse {
  success: boolean;
  message: string;
  settings: UserSettingsData;
}

/**
 * 有効なテーマ値
 */
const VALID_THEMES = ["light", "dark", "auto"] as const;

/**
 * 音声設定のバリデーション
 */
function validateAudioSettings(audio: UpdateSettingsRequest["audio"]): void {
  if (!audio) {
    return;
  }

  if (audio.enabled !== undefined && typeof audio.enabled !== "boolean") {
    throw new HttpsError("invalid-argument", "audio.enabled はブール値で指定してください");
  }

  if (audio.volume !== undefined) {
    if (typeof audio.volume !== "number") {
      throw new HttpsError("invalid-argument", "audio.volume は数値で指定してください");
    }
    if (audio.volume < 0 || audio.volume > 100) {
      throw new HttpsError(
        "invalid-argument",
        "audio.volume は0から100の範囲で指定してください",
      );
    }
  }

  if (audio.speed !== undefined) {
    if (typeof audio.speed !== "number") {
      throw new HttpsError("invalid-argument", "audio.speed は数値で指定してください");
    }
    if (audio.speed < 0.5 || audio.speed > 2.0) {
      throw new HttpsError(
        "invalid-argument",
        "audio.speed は0.5から2.0の範囲で指定してください",
      );
    }
  }
}

/**
 * 表示設定のバリデーション
 */
function validateDisplaySettings(display: UpdateSettingsRequest["display"]): void {
  if (!display) {
    return;
  }

  if (display.theme !== undefined) {
    if (!VALID_THEMES.includes(display.theme)) {
      throw new HttpsError(
        "invalid-argument",
        "display.theme は 'light', 'dark', 'auto' のいずれかを指定してください",
      );
    }
  }

  if (display.showCameraGuide !== undefined && typeof display.showCameraGuide !== "boolean") {
    throw new HttpsError("invalid-argument", "display.showCameraGuide はブール値で指定してください");
  }

  if (display.showProgressBar !== undefined && typeof display.showProgressBar !== "boolean") {
    throw new HttpsError("invalid-argument", "display.showProgressBar はブール値で指定してください");
  }
}

/**
 * プライバシー設定のバリデーション
 */
function validatePrivacySettings(privacy: UpdateSettingsRequest["privacy"]): void {
  if (!privacy) {
    return;
  }

  if (
    privacy.dataSharingForAnalytics !== undefined &&
    typeof privacy.dataSharingForAnalytics !== "boolean"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "privacy.dataSharingForAnalytics はブール値で指定してください",
    );
  }

  if (
    privacy.dataSharingForML !== undefined &&
    typeof privacy.dataSharingForML !== "boolean"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "privacy.dataSharingForML はブール値で指定してください",
    );
  }
}

/**
 * 更新用のドット記法フィールドを構築
 */
function buildUpdateFields(data: UpdateSettingsRequest): Record<string, unknown> {
  const updateFields: Record<string, unknown> = {};

  // Audio settings
  if (data.audio) {
    if (data.audio.enabled !== undefined) {
      updateFields["settings.audio.enabled"] = data.audio.enabled;
    }
    if (data.audio.volume !== undefined) {
      updateFields["settings.audio.volume"] = data.audio.volume;
    }
    if (data.audio.speed !== undefined) {
      updateFields["settings.audio.speed"] = data.audio.speed;
    }
  }

  // Display settings
  if (data.display) {
    if (data.display.theme !== undefined) {
      updateFields["settings.display.theme"] = data.display.theme;
    }
    if (data.display.showCameraGuide !== undefined) {
      updateFields["settings.display.showCameraGuide"] = data.display.showCameraGuide;
    }
    if (data.display.showProgressBar !== undefined) {
      updateFields["settings.display.showProgressBar"] = data.display.showProgressBar;
    }
  }

  // Privacy settings
  if (data.privacy) {
    if (data.privacy.dataSharingForAnalytics !== undefined) {
      updateFields["settings.privacy.dataSharingForAnalytics"] = data.privacy.dataSharingForAnalytics;
    }
    if (data.privacy.dataSharingForML !== undefined) {
      updateFields["settings.privacy.dataSharingForML"] = data.privacy.dataSharingForML;
    }
  }

  return updateFields;
}

/**
 * 設定更新 callable 関数
 *
 * 認証済みユーザーの設定を更新
 * レート制限: 50回/時間
 */
export const settings_updateSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request: CallableRequest<UpdateSettingsRequest>): Promise<UpdateSettingsResponse> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Require authentication
    const authContext = requireAuth(request);
    const userId = authContext.uid;

    // Check rate limit (50/hour)
    await rateLimiter.check("USER_SETTINGS", userId);

    const data = request.data || {};

    logger.info("Updating user settings", { userId });

    // Check if any settings provided
    if (!data.audio && !data.display && !data.privacy) {
      throw new HttpsError("invalid-argument", "更新する設定が指定されていません");
    }

    // Validate all settings
    validateAudioSettings(data.audio);
    validateDisplaySettings(data.display);
    validatePrivacySettings(data.privacy);

    try {
      // Check if user exists and not scheduled for deletion
      const userDocRef = userRef(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      // Check deletion scheduled
      await requireWritePermission(userId);

      // Build update fields using dot notation
      const updateFields = buildUpdateFields(data);

      if (Object.keys(updateFields).length === 0) {
        throw new HttpsError("invalid-argument", "更新する設定が指定されていません");
      }

      // Add updatedAt timestamp
      updateFields["updatedAt"] = FieldValue.serverTimestamp();

      // Update user document with settings
      await userDocRef.update(updateFields);

      // Get updated settings
      const updatedUserDoc = await userDocRef.get();
      const updatedUserData = updatedUserDoc.data() as { settings?: StoredSettings } | undefined;
      const storedSettings: StoredSettings = updatedUserData?.settings ?? {};

      // Merge with defaults for response
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

      logger.info("User settings updated successfully", {
        userId,
        updatedFields: Object.keys(updateFields).filter((k) => k !== "updatedAt"),
      });

      return {
        success: true,
        message: "設定を更新しました",
        settings,
      };
    } catch (error) {
      // Rethrow HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to update user settings", error as Error, { userId });
      throw new HttpsError("internal", "設定の更新に失敗しました");
    }
  },
);
