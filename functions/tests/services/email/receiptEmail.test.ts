/**
 * 領収書メール送信サービスのテスト
 * チケット040: 領収書生成・送信
 *
 * テスト対象:
 * - sendReceiptEmail: メール送信と履歴記録
 * - formatAmount: 金額フォーマット
 * - maskEmail: メールアドレスマスク
 */

import * as admin from "firebase-admin";

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

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(),
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

// Import after mocks
import {
  sendReceiptEmail,
  formatAmount,
  maskEmail,
} from "../../../src/services/email/receiptEmail";
import { SendReceiptEmailParams } from "../../../src/types/stripe";

describe("receiptEmail service", () => {
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockCollectionRef: {
    doc: jest.Mock;
    add: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFirestore = admin.firestore();
    mockCollectionRef = mockFirestore.collection("mock") as unknown as {
      doc: jest.Mock;
      add: jest.Mock;
    };
  });

  describe("formatAmount", () => {
    it("JPYの場合は円表示にする", () => {
      expect(formatAmount(500, "jpy")).toBe("500円");
      expect(formatAmount(1000, "JPY")).toBe("1,000円");
      expect(formatAmount(9800, "jpy")).toBe("9,800円");
    });

    it("大きい金額でも正しくカンマ区切りになる", () => {
      expect(formatAmount(100000, "jpy")).toBe("100,000円");
      expect(formatAmount(1234567, "jpy")).toBe("1,234,567円");
    });

    it("USDの場合は小数点以下2桁で表示", () => {
      expect(formatAmount(500, "usd")).toBe("5.00 USD");
      expect(formatAmount(1000, "usd")).toBe("10.00 USD");
      expect(formatAmount(9999, "USD")).toBe("99.99 USD");
    });

    it("EURの場合も小数点以下2桁で表示", () => {
      expect(formatAmount(500, "eur")).toBe("5.00 EUR");
      expect(formatAmount(1250, "EUR")).toBe("12.50 EUR");
    });

    it("その他の通貨も小数点以下2桁で表示", () => {
      expect(formatAmount(500, "gbp")).toBe("5.00 GBP");
      expect(formatAmount(500, "cad")).toBe("5.00 CAD");
    });
  });

  describe("maskEmail", () => {
    it("メールアドレスを正しくマスクする", () => {
      expect(maskEmail("test@example.com")).toBe("t***t@example.com");
      expect(maskEmail("hello@world.net")).toBe("h***o@world.net");
    });

    it("短いローカルパート（2文字以下）の場合は先頭1文字のみ表示", () => {
      expect(maskEmail("ab@example.com")).toBe("a***@example.com");
      expect(maskEmail("a@example.com")).toBe("a***@example.com");
    });

    it("長いローカルパートでも先頭と末尾1文字のみ表示", () => {
      expect(maskEmail("verylongemail@example.com")).toBe("v***l@example.com");
    });

    it("無効なメール形式（@なし）はそのまま返す", () => {
      expect(maskEmail("invalid-email")).toBe("invalid-email");
    });

    it("空文字はそのまま返す", () => {
      expect(maskEmail("")).toBe("");
    });
  });

  describe("sendReceiptEmail", () => {
    const validParams: SendReceiptEmailParams = {
      userId: "user-123",
      email: "test@example.com",
      invoiceId: "in_test123",
      invoicePdfUrl: "https://pay.stripe.com/invoice/in_test123/pdf",
      amount: 980,
      currency: "jpy",
      type: "auto",
    };

    it("正常にメール送信と履歴記録ができる", async () => {
      mockCollectionRef.add.mockResolvedValue({ id: "doc-123" });

      const result = await sendReceiptEmail(validParams);

      expect(result).toBe(true);

      // mail collectionへの追加を確認
      expect(mockFirestore.collection).toHaveBeenCalledWith("mail");
      expect(mockCollectionRef.add).toHaveBeenCalledTimes(2);

      // 最初の呼び出し: メール送信
      const mailCall = mockCollectionRef.add.mock.calls[0][0];
      expect(mailCall.to).toBe("test@example.com");
      expect(mailCall.template.name).toBe("receipt");
      expect(mailCall.template.data.invoiceId).toBe("in_test123");
      expect(mailCall.template.data.invoicePdfUrl).toBe(
        "https://pay.stripe.com/invoice/in_test123/pdf"
      );
      expect(mailCall.template.data.amount).toBe("980円");
      expect(mailCall.template.data.currency).toBe("JPY");

      // 2回目の呼び出し: 履歴記録
      expect(mockFirestore.collection).toHaveBeenCalledWith("receiptEmails");
      const historyCall = mockCollectionRef.add.mock.calls[1][0];
      expect(historyCall.userId).toBe("user-123");
      expect(historyCall.invoiceId).toBe("in_test123");
      expect(historyCall.email).toBe("test@example.com");
      expect(historyCall.status).toBe("sent");
      expect(historyCall.type).toBe("auto");
    });

    it("再送信タイプで正常に動作する", async () => {
      mockCollectionRef.add.mockResolvedValue({ id: "doc-123" });

      const resendParams: SendReceiptEmailParams = {
        ...validParams,
        type: "resend",
      };

      const result = await sendReceiptEmail(resendParams);

      expect(result).toBe(true);

      // 履歴記録でtypeがresendになっていることを確認
      const historyCall = mockCollectionRef.add.mock.calls[1][0];
      expect(historyCall.type).toBe("resend");
    });

    it("メール送信失敗時にfalseを返し、履歴にエラーを記録", async () => {
      const sendError = new Error("SMTP connection failed");
      mockCollectionRef.add
        .mockRejectedValueOnce(sendError) // メール送信失敗
        .mockResolvedValueOnce({ id: "error-doc-123" }); // エラー履歴記録成功

      const result = await sendReceiptEmail(validParams);

      expect(result).toBe(false);

      // エラー履歴が記録されることを確認
      expect(mockCollectionRef.add).toHaveBeenCalledTimes(2);
      const errorHistoryCall = mockCollectionRef.add.mock.calls[1][0];
      expect(errorHistoryCall.status).toBe("failed");
      expect(errorHistoryCall.errorMessage).toBe("SMTP connection failed");
    });

    it("メール送信失敗かつエラー履歴記録も失敗した場合もfalseを返す", async () => {
      mockCollectionRef.add
        .mockRejectedValueOnce(new Error("SMTP connection failed"))
        .mockRejectedValueOnce(new Error("Firestore error"));

      const result = await sendReceiptEmail(validParams);

      expect(result).toBe(false);

      // 両方のadd呼び出しが行われたことを確認
      expect(mockCollectionRef.add).toHaveBeenCalledTimes(2);
    });

    it("USD通貨でも正常に動作する", async () => {
      mockCollectionRef.add.mockResolvedValue({ id: "doc-123" });

      const usdParams: SendReceiptEmailParams = {
        ...validParams,
        amount: 999,
        currency: "usd",
      };

      const result = await sendReceiptEmail(usdParams);

      expect(result).toBe(true);

      // 金額フォーマットの確認
      const mailCall = mockCollectionRef.add.mock.calls[0][0];
      expect(mailCall.template.data.amount).toBe("9.99 USD");
      expect(mailCall.template.data.currency).toBe("USD");
    });
  });
});
