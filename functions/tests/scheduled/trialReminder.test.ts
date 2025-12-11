/**
 * トライアルリマインダースケジュール関数のテスト
 * チケット036: 無料トライアル管理API
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { resetStripeClient, setStripeClient } from "../../src/utils/stripe";

// onSchedule関数のハンドラを直接取得するためのモック
let trialReminderHandler: () => Promise<void>;

// Firebase Functions v2のonScheduleをモック
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((options, handler) => {
    trialReminderHandler = handler;
    return handler;
  }),
}));

// モジュールをロード
const loadModule = () => require("../../src/scheduled/trialReminder");

// Mock Firestore
const mockNotificationAdd = jest.fn();
const mockUserDocs: Array<{
  id: string;
  data: () => { stripeSubscriptionId?: string; subscriptionStatus?: string };
}> = [];

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    })),
    delete: jest.fn(() => null),
  };

  const mockQuery = {
    get: jest.fn(() => Promise.resolve({
      empty: mockUserDocs.length === 0,
      size: mockUserDocs.length,
      docs: mockUserDocs,
    })),
  };

  const mockCollection = jest.fn((collectionName: string) => {
    if (collectionName === "notifications") {
      return {
        add: mockNotificationAdd,
      };
    }
    return {
      doc: jest.fn(),
      where: jest.fn(() => mockQuery),
    };
  });

  const mockFirestore = {
    collection: mockCollection,
    FieldValue: mockFieldValue,
  };

  return {
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: mockFieldValue,
    }),
  };
});

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

describe("scheduled_trialReminder", () => {
  let mockStripeClient: jest.Mocked<Partial<Stripe>>;

  beforeAll(() => {
    loadModule();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeClient();

    // Clear user docs
    mockUserDocs.length = 0;

    // Setup mock notification
    mockNotificationAdd.mockResolvedValue({ id: "notification_123" });

    // Setup mock Stripe client
    mockStripeClient = {
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
        create: jest.fn(),
      } as unknown as Stripe.SubscriptionsResource,
    };

    setStripeClient(mockStripeClient as unknown as Stripe);

    // Setup environment
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
  });

  afterEach(() => {
    resetStripeClient();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("トライアル中ユーザーがいない場合", () => {
    it("ユーザーがいない場合は何もしない", async () => {
      // No users in mockUserDocs

      await trialReminderHandler();

      expect(mockNotificationAdd).not.toHaveBeenCalled();
    });
  });

  describe("トライアル終了3日前のユーザーがいる場合", () => {
    it("3日前のユーザーにリマインダー通知を送る", async () => {
      const userId = "user_trial_3days";
      const subscriptionId = "sub_test_3days";
      // 3日後をトライアル終了日として設定
      const trialEnd = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;

      mockUserDocs.push({
        id: userId,
        data: () => ({
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "trialing",
        }),
      });

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: "trialing",
        trial_end: trialEnd,
      });

      await trialReminderHandler();

      expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
      expect(mockNotificationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: "trial_ending_reminder",
          title: "トライアル期間終了のお知らせ",
        }),
      );
    });

    it("複数のユーザーに通知を送る", async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;

      mockUserDocs.push(
        {
          id: "user_1",
          data: () => ({
            stripeSubscriptionId: "sub_1",
            subscriptionStatus: "trialing",
          }),
        },
        {
          id: "user_2",
          data: () => ({
            stripeSubscriptionId: "sub_2",
            subscriptionStatus: "trialing",
          }),
        },
      );

      (mockStripeClient.subscriptions?.retrieve as jest.Mock)
        .mockResolvedValueOnce({
          id: "sub_1",
          status: "trialing",
          trial_end: trialEnd,
        })
        .mockResolvedValueOnce({
          id: "sub_2",
          status: "trialing",
          trial_end: trialEnd,
        });

      await trialReminderHandler();

      expect(mockNotificationAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe("トライアル終了が3日前以外の場合", () => {
    it("7日前のユーザーには通知を送らない", async () => {
      const userId = "user_trial_7days";
      const subscriptionId = "sub_test_7days";
      // 7日後をトライアル終了日として設定
      const trialEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      mockUserDocs.push({
        id: userId,
        data: () => ({
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "trialing",
        }),
      });

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: "trialing",
        trial_end: trialEnd,
      });

      await trialReminderHandler();

      expect(mockNotificationAdd).not.toHaveBeenCalled();
    });

    it("1日前のユーザーには通知を送らない", async () => {
      const userId = "user_trial_1day";
      const subscriptionId = "sub_test_1day";
      // 1日後をトライアル終了日として設定
      const trialEnd = Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60;

      mockUserDocs.push({
        id: userId,
        data: () => ({
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "trialing",
        }),
      });

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: "trialing",
        trial_end: trialEnd,
      });

      await trialReminderHandler();

      expect(mockNotificationAdd).not.toHaveBeenCalled();
    });
  });

  describe("トライアル中でないユーザー", () => {
    it("statusがactiveのユーザーには通知を送らない", async () => {
      const userId = "user_active";
      const subscriptionId = "sub_active";

      mockUserDocs.push({
        id: userId,
        data: () => ({
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "trialing",
        }),
      });

      (mockStripeClient.subscriptions?.retrieve as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: "active",
        trial_end: null,
      });

      await trialReminderHandler();

      expect(mockNotificationAdd).not.toHaveBeenCalled();
    });
  });

  describe("エラーハンドリング", () => {
    it("サブスクリプションIDがないユーザーはスキップ", async () => {
      mockUserDocs.push({
        id: "user_no_sub",
        data: () => ({
          subscriptionStatus: "trialing",
        }),
      });

      await trialReminderHandler();

      expect(mockStripeClient.subscriptions?.retrieve).not.toHaveBeenCalled();
      expect(mockNotificationAdd).not.toHaveBeenCalled();
    });

    it("Stripeエラーが発生しても他のユーザーの処理を続ける", async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;

      mockUserDocs.push(
        {
          id: "user_error",
          data: () => ({
            stripeSubscriptionId: "sub_error",
            subscriptionStatus: "trialing",
          }),
        },
        {
          id: "user_success",
          data: () => ({
            stripeSubscriptionId: "sub_success",
            subscriptionStatus: "trialing",
          }),
        },
      );

      (mockStripeClient.subscriptions?.retrieve as jest.Mock)
        .mockRejectedValueOnce(new Error("Stripe API error"))
        .mockResolvedValueOnce({
          id: "sub_success",
          status: "trialing",
          trial_end: trialEnd,
        });

      await trialReminderHandler();

      // エラーがあっても2番目のユーザーの処理は続く
      expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
      expect(mockNotificationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_success",
        }),
      );
    });
  });
});
