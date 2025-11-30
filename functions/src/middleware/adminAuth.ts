/**
 * 管理者認証ミドルウェア
 *
 * 管理者権限での代理実行チェック
 * - カスタムクレーム `admin: true` の確認
 * - 権限レベルチェック
 * - 代理実行時の追加監査ログ
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import * as admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
import { CallableRequest } from "firebase-functions/v2/https";

import { logAdminAction } from "../services/auditLog";
import {
  AdminActionType,
  AdminLevel,
  AdminPermissions,
  ADMIN_PERMISSIONS,
} from "../types/security";
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
