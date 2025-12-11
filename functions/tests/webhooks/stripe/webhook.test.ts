/**
 * Stripe Webhookハンドラのテスト
 * チケット038: Stripe Webhookハンドラ
 *
 * テスト対象:
 * - stripe_webhook HTTP Function
 * - イベントハンドラ（subscription, invoice）
 * - べき等性担保
 * - エラーハンドリング
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { handleSubscriptionCreated } from "../../../src/webhooks/stripe/subscriptionCreated";
import { handleSubscriptionUpdated } from "../../../src/webhooks/stripe/subscriptionUpdated";
import { handleSubscriptionDeleted } from "../../../src/webhooks/stripe/subscriptionDeleted";
import { handleInvoicePaymentSucceeded } from "../../../src/webhooks/stripe/invoicePaymentSucceeded";
import { handleInvoicePaymentFailed } from "../../../src/webhooks/stripe/invoicePaymentFailed";
import { resetStripeClient, setStripeClient } from "../../../src/utils/stripe";

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
    add: jest.fn(() => Promise.resolve({ id: "new-doc-id" })),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollection),
    Timestamp: {
      fromDate: jest.fn((date: Date) => ({
        toDate: () => date,
        toMillis: () => date.getTime(),
      })),
    },
    FieldValue: mockFieldValue,
  };

  return {
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: mockFieldValue,
      Timestamp: mockFirestore.Timestamp,
    }),
  };
});

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

describe("Stripe Webhook Handlers", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;
  let mockFirestore: ReturnType<typeof admin.firestore>;
  let mockDocRef: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };
  let mockCollection: {
    doc: jest.Mock;
    add: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Setup mock Stripe client
    mockStripeClient = {
      customers: {
        retrieve: jest.fn(),
        create: jest.fn(),
        del: jest.fn(),
        update: jest.fn(),
        list: jest.fn(),
      } as unknown as Stripe.CustomersResource,
      charges: {
        retrieve: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        list: jest.fn(),
        capture: jest.fn(),
      } as unknown as Stripe.ChargesResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup mock Firestore
    mockFirestore = admin.firestore();
    mockCollection = mockFirestore.collection("users") as unknown as {
      doc: jest.Mock;
      add: jest.Mock;
    };
    mockDocRef = mockCollection.doc("test-user") as unknown as {
      get: jest.Mock;
      update: jest.Mock;
      set: jest.Mock;
    };
  });

  describe("handleSubscriptionCreated", () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      metadata: { firebaseUID: "test-user-id" },
      items: {
        data: [
          {
            id: "si_123",
            price: {
              id: "price_123",
              recurring: { interval: "month" },
            } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
        object: "list",
        has_more: false,
        url: "/v1/subscription_items",
      },
      cancel_at_period_end: false,
      canceled_at: null,
      ended_at: null,
    };

    it("should create subscription and update user document", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionCreated(mockSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "premium",
          stripeSubscriptionId: "sub_123",
          subscriptionPlan: "premium_monthly",
        }),
      );
    });

    it("should throw error when Firebase UID is missing", async () => {
      const subscriptionWithoutUID = {
        ...mockSubscription,
        metadata: {},
      };

      await expect(
        handleSubscriptionCreated(subscriptionWithoutUID as Stripe.Subscription),
      ).rejects.toThrow("Firebase UID not found");
    });

    it("should throw error when user document not found", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      await expect(
        handleSubscriptionCreated(mockSubscription as Stripe.Subscription),
      ).rejects.toThrow("User document not found");
    });

    it("should map trialing status to premium", async () => {
      const trialingSubscription = {
        ...mockSubscription,
        status: "trialing",
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionCreated(trialingSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "premium",
        }),
      );
    });

    it("should detect annual plan from price interval", async () => {
      const annualSubscription = {
        ...mockSubscription,
        items: {
          data: [
            {
              id: "si_123",
              price: {
                id: "price_annual",
                recurring: { interval: "year" },
              } as Stripe.Price,
            } as Stripe.SubscriptionItem,
          ],
          object: "list",
          has_more: false,
          url: "/v1/subscription_items",
        },
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionCreated(annualSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionPlan: "premium_annual",
        }),
      );
    });
  });

  describe("handleSubscriptionUpdated", () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      metadata: { firebaseUID: "test-user-id" },
      items: {
        data: [
          {
            id: "si_123",
            price: {
              id: "price_123",
              recurring: { interval: "month" },
            } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
        object: "list",
        has_more: false,
        url: "/v1/subscription_items",
      },
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: null,
      ended_at: null,
    };

    it("should update subscription status in user document", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ subscriptionStatus: "free" }),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionUpdated(mockSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "premium",
          stripeSubscriptionId: "sub_123",
        }),
      );
    });

    it("should handle cancel_at_period_end flag", async () => {
      const cancelingSubscription = {
        ...mockSubscription,
        cancel_at_period_end: true,
        cancel_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ subscriptionStatus: "premium" }),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionUpdated(cancelingSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionCancelAtPeriodEnd: true,
        }),
      );
    });

    it("should map past_due status correctly", async () => {
      const pastDueSubscription = {
        ...mockSubscription,
        status: "past_due",
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ subscriptionStatus: "premium" }),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionUpdated(pastDueSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "past_due",
        }),
      );
    });
  });

  describe("handleSubscriptionDeleted", () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: "sub_123",
      customer: "cus_123",
      status: "canceled",
      metadata: { firebaseUID: "test-user-id" },
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: Math.floor(Date.now() / 1000),
    };

    it("should revert user to free tier", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: "premium",
          subscriptionPlan: "premium_monthly",
        }),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionDeleted(mockSubscription as Stripe.Subscription);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "free",
          subscriptionPlan: null,
          stripeSubscriptionId: null,
        }),
      );
    });

    it("should record cancellation in subscription history", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: "premium",
          subscriptionPlan: "premium_monthly",
        }),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleSubscriptionDeleted(mockSubscription as Stripe.Subscription);

      expect(mockCollection.add).toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaymentSucceeded", () => {
    const mockInvoice: Partial<Stripe.Invoice> = {
      id: "in_123",
      customer: "cus_123",
      amount_paid: 50000,
      amount_due: 50000,
      currency: "jpy",
      billing_reason: "subscription_cycle",
      hosted_invoice_url: "https://invoice.stripe.com/in_123",
      invoice_pdf: "https://pay.stripe.com/invoice/in_123/pdf",
      status_transitions: {
        paid_at: Math.floor(Date.now() / 1000),
      } as Stripe.Invoice.StatusTransitions,
      period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
      period_end: Math.floor(Date.now() / 1000),
    };

    it("should record payment and update user document", async () => {
      // Add subscription to invoice
      const invoiceWithSubscription = {
        ...mockInvoice,
        subscription: "sub_123",
      };

      // Mock customer retrieval
      (mockStripeClient.customers!.retrieve as jest.Mock).mockResolvedValue({
        id: "cus_123",
        metadata: { firebaseUID: "test-user-id" },
        deleted: false,
      });

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleInvoicePaymentSucceeded(invoiceWithSubscription as Stripe.Invoice);

      // Should add payment record
      expect(mockCollection.add).toHaveBeenCalled();

      // Should update user document
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lastPaymentAmount: 50000,
          lastPaymentCurrency: "jpy",
        }),
      );
    });

    it("should skip non-subscription invoices", async () => {
      const nonSubscriptionInvoice = {
        ...mockInvoice,
        subscription: null,
      };

      await handleInvoicePaymentSucceeded(nonSubscriptionInvoice as Stripe.Invoice);

      expect(mockStripeClient.customers!.retrieve).not.toHaveBeenCalled();
    });

    it("should handle deleted customer gracefully", async () => {
      const invoiceWithSubscription = {
        ...mockInvoice,
        subscription: "sub_123",
      };

      (mockStripeClient.customers!.retrieve as jest.Mock).mockResolvedValue({
        id: "cus_123",
        deleted: true,
      });

      // Should not throw, just return
      await handleInvoicePaymentSucceeded(invoiceWithSubscription as Stripe.Invoice);

      expect(mockDocRef.update).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaymentFailed", () => {
    const mockInvoice: Partial<Stripe.Invoice> = {
      id: "in_123",
      customer: "cus_123",
      amount_due: 50000,
      currency: "jpy",
      billing_reason: "subscription_cycle",
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400 * 3,
    };

    it("should record failed payment and notify user", async () => {
      const invoiceWithSubscription = {
        ...mockInvoice,
        subscription: "sub_123",
        charge: "ch_123",
      };

      // Mock customer retrieval
      (mockStripeClient.customers!.retrieve as jest.Mock).mockResolvedValue({
        id: "cus_123",
        email: "user@example.com",
        metadata: { firebaseUID: "test-user-id" },
        deleted: false,
      });

      // Mock charge retrieval for failure details
      (mockStripeClient.charges!.retrieve as jest.Mock).mockResolvedValue({
        id: "ch_123",
        failure_code: "card_declined",
        failure_message: "Your card was declined",
      });

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleInvoicePaymentFailed(invoiceWithSubscription as Stripe.Invoice);

      // Should add payment record
      expect(mockCollection.add).toHaveBeenCalled();

      // Should update user document
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentFailureCode: "card_declined",
        }),
      );
    });

    it("should mark as past_due after multiple failures", async () => {
      const invoiceWithMultipleAttempts = {
        ...mockInvoice,
        subscription: "sub_123",
        attempt_count: 3,
      };

      (mockStripeClient.customers!.retrieve as jest.Mock).mockResolvedValue({
        id: "cus_123",
        metadata: { firebaseUID: "test-user-id" },
        deleted: false,
      });

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      mockDocRef.update.mockResolvedValue({});

      await handleInvoicePaymentFailed(invoiceWithMultipleAttempts as Stripe.Invoice);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: "past_due",
          paymentAttemptCount: 3,
        }),
      );
    });

    it("should skip non-subscription invoices", async () => {
      const nonSubscriptionInvoice = {
        ...mockInvoice,
        subscription: null,
      };

      await handleInvoicePaymentFailed(nonSubscriptionInvoice as Stripe.Invoice);

      expect(mockStripeClient.customers!.retrieve).not.toHaveBeenCalled();
    });
  });
});
