/**
 * Checkout Session作成APIのテスト
 * チケット032: サブスクリプション作成API
 *
 * テスト対象:
 * - 認証チェック
 * - リクエストバリデーション
 * - Checkout Session作成
 * - エラーハンドリング
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let createCheckoutSessionHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    // ハンドラをキャプチャ
    createCheckoutSessionHandler = handler;
    return handler;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

// インポートを遅延させて、モックが先に適用されるようにする
const loadModule = () => require("../../../src/api/stripe/createCheckoutSession");

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
jest.mock("../../../src/utils/logger", () => ({
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

// Mock getOrCreateStripeCustomer
jest.mock("../../../src/services/stripe", () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

describe("stripe_createCheckoutSession", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockGetOrCreateStripeCustomer: jest.Mock;

  const testCustomerId = "cus_test123";
  const testSessionId = "cs_test_session123";
  const testSessionUrl = "https://checkout.stripe.com/pay/cs_test_session123";

  beforeAll(() => {
    // モジュールをロードしてハンドラをキャプチャ
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: testSessionId,
            url: testSessionUrl,
          }),
          retrieve: jest.fn(),
          list: jest.fn(),
          expire: jest.fn(),
        },
      } as unknown as Stripe.Checkout,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock getOrCreateStripeCustomer
    mockGetOrCreateStripeCustomer = require("../../../src/services/stripe").getOrCreateStripeCustomer;
    mockGetOrCreateStripeCustomer.mockResolvedValue({
      customerId: testCustomerId,
      isNew: false,
    });

    // Setup environment
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
  });

  afterEach(() => {
    resetStripeClient();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("認証チェック", () => {
    it("認証なしの場合はunauthenticatedエラーを返す", async () => {
      const request = {
        auth: undefined,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("バリデーション", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("priceIdが空の場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("priceId");
      }
    });

    it("priceIdがprice_で始まらない場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "invalid_price_id",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("successUrlが無効な場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "invalid-url",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("successUrl");
      }
    });

    it("cancelUrlが無効な場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("cancelUrl");
      }
    });
  });

  describe("成功ケース", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Checkout Sessionを正常に作成できる", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      const result = await createCheckoutSessionHandler(request as any) as { success: boolean; data: { sessionId: string; url: string } };

      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBe(testSessionId);
      expect(result.data.url).toBe(testSessionUrl);
    });

    it("Stripe Checkout Sessionに正しいパラメータが渡される", async () => {
      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await createCheckoutSessionHandler(request as any);

      expect(mockStripeClient.checkout?.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: testCustomerId,
          line_items: [{ price: "price_monthly_500", quantity: 1 }],
          mode: "subscription",
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
          subscription_data: expect.objectContaining({
            trial_period_days: 7,
            metadata: { firebaseUID: "test-user-123" },
          }),
          allow_promotion_codes: true,
          locale: "ja",
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Stripe価格エラーの場合はinvalid-argumentを返す", async () => {
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such price: price_invalid",
        type: "invalid_request_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.checkout?.sessions.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          priceId: "price_invalid",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.checkout?.sessions.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("Stripe接続エラーの場合はunavailableを返す", async () => {
      const stripeError = new Stripe.errors.StripeConnectionError({
        message: "Connection error",
        type: "api_connection_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.checkout?.sessions.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unavailable");
      }
    });

    it("予期しないエラーの場合はinternalを返す", async () => {
      const unexpectedError = new Error("Unexpected error");

      (mockStripeClient.checkout?.sessions.create as jest.Mock).mockRejectedValue(unexpectedError);

      const request = {
        auth: validAuth,
        data: {
          priceId: "price_monthly_500",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      };

      await expect(createCheckoutSessionHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createCheckoutSessionHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
