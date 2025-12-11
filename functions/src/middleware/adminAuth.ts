/**
 * 管理者認証ミドルウェア
 *
 * 管理者権限での代理実行チェック
 * - カスタムクレーム `admin: true` の確認
 * - 権限レベルチェック
 * - 代理実行時の追加監査ログ
 * - IPアドレス検証（チケット041）
 * - MFA検証（チケット041）
 * - 新ロールベース制御（チケット041）
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 * 参照: docs/common/tickets/041-admin-auth.md
 */

import * as admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
import { CallableRequest } from "firebase-functions/v2/https";

import { logAdminAction } from "../services/auditLog";
import {
  AdminRole,
  AdminUser,
  AdminClaims,
  AdminPermissionType,
} from "../types/admin";
import {
  AdminActionType,
  AdminLevel,
  AdminPermissions,
  ADMIN_PERMISSIONS,
} from "../types/security";
import {
  isAllowedIp,
  verifyMfaStatus,
  isClaimsExpired,
  logAdminAuthAction,
  getPermissionsForRole,
  hasRequiredRole as hasRequiredAdminRole,
  isValidAdminRole,
  sendSecurityAlert,
  extractIpFromRequest,
} from "../utils/adminUtils";
import { AuthorizationError } from "../utils/errors";
import { getFirestore } from "../utils/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// =============================================================================
// 管理者権限チェック
// =============================================================================

/**
 * 管理者権限を要求（DecodedIdToken バージョン）
 *
 * @param auth デコードされた ID トークン
 * @throws 管理者権限がない場合は AuthorizationError をスロー
 */
export function requireAdminToken(auth: DecodedIdToken): void {
  if (!auth.admin) {
    logger.warn("Admin access denied", { userId: auth.uid });
    throw new AuthorizationError("管理者権限が必要です");
  }
}

/**
 * 管理者権限をチェック（例外をスローしない）
 *
 * @param auth デコードされた ID トークン
 * @returns 管理者権限があるかどうか
 */
export function isAdmin(auth?: DecodedIdToken): boolean {
  if (!auth) {
    return false;
  }
  return auth.admin === true;
}

/**
 * リクエストから管理者権限を要求
 *
 * @param request Callable リクエスト
 * @throws 認証がない、または管理者権限がない場合は例外をスロー
 */
export function requireAdminFromRequest(request: CallableRequest): void {
  if (!request.auth) {
    throw new AuthorizationError("認証が必要です");
  }
  requireAdminToken(request.auth.token);
}

// =============================================================================
// 権限レベルチェック
// =============================================================================

/**
 * 管理者権限レベルを取得
 *
 * @param auth デコードされた ID トークン
 * @returns 権限レベル（undefined = 管理者ではない）
 */
export function getAdminLevel(auth?: DecodedIdToken): AdminLevel | undefined {
  if (!auth) {
    return undefined;
  }

  if (auth.super_admin === true) {
    return "super_admin";
  }
  if (auth.admin === true) {
    return "admin";
  }
  if (auth.support === true) {
    return "support";
  }

  return undefined;
}

/**
 * 管理者権限を取得
 *
 * @param auth デコードされた ID トークン
 * @returns 権限情報（undefined = 管理者ではない）
 */
export function getAdminPermissions(auth?: DecodedIdToken): AdminPermissions | undefined {
  const level = getAdminLevel(auth);
  if (!level) {
    return undefined;
  }

  return {
    level,
    allowedActions: ADMIN_PERMISSIONS[level],
  };
}

/**
 * 特定のアクションが許可されているかチェック
 *
 * @param auth デコードされた ID トークン
 * @param action チェックするアクション
 * @returns アクションが許可されているかどうか
 */
export function canPerformAction(
  auth: DecodedIdToken | undefined,
  action: AdminActionType,
): boolean {
  const permissions = getAdminPermissions(auth);
  if (!permissions) {
    return false;
  }

  return permissions.allowedActions.includes(action);
}

/**
 * 特定のアクションを要求
 *
 * @param auth デコードされた ID トークン
 * @param action 要求するアクション
 * @throws アクションが許可されていない場合は AuthorizationError をスロー
 */
export function requireAction(auth: DecodedIdToken, action: AdminActionType): void {
  if (!canPerformAction(auth, action)) {
    logger.warn("Admin action denied", {
      userId: auth.uid,
      action,
      level: getAdminLevel(auth),
    });

    throw new AuthorizationError(
      `このアクション (${action}) を実行する権限がありません`,
    );
  }
}

// =============================================================================
// 代理実行チェック
// =============================================================================

/**
 * 管理者がターゲットユーザーに対して操作できるかチェック
 *
 * @param adminId 管理者 ID
 * @param targetUserId 対象ユーザー ID
 * @param action 実行するアクション
 * @returns 操作が許可されているかどうか
 */
export async function canActOnBehalfOf(
  adminId: string,
  targetUserId: string,
  action: AdminActionType = "view_user_data",
): Promise<boolean> {
  try {
    // 管理者情報を取得
    const adminUser = await admin.auth().getUser(adminId);
    const adminClaims = adminUser.customClaims || {};

    // 管理者権限チェック
    if (!adminClaims.admin && !adminClaims.super_admin && !adminClaims.support) {
      return false;
    }

    // アクション権限チェック
    const permissions = getAdminPermissions(adminClaims as DecodedIdToken);
    if (!permissions || !permissions.allowedActions.includes(action)) {
      return false;
    }

    // スコープ制限チェック（将来の拡張用）
    if (permissions.scopeRestrictions) {
      // 例: リージョン制限、ユーザープラン制限など
      // 現在は実装なし
    }

    // 自分自身に対する操作は super_admin のみ
    if (adminId === targetUserId && !adminClaims.super_admin) {
      logger.warn("Admin cannot perform action on self", {
        adminId,
        action,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("canActOnBehalfOf check failed", error as Error, {
      adminId,
      targetUserId,
      action,
    });
    return false;
  }
}

/**
 * 代理実行権限を要求
 *
 * @param request Callable リクエスト
 * @param targetUserId 対象ユーザー ID
 * @param action 実行するアクション
 * @throws 権限がない場合は AuthorizationError をスロー
 */
export async function requireActOnBehalfOf(
  request: CallableRequest,
  targetUserId: string,
  action: AdminActionType,
): Promise<void> {
  if (!request.auth) {
    throw new AuthorizationError("認証が必要です");
  }

  const adminId = request.auth.uid;
  const canAct = await canActOnBehalfOf(adminId, targetUserId, action);

  if (!canAct) {
    throw new AuthorizationError(
      "このユーザーに対する操作を行う権限がありません",
    );
  }
}

// =============================================================================
// 管理者操作記録
// =============================================================================

/**
 * 管理者操作を実行し、監査ログを記録
 *
 * @param params 操作パラメータ
 * @param operation 実行する操作関数
 * @returns 操作結果
 */
export async function executeAdminAction<T>(
  params: {
    adminId: string;
    targetUserId: string;
    action: AdminActionType;
    reason: string;
    metadata?: Record<string, unknown>;
  },
  operation: () => Promise<T>,
): Promise<T> {
  const { adminId, targetUserId, action, reason, metadata } = params;
  const startTime = Date.now();

  logger.info("Admin action started", {
    adminId,
    targetUserId,
    action,
    reason,
  });

  try {
    // 操作を実行
    const result = await operation();

    // 成功の監査ログを記録
    await logAdminAction({
      adminUserId: adminId,
      targetUserId,
      action,
      details: {
        reason,
        success: true,
        durationMs: Date.now() - startTime,
        ...metadata,
      },
    });

    logger.info("Admin action completed", {
      adminId,
      targetUserId,
      action,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // 失敗の監査ログを記録
    await logAdminAction({
      adminUserId: adminId,
      targetUserId,
      action,
      details: {
        reason,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
        ...metadata,
      },
    });

    logger.error("Admin action failed", error as Error, {
      adminId,
      targetUserId,
      action,
    });

    throw error;
  }
}

// =============================================================================
// 管理者リスト管理
// =============================================================================

/**
 * 管理者一覧を取得
 *
 * @param level フィルタする権限レベル（オプション）
 * @returns 管理者ユーザー一覧
 */
export async function listAdmins(level?: AdminLevel): Promise<admin.auth.UserRecord[]> {
  const admins: admin.auth.UserRecord[] = [];

  // Firebase Auth の listUsers は 1000 件まで
  let pageToken: string | undefined;

  do {
    const listResult = await admin.auth().listUsers(1000, pageToken);

    for (const user of listResult.users) {
      const claims = user.customClaims || {};

      if (level) {
        // 特定レベルでフィルタ
        if (level === "super_admin" && claims.super_admin) {
          admins.push(user);
        } else if (level === "admin" && claims.admin && !claims.super_admin) {
          admins.push(user);
        } else if (level === "support" && claims.support && !claims.admin) {
          admins.push(user);
        }
      } else {
        // すべての管理者
        if (claims.admin || claims.super_admin || claims.support) {
          admins.push(user);
        }
      }
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  return admins;
}

/**
 * 管理者権限を設定
 *
 * @param userId 対象ユーザー ID
 * @param level 設定する権限レベル（null で権限解除）
 */
export async function setAdminLevel(
  userId: string,
  level: AdminLevel | null,
): Promise<void> {
  const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};

  // 既存のクレームから管理者関連を削除
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, camelcase
  const { admin: _adminClaim, super_admin: _superAdmin, support: _support, ...otherClaims } = currentClaims;

  let newClaims = { ...otherClaims };

  if (level) {
    switch (level) {
      case "super_admin":
        // eslint-disable-next-line camelcase
        newClaims = { ...newClaims, admin: true, super_admin: true };
        break;
      case "admin":
        newClaims = { ...newClaims, admin: true };
        break;
      case "support":
        newClaims = { ...newClaims, support: true };
        break;
    }
  }

  await admin.auth().setCustomUserClaims(userId, newClaims);

  // 管理者変更を Firestore にも記録
  await db.collection("adminUsers").doc(userId).set(
    {
      userId,
      level: level || "none",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  logger.security("Admin level changed", {
    userId,
    newLevel: level || "none",
  });
}

// =============================================================================
// チケット041: 新しい管理者認証基盤
// =============================================================================

/**
 * 管理者認証コンテキスト
 * ミドルウェアで検証された管理者情報
 */
export interface AdminAuthContext {
  /** 管理者ユーザー情報 */
  adminUser: AdminUser;
  /** カスタムクレーム */
  claims: AdminClaims;
  /** リクエスト元IP */
  clientIp?: string;
  /** MFA検証済みフラグ */
  mfaVerified: boolean;
}

/**
 * 新しい管理者ロール（チケット041）を使用した認証検証
 *
 * 1. IDトークン検証
 * 2. 管理者カスタムクレーム（role）検証
 * 3. ロールレベル検証
 * 4. IPアドレス検証
 * 5. MFA検証
 * 6. クレーム有効期限検証
 *
 * @param request - Callable リクエスト
 * @param requiredRole - 必要なロール（オプション）
 * @param options - 追加オプション
 * @returns 管理者認証コンテキスト
 */
export async function verifyAdminAuth(
  request: CallableRequest,
  requiredRole?: AdminRole,
  options?: {
    skipIpCheck?: boolean;
    skipMfaCheck?: boolean;
  },
): Promise<AdminAuthContext> {
  // 1. 認証チェック
  if (!request.auth) {
    logger.warn("Admin auth failed: No auth token");
    throw new AuthorizationError("認証が必要です");
  }

  const decodedToken = request.auth.token;
  const uid = request.auth.uid;

  // 2. 管理者クレーム検証
  const role = decodedToken.role as AdminRole | undefined;

  if (!role || !isValidAdminRole(role)) {
    logger.warn("Admin auth failed: Not an admin", { userId: uid });
    await sendSecurityAlert({
      type: "INVALID_ROLE",
      userId: uid,
      details: { attemptedRole: role },
    });
    throw new AuthorizationError("管理者権限がありません");
  }

  // 3. ロールレベル検証
  if (requiredRole && !hasRequiredAdminRole(role, requiredRole)) {
    logger.warn("Admin auth failed: Insufficient role", {
      userId: uid,
      currentRole: role,
      requiredRole,
    });
    throw new AuthorizationError(`この操作には${requiredRole}権限が必要です`);
  }

  // 4. クレーム有効期限検証
  const expiresAt = decodedToken.expiresAt as number | undefined;
  if (isClaimsExpired(expiresAt)) {
    logger.warn("Admin auth failed: Claims expired", { userId: uid });
    await sendSecurityAlert({
      type: "CLAIMS_EXPIRED",
      userId: uid,
    });
    throw new AuthorizationError("管理者権限の有効期限が切れています。再認証が必要です");
  }

  // 5. IPアドレス検証
  const clientIp = extractIpFromRequest(request.rawRequest as {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  });

  if (!options?.skipIpCheck) {
    const ipResult = await isAllowedIp(clientIp);
    if (!ipResult.allowed) {
      logger.security({
        eventType: "UNAUTHORIZED_IP_ACCESS",
        severity: "high",
        description: "Admin access from unauthorized IP",
        sourceIp: clientIp,
        indicators: { userId: uid, role },
      });
      await sendSecurityAlert({
        type: "UNAUTHORIZED_IP_ACCESS",
        userId: uid,
        ip: clientIp,
      });
      throw new AuthorizationError(
        ipResult.errorMessage || "このIPアドレスからのアクセスは許可されていません",
      );
    }
  }

  // 6. MFA検証
  let mfaVerified = decodedToken.mfaVerified as boolean || false;

  if (!options?.skipMfaCheck) {
    const mfaResult = await verifyMfaStatus(uid);
    if (!mfaResult.enrolled) {
      logger.warn("Admin auth failed: MFA not enrolled", { userId: uid });
      await sendSecurityAlert({
        type: "MFA_NOT_ENROLLED",
        userId: uid,
      });
      throw new AuthorizationError("多要素認証（MFA）の設定が必要です");
    }
    mfaVerified = mfaResult.verified;
  }

  // 認証成功
  const permissions = getPermissionsForRole(role);
  const adminUser: AdminUser = {
    uid,
    role,
    permissions,
    email: decodedToken.email,
    displayName: decodedToken.name,
  };

  const claims: AdminClaims = {
    role,
    permissions,
    mfaVerified,
    lastLoginAt: decodedToken.auth_time ? decodedToken.auth_time * 1000 : Date.now(),
    expiresAt,
  };

  logger.info("Admin auth verified", {
    userId: uid,
    role,
    clientIp,
    mfaVerified,
  });

  return {
    adminUser,
    claims,
    clientIp,
    mfaVerified,
  };
}

/**
 * 管理者認証を要求するラッパー関数
 *
 * 簡易的に管理者認証を要求する場合に使用
 *
 * @param request - Callable リクエスト
 * @param requiredRole - 必要なロール（オプション）
 * @returns 管理者ユーザー情報
 */
export async function requireAdminRole(
  request: CallableRequest,
  requiredRole?: AdminRole,
): Promise<AdminUser> {
  const context = await verifyAdminAuth(request, requiredRole);
  return context.adminUser;
}

/**
 * superAdmin権限を要求
 *
 * @param request - Callable リクエスト
 * @returns 管理者認証コンテキスト
 */
export async function requireSuperAdmin(request: CallableRequest): Promise<AdminAuthContext> {
  return verifyAdminAuth(request, "superAdmin");
}

/**
 * admin以上の権限を要求
 *
 * @param request - Callable リクエスト
 * @returns 管理者認証コンテキスト
 */
export async function requireAdminOrAbove(request: CallableRequest): Promise<AdminAuthContext> {
  return verifyAdminAuth(request, "admin");
}

/**
 * readOnlyAdmin以上の権限を要求（読み取り専用操作用）
 *
 * @param request - Callable リクエスト
 * @returns 管理者認証コンテキスト
 */
export async function requireReadOnlyAdminOrAbove(
  request: CallableRequest,
): Promise<AdminAuthContext> {
  return verifyAdminAuth(request, "readOnlyAdmin");
}

/**
 * 特定の権限を要求
 *
 * @param request - Callable リクエスト
 * @param permission - 必要な権限
 * @returns 管理者認証コンテキスト
 */
export async function requireAdminPermission(
  request: CallableRequest,
  permission: AdminPermissionType,
): Promise<AdminAuthContext> {
  const context = await verifyAdminAuth(request);

  if (!context.adminUser.permissions.includes(permission)) {
    logger.warn("Admin permission denied", {
      userId: context.adminUser.uid,
      role: context.adminUser.role,
      requiredPermission: permission,
    });
    throw new AuthorizationError(
      `この操作には「${permission}」権限が必要です`,
    );
  }

  return context;
}

/**
 * 管理者操作を実行し、監査ログを記録（新ロール対応）
 *
 * @param context - 管理者認証コンテキスト
 * @param action - 操作タイプ
 * @param params - 操作パラメータ
 * @param operation - 実行する操作関数
 * @returns 操作結果
 */
export async function executeAdminAuthAction<T>(
  context: AdminAuthContext,
  action: import("../types/admin").AdminAuditAction,
  params: {
    targetUserId?: string;
    details: Record<string, unknown>;
  },
  operation: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  logger.info("Admin action started (new auth)", {
    adminId: context.adminUser.uid,
    role: context.adminUser.role,
    action,
    targetUserId: params.targetUserId,
  });

  try {
    const result = await operation();

    // 成功の監査ログを記録
    await logAdminAuthAction({
      performedBy: context.adminUser.uid,
      performerRole: context.adminUser.role,
      performerIp: context.clientIp,
      action,
      targetUserId: params.targetUserId,
      details: {
        ...params.details,
        durationMs: Date.now() - startTime,
      },
      success: true,
    });

    logger.info("Admin action completed (new auth)", {
      adminId: context.adminUser.uid,
      action,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // 失敗の監査ログを記録
    await logAdminAuthAction({
      performedBy: context.adminUser.uid,
      performerRole: context.adminUser.role,
      performerIp: context.clientIp,
      action,
      targetUserId: params.targetUserId,
      details: {
        ...params.details,
        durationMs: Date.now() - startTime,
      },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    logger.error("Admin action failed (new auth)", error as Error, {
      adminId: context.adminUser.uid,
      action,
    });

    throw error;
  }
}
