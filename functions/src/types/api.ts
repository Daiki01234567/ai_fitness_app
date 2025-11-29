/**
 * API リクエスト/レスポンス型定義
 * docs/specs/03_API設計書_Firebase_Functions_v3_3.md に基づく
 */

import { ExerciseType, SubscriptionPlan } from "./firestore";

// ============================================================================
// 共通レスポンス型
// ============================================================================

/**
 * 標準成功レスポンスラッパー
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * 標準エラーレスポンスラッパー
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 統合 API レスポンス型
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * ページネーションレスポンスラッパー
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextPageToken?: string;
  totalCount?: number;
}

// ============================================================================
// 認証 API 型
// ============================================================================

export interface SignUpRequest {
  email: string;
  password: string;
  nickname: string;
  tosAccepted: boolean;
  ppAccepted: boolean;
}

export interface SignUpResponse {
  userId: string;
  email: string;
  nickname: string;
}

export interface SignInResponse {
  userId: string;
  email: string;
  nickname: string;
  needsConsentUpdate: boolean;
}

// ============================================================================
// ユーザー管理 API 型
// ============================================================================

export interface GetProfileResponse {
  userId: string;
  nickname: string;
  email: string;
  photoURL?: string;
  birthYear?: number;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessLevel?: string;
  tosAccepted: boolean;
  ppAccepted: boolean;
  deletionScheduled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  nickname?: string;
  birthYear?: number;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  height?: number;
  weight?: number;
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
}

export interface UpdateProfileResponse {
  userId: string;
  updatedFields: string[];
  updatedAt: string;
}

// ============================================================================
// 同意管理 API 型
// ============================================================================

export interface UpdateConsentRequest {
  tosAccepted?: boolean;
  ppAccepted?: boolean;
  marketingAccepted?: boolean;
}

export interface UpdateConsentResponse {
  userId: string;
  consentId: string;
  updatedAt: string;
}

export interface RevokeConsentRequest {
  documentType: "tos" | "pp" | "marketing";
  reason?: string;
}

export interface RevokeConsentResponse {
  userId: string;
  consentId: string;
  forceLogout: boolean;
  message: string;
}

// ============================================================================
// トレーニングセッション API 型
// ============================================================================

export interface CreateSessionRequest {
  exerciseType: ExerciseType;
  deviceInfo: {
    platform: "ios" | "android";
    model: string;
    osVersion: string;
    screenWidth: number;
    screenHeight: number;
  };
  appVersion: string;
  mediaPipeVersion: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  exerciseType: ExerciseType;
  startTime: string;
}

export interface AddFrameDataRequest {
  sessionId: string;
  frames: Array<{
    frameNumber: number;
    timestamp: number;
    poseData: Array<{
      index: number;
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  }>;
}

export interface AddFrameDataResponse {
  sessionId: string;
  framesAdded: number;
  totalFrames: number;
}

export interface CompleteSessionRequest {
  sessionId: string;
  sessionMetadata: {
    averageFps: number;
    minFps: number;
    frameDropCount: number;
    totalFrames: number;
    poseConfidenceAverage: number;
    lightingCondition?: "good" | "poor" | "variable";
  };
}

export interface CompleteSessionResponse {
  sessionId: string;
  exerciseType: ExerciseType;
  repCount: number;
  totalScore: number;
  averageScore: number;
  duration: number;
  feedback: string[];
}

export interface GetSessionsRequest {
  exerciseType?: ExerciseType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  pageToken?: string;
}

export interface SessionSummary {
  sessionId: string;
  exerciseType: ExerciseType;
  startTime: string;
  endTime: string;
  repCount: number;
  averageScore: number;
  duration: number;
}

export interface GetStatisticsRequest {
  period: "week" | "month" | "year" | "all";
  exerciseType?: ExerciseType;
}

export interface GetStatisticsResponse {
  period: string;
  exerciseType?: ExerciseType;
  totalSessions: number;
  totalReps: number;
  totalDuration: number;
  averageScore: number;
  scoreImprovement: number;
  sessionsByExercise: Record<ExerciseType, number>;
  scoresByExercise: Record<ExerciseType, number>;
}

// ============================================================================
// GDPR API 型
// ============================================================================

export interface RequestDataExportResponse {
  requestId: string;
  status: string;
  estimatedCompletionTime: string;
}

export interface GetDataExportStatusResponse {
  requestId: string;
  status: "pending" | "processing" | "completed" | "failed";
  downloadUrl?: string;
  expiresAt?: string;
}

export interface RequestAccountDeletionRequest {
  reason?: string;
  exportData?: boolean;
}

export interface RequestAccountDeletionResponse {
  requestId: string;
  scheduledDeletionDate: string;
  exportRequested: boolean;
  message: string;
}

export interface CancelAccountDeletionResponse {
  requestId: string;
  status: string;
  message: string;
}

// ============================================================================
// 設定 API 型
// ============================================================================

export interface GetSettingsResponse {
  notificationsEnabled: boolean;
  reminderTime?: string;
  reminderDays?: number[];
  language: string;
  theme: "light" | "dark" | "system";
  units: "metric" | "imperial";
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
}

export interface UpdateSettingsRequest {
  notificationsEnabled?: boolean;
  reminderTime?: string;
  reminderDays?: number[];
  language?: string;
  theme?: "light" | "dark" | "system";
  units?: "metric" | "imperial";
  analyticsEnabled?: boolean;
  crashReportingEnabled?: boolean;
}

export interface UpdateSettingsResponse {
  updatedFields: string[];
  updatedAt: string;
}

// ============================================================================
// サブスクリプション API 型
// ============================================================================

export interface GetSubscriptionResponse {
  plan: SubscriptionPlan;
  status: string;
  expirationDate?: string;
  features: string[];
  limits: {
    dailySessions: number;
    exerciseTypes: ExerciseType[];
  };
}

export interface VerifyPurchaseRequest {
  store: "app_store" | "play_store";
  productId: string;
  purchaseToken: string;
}

export interface VerifyPurchaseResponse {
  success: boolean;
  plan: SubscriptionPlan;
  expirationDate: string;
}

// ============================================================================
// 管理 API 型
// ============================================================================

export interface SetCustomClaimsRequest {
  userId: string;
  claims: {
    admin?: boolean;
    forceLogout?: boolean;
    [key: string]: unknown;
  };
}

export interface SetCustomClaimsResponse {
  userId: string;
  updatedClaims: Record<string, unknown>;
}

// ============================================================================
// Webhook 型
// ============================================================================

export interface RevenueCatWebhookPayload {
  api_version: string;
  event: {
    type: string;
    id: string;
    app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    store: string;
    environment: string;
    presented_offering_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    original_transaction_id?: string;
  };
}
