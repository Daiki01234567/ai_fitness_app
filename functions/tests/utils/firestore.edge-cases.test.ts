/**
 * Firestore Edge Cases Tests
 */

import * as admin from "firebase-admin";

jest.mock("firebase-admin", () => {
  const mockDocRef = {
    id: "doc-123",
    path: "users/user-123",
    get: jest.fn(() => Promise.resolve({
      exists: true,
      id: "doc-123",
      data: () => ({ name: "Test User" }),
    })),
  };

  const mockFirestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => mockDocRef),
    })),
    doc: jest.fn(() => mockDocRef),
    FieldValue: {
      serverTimestamp: jest.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
    },
    Timestamp: {
      fromDate: jest.fn((date) => ({
        toDate: () => date,
        toMillis: () => date.getTime(),
      })),
    },
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
  };
});

describe("Firestore Edge Cases", () => {
  describe("paginateQuery edge cases", () => {
    it("should handle invalid page token JSON", async () => {
      const { paginateQuery } = require("../../src/utils/firestore");
      
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        startAfter: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({ docs: [] })),
      };
      
      const invalidToken = Buffer.from("{invalid json").toString("base64");
      await paginateQuery(mockQuery, 10, invalidToken);
      
      expect(mockQuery.limit).toHaveBeenCalledWith(11);
    });

    it("should generate nextPageToken when more results available", async () => {
      const { paginateQuery } = require("../../src/utils/firestore");
      
      const mockDocs = Array.from({ length: 11 }, (_, i) => ({
        id: `doc-${i}`,
        ref: { path: `users/doc-${i}` },
        data: () => ({ name: `User ${i}` }),
      }));
      
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({ docs: mockDocs })),
      };
      
      const result = await paginateQuery(mockQuery, 10);
      
      expect(result.hasMore).toBe(true);
      expect(result.nextPageToken).toBeDefined();
      expect(result.items).toHaveLength(10);
    });
  });
});
