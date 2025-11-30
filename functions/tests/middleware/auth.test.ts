/**
 * Authentication Middleware Tests
 *
 * Unit tests for authentication middleware functions
 * Covers token validation, user context, permissions, and custom claims
 *
 * Reference: docs/specs/03_API設計書_Firebase_Functions_v3_3.md
 */

import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockAuth = {
    getUser: jest.fn(),
    setCustomUserClaims: jest.fn(() => Promise.resolve()),
    verifyIdToken: jest.fn(),
    getUserByEmail: jest.fn(),
    deleteUser: jest.fn(() => Promise.resolve()),
    revokeRefreshTokens: jest.fn(() => Promise.resolve()),
  };
  
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };
  
  return {
    apps: [{ name: 'test-app' }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(),
            update: jest.fn(() => Promise.resolve()),
          })),
        })),
        FieldValue: mockFieldValue,
      })),
      { FieldValue: mockFieldValue }
    ),
  };
});

// Mock utils
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    security: jest.fn(),
  },
}));

// Create a mock map to store userRef mocks
const mockUserRefs = new Map();

jest.mock('../../src/utils/firestore', () => ({
  userRef: jest.fn((uid: string) => {
    if (!mockUserRefs.has(uid)) {
      mockUserRefs.set(uid, {
        get: jest.fn(),
        update: jest.fn(() => Promise.resolve()),
      });
    }
    return mockUserRefs.get(uid);
  }),
}));

// Import after mocks
import {
  getAuthContext,
  requireAuth,
  checkDeletionScheduled,
  requireWritePermission,
  requireAuthWithWritePermission,
  getUserContext,
  requireConsent,
  requireAdmin,
  requireClaim,
  setCustomClaims,
  getCustomClaims,
  revokeRefreshTokens,
  setForceLogout,
  clearForceLogout,
  verifyIdToken,
  getUserByEmail,
  deleteAuthUser,
} from '../../src/middleware/auth';
import { userRef } from '../../src/utils/firestore';
import { logger } from '../../src/utils/logger';

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthContext', () => {
    it('認証情報が存在する場合、AuthContextを返す', () => {
      const request = {
        auth: {
          uid: 'user-123',
          token: {
            email: 'test@example.com',
            email_verified: true,
            admin: false,
          },
        },
      } as any;

      const context = getAuthContext(request);

      expect(context).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        claims: {
          email: 'test@example.com',
          email_verified: true,
          admin: false,
        },
      });
    });

    it('認証情報が存在しない場合、AuthenticationErrorをスローする', () => {
      const request = { auth: null } as any;
      expect(() => getAuthContext(request)).toThrow('認証が必要です');
    });

    it('メールアドレスが未設定の場合でも動作する', () => {
      const request = {
        auth: {
          uid: 'user-456',
          token: {},
        },
      } as any;

      const context = getAuthContext(request);

      expect(context.email).toBeUndefined();
      expect(context.emailVerified).toBeUndefined();
    });
  });

  describe('requireAuth', () => {
    it('通常の認証済みユーザーの場合、AuthContextを返す', () => {
      const request = {
        auth: {
          uid: 'user-123',
          token: {
            email: 'test@example.com',
            email_verified: true,
          },
        },
      } as any;

      const context = requireAuth(request);

      expect(context.uid).toBe('user-123');
      expect(logger.security).not.toHaveBeenCalled();
    });

    it('forceLogoutフラグが設定されている場合、エラーをスローする', () => {
      const request = {
        auth: {
          uid: 'user-789',
          token: {
            email: 'test@example.com',
            forceLogout: true,
          },
        },
      } as any;

      expect(() => requireAuth(request)).toThrow(
        'セッションが無効化されています。再ログインしてください'
      );

      expect(logger.security).toHaveBeenCalledWith(
        'Force logout triggered',
        { userId: 'user-789' }
      );
    });

    it('認証情報がない場合、エラーをスローする', () => {
      const request = { auth: null } as any;
      expect(() => requireAuth(request)).toThrow('認証が必要です');
    });
  });

  describe('checkDeletionScheduled', () => {
    it('削除予定フラグが設定されている場合、trueを返す', async () => {
      const mockUserRef = userRef('user-123');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: true }),
      });

      const result = await checkDeletionScheduled('user-123');

      expect(result).toBe(true);
    });

    it('削除予定フラグが設定されていない場合、falseを返す', async () => {
      const mockUserRef = userRef('user-456');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: false }),
      });

      const result = await checkDeletionScheduled('user-456');

      expect(result).toBe(false);
    });

    it('ユーザードキュメントが存在しない場合、falseを返す', async () => {
      const mockUserRef = userRef('nonexistent');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await checkDeletionScheduled('nonexistent');

      expect(result).toBe(false);
    });

    it('deletionScheduledフィールドがundefinedの場合、falseを返す', async () => {
      const mockUserRef = userRef('user-789');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({}),
      });

      const result = await checkDeletionScheduled('user-789');

      expect(result).toBe(false);
    });
  });

  describe('requireWritePermission', () => {
    it('削除予定でないユーザーの場合、正常に完了する', async () => {
      const mockUserRef = userRef('user-123');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: false }),
      });

      await expect(requireWritePermission('user-123')).resolves.not.toThrow();
    });

    it('削除予定のユーザーの場合、AuthorizationErrorをスローする', async () => {
      const mockUserRef = userRef('user-456');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: true }),
      });

      await expect(requireWritePermission('user-456')).rejects.toThrow(
        'アカウント削除が予定されているため、データを変更できません'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Write attempt by deletion scheduled user',
        { userId: 'user-456' }
      );
    });
  });

  describe('requireAuthWithWritePermission', () => {
    it('認証済みで削除予定でないユーザーの場合、AuthContextを返す', async () => {
      const request = {
        auth: {
          uid: 'user-123',
          token: {
            email: 'test@example.com',
          },
        },
      } as any;

      const mockUserRef = userRef('user-123');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: false }),
      });

      const context = await requireAuthWithWritePermission(request);

      expect(context.uid).toBe('user-123');
    });

    it('未認証の場合、エラーをスローする', async () => {
      const request = { auth: null } as any;

      await expect(requireAuthWithWritePermission(request)).rejects.toThrow(
        '認証が必要です'
      );
    });

    it('削除予定ユーザーの場合、エラーをスローする', async () => {
      const request = {
        auth: {
          uid: 'user-789',
          token: {
            email: 'test@example.com',
          },
        },
      } as any;

      const mockUserRef = userRef('user-789');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => ({ deletionScheduled: true }),
      });

      await expect(requireAuthWithWritePermission(request)).rejects.toThrow(
        'アカウント削除が予定されているため、データを変更できません'
      );
    });
  });

  describe('getUserContext', () => {
    it('ユーザードキュメントが存在する場合、UserContextを返す', async () => {
      const request = {
        auth: {
          uid: 'user-123',
          token: {
            email: 'test@example.com',
            email_verified: true,
          },
        },
      } as any;

      const mockUserRef = userRef('user-123');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: true,
        id: 'user-123',
        data: () => ({
          email: 'test@example.com',
          displayName: 'Test User',
          tosAccepted: true,
          ppAccepted: true,
        }),
      });

      const context = await getUserContext(request);

      expect(context.uid).toBe('user-123');
      expect(context.user.id).toBe('user-123');
      expect(context.user.email).toBe('test@example.com');
      expect(context.user.displayName).toBe('Test User');
    });

    it('ユーザードキュメントが存在しない場合、エラーをスローする', async () => {
      const request = {
        auth: {
          uid: 'user-456',
          token: {
            email: 'test@example.com',
          },
        },
      } as any;

      const mockUserRef = userRef('user-456');
      (mockUserRef.get as jest.Mock).mockResolvedValue({
        exists: false,
      });

      await expect(getUserContext(request)).rejects.toThrow(
        'ユーザー情報が見つかりません'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'User document not found',
        { userId: 'user-456' }
      );
    });

    it('未認証の場合、エラーをスローする', async () => {
      const request = { auth: null } as any;

      await expect(getUserContext(request)).rejects.toThrow('認証が必要です');
    });
  });

  describe('requireConsent', () => {
    it('利用規約とプライバシーポリシーの両方に同意している場合、エラーをスローしない', () => {
      const user = {
        tosAccepted: true,
        ppAccepted: true,
      } as any;

      expect(() => requireConsent(user)).not.toThrow();
    });

    it('利用規約に未同意の場合、エラーをスローする', () => {
      const user = {
        tosAccepted: false,
        ppAccepted: true,
      } as any;

      expect(() => requireConsent(user)).toThrow('利用規約への同意が必要です');
    });

    it('プライバシーポリシーに未同意の場合、エラーをスローする', () => {
      const user = {
        tosAccepted: true,
        ppAccepted: false,
      } as any;

      expect(() => requireConsent(user)).toThrow('利用規約への同意が必要です');
    });

    it('両方に未同意の場合、エラーをスローする', () => {
      const user = {
        tosAccepted: false,
        ppAccepted: false,
      } as any;

      expect(() => requireConsent(user)).toThrow('利用規約への同意が必要です');
    });
  });

  describe('requireAdmin', () => {
    it('管理者クレームを持つ場合、エラーをスローしない', () => {
      const context = {
        uid: 'admin-123',
        claims: { admin: true },
      } as any;

      expect(() => requireAdmin(context)).not.toThrow();
    });

    it('管理者クレームを持たない場合、エラーをスローする', () => {
      const context = {
        uid: 'user-123',
        claims: { admin: false },
      } as any;

      expect(() => requireAdmin(context)).toThrow('管理者権限が必要です');
    });

    it('claimsにadminフィールドが存在しない場合、エラーをスローする', () => {
      const context = {
        uid: 'user-456',
        claims: {},
      } as any;

      expect(() => requireAdmin(context)).toThrow('管理者権限が必要です');
    });
  });

  describe('requireClaim', () => {
    it('指定したクレームを持つ場合、エラーをスローしない', () => {
      const context = {
        uid: 'user-123',
        claims: { premium: true },
      } as any;

      expect(() => requireClaim(context, 'premium')).not.toThrow();
    });

    it('指定したクレームを持たない場合、エラーをスローする', () => {
      const context = {
        uid: 'user-456',
        claims: { premium: false },
      } as any;

      expect(() => requireClaim(context, 'premium')).toThrow(
        "権限 'premium' が必要です"
      );
    });

    it('claimsに指定フィールドが存在しない場合、エラーをスローする', () => {
      const context = {
        uid: 'user-789',
        claims: {},
      } as any;

      expect(() => requireClaim(context, 'moderator')).toThrow(
        "権限 'moderator' が必要です"
      );
    });
  });

  describe('setCustomClaims', () => {
    it('カスタムクレームを正常に設定する', async () => {
      const claims = { premium: true, level: 5 };

      await setCustomClaims('user-123', claims);

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith('user-123', claims);

      expect(logger.info).toHaveBeenCalledWith(
        'Custom claims updated',
        { userId: 'user-123', claims: ['premium', 'level'] }
      );
    });

    it('空のクレームを設定できる', async () => {
      const claims = {};

      await setCustomClaims('user-456', claims);

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith('user-456', claims);
    });
  });

  describe('getCustomClaims', () => {
    it('ユーザーのカスタムクレームを取得する', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-123',
        customClaims: { premium: true, admin: false },
      });

      const claims = await getCustomClaims('user-123');

      expect(claims).toEqual({ premium: true, admin: false });
      expect(admin.auth().getUser).toHaveBeenCalledWith('user-123');
    });

    it('カスタムクレームが未設定の場合、空オブジェクトを返す', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-456',
        customClaims: null,
      });

      const claims = await getCustomClaims('user-456');

      expect(claims).toEqual({});
    });

    it('customClaimsがundefinedの場合、空オブジェクトを返す', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-789',
        customClaims: undefined,
      });

      const claims = await getCustomClaims('user-789');

      expect(claims).toEqual({});
    });
  });

  describe('revokeRefreshTokens', () => {
    it('リフレッシュトークンを正常に取り消す', async () => {
      await revokeRefreshTokens('user-123');

      expect(admin.auth().revokeRefreshTokens).toHaveBeenCalledWith('user-123');

      expect(logger.security).toHaveBeenCalledWith(
        'Refresh tokens revoked',
        { userId: 'user-123' }
      );
    });
  });

  describe('setForceLogout', () => {
    it('強制ログアウトを正常に設定する', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-123',
        customClaims: { premium: true },
      });

      const mockUserRef = userRef('user-123');

      await setForceLogout('user-123');

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        'user-123',
        { premium: true, forceLogout: true }
      );

      expect(mockUserRef.update).toHaveBeenCalledWith({
        forceLogoutAt: expect.any(Date),
      });

      expect(admin.auth().revokeRefreshTokens).toHaveBeenCalledWith('user-123');

      expect(logger.security).toHaveBeenCalledWith(
        'Force logout set',
        { userId: 'user-123' }
      );
    });

    it('既存のクレームを保持しながら強制ログアウトを追加する', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-456',
        customClaims: { admin: true, premium: true, level: 5 },
      });

      const mockUserRef = userRef('user-456');

      await setForceLogout('user-456');

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        'user-456',
        { admin: true, premium: true, level: 5, forceLogout: true }
      );
    });
  });

  describe('clearForceLogout', () => {
    it('強制ログアウトクレームを正常にクリアする', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-123',
        customClaims: { premium: true, forceLogout: true },
      });

      await clearForceLogout('user-123');

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        'user-123',
        { premium: true }
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Force logout cleared',
        { userId: 'user-123' }
      );
    });

    it('他のクレームを保持しながらforceLogoutのみを削除する', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-456',
        customClaims: { admin: true, premium: true, forceLogout: true, level: 3 },
      });

      await clearForceLogout('user-456');

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        'user-456',
        { admin: true, premium: true, level: 3 }
      );
    });

    it('forceLogoutクレームがない場合でも正常に動作する', async () => {
      (admin.auth().getUser as jest.Mock).mockResolvedValue({
        uid: 'user-789',
        customClaims: { premium: true },
      });

      await clearForceLogout('user-789');

      expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(
        'user-789',
        { premium: true }
      );
    });
  });

  describe('verifyIdToken', () => {
    it('有効なトークンを正常に検証する', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      };
      (admin.auth().verifyIdToken as jest.Mock).mockResolvedValue(mockDecodedToken);

      const decoded = await verifyIdToken('valid-token');

      expect(decoded).toEqual(mockDecodedToken);
      expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('valid-token', true);
    });

    it('checkRevoked=falseの場合、取り消しチェックをスキップする', async () => {
      const mockDecodedToken = { uid: 'user-456' };
      (admin.auth().verifyIdToken as jest.Mock).mockResolvedValue(mockDecodedToken);

      await verifyIdToken('token', false);

      expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('token', false);
    });

    it('トークンが期限切れの場合、適切なエラーをスローする', async () => {
      (admin.auth().verifyIdToken as jest.Mock).mockRejectedValue({
        code: 'auth/id-token-expired',
      });

      await expect(verifyIdToken('expired-token')).rejects.toThrow(
        '認証トークンの有効期限が切れています'
      );
    });

    it('トークンが取り消されている場合、適切なエラーをスローする', async () => {
      (admin.auth().verifyIdToken as jest.Mock).mockRejectedValue({
        code: 'auth/id-token-revoked',
      });

      await expect(verifyIdToken('revoked-token')).rejects.toThrow(
        'セッションが無効化されています。再ログインしてください'
      );
    });

    it('その他の検証エラーの場合、一般的なエラーをスローする', async () => {
      (admin.auth().verifyIdToken as jest.Mock).mockRejectedValue({
        code: 'auth/argument-error',
      });

      await expect(verifyIdToken('invalid-token')).rejects.toThrow(
        '認証トークンが無効です'
      );
    });
  });

  describe('getUserByEmail', () => {
    it('メールアドレスでユーザーを取得する', async () => {
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
      };
      (admin.auth().getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const user = await getUserByEmail('test@example.com');

      expect(user).toEqual(mockUser);
      expect(admin.auth().getUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('ユーザーが存在しない場合、nullを返す', async () => {
      (admin.auth().getUserByEmail as jest.Mock).mockRejectedValue(
        new Error('User not found')
      );

      const user = await getUserByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    it('エラーが発生した場合、nullを返す', async () => {
      (admin.auth().getUserByEmail as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const user = await getUserByEmail('error@example.com');

      expect(user).toBeNull();
    });
  });

  describe('deleteAuthUser', () => {
    it('認証ユーザーを正常に削除する', async () => {
      await deleteAuthUser('user-123');

      expect(admin.auth().deleteUser).toHaveBeenCalledWith('user-123');

      expect(logger.info).toHaveBeenCalledWith(
        'Auth user deleted',
        { userId: 'user-123' }
      );
    });
  });
});
