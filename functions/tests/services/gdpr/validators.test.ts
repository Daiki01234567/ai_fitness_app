/**
 * GDPR validators test
 */
import { Timestamp } from "firebase-admin/firestore";

const mockGet = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockCount = jest.fn();
const mockCollection = jest.fn();

jest.mock("../../../src/utils/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection,
  })),
  userRef: jest.fn(() => ({
    get: mockGet,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: mockGet })),
      count: jest.fn(() => ({ get: jest.fn(() => Promise.resolve({ data: () => ({ count: 1 }) })) })),
    })),
  })),
  sessionsCollection: jest.fn(() => ({
    count: jest.fn(() => ({ get: jest.fn(() => Promise.resolve({ data: () => ({ count: 5 }) })) })),
  })),
  consentsCollection: jest.fn(() => ({
    where: jest.fn(() => ({
      count: jest.fn(() => ({ get: jest.fn(() => Promise.resolve({ data: () => ({ count: 2 }) })) })),
    })),
  })),
}));

import {
  hasRecentExportRequest,
  hasPendingDeletionRequest,
  countUserRecords,
} from "../../../src/services/gdpr/validators";

describe("GDPR Validators", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ empty: true })),
          })),
        })),
      })),
    });
    mockGet.mockResolvedValue({ exists: true });
  });

  describe("hasRecentExportRequest", () => {
    it("returns false when no recent export", async () => {
      const result = await hasRecentExportRequest("user123");
      expect(result).toBe(false);
    });
  });

  describe("hasPendingDeletionRequest", () => {
    it("returns false when no pending deletion", async () => {
      const result = await hasPendingDeletionRequest("user123");
      expect(result).toBe(false);
    });
  });

  describe("countUserRecords", () => {
    it("counts all user records", async () => {
      const count = await countUserRecords("user123");
      expect(count).toBeGreaterThan(0);
    });
  });
});
