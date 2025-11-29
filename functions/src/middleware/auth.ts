/**
 * 認証ミドルウェア
 * Firebase Auth トークンを検証し、ユーザー権限をチェック
 */

import * as admin from "firebase-admin";
import { CallableRequest } from "firebase-functions/v2/https";

import { User } from "../types/firestore";
import {
  AuthenticationError,
  AuthorizationError,
} from "../utils/errors";
import { userRef } from "../utils/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 認証済みユーザーコンテキスト
 */
export interface AuthContext {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  claims: Record<string, unknown>;
}

/**
 * 完全なユーザーデータを持つユーザーコンテキスト
 */
export interface UserContext extends AuthContext {
  user: User & { id: string };
}

/**
 * リクエストから認証コンテキストを抽出
 */
export function getAuthContext(request: CallableRequest): AuthContext {
  if (!request.auth) {
    throw new AuthenticationError();
  }

  return {
    uid: request.auth.uid,
    email: request.auth.token.email,
    emailVerified: request.auth.token.email_verified,
    claims: request.auth.token,
  };
}

/**
 * 認証を要求
 */
export function requireAuth(request: CallableRequest): AuthContext {
  const context = getAuthContext(request);

  // 強制ログアウトをチェック
  if (context.claims.forceLogout) {
    logger.security("Force logout triggered", { userId: context.uid });
    throw AuthenticationError.sessionRevoked();
  }

  return context;
}

/**
 * ユーザーが削除予定かどうかをチェック
 */
export async function checkDeletionScheduled(uid: string): Promise<boolean> {
  const userDoc = await userRef(uid).get();

  if (!userDoc.exists) {
    return false;
  }

  return userDoc.data()?.deletionScheduled === true;
}

/**
 * 書き込み権限を要求（削除予定でないこと）
 */
export async function requireWritePermission(uid: string): Promise<void> {
  const isDeletionScheduled = await checkDeletionScheduled(uid);

  if (isDeletionScheduled) {
    logger.warn("Write attempt by deletion scheduled user", { userId: uid });
    throw AuthorizationError.deletionScheduled();
  }
}

/**
 * 認証と書き込み権限を要求
 */
export async function requireAuthWithWritePermission(
  request: CallableRequest,
): Promise<AuthContext> {
  const context = requireAuth(request);
  await requireWritePermission(context.uid);
  return context;
}

/**
 * ユーザーデータを含む完全なユーザーコンテキストを取得
 */
export async function getUserContext(request: CallableRequest): Promise<UserContext> {
  const authContext = requireAuth(request);

  const userDoc = await userRef(authContext.uid).get();

  if (!userDoc.exists) {
    logger.warn("User document not found", { userId: authContext.uid });
    throw new AuthenticationError("ユーザー情報が見つかりません");
  }

  const userData = userDoc.data() as User;

  return {
    ...authContext,
    user: { id: userDoc.id, ...userData },
  };
}

/**
 * ユーザーが必要な同意を持っているかをチェック
 */
export function requireConsent(user: User): void {
  if (!user.tosAccepted || !user.ppAccepted) {
    throw AuthorizationError.consentRequired();
  }
}

/**
 * ユーザーが管理者クレームを持っているかをチェック
 */
export function requireAdmin(context: AuthContext): void {
  if (!context.claims.admin) {
    throw new AuthorizationError("管理者権限が必要です");
  }
}

/**
 * ユーザーが特定のカスタムクレームを持っているかをチェック
 */
export function requireClaim(context: AuthContext, claimKey: string): void {
  if (!context.claims[claimKey]) {
    throw new AuthorizationError(`権限 '${claimKey}' が必要です`);
  }
}

/**
 * ユーザーにカスタムクレームを設定
 */
export async function setCustomClaims(
  uid: string,
  claims: Record<string, unknown>,
): Promise<void> {
  await admin.auth().setCustomUserClaims(uid, claims);
  logger.info("Custom claims updated", { userId: uid, claims: Object.keys(claims) });
}

/**
 * ユーザーのカスタムクレームを取得
 */
export async function getCustomClaims(uid: string): Promise<Record<string, unknown>> {
  const user = await admin.auth().getUser(uid);
  return user.customClaims ?? {};
}

/**
 * ユーザーのすべてのリフレッシュトークンを取り消す（強制ログアウト）
 */
export async function revokeRefreshTokens(uid: string): Promise<void> {
  await admin.auth().revokeRefreshTokens(uid);
  logger.security("Refresh tokens revoked", { userId: uid });
}

/**
 * 強制ログアウトクレームを設定
 */
export async function setForceLogout(uid: string): Promise<void> {
  const currentClaims = await getCustomClaims(uid);
  await setCustomClaims(uid, {
    ...currentClaims,
    forceLogout: true,
  });

  // Firestore も更新
  await userRef(uid).update({
    forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // トークンを取り消す
  await revokeRefreshTokens(uid);

  logger.security("Force logout set", { userId: uid });
}

/**
 * 強制ログアウトクレームをクリア
 */
export async function clearForceLogout(uid: string): Promise<void> {
  const currentClaims = await getCustomClaims(uid);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { forceLogout, ...remainingClaims } = currentClaims;
  await setCustomClaims(uid, remainingClaims);

  logger.info("Force logout cleared", { userId: uid });
}

/**
 * ID トークンを検証
 */
export async function verifyIdToken(
  idToken: string,
  checkRevoked = true,
): Promise<admin.auth.DecodedIdToken> {
  try {
    return await admin.auth().verifyIdToken(idToken, checkRevoked);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "auth/id-token-expired") {
      throw AuthenticationError.tokenExpired();
    }
    if (err.code === "auth/id-token-revoked") {
      throw AuthenticationError.sessionRevoked();
    }
    throw new AuthenticationError("認証トークンが無効です");
  }
}

/**
 * メールアドレスでユーザーを取得
 */
export async function getUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch {
    return null;
  }
}

/**
 * ユーザー認証アカウントを削除
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  await admin.auth().deleteUser(uid);
  logger.info("Auth user deleted", { userId: uid });
}
