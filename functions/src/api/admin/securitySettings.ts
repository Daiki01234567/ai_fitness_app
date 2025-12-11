/**
 * セキュリティ設定API
 *
 * IPアドレス制限、レート制限、認証ポリシー、セキュリティ変更履歴の管理機能を提供
 *
 * チケット050: セキュリティ設定API
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  requireAdminFromRequest,
  requireAction,
  executeAdminAction,
} from "../../middleware/adminAuth";
import { requireCsrfProtection } from "../../middleware/csrf";
import {
  IpAllowlistEntry,
  IpBlocklistEntry,
  RateLimitConfig,
  AuthPolicy,
  SecurityChangeLog,
  SecurityChangeType,
  SecurityChangeAction,
  GetIpAllowlistResponse,
  AddIpAllowlistRequest,
  RemoveIpAllowlistRequest,
  IpAllowlistResponse,
  GetIpBlocklistResponse,
  AddIpBlocklistRequest,
  RemoveIpBlocklistRequest,
  IpBlocklistResponse,
  GetRateLimitsResponse,
  UpdateRateLimitsRequest,
  RateLimitsResponse,
  GetAuthPolicyResponse,
  UpdateAuthPolicyRequest,
  AuthPolicyResponse,
  GetSecurityChangeHistoryRequest,
  GetSecurityChangeHistoryResponse,
  SecuritySnapshotResponse,
  SECURITY_SETTINGS_CONSTANTS,
} from "../../types/admin";
import { SuccessResponse } from "../../types/api";
import { ValidationError } from "../../utils/errors";
import { isValidIpAddress } from "../../utils/adminUtils";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * セキュリティ変更ログを記録
 */
async function logSecurityChange(params: {
  changeType: SecurityChangeType;
  action: SecurityChangeAction;
  previousValue?: unknown;
  newValue?: unknown;
  changedBy: string;
  reason?: string;
}): Promise<string> {
  try {
    const logEntry = {
      changeType: params.changeType,
      action: params.action,
      previousValue: params.previousValue,
      newValue: params.newValue,
      changedBy: params.changedBy,
      changedAt: admin.firestore.FieldValue.serverTimestamp(),
      reason: params.reason,
    };

    const docRef = await db
      .collection(SECURITY_SETTINGS_CONSTANTS.SECURITY_CHANGE_LOG_COLLECTION)
      .add(logEntry);

    logger.info("Security change logged", {
      logId: docRef.id,
      changeType: params.changeType,
      action: params.action,
      changedBy: params.changedBy,
    });

    return docRef.id;
  } catch (error) {
    logger.error("Failed to log security change", error as Error, {
      changeType: params.changeType,
      changedBy: params.changedBy,
    });
    return "";
  }
}

/**
 * 取得件数を検証
 */
function validateLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return SECURITY_SETTINGS_CONSTANTS.DEFAULT_LIMIT;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > SECURITY_SETTINGS_CONSTANTS.MAX_LIMIT) {
    return SECURITY_SETTINGS_CONSTANTS.MAX_LIMIT;
  }
  return Math.floor(limit);
}

/**
 * デフォルト認証ポリシーを取得
 */
function getDefaultAuthPolicy(): Omit<AuthPolicy, "updatedAt" | "updatedBy"> {
  return {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    mfaRequired: false,
    mfaRequiredForAdmin: true,
    sessionTimeoutMinutes: 60,
    adminSessionTimeoutMinutes: 30,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  };
}

// =============================================================================
// IP許可リストAPI
// =============================================================================

/**
 * IP許可リスト取得
 *
 * superAdmin権限が必要
 */
export const admin_getIpAllowlist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetIpAllowlistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const adminId = request.auth!.uid;

    logger.info("Admin getting IP allowlist", { adminId });

    try {
      const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.IP_ALLOWLIST_DOC_PATH);
      const doc = await docRef.get();

      if (!doc.exists) {
        return {
          success: true,
          data: {
            entries: [],
            enabled: false,
          },
        };
      }

      const data = doc.data();
      const entries: IpAllowlistEntry[] = data?.entries || [];
      const enabled = data?.enabled ?? false;

      logger.info("IP allowlist retrieved successfully", {
        adminId,
        entryCount: entries.length,
        enabled,
      });

      return {
        success: true,
        data: {
          entries,
          enabled,
        },
      };
    } catch (error) {
      logger.error("Failed to get IP allowlist", error as Error, { adminId });
      throw new HttpsError("internal", "IP許可リストの取得に失敗しました");
    }
  },
);

/**
 * IP許可リスト追加
 *
 * superAdmin権限が必要
 */
export const admin_addIpAllowlist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<IpAllowlistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as AddIpAllowlistRequest;
    const adminId = request.auth!.uid;

    // Validate IP address
    if (!data.ip || !isValidIpAddress(data.ip)) {
      throw new ValidationError("有効なIPアドレスを指定してください");
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError("説明は必須です");
    }

    logger.info("Admin adding IP to allowlist", {
      adminId,
      ip: data.ip,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: `IP許可リスト追加: ${data.ip}`,
      },
      async () => {
        const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.IP_ALLOWLIST_DOC_PATH);
        const doc = await docRef.get();

        const currentEntries: IpAllowlistEntry[] = doc.exists
          ? (doc.data()?.entries || [])
          : [];

        // Check for duplicate
        if (currentEntries.some((e) => e.ip === data.ip)) {
          throw new ValidationError("このIPアドレスは既に登録されています");
        }

        const newEntry: Omit<IpAllowlistEntry, "addedAt"> & { addedAt: admin.firestore.FieldValue } = {
          ip: data.ip,
          description: data.description.trim(),
          addedBy: adminId,
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: data.expiresAt
            ? admin.firestore.Timestamp.fromDate(new Date(data.expiresAt))
            : undefined,
        };

        const updatedEntries = [...currentEntries, newEntry as unknown as IpAllowlistEntry];

        await docRef.set(
          {
            entries: updatedEntries,
            enabled: doc.exists ? doc.data()?.enabled ?? true : true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: adminId,
          },
          { merge: true },
        );

        // Log security change
        await logSecurityChange({
          changeType: "ip_allowlist",
          action: "create",
          newValue: { ip: data.ip, description: data.description },
          changedBy: adminId,
          reason: `IP追加: ${data.ip}`,
        });

        const updatedDoc = await docRef.get();
        const entries = updatedDoc.data()?.entries || [];

        logger.info("IP added to allowlist successfully", {
          adminId,
          ip: data.ip,
        });

        return {
          success: true as const,
          data: {
            success: true,
            message: "IPアドレスを許可リストに追加しました",
            entries,
          },
        };
      },
    );
  },
);

/**
 * IP許可リスト削除
 *
 * superAdmin権限が必要
 */
export const admin_removeIpAllowlist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<IpAllowlistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as RemoveIpAllowlistRequest;
    const adminId = request.auth!.uid;

    if (!data.ip) {
      throw new ValidationError("IPアドレスは必須です");
    }

    logger.info("Admin removing IP from allowlist", {
      adminId,
      ip: data.ip,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: `IP許可リスト削除: ${data.ip}`,
      },
      async () => {
        const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.IP_ALLOWLIST_DOC_PATH);
        const doc = await docRef.get();

        if (!doc.exists) {
          throw new ValidationError("IP許可リストが存在しません");
        }

        const currentEntries: IpAllowlistEntry[] = doc.data()?.entries || [];
        const entryToRemove = currentEntries.find((e) => e.ip === data.ip);

        if (!entryToRemove) {
          throw new ValidationError("指定されたIPアドレスは許可リストに存在しません");
        }

        const updatedEntries = currentEntries.filter((e) => e.ip !== data.ip);

        await docRef.update({
          entries: updatedEntries,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: adminId,
        });

        // Log security change
        await logSecurityChange({
          changeType: "ip_allowlist",
          action: "delete",
          previousValue: { ip: data.ip },
          changedBy: adminId,
          reason: data.reason || `IP削除: ${data.ip}`,
        });

        logger.info("IP removed from allowlist successfully", {
          adminId,
          ip: data.ip,
        });

        return {
          success: true as const,
          data: {
            success: true,
            message: "IPアドレスを許可リストから削除しました",
            entries: updatedEntries,
          },
        };
      },
    );
  },
);

// =============================================================================
// IPブロックリストAPI
// =============================================================================

/**
 * IPブロックリスト取得
 *
 * superAdmin権限が必要
 */
export const admin_getIpBlocklist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetIpBlocklistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const adminId = request.auth!.uid;

    logger.info("Admin getting IP blocklist", { adminId });

    try {
      const snapshot = await db
        .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
        .orderBy("blockedAt", "desc")
        .get();

      const entries: IpBlocklistEntry[] = snapshot.docs.map((doc) => ({
        ...doc.data(),
        ip: doc.id,
      })) as IpBlocklistEntry[];

      logger.info("IP blocklist retrieved successfully", {
        adminId,
        entryCount: entries.length,
      });

      return {
        success: true,
        data: { entries },
      };
    } catch (error) {
      logger.error("Failed to get IP blocklist", error as Error, { adminId });
      throw new HttpsError("internal", "IPブロックリストの取得に失敗しました");
    }
  },
);

/**
 * IPブロックリスト追加
 *
 * superAdmin権限が必要
 */
export const admin_addIpBlocklist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<IpBlocklistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as AddIpBlocklistRequest;
    const adminId = request.auth!.uid;

    // Validate IP address
    if (!data.ip || !isValidIpAddress(data.ip)) {
      throw new ValidationError("有効なIPアドレスを指定してください");
    }
    if (!data.reason || data.reason.trim().length === 0) {
      throw new ValidationError("理由は必須です");
    }

    logger.info("Admin adding IP to blocklist", {
      adminId,
      ip: data.ip,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: `IPブロックリスト追加: ${data.ip}`,
      },
      async () => {
        // Use IP as document ID for easy lookup
        const docRef = db
          .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
          .doc(data.ip.replace(/\./g, "_")); // Replace dots for valid doc ID

        const existingDoc = await docRef.get();
        if (existingDoc.exists) {
          throw new ValidationError("このIPアドレスは既にブロックされています");
        }

        const blockEntry = {
          ip: data.ip,
          reason: data.reason.trim(),
          blockedBy: adminId,
          blockedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: data.expiresAt
            ? admin.firestore.Timestamp.fromDate(new Date(data.expiresAt))
            : null,
          autoBlocked: false,
        };

        await docRef.set(blockEntry);

        // Log security change
        await logSecurityChange({
          changeType: "ip_blocklist",
          action: "create",
          newValue: { ip: data.ip, reason: data.reason },
          changedBy: adminId,
          reason: `IPブロック: ${data.ip}`,
        });

        // Get updated list
        const snapshot = await db
          .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
          .orderBy("blockedAt", "desc")
          .get();

        const entries: IpBlocklistEntry[] = snapshot.docs.map((doc) => ({
          ...doc.data(),
          ip: doc.data().ip,
        })) as IpBlocklistEntry[];

        logger.info("IP added to blocklist successfully", {
          adminId,
          ip: data.ip,
        });

        return {
          success: true as const,
          data: {
            success: true,
            message: "IPアドレスをブロックリストに追加しました",
            entries,
          },
        };
      },
    );
  },
);

/**
 * IPブロックリスト削除
 *
 * superAdmin権限が必要
 */
export const admin_removeIpBlocklist = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<IpBlocklistResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as RemoveIpBlocklistRequest;
    const adminId = request.auth!.uid;

    if (!data.ip) {
      throw new ValidationError("IPアドレスは必須です");
    }

    logger.info("Admin removing IP from blocklist", {
      adminId,
      ip: data.ip,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: `IPブロックリスト削除: ${data.ip}`,
      },
      async () => {
        const docRef = db
          .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
          .doc(data.ip.replace(/\./g, "_"));

        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          throw new ValidationError("指定されたIPアドレスはブロックリストに存在しません");
        }

        await docRef.delete();

        // Log security change
        await logSecurityChange({
          changeType: "ip_blocklist",
          action: "delete",
          previousValue: { ip: data.ip },
          changedBy: adminId,
          reason: data.reason || `IPブロック解除: ${data.ip}`,
        });

        // Get updated list
        const snapshot = await db
          .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
          .orderBy("blockedAt", "desc")
          .get();

        const entries: IpBlocklistEntry[] = snapshot.docs.map((doc) => ({
          ...doc.data(),
          ip: doc.data().ip,
        })) as IpBlocklistEntry[];

        logger.info("IP removed from blocklist successfully", {
          adminId,
          ip: data.ip,
        });

        return {
          success: true as const,
          data: {
            success: true,
            message: "IPアドレスをブロックリストから削除しました",
            entries,
          },
        };
      },
    );
  },
);

// =============================================================================
// レート制限設定API
// =============================================================================

/**
 * レート制限設定取得
 *
 * superAdmin権限が必要
 */
export const admin_getRateLimits = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetRateLimitsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const adminId = request.auth!.uid;

    logger.info("Admin getting rate limits", { adminId });

    try {
      const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.RATE_LIMITS_DOC_PATH);
      const doc = await docRef.get();

      if (!doc.exists) {
        // Return default rate limits
        return {
          success: true,
          data: {
            configs: [
              {
                endpoint: "default",
                maxRequests: 100,
                windowSeconds: 60,
                enabled: true,
                bypassRoles: ["superAdmin"],
              },
            ],
          },
        };
      }

      const configs: RateLimitConfig[] = doc.data()?.configs || [];

      logger.info("Rate limits retrieved successfully", {
        adminId,
        configCount: configs.length,
      });

      return {
        success: true,
        data: { configs },
      };
    } catch (error) {
      logger.error("Failed to get rate limits", error as Error, { adminId });
      throw new HttpsError("internal", "レート制限設定の取得に失敗しました");
    }
  },
);

/**
 * レート制限設定更新
 *
 * superAdmin権限が必要
 */
export const admin_updateRateLimits = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<RateLimitsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as UpdateRateLimitsRequest;
    const adminId = request.auth!.uid;

    if (!data.configs || !Array.isArray(data.configs)) {
      throw new ValidationError("configsは配列で指定してください");
    }

    // Validate each config
    for (const config of data.configs) {
      if (!config.endpoint) {
        throw new ValidationError("各設定にはendpointが必要です");
      }
      if (typeof config.maxRequests !== "number" || config.maxRequests < 1) {
        throw new ValidationError("maxRequestsは1以上の数値で指定してください");
      }
      if (typeof config.windowSeconds !== "number" || config.windowSeconds < 1) {
        throw new ValidationError("windowSecondsは1以上の数値で指定してください");
      }
    }

    logger.info("Admin updating rate limits", {
      adminId,
      configCount: data.configs.length,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: "レート制限設定更新",
      },
      async () => {
        const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.RATE_LIMITS_DOC_PATH);

        // Get previous value for logging
        const existingDoc = await docRef.get();
        const previousConfigs = existingDoc.exists ? existingDoc.data()?.configs : [];

        await docRef.set({
          configs: data.configs,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: adminId,
        });

        // Log security change
        await logSecurityChange({
          changeType: "rate_limit",
          action: "update",
          previousValue: previousConfigs,
          newValue: data.configs,
          changedBy: adminId,
        });

        logger.info("Rate limits updated successfully", {
          adminId,
          configCount: data.configs.length,
        });

        return {
          success: true as const,
          data: {
            success: true,
            message: "レート制限設定を更新しました",
            configs: data.configs,
          },
        };
      },
    );
  },
);

// =============================================================================
// 認証ポリシーAPI
// =============================================================================

/**
 * 認証ポリシー取得
 *
 * superAdmin権限が必要
 */
export const admin_getAuthPolicy = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetAuthPolicyResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const adminId = request.auth!.uid;

    logger.info("Admin getting auth policy", { adminId });

    try {
      const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.AUTH_POLICY_DOC_PATH);
      const doc = await docRef.get();

      let policy: AuthPolicy;

      if (!doc.exists) {
        // Return default policy
        policy = {
          ...getDefaultAuthPolicy(),
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: "system",
        };
      } else {
        policy = doc.data() as AuthPolicy;
      }

      logger.info("Auth policy retrieved successfully", { adminId });

      return {
        success: true,
        data: { policy },
      };
    } catch (error) {
      logger.error("Failed to get auth policy", error as Error, { adminId });
      throw new HttpsError("internal", "認証ポリシーの取得に失敗しました");
    }
  },
);

/**
 * 認証ポリシー更新
 *
 * superAdmin権限が必要
 */
export const admin_updateAuthPolicy = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<AuthPolicyResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as UpdateAuthPolicyRequest;
    const adminId = request.auth!.uid;

    // Validate numeric fields
    if (data.passwordMinLength !== undefined && data.passwordMinLength < 6) {
      throw new ValidationError("パスワード最小文字数は6以上で指定してください");
    }
    if (data.sessionTimeoutMinutes !== undefined && data.sessionTimeoutMinutes < 5) {
      throw new ValidationError("セッションタイムアウトは5分以上で指定してください");
    }
    if (data.adminSessionTimeoutMinutes !== undefined && data.adminSessionTimeoutMinutes < 5) {
      throw new ValidationError("管理者セッションタイムアウトは5分以上で指定してください");
    }
    if (data.maxLoginAttempts !== undefined && data.maxLoginAttempts < 3) {
      throw new ValidationError("最大ログイン試行回数は3以上で指定してください");
    }
    if (data.lockoutDurationMinutes !== undefined && data.lockoutDurationMinutes < 1) {
      throw new ValidationError("ロックアウト期間は1分以上で指定してください");
    }

    logger.info("Admin updating auth policy", { adminId });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "manage_security",
        reason: "認証ポリシー更新",
      },
      async () => {
        const docRef = db.doc(SECURITY_SETTINGS_CONSTANTS.AUTH_POLICY_DOC_PATH);

        // Get existing policy or use defaults
        const existingDoc = await docRef.get();
        const existingPolicy = existingDoc.exists
          ? (existingDoc.data() as AuthPolicy)
          : getDefaultAuthPolicy();

        // Build update object with proper typing for Firestore update
        const updateData: Record<string, unknown> = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: adminId,
        };

        if (data.passwordMinLength !== undefined) {
          updateData.passwordMinLength = data.passwordMinLength;
        }
        if (data.passwordRequireUppercase !== undefined) {
          updateData.passwordRequireUppercase = data.passwordRequireUppercase;
        }
        if (data.passwordRequireLowercase !== undefined) {
          updateData.passwordRequireLowercase = data.passwordRequireLowercase;
        }
        if (data.passwordRequireNumber !== undefined) {
          updateData.passwordRequireNumber = data.passwordRequireNumber;
        }
        if (data.passwordRequireSpecial !== undefined) {
          updateData.passwordRequireSpecial = data.passwordRequireSpecial;
        }
        if (data.mfaRequired !== undefined) {
          updateData.mfaRequired = data.mfaRequired;
        }
        if (data.mfaRequiredForAdmin !== undefined) {
          updateData.mfaRequiredForAdmin = data.mfaRequiredForAdmin;
        }
        if (data.sessionTimeoutMinutes !== undefined) {
          updateData.sessionTimeoutMinutes = data.sessionTimeoutMinutes;
        }
        if (data.adminSessionTimeoutMinutes !== undefined) {
          updateData.adminSessionTimeoutMinutes = data.adminSessionTimeoutMinutes;
        }
        if (data.maxLoginAttempts !== undefined) {
          updateData.maxLoginAttempts = data.maxLoginAttempts;
        }
        if (data.lockoutDurationMinutes !== undefined) {
          updateData.lockoutDurationMinutes = data.lockoutDurationMinutes;
        }

        await docRef.set(updateData, { merge: true });

        // Log security change
        await logSecurityChange({
          changeType: "auth_policy",
          action: "update",
          previousValue: existingPolicy,
          newValue: { ...existingPolicy, ...updateData },
          changedBy: adminId,
        });

        const updatedDoc = await docRef.get();
        const policy = updatedDoc.data() as AuthPolicy;

        logger.info("Auth policy updated successfully", { adminId });

        return {
          success: true as const,
          data: {
            success: true,
            message: "認証ポリシーを更新しました",
            policy,
          },
        };
      },
    );
  },
);

// =============================================================================
// セキュリティ変更履歴API
// =============================================================================

/**
 * セキュリティ変更履歴取得
 *
 * superAdmin権限が必要
 */
export const admin_getSecurityChangeHistory = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetSecurityChangeHistoryResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const data = request.data as GetSecurityChangeHistoryRequest;
    const adminId = request.auth!.uid;
    const limit = validateLimit(data.limit);

    logger.info("Admin getting security change history", {
      adminId,
      changeType: data.changeType,
      limit,
    });

    try {
      let query: admin.firestore.Query = db.collection(
        SECURITY_SETTINGS_CONSTANTS.SECURITY_CHANGE_LOG_COLLECTION,
      );

      // Apply filters
      if (data.changeType) {
        query = query.where("changeType", "==", data.changeType);
      }
      if (data.startDate) {
        const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
        query = query.where("changedAt", ">=", startTimestamp);
      }
      if (data.endDate) {
        const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(data.endDate));
        query = query.where("changedAt", "<=", endTimestamp);
      }

      // Sort by changedAt descending
      query = query.orderBy("changedAt", "desc");

      // Apply cursor
      if (data.cursor) {
        const cursorDoc = await db
          .collection(SECURITY_SETTINGS_CONSTANTS.SECURITY_CHANGE_LOG_COLLECTION)
          .doc(data.cursor)
          .get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      query = query.limit(limit + 1);

      const snapshot = await query.get();

      // Get total count
      const totalSnapshot = await db
        .collection(SECURITY_SETTINGS_CONSTANTS.SECURITY_CHANGE_LOG_COLLECTION)
        .count()
        .get();
      const totalCount = totalSnapshot.data().count;

      const docs = snapshot.docs;
      const hasMore = docs.length > limit;

      const logs: SecurityChangeLog[] = docs.slice(0, limit).map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SecurityChangeLog[];

      const nextCursor = hasMore ? docs[limit - 1].id : undefined;

      logger.info("Security change history retrieved successfully", {
        adminId,
        count: logs.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          logs,
          nextCursor,
          totalCount,
        },
      };
    } catch (error) {
      logger.error("Failed to get security change history", error as Error, { adminId });
      throw new HttpsError("internal", "セキュリティ変更履歴の取得に失敗しました");
    }
  },
);

/**
 * セキュリティスナップショット取得
 *
 * 現在のセキュリティ設定の全体像を取得
 * superAdmin権限が必要
 */
export const admin_getSecuritySnapshot = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SecuritySnapshotResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "manage_security");

    const adminId = request.auth!.uid;

    logger.info("Admin getting security snapshot", { adminId });

    try {
      // Get IP allowlist
      const allowlistDoc = await db
        .doc(SECURITY_SETTINGS_CONSTANTS.IP_ALLOWLIST_DOC_PATH)
        .get();
      const ipAllowlist = {
        entries: (allowlistDoc.data()?.entries || []) as IpAllowlistEntry[],
        enabled: allowlistDoc.data()?.enabled ?? false,
      };

      // Get IP blocklist
      const blocklistSnapshot = await db
        .collection(SECURITY_SETTINGS_CONSTANTS.IP_BLOCKLIST_COLLECTION)
        .get();
      const ipBlocklist: IpBlocklistEntry[] = blocklistSnapshot.docs.map((doc) => ({
        ...doc.data(),
        ip: doc.data().ip,
      })) as IpBlocklistEntry[];

      // Get rate limits
      const rateLimitsDoc = await db
        .doc(SECURITY_SETTINGS_CONSTANTS.RATE_LIMITS_DOC_PATH)
        .get();
      const rateLimits: RateLimitConfig[] = rateLimitsDoc.data()?.configs || [
        {
          endpoint: "default",
          maxRequests: 100,
          windowSeconds: 60,
          enabled: true,
          bypassRoles: ["superAdmin"],
        },
      ];

      // Get auth policy
      const authPolicyDoc = await db
        .doc(SECURITY_SETTINGS_CONSTANTS.AUTH_POLICY_DOC_PATH)
        .get();
      const authPolicy: AuthPolicy = authPolicyDoc.exists
        ? (authPolicyDoc.data() as AuthPolicy)
        : {
            ...getDefaultAuthPolicy(),
            updatedAt: admin.firestore.Timestamp.now(),
            updatedBy: "system",
          };

      logger.info("Security snapshot retrieved successfully", { adminId });

      return {
        success: true,
        data: {
          ipAllowlist,
          ipBlocklist,
          rateLimits,
          authPolicy,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to get security snapshot", error as Error, { adminId });
      throw new HttpsError("internal", "セキュリティスナップショットの取得に失敗しました");
    }
  },
);
