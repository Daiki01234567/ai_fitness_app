/**
 * Firebase Analytics追跡
 *
 * アプリの分析イベントを追跡します。
 * Expo Managed Workflowでは expo-firebase-analytics を使用します。
 * Development Build移行後は @react-native-firebase/analytics に切り替え可能です。
 *
 * @see docs/expo/tickets/006-monitoring-logging.md
 */

import { getEnvironment } from "./firebase";
import { logger } from "./logger";

/**
 * 画面表示イベントのパラメータ
 */
export interface ScreenViewParams {
  /** 画面名 */
  screenName: string;
  /** 画面クラス（オプション） */
  screenClass?: string;
}

/**
 * ログインイベントのパラメータ
 */
export interface LoginParams {
  /** ログイン方法（email, google, apple など） */
  method: string;
}

/**
 * 新規登録イベントのパラメータ
 */
export interface SignUpParams {
  /** 登録方法（email, google, apple など） */
  method: string;
}

/**
 * トレーニング開始イベントのパラメータ
 */
export interface TrainingStartParams {
  /** 種目ID */
  exerciseId: string;
  /** 種目名 */
  exerciseName: string;
  /** 目標レップ数 */
  targetReps?: number;
  /** 目標セット数 */
  targetSets?: number;
}

/**
 * トレーニング完了イベントのパラメータ
 */
export interface TrainingCompleteParams {
  /** 種目ID */
  exerciseId: string;
  /** 種目名 */
  exerciseName: string;
  /** 完了レップ数 */
  completedReps: number;
  /** 完了セット数 */
  completedSets: number;
  /** 所要時間（秒） */
  durationSeconds: number;
  /** 平均スコア（0-100） */
  averageScore?: number;
}

/**
 * カスタムイベントのパラメータ
 */
export type EventParams = Record<string, string | number | boolean>;

/**
 * 事前定義されたイベント名
 */
export const AnalyticsEvents = {
  /** 画面表示 */
  SCREEN_VIEW: "screen_view",
  /** ログイン */
  LOGIN: "login",
  /** 新規登録 */
  SIGN_UP: "sign_up",
  /** トレーニング開始 */
  TRAINING_START: "training_start",
  /** トレーニング完了 */
  TRAINING_COMPLETE: "training_complete",
  /** エラー発生 */
  APP_ERROR: "app_error",
  /** チュートリアル開始 */
  TUTORIAL_BEGIN: "tutorial_begin",
  /** チュートリアル完了 */
  TUTORIAL_COMPLETE: "tutorial_complete",
  /** 設定変更 */
  SETTINGS_CHANGE: "settings_change",
} as const;

/**
 * Analytics初期化状態
 */
let isAnalyticsEnabled = false;
let isInitialized = false;

/**
 * Analyticsの初期化
 *
 * 開発環境ではAnalyticsを無効化します（本番データを汚染しないため）
 *
 * @example
 * ```typescript
 * await initAnalytics();
 * ```
 */
export async function initAnalytics(): Promise<void> {
  if (isInitialized) {
    logger.debug("Analytics already initialized");
    return;
  }

  try {
    const env = getEnvironment();

    // Development環境では無効化
    if (env === "development") {
      isAnalyticsEnabled = false;
      logger.info("Analytics disabled in development environment");
    } else {
      // TODO: expo-firebase-analyticsまたは@react-native-firebase/analyticsの初期化
      // Development Build移行後に実装:
      //
      // import analytics from '@react-native-firebase/analytics';
      // await analytics().setAnalyticsCollectionEnabled(true);
      //
      // または expo-firebase-analytics:
      // import * as Analytics from 'expo-firebase-analytics';
      // await Analytics.setAnalyticsCollectionEnabled(true);

      isAnalyticsEnabled = true;
      logger.info("Analytics initialized", { environment: env });
    }

    isInitialized = true;
  } catch (error) {
    logger.error("Analytics initialization failed", error as Error);
    isAnalyticsEnabled = false;
    isInitialized = true;
  }
}

/**
 * イベントをログに記録（内部用）
 */
function logEventInternal(eventName: string, params?: EventParams): void {
  if (!isAnalyticsEnabled) {
    logger.debug(`Analytics event (disabled): ${eventName}`, params as Record<string, unknown>);
    return;
  }

  // TODO: 実際のAnalytics送信を実装
  // Development Build移行後:
  //
  // import analytics from '@react-native-firebase/analytics';
  // await analytics().logEvent(eventName, params);

  logger.debug(`Analytics event: ${eventName}`, params as Record<string, unknown>);
}

/**
 * 画面表示イベントを記録
 *
 * @param params 画面表示パラメータ
 *
 * @example
 * ```typescript
 * logScreenView({
 *   screenName: 'HomeScreen',
 *   screenClass: 'HomeScreen',
 * });
 * ```
 */
export function logScreenView(params: ScreenViewParams): void {
  logEventInternal(AnalyticsEvents.SCREEN_VIEW, {
    screen_name: params.screenName,
    screen_class: params.screenClass ?? params.screenName,
  });
}

/**
 * ログインイベントを記録
 *
 * @param params ログインパラメータ
 *
 * @example
 * ```typescript
 * logLogin({ method: 'email' });
 * ```
 */
export function logLogin(params: LoginParams): void {
  logEventInternal(AnalyticsEvents.LOGIN, {
    method: params.method,
  });
}

/**
 * 新規登録イベントを記録
 *
 * @param params 新規登録パラメータ
 *
 * @example
 * ```typescript
 * logSignUp({ method: 'google' });
 * ```
 */
export function logSignUp(params: SignUpParams): void {
  logEventInternal(AnalyticsEvents.SIGN_UP, {
    method: params.method,
  });
}

/**
 * トレーニング開始イベントを記録
 *
 * @param params トレーニング開始パラメータ
 *
 * @example
 * ```typescript
 * logTrainingStart({
 *   exerciseId: 'squat',
 *   exerciseName: 'スクワット',
 *   targetReps: 10,
 *   targetSets: 3,
 * });
 * ```
 */
export function logTrainingStart(params: TrainingStartParams): void {
  logEventInternal(AnalyticsEvents.TRAINING_START, {
    exercise_id: params.exerciseId,
    exercise_name: params.exerciseName,
    target_reps: params.targetReps ?? 0,
    target_sets: params.targetSets ?? 0,
  });
}

/**
 * トレーニング完了イベントを記録
 *
 * @param params トレーニング完了パラメータ
 *
 * @example
 * ```typescript
 * logTrainingComplete({
 *   exerciseId: 'squat',
 *   exerciseName: 'スクワット',
 *   completedReps: 30,
 *   completedSets: 3,
 *   durationSeconds: 180,
 *   averageScore: 85,
 * });
 * ```
 */
export function logTrainingComplete(params: TrainingCompleteParams): void {
  logEventInternal(AnalyticsEvents.TRAINING_COMPLETE, {
    exercise_id: params.exerciseId,
    exercise_name: params.exerciseName,
    completed_reps: params.completedReps,
    completed_sets: params.completedSets,
    duration_seconds: params.durationSeconds,
    average_score: params.averageScore ?? 0,
  });
}

/**
 * エラーイベントを記録
 *
 * @param errorType エラーの種類
 * @param errorMessage エラーメッセージ
 * @param context 追加のコンテキスト情報
 *
 * @example
 * ```typescript
 * logAppError('api_error', 'Failed to fetch user data', { endpoint: '/api/users' });
 * ```
 */
export function logAppError(
  errorType: string,
  errorMessage: string,
  context?: Record<string, string | number | boolean>
): void {
  logEventInternal(AnalyticsEvents.APP_ERROR, {
    error_type: errorType,
    error_message: errorMessage.slice(0, 100), // Firebase制限に対応
    ...context,
  });
}

/**
 * カスタムイベントを記録
 *
 * @param eventName イベント名
 * @param params イベントパラメータ
 *
 * @example
 * ```typescript
 * logEvent('button_click', {
 *   button_id: 'start_training',
 *   screen_name: 'HomeScreen',
 * });
 * ```
 */
export function logEvent(eventName: string, params?: EventParams): void {
  // イベント名のバリデーション（Firebaseの制限に準拠）
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(eventName)) {
    logger.warn(`Invalid event name: ${eventName}. Event names must start with a letter and contain only alphanumeric characters and underscores.`);
    return;
  }

  if (eventName.length > 40) {
    logger.warn(`Event name too long: ${eventName}. Maximum length is 40 characters.`);
    return;
  }

  logEventInternal(eventName, params);
}

/**
 * ユーザープロパティを設定
 *
 * @param name プロパティ名
 * @param value プロパティ値
 *
 * @example
 * ```typescript
 * setUserProperty('subscription_tier', 'premium');
 * ```
 */
export function setUserProperty(name: string, value: string | null): void {
  if (!isAnalyticsEnabled) {
    logger.debug(`Analytics user property (disabled): ${name}=${value}`);
    return;
  }

  // TODO: Development Build移行後に実装
  // import analytics from '@react-native-firebase/analytics';
  // await analytics().setUserProperty(name, value);

  logger.debug(`Analytics user property: ${name}=${value}`);
}

/**
 * ユーザーIDを設定
 *
 * @param userId ユーザーID（nullでリセット）
 *
 * @example
 * ```typescript
 * setAnalyticsUserId('user_12345');
 * ```
 */
export function setAnalyticsUserId(userId: string | null): void {
  if (!isAnalyticsEnabled) {
    logger.debug(`Analytics user ID (disabled): ${userId ?? "null"}`);
    return;
  }

  // TODO: Development Build移行後に実装
  // import analytics from '@react-native-firebase/analytics';
  // await analytics().setUserId(userId);

  logger.debug(`Analytics user ID: ${userId ?? "null"}`);
}

/**
 * Analyticsの有効/無効状態を取得
 */
export function isAnalyticsActive(): boolean {
  return isAnalyticsEnabled;
}
