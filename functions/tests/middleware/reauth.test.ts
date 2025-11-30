/**
 * Re-authentication Middleware Tests
 *
 * Unit tests for re-authentication requirements for sensitive operations
 * Covers GDPR security requirements
 *
 * Reference: docs/specs/07_セキュリティポリシー_v1_0.md
 */

// Store mock return values
let mockGetUserReturnValue: any = null;

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const defaultMockUserRecord = {
    uid: "test-uid",
    email: "test@example.com",
    emailVerified: true,
    tokensValidAfterTime: new Date().toISOString(),
    metadata: {
      lastSignInTime: new Date().toISOString(),
    },
    multiFactor: {
      enrolledFactors: [],
    },
    disabled: false,
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
      getUser: jest.fn(() => {
        if (mockGetUserReturnValue !== null) {
          if (mockGetUserReturnValue instanceof Error) {
            return Promise.reject(mockGetUserReturnValue);
          }
          return Promise.resolve(mockGetUserReturnValue);
        }
        return Promise.resolve(defaultMockUserRecord);
      }),
    })),
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        add: jest.fn(() => Promise.resolve({ id: "log-123" })),
      })),
    })),
  };
});

// Mock services
jest.mock("../../src/services/auditLog", () => ({
  createAuditLog: jest.fn(() => Promise.resolve("audit-123")),
}));

jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
  },
}));

// Import after mocks
import {
  requireRecentAuth,
  checkTokenAuthTime,
  requireReauthForSensitiveOp,
  checkReauthRequired,
  requireEmailVerified,
  isEmailVerified,
  isMfaEnabled,
  requireMfa,
  isSessionValid,
  requireValidSession,
} from "../../src/middleware/reauth";
import { SECURITY_CONSTANTS } from "../../src/types/security";

describe("Re-authentication Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserReturnValue = null;
  });

  describe("requireRecentAuth", () => {
    it("should return valid for recently authenticated user", async () => {
      const recentTime = new Date().toISOString();
      mockGetUserReturnValue = {
        uid: "test-uid",
        tokensValidAfterTime: recentTime,
        metadata: {
          lastSignInTime: recentTime,
        },
      };

      const result = await requireRecentAuth("test-uid");

      expect(result.valid).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });

    it("should return invalid for old authentication", async () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      mockGetUserReturnValue = {
        uid: "test-uid",
        tokensValidAfterTime: oldTime,
        metadata: {
          lastSignInTime: oldTime,
        },
      };

      const result = await requireRecentAuth("test-uid", 5); // 5 minute max age

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
      expect(result.message).toContain("5分以上経過しています");
    });

    it("should require reauth when tokensValidAfterTime is not set", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        tokensValidAfterTime: undefined,
        metadata: {
          lastSignInTime: new Date().toISOString(),
        },
      };

      const result = await requireRecentAuth("test-uid");

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
      expect(result.message).toBe("再認証が必要です");
    });

    it("should require reauth when lastSignInTime is not set", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        tokensValidAfterTime: new Date().toISOString(),
        metadata: {
          lastSignInTime: undefined,
        },
      };

      const result = await requireRecentAuth("test-uid");

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
      expect(result.message).toBe(
        "認証情報が見つかりません。再ログインしてください。"
      );
    });

    it("should use default max age from security constants", async () => {
      const recentTime = new Date().toISOString();
      mockGetUserReturnValue = {
        uid: "test-uid",
        tokensValidAfterTime: recentTime,
        metadata: {
          lastSignInTime: recentTime,
        },
      };

      await requireRecentAuth("test-uid");

      // Default should be SECURITY_CONSTANTS.REAUTH_MAX_AGE_MINUTES
      expect(SECURITY_CONSTANTS.REAUTH_MAX_AGE_MINUTES).toBe(5);
    });

    it("should handle Firebase Auth errors gracefully", async () => {
      mockGetUserReturnValue = new Error("User not found");

      const result = await requireRecentAuth("non-existent-uid");

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
      expect(result.message).toBe("認証情報の確認に失敗しました");
    });
  });

  describe("checkTokenAuthTime", () => {
    const createMockRequest = (authTime?: number, uid = "test-uid") => ({
      auth:
        authTime !== undefined
          ? {
              uid,
              token: {
                auth_time: authTime,
              },
            }
          : null,
      rawRequest: { headers: {} },
    });

    it("should return valid for recent auth time", () => {
      const recentAuthTime = Math.floor(Date.now() / 1000); // Current time in seconds
      const request = createMockRequest(recentAuthTime);

      const result = checkTokenAuthTime(request as any);

      expect(result.valid).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });

    it("should return invalid for old auth time", () => {
      const oldAuthTime = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes ago
      const request = createMockRequest(oldAuthTime);

      const result = checkTokenAuthTime(request as any, 5); // 5 minute max

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
    });

    it("should return invalid when no auth", () => {
      const request = createMockRequest(undefined);
      request.auth = null;

      const result = checkTokenAuthTime(request as any);

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
      expect(result.message).toBe("認証が必要です");
    });

    it("should return invalid when auth_time is missing", () => {
      const request = {
        auth: {
          uid: "test-uid",
          token: {},
        },
        rawRequest: { headers: {} },
      };

      const result = checkTokenAuthTime(request as any);

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
    });

    it("should include lastAuthTime in response", () => {
      const authTime = Math.floor(Date.now() / 1000);
      const request = createMockRequest(authTime);

      const result = checkTokenAuthTime(request as any);

      expect(result.lastAuthTime).toBeDefined();
      expect(typeof result.lastAuthTime).toBe("string");
    });
  });

  describe("requireReauthForSensitiveOp", () => {
    it("should throw AuthenticationError when no auth", async () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect(
        requireReauthForSensitiveOp(request as any, "account_deletion")
      ).rejects.toThrow("認証が必要です");
    });

    it("should pass for recent authentication", async () => {
      const recentAuthTime = Math.floor(Date.now() / 1000);
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            auth_time: recentAuthTime,
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(
        requireReauthForSensitiveOp(request as any, "data_export")
      ).resolves.not.toThrow();
    });

    it("should throw AuthorizationError for expired auth", async () => {
      const oldAuthTime = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes ago
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            auth_time: oldAuthTime,
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(
        requireReauthForSensitiveOp(request as any, "account_deletion")
      ).rejects.toThrow();
    });
  });

  describe("checkReauthRequired", () => {
    it("should return valid=false when no auth", async () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      const result = await checkReauthRequired(request as any, "data_export");

      expect(result.valid).toBe(false);
      expect(result.requiresReauth).toBe(true);
    });

    it("should return reauth response for authenticated user", async () => {
      const recentAuthTime = Math.floor(Date.now() / 1000);
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            auth_time: recentAuthTime,
          },
        },
        rawRequest: { headers: {} },
      };

      const result = await checkReauthRequired(
        request as any,
        "account_deletion"
      );

      expect(result.valid).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });
  });

  describe("requireEmailVerified", () => {
    it("should throw when no auth", () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      expect(() => requireEmailVerified(request as any)).toThrow(
        "認証が必要です"
      );
    });

    it("should throw when email not verified", () => {
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            email_verified: false,
          },
        },
        rawRequest: { headers: {} },
      };

      expect(() => requireEmailVerified(request as any)).toThrow(
        "この操作を行うにはメールアドレスの確認が必要です"
      );
    });

    it("should pass when email is verified", () => {
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            email_verified: true,
          },
        },
        rawRequest: { headers: {} },
      };

      expect(() => requireEmailVerified(request as any)).not.toThrow();
    });
  });

  describe("isEmailVerified", () => {
    it("should return false when no auth", () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      expect(isEmailVerified(request as any)).toBe(false);
    });

    it("should return false when email not verified", () => {
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            email_verified: false,
          },
        },
        rawRequest: { headers: {} },
      };

      expect(isEmailVerified(request as any)).toBe(false);
    });

    it("should return true when email is verified", () => {
      const request = {
        auth: {
          uid: "test-uid",
          token: {
            email_verified: true,
          },
        },
        rawRequest: { headers: {} },
      };

      expect(isEmailVerified(request as any)).toBe(true);
    });
  });

  describe("isMfaEnabled", () => {
    it("should return false when no MFA enrolled", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [],
        },
      };

      const result = await isMfaEnabled("test-uid");

      expect(result).toBe(false);
    });

    it("should return true when MFA is enrolled", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [{ factorId: "totp" }],
        },
      };

      const result = await isMfaEnabled("test-uid");

      expect(result).toBe(true);
    });

    it("should return false when multiFactor is undefined", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: undefined,
      };

      const result = await isMfaEnabled("test-uid");

      expect(result).toBe(false);
    });

    it("should return false when enrolledFactors is undefined", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: undefined,
        },
      };

      const result = await isMfaEnabled("test-uid");

      expect(result).toBe(false);
    });

    it("should return false on Firebase Auth error", async () => {
      mockGetUserReturnValue = new Error("User not found");

      const result = await isMfaEnabled("non-existent-uid");

      expect(result).toBe(false);
    });
  });

  describe("requireMfa", () => {
    it("should throw when no auth", async () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect(requireMfa(request as any)).rejects.toThrow(
        "認証が必要です"
      );
    });

    it("should throw when MFA is not enabled", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [],
        },
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {},
        },
        rawRequest: { headers: {} },
      };

      await expect(requireMfa(request as any)).rejects.toThrow(
        "この操作を行うには2段階認証の設定が必要です"
      );
    });

    it("should throw when MFA verification is needed", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [{ factorId: "totp" }],
        },
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            firebase: {},
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(requireMfa(request as any)).rejects.toThrow(
        "2段階認証での再ログインが必要です"
      );
    });

    it("should pass when TOTP MFA is verified", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [{ factorId: "totp" }],
        },
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            firebase: {
              sign_in_second_factor: "totp",
            },
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(requireMfa(request as any)).resolves.not.toThrow();
    });

    it("should pass when phone MFA is verified", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        multiFactor: {
          enrolledFactors: [{ factorId: "phone" }],
        },
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            firebase: {
              sign_in_second_factor: "phone",
            },
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(requireMfa(request as any)).resolves.not.toThrow();
    });
  });

  describe("isSessionValid", () => {
    it("should return false when no auth", async () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(false);
    });

    it("should return false when user is disabled", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        disabled: true,
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            iat: Math.floor(Date.now() / 1000),
          },
        },
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(false);
    });

    it("should return false when token was issued before revocation", async () => {
      const tokenIssuedAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const tokensValidAfter = new Date().toISOString(); // Now

      mockGetUserReturnValue = {
        uid: "test-uid",
        disabled: false,
        tokensValidAfterTime: tokensValidAfter,
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            iat: tokenIssuedAt,
          },
        },
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(false);
    });

    it("should return true for valid session", async () => {
      const tokenIssuedAt = Math.floor(Date.now() / 1000);

      mockGetUserReturnValue = {
        uid: "test-uid",
        disabled: false,
        tokensValidAfterTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            iat: tokenIssuedAt,
          },
        },
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(true);
    });

    it("should return true when tokensValidAfterTime is not set", async () => {
      mockGetUserReturnValue = {
        uid: "test-uid",
        disabled: false,
        tokensValidAfterTime: undefined,
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            iat: Math.floor(Date.now() / 1000),
          },
        },
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(true);
    });

    it("should handle Firebase Auth error gracefully", async () => {
      mockGetUserReturnValue = new Error("Network error");

      const request = {
        auth: {
          uid: "test-uid",
          token: {},
        },
        rawRequest: { headers: {} },
      };

      const result = await isSessionValid(request as any);

      expect(result).toBe(false);
    });
  });

  describe("requireValidSession", () => {
    it("should throw when session is invalid", async () => {
      const request = {
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect(requireValidSession(request as any)).rejects.toThrow();
    });

    it("should pass for valid session", async () => {
      const tokenIssuedAt = Math.floor(Date.now() / 1000);

      mockGetUserReturnValue = {
        uid: "test-uid",
        disabled: false,
        tokensValidAfterTime: new Date(Date.now() - 3600000).toISOString(),
      };

      const request = {
        auth: {
          uid: "test-uid",
          token: {
            iat: tokenIssuedAt,
          },
        },
        rawRequest: { headers: {} },
      };

      await expect(
        requireValidSession(request as any)
      ).resolves.not.toThrow();
    });
  });

  describe("Security Constants", () => {
    it("should have correct REAUTH_MAX_AGE_MINUTES", () => {
      expect(SECURITY_CONSTANTS.REAUTH_MAX_AGE_MINUTES).toBe(5);
    });

    it("should have correct SENSITIVE_OP_MAX_AGE_MINUTES", () => {
      expect(SECURITY_CONSTANTS.SENSITIVE_OP_MAX_AGE_MINUTES).toBe(5);
    });
  });
});
