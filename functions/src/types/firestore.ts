/**
 * Firestore Data Model Type Definitions
 * Based on docs/specs/02_Firestoreデータベース設計書_v3_3.md
 */

import { Timestamp } from "firebase-admin/firestore";

// Exercise types supported by the app
export type ExerciseType =
  | "squat"
  | "armcurl"
  | "sideraise"
  | "shoulderpress"
  | "pushup";

// Subscription plan types
export type SubscriptionPlan = "free" | "premium" | "premium_annual";

// Subscription status
export type SubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "grace_period";

// Consent action types
export type ConsentAction = "accept" | "revoke" | "update";

// Data deletion status
export type DeletionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

// BigQuery sync status
export type SyncStatus = "pending" | "retrying" | "failed" | "dead_letter";

// Security incident severity
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

// Security incident status
export type IncidentStatus =
  | "detected"
  | "investigating"
  | "contained"
  | "resolved"
  | "closed";

/**
 * User document in /users/{userId}
 */
export interface User {
  // Profile information
  nickname: string;
  email: string;
  photoURL?: string;
  birthYear?: number;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  height?: number; // cm
  weight?: number; // kg
  fitnessLevel?: "beginner" | "intermediate" | "advanced";

  // Consent flags (read-only via client)
  tosAccepted: boolean;
  tosAcceptedAt?: Timestamp;
  tosVersion?: string;
  ppAccepted: boolean;
  ppAcceptedAt?: Timestamp;
  ppVersion?: string;

  // Account status
  deletionScheduled: boolean;
  scheduledDeletionDate?: Timestamp;
  forceLogoutAt?: Timestamp;

  // Usage tracking (for free plan limits)
  dailyUsageCount?: number;
  lastUsageResetDate?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

/**
 * Training session document in /users/{userId}/sessions/{sessionId}
 */
export interface Session {
  // Session identification
  exerciseType: ExerciseType;
  startTime: Timestamp;
  endTime?: Timestamp;

  // Session results
  repCount: number;
  totalScore: number;
  averageScore: number;
  duration: number; // seconds

  // Session metadata
  sessionMetadata: SessionMetadata;

  // Status
  status: "in_progress" | "completed" | "abandoned";

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Session metadata for performance tracking
 */
export interface SessionMetadata {
  // Device information
  deviceInfo: DeviceInfo;

  // Performance metrics
  averageFps: number;
  minFps: number;
  frameDropCount: number;
  totalFrames: number;

  // Quality metrics
  poseConfidenceAverage: number;
  lightingCondition?: "good" | "poor" | "variable";

  // App version
  appVersion: string;
  mediaPipeVersion: string;
}

/**
 * Device information
 */
export interface DeviceInfo {
  platform: "ios" | "android";
  model: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Frame data in /users/{userId}/sessions/{sessionId}/frames/{frameId}
 */
export interface Frame {
  frameNumber: number;
  timestamp: number; // milliseconds from session start
  poseData: PoseLandmark[];
  repState?: "down" | "up" | "transition";
  currentScore?: number;
  feedback?: string[];
}

/**
 * MediaPipe pose landmark (33 points)
 */
export interface PoseLandmark {
  index: number; // 0-32
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  z: number; // depth relative to hip
  visibility: number; // confidence 0-1
}

/**
 * Consent record in /consents/{consentId}
 */
export interface Consent {
  userId: string;
  action: ConsentAction;
  documentType: "tos" | "pp" | "marketing";
  documentVersion: string;
  ipAddress?: string; // hashed
  userAgent?: string;
  timestamp: Timestamp;
}

/**
 * Subscription document in /users/{userId}/subscriptions/{subscriptionId}
 */
export interface Subscription {
  // RevenueCat identifiers
  revenueCatId: string;
  productId: string;

  // Subscription details
  plan: SubscriptionPlan;
  status: SubscriptionStatus;

  // Dates
  startDate: Timestamp;
  expirationDate: Timestamp;
  cancelledAt?: Timestamp;

  // Payment info
  store: "app_store" | "play_store";
  priceInYen?: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * User settings in /users/{userId}/settings/{settingId}
 */
export interface UserSettings {
  // Notification settings
  notificationsEnabled: boolean;
  reminderTime?: string; // HH:mm format
  reminderDays?: number[]; // 0-6, Sunday = 0

  // Display settings
  language: string; // ISO 639-1
  theme: "light" | "dark" | "system";
  units: "metric" | "imperial";

  // Privacy settings
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Notification document in /notifications/{notificationId}
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
 * Data deletion request in /dataDeletionRequests/{requestId}
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
 * BigQuery sync failure in /bigquerySyncFailures/{failureId}
 */
export interface BigQuerySyncFailure {
  // Source information
  sourceCollection: string;
  sourceDocumentId: string;
  sourceData: Record<string, unknown>;

  // Failure details
  status: SyncStatus;
  errorMessage: string;
  errorCode?: string;

  // Retry tracking
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Timestamp;
  lastRetryAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Security incident in /securityIncidents/{incidentId}
 */
export interface SecurityIncident {
  // Incident identification
  incidentType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;

  // Details
  description: string;
  affectedUsers?: string[]; // user IDs
  affectedUserCount?: number;

  // Timeline
  detectedAt: Timestamp;
  containedAt?: Timestamp;
  resolvedAt?: Timestamp;

  // GDPR notification (72-hour requirement)
  notificationRequired: boolean;
  dpaNotifiedAt?: Timestamp;
  usersNotifiedAt?: Timestamp;

  // Investigation
  investigationNotes?: string;
  rootCause?: string;
  remediationActions?: string[];

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
