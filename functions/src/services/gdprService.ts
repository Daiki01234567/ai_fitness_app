/**
 * GDPR Service - Facade
 *
 * This file re-exports all GDPR-related functions from split modules
 * for backward compatibility.
 *
 * GDPR Article 17 (Right to Erasure) and Article 20 (Data Portability)
 *
 * @see docs/specs/06_data_processing_records_ROPA_v1_0.md
 * @see docs/tickets/015_data_export_deletion.md
 */

// =============================================================================
// Helpers (gdpr/helpers.ts)
// Note: hashIpAddress is NOT re-exported here to avoid conflict with accessLog.ts
// Use the one from accessLog.ts or import directly from gdpr/helpers.ts if needed
// =============================================================================
export {
  safeTimestampToString,
  generateSignature,
  hashUserId,
  getExportBucketName,
  getUserUploadsBucketName,
  DEFAULT_AUDIT_SALT,
  DEFAULT_RECOVERY_SALT,
  DEFAULT_CERTIFICATE_SECRET,
} from "./gdpr/helpers";

// =============================================================================
// Collectors (gdpr/collectors.ts)
// =============================================================================
export {
  collectProfileData,
  collectSessionsData,
  collectSettingsData,
  collectSubscriptionsData,
  collectConsentsData,
} from "./gdpr/collectors";

// =============================================================================
// Formatters (gdpr/formatters.ts)
// =============================================================================
export {
  transformToJSON,
  transformToCSV,
  sessionToCSVRow,
  convertProfileToCSV,
  convertSessionsToCSV,
  convertConsentsToCSV,
  convertSettingsToCSV,
  convertSubscriptionsToCSV,
  convertAnalyticsToCSV,
  escapeCSV,
} from "./gdpr/formatters";

// =============================================================================
// Validators (gdpr/validators.ts)
// =============================================================================
export {
  hasRecentExportRequest,
  hasPendingDeletionRequest,
  countUserRecords,
} from "./gdpr/validators";

// =============================================================================
// Storage (gdprStorage.ts)
// =============================================================================
export {
  deleteUserStorage,
  verifyStorageDeletion,
  collectStorageData,
  getProfileImageBuffer,
} from "./gdprStorage";

// =============================================================================
// BigQuery (gdprBigQuery.ts)
// =============================================================================
export {
  deleteUserFromBigQuery,
  verifyBigQueryDeletion,
  collectBigQueryData,
} from "./gdprBigQuery";

// =============================================================================
// Recovery (gdprRecovery.ts)
// =============================================================================
export {
  generateRecoveryCode,
  saveRecoveryCode,
  verifyRecoveryCode,
  executeAccountRecovery,
  findScheduledDeletionByEmail,
  sendRecoveryEmail,
  cleanupExpiredRecoveryCodes,
} from "./gdprRecovery";

// =============================================================================
// Notification (gdprNotification.ts)
// =============================================================================
export {
  sendExportCompletionNotification,
  sendExportFailureNotification,
} from "./gdprNotification";

// =============================================================================
// Verification (gdprVerification.ts)
// =============================================================================
export {
  verifyFirestoreDeletion,
  verifyAuthDeletion,
  verifyCompleteDeletion,
  generateDeletionCertificate,
  getDeletionCertificate,
  findCertificatesByUserHash,
  verifyCertificateSignature,
  validateCertificate,
} from "./gdprVerification";

// =============================================================================
// Deletion (gdprDeletion.ts)
// =============================================================================
export {
  deleteUserData,
  deleteUserDataCompletely,
  setUserDeletionScheduled,
  getUserDeletionStatus,
  verifyDeletion,
  getExpiredDeletionScheduledUsers,
  getPendingDeletionRequests,
  updateDeletionRequestStatus,
} from "./gdprDeletion";
export type { DeletionResult, CompleteDeletionResult } from "./gdprDeletion";

// =============================================================================
// Export (gdprExport.ts)
// =============================================================================
export {
  collectUserData,
  transformToExportFormat,
  uploadExportFile,
  generateReadmeContent,
  generateReadmeFromData,
  createExportArchive,
  uploadExportArchive,
  executeFullExport,
  cleanupExpiredExports,
} from "./gdprExport";
