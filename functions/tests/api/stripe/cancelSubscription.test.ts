/**
 * サブスクリプション解約APIのテスト
 * チケット035: サブスクリプション解約API
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let cancelSubscriptionHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    cancelSubscriptionHandler = handler;
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
const loadModule = () => require("../../../src/api/stripe/cancelSubscription");

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

describe("stripe_cancelSubscription", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  const testSubscriptionId = "sub_test123";
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  beforeAll(() => {
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: testSubscriptionId,
          status: "active",
          cancel_at_period_end: true,
          created: Math.floor(Date.now() / 1000),
          items: {
            data: [
              {
                id: "si_test123",
                current_period_end: periodEnd,
              },
            ],
          },
        }),
        cancel: jest.fn().mockResolvedValue({
          id: testSubscriptionId,
          status: "canceled",
        }),
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
        data: {},
      };

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
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

    it("サブスクリプションがない場合はfailed-preconditionエラーを返す", async () => {
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

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("サブスクリプションが見つかりません");
      }
    });
  });

  describe("期間終了時解約（デフォルト）", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("期間終了時解約を正常に実行できる", async () => {
      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: false,
        },
      };

      const result = await cancelSubscriptionHandler(request as unknown) as { success: boolean; data: { subscriptionId: string; status: string; cancelAt?: string } };

      expect(result.success).toBe(true);
      expect(result.data.subscriptionId).toBe(testSubscriptionId);
      expect(result.data.status).toBe("active");
      expect(result.data.cancelAt).toBeDefined();
    });

    it("cancelImmediatelyなしの場合もデフォルトで期間終了時解約になる", async () => {
      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await cancelSubscriptionHandler(request as unknown) as { success: boolean; data: { status: string } };

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("active");
      expect(mockStripeClient.subscriptions?.update).toHaveBeenCalledWith(
        testSubscriptionId,
        { cancel_at_period_end: true },
      );
    });
  });

  describe("即時解約", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("即時解約を正常に実行できる", async () => {
      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      const result = await cancelSubscriptionHandler(request as unknown) as { success: boolean; data: { subscriptionId: string; status: string; cancelAt?: string } };

      expect(result.success).toBe(true);
      expect(result.data.subscriptionId).toBe(testSubscriptionId);
      expect(result.data.status).toBe("canceled");
      expect(result.data.cancelAt).toBeUndefined();
    });

    it("Stripe.subscriptions.cancelが呼ばれる", async () => {
      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await cancelSubscriptionHandler(request as unknown);

      expect(mockStripeClient.subscriptions?.cancel).toHaveBeenCalledWith(testSubscriptionId);
    });

    it("Firestoreでサブスクリプション情報がクリアされる", async () => {
      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await cancelSubscriptionHandler(request as unknown);

      expect(mockDocRef.update).toHaveBeenCalledWith({
        subscriptionStatus: "free",
        subscriptionPlan: null,
        stripeSubscriptionId: null,
        updatedAt: expect.anything(),
      });
    });

    it("解約完了メッセージが返される", async () => {
      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      const result = await cancelSubscriptionHandler(request as unknown) as { data: { message: string } };

      expect(result.data.message).toBe("サブスクリプションを解約しました");
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Stripeでサブスクリプションが見つからない場合はnot-foundエラーを返す", async () => {
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such subscription",
        type: "invalid_request_error",
        code: "resource_missing",
      } as Stripe.errors.StripeRawError);
      (stripeError as { code: string }).code = "resource_missing";

      (mockStripeClient.subscriptions?.cancel as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });

    it("既に解約済みの場合はfailed-preconditionエラーを返す", async () => {
      // Use a mock error object with message property containing "already canceled"
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "This subscription has already canceled.",
        type: "invalid_request_error",
      } as Stripe.errors.StripeRawError);

      // Set message to contain "already canceled"
      Object.defineProperty(stripeError, "message", {
        value: "This subscription has already canceled.",
        writable: false,
      });

      (mockStripeClient.subscriptions?.cancel as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("既に解約済み");
      }
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.subscriptions?.cancel as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("予期しないエラーの場合はinternalを返す", async () => {
      const unexpectedError = new Error("Unexpected error");

      (mockStripeClient.subscriptions?.cancel as jest.Mock).mockRejectedValue(unexpectedError);

      const request = {
        auth: validAuth,
        data: {
          cancelImmediately: true,
        },
      };

      await expect(cancelSubscriptionHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await cancelSubscriptionHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
