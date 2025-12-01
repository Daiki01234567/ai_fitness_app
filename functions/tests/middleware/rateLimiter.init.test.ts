/**
 * Rate Limiter Module Initialization Test
 * Tests the admin SDK initialization path (line 15 in rateLimiter.ts)
 */

describe('RateLimiter Module Initialization', () => {
  beforeAll(() => {
    // Reset all modules before this test suite
    jest.resetModules();
  });

  it('should call admin.initializeApp when apps.length is 0 (line 15)', () => {
    // Create mock before requiring firebase-admin
    const mockInitializeApp = jest.fn();
    
    // Mock firebase-admin with empty apps array BEFORE it's imported
    jest.doMock('firebase-admin', () => {
      const mockTimestamp = {
        now: jest.fn(() => ({ toMillis: () => Date.now(), toDate: () => new Date() })),
        fromDate: jest.fn((d) => ({ toMillis: () => d.getTime(), toDate: () => d })),
      };
      
      return {
        apps: [], // Empty to trigger initialization
        initializeApp: mockInitializeApp,
        firestore: Object.assign(
          jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
              })),
              where: jest.fn(() => ({
                limit: jest.fn(() => ({
                  get: jest.fn(() => Promise.resolve({ empty: true, docs: [], size: 0 })),
                })),
              })),
            })),
            runTransaction: jest.fn(),
            batch: jest.fn(() => ({
              delete: jest.fn(),
              commit: jest.fn(() => Promise.resolve()),
            })),
          })),
          {
            FieldValue: {
              increment: jest.fn((v) => ({ _methodName: 'increment', _value: v })),
            },
            Timestamp: mockTimestamp,
          }
        ),
      };
    });

    jest.doMock('../../src/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    }));

    jest.doMock('../../src/utils/firestore', () => ({
      getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          })),
        })),
        runTransaction: jest.fn(),
        batch: jest.fn(),
      })),
      serverTimestamp: jest.fn(() => new Date()),
    }));

    jest.doMock('../../src/utils/errors', () => ({
      RateLimitError: class RateLimitError extends Error {
        constructor(message = 'Rate limit') {
          super(message);
          this.name = 'RateLimitError';
        }
      },
    }));

    // Now require the module - this should trigger line 15
    require('../../src/middleware/rateLimiter');
    
    // Verify initializeApp was called
    expect(mockInitializeApp).toHaveBeenCalled();
  });
});
