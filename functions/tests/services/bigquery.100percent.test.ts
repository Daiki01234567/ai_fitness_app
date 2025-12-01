/**
 * BigQuery Service - 100% Coverage Tests
 * Tests for uncovered lines in bigquery.ts
 */

const mockDocRef = {
  delete: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
};

let mockInsertFn: jest.Mock;
let mockQueryFn: jest.Mock;
jest.mock("@google-cloud/bigquery", () => {
  mockInsertFn = jest.fn(() => Promise.resolve());
  mockQueryFn = jest.fn(() =>
    Promise.resolve([
      [{ total_users: 100, total_sessions: 500, overall_avg_score: 85.5 }],
    ])
  );

  const mockTable = {
    insert: mockInsertFn,
  };
  const mockDataset = {
    table: jest.fn(() => mockTable),
  };
  const mockBigQuery = {
    dataset: jest.fn(() => mockDataset),
    query: mockQueryFn,
  };
  return { BigQuery: jest.fn(() => mockBigQuery) };
});

const mockFieldValue = {
  increment: jest.fn((n: number) => n),
  serverTimestamp: jest.fn(() => new Date()),
};

jest.mock("firebase-admin", () => {
  const firestoreFn = jest.fn(() => ({
    FieldValue: mockFieldValue,
  }));
  (firestoreFn as unknown as Record<string, unknown>).FieldValue =
    mockFieldValue;
  return {
    apps: [{ name: "test" }],
    initializeApp: jest.fn(),
    firestore: firestoreFn,
  };
});

jest.mock("../../src/utils/firestore", () => ({
  bigquerySyncFailuresCollection: jest.fn(() => ({
    add: jest.fn(() => Promise.resolve({ id: "f1" })),
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            empty: true,
            docs: [],
            size: 0,
          })
        ),
      })),
    })),
  })),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock("../../src/utils/logger");

import { BigQueryService } from "../../src/services/bigquery";
import { User } from "../../src/types/firestore";

describe("BigQuery Service - 100% Coverage", () => {
  let service: BigQueryService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertFn.mockReset();
    mockInsertFn.mockResolvedValue(undefined);
    mockDocRef.delete.mockReset();
    mockDocRef.delete.mockResolvedValue(undefined);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("hashData - missing ANONYMIZATION_SALT", () => {
    it("should use empty string fallback when ANONYMIZATION_SALT is undefined", () => {
      // Remove ANONYMIZATION_SALT to hit line 84 fallback
      delete process.env.ANONYMIZATION_SALT;
      process.env.GCLOUD_PROJECT = "test-project";

      service = new BigQueryService("test-project");

      const user: Partial<User> = {
        birthYear: 1990,
        gender: "male",
        fitnessLevel: "intermediate",
        createdAt: { toDate: () => new Date("2025-01-01") } as any,
      };

      // This will call hashData internally, which should use the ?? "" fallback
      const result = service.anonymizeUser("user123", user as User);
      
      // Verify that hash was generated (even without ANONYMIZATION_SALT)
      expect(result.user_hash).toBeDefined();
      expect(result.user_hash).toHaveLength(16);
    });

    it("should produce different hash when ANONYMIZATION_SALT is present vs absent", () => {
      // First, hash with ANONYMIZATION_SALT
      process.env.ANONYMIZATION_SALT = "test-salt";
      process.env.GCLOUD_PROJECT = "test-project";
      const service1 = new BigQueryService("test-project");
      
      const user: Partial<User> = {
        birthYear: 1990,
        gender: "male",
      };
      const hash1 = service1.anonymizeUser("user123", user as User).user_hash;

      // Then, hash without ANONYMIZATION_SALT (using fallback)
      delete process.env.ANONYMIZATION_SALT;
      const service2 = new BigQueryService("test-project");
      const hash2 = service2.anonymizeUser("user123", user as User).user_hash;

      // Hashes should be different because different salts
      expect(hash1).not.toBe(hash2);
    });
  });
});
