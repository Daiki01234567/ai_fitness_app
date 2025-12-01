/**
 * Audit Log Service - Admin Initialization Test
 * 
 * Tests admin SDK initialization when no apps exist (line 20)
 */

describe('auditLog admin initialization', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should initialize admin SDK when no apps exist (line 20)', () => {
    const mockInitializeApp = jest.fn();
    
    // Mock admin with NO apps to trigger line 20
    jest.doMock('firebase-admin', () => ({
      apps: [],  // Empty array triggers initialization
      initializeApp: mockInitializeApp,
      firestore: jest.fn(() => ({
        collection: jest.fn(),
      })),
    }));

    jest.doMock('firebase-admin/firestore', () => ({
      FieldValue: {
        serverTimestamp: jest.fn(() => new Date()),
      },
    }));

    jest.doMock('../../src/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      },
    }));

    // Require module to trigger initialization
    require('../../src/services/auditLog');

    // Verify initializeApp was called (line 20)
    expect(mockInitializeApp).toHaveBeenCalled();
  });
});
