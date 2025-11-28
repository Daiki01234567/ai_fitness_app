/**
 * Record Consent API Tests
 *
 * Tests for the recordConsent Cloud Function
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

// Setup mocks before importing the function
jest.mock("firebase-admin");
jest.mock("firebase-functions/v2/https");

// Mock the CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireCsrfProtection: jest.fn(() => true),
}));

// Import after mocks
import { recordConsent } from "../../../src/api/consent/record";

describe("recordConsent", () => {
  const mockFirestore = admin.firestore() as jest.Mocked<admin.firestore.Firestore>;
  const mockAuth = admin.auth() as jest.Mocked<admin.auth.Auth>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when not logged in", async () => {
      const request = {
        data: { type: "tos", version: "3.2", accepted: true },
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect(recordConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "unauthenticated",
        }),
      );
    });
  });

  describe("Validation", () => {
    it("should throw invalid-argument for missing type", async () => {
      const request = {
        data: { version: "3.2", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: { headers: { "x-csrf-token": "valid-token" } },
      };

      await expect(recordConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "invalid-argument",
        }),
      );
    });

    it("should throw invalid-argument for invalid consent type", async () => {
      const request = {
        data: { type: "invalid", version: "3.2", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: { headers: { "x-csrf-token": "valid-token" } },
      };

      await expect(recordConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "invalid-argument",
        }),
      );
    });

    it("should throw invalid-argument for missing version", async () => {
      const request = {
        data: { type: "tos", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: { headers: { "x-csrf-token": "valid-token" } },
      };

      await expect(recordConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "invalid-argument",
        }),
      );
    });
  });

  describe("Success cases", () => {
    it("should record ToS consent successfully", async () => {
      // Setup mocks
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({ path: "consents/test-doc" }),
      });
      (mockFirestore.doc as jest.Mock).mockReturnValue({
        path: "users/test-uid",
      });

      const request = {
        data: { type: "tos", version: "3.2", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-agent",
          },
        },
      };

      const result = await recordConsent(request as any);

      expect(result).toEqual({
        success: true,
        consentId: expect.any(String),
      });
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("should record Privacy Policy consent successfully", async () => {
      // Setup mocks
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({ path: "consents/test-doc" }),
      });
      (mockFirestore.doc as jest.Mock).mockReturnValue({
        path: "users/test-uid",
      });

      const request = {
        data: { type: "privacy", version: "3.1", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-agent",
          },
        },
      };

      const result = await recordConsent(request as any);

      expect(result).toEqual({
        success: true,
        consentId: expect.any(String),
      });
    });
  });

  describe("IP Anonymization", () => {
    it("should anonymize IPv4 address", async () => {
      // Setup mocks
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({ path: "consents/test-doc" }),
      });
      (mockFirestore.doc as jest.Mock).mockReturnValue({
        path: "users/test-uid",
      });

      const request = {
        data: { type: "tos", version: "3.2", accepted: true },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.100",
            "user-agent": "test-agent",
          },
        },
      };

      await recordConsent(request as any);

      // Verify the consent record was created with anonymized IP
      const setCall = mockBatch.set.mock.calls[0];
      if (setCall && setCall[1]) {
        expect(setCall[1].ipAddress).not.toBe("192.168.1.100");
        // Should be hashed or anonymized
        expect(typeof setCall[1].ipAddress).toBe("string");
      }
    });
  });
});
