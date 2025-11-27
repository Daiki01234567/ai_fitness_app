/**
 * Custom Error Type Definitions
 * Based on API design document error code system
 */

import { FunctionsErrorCode } from "firebase-functions/v2/https";

/**
 * Error codes mapped to HTTP status and retry behavior
 */
export const ErrorCodes = {
  // Authentication errors
  UNAUTHENTICATED: {
    code: "unauthenticated" as FunctionsErrorCode,
    httpStatus: 401,
    retryable: false,
  },
  PERMISSION_DENIED: {
    code: "permission-denied" as FunctionsErrorCode,
    httpStatus: 403,
    retryable: false,
  },

  // Validation errors
  INVALID_ARGUMENT: {
    code: "invalid-argument" as FunctionsErrorCode,
    httpStatus: 400,
    retryable: false,
  },

  // Resource errors
  NOT_FOUND: {
    code: "not-found" as FunctionsErrorCode,
    httpStatus: 404,
    retryable: false,
  },
  ALREADY_EXISTS: {
    code: "already-exists" as FunctionsErrorCode,
    httpStatus: 409,
    retryable: false,
  },

  // Rate limiting
  RESOURCE_EXHAUSTED: {
    code: "resource-exhausted" as FunctionsErrorCode,
    httpStatus: 429,
    retryable: true,
  },

  // Server errors
  INTERNAL: {
    code: "internal" as FunctionsErrorCode,
    httpStatus: 500,
    retryable: true,
  },
  UNAVAILABLE: {
    code: "unavailable" as FunctionsErrorCode,
    httpStatus: 503,
    retryable: true,
  },
  DATA_LOSS: {
    code: "data-loss" as FunctionsErrorCode,
    httpStatus: 500,
    retryable: false,
  },
  DEADLINE_EXCEEDED: {
    code: "deadline-exceeded" as FunctionsErrorCode,
    httpStatus: 504,
    retryable: true,
  },

  // Business logic errors
  FAILED_PRECONDITION: {
    code: "failed-precondition" as FunctionsErrorCode,
    httpStatus: 400,
    retryable: false,
  },
  ABORTED: {
    code: "aborted" as FunctionsErrorCode,
    httpStatus: 409,
    retryable: true,
  },
  OUT_OF_RANGE: {
    code: "out-of-range" as FunctionsErrorCode,
    httpStatus: 400,
    retryable: false,
  },
  UNIMPLEMENTED: {
    code: "unimplemented" as FunctionsErrorCode,
    httpStatus: 501,
    retryable: false,
  },
  CANCELLED: {
    code: "cancelled" as FunctionsErrorCode,
    httpStatus: 499,
    retryable: false,
  },
  UNKNOWN: {
    code: "unknown" as FunctionsErrorCode,
    httpStatus: 500,
    retryable: true,
  },
} as const;

export type ErrorCodeKey = keyof typeof ErrorCodes;

/**
 * Application-specific error codes for detailed error tracking
 */
export const AppErrorCodes = {
  // Authentication
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_SESSION_REVOKED: "AUTH_SESSION_REVOKED",

  // User
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  USER_DELETION_SCHEDULED: "USER_DELETION_SCHEDULED",
  USER_CONSENT_REQUIRED: "USER_CONSENT_REQUIRED",

  // Session
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_ALREADY_COMPLETED: "SESSION_ALREADY_COMPLETED",
  SESSION_LIMIT_EXCEEDED: "SESSION_LIMIT_EXCEEDED",

  // Validation
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_EXERCISE_TYPE: "INVALID_EXERCISE_TYPE",
  INVALID_POSE_DATA: "INVALID_POSE_DATA",

  // Subscription
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PURCHASE_VERIFICATION_FAILED: "PURCHASE_VERIFICATION_FAILED",

  // GDPR
  EXPORT_IN_PROGRESS: "EXPORT_IN_PROGRESS",
  DELETION_IN_PROGRESS: "DELETION_IN_PROGRESS",
  CONSENT_REVOKED: "CONSENT_REVOKED",

  // External services
  BIGQUERY_SYNC_FAILED: "BIGQUERY_SYNC_FAILED",
  REVENUECAT_ERROR: "REVENUECAT_ERROR",
  FCM_SEND_FAILED: "FCM_SEND_FAILED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type AppErrorCode = (typeof AppErrorCodes)[keyof typeof AppErrorCodes];

/**
 * Error details interface for structured error information
 */
export interface ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  appCode?: AppErrorCode;
  [key: string]: unknown;
}

/**
 * Structured error information for logging
 */
export interface ErrorInfo {
  code: FunctionsErrorCode;
  message: string;
  details?: ErrorDetails;
  stack?: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
}
