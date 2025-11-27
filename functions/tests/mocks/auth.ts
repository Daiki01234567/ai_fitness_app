/**
 * Auth Mock Helpers
 * Provides mock authentication data for testing
 */

/**
 * Create mock auth context
 */
export function createMockAuthContext(overrides: {
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  claims?: Record<string, unknown>;
} = {}) {
  return {
    uid: overrides.uid ?? "test-uid",
    email: overrides.email ?? "test@example.com",
    emailVerified: overrides.emailVerified ?? true,
    claims: {
      email: overrides.email ?? "test@example.com",
      email_verified: overrides.emailVerified ?? true,
      ...overrides.claims,
    },
  };
}

/**
 * Create mock admin auth context
 */
export function createMockAdminAuthContext(overrides: {
  uid?: string;
  email?: string;
} = {}) {
  return createMockAuthContext({
    ...overrides,
    claims: {
      admin: true,
    },
  });
}

/**
 * Create mock force logout auth context
 */
export function createMockForceLogoutAuthContext(overrides: {
  uid?: string;
  email?: string;
} = {}) {
  return createMockAuthContext({
    ...overrides,
    claims: {
      forceLogout: true,
    },
  });
}

/**
 * Create mock decoded ID token
 */
export function createMockDecodedToken(overrides: Partial<{
  uid: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  sub: string;
  auth_time: number;
}> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    uid: overrides.uid ?? "test-uid",
    email: overrides.email ?? "test@example.com",
    email_verified: overrides.email_verified ?? true,
    name: overrides.name ?? "Test User",
    picture: overrides.picture ?? "https://example.com/photo.jpg",
    iat: overrides.iat ?? now,
    exp: overrides.exp ?? now + 3600,
    aud: overrides.aud ?? "test-project",
    iss: overrides.iss ?? "https://securetoken.google.com/test-project",
    sub: overrides.sub ?? overrides.uid ?? "test-uid",
    auth_time: overrides.auth_time ?? now,
  };
}

/**
 * Create mock Firebase user record
 */
export function createMockUserRecord(overrides: Partial<{
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  disabled: boolean;
  customClaims: Record<string, unknown>;
  tokensValidAfterTime: string;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}> = {}) {
  return {
    uid: overrides.uid ?? "test-uid",
    email: overrides.email ?? "test@example.com",
    emailVerified: overrides.emailVerified ?? true,
    displayName: overrides.displayName ?? "Test User",
    photoURL: overrides.photoURL ?? "https://example.com/photo.jpg",
    disabled: overrides.disabled ?? false,
    customClaims: overrides.customClaims ?? {},
    tokensValidAfterTime: overrides.tokensValidAfterTime ?? new Date().toISOString(),
    metadata: overrides.metadata ?? {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    toJSON: () => ({
      uid: overrides.uid ?? "test-uid",
      email: overrides.email ?? "test@example.com",
    }),
  };
}
