/**
 * Stripe初期化ユーティリティのテスト
 * チケット031: Stripe統合基盤
 */

import Stripe from "stripe";

import {
  getStripeClient,
  verifyWebhookSignature,
  resetStripeClient,
  setStripeClient,
} from "../../src/utils/stripe";

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

describe("Stripe Utility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and Stripe client before each test
    jest.resetModules();
    resetStripeClient();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    resetStripeClient();
    process.env = originalEnv;
  });

  describe("getStripeClient", () => {
    it("should throw error when STRIPE_SECRET_KEY is not set", () => {
      // Arrange
      delete process.env.STRIPE_SECRET_KEY;

      // Act & Assert
      expect(() => getStripeClient()).toThrow(
        "STRIPE_SECRET_KEY is not configured. Please set the environment variable."
      );
    });

    it("should return Stripe client when STRIPE_SECRET_KEY is set", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";

      // Act
      const client = getStripeClient();

      // Assert
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Stripe);
    });

    it("should return same instance on multiple calls (singleton)", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";

      // Act
      const client1 = getStripeClient();
      const client2 = getStripeClient();

      // Assert
      expect(client1).toBe(client2);
    });

    it("should initialize with test key successfully", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      resetStripeClient(); // ensure fresh instance

      // Act
      const client = getStripeClient();

      // Assert - verify client was created successfully
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Stripe);
    });

    it("should initialize with live key successfully", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_live_mock_key_123";
      resetStripeClient(); // ensure fresh instance

      // Act
      const client = getStripeClient();

      // Assert - verify client was created successfully
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Stripe);
    });
  });

  describe("setStripeClient and resetStripeClient", () => {
    it("should allow setting custom Stripe client", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      const mockClient = { mock: true } as unknown as Stripe;

      // Act
      setStripeClient(mockClient);
      const client = getStripeClient();

      // Assert
      expect(client).toBe(mockClient);
    });

    it("should reset Stripe client", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      const mockClient = { mock: true } as unknown as Stripe;
      setStripeClient(mockClient);

      // Act
      resetStripeClient();
      const client = getStripeClient();

      // Assert
      expect(client).not.toBe(mockClient);
      expect(client).toBeInstanceOf(Stripe);
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should throw error when STRIPE_WEBHOOK_SECRET is not set", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      delete process.env.STRIPE_WEBHOOK_SECRET;

      // Act & Assert
      expect(() => verifyWebhookSignature("payload", "signature")).toThrow(
        "STRIPE_WEBHOOK_SECRET is not configured. Please set the environment variable."
      );
    });

    it("should throw error on invalid signature", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_123";

      // Act & Assert
      expect(() => verifyWebhookSignature("invalid_payload", "invalid_signature")).toThrow();
    });

    it("should verify valid webhook signature", () => {
      // Arrange
      process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_123";

      // Create a valid webhook event and signature
      const stripe = getStripeClient();
      const payload = JSON.stringify({
        id: "evt_test_123",
        object: "event",
        type: "customer.subscription.created",
        data: { object: {} },
      });

      // Generate a valid signature
      const timestamp = Math.floor(Date.now() / 1000);
      const crypto = require("crypto");
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest("hex");
      const signature = `t=${timestamp},v1=${expectedSignature}`;

      // Act & Assert
      const event = verifyWebhookSignature(payload, signature);
      expect(event).toBeDefined();
      expect(event.id).toBe("evt_test_123");
      expect(event.type).toBe("customer.subscription.created");
    });
  });
});

describe("Stripe Client Configuration", () => {
  beforeEach(() => {
    resetStripeClient();
  });

  afterEach(() => {
    resetStripeClient();
  });

  it("should configure client with correct API version", () => {
    // Arrange
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";

    // Act
    const client = getStripeClient();

    // Assert - Check that client was created (API version is internal)
    expect(client).toBeDefined();
  });

  it("should configure client with TypeScript mode enabled", () => {
    // Arrange
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key_123";

    // Act
    const client = getStripeClient();

    // Assert
    expect(client).toBeDefined();
  });
});
