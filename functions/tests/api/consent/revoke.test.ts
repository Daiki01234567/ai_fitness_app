/**
 * Revoke Consent API Tests
 *
 * Tests for the revokeConsent Cloud Function
 */

import * as admin from "firebase-admin";

// Setup mocks before importing the function
jest.mock("firebase-admin");
jest.mock("firebase-functions/v2/https");

// Mock the CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireStrictCsrfProtection: jest.fn(() => true),
}));

// Import after mocks
import { revokeConsent } from "../../../src/api/consent/revoke";

describe("revokeConsent", () => {
  const mockFirestore = admin.firestore() as jest.Mocked<admin.firestore.Firestore>;
  const mockAuth = admin.auth() as jest.Mocked<admin.auth.Auth>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when not logged in", async () => {
      const request = {
        data: { type: "tos" },
        auth: null,
        rawRequest: { headers: {} },
      };

      await expect(revokeConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "unauthenticated",
        }),
      );
    });
  });

  describe("Validation", () => {
    it("should throw invalid-argument for invalid consent type", async () => {
      const request = {
        data: { type: "invalid" },
        auth: { uid: "test-uid" },
        rawRequest: { headers: { "x-csrf-token": "valid-token" } },
      };

      await expect(revokeConsent(request as any)).rejects.toThrow(
        expect.objectContaining({
          code: "invalid-argument",
        }),
      );
    });
  });

  describe("Revoke single consent type", () => {
    it("should revoke ToS consent and set forceLogout", async () => {
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
      (mockAuth.setCustomUserClaims as jest.Mock).mockResolvedValue(undefined);
      (mockAuth.revokeRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      const request = {
        data: { type: "tos" },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-agent",
          },
        },
      };

      const result = await revokeConsent(request as any);

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
      });

      // Verify forceLogout custom claim was set
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        "test-uid",
        expect.objectContaining({ forceLogout: true }),
      );

      // Verify refresh tokens were revoked
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("test-uid");
    });
  });

  describe("Revoke all consents", () => {
    it("should revoke all consents when type is 'all'", async () => {
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
      (mockAuth.setCustomUserClaims as jest.Mock).mockResolvedValue(undefined);
      (mockAuth.revokeRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      const request = {
        data: { type: "all" },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-agent",
          },
        },
      };

      const result = await revokeConsent(request as any);

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
      });

      // Should create revocation records for both ToS and Privacy
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data deletion request", () => {
    it("should create data deletion request when requestDataDeletion is true", async () => {
      // Setup mocks
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({ path: "consents/test-doc" }),
        add: jest.fn().mockResolvedValue({ id: "deletion-request-id" }),
      });
      (mockFirestore.doc as jest.Mock).mockReturnValue({
        path: "users/test-uid",
      });
      (mockAuth.setCustomUserClaims as jest.Mock).mockResolvedValue(undefined);
      (mockAuth.revokeRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      const request = {
        data: { type: "all", requestDataDeletion: true },
        auth: { uid: "test-uid" },
        rawRequest: {
          headers: {
            "x-csrf-token": "valid-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-agent",
          },
        },
      };

      const result = await revokeConsent(request as any);

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
        dataDeletionRequested: true,
      });

      // Should update user document with deletionScheduled flag
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          deletionScheduled: true,
        }),
      );
    });
  });
});
