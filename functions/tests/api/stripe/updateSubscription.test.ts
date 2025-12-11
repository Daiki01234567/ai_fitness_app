/**
 * サブスクリプション更新APIのテスト
 * チケット034: サブスクリプション更新API
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let updateSubscriptionHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    updateSubscriptionHandler = handler;
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
const loadModule = () => require("../../../src/api/stripe/updateSubscription");

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

describe("stripe_updateSubscription", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  const testSubscriptionId = "sub_test123";
  const testPriceId = "price_yearly_5000";
  const testItemId = "si_test123";

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
          items: {
            data: [
              {
                id: testItemId,
                current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                price: {
                  id: "price_monthly_500",
                },
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: testSubscriptionId,
          status: "active",
          created: Math.floor(Date.now() / 1000),
          items: {
            data: [
              {
                id: testItemId,
                current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                price: {
                  id: testPriceId,
                },
              },
            ],
          },
        }),
        cancel: jest.fn(),
        list: jest.fn(),
        create: jest.fn(),
      } as unknown as Stripe.SubscriptionsResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock Firestore
    mockFirestore = admin.firestore();
    mockDocRef = (mockFirestore.collection("users") as unknown as { doc: () => typeof mockDocRef }).doc();

    // Default Firestore mock
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        email: "test@example.com",
        stripeSubscriptionId: testSubscriptionId,
      }),
    });

    mockDocRef.update.mockResolvedValue(undefined);

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
          newPriceId: testPriceId,
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
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

    it("newPriceIdが空の場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          newPriceId: "",
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("newPriceId");
      }
    });

    it("prorationBehaviorが無効な値の場合はエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
          prorationBehavior: "invalid_behavior",
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("prorationBehavior");
      }
    });
  });

  describe("サブスクリプションなしの場合", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("サブスクリプションがない場合はfailed-preconditionエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
        }),
      });

      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("サブスクリプションが見つかりません");
      }
    });
  });

  describe("成功ケース", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("サブスクリプションを正常に更新できる", async () => {
      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
        },
      };

      const result = await updateSubscriptionHandler(request as unknown) as { success: boolean; data: { subscriptionId: string; newPriceId: string; status: string } };

      expect(result.success).toBe(true);
      expect(result.data.subscriptionId).toBe(testSubscriptionId);
      expect(result.data.newPriceId).toBe(testPriceId);
      expect(result.data.status).toBe("active");
    });

    it("Firestoreが更新される", async () => {
      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
        },
      };

      await updateSubscriptionHandler(request as unknown);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionPlan: testPriceId,
          updatedAt: expect.anything(),
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("解約済みサブスクリプションの場合はfailed-preconditionエラーを返す", async () => {
      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: testSubscriptionId,
        status: "canceled",
        created: Math.floor(Date.now() / 1000),
        items: {
          data: [
            {
              id: testItemId,
              current_period_end: Math.floor(Date.now() / 1000),
              price: { id: "price_monthly_500" },
            },
          ],
        },
      });

      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("解約済み");
      }
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.subscriptions?.update as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          newPriceId: testPriceId,
        },
      };

      await expect(updateSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await updateSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });
  });
});
