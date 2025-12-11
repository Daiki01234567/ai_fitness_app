/**
 * サブスクリプション取得APIのテスト
 * チケット033: サブスクリプション確認API
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let getSubscriptionHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    getSubscriptionHandler = handler;
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

// モジュールをロード
const loadModule = () => require("../../../src/api/stripe/getSubscription");

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

describe("stripe_getSubscription", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  const testSubscriptionId = "sub_test123";
  const testPriceId = "price_monthly_500";

  beforeAll(() => {
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue({
          id: testSubscriptionId,
          status: "active",
          created: Math.floor(Date.now() / 1000),
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [
              {
                id: "si_test123",
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                price: {
                  id: testPriceId,
                  nickname: "Premium Monthly",
                },
              },
            ],
          },
        }),
        update: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
        create: jest.fn(),
      } as unknown as Stripe.SubscriptionsResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock Firestore
    mockFirestore = admin.firestore();
    mockDocRef = (mockFirestore.collection("users") as unknown as { doc: () => typeof mockDocRef }).doc();

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
        data: {},
      };

      await expect(getSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("サブスクリプションなしの場合", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("サブスクリプションがない場合はhasSubscription=falseを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
        }),
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getSubscriptionHandler(request as unknown) as { success: boolean; data: { hasSubscription: boolean } };

      expect(result.success).toBe(true);
      expect(result.data.hasSubscription).toBe(false);
    });

    it("ユーザードキュメントがない場合はnot-foundエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("サブスクリプションありの場合", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("アクティブなサブスクリプション情報を取得できる", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeSubscriptionId: testSubscriptionId,
        }),
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getSubscriptionHandler(request as unknown) as { success: boolean; data: { hasSubscription: boolean; subscription?: { id: string; status: string; planName: string; cancelAtPeriodEnd: boolean } } };

      expect(result.success).toBe(true);
      expect(result.data.hasSubscription).toBe(true);
      expect(result.data.subscription).toBeDefined();
      expect(result.data.subscription?.id).toBe(testSubscriptionId);
      expect(result.data.subscription?.status).toBe("active");
      expect(result.data.subscription?.planName).toBe("Premium Monthly");
      expect(result.data.subscription?.cancelAtPeriodEnd).toBe(false);
    });

    it("トライアル中のサブスクリプションでtrialEndが返される", async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: testSubscriptionId,
        status: "trialing",
        created: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        trial_end: trialEnd,
        items: {
          data: [
            {
              id: "si_test123",
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              price: {
                id: testPriceId,
                nickname: "Premium Monthly",
              },
            },
          ],
        },
      });

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeSubscriptionId: testSubscriptionId,
        }),
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getSubscriptionHandler(request as unknown) as { success: boolean; data: { subscription?: { status: string; trialEnd?: string } } };

      expect(result.success).toBe(true);
      expect(result.data.subscription?.status).toBe("trialing");
      expect(result.data.subscription?.trialEnd).toBeDefined();
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Stripeでサブスクリプションが見つからない場合はhasSubscription=falseを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeSubscriptionId: testSubscriptionId,
        }),
      });

      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such subscription",
        type: "invalid_request_error",
        code: "resource_missing",
      } as Stripe.errors.StripeRawError);
      (stripeError as { code: string }).code = "resource_missing";

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getSubscriptionHandler(request as unknown) as { success: boolean; data: { hasSubscription: boolean } };

      expect(result.success).toBe(true);
      expect(result.data.hasSubscription).toBe(false);
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeSubscriptionId: testSubscriptionId,
        }),
      });

      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });
  });
});
