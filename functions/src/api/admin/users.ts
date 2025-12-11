/**
 * 管理者ユーザー管理API
 *
 * ユーザー一覧取得、詳細取得、停止/復帰、検索機能を提供
 *
 * チケット042: ユーザー管理API
 * チケット043: ユーザー検索API
 *
 * @version 1.0.0
 * @date 2025-12-11
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
  AdminUserSummary,
  AdminUserDetail,
  ListUsersRequest,
  ListUsersResponse,
  GetUserDetailRequest,
  GetUserDetailResponse,
  SuspendUserRequest,
  SuspendUserResponse,
  RestoreUserRequest,
  RestoreUserResponse,
  SearchUsersRequest,
  SearchUsersResponse,
  SearchByEmailRequest,
  SearchByUidRequest,
  SearchByNameRequest,
  UserStatus,
  UserPlan,
} from "../../types/admin";
import { SuccessResponse } from "../../types/api";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// =============================================================================
// 定数
// =============================================================================

/** デフォルト取得件数 */
const DEFAULT_LIMIT = 20;
/** 最大取得件数 */
const MAX_LIMIT = 100;

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * ユーザー状態を判定
 */
function getUserStatus(userData: admin.firestore.DocumentData): UserStatus {
  if (userData.suspended) {
    return "suspended";
  }
  if (userData.deletionScheduled) {
    return "deletionScheduled";
  }
  return "active";
}

/**
 * ユーザープランを判定
 */
function getUserPlan(userData: admin.firestore.DocumentData): UserPlan {
  return userData.subscriptionStatus === "active" ||
    userData.plan === "premium"
    ? "premium"
    : "free";
}

/**
 * Firestoreタイムスタンプを ISO8601文字列に変換
 */
function timestampToISOString(
  timestamp: admin.firestore.Timestamp | undefined | null,
): string | null {
  if (!timestamp || !timestamp.toDate) {
    return null;
  }
  return timestamp.toDate().toISOString();
}

/**
 * FirestoreデータをAdminUserSummaryに変換
 */
async function toAdminUserSummary(
  userId: string,
  userData: admin.firestore.DocumentData,
): Promise<AdminUserSummary> {
  // Retrieve session count
  const sessionsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("sessions")
    .count()
    .get();

  // Type-safe access to document data
  const email = typeof userData.email === "string" ? userData.email : "";
  const displayName =
    typeof userData.displayName === "string" ? userData.displayName :
      typeof userData.nickname === "string" ? userData.nickname : null;
  const createdAt = userData.createdAt as admin.firestore.Timestamp | undefined;
  const lastLoginAt = userData.lastLoginAt as admin.firestore.Timestamp | undefined;

  return {
    userId,
    email,
    displayName,
    status: getUserStatus(userData),
    plan: getUserPlan(userData),
    createdAt: timestampToISOString(createdAt) || new Date().toISOString(),
    lastLoginAt: timestampToISOString(lastLoginAt),
    sessionCount: sessionsSnapshot.data().count,
  };
}

/**
 * FirestoreデータをAdminUserDetailに変換
 */
async function toAdminUserDetail(
  userId: string,
  userData: admin.firestore.DocumentData,
): Promise<AdminUserDetail> {
  const summary = await toAdminUserSummary(userId, userData);

  // Get Firebase Auth metadata
  let authMetadata: AdminUserDetail["authMetadata"];
  try {
    const userRecord = await auth.getUser(userId);
    authMetadata = {
      emailVerified: userRecord.emailVerified,
      providers: userRecord.providerData.map((p) => p.providerId),
      disabled: userRecord.disabled,
    };
  } catch (error) {
    logger.warn("Failed to get auth metadata", { userId, error });
  }

  // Type-safe access to optional fields
  const nickname = typeof userData.nickname === "string" ? userData.nickname : null;
  const birthYear = typeof userData.birthYear === "number" ? userData.birthYear : undefined;
  const gender = typeof userData.gender === "string" ? userData.gender : undefined;
  const height = typeof userData.height === "number" ? userData.height : undefined;
  const weight = typeof userData.weight === "number" ? userData.weight : undefined;
  const fitnessLevel = typeof userData.fitnessLevel === "string" ? userData.fitnessLevel : undefined;
  const suspendReason = typeof userData.suspendReason === "string" ? userData.suspendReason : undefined;
  const suspendedAt = userData.suspendedAt as admin.firestore.Timestamp | undefined;
  const scheduledDeletionDate = userData.scheduledDeletionDate as admin.firestore.Timestamp | undefined;
  const updatedAt = userData.updatedAt as admin.firestore.Timestamp | undefined;

  return {
    ...summary,
    nickname,
    birthYear,
    gender,
    height,
    weight,
    fitnessLevel,
    tosAccepted: userData.tosAccepted === true,
    ppAccepted: userData.ppAccepted === true,
    suspendReason,
    suspendedAt: timestampToISOString(suspendedAt) || undefined,
    scheduledDeletionDate: timestampToISOString(scheduledDeletionDate) || undefined,
    updatedAt: timestampToISOString(updatedAt) || new Date().toISOString(),
    authMetadata,
  };
}

/**
 * 取得件数を検証
 */
function validateLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > MAX_LIMIT) {
    return MAX_LIMIT;
  }
  return Math.floor(limit);
}

// =============================================================================
// ユーザー管理API（チケット042）
// =============================================================================

/**
 * ユーザー一覧取得
 *
 * ページネーション付きでユーザー一覧を取得
 * 管理者権限（view_user_data）が必要
 */
export const admin_listUsers = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListUsersResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as ListUsersRequest;
    const limit = validateLimit(data.limit);
    const sortBy = data.sortBy || "createdAt";
    const sortOrder = data.sortOrder || "desc";

    logger.info("Admin listing users", {
      adminId: request.auth!.uid,
      limit,
      sortBy,
      sortOrder,
      status: data.status,
      plan: data.plan,
    });

    try {
      // Build query
      let query: admin.firestore.Query = db.collection("users");

      // Apply status filter
      if (data.status) {
        if (data.status === "suspended") {
          query = query.where("suspended", "==", true);
        } else if (data.status === "deletionScheduled") {
          query = query.where("deletionScheduled", "==", true);
        } else if (data.status === "active") {
          query = query
            .where("suspended", "==", false)
            .where("deletionScheduled", "==", false);
        }
      }

      // Apply plan filter
      if (data.plan) {
        if (data.plan === "premium") {
          query = query.where("subscriptionStatus", "==", "active");
        }
        // free is default, no filter needed
      }

      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);

      // Apply cursor for pagination
      if (data.cursor) {
        const cursorDoc = await db.collection("users").doc(data.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      // Apply limit + 1 to check for more results
      query = query.limit(limit + 1);

      // Execute query
      const snapshot = await query.get();

      // Get total count (separate query for accurate count)
      const totalSnapshot = await db.collection("users").count().get();
      const totalCount = totalSnapshot.data().count;

      // Build response
      const users: AdminUserSummary[] = [];
      let nextCursor: string | undefined;

      const docs = snapshot.docs;
      const hasMore = docs.length > limit;

      for (let i = 0; i < Math.min(docs.length, limit); i++) {
        const doc = docs[i];
        const userData = doc.data();
        users.push(await toAdminUserSummary(doc.id, userData));
      }

      if (hasMore && docs.length > limit) {
        nextCursor = docs[limit - 1].id;
      }

      logger.info("Admin users listed successfully", {
        adminId: request.auth!.uid,
        count: users.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          users,
          nextCursor,
          totalCount,
          limit,
        },
      };
    } catch (error) {
      logger.error("Failed to list users", error as Error, {
        adminId: request.auth!.uid,
      });
      throw new HttpsError("internal", "ユーザー一覧の取得に失敗しました");
    }
  },
);

/**
 * ユーザー詳細取得
 *
 * 指定したユーザーの詳細情報を取得
 * 管理者権限（view_user_data）が必要
 */
export const admin_getUserDetail = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetUserDetailResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as GetUserDetailRequest;

    if (!data.userId) {
      throw new ValidationError("userIdは必須です");
    }

    const adminId = request.auth!.uid;

    logger.info("Admin getting user detail", {
      adminId,
      targetUserId: data.userId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: data.userId,
        action: "view_user_data",
        reason: "ユーザー詳細取得",
      },
      async () => {
        // Fetch user document
        const userDoc = await db.collection("users").doc(data.userId).get();

        if (!userDoc.exists) {
          throw new NotFoundError("ユーザー", data.userId);
        }

        const userData = userDoc.data()!;
        const user = await toAdminUserDetail(data.userId, userData);

        logger.info("Admin user detail retrieved successfully", {
          adminId,
          targetUserId: data.userId,
        });

        return {
          success: true as const,
          data: { user },
        };
      },
    );
  },
);

/**
 * ユーザー停止
 *
 * 指定したユーザーを停止状態にする
 * 管理者権限（suspend_user）が必要
 */
export const admin_suspendUser = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SuspendUserResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "suspend_user");

    const data = request.data as SuspendUserRequest;

    if (!data.userId) {
      throw new ValidationError("userIdは必須です");
    }
    if (!data.reason || data.reason.trim().length === 0) {
      throw new ValidationError("停止理由は必須です");
    }

    const adminId = request.auth!.uid;
    const notifyUser = data.notifyUser !== false; // Default: true

    logger.info("Admin suspending user", {
      adminId,
      targetUserId: data.userId,
      reason: data.reason,
      notifyUser,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: data.userId,
        action: "suspend_user",
        reason: data.reason,
        metadata: { notifyUser },
      },
      async () => {
        // Check if user exists
        const userDoc = await db.collection("users").doc(data.userId).get();

        if (!userDoc.exists) {
          throw new NotFoundError("ユーザー", data.userId);
        }

        const userData = userDoc.data()!;

        // Check if already suspended
        if (userData.suspended) {
          throw new HttpsError(
            "failed-precondition",
            "このユーザーは既に停止されています",
          );
        }

        const suspendedAt = new Date();

        // Update Firestore
        await db
          .collection("users")
          .doc(data.userId)
          .update({
            suspended: true,
            suspendReason: data.reason,
            suspendedAt: admin.firestore.Timestamp.fromDate(suspendedAt),
            suspendedBy: adminId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        // Disable Firebase Auth account
        await auth.updateUser(data.userId, { disabled: true });

        // Revoke refresh tokens to force logout
        await auth.revokeRefreshTokens(data.userId);

        // TODO: Send notification email if notifyUser is true
        if (notifyUser) {
          logger.info("User suspension notification should be sent", {
            targetUserId: data.userId,
          });
        }

        logger.info("User suspended successfully", {
          adminId,
          targetUserId: data.userId,
          suspendedAt: suspendedAt.toISOString(),
        });

        return {
          success: true as const,
          data: {
            userId: data.userId,
            suspendedAt: suspendedAt.toISOString(),
            message: "ユーザーを停止しました",
          },
        };
      },
    );
  },
);

/**
 * ユーザー復帰
 *
 * 停止状態のユーザーを復帰させる
 * 管理者権限（restore_user）が必要
 */
export const admin_restoreUser = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<RestoreUserResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "restore_user");

    const data = request.data as RestoreUserRequest;

    if (!data.userId) {
      throw new ValidationError("userIdは必須です");
    }
    if (!data.reason || data.reason.trim().length === 0) {
      throw new ValidationError("復帰理由は必須です");
    }

    const adminId = request.auth!.uid;
    const notifyUser = data.notifyUser !== false; // Default: true

    logger.info("Admin restoring user", {
      adminId,
      targetUserId: data.userId,
      reason: data.reason,
      notifyUser,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: data.userId,
        action: "restore_user",
        reason: data.reason,
        metadata: { notifyUser },
      },
      async () => {
        // Check if user exists
        const userDoc = await db.collection("users").doc(data.userId).get();

        if (!userDoc.exists) {
          throw new NotFoundError("ユーザー", data.userId);
        }

        const userData = userDoc.data()!;

        // Check if user is suspended
        if (!userData.suspended) {
          throw new HttpsError(
            "failed-precondition",
            "このユーザーは停止されていません",
          );
        }

        const restoredAt = new Date();

        // Update Firestore
        await db
          .collection("users")
          .doc(data.userId)
          .update({
            suspended: false,
            suspendReason: admin.firestore.FieldValue.delete(),
            suspendedAt: admin.firestore.FieldValue.delete(),
            suspendedBy: admin.firestore.FieldValue.delete(),
            restoredAt: admin.firestore.Timestamp.fromDate(restoredAt),
            restoredBy: adminId,
            restoreReason: data.reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        // Re-enable Firebase Auth account
        await auth.updateUser(data.userId, { disabled: false });

        // TODO: Send notification email if notifyUser is true
        if (notifyUser) {
          logger.info("User restoration notification should be sent", {
            targetUserId: data.userId,
          });
        }

        logger.info("User restored successfully", {
          adminId,
          targetUserId: data.userId,
          restoredAt: restoredAt.toISOString(),
        });

        return {
          success: true as const,
          data: {
            userId: data.userId,
            restoredAt: restoredAt.toISOString(),
            message: "ユーザーを復帰しました",
          },
        };
      },
    );
  },
);

// =============================================================================
// ユーザー検索API（チケット043）
// =============================================================================

/**
 * メールアドレス検索
 *
 * メールアドレスでユーザーを検索（完全一致/部分一致）
 * 管理者権限（view_user_data）が必要
 */
export const admin_searchUsersByEmail = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SearchUsersResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as SearchByEmailRequest;

    if (!data.email || data.email.trim().length === 0) {
      throw new ValidationError("emailは必須です");
    }

    const email = data.email.toLowerCase().trim();
    const exactMatch = data.exactMatch === true;
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin searching users by email", {
      adminId,
      email: exactMatch ? "[EXACT]" : "[PARTIAL]",
      exactMatch,
    });

    try {
      const users: AdminUserSummary[] = [];

      if (exactMatch) {
        // Exact match: use Firebase Auth
        try {
          const userRecord = await auth.getUserByEmail(email);
          const userDoc = await db
            .collection("users")
            .doc(userRecord.uid)
            .get();

          if (userDoc.exists) {
            users.push(
              await toAdminUserSummary(userRecord.uid, userDoc.data()!),
            );
          }
        } catch (error) {
          // User not found is not an error for search
          logger.debug("User not found by email", { email });
        }
      } else {
        // Partial match: use Firestore query
        // Note: Firestore doesn't support LIKE queries, so we use range queries
        const snapshot = await db
          .collection("users")
          .where("email", ">=", email)
          .where("email", "<=", email + "\uf8ff")
          .limit(limit)
          .get();

        for (const doc of snapshot.docs) {
          users.push(await toAdminUserSummary(doc.id, doc.data()));
        }
      }

      logger.info("Email search completed", {
        adminId,
        resultCount: users.length,
      });

      return {
        success: true,
        data: {
          users,
          resultCount: users.length,
          query: {
            email,
            exactMatch,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to search users by email", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "メール検索に失敗しました");
    }
  },
);

/**
 * UID検索
 *
 * ユーザーIDでユーザーを検索（完全一致）
 * 管理者権限（view_user_data）が必要
 */
export const admin_searchUsersByUid = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SearchUsersResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as SearchByUidRequest;

    if (!data.userId || data.userId.trim().length === 0) {
      throw new ValidationError("userIdは必須です");
    }

    const userId = data.userId.trim();
    const adminId = request.auth!.uid;

    logger.info("Admin searching user by UID", {
      adminId,
      targetUserId: userId,
    });

    try {
      const users: AdminUserSummary[] = [];

      const userDoc = await db.collection("users").doc(userId).get();

      if (userDoc.exists) {
        users.push(await toAdminUserSummary(userId, userDoc.data()!));
      }

      logger.info("UID search completed", {
        adminId,
        found: users.length > 0,
      });

      return {
        success: true,
        data: {
          users,
          resultCount: users.length,
          query: {
            userId,
            exactMatch: true,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to search user by UID", error as Error, {
        adminId,
        targetUserId: userId,
      });
      throw new HttpsError("internal", "UID検索に失敗しました");
    }
  },
);

/**
 * 名前検索
 *
 * 表示名でユーザーを検索（部分一致）
 * 管理者権限（view_user_data）が必要
 */
export const admin_searchUsersByName = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SearchUsersResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as SearchByNameRequest;

    if (!data.displayName || data.displayName.trim().length === 0) {
      throw new ValidationError("displayNameは必須です");
    }

    const displayName = data.displayName.trim();
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin searching users by name", {
      adminId,
      displayName: "[SEARCH]",
    });

    try {
      const users: AdminUserSummary[] = [];

      // Search by displayName
      let query: admin.firestore.Query = db
        .collection("users")
        .where("displayName", ">=", displayName)
        .where("displayName", "<=", displayName + "\uf8ff")
        .limit(limit);

      if (data.cursor) {
        const cursorDoc = await db.collection("users").doc(data.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const displayNameSnapshot = await query.get();

      for (const doc of displayNameSnapshot.docs) {
        users.push(await toAdminUserSummary(doc.id, doc.data()));
      }

      // Also search by nickname if results are less than limit
      if (users.length < limit) {
        const nicknameQuery = db
          .collection("users")
          .where("nickname", ">=", displayName)
          .where("nickname", "<=", displayName + "\uf8ff")
          .limit(limit - users.length);

        const nicknameSnapshot = await nicknameQuery.get();

        for (const doc of nicknameSnapshot.docs) {
          // Avoid duplicates
          if (!users.some((u) => u.userId === doc.id)) {
            users.push(await toAdminUserSummary(doc.id, doc.data()));
          }
        }
      }

      // Determine next cursor
      let nextCursor: string | undefined;
      if (users.length === limit) {
        nextCursor = users[users.length - 1].userId;
      }

      logger.info("Name search completed", {
        adminId,
        resultCount: users.length,
      });

      return {
        success: true,
        data: {
          users,
          nextCursor,
          resultCount: users.length,
          query: {
            displayName,
            exactMatch: false,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to search users by name", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "名前検索に失敗しました");
    }
  },
);

/**
 * 複合検索
 *
 * 複数の条件でユーザーを検索
 * 管理者権限（view_user_data）が必要
 */
export const admin_searchUsers = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SearchUsersResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_user_data");

    const data = request.data as SearchUsersRequest;

    // At least one search criteria required
    if (!data.email && !data.userId && !data.displayName) {
      throw new ValidationError(
        "検索条件（email、userId、displayName）のいずれかを指定してください",
      );
    }

    const exactMatch = data.exactMatch === true;
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin performing complex search", {
      adminId,
      hasEmail: !!data.email,
      hasUserId: !!data.userId,
      hasDisplayName: !!data.displayName,
      exactMatch,
    });

    try {
      const users: AdminUserSummary[] = [];
      const userIds = new Set<string>();

      // Search by userId first (most specific)
      if (data.userId) {
        const userDoc = await db
          .collection("users")
          .doc(data.userId.trim())
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data()!;

          // Check other conditions if specified
          let matches = true;

          if (data.email && exactMatch) {
            matches =
              matches && userData.email?.toLowerCase() === data.email.toLowerCase();
          } else if (data.email) {
            matches =
              matches && userData.email?.toLowerCase().includes(data.email.toLowerCase());
          }

          if (data.displayName && exactMatch) {
            matches =
              matches &&
              (userData.displayName === data.displayName ||
                userData.nickname === data.displayName);
          } else if (data.displayName) {
            matches =
              matches &&
              (userData.displayName
                ?.toLowerCase()
                .includes(data.displayName.toLowerCase()) ||
                userData.nickname
                  ?.toLowerCase()
                  .includes(data.displayName.toLowerCase()));
          }

          if (matches) {
            users.push(await toAdminUserSummary(userDoc.id, userData));
            userIds.add(userDoc.id);
          }
        }
      }

      // Search by email
      if (data.email && users.length < limit) {
        const email = data.email.toLowerCase().trim();

        if (exactMatch) {
          try {
            const userRecord = await auth.getUserByEmail(email);
            if (!userIds.has(userRecord.uid)) {
              const userDoc = await db
                .collection("users")
                .doc(userRecord.uid)
                .get();

              if (userDoc.exists) {
                users.push(
                  await toAdminUserSummary(userRecord.uid, userDoc.data()!),
                );
                userIds.add(userRecord.uid);
              }
            }
          } catch {
            // User not found
          }
        } else {
          const snapshot = await db
            .collection("users")
            .where("email", ">=", email)
            .where("email", "<=", email + "\uf8ff")
            .limit(limit - users.length)
            .get();

          for (const doc of snapshot.docs) {
            if (!userIds.has(doc.id)) {
              users.push(await toAdminUserSummary(doc.id, doc.data()));
              userIds.add(doc.id);
            }
          }
        }
      }

      // Search by displayName
      if (data.displayName && users.length < limit) {
        const displayName = data.displayName.trim();

        const snapshot = await db
          .collection("users")
          .where("displayName", ">=", displayName)
          .where("displayName", "<=", displayName + "\uf8ff")
          .limit(limit - users.length)
          .get();

        for (const doc of snapshot.docs) {
          if (!userIds.has(doc.id)) {
            users.push(await toAdminUserSummary(doc.id, doc.data()));
            userIds.add(doc.id);
          }
        }

        // Also search by nickname
        if (users.length < limit) {
          const nicknameSnapshot = await db
            .collection("users")
            .where("nickname", ">=", displayName)
            .where("nickname", "<=", displayName + "\uf8ff")
            .limit(limit - users.length)
            .get();

          for (const doc of nicknameSnapshot.docs) {
            if (!userIds.has(doc.id)) {
              users.push(await toAdminUserSummary(doc.id, doc.data()));
              userIds.add(doc.id);
            }
          }
        }
      }

      // Determine next cursor
      let nextCursor: string | undefined;
      if (users.length === limit && data.cursor) {
        nextCursor = users[users.length - 1].userId;
      }

      logger.info("Complex search completed", {
        adminId,
        resultCount: users.length,
      });

      return {
        success: true,
        data: {
          users,
          nextCursor,
          resultCount: users.length,
          query: {
            email: data.email,
            userId: data.userId,
            displayName: data.displayName,
            exactMatch,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to perform complex search", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "検索に失敗しました");
    }
  },
);
