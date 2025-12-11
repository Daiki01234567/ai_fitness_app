/**
 * 管理者認証API
 *
 * 管理者カスタムクレームの設定・削除、管理者一覧取得、IPアドレス許可リスト更新
 *
 * 参照: docs/common/tickets/041-admin-auth.md
 *
 * @version 1.0.0
 * @date 2025-12-11
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import {
  requireSuperAdmin,
  requireAdminOrAbove,
  executeAdminAuthAction,
} from "../../middleware/adminAuth";
import {
  AdminRole,
  SetAdminClaimsRequest,
  SetAdminClaimsResponse,
  RevokeAdminClaimsRequest,
  RevokeAdminClaimsResponse,
  ListAdminUsersRequest,
  ListAdminUsersResponse,
  AdminListItem,
  UpdateIpAllowlistRequest,
  UpdateIpAllowlistResponse,
  ADMIN_AUTH_CONSTANTS,
  IpAllowlistDocument,
} from "../../types/admin";
import {
  getPermissionsForRole,
  calculateClaimsExpiration,
  isValidIpAddress,
  isValidCidr,
} from "../../utils/adminUtils";
import { ValidationError } from "../../utils/errors";
import { getFirestore } from "../../utils/firestore";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// =============================================================================
// 管理者クレーム設定API
// =============================================================================

/**
 * 管理者カスタムクレームを設定する
 *
 * superAdminのみが実行可能
 * 対象ユーザーに管理者ロールと権限を付与
 *
 * @param request - SetAdminClaimsRequest
 * @returns SetAdminClaimsResponse
 */
export const admin_setAdminClaims = onCall<SetAdminClaimsRequest>(
  {
    region: "asia-northeast1",
    memory: "256MiB",
  },
  async (request): Promise<SetAdminClaimsResponse> => {
    // superAdmin権限を要求
    const context = await requireSuperAdmin(request);

    const { targetUserId, role, expirationDays } = request.data;

    // バリデーション
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new ValidationError("対象ユーザーIDが必要です");
    }

    if (!role || !["superAdmin", "admin", "readOnlyAdmin"].includes(role)) {
      throw new ValidationError("有効なロール（superAdmin, admin, readOnlyAdmin）を指定してください");
    }

    // 自分自身への操作は禁止
    if (targetUserId === context.adminUser.uid) {
      throw new HttpsError("permission-denied", "自分自身の管理者権限は変更できません");
    }

    // 対象ユーザーの存在確認
    try {
      await admin.auth().getUser(targetUserId);
    } catch {
      throw new HttpsError("not-found", "対象ユーザーが見つかりません");
    }

    return executeAdminAuthAction(
      context,
      "SET_ADMIN_CLAIMS",
      {
        targetUserId,
        details: { role, expirationDays },
      },
      async () => {
        // 権限リストを取得
        const permissions = getPermissionsForRole(role);

        // 有効期限を計算
        const expiresAt = calculateClaimsExpiration(expirationDays);

        // 既存のクレームを取得
        const user = await admin.auth().getUser(targetUserId);
        const currentClaims = user.customClaims || {};

        // 新しいクレームを設定
        const newClaims = {
          ...currentClaims,
          role,
          permissions,
          mfaVerified: false, // MFA検証はログイン時に更新
          lastLoginAt: Date.now(),
          expiresAt,
        };

        await admin.auth().setCustomUserClaims(targetUserId, newClaims);

        // Firestoreにも記録
        await db.collection(ADMIN_AUTH_CONSTANTS.ADMIN_USERS_COLLECTION).doc(targetUserId).set(
          {
            userId: targetUserId,
            role,
            permissions,
            expiresAt,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: context.adminUser.uid,
          },
          { merge: true },
        );

        logger.info("Admin claims set", {
          targetUserId,
          role,
          permissions,
          performedBy: context.adminUser.uid,
        });

        return {
          success: true,
          role: role,
          permissions,
          message: `${targetUserId}に${role}権限を付与しました`,
        };
      },
    );
  },
);

// =============================================================================
// 管理者クレーム削除API
// =============================================================================

/**
 * 管理者カスタムクレームを削除する
 *
 * superAdminのみが実行可能
 * 対象ユーザーから管理者権限を削除
 *
 * @param request - RevokeAdminClaimsRequest
 * @returns RevokeAdminClaimsResponse
 */
export const admin_revokeAdminClaims = onCall<RevokeAdminClaimsRequest>(
  {
    region: "asia-northeast1",
    memory: "256MiB",
  },
  async (request): Promise<RevokeAdminClaimsResponse> => {
    // superAdmin権限を要求
    const context = await requireSuperAdmin(request);

    const { targetUserId, reason } = request.data;

    // バリデーション
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new ValidationError("対象ユーザーIDが必要です");
    }

    if (!reason || typeof reason !== "string" || reason.length < 10) {
      throw new ValidationError("削除理由を10文字以上で入力してください");
    }

    // 自分自身への操作は禁止
    if (targetUserId === context.adminUser.uid) {
      throw new HttpsError("permission-denied", "自分自身の管理者権限は削除できません");
    }

    return executeAdminAuthAction(
      context,
      "REVOKE_ADMIN_CLAIMS",
      {
        targetUserId,
        details: { reason },
      },
      async () => {
        // 既存のクレームを取得
        const user = await admin.auth().getUser(targetUserId);
        const currentClaims = user.customClaims || {};

        // 管理者関連のクレームを削除
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { role, permissions, mfaVerified, lastLoginAt, expiresAt, ...otherClaims } =
          currentClaims as Record<string, unknown>;

        await admin.auth().setCustomUserClaims(targetUserId, otherClaims);

        // Firestoreからも削除
        await db.collection(ADMIN_AUTH_CONSTANTS.ADMIN_USERS_COLLECTION).doc(targetUserId).delete();

        logger.security("Admin claims revoked", {
          targetUserId,
          reason,
          performedBy: context.adminUser.uid,
        });

        return {
          success: true,
          message: `${targetUserId}の管理者権限を削除しました`,
        };
      },
    );
  },
);

// =============================================================================
// 管理者一覧取得API
// =============================================================================

/**
 * 管理者一覧を取得する
 *
 * admin以上の権限で実行可能
 *
 * @param request - ListAdminUsersRequest
 * @returns ListAdminUsersResponse
 */
export const admin_listAdmins = onCall<ListAdminUsersRequest>(
  {
    region: "asia-northeast1",
    memory: "256MiB",
  },
  async (request): Promise<ListAdminUsersResponse> => {
    // admin以上の権限を要求
    await requireAdminOrAbove(request);

    const { role: filterRole, limit = ADMIN_AUTH_CONSTANTS.DEFAULT_LIST_LIMIT } = request.data || {};

    // 取得件数の制限
    const actualLimit = Math.min(limit, ADMIN_AUTH_CONSTANTS.MAX_LIST_LIMIT);

    const admins: AdminListItem[] = [];
    let totalCount = 0;
    let pageToken: string | undefined;

    do {
      const listResult = await admin.auth().listUsers(1000, pageToken);

      for (const user of listResult.users) {
        const claims = user.customClaims || {};
        const userRole = claims.role as AdminRole | undefined;

        // 管理者ロールを持っているかチェック
        if (!userRole || !["superAdmin", "admin", "readOnlyAdmin"].includes(userRole)) {
          continue;
        }

        // ロールでフィルタ
        if (filterRole && userRole !== filterRole) {
          continue;
        }

        totalCount++;

        // 制限に達したら追加しない
        if (admins.length >= actualLimit) {
          continue;
        }

        // MFA設定状況を確認
        const mfaEnrolled = (user.multiFactor?.enrolledFactors?.length ?? 0) > 0;

        admins.push({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: userRole,
          mfaEnrolled,
          lastLoginAt: claims.lastLoginAt as number | undefined,
          createdAt: user.metadata.creationTime,
        });
      }

      pageToken = listResult.pageToken;
    } while (pageToken);

    logger.info("Admin list retrieved", {
      count: admins.length,
      totalCount,
      filterRole,
    });

    return {
      admins,
      totalCount,
    };
  },
);

// =============================================================================
// IPアドレス許可リスト更新API
// =============================================================================

/**
 * IPアドレス許可リストを更新する
 *
 * superAdminのみが実行可能
 *
 * @param request - UpdateIpAllowlistRequest
 * @returns UpdateIpAllowlistResponse
 */
export const admin_updateIpAllowlist = onCall<UpdateIpAllowlistRequest>(
  {
    region: "asia-northeast1",
    memory: "256MiB",
  },
  async (request): Promise<UpdateIpAllowlistResponse> => {
    // superAdmin権限を要求
    const context = await requireSuperAdmin(request);

    const { allowedIps, allowedCidrs, enabled } = request.data;

    // バリデーション
    if (!Array.isArray(allowedIps)) {
      throw new ValidationError("許可IPアドレスリストは配列である必要があります");
    }

    if (!Array.isArray(allowedCidrs)) {
      throw new ValidationError("許可CIDRリストは配列である必要があります");
    }

    // IPアドレス形式の検証
    for (const ip of allowedIps) {
      if (!isValidIpAddress(ip)) {
        throw new ValidationError(`無効なIPアドレス形式: ${ip}`);
      }
    }

    // CIDR形式の検証
    for (const cidr of allowedCidrs) {
      if (!isValidCidr(cidr)) {
        throw new ValidationError(`無効なCIDR形式: ${cidr}`);
      }
    }

    return executeAdminAuthAction(
      context,
      "UPDATE_IP_ALLOWLIST",
      {
        details: {
          allowedIps,
          allowedCidrs,
          enabled,
        },
      },
      async () => {
        const allowlistDoc: Omit<IpAllowlistDocument, "updatedAt"> & { updatedAt: FieldValue } = {
          allowedIps,
          allowedCidrs,
          enabled: enabled ?? true,
          updatedBy: context.adminUser.uid,
          updatedAt: FieldValue.serverTimestamp(),
        };

        await db.doc(ADMIN_AUTH_CONSTANTS.IP_ALLOWLIST_DOC_PATH).set(allowlistDoc);

        logger.security("IP allowlist updated", {
          allowedIpsCount: allowedIps.length,
          allowedCidrsCount: allowedCidrs.length,
          enabled,
          performedBy: context.adminUser.uid,
        });

        return {
          success: true,
          message: "IPアドレス許可リストを更新しました",
          allowlist: {
            allowedIps,
            allowedCidrs,
            enabled: enabled ?? true,
          },
        };
      },
    );
  },
);
