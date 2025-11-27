/**
 * AI Fitness App - Cloud Functions Entry Point
 *
 * This module exports all Cloud Functions for the AI Fitness App.
 * Functions are organized by domain:
 * - auth: Authentication and user lifecycle
 * - api: HTTP callable functions
 * - triggers: Firestore triggers
 * - scheduled: Scheduled maintenance tasks
 *
 * @see https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Global Function Configuration
 *
 * These settings apply to all functions unless overridden:
 * - region: asia-northeast1 (Tokyo) for Japan market
 * - maxInstances: 10 for cost control
 * - memory: 256MB default
 * - timeoutSeconds: 60 seconds
 * - minInstances: 0 for cost optimization (cold start acceptable)
 *
 * Critical functions (auth) may override with minInstances: 1
 */
setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
});

// ========================================
// Auth Functions (User Lifecycle)
// ========================================
// - auth_onCreate: Create user document on signup
// - auth_onDelete: Cleanup on account deletion
// - auth_setCustomClaims: Set custom claims (admin only)
export * from "./auth";

// ========================================
// API Functions (HTTP Callable)
// ========================================
// - user_updateProfile: Update user profile
// TODO: Implement remaining:
// - user_getProfile
// - training_createSession, training_getSessions
// - gdpr_requestDataExport, gdpr_requestAccountDeletion
// - settings_get, settings_update
// - subscription_getStatus, subscription_verifyPurchase
export * from "./api";

// ========================================
// Firestore Triggers
// ========================================
// Uncomment when implementing:
// - triggers_onSessionComplete: Sync to BigQuery
// - triggers_onConsentChange: Handle consent updates
// export * from "./triggers";

// ========================================
// Scheduled Functions
// ========================================
// Uncomment when implementing:
// - scheduled_processDeletedUsers: 30-day deletion cleanup
// - scheduled_cleanupRateLimits: Remove expired rate limit records
// - scheduled_processDLQ: Retry failed BigQuery syncs
// export * from "./scheduled";

// ========================================
// Webhook Handlers
// ========================================
// Uncomment when implementing:
// - webhook_revenueCat: Handle subscription events
// export * from "./webhooks";
