/**
 * 領収書再送信APIのテスト
 * チケット040: 領収書生成・送信
 *
 * テスト対象:
 * - 認証チェック
 * - リクエストバリデーション
 * - レート制限
 * - 権限チェック
 * - 正常系
 * - Stripeエラーハンドリング
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

// onCall関数のハンドラを直接取得するためのモック
let resendReceiptHandler: (request: unknown) => Promise<unknown>;

// Firebase Functions v2のonCallをモック
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    resendReceiptHandler = handler;
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
const loadModule = () => require("../../../src/api/stripe/resendReceipt");

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

  const mockAggregateQuerySnapshot = {
    data: jest.fn(() => ({ count: 0 })),
  };

  const mockAggregateQuery = {
    get: jest.fn(() => Promise.resolve(mockAggregateQuerySnapshot)),
  };

  const mockQuery = {
    where: jest.fn(function(this: unknown) { return this; }),
    count: jest.fn(() => mockAggregateQuery),
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(),
    where: jest.fn(() => mockQuery),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollectionRef),
    FieldValue: mockFieldValue,
  };

  return {
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: mockFieldValue,
      Timestamp: {
        fromDate: jest.fn((date: Date) => ({
          toDate: () => date,
          toMillis: () => date.getTime(),
        })),
      },
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

// Mock sendReceiptEmail
jest.mock("../../../src/services/email/receiptEmail", () => ({
  sendReceiptEmail: jest.fn(),
  maskEmail: jest.fn((email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }),
}));

// Import mocked function for assertions
import { sendReceiptEmail } from "../../../src/services/email/receiptEmail";

describe("stripe_resendReceipt", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };
  let mockCollectionRef: {
    doc: jest.Mock;
    add: jest.Mock;
    where: jest.Mock;
  };
  let mockAggregateQuery: {
    get: jest.Mock;
  };

  const testUserId = "test-user-123";
  const testCustomerId = "cus_test123";
  const testInvoiceId = "in_test123";
  const testEmail = "test@example.com";

  // サンプルInvoiceデータ
  const mockInvoice: Partial<Stripe.Invoice> = {
    id: testInvoiceId,
    customer: testCustomerId,
    amount_paid: 980,
    currency: "jpy",
    status: "paid",
    invoice_pdf: "https://pay.stripe.com/invoice/in_test123/pdf",
    created: Math.floor(Date.now() / 1000),
  };

  beforeAll(() => {
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      invoices: {
        retrieve: jest.fn().mockResolvedValue(mockInvoice),
        list: jest.fn(),
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
    mockCollectionRef = mockFirestore.collection(
      "users"
    ) as unknown as typeof mockCollectionRef;
    mockDocRef = mockCollectionRef.doc() as unknown as typeof mockDocRef;

    // Setup aggregate query mock
    mockAggregateQuery = mockCollectionRef.where("mock", "==", "mock")
      .count() as unknown as typeof mockAggregateQuery;

    // Default: rate limit not exceeded
    mockAggregateQuery.get.mockResolvedValue({
      data: () => ({ count: 0 }),
    });

    // Default: sendReceiptEmail succeeds
    (sendReceiptEmail as jest.Mock).mockResolvedValue(true);

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
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("リクエストバリデーション", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("invoiceIdがない場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: {},
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("Invoice ID");
      }
    });

    it("無効なInvoice ID形式の場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: { invoiceId: "invalid_format" },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("形式");
      }
    });

    it("invoiceIdが文字列でない場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: { invoiceId: 12345 },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });

    it("リクエストデータがnullの場合はinvalid-argumentエラーを返す", async () => {
      const request = {
        auth: validAuth,
        data: null,
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("レート制限", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("1日5回の上限を超過した場合はresource-exhaustedエラーを返す", async () => {
      // Setup user document
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      // Rate limit exceeded (5 resends today)
      mockAggregateQuery.get.mockResolvedValue({
        data: () => ({ count: 5 }),
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
        expect((error as HttpsError).message).toContain("5回");
      }
    });

    it("上限未満の場合は処理を継続する", async () => {
      // Setup user document
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      // Rate limit not exceeded (4 resends today)
      mockAggregateQuery.get.mockResolvedValue({
        data: () => ({ count: 4 }),
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      const result = await resendReceiptHandler(request as unknown);
      expect(result).toBeDefined();
    });
  });

  describe("ユーザー検証", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("ユーザーが見つからない場合はnot-foundエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
        expect((error as HttpsError).message).toContain("ユーザー");
      }
    });

    it("Stripe顧客IDがない場合はfailed-preconditionエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          // stripeCustomerId is missing
        }),
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("課金情報");
      }
    });

    it("メールアドレスがない場合はfailed-preconditionエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          stripeCustomerId: testCustomerId,
          // email is missing
        }),
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("failed-precondition");
        expect((error as HttpsError).message).toContain("メールアドレス");
      }
    });
  });

  describe("Invoice所有権の検証", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("他人のInvoiceにアクセスした場合はpermission-deniedエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      // Invoice belongs to different customer
      (mockStripeClient.invoices?.retrieve as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        customer: "cus_different_customer",
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
        expect((error as HttpsError).message).toContain("権限");
      }
    });

    it("customerがオブジェクトの場合もIDを正しく比較する", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      // Customer is an object with id property
      (mockStripeClient.invoices?.retrieve as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        customer: { id: testCustomerId },
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      const result = await resendReceiptHandler(request as unknown);
      expect(result).toBeDefined();
    });
  });

  describe("Invoice PDF検証", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("Invoice PDFがない場合はnot-foundエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      // Invoice without PDF
      (mockStripeClient.invoices?.retrieve as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        invoice_pdf: null,
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
        expect((error as HttpsError).message).toContain("PDF");
      }
    });
  });

  describe("正常系", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    it("正常に領収書を再送信できる", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      const result = (await resendReceiptHandler(request as unknown)) as {
        success: boolean;
        data: {
          sent: boolean;
          invoiceId: string;
          email: string;
          sentAt: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.sent).toBe(true);
      expect(result.data.invoiceId).toBe(testInvoiceId);
      expect(result.data.email).toBe("t***t@example.com");
      expect(result.data.sentAt).toBeDefined();

      // sendReceiptEmail was called with correct parameters
      expect(sendReceiptEmail).toHaveBeenCalledWith({
        userId: testUserId,
        email: testEmail,
        invoiceId: testInvoiceId,
        invoicePdfUrl: mockInvoice.invoice_pdf,
        amount: mockInvoice.amount_paid,
        currency: mockInvoice.currency,
        type: "resend",
      });
    });

    it("メール送信失敗時はinternalエラーを返す", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });

      (sendReceiptEmail as jest.Mock).mockResolvedValue(false);

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
        expect((error as HttpsError).message).toContain("送信に失敗");
      }
    });
  });

  describe("Stripeエラーハンドリング", () => {
    const validAuth = {
      uid: testUserId,
      token: { email: testEmail },
    };

    beforeEach(() => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: testEmail,
          stripeCustomerId: testCustomerId,
        }),
      });
    });

    it("Invoiceが見つからない場合はnot-foundエラーを返す", async () => {
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: "No such invoice",
        type: "invalid_request_error",
        code: "resource_missing",
      } as Stripe.errors.StripeRawError);
      (stripeError as { code: string }).code = "resource_missing";

      (mockStripeClient.invoices?.retrieve as jest.Mock).mockRejectedValue(
        stripeError
      );

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("not-found");
        expect((error as HttpsError).message).toContain("Invoice");
      }
    });

    it("Stripeレート制限の場合はresource-exhaustedエラーを返す", async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError({
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.retrieve as jest.Mock).mockRejectedValue(
        stripeError
      );

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("Stripe接続エラーの場合はunavailableエラーを返す", async () => {
      const stripeError = new Stripe.errors.StripeConnectionError({
        message: "Connection failed",
        type: "api_connection_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.retrieve as jest.Mock).mockRejectedValue(
        stripeError
      );

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unavailable");
      }
    });

    it("その他のStripeエラーはinternalエラーを返す", async () => {
      const stripeError = new Stripe.errors.StripeAuthenticationError({
        message: "Invalid API key",
        type: "authentication_error",
      } as Stripe.errors.StripeRawError);

      (mockStripeClient.invoices?.retrieve as jest.Mock).mockRejectedValue(
        stripeError
      );

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("予期しないエラーはinternalエラーを返す", async () => {
      (mockStripeClient.invoices?.retrieve as jest.Mock).mockRejectedValue(
        new Error("Unexpected error")
      );

      const request = {
        auth: validAuth,
        data: { invoiceId: testInvoiceId },
      };

      await expect(resendReceiptHandler(request as unknown)).rejects.toThrow(
        HttpsError
      );

      try {
        await resendReceiptHandler(request as unknown);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });
  });
});
