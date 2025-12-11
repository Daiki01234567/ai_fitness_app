/**
 * Stripe Customerサービスのテスト
 * チケット031: Stripe統合基盤
 *
 * テスト対象:
 * - getOrCreateStripeCustomer
 * - getStripeCustomerId
 * - validateStripeCustomer（内部関数）
 * - エラーハンドリング
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import {
  getOrCreateStripeCustomer,
  getStripeCustomerId,
  removeStripeCustomerId,
  deleteStripeCustomer,
} from "../../src/services/stripe";
import { resetStripeClient, setStripeClient } from "../../src/utils/stripe";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockTimestamp = {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
    delete: jest.fn(() => null),
  };

  const mockDocRef = {
    get: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollection),
    FieldValue: mockFieldValue,
  };

  return {
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: mockFieldValue,
    }),
  };
});

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

describe("Stripe Customer Service", () => {
  // Mock Stripe client
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
        del: jest.fn(),
        update: jest.fn(),
        list: jest.fn(),
      } as unknown as Stripe.CustomersResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock Firestore
    mockFirestore = admin.firestore();
    mockDocRef = (mockFirestore.collection("users") as unknown as { doc: () => typeof mockDocRef }).doc();

    // Reset environment variables
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
  });

  afterEach(() => {
    resetStripeClient();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("getOrCreateStripeCustomer", () => {
    const testUserId = "test-user-123";
    const testEmail = "test@example.com";
    const testCustomerId = "cus_test123456";

    describe("success cases", () => {
      it("should return existing customer ID when found in Firestore", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            stripeCustomerId: testCustomerId,
            email: testEmail,
          }),
        });

        (mockStripeClient.customers?.retrieve as jest.Mock).mockResolvedValue({
          id: testCustomerId,
          email: testEmail,
          deleted: false,
        });

        // Act
        const result = await getOrCreateStripeCustomer(testUserId, testEmail);

        // Assert
        expect(result).toEqual({
          customerId: testCustomerId,
          isNew: false,
        });
        expect(mockStripeClient.customers?.create).not.toHaveBeenCalled();
        expect(mockDocRef.update).not.toHaveBeenCalled();
      });

      it("should create new customer when not found in Firestore", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        (mockStripeClient.customers?.create as jest.Mock).mockResolvedValue({
          id: testCustomerId,
          email: testEmail,
        });

        mockDocRef.update.mockResolvedValue(undefined);

        // Act
        const result = await getOrCreateStripeCustomer(testUserId, testEmail);

        // Assert
        expect(result).toEqual({
          customerId: testCustomerId,
          isNew: true,
        });
        expect(mockStripeClient.customers?.create).toHaveBeenCalledWith({
          email: testEmail,
          metadata: {
            firebaseUID: testUserId,
            createdAt: expect.any(String),
          },
          description: `AI Fitness App User: ${testUserId}`,
        });
        expect(mockDocRef.update).toHaveBeenCalledWith({
          stripeCustomerId: testCustomerId,
          updatedAt: expect.anything(),
        });
      });

      it("should create new customer when existing customer is deleted", async () => {
        // Arrange
        const deletedCustomerId = "cus_deleted123";
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            stripeCustomerId: deletedCustomerId,
            email: testEmail,
          }),
        });

        (mockStripeClient.customers?.retrieve as jest.Mock).mockResolvedValue({
          id: deletedCustomerId,
          deleted: true,
        });

        (mockStripeClient.customers?.create as jest.Mock).mockResolvedValue({
          id: testCustomerId,
          email: testEmail,
        });

        mockDocRef.update.mockResolvedValue(undefined);

        // Act
        const result = await getOrCreateStripeCustomer(testUserId, testEmail);

        // Assert
        expect(result).toEqual({
          customerId: testCustomerId,
          isNew: true,
        });
        expect(mockStripeClient.customers?.create).toHaveBeenCalled();
      });

      it("should create new customer when customer not found in Stripe", async () => {
        // Arrange
        const notFoundCustomerId = "cus_notfound123";
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            stripeCustomerId: notFoundCustomerId,
            email: testEmail,
          }),
        });

        // Use a real StripeInvalidRequestError to match isStripeError check
        const stripeError = new Stripe.errors.StripeInvalidRequestError({
          message: "No such customer",
          type: "invalid_request_error",
          code: "resource_missing",
        } as Stripe.errors.StripeRawError);
        (stripeError as { code: string }).code = "resource_missing";
        (mockStripeClient.customers?.retrieve as jest.Mock).mockRejectedValue(stripeError);

        (mockStripeClient.customers?.create as jest.Mock).mockResolvedValue({
          id: testCustomerId,
          email: testEmail,
        });

        mockDocRef.update.mockResolvedValue(undefined);

        // Act
        const result = await getOrCreateStripeCustomer(testUserId, testEmail);

        // Assert
        expect(result).toEqual({
          customerId: testCustomerId,
          isNew: true,
        });
      });
    });

    describe("error cases", () => {
      it("should throw error when user document not found", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: false,
        });

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          `User document not found for userId: ${testUserId}`
        );
      });

      it("should throw error when userId is empty", async () => {
        // Act & Assert
        await expect(getOrCreateStripeCustomer("", testEmail)).rejects.toThrow(
          "userId is required and must be a string"
        );
      });

      it("should throw error when email is empty", async () => {
        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, "")).rejects.toThrow(
          "email is required and must be a string"
        );
      });

      it("should throw ExternalServiceError on Stripe API error", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        const stripeError = new Stripe.errors.StripeAPIError({
          message: "API Error",
          type: "api_error",
        } as Stripe.errors.StripeRawError);
        (mockStripeClient.customers?.create as jest.Mock).mockRejectedValue(stripeError);

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          "決済サービスで一時的なエラーが発生しました"
        );
      });

      it("should throw ExternalServiceError on rate limit error", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        const stripeError = new Stripe.errors.StripeRateLimitError({
          message: "Rate limit exceeded",
          type: "rate_limit_error",
        } as Stripe.errors.StripeRawError);
        (mockStripeClient.customers?.create as jest.Mock).mockRejectedValue(stripeError);

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          "リクエストが多すぎます。しばらく待ってから再試行してください"
        );
      });

      it("should throw ExternalServiceError on connection error", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        const stripeError = new Stripe.errors.StripeConnectionError({
          message: "Connection error",
          type: "api_connection_error",
        } as Stripe.errors.StripeRawError);
        (mockStripeClient.customers?.create as jest.Mock).mockRejectedValue(stripeError);

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          "決済サービスへの接続に失敗しました"
        );
      });

      it("should throw ExternalServiceError on authentication error", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        const stripeError = new Stripe.errors.StripeAuthenticationError({
          message: "Invalid API Key",
          type: "invalid_request_error",
        } as Stripe.errors.StripeRawError);
        (mockStripeClient.customers?.create as jest.Mock).mockRejectedValue(stripeError);

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          "決済サービスの認証に失敗しました"
        );
      });

      it("should throw ExternalServiceError on card error", async () => {
        // Arrange
        mockDocRef.get.mockResolvedValue({
          exists: true,
          data: () => ({
            email: testEmail,
          }),
        });

        const stripeError = new Stripe.errors.StripeCardError({
          message: "Card declined",
          type: "card_error",
        } as Stripe.errors.StripeRawError);
        (mockStripeClient.customers?.create as jest.Mock).mockRejectedValue(stripeError);

        // Act & Assert
        await expect(getOrCreateStripeCustomer(testUserId, testEmail)).rejects.toThrow(
          "カード処理中にエラーが発生しました"
        );
      });
    });
  });

  describe("getStripeCustomerId", () => {
    const testUserId = "test-user-123";
    const testCustomerId = "cus_test123456";

    it("should return customer ID when found", async () => {
      // Arrange
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          stripeCustomerId: testCustomerId,
        }),
      });

      // Act
      const result = await getStripeCustomerId(testUserId);

      // Assert
      expect(result).toBe(testCustomerId);
    });

    it("should return null when user document not found", async () => {
      // Arrange
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      // Act
      const result = await getStripeCustomerId(testUserId);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when stripeCustomerId not set", async () => {
      // Arrange
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
        }),
      });

      // Act
      const result = await getStripeCustomerId(testUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("removeStripeCustomerId", () => {
    const testUserId = "test-user-123";

    it("should remove Stripe fields from user document", async () => {
      // Arrange
      mockDocRef.update.mockResolvedValue(undefined);

      // Act
      await removeStripeCustomerId(testUserId);

      // Assert
      expect(mockDocRef.update).toHaveBeenCalledWith({
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: "free",
        updatedAt: expect.anything(),
      });
    });
  });

  describe("deleteStripeCustomer", () => {
    const testCustomerId = "cus_test123456";

    it("should delete Stripe customer successfully", async () => {
      // Arrange
      (mockStripeClient.customers?.del as jest.Mock).mockResolvedValue({
        id: testCustomerId,
        deleted: true,
      });

      // Act
      await deleteStripeCustomer(testCustomerId);

      // Assert
      expect(mockStripeClient.customers?.del).toHaveBeenCalledWith(testCustomerId);
    });

    it("should not throw when customer not found", async () => {
      // Arrange - use actual Stripe error class for isStripeError check
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such customer",
        type: "invalid_request_error",
        code: "resource_missing",
      } as Stripe.errors.StripeRawError);
      (stripeError as { code: string }).code = "resource_missing";
      (mockStripeClient.customers?.del as jest.Mock).mockRejectedValue(stripeError);

      // Act & Assert
      await expect(deleteStripeCustomer(testCustomerId)).resolves.not.toThrow();
    });

    it("should throw on other Stripe errors", async () => {
      // Arrange
      const stripeError = new Error("API Error") as Stripe.errors.StripeError;
      (stripeError as unknown as { type: string }).type = "StripeAPIError";
      stripeError.code = "api_error";
      (mockStripeClient.customers?.del as jest.Mock).mockRejectedValue(stripeError);

      // Act & Assert
      await expect(deleteStripeCustomer(testCustomerId)).rejects.toThrow("API Error");
    });
  });
});

describe("Stripe Type Guards", () => {
  describe("isStripeError", () => {
    it("should return true for Stripe errors", () => {
      const { isStripeError } = require("../../src/types/stripe");

      const stripeError = new Stripe.errors.StripeAPIError({
        message: "API Error",
        type: "api_error",
      } as Stripe.errors.StripeRawError);

      expect(isStripeError(stripeError)).toBe(true);
    });

    it("should return false for regular errors", () => {
      const { isStripeError } = require("../../src/types/stripe");

      const regularError = new Error("Regular error");
      expect(isStripeError(regularError)).toBe(false);
    });

    it("should return false for non-error values", () => {
      const { isStripeError } = require("../../src/types/stripe");

      expect(isStripeError(null)).toBe(false);
      expect(isStripeError(undefined)).toBe(false);
      expect(isStripeError("string")).toBe(false);
      expect(isStripeError(123)).toBe(false);
    });
  });

  describe("extractStripeErrorInfo", () => {
    it("should extract error information correctly", () => {
      const { extractStripeErrorInfo } = require("../../src/types/stripe");

      const stripeError = new Stripe.errors.StripeAPIError({
        message: "Test error message",
        type: "api_error",
        code: "test_code",
        param: "test_param",
      } as Stripe.errors.StripeRawError);

      const errorInfo = extractStripeErrorInfo(stripeError);

      expect(errorInfo).toEqual({
        type: "StripeAPIError",
        code: "test_code",
        message: "Test error message",
        param: "test_param",
        statusCode: undefined,
      });
    });
  });
});
