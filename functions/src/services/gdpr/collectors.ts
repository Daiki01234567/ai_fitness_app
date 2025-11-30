/**
 * GDPR データ収集関数
 *
 * Firestore からユーザーデータを収集するための関数群
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { User, Session, Consent, UserSettings, Subscription } from "../../types/firestore";
import {
  ExportProfileData,
  ExportSessionData,
  ExportConsentData,
  ExportSettingsData,
  ExportSubscriptionData,
  ExportScope,
} from "../../types/gdpr";
import {
  userRef,
  sessionsCollection,
  consentsCollection,
} from "../../utils/firestore";
import { logger } from "../../utils/logger";

import { safeTimestampToString } from "./helpers";

// =============================================================================
// プロフィールデータ収集
// =============================================================================

/**
 * ユーザープロフィールデータを収集
 *
 * @param userId - 収集対象のユーザー ID
 * @returns プロフィールデータ、または null（ユーザーが存在しない場合）
 * @throws Firestore 読み取りエラー
 *
 * @example
 * ```typescript
 * const profile = await collectProfileData("user123");
 * if (profile) {
 *   console.log(profile.nickname);
 * }
 * ```
 */
export async function collectProfileData(userId: string): Promise<ExportProfileData | null> {
  try {
    const userDoc = await userRef(userId).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as User;
    return {
      nickname: userData.nickname,
      email: userData.email,
      birthYear: userData.birthYear,
      gender: userData.gender,
      height: userData.height,
      weight: userData.weight,
      fitnessLevel: userData.fitnessLevel,
      createdAt: safeTimestampToString(userData.createdAt),
      updatedAt: safeTimestampToString(userData.updatedAt),
    };
  } catch (error) {
    logger.error("Failed to collect profile data", error as Error, { userId });
    throw error;
  }
}

// =============================================================================
// セッションデータ収集
// =============================================================================

/**
 * セッションデータを収集
 *
 * @param userId - 収集対象のユーザー ID
 * @param scope - エクスポートスコープ（日付範囲フィルター等）
 * @returns セッションデータの配列
 * @throws Firestore 読み取りエラー
 *
 * @example
 * ```typescript
 * // 全セッションを取得
 * const sessions = await collectSessionsData("user123", { type: "all" });
 *
 * // 日付範囲でフィルター
 * const recentSessions = await collectSessionsData("user123", {
 *   type: "dateRange",
 *   startDate: new Date("2024-01-01"),
 *   endDate: new Date("2024-12-31"),
 * });
 * ```
 */
export async function collectSessionsData(
  userId: string,
  scope: ExportScope,
): Promise<ExportSessionData[]> {
  try {
    let query = sessionsCollection(userId).orderBy("createdAt", "desc");

    // Apply date range filter if specified
    if (scope.type === "dateRange") {
      if (scope.startDate) {
        query = query.where("startTime", ">=", scope.startDate);
      }
      if (scope.endDate) {
        query = query.where("startTime", "<=", scope.endDate);
      }
    }

    const snapshot = await query.get();
    const sessions: ExportSessionData[] = [];

    for (const doc of snapshot.docs) {
      const sessionData = doc.data() as Session;
      sessions.push({
        sessionId: doc.id,
        exerciseType: sessionData.exerciseType,
        startTime: safeTimestampToString(sessionData.startTime),
        endTime: safeTimestampToString(sessionData.endTime),
        repCount: sessionData.repCount,
        totalScore: sessionData.totalScore,
        averageScore: sessionData.averageScore,
        duration: sessionData.duration,
        status: sessionData.status,
      });
    }

    return sessions;
  } catch (error) {
    logger.error("Failed to collect sessions data", error as Error, { userId });
    throw error;
  }
}

// =============================================================================
// 設定データ収集
// =============================================================================

/**
 * 設定データを収集
 *
 * @param userId - 収集対象のユーザー ID
 * @returns 設定データ、または null（設定が存在しない場合）
 * @throws Firestore 読み取りエラー
 *
 * @example
 * ```typescript
 * const settings = await collectSettingsData("user123");
 * if (settings) {
 *   console.log(settings.language);
 * }
 * ```
 */
export async function collectSettingsData(userId: string): Promise<ExportSettingsData | null> {
  try {
    const settingsDoc = await userRef(userId).collection("settings").doc("default").get();
    if (!settingsDoc.exists) {
      return null;
    }

    const settingsData = settingsDoc.data() as UserSettings;
    return {
      notificationsEnabled: settingsData.notificationsEnabled,
      reminderTime: settingsData.reminderTime,
      reminderDays: settingsData.reminderDays,
      language: settingsData.language,
      theme: settingsData.theme,
      units: settingsData.units,
      analyticsEnabled: settingsData.analyticsEnabled,
      crashReportingEnabled: settingsData.crashReportingEnabled,
    };
  } catch (error) {
    logger.error("Failed to collect settings data", error as Error, { userId });
    throw error;
  }
}

// =============================================================================
// サブスクリプションデータ収集
// =============================================================================

/**
 * サブスクリプションデータを収集
 *
 * @param userId - 収集対象のユーザー ID
 * @returns サブスクリプションデータの配列
 * @throws Firestore 読み取りエラー
 *
 * @example
 * ```typescript
 * const subscriptions = await collectSubscriptionsData("user123");
 * for (const sub of subscriptions) {
 *   console.log(`${sub.plan}: ${sub.status}`);
 * }
 * ```
 */
export async function collectSubscriptionsData(userId: string): Promise<ExportSubscriptionData[]> {
  try {
    const snapshot = await userRef(userId)
      .collection("subscriptions")
      .orderBy("createdAt", "desc")
      .get();

    const subscriptions: ExportSubscriptionData[] = [];

    for (const doc of snapshot.docs) {
      const subData = doc.data() as Subscription;
      subscriptions.push({
        plan: subData.plan,
        status: subData.status,
        startDate: safeTimestampToString(subData.startDate),
        expirationDate: safeTimestampToString(subData.expirationDate),
        store: subData.store,
      });
    }

    return subscriptions;
  } catch (error) {
    logger.error("Failed to collect subscriptions data", error as Error, { userId });
    throw error;
  }
}

// =============================================================================
// 同意データ収集
// =============================================================================

/**
 * 同意データを収集
 *
 * @param userId - 収集対象のユーザー ID
 * @returns 同意データの配列
 * @throws Firestore 読み取りエラー
 *
 * @example
 * ```typescript
 * const consents = await collectConsentsData("user123");
 * for (const consent of consents) {
 *   console.log(`${consent.documentType} v${consent.documentVersion}: ${consent.action}`);
 * }
 * ```
 */
export async function collectConsentsData(userId: string): Promise<ExportConsentData[]> {
  try {
    const snapshot = await consentsCollection()
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .get();

    const consents: ExportConsentData[] = [];

    for (const doc of snapshot.docs) {
      const consentData = doc.data() as Consent;
      consents.push({
        documentType: consentData.documentType,
        documentVersion: consentData.documentVersion,
        action: consentData.action,
        timestamp: safeTimestampToString(consentData.timestamp),
      });
    }

    return consents;
  } catch (error) {
    logger.error("Failed to collect consents data", error as Error, { userId });
    throw error;
  }
}
