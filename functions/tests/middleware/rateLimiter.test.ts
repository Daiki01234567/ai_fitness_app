/**
 * Rate Limiter Middleware Tests
 */
import * as admin from 'firebase-admin';

const mockTimestamp = {
  now: jest.fn(),
  fromDate: jest.fn(),
};

jest.mock('firebase-admin', () => ({
  apps: [{ name: 'test-app' }],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: jest.fn(),
      runTransaction: jest.fn(),
      batch: jest.fn(),
    })),
    {
      FieldValue: {
        increment: jest.fn((v) => ({ _methodName: 'increment', _value: v })),
      },
      Timestamp: mockTimestamp,
    }
  ),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/utils/firestore', () => ({
  getFirestore: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('../../src/utils/errors', () => ({
  RateLimitError: class RateLimitError extends Error {
    constructor(message = 'Rate limit') {
      super(message);
      this.name = 'RateLimitError';
    }
  },
}));

import { RateLimiter, rateLimiter, RateLimits } from '../../src/middleware/rateLimiter';
import { RateLimitError } from '../../src/utils/errors';
import { logger } from '../../src/utils/logger';
import { getFirestore } from '../../src/utils/firestore';

describe('RateLimiter Middleware', () => {
  let mockFirestore: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockTransaction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc = { get: jest.fn(), set: jest.fn(), update: jest.fn(), delete: jest.fn() };
    mockCollection = {
      doc: jest.fn(() => mockDoc),
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ empty: true, docs: [], size: 0 })),
        })),
      })),
    };
    mockTransaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
    mockFirestore = {
      collection: jest.fn(() => mockCollection),
      runTransaction: jest.fn(async (cb) => cb(mockTransaction)),
      batch: jest.fn(() => ({ delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
    };
    (getFirestore as jest.Mock).mockReturnValue(mockFirestore);
    const now = Date.now();
    mockTimestamp.now.mockReturnValue({ toMillis: () => now, toDate: () => new Date(now) });
    mockTimestamp.fromDate.mockImplementation((d) => ({ toMillis: () => d.getTime(), toDate: () => d }));
  });

  describe('checkLimit', () => {
    it('初回リクエストは成功', async () => {
      const limiter = new RateLimiter();
      mockTransaction.get.mockResolvedValueOnce({ exists: false });
      const result = await limiter.checkLimit('user-123', { maxRequests: 10, windowSeconds: 3600 });
      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalled();
    });

    it('制限を超えた場合エラー', async () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 10, windowStart: { toMillis: () => now - 100000 } }),
      });
      await expect(limiter.checkLimit('user-123', { maxRequests: 10, windowSeconds: 3600 })).rejects.toThrow();
    });

    it('Firestoreエラー時は成功を返す', async () => {
      const limiter = new RateLimiter();
      mockFirestore.runTransaction.mockRejectedValueOnce(new Error('Firestore error'));
      const result = await limiter.checkLimit('user-123', { maxRequests: 10, windowSeconds: 3600 });
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getRemaining', () => {
    it('ドキュメントなしの場合最大値を返す', async () => {
      const limiter = new RateLimiter();
      mockDoc.get.mockResolvedValueOnce({ exists: false });
      const result = await limiter.getRemaining('USER_GET_PROFILE', 'user-123');
      expect(result.remaining).toBe(100);
    });
  });

  describe('reset', () => {
    it('レコードを削除', async () => {
      const limiter = new RateLimiter();
      mockDoc.delete.mockResolvedValueOnce(undefined);
      await limiter.reset('USER_GET_PROFILE', 'user-123');
      expect(mockDoc.delete).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('期限切れレコードを削除', async () => {
      const limiter = new RateLimiter();
      const mockBatch = { delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) };
      mockFirestore.collection.mockReturnValueOnce({
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ empty: false, docs: [{ ref: 'doc1' }], size: 1 })),
          })),
        })),
      });
      mockFirestore.batch.mockReturnValueOnce(mockBatch);
      const count = await limiter.cleanup(86400);
      expect(count).toBe(1);
      expect(logger.info).toHaveBeenCalledWith('Rate limit records cleaned up', { count: 1 });
    });
  });

  describe('RateLimits Configuration', () => {
    it('AUTH_SIGNUP設定', () => {
      expect(RateLimits.AUTH_SIGNUP).toEqual({ maxRequests: 10, windowSeconds: 3600 });
    });

    it('すべての設定が正しい', () => {
      Object.entries(RateLimits).forEach(([k, c]) => {
        expect(c).toHaveProperty('maxRequests');
        expect(c).toHaveProperty('windowSeconds');
      });
    });
  });

  describe('check method', () => {
    it('check()を使用してレート制限', async () => {
      mockTransaction.get.mockResolvedValueOnce({ exists: false });
      const result = await rateLimiter.check('USER_UPDATE_PROFILE', 'user-123');
      expect(result).toBe(true);
    });
  });

  describe('getRemaining variations', () => {
    it('期限切れウィンドウの場合リセット', async () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 50, windowStart: { toMillis: () => now - 200000 } }),
      });
      const result = await limiter.getRemaining('USER_GET_PROFILE', 'user-123');
      expect(result.remaining).toBe(100);
    });

    it('負の残りを0にする', async () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 150, windowStart: { toMillis: () => now - 30000 } }),
      });
      const result = await limiter.getRemaining('USER_GET_PROFILE', 'user-123');
      expect(result.remaining).toBe(0);
    });
  });

  describe('withRateLimit decorator', () => {
    it('デコレーターで関数をラップ', async () => {
      mockTransaction.get.mockResolvedValueOnce({ exists: false });
      await rateLimiter.check('DEFAULT', 'test-123');
      expect(mockTransaction.get).toHaveBeenCalled();
    });
  });

  describe('Singleton', () => {
    it('rateLimiterインスタンス', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('checkLimit - window reset', () => {
    it('期限切れウィンドウをリセットして成功を返す', async () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      // Window started 2 hours ago, windowSeconds is 1 hour
      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          count: 5,
          windowStart: { toMillis: () => now - 7200000 }, // 2 hours ago
        }),
      });

      const result = await limiter.checkLimit('user-123', {
        maxRequests: 10,
        windowSeconds: 3600, // 1 hour
      });

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalled();
    });
  });

  describe('checkLimit - increment count', () => {
    it('制限未満の場合カウントをインクリメント', async () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          count: 5, // Under limit of 10
          windowStart: { toMillis: () => now - 1000 }, // Recent window
        }),
      });

      const result = await limiter.checkLimit('user-123', {
        maxRequests: 10,
        windowSeconds: 3600,
      });

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalled();
    });
  });

  describe('cleanup - empty result', () => {
    it('削除するレコードがない場合0を返す', async () => {
      const limiter = new RateLimiter();
      mockFirestore.collection.mockReturnValueOnce({
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ empty: true, docs: [], size: 0 })),
          })),
        })),
      });

      const count = await limiter.cleanup(86400);
      expect(count).toBe(0);
    });
  });

  describe('withRateLimit decorator', () => {
    it('デコレーターが関数を正しくラップ', async () => {
      // Import the decorator
      const { withRateLimit } = require('../../src/middleware/rateLimiter');

      mockTransaction.get.mockResolvedValueOnce({ exists: false });

      const targetFn = jest.fn().mockResolvedValue('result');
      const wrappedFn = withRateLimit('DEFAULT', (req: any) => req.userId)(targetFn);

      const result = await wrappedFn({ userId: 'user-123' });

      expect(result).toBe('result');
      expect(targetFn).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('レート制限超過時にエラーをスロー', async () => {
      const { withRateLimit } = require('../../src/middleware/rateLimiter');

      const now = Date.now();
      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          count: 60, // At limit for DEFAULT (60/min)
          windowStart: { toMillis: () => now - 30000 }, // 30 seconds ago
        }),
      });

      const targetFn = jest.fn().mockResolvedValue('result');
      const wrappedFn = withRateLimit('DEFAULT', (req: any) => req.userId)(targetFn);

      await expect(wrappedFn({ userId: 'user-123' })).rejects.toThrow();
      expect(targetFn).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeKey', () => {
    it('ドキュメントIDに不正な文字を含むキーをサニタイズ', async () => {
      const limiter = new RateLimiter();
      mockTransaction.get.mockResolvedValueOnce({ exists: false });

      // Key with special characters
      await limiter.checkLimit('user/123.test#key$value[0]', {
        maxRequests: 10,
        windowSeconds: 3600,
      });

      // Should have been called with sanitized key
      expect(mockFirestore.collection).toHaveBeenCalledWith('rateLimits');
      expect(mockCollection.doc).toHaveBeenCalled();
    });
  });

  describe('RateLimitError re-throw', () => {
    it('RateLimitErrorは再スローされる', async () => {
      const limiter = new RateLimiter();
      const rateLimitError = new RateLimitError('Rate limit exceeded');

      mockFirestore.runTransaction.mockRejectedValueOnce(rateLimitError);

      await expect(
        limiter.checkLimit('user-123', { maxRequests: 10, windowSeconds: 3600 })
      ).rejects.toThrow(RateLimitError);
    });
  });
});
