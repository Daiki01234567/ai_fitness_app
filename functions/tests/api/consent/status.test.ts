/**
 * Get Consent Status API Tests
 *
 * Tests for the getConsentStatus Cloud Function
 */

import * as admin from "firebase-admin";

// Setup mocks before importing the function
jest.mock("firebase-admin");
jest.mock("firebase-functions/v2/https");

// Import after mocks
import { getConsentStatus } from "../../../src/api/consent/status";

describe("getConsentStatus", () => {
  const mockFirestore = admin.firestore() as jest.Mocked<admin.firestore.Firestore>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when not logged in", async () => {
      const request = {
        data: {},
        auth: null,
      };

      await expect(getConsentStatus(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "unauthenticated",
        }),
      );
    });
  });

  describe("Get status", () => {
    it("should return consent status for authenticated user", async () => {
      // Mock user document
      const mockUserDoc = {
        exists: true,
        data: () => ({
          tosAccepted: true,
          ppAccepted: true,
          tosVersion: "3.2",
          ppVersion: "3.1",
          tosAcceptedAt: { toDate: () => new Date("2025-01-01") },
          ppAcceptedAt: { toDate: () => new Date("2025-01-01") },
        }),
      };

      // Mock consent history
      const mockConsentsSnapshot = {
        docs: [
          {
            id: "consent-1",
            data: () => ({
              type: "tos",
              version: "3.2",
              accepted: true,
              timestamp: { toDate: () => new Date("2025-01-01") },
              method: "explicit",
            }),
          },
          {
            id: "consent-2",
            data: () => ({
              type: "privacy",
              version: "3.1",
              accepted: true,
              timestamp: { toDate: () => new Date("2025-01-01") },
              method: "explicit",
            }),
          },
        ],
      };

      (mockFirestore.doc as jest.Mock).mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserDoc),
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockConsentsSnapshot),
      });

      const request = {
        data: {},
        auth: { uid: "test-uid" },
      };

      const result = await getConsentStatus(request as any);

      expect(result).toEqual({
        tosAccepted: true,
        ppAccepted: true,
        tosVersion: "3.2",
        ppVersion: "3.1",
        tosAcceptedAt: expect.any(String),
        ppAcceptedAt: expect.any(String),
        needsUpdate: false,
        history: expect.arrayContaining([
          expect.objectContaining({
            type: "tos",
            version: "3.2",
            accepted: true,
          }),
        ]),
      });
    });

    it("should return needsUpdate true when version mismatch", async () => {
      // Mock user document with old version
      const mockUserDoc = {
        exists: true,
        data: () => ({
          tosAccepted: true,
          ppAccepted: true,
          tosVersion: "3.0", // Old version
          ppVersion: "3.0", // Old version
          tosAcceptedAt: { toDate: () => new Date("2025-01-01") },
          ppAcceptedAt: { toDate: () => new Date("2025-01-01") },
        }),
      };

      const mockConsentsSnapshot = {
        docs: [],
      };

      (mockFirestore.doc as jest.Mock).mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserDoc),
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockConsentsSnapshot),
      });

      const request = {
        data: {},
        auth: { uid: "test-uid" },
      };

      const result = await getConsentStatus(request as any);

      expect(result.needsUpdate).toBe(true);
    });

    it("should return default values when user not found", async () => {
      // Mock non-existent user document
      const mockUserDoc = {
        exists: false,
        data: () => null,
      };

      const mockConsentsSnapshot = {
        docs: [],
      };

      (mockFirestore.doc as jest.Mock).mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserDoc),
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockConsentsSnapshot),
      });

      const request = {
        data: {},
        auth: { uid: "test-uid" },
      };

      const result = await getConsentStatus(request as any);

      expect(result).toEqual({
        tosAccepted: false,
        ppAccepted: false,
        tosVersion: null,
        ppVersion: null,
        tosAcceptedAt: null,
        ppAcceptedAt: null,
        needsUpdate: true,
        history: [],
      });
    });
  });

  describe("History retrieval", () => {
    it("should include consent history in response", async () => {
      // Mock user document
      const mockUserDoc = {
        exists: true,
        data: () => ({
          tosAccepted: true,
          ppAccepted: true,
          tosVersion: "3.2",
          ppVersion: "3.1",
          tosAcceptedAt: { toDate: () => new Date("2025-01-15") },
          ppAcceptedAt: { toDate: () => new Date("2025-01-15") },
        }),
      };

      // Mock consent history with multiple entries
      const mockConsentsSnapshot = {
        docs: [
          {
            id: "consent-1",
            data: () => ({
              type: "tos",
              version: "3.2",
              accepted: true,
              timestamp: { toDate: () => new Date("2025-01-15") },
              method: "explicit",
            }),
          },
          {
            id: "consent-2",
            data: () => ({
              type: "tos",
              version: "3.1",
              accepted: true,
              timestamp: { toDate: () => new Date("2025-01-01") },
              method: "explicit",
            }),
          },
          {
            id: "consent-3",
            data: () => ({
              type: "privacy",
              version: "3.1",
              accepted: true,
              timestamp: { toDate: () => new Date("2025-01-15") },
              method: "explicit",
            }),
          },
        ],
      };

      (mockFirestore.doc as jest.Mock).mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserDoc),
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockConsentsSnapshot),
      });

      const request = {
        data: { includeHistory: true },
        auth: { uid: "test-uid" },
      };

      const result = await getConsentStatus(request as any);

      expect(result.history).toHaveLength(3);
      expect(result.history[0]).toEqual(
        expect.objectContaining({
          type: "tos",
          version: "3.2",
        }),
      );
    });
  });
});
