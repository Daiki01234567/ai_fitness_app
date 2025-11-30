/**
 * BigQuery Service Tests
 */

jest.mock('@google-cloud/bigquery', () => {
  const mockTable = {
    insert: jest.fn(() => Promise.resolve()),
  };
  const mockDataset = {
    table: jest.fn(() => mockTable),
  };
  const mockBigQuery = {
    dataset: jest.fn(() => mockDataset),
    query: jest.fn(() => Promise.resolve([[{ total_users: 100 }]])),
  };
  return { BigQuery: jest.fn(() => mockBigQuery) };
});

jest.mock('firebase-admin', () => ({
  apps: [{ name: 'test' }],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({ FieldValue: { increment: jest.fn() } })),
}));

jest.mock('../../src/utils/firestore', () => ({
  bigquerySyncFailuresCollection: jest.fn(() => ({
    add: jest.fn(() => Promise.resolve({ id: 'f1' })),
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ empty: true, docs: [], size: 0 })),
      })),
    })),
  })),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('../../src/utils/logger');

import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryService } from '../../src/services/bigquery';
import { logger } from '../../src/utils/logger';
import { User, Session } from '../../src/types/firestore';

describe('BigQuery Service', () => {
  let service: BigQueryService;
  let mockBigQuery: any;
  let mockTable: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCLOUD_PROJECT = 'test-project';
    process.env.ANONYMIZATION_SALT = 'test-salt';
    service = new BigQueryService('test-project');
    mockBigQuery = (BigQuery as jest.MockedClass<typeof BigQuery>).mock.results[0].value;
    mockTable = mockBigQuery.dataset().table();
  });

  describe('anonymizeUser', () => {
    it('should anonymize user data', () => {
      const user: Partial<User> = {
        birthYear: 1990,
        gender: 'male',
        fitnessLevel: 'intermediate',
        createdAt: { toDate: () => new Date('2025-01-01') } as any,
      };
      const result = service.anonymizeUser('user123', user as User);
      expect(result.birth_year_range).toBe('1990s');
      expect(result.gender).toBe('male');
      expect(result.user_hash).toBeDefined();
    });
  });

  describe('insertRows', () => {
    it('should insert rows', async () => {
      await service.insertRows('test_table', [{ data: 'test' }]);
      expect(mockTable.insert).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('should skip empty rows', async () => {
      await service.insertRows('test_table', []);
      expect(mockTable.insert).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data', async () => {
      await service.deleteUserData('user123');
      expect(mockBigQuery.query).toHaveBeenCalledTimes(2);
    });
  });
});
