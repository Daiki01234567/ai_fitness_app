/**
 * Setup Intent作成APIのテスト
 * チケット037: 課金失敗時の再試行
 *
 * テスト対象:
 * - 認証チェック
 * - Stripe Customerの存在確認
 * - Setup Intent作成
 * - エラーハンドリング
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let createSetupIntentHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    // ハンドラをキャプチャ
    createSetupIntentHandler = handler;
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
const loadModule = () => require("../../../src/api/stripe/createSetupIntent");

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

describe("stripe_createSetupIntent", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestoreDocGet: jest.Mock;

  const testCustomerId = "cus_test123";
  const testSetupIntentId = "seti_test123";
  const testClientSecret = "seti_test123_secret_456";

  beforeAll(() => {
    // モジュールをロードしてハンドラをキャプチャ
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      setupIntents: {
        create: jest.fn().mockResolvedValue({
          id: testSetupIntentId,
          client_secret: testClientSecret,
        }),
        retrieve: jest.fn(),
        update: jest.fn(),
        confirm: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
      } as unknown as Stripe.SetupIntentsResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock Firestore
    mockFirestoreDocGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        stripeCustomerId: testCustomerId,
        email: "test@example.com",
      }),
    });

    const mockDocRef = {
      get: mockFirestoreDocGet,
      update: jest.fn(),
      set: jest.fn(),
    };

    const mockCollection = {
      doc: jest.fn(() => mockDocRef),
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue({
      collection: jest.fn(() => mockCollection),
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
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("ユーザー検証", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("ユーザードキュメントが存在しない場合はnot-foundエラーを返す", async () => {
      mockFirestoreDocGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });

    it("Stripe Customerが存在しない場合はnot-foundエラーを返す", async () => {
      mockFirestoreDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          // stripeCustomerId がない
        }),
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(
        HttpsError,
      );

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
        expect((error as HttpsError).message).toContain("Stripe Customer");
      }
    });
  });

  describe("成功ケース", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Setup Intentを正常に作成できる", async () => {
      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await createSetupIntentHandler(request as any) as {
        success: boolean;
        data: { clientSecret: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.clientSecret).toBe(testClientSecret);
    });

    it("Stripe Setup Intentに正しいパラメータが渡される", async () => {
      const request = {
        auth: validAuth,
        data: {},
      };

      await createSetupIntentHandler(request as any);

      expect(mockStripeClient.setupIntents?.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: testCustomerId,
          payment_method_types: ["card"],
          usage: "off_session",
          metadata: expect.objectContaining({
            firebaseUID: "test-user-123",
            purpose: "card_update",
          }),
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Stripe Customerエラーの場合はnot-foundを返す", async () => {
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such customer: cus_test123",
        type: "invalid_request_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.setupIntents?.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });

    it("Stripe InvalidRequestエラーの場合はinvalid-argumentを返す", async () => {
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "Invalid request",
        type: "invalid_request_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.setupIntents?.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.setupIntents?.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("Stripe接続エラーの場合はunavailableを返す", async () => {
      const stripeError = new Stripe.errors.StripeConnectionError({
        message: "Connection error",
        type: "api_connection_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.setupIntents?.create as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unavailable");
      }
    });

    it("予期しないエラーの場合はinternalを返す", async () => {
      const unexpectedError = new Error("Unexpected error");

      (mockStripeClient.setupIntents?.create as jest.Mock).mockRejectedValue(unexpectedError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("client_secretがない場合はinternalエラーを返す", async () => {
      (mockStripeClient.setupIntents?.create as jest.Mock).mockResolvedValue({
        id: testSetupIntentId,
        client_secret: null, // client_secretがない
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(createSetupIntentHandler(request as any)).rejects.toThrow(HttpsError);

      try {
        await createSetupIntentHandler(request as any);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
