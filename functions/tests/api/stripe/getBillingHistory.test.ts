/**
 * 課金履歴取得APIのテスト
 * チケット039: 課金履歴API
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let getBillingHistoryHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    getBillingHistoryHandler = handler;
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
const loadModule = () => require("../../../src/api/stripe/getBillingHistory");

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

describe("stripe_getBillingHistory", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  const testCustomerId = "cus_test123";

  // サンプルInvoiceデータ
  const mockInvoices: Partial<Stripe.Invoice>[] = [
    {
      id: "in_test001",
      amount_paid: 980,
      currency: "jpy",
      status: "paid",
      created: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
      status_transitions: {
        paid_at: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
        finalized_at: null,
        marked_uncollectible_at: null,
        voided_at: null,
      },
      invoice_pdf: "https://pay.stripe.com/invoice/in_test001/pdf",
      description: null,
      lines: {
        object: "list",
        data: [
          {
            id: "li_test001",
            description: "Premium Monthly Plan",
          } as Stripe.InvoiceLineItem,
        ],
        has_more: false,
        url: "/v1/invoices/in_test001/lines",
      },
    },
    {
      id: "in_test002",
      amount_paid: 980,
      currency: "jpy",
      status: "paid",
      created: Math.floor(Date.now() / 1000),
      status_transitions: {
        paid_at: Math.floor(Date.now() / 1000),
        finalized_at: null,
        marked_uncollectible_at: null,
        voided_at: null,
      },
      invoice_pdf: "https://pay.stripe.com/invoice/in_test002/pdf",
      description: null,
      lines: {
        object: "list",
        data: [
          {
            id: "li_test002",
            description: "Premium Monthly Plan",
          } as Stripe.InvoiceLineItem,
        ],
        has_more: false,
        url: "/v1/invoices/in_test002/lines",
      },
    },
  ];

  beforeAll(() => {
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      invoices: {
        list: jest.fn().mockResolvedValue({
          data: mockInvoices,
          has_more: false,
          object: "list",
        }),
        retrieve: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        del: jest.fn(),
        finalizeInvoice: jest.fn(),
        pay: jest.fn(),
        sendInvoice: jest.fn(),
        voidInvoice: jest.fn(),
        markUncollectible: jest.fn(),
        listLineItems: jest.fn(),
        listUpcomingLines: jest.fn(),
        retrieveUpcoming: jest.fn(),
        addLines: jest.fn(),
        removeLines: jest.fn(),
        updateLines: jest.fn(),
        createPreview: jest.fn(),
      } as unknown as Stripe.InvoicesResource,
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

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("リクエストバリデーション", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("limitが範囲外の場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: { limit: 150 },
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("limit");
      }
    });

    it("limitが数値でない場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: { limit: "ten" },
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("startingAfterが無効な形式の場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: { startingAfter: "invalid_id" },
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("startingAfter");
      }
    });
  });

  describe("Stripe顧客IDがない場合", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("空の結果を返す", async () => {
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

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: { payments: unknown[]; hasMore: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments).toHaveLength(0);
      expect(result.data.hasMore).toBe(false);
    });

    it("ユーザードキュメントがない場合はnot-foundエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
      }
    });
  });

  describe("課金履歴取得", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("課金履歴を正常に取得できる", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: {
          payments: Array<{
            id: string;
            amount: number;
            currency: string;
            status: string;
            paidAt: string | null;
            invoicePdfUrl: string | null;
            description: string;
          }>;
          hasMore: boolean;
          nextCursor?: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments).toHaveLength(2);
      expect(result.data.payments[0].id).toBe("in_test001");
      expect(result.data.payments[0].amount).toBe(980);
      expect(result.data.payments[0].currency).toBe("jpy");
      expect(result.data.payments[0].status).toBe("paid");
      expect(result.data.payments[0].invoicePdfUrl).toContain("stripe.com");
      expect(result.data.payments[0].description).toBe("Premium Monthly Plan");
      expect(result.data.hasMore).toBe(false);
    });

    it("指定したlimitでInvoice一覧を取得できる", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const request = {
        auth: validAuth,
        data: { limit: 5 },
      };

      await getBillingHistoryHandler(request as unknown);

      expect(mockStripeClient.invoices?.list).toHaveBeenCalledWith({
        customer: testCustomerId,
        limit: 5,
      });
    });

    it("startingAfterを指定してページネーションができる", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const request = {
        auth: validAuth,
        data: { startingAfter: "in_test001" },
      };

      await getBillingHistoryHandler(request as unknown);

      expect(mockStripeClient.invoices?.list).toHaveBeenCalledWith({
        customer: testCustomerId,
        limit: 10,
        starting_after: "in_test001",
      });
    });

    it("次のページがある場合はhasMore=trueとnextCursorを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      (mockStripeClient.invoices?.list as jest.Mock).mockResolvedValue({
        data: mockInvoices,
        has_more: true,
        object: "list",
      });

      const request = {
        auth: validAuth,
        data: { limit: 2 },
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: {
          payments: unknown[];
          hasMore: boolean;
          nextCursor?: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.hasMore).toBe(true);
      expect(result.data.nextCursor).toBe("in_test002");
    });

    it("支払い履歴がない場合は空配列を返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      (mockStripeClient.invoices?.list as jest.Mock).mockResolvedValue({
        data: [],
        has_more: false,
        object: "list",
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: { payments: unknown[]; hasMore: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments).toHaveLength(0);
      expect(result.data.hasMore).toBe(false);
    });

    it("paidAtがnullの場合でもcreated日時を使用する", async () => {
      const invoiceWithoutPaidAt: Partial<Stripe.Invoice> = {
        id: "in_test_nopaid",
        amount_paid: 980,
        currency: "jpy",
        status: "paid",
        created: Math.floor(Date.now() / 1000),
        status_transitions: {
          paid_at: null,
          finalized_at: null,
          marked_uncollectible_at: null,
          voided_at: null,
        },
        invoice_pdf: "https://pay.stripe.com/invoice/in_test_nopaid/pdf",
        description: null,
        lines: {
          object: "list",
          data: [
            {
              id: "li_test",
              description: "Test Plan",
            } as Stripe.InvoiceLineItem,
          ],
          has_more: false,
          url: "/v1/invoices/in_test_nopaid/lines",
        },
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      (mockStripeClient.invoices?.list as jest.Mock).mockResolvedValue({
        data: [invoiceWithoutPaidAt],
        has_more: false,
        object: "list",
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: {
          payments: Array<{ paidAt: string | null }>;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments[0].paidAt).not.toBeNull();
    });

    it("descriptionがない場合はデフォルト値を使用する", async () => {
      const invoiceWithoutDescription: Partial<Stripe.Invoice> = {
        id: "in_test_nodesc",
        amount_paid: 980,
        currency: "jpy",
        status: "paid",
        created: Math.floor(Date.now() / 1000),
        status_transitions: {
          paid_at: Math.floor(Date.now() / 1000),
          finalized_at: null,
          marked_uncollectible_at: null,
          voided_at: null,
        },
        invoice_pdf: null,
        description: null,
        lines: {
          object: "list",
          data: [],
          has_more: false,
          url: "/v1/invoices/in_test_nodesc/lines",
        },
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      (mockStripeClient.invoices?.list as jest.Mock).mockResolvedValue({
        data: [invoiceWithoutDescription],
        has_more: false,
        object: "list",
      });

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: {
          payments: Array<{ description: string; invoicePdfUrl: string | null }>;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments[0].description).toBe("サブスクリプション");
      expect(result.data.payments[0].invoicePdfUrl).toBeNull();
    });
  });

  describe("エラーハンドリング", () => {
    const validAuth = {
      uid: "test-user-123",
      token: { email: "test@example.com" },
    };

    it("Stripeで顧客が見つからない場合は空の結果を返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such customer",
        type: "invalid_request_error",
        code: "resource_missing",
      } as Stripe.errors.StripeRawError);
      (stripeError as { code: string }).code = "resource_missing";

      (mockStripeClient.invoices?.list as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: { payments: unknown[]; hasMore: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments).toHaveLength(0);
      expect(result.data.hasMore).toBe(false);
    });

    it("Stripeレート制限エラーの場合はresource-exhaustedを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.list as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("Stripe接続エラーの場合はunavailableを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const stripeError = new Stripe.errors.StripeConnectionError({
        message: "Connection failed",
        type: "api_connection_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.list as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unavailable");
      }
    });

    it("無効なstartingAfterの場合は空の結果を返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "Invalid starting_after",
        type: "invalid_request_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.list as jest.Mock).mockRejectedValue(stripeError);

      const request = {
        auth: validAuth,
        data: { startingAfter: "in_nonexistent" },
      };

      const result = await getBillingHistoryHandler(request as unknown) as {
        success: boolean;
        data: { payments: unknown[]; hasMore: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data.payments).toHaveLength(0);
      expect(result.data.hasMore).toBe(false);
    });

    it("予期しないエラーの場合はinternalエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "test@example.com",
          stripeCustomerId: testCustomerId,
        }),
      });

      (mockStripeClient.invoices?.list as jest.Mock).mockRejectedValue(new Error("Unknown error"));

      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(getBillingHistoryHandler(request as unknown)).rejects.toThrow(HttpsError);

      try {
        await getBillingHistoryHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
