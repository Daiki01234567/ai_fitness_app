/**
 * フィードバック送信サービス
 *
 * ユーザーからのお問い合わせやフィードバックを送信するサービスです。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * フィードバックタイプ
 */
export type FeedbackType = "bug_report" | "feature_request" | "general_feedback" | "other";

/**
 * フィードバックタイプのラベル
 */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug_report: "バグ報告",
  feature_request: "機能改善の要望",
  general_feedback: "一般的なフィードバック",
  other: "その他",
};

/**
 * フィードバックデータ
 */
export interface FeedbackData {
  /** フィードバックタイプ */
  type: FeedbackType;
  /** 件名 */
  subject: string;
  /** メッセージ本文 */
  message: string;
}

/**
 * デバイス情報
 */
export interface DeviceInfo {
  /** プラットフォーム */
  platform: string;
  /** OSバージョン */
  osVersion: string;
  /** アプリバージョン */
  appVersion: string;
  /** デバイスモデル */
  deviceModel: string | null;
}

/**
 * フィードバック送信結果
 */
export interface SubmitFeedbackResult {
  /** 成功フラグ */
  success: boolean;
  /** フィードバックID */
  feedbackId?: string;
  /** メッセージ */
  message: string;
}

/**
 * デバイス情報を取得
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    platform: Platform.OS === "ios" ? "iOS" : "Android",
    osVersion: Platform.Version.toString(),
    appVersion: Constants.expoConfig?.version || "1.0.0",
    deviceModel: Device.modelName,
  };
}

/**
 * フィードバックを送信
 *
 * @param data - フィードバックデータ
 * @returns 送信結果
 *
 * @example
 * const result = await submitFeedback({
 *   type: "bug_report",
 *   subject: "アプリがクラッシュする",
 *   message: "トレーニング中にアプリがクラッシュします。"
 * });
 */
export async function submitFeedback(data: FeedbackData): Promise<SubmitFeedbackResult> {
  try {
    // TODO: Implement actual Firebase Functions call
    // const submitFeedbackFn = httpsCallable(functions, 'feedback_submitFeedback');
    // const result = await submitFeedbackFn({
    //   type: data.type,
    //   subject: data.subject,
    //   message: data.message,
    //   deviceInfo: getDeviceInfo(),
    // });
    // return {
    //   success: result.data.success,
    //   feedbackId: result.data.data?.feedbackId,
    //   message: result.data.message,
    // };

    console.log("[FeedbackService] Submitting feedback:", data);
    console.log("[FeedbackService] Device info:", getDeviceInfo());

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate success
    return {
      success: true,
      feedbackId: `feedback_${Date.now()}`,
      message: "フィードバックを受け付けました。ありがとうございます。",
    };
  } catch (error: any) {
    console.error("[FeedbackService] Failed to submit feedback:", error);

    // Check for rate limit error
    if (error.code === "resource-exhausted") {
      return {
        success: false,
        message: "1日の送信上限（10回）に達しました。明日以降に再度お試しください。",
      };
    }

    return {
      success: false,
      message: error.message || "フィードバックの送信に失敗しました。",
    };
  }
}

/**
 * バリデーション: 件名
 *
 * @param subject - 件名
 * @param maxLength - 最大文字数（デフォルト: 100）
 * @returns エラーメッセージまたはnull
 */
export function validateSubject(subject: string, maxLength: number = 100): string | null {
  if (!subject.trim()) {
    return "件名を入力してください";
  }
  if (subject.length > maxLength) {
    return `件名は${maxLength}文字以内で入力してください`;
  }
  return null;
}

/**
 * バリデーション: メッセージ
 *
 * @param message - メッセージ
 * @param maxLength - 最大文字数（デフォルト: 1000）
 * @returns エラーメッセージまたはnull
 */
export function validateMessage(message: string, maxLength: number = 1000): string | null {
  if (!message.trim()) {
    return "お問い合わせ内容を入力してください";
  }
  if (message.length > maxLength) {
    return `お問い合わせ内容は${maxLength}文字以内で入力してください`;
  }
  return null;
}
