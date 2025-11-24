/**
 * Firestore Security Rules Test Suite
 *
 * Tests for AI Fitness App Firestore security rules
 * GDPR compliant with field-level access control
 *
 * @version 1.0.0
 * @date 2025-11-24
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const PROJECT_ID = 'ai-fitness-test';
const RULES_PATH = '../firestore.rules';

// Test data
const TEST_UID = 'test-user-123';
const OTHER_UID = 'other-user-456';
const ADMIN_UID = 'admin-user-789';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Load the rules file
    const rulesContent = fs.readFileSync(path.resolve(__dirname, RULES_PATH), 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host: 'localhost',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  // ==============================================
  // Helper Functions
  // ==============================================

  function getAuthContext(uid: string, customClaims?: any): RulesTestContext {
    return testEnv.authenticatedContext(uid, customClaims);
  }

  function getUnauthContext(): RulesTestContext {
    return testEnv.unauthenticatedContext();
  }

  async function createTestUser(uid: string, data?: any) {
    const adminDb = testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        email: `${uid}@test.com`,
        tosAccepted: true,
        ppAccepted: true,
        isActive: true,
        deletionScheduled: false,
        forceLogout: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...data
      });
    });
  }

  // ==============================================
  // Users Collection Tests
  // ==============================================

  describe('Users Collection', () => {

    describe('Read Operations', () => {
      beforeEach(async () => {
        await createTestUser(TEST_UID);
      });

      test('Should allow user to read their own document', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();
        await assertSucceeds(getDoc(doc(db, 'users', TEST_UID)));
      });

      test('Should deny user from reading another user document', async () => {
        const context = getAuthContext(OTHER_UID);
        const db = context.firestore();
        await assertFails(getDoc(doc(db, 'users', TEST_UID)));
      });

      test('Should deny unauthenticated access', async () => {
        const context = getUnauthContext();
        const db = context.firestore();
        await assertFails(getDoc(doc(db, 'users', TEST_UID)));
      });

      test('Should deny access if user is scheduled for deletion', async () => {
        await createTestUser(TEST_UID, { deletionScheduled: true });
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();
        await assertFails(getDoc(doc(db, 'users', TEST_UID)));
      });

      test('Should deny access if user has forceLogout flag', async () => {
        const context = getAuthContext(TEST_UID, { forceLogout: true });
        const db = context.firestore();
        await assertFails(getDoc(doc(db, 'users', TEST_UID)));
      });
    });

    describe('Create Operations', () => {
      test('Should allow user to create their own document with valid data', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const userData = {
          userId: TEST_UID,
          email: 'test@example.com',
          tosAccepted: true,
          ppAccepted: true,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertSucceeds(setDoc(doc(db, 'users', TEST_UID), userData));
      });

      test('Should deny creation with invalid email', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const userData = {
          userId: TEST_UID,
          email: 'invalid-email',
          tosAccepted: true,
          ppAccepted: true,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(setDoc(doc(db, 'users', TEST_UID), userData));
      });

      test('Should deny creation without consent', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const userData = {
          userId: TEST_UID,
          email: 'test@example.com',
          tosAccepted: false,
          ppAccepted: false,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(setDoc(doc(db, 'users', TEST_UID), userData));
      });

      test('Should deny creation for different user ID', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const userData = {
          userId: OTHER_UID,
          email: 'test@example.com',
          tosAccepted: true,
          ppAccepted: true,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(setDoc(doc(db, 'users', OTHER_UID), userData));
      });
    });

    describe('Update Operations', () => {
      beforeEach(async () => {
        await createTestUser(TEST_UID);
      });

      test('Should allow updating profile data', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        await assertSucceeds(updateDoc(doc(db, 'users', TEST_UID), {
          profile: {
            height: 175,
            weight: 70,
            gender: 'male'
          },
          updatedAt: serverTimestamp()
        }));
      });

      test('Should deny updating read-only fields (tosAccepted)', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
          tosAccepted: false,
          updatedAt: serverTimestamp()
        }));
      });

      test('Should deny updating read-only fields (ppAccepted)', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
          ppAccepted: false,
          updatedAt: serverTimestamp()
        }));
      });

      test('Should deny updating read-only fields (deletionScheduled)', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
          deletionScheduled: true,
          updatedAt: serverTimestamp()
        }));
      });

      test('Should validate profile data ranges', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        // Invalid height (too tall)
        await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
          profile: {
            height: 300
          },
          updatedAt: serverTimestamp()
        }));

        // Invalid weight (too light)
        await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
          profile: {
            weight: 20
          },
          updatedAt: serverTimestamp()
        }));
      });
    });

    describe('Delete Operations', () => {
      beforeEach(async () => {
        await createTestUser(TEST_UID);
      });

      test('Should deny user from deleting their own document', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();
        await assertFails(deleteDoc(doc(db, 'users', TEST_UID)));
      });
    });
  });

  // ==============================================
  // Sessions Subcollection Tests
  // ==============================================

  describe('Sessions Subcollection', () => {
    beforeEach(async () => {
      await createTestUser(TEST_UID);
    });

    describe('Create Operations', () => {
      test('Should allow creating valid session', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const sessionData = {
          sessionId: 'session-123',
          userId: TEST_UID,
          exerciseType: 'squat',
          startTime: serverTimestamp(),
          status: 'active',
          repCount: 0,
          setCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertSucceeds(
          setDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123'), sessionData)
        );
      });

      test('Should validate exercise types', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const sessionData = {
          sessionId: 'session-123',
          userId: TEST_UID,
          exerciseType: 'invalid-exercise',
          startTime: serverTimestamp(),
          status: 'active',
          repCount: 0,
          setCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(
          setDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123'), sessionData)
        );
      });

      test('Should enforce poseData size limit', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        // Create array with more than 10000 items
        const largePoseData = new Array(10001).fill({ x: 0, y: 0, z: 0 });

        const sessionData = {
          sessionId: 'session-123',
          userId: TEST_UID,
          exerciseType: 'squat',
          startTime: serverTimestamp(),
          status: 'active',
          repCount: 0,
          setCount: 1,
          poseData: largePoseData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(
          setDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123'), sessionData)
        );
      });

      test('Should deny creation for users scheduled for deletion', async () => {
        await createTestUser(TEST_UID, { deletionScheduled: true });

        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const sessionData = {
          sessionId: 'session-123',
          userId: TEST_UID,
          exerciseType: 'squat',
          startTime: serverTimestamp(),
          status: 'active',
          repCount: 0,
          setCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await assertFails(
          setDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123'), sessionData)
        );
      });
    });

    describe('Delete Operations', () => {
      test('Should deny deleting sessions', async () => {
        // First create a session with admin privileges
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123'), {
            sessionId: 'session-123',
            userId: TEST_UID,
            exerciseType: 'squat'
          });
        });

        const context = getAuthContext(TEST_UID);
        const db = context.firestore();
        await assertFails(deleteDoc(doc(db, 'users', TEST_UID, 'sessions', 'session-123')));
      });
    });
  });

  // ==============================================
  // Consents Collection Tests
  // ==============================================

  describe('Consents Collection', () => {
    test('Should allow user to read their own consent records', async () => {
      // Create consent record with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'consents', 'consent-123'), {
          consentId: 'consent-123',
          userId: TEST_UID,
          type: 'tos',
          action: 'accept',
          version: '3.1',
          timestamp: serverTimestamp()
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertSucceeds(getDoc(doc(db, 'consents', 'consent-123')));
    });

    test('Should deny user from reading other users consent records', async () => {
      // Create consent record with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'consents', 'consent-123'), {
          consentId: 'consent-123',
          userId: OTHER_UID,
          type: 'tos',
          action: 'accept',
          version: '3.1',
          timestamp: serverTimestamp()
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertFails(getDoc(doc(db, 'consents', 'consent-123')));
    });

    test('Should deny creating consent records directly', async () => {
      const context = getAuthContext(TEST_UID);
      const db = context.firestore();

      const consentData = {
        consentId: 'consent-123',
        userId: TEST_UID,
        type: 'tos',
        action: 'accept',
        version: '3.1',
        timestamp: serverTimestamp()
      };

      await assertFails(setDoc(doc(db, 'consents', 'consent-123'), consentData));
    });

    test('Should deny updating consent records', async () => {
      // Create consent record with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'consents', 'consent-123'), {
          consentId: 'consent-123',
          userId: TEST_UID,
          type: 'tos',
          action: 'accept',
          version: '3.1',
          timestamp: serverTimestamp()
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertFails(updateDoc(doc(db, 'consents', 'consent-123'), {
        action: 'withdraw'
      }));
    });

    test('Should deny deleting consent records', async () => {
      // Create consent record with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'consents', 'consent-123'), {
          consentId: 'consent-123',
          userId: TEST_UID,
          type: 'tos',
          action: 'accept',
          version: '3.1',
          timestamp: serverTimestamp()
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertFails(deleteDoc(doc(db, 'consents', 'consent-123')));
    });
  });

  // ==============================================
  // DataDeletionRequests Collection Tests
  // ==============================================

  describe('DataDeletionRequests Collection', () => {
    test('Should allow user to create deletion request', async () => {
      const context = getAuthContext(TEST_UID);
      const db = context.firestore();

      const deletionRequest = {
        requestId: 'request-123',
        userId: TEST_UID,
        requestedAt: serverTimestamp(),
        scheduledDeletionDate: serverTimestamp(),
        status: 'pending'
      };

      await assertSucceeds(
        setDoc(doc(db, 'dataDeletionRequests', 'request-123'), deletionRequest)
      );
    });

    test('Should deny creating deletion request for another user', async () => {
      const context = getAuthContext(TEST_UID);
      const db = context.firestore();

      const deletionRequest = {
        requestId: 'request-123',
        userId: OTHER_UID,
        requestedAt: serverTimestamp(),
        scheduledDeletionDate: serverTimestamp(),
        status: 'pending'
      };

      await assertFails(
        setDoc(doc(db, 'dataDeletionRequests', 'request-123'), deletionRequest)
      );
    });

    test('Should allow user to read their own deletion request', async () => {
      // Create request with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'dataDeletionRequests', 'request-123'), {
          requestId: 'request-123',
          userId: TEST_UID,
          requestedAt: serverTimestamp(),
          scheduledDeletionDate: serverTimestamp(),
          status: 'pending'
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertSucceeds(getDoc(doc(db, 'dataDeletionRequests', 'request-123')));
    });

    test('Should deny updating deletion request', async () => {
      // Create request with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'dataDeletionRequests', 'request-123'), {
          requestId: 'request-123',
          userId: TEST_UID,
          requestedAt: serverTimestamp(),
          scheduledDeletionDate: serverTimestamp(),
          status: 'pending'
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertFails(updateDoc(doc(db, 'dataDeletionRequests', 'request-123'), {
        status: 'cancelled'
      }));
    });

    test('Should deny deleting deletion request', async () => {
      // Create request with admin privileges
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'dataDeletionRequests', 'request-123'), {
          requestId: 'request-123',
          userId: TEST_UID,
          requestedAt: serverTimestamp(),
          scheduledDeletionDate: serverTimestamp(),
          status: 'pending'
        });
      });

      const context = getAuthContext(TEST_UID);
      const db = context.firestore();
      await assertFails(deleteDoc(doc(db, 'dataDeletionRequests', 'request-123')));
    });
  });

  // ==============================================
  // Admin-only Collections Tests
  // ==============================================

  describe('Admin-only Collections', () => {
    describe('BigQuerySyncFailures Collection', () => {
      test('Should allow admin to read and write', async () => {
        const context = getAuthContext(ADMIN_UID, { admin: true });
        const db = context.firestore();

        const failureData = {
          failureId: 'failure-123',
          documentPath: '/users/test/sessions/session-123',
          error: 'Test error',
          timestamp: serverTimestamp()
        };

        await assertSucceeds(
          setDoc(doc(db, 'bigquerySyncFailures', 'failure-123'), failureData)
        );
      });

      test('Should deny non-admin access', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const failureData = {
          failureId: 'failure-123',
          documentPath: '/users/test/sessions/session-123',
          error: 'Test error',
          timestamp: serverTimestamp()
        };

        await assertFails(
          setDoc(doc(db, 'bigquerySyncFailures', 'failure-123'), failureData)
        );
      });
    });

    describe('SecurityIncidents Collection', () => {
      test('Should allow admin to read and write', async () => {
        const context = getAuthContext(ADMIN_UID, { admin: true });
        const db = context.firestore();

        const incidentData = {
          incidentId: 'incident-123',
          type: 'unauthorized_access',
          description: 'Test incident',
          timestamp: serverTimestamp()
        };

        await assertSucceeds(
          setDoc(doc(db, 'securityIncidents', 'incident-123'), incidentData)
        );
      });

      test('Should deny non-admin access', async () => {
        const context = getAuthContext(TEST_UID);
        const db = context.firestore();

        const incidentData = {
          incidentId: 'incident-123',
          type: 'unauthorized_access',
          description: 'Test incident',
          timestamp: serverTimestamp()
        };

        await assertFails(
          setDoc(doc(db, 'securityIncidents', 'incident-123'), incidentData)
        );
      });
    });
  });

  // ==============================================
  // Custom Claims Tests
  // ==============================================

  describe('Custom Claims', () => {
    test('Should deny access when forceLogout claim is true', async () => {
      await createTestUser(TEST_UID);

      const context = getAuthContext(TEST_UID, { forceLogout: true });
      const db = context.firestore();

      // Should fail to read
      await assertFails(getDoc(doc(db, 'users', TEST_UID)));

      // Should fail to update
      await assertFails(updateDoc(doc(db, 'users', TEST_UID), {
        profile: { height: 180 }
      }));
    });

    test('Should allow admin access with admin claim', async () => {
      const context = getAuthContext(ADMIN_UID, { admin: true });
      const db = context.firestore();

      // Admin should be able to access admin-only collections
      await assertSucceeds(getDoc(doc(db, 'bigquerySyncFailures', 'any-doc')));
      await assertSucceeds(getDoc(doc(db, 'securityIncidents', 'any-doc')));
    });
  });

  // ==============================================
  // Default Deny Rule Test
  // ==============================================

  describe('Default Deny Rule', () => {
    test('Should deny access to undefined paths', async () => {
      const context = getAuthContext(TEST_UID);
      const db = context.firestore();

      await assertFails(getDoc(doc(db, 'undefined-collection', 'doc-123')));
      await assertFails(setDoc(doc(db, 'undefined-collection', 'doc-123'), {
        data: 'test'
      }));
    });
  });
});