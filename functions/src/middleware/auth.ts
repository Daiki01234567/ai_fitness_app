/**
 * Authentication Middleware
 * Validates Firebase Auth tokens and checks user permissions
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

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Authenticated user context
 */
export interface AuthContext {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  claims: Record<string, unknown>;
}

/**
 * User context with full user data
 */
export interface UserContext extends AuthContext {
  user: User & { id: string };
}

/**
 * Extract authentication context from request
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
 * Require authentication
 */
export function requireAuth(request: CallableRequest): AuthContext {
  const context = getAuthContext(request);

  // Check for force logout
  if (context.claims.forceLogout) {
    logger.security("Force logout triggered", { userId: context.uid });
    throw AuthenticationError.sessionRevoked();
  }

  return context;
}

/**
 * Check if user has deletion scheduled
 */
export async function checkDeletionScheduled(uid: string): Promise<boolean> {
  const userDoc = await userRef(uid).get();

  if (!userDoc.exists) {
    return false;
  }

  return userDoc.data()?.deletionScheduled === true;
}

/**
 * Require write permission (not deletion scheduled)
 */
export async function requireWritePermission(uid: string): Promise<void> {
  const isDeletionScheduled = await checkDeletionScheduled(uid);

  if (isDeletionScheduled) {
    logger.warn("Write attempt by deletion scheduled user", { userId: uid });
    throw AuthorizationError.deletionScheduled();
  }
}

/**
 * Require authentication and write permission
 */
export async function requireAuthWithWritePermission(
  request: CallableRequest,
): Promise<AuthContext> {
  const context = requireAuth(request);
  await requireWritePermission(context.uid);
  return context;
}

/**
 * Get full user context with user data
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
 * Check if user has required consent
 */
export function requireConsent(user: User): void {
  if (!user.tosAccepted || !user.ppAccepted) {
    throw AuthorizationError.consentRequired();
  }
}

/**
 * Check if user has admin claim
 */
export function requireAdmin(context: AuthContext): void {
  if (!context.claims.admin) {
    throw new AuthorizationError("管理者権限が必要です");
  }
}

/**
 * Check if user has specific custom claim
 */
export function requireClaim(context: AuthContext, claimKey: string): void {
  if (!context.claims[claimKey]) {
    throw new AuthorizationError(`権限 '${claimKey}' が必要です`);
  }
}

/**
 * Set custom claims for a user
 */
export async function setCustomClaims(
  uid: string,
  claims: Record<string, unknown>,
): Promise<void> {
  await admin.auth().setCustomUserClaims(uid, claims);
  logger.info("Custom claims updated", { userId: uid, claims: Object.keys(claims) });
}

/**
 * Get custom claims for a user
 */
export async function getCustomClaims(uid: string): Promise<Record<string, unknown>> {
  const user = await admin.auth().getUser(uid);
  return user.customClaims ?? {};
}

/**
 * Revoke all refresh tokens for a user (force logout)
 */
export async function revokeRefreshTokens(uid: string): Promise<void> {
  await admin.auth().revokeRefreshTokens(uid);
  logger.security("Refresh tokens revoked", { userId: uid });
}

/**
 * Set force logout claim
 */
export async function setForceLogout(uid: string): Promise<void> {
  const currentClaims = await getCustomClaims(uid);
  await setCustomClaims(uid, {
    ...currentClaims,
    forceLogout: true,
  });

  // Also update Firestore
  await userRef(uid).update({
    forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Revoke tokens
  await revokeRefreshTokens(uid);

  logger.security("Force logout set", { userId: uid });
}

/**
 * Clear force logout claim
 */
export async function clearForceLogout(uid: string): Promise<void> {
  const currentClaims = await getCustomClaims(uid);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { forceLogout, ...remainingClaims } = currentClaims;
  await setCustomClaims(uid, remainingClaims);

  logger.info("Force logout cleared", { userId: uid });
}

/**
 * Verify ID token
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
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch {
    return null;
  }
}

/**
 * Delete user auth account
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  await admin.auth().deleteUser(uid);
  logger.info("Auth user deleted", { userId: uid });
}
