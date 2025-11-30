/**
 * Audit Log Service Tests
 */
jest.mock('firebase-admin', () => {
  const mockDocRef = { id: 'audit-log-123' };
  let shouldThrowError = false;
  const mockCollection = {
    add: jest.fn(() => shouldThrowError ? Promise.reject(new Error('error')) : Promise.resolve(mockDocRef)),
  };
  const mockFirestore = { collection: jest.fn(() => mockCollection) };
  return {
    apps: [{}],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    __setThrowError: (v) => { shouldThrowError = v; },
    __resetMocks: () => { shouldThrowError = false; jest.clearAllMocks(); },
  };
});

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => ({ toDate: () => new Date() })) },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import * as admin from 'firebase-admin';
import { createAuditLog, logProfileUpdate, logConsentAction, logAuthAction, logSecurityEvent, logAdminAction } from '../../src/services/auditLog';
import { logger } from '../../src/utils/logger';

describe('Audit Log Service', () => {
  const mockAdmin = admin as any;
  beforeEach(() => { mockAdmin.__resetMocks(); process.env.AUDIT_SALT = 'test'; });
  afterEach(() => { delete process.env.AUDIT_SALT; });

  describe('createAuditLog', () => {
    it('creates log entry', async () => {
      const logId = await createAuditLog({ userId: 'u1', action: 'profile_update', resourceType: 'user', success: true });
      expect(logId).toBe('audit-log-123');
      expect(logger.info).toHaveBeenCalled();
    });

    it('hashes user ID', async () => {
      await createAuditLog({ userId: 'u1', action: 'login', resourceType: 'auth', success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].userId).toHaveLength(16);
    });

    it('sanitizes sensitive data', async () => {
      await createAuditLog({ userId: 'u1', action: 'profile_update', resourceType: 'user', previousValues: { password: 'secret', name: 'John' }, success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].previousValues.password).toBe('[REDACTED]');
      expect(col.add.mock.calls[0][0].previousValues.name).toBe('John');
    });

    it('returns empty on error', async () => {
      mockAdmin.__setThrowError(true);
      const logId = await createAuditLog({ userId: 'u1', action: 'login', resourceType: 'auth', success: true });
      expect(logId).toBe('');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logProfileUpdate', () => {
    it('logs profile update with changed fields', async () => {
      await logProfileUpdate({ userId: 'u1', previousValues: { name: 'A' }, newValues: { name: 'B' }, ipAddress: '1.1.1.1', success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].changedFields).toEqual(['name']);
    });

    it('hashes IP address', async () => {
      await logProfileUpdate({ userId: 'u1', newValues: { name: 'B' }, ipAddress: '1.1.1.1', success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].ipAddressHash).toHaveLength(16);
    });
  });

  describe('logConsentAction', () => {
    it('logs consent acceptance', async () => {
      await logConsentAction({ userId: 'u1', action: 'consent_accept', consentType: 'tos', version: '1.0' });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].resourceId).toBe('tos_1.0');
    });

    it('logs consent withdrawal', async () => {
      await logConsentAction({ userId: 'u1', action: 'consent_withdraw', consentType: 'pp', version: '2.0' });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].action).toBe('consent_withdraw');
    });
  });

  describe('logAuthAction', () => {
    it('logs login', async () => {
      await logAuthAction({ userId: 'u1', action: 'login', method: 'email', success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].metadata.method).toBe('email');
    });

    it('logs failed login', async () => {
      await logAuthAction({ userId: 'u1', action: 'login', success: false, errorMessage: 'bad' });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].errorMessage).toBe('bad');
    });

    it('logs password change', async () => {
      await logAuthAction({ userId: 'u1', action: 'password_change', success: true });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].action).toBe('password_change');
    });
  });

  describe('logSecurityEvent', () => {
    it('logs security event', async () => {
      await logSecurityEvent({ userId: 'u1', eventType: 'attack', severity: 'high', details: {} });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].metadata.severity).toBe('high');
    });
  });

  describe('logAdminAction', () => {
    it('logs admin action', async () => {
      await logAdminAction({ adminUserId: 'a1', targetUserId: 'u2', action: 'view', details: {} });
      const col = admin.firestore().collection('auditLogs') as any;
      expect(col.add.mock.calls[0][0].newValues.targetUser).toHaveLength(16);
    });
  });
});
