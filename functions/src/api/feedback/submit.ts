/**
 * フィードバック送信 API
 *
 * ユーザーからのフィードバック（バグ報告、機能リクエスト等）を受け付け
 * 1日あたり10件のレート制限あり
 *
 * 参照: docs/expo/tickets/024-user-feedback-api.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireAuth, requireWritePermission } from "../../middleware/auth";
import { requireCsrfProtection } from "../../middleware/csrf";
import { getFirestore } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// Daily feedback rate limit
const DAILY_FEEDBACK_LIMIT = 10;

/**
 * Feedback types
 */
export type FeedbackType = "bug_report" | "feature_request" | "general_feedback" | "other";

/**
 * Device information for feedback
 */
export interface FeedbackDeviceInfo {
  platform: "iOS" | "Android" | "Web";
  osVersion: string;
  appVersion: string;
  deviceModel: string | null;
}

/**
 * Submit feedback request
 */
export interface SubmitFeedbackRequest {
  type: FeedbackType;
  subject: string;
  message: string;
  deviceInfo: FeedbackDeviceInfo;
}

/**
 * Submit feedback response
 */
export interface SubmitFeedbackResponse {
  feedbackId: string;
  message: string;
  submittedAt: string;
}

/**
 * Feedback document structure in Firestore
 */
interface FeedbackDocument {
  feedbackId: string;
  userId: string;
  email: string | null;
  type: FeedbackType;
  subject: string;
  message: string;
  deviceInfo: FeedbackDeviceInfo;
  status: "pending" | "in_review" | "resolved" | "closed";
  submittedAt: FieldValue;
  updatedAt: FieldValue;
  adminNotes: string | null;
}

/**
 * Validate feedback type
 */
function validateFeedbackType(type: unknown): FeedbackType {
  const validTypes: FeedbackType[] = ["bug_report", "feature_request", "general_feedback", "other"];
  if (!validTypes.includes(type as FeedbackType)) {
    throw new HttpsError(
      "invalid-argument",
      "フィードバックタイプが無効です。'bug_report', 'feature_request', 'general_feedback', 'other' のいずれかを指定してください",
    );
  }
  return type as FeedbackType;
}

/**
 * Validate subject
 */
function validateSubject(subject: unknown): string {
  if (typeof subject !== "string") {
    throw new HttpsError("invalid-argument", "件名は文字列で入力してください");
  }

  const trimmed = subject.trim();
  if (trimmed.length === 0) {
    throw new HttpsError("invalid-argument", "件名は必須です");
  }

  if (trimmed.length > 100) {
    throw new HttpsError("invalid-argument", "件名は100文字以内で入力してください");
  }

  return trimmed;
}

/**
 * Validate message
 */
function validateMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new HttpsError("invalid-argument", "メッセージは文字列で入力してください");
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new HttpsError("invalid-argument", "メッセージは必須です");
  }

  if (trimmed.length > 1000) {
    throw new HttpsError("invalid-argument", "メッセージは1000文字以内で入力してください");
  }

  return trimmed;
}

/**
 * Validate device info
 */
function validateDeviceInfo(deviceInfo: unknown): FeedbackDeviceInfo {
  if (!deviceInfo || typeof deviceInfo !== "object") {
    throw new HttpsError("invalid-argument", "デバイス情報は必須です");
  }

  const info = deviceInfo as Record<string, unknown>;

  // Validate platform
  const validPlatforms = ["iOS", "Android", "Web"];
  if (!validPlatforms.includes(info.platform as string)) {
    throw new HttpsError(
      "invalid-argument",
      "プラットフォームが無効です。'iOS', 'Android', 'Web' のいずれかを指定してください",
    );
  }

  // Validate osVersion
  if (typeof info.osVersion !== "string" || info.osVersion.trim().length === 0) {
    throw new HttpsError("invalid-argument", "OSバージョンは必須です");
  }

  // Validate appVersion
  if (typeof info.appVersion !== "string" || info.appVersion.trim().length === 0) {
    throw new HttpsError("invalid-argument", "アプリバージョンは必須です");
  }

  // Validate deviceModel (can be null)
  const deviceModel = info.deviceModel;
  if (deviceModel !== null && typeof deviceModel !== "string") {
    throw new HttpsError("invalid-argument", "デバイスモデルは文字列またはnullで指定してください");
  }

  return {
    platform: info.platform as "iOS" | "Android" | "Web",
    osVersion: String(info.osVersion).trim(),
    appVersion: String(info.appVersion).trim(),
    deviceModel: deviceModel ? String(deviceModel).trim() : null,
  };
}

/**
 * Check daily feedback limit
 * Returns true if user can submit feedback, false if limit reached
 */
async function checkDailyFeedbackLimit(userId: string): Promise<boolean> {
  const db = getFirestore();

  // Get start of today (JST - UTC+9)
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const todayStartUTC = new Date(now.getTime() + jstOffset);
  todayStartUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(todayStartUTC.getTime() - jstOffset);

  const todayStartTimestamp = Timestamp.fromDate(todayStart);

  // Query feedbacks from today
  const snapshot = await db
    .collection("feedbacks")
    .where("userId", "==", userId)
    .where("submittedAt", ">=", todayStartTimestamp)
    .count()
    .get();

  const todayCount = snapshot.data().count;

  logger.debug("Daily feedback count checked", {
    userId,
    todayCount,
    limit: DAILY_FEEDBACK_LIMIT,
  });

  return todayCount < DAILY_FEEDBACK_LIMIT;
}

/**
 * Submit user feedback
 *
 * Allows users to submit feedback such as bug reports, feature requests, etc.
 * Rate limited to 10 submissions per day per user.
 *
 * @throws HttpsError - Various validation and permission errors
 */
// eslint-disable-next-line camelcase
export const feedback_submitFeedback = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (
    request: CallableRequest<SubmitFeedbackRequest>,
  ): Promise<{ success: true; data: SubmitFeedbackResponse }> => {
    const startTime = Date.now();

    // CSRF protection
    requireCsrfProtection(request);

    // Authentication check
    const auth = requireAuth(request);
    const userId = auth.uid;
    const email = auth.email || null;

    // Check write permission (not deletion scheduled)
    await requireWritePermission(userId);

    const data = request.data;

    logger.info("Submit feedback request received", {
      userId,
      type: data?.type,
    });

    try {
      // Validate all inputs
      const feedbackType = validateFeedbackType(data?.type);
      const subject = validateSubject(data?.subject);
      const message = validateMessage(data?.message);
      const deviceInfo = validateDeviceInfo(data?.deviceInfo);

      // Check daily rate limit
      const canSubmit = await checkDailyFeedbackLimit(userId);
      if (!canSubmit) {
        logger.warn("Daily feedback limit reached", { userId });
        throw new HttpsError(
          "resource-exhausted",
          "本日のフィードバック送信上限（10件）に達しました。明日再度お試しください",
        );
      }

      // Generate feedback ID
      const db = getFirestore();
      const feedbackRef = db.collection("feedbacks").doc();
      const feedbackId = feedbackRef.id;

      // Create feedback document
      const feedbackDocument: FeedbackDocument = {
        feedbackId,
        userId,
        email,
        type: feedbackType,
        subject,
        message,
        deviceInfo,
        status: "pending",
        submittedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        adminNotes: null,
      };

      // Save to Firestore
      await feedbackRef.set(feedbackDocument);

      const submittedAt = new Date().toISOString();

      logger.info("Feedback submitted successfully", {
        userId,
        feedbackId,
        type: feedbackType,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          feedbackId,
          message: "フィードバックを送信しました。ご協力ありがとうございます",
          submittedAt,
        },
      };
    } catch (error) {
      // Re-throw HttpsError as is
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to submit feedback", error as Error, { userId });
      throw new HttpsError("internal", "フィードバックの送信に失敗しました");
    }
  },
);
