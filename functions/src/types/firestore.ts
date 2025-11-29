/**
 * Firestore データモデル型定義
 * docs/specs/02_Firestoreデータベース設計書_v3_3.md に基づく
 */

import { Timestamp } from "firebase-admin/firestore";

// アプリがサポートするエクササイズタイプ
export type ExerciseType =
  | "squat"
  | "armcurl"
  | "sideraise"
  | "shoulderpress"
  | "pushup";

// サブスクリプションプランタイプ
export type SubscriptionPlan = "free" | "premium" | "premium_annual";

// サブスクリプションステータス
export type SubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "grace_period";

// 同意アクションタイプ
export type ConsentAction = "accept" | "revoke" | "update";

// データ削除ステータス
export type DeletionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

// BigQuery 同期ステータス
export type SyncStatus = "pending" | "retrying" | "failed" | "dead_letter";

// セキュリティインシデント重大度
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

// セキュリティインシデントステータス
export type IncidentStatus =
  | "detected"
  | "investigating"
  | "contained"
  | "resolved"
  | "closed";

/**
 * /users/{userId} のユーザードキュメント
 */
export interface User {
  // プロフィール情報
  nickname: string;
  email: string;
  photoURL?: string;
  birthYear?: number;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  height?: number; // cm
  weight?: number; // kg
  fitnessLevel?: "beginner" | "intermediate" | "advanced";

  // 同意フラグ（クライアントからは読み取り専用）
  tosAccepted: boolean;
  tosAcceptedAt?: Timestamp;
  tosVersion?: string;
  ppAccepted: boolean;
  ppAcceptedAt?: Timestamp;
  ppVersion?: string;

  // アカウントステータス
  deletionScheduled: boolean;
  scheduledDeletionDate?: Timestamp;
  forceLogoutAt?: Timestamp;

  // 使用量追跡（無料プラン制限用）
  dailyUsageCount?: number;
  lastUsageResetDate?: Timestamp;

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

/**
 * /users/{userId}/sessions/{sessionId} のトレーニングセッションドキュメント
 */
export interface Session {
  // セッション識別情報
  exerciseType: ExerciseType;
  startTime: Timestamp;
  endTime?: Timestamp;

  // セッション結果
  repCount: number;
  totalScore: number;
  averageScore: number;
  duration: number; // 秒

  // セッションメタデータ
  sessionMetadata: SessionMetadata;

  // ステータス
  status: "in_progress" | "completed" | "abandoned";

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * パフォーマンス追跡用セッションメタデータ
 */
export interface SessionMetadata {
  // デバイス情報
  deviceInfo: DeviceInfo;

  // パフォーマンスメトリクス
  averageFps: number;
  minFps: number;
  frameDropCount: number;
  totalFrames: number;

  // 品質メトリクス
  poseConfidenceAverage: number;
  lightingCondition?: "good" | "poor" | "variable";

  // アプリバージョン
  appVersion: string;
  mediaPipeVersion: string;
}

/**
 * デバイス情報
 */
export interface DeviceInfo {
  platform: "ios" | "android";
  model: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
}

/**
 * /users/{userId}/sessions/{sessionId}/frames/{frameId} のフレームデータ
 */
export interface Frame {
  frameNumber: number;
  timestamp: number; // セッション開始からのミリ秒
  poseData: PoseLandmark[];
  repState?: "down" | "up" | "transition";
  currentScore?: number;
  feedback?: string[];
}

/**
 * MediaPipe 姿勢ランドマーク（33点）
 */
export interface PoseLandmark {
  index: number; // 0-32
  x: number; // 正規化された値 0-1
  y: number; // 正規化された値 0-1
  z: number; // 腰を基準とした深度
  visibility: number; // 信頼度 0-1
}

/**
 * /consents/{consentId} の同意レコード
 */
export interface Consent {
  userId: string;
  action: ConsentAction;
  documentType: "tos" | "pp" | "marketing";
  documentVersion: string;
  ipAddress?: string; // ハッシュ化済み
  userAgent?: string;
  timestamp: Timestamp;
}

/**
 * /users/{userId}/subscriptions/{subscriptionId} のサブスクリプションドキュメント
 */
export interface Subscription {
  // RevenueCat 識別子
  revenueCatId: string;
  productId: string;

  // サブスクリプション詳細
  plan: SubscriptionPlan;
  status: SubscriptionStatus;

  // 日付
  startDate: Timestamp;
  expirationDate: Timestamp;
  cancelledAt?: Timestamp;

  // 支払い情報
  store: "app_store" | "play_store";
  priceInYen?: number;

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /users/{userId}/settings/{settingId} のユーザー設定
 */
export interface UserSettings {
  // 通知設定
  notificationsEnabled: boolean;
  reminderTime?: string; // HH:mm 形式
  reminderDays?: number[]; // 0-6、日曜日 = 0

  // 表示設定
  language: string; // ISO 639-1
  theme: "light" | "dark" | "system";
  units: "metric" | "imperial";

  // プライバシー設定
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /notifications/{notificationId} の通知ドキュメント
 */
export interface Notification {
  userId: string;
  type: "reminder" | "achievement" | "system" | "marketing";
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  sentAt: Timestamp;
  readAt?: Timestamp;
}

/**
 * /dataDeletionRequests/{requestId} のデータ削除リクエスト
 */
export interface DataDeletionRequest {
  userId: string;
  status: DeletionStatus;
  requestedAt: Timestamp;
  scheduledDeletionDate: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  reason?: string;
  exportRequested: boolean;
  exportCompletedAt?: Timestamp;
}

/**
 * /bigquerySyncFailures/{failureId} の BigQuery 同期失敗
 */
export interface BigQuerySyncFailure {
  // ソース情報
  sourceCollection: string;
  sourceDocumentId: string;
  sourceData: Record<string, unknown>;

  // 失敗の詳細
  status: SyncStatus;
  errorMessage: string;
  errorCode?: string;

  // リトライ追跡
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Timestamp;
  lastRetryAt?: Timestamp;

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /securityIncidents/{incidentId} のセキュリティインシデント
 */
export interface SecurityIncident {
  // インシデント識別情報
  incidentType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;

  // 詳細
  description: string;
  affectedUsers?: string[]; // ユーザーID
  affectedUserCount?: number;

  // タイムライン
  detectedAt: Timestamp;
  containedAt?: Timestamp;
  resolvedAt?: Timestamp;

  // GDPR 通知（72時間要件）
  notificationRequired: boolean;
  dpaNotifiedAt?: Timestamp;
  usersNotifiedAt?: Timestamp;

  // 調査
  investigationNotes?: string;
  rootCause?: string;
  remediationActions?: string[];

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
