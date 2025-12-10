/**
 * トレーニングセッション API 型定義
 *
 * @see docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md セクション6
 * @see docs/common/specs/03_Firestoreデータベース設計書_v1_0.md セクション5
 */

import { Timestamp } from "firebase-admin/firestore";

// 種目タイプ（Expo版5種目）
export type TrainingExerciseType =
  | "squat"
  | "pushup"
  | "armcurl"
  | "sidelateral"
  | "shoulderpress";

// セッション状態
export type SessionStatus = "active" | "completed" | "cancelled";

// 警告レベル
export type WarningSeverity = "low" | "medium" | "high";

// カメラ位置
export type CameraPosition = "front" | "side";

// プラットフォーム
export type Platform = "iOS" | "Android";

/**
 * カメラ設定
 */
export interface CameraSettings {
  position: CameraPosition;
  resolution: string; // 例: "1280x720"
  fps: number; // 例: 30
}

/**
 * 警告情報
 */
export interface FormWarning {
  type: string; // 例: "knee_over_toe", "elbow_swing"
  count: number;
  severity: WarningSeverity;
}

/**
 * フォーム評価フィードバック
 */
export interface FormFeedback {
  overallScore: number; // 0-100
  goodFrames: number;
  warningFrames: number;
  errorFrames: number;
  warnings: FormWarning[];
}

/**
 * デバイス情報（トレーニング用）
 */
export interface TrainingDeviceInfo {
  platform: Platform;
  osVersion: string;
  deviceModel: string;
  deviceMemory: number | null;
}

/**
 * MediaPipe パフォーマンスメトリクス
 */
export interface MediaPipePerformance {
  averageInferenceTime: number; // ms
  maxInferenceTime: number; // ms
  minInferenceTime: number; // ms
}

/**
 * セッションメタデータ（トレーニング用）
 */
export interface TrainingSessionMetadata {
  totalFrames: number;
  processedFrames: number;
  averageFps: number;
  frameDropCount: number;
  averageConfidence: number; // 0-1
  mediapipePerformance: MediaPipePerformance;
  deviceInfo: TrainingDeviceInfo;
}

/**
 * Firestoreセッションドキュメント（完全版）
 */
export interface SessionDocument {
  // 基本情報
  sessionId: string;
  userId: string;
  exerciseType: TrainingExerciseType;

  // セッション詳細
  startTime: Timestamp;
  endTime: Timestamp | null;
  duration: number | null; // 秒
  status: SessionStatus;

  // トレーニング結果
  repCount: number;
  setCount: number;

  // フォーム評価結果
  formFeedback: FormFeedback | null;

  // カメラ設定
  cameraSettings: CameraSettings;

  // セッションメタデータ
  sessionMetadata: TrainingSessionMetadata | null;

  // BigQuery同期状態
  bigquerySyncStatus: "pending" | "synced" | "failed";
  bigquerySyncedAt: Timestamp | null;
  bigquerySyncError: string | null;
  bigquerySyncRetryCount: number;

  // システム管理
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // データ保持期間管理
  dataRetentionDate: Timestamp | null;
}

// ========================================
// API リクエスト/レスポンス型定義
// ========================================

/**
 * training_createSession リクエスト
 */
export interface TrainingCreateSessionRequest {
  exerciseType: TrainingExerciseType;
  cameraSettings: CameraSettings;
}

/**
 * training_createSession レスポンス
 */
export interface TrainingCreateSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    exerciseType: TrainingExerciseType;
    startTime: string; // ISO 8601
    status: "active";
  };
}

/**
 * training_completeSession リクエスト
 */
export interface TrainingCompleteSessionRequest {
  sessionId: string;
  repCount: number;
  setCount: number;
  formFeedback: FormFeedback;
  sessionMetadata: TrainingSessionMetadata;
}

/**
 * training_completeSession レスポンス
 */
export interface TrainingCompleteSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    status: "completed";
    repCount: number;
    overallScore: number;
    completedAt: string; // ISO 8601
  };
  message: string;
}

/**
 * training_getSession リクエスト
 */
export interface TrainingGetSessionRequest {
  sessionId: string;
}

/**
 * training_getSession レスポンス
 */
export interface TrainingGetSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    exerciseType: TrainingExerciseType;
    startTime: string; // ISO 8601
    endTime: string | null;
    duration: number | null;
    status: SessionStatus;
    repCount: number;
    setCount: number;
    formFeedback: FormFeedback | null;
    cameraSettings: CameraSettings;
    sessionMetadata: TrainingSessionMetadata | null;
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  };
}

/**
 * training_listSessions リクエスト
 */
export interface TrainingListSessionsRequest {
  limit?: number; // デフォルト: 20、最大: 100
  startAfter?: string; // sessionId
  exerciseType?: TrainingExerciseType | null;
}

/**
 * training_listSessions レスポンス（セッションサマリー）
 */
export interface TrainingSessionSummary {
  sessionId: string;
  exerciseType: TrainingExerciseType;
  startTime: string; // ISO 8601
  endTime: string | null;
  duration: number | null;
  status: SessionStatus;
  repCount: number;
  setCount: number;
  overallScore: number | null;
  createdAt: string; // ISO 8601
}

export interface TrainingListSessionsResponse {
  success: true;
  data: {
    sessions: TrainingSessionSummary[];
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * training_deleteSession リクエスト
 */
export interface TrainingDeleteSessionRequest {
  sessionId: string;
}

/**
 * training_deleteSession レスポンス
 */
export interface TrainingDeleteSessionResponse {
  success: true;
  data: {
    sessionId: string;
    status: "cancelled";
    deletedAt: string; // ISO 8601
  };
  message: string;
}
