/**
 * ユーザー削除サービステスト
 *
 * ユーザーデータの完全削除とバックアップ機能のユニットテスト
 *
 * 参照: docs/common/tickets/044-force-delete-api.md
 */

import * as admin from "firebase-admin";

// =============================================================================
// モック設定
// =============================================================================

// firebase-adminのモック
jest.mock("firebase-admin", () => {
  const mockAuth = {
    deleteUser: jest.fn(() => Promise.resolve()),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => ({})),
  };

  const mockTimestamp = {
    toDate: () => new Date("2024-01-01"),
  };

  const mockDocSnapshot = {
    exists: true,
    id: "test-user-123",
    data: jest.fn(() => ({
      email: "test@example.com",
      nickname: "TestUser",
      photoURL: "https://example.com/photo.jpg",
      birthYear: 1990,
      gender: "male",
      height: 175,
      weight: 70,
      fitnessLevel: "intermediate",
      tosAccepted: true,
      tosAcceptedAt: mockTimestamp,
      ppAccepted: true,
      ppAcceptedAt: mockTimestamp,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      lastLoginAt: mockTimestamp,
      subscriptionStatus: "premium",
      stripeCustomerId: "cus_test123",
    })),
  };

  const mockSessionDoc = {
    id: "session-1",
    ref: { delete: jest.fn() },
    data: () => ({
      exerciseType: "squat",
      repCount: 10,
      averageScore: 85,
    }),
  };

  const mockConsentDoc = {
    id: "consent-1",
    ref: { delete: jest.fn() },
    data: () => ({
      action: "accept",
      documentType: "tos",
    }),
  };

  const mockQuerySnapshot = {
    docs: [mockSessionDoc, { ...mockSessionDoc, id: "session-2" }],
    empty: false,
    size: 2,
  };

  const mockConsentsQuerySnapshot = {
    docs: [mockConsentDoc],
    empty: false,
    size: 1,
  };

  const mockCountSnapshot = {
    data: () => ({ count: 5 }),
  };

  const mockBatch = {
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  };

  const mockDocRef = {
    get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
    delete: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    collection: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
      })),
    })),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(() => Promise.resolve({ id: "new-doc-123" })),
    where: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockConsentsQuerySnapshot)),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ data: () => ({ count: 2 }) })),
      })),
    })),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => mockBatch),
  }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(mockFirestore, {
      FieldValue: mockFieldValue,
      Timestamp: { fromDate: (date: Date) => ({ toDate: () => date }) },
    }),
  };
});

// utils/firestoreのモック
jest.mock("../../src/utils/firestore", () => {
  const mockTimestamp = { toDate: () => new Date("2024-01-01") };

  const mockDocSnapshot = {
    exists: true,
    id: "test-user-123",
    data: () => ({
      email: "test@example.com",
      nickname: "TestUser",
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      lastLoginAt: mockTimestamp,
      subscriptionStatus: "premium",
      stripeCustomerId: "cus_test123",
    }),
  };

  const mockSessionDocs = [
    {
      id: "session-1",
      ref: { delete: jest.fn(() => Promise.resolve()) },
      data: () => ({ exerciseType: "squat", repCount: 10 }),
    },
    {
      id: "session-2",
      ref: { delete: jest.fn(() => Promise.resolve()) },
      data: () => ({ exerciseType: "pushup", repCount: 15 }),
    },
  ];

  const mockConsentDocs = [
    {
      id: "consent-1",
      ref: { delete: jest.fn(() => Promise.resolve()) },
      data: () => ({ action: "accept", documentType: "tos" }),
    },
  ];

  const mockEmptySnapshot = {
    docs: [],
    empty: true,
    size: 0,
  };

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn((name: string) => {
        if (name === "stripeCustomers") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  exists: true,
                  data: () => ({
                    customerId: "cus_test123",
                    subscriptionId: "sub_test123",
                    subscriptionStatus: "active",
                  }),
                })
              ),
              delete: jest.fn(() => Promise.resolve()),
            })),
          };
        }
        if (name === "auditLogs") {
          return {
            add: jest.fn(() => Promise.resolve({ id: "audit-log-123" })),
          };
        }
        return {
          doc: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
            delete: jest.fn(() => Promise.resolve()),
          })),
        };
      }),
      batch: jest.fn(() => ({
        delete: jest.fn(),
        commit: jest.fn(() => Promise.resolve()),
      })),
    })),
    userRef: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
      delete: jest.fn(() => Promise.resolve()),
      collection: jest.fn((name: string) => {
        if (name === "sessions") {
          return {
            get: jest.fn(() =>
              Promise.resolve({
                docs: mockSessionDocs,
                empty: false,
                size: 2,
              })
            ),
            count: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({ data: () => ({ count: 5 }) })),
            })),
          };
        }
        return {
          get: jest.fn(() => Promise.resolve(mockEmptySnapshot)),
        };
      }),
    })),
    sessionsCollection: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          docs: mockSessionDocs,
          empty: false,
          size: 2,
        })
      ),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ data: () => ({ count: 5 }) })),
      })),
    })),
    consentsCollection: jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            docs: mockConsentDocs,
            empty: false,
            size: 1,
          })
        ),
        count: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ data: () => ({ count: 2 }) })),
        })),
      })),
    })),
    batchWrite: jest.fn(async (items: unknown[]) => items.length),
  };
});

// gdprBigQueryのモック
jest.mock("../../src/services/gdprBigQuery", () => ({
  deleteUserFromBigQuery: jest.fn(() =>
    Promise.resolve({
      deleted: true,
      rowsAffected: 10,
      tablesAffected: ["users_anonymized", "training_sessions"],
    })
  ),
}));

// gdprStorageのモック
jest.mock("../../src/services/gdprStorage", () => ({
  deleteUserStorage: jest.fn(() =>
    Promise.resolve({
      deleted: true,
      files: ["profile.jpg"],
      filesCount: 1,
      totalSizeBytes: 1024,
    })
  ),
}));

// stripeのモック
jest.mock("../../src/services/stripe", () => ({
  getStripeCustomerId: jest.fn(() => Promise.resolve("cus_test123")),
  deleteStripeCustomer: jest.fn(() => Promise.resolve()),
}));

// utils/loggerのモック
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// モジュールのインポート（モック後）
import {
  backupUserData,
  deleteUserCompletely,
  logForceDeleteAudit,
  getDeletePreviewData,
} from "../../src/services/userDeletion";
import { deleteUserFromBigQuery } from "../../src/services/gdprBigQuery";
import { deleteUserStorage } from "../../src/services/gdprStorage";
import { getStripeCustomerId, deleteStripeCustomer } from "../../src/services/stripe";
import { logger } from "../../src/utils/logger";

// =============================================================================
// テスト
// =============================================================================

describe("userDeletionサービス", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("backupUserData", () => {
    it("ユーザードキュメントをバックアップすること", async () => {
      const backup = await backupUserData(
        "test-user-123",
        "GDPR削除要求",
        "admin-123"
      );

      expect(backup).toBeDefined();
      expect(backup.userId).toBe("test-user-123");
      expect(backup.reason).toBe("GDPR削除要求");
      expect(backup.performedBy).toBe("admin-123");
      expect(backup.backupAt).toBeDefined();
    });

    it("セッションデータをバックアップすること", async () => {
      const backup = await backupUserData(
        "test-user-123",
        "Test",
        "admin-123"
      );

      expect(backup.sessions).toBeDefined();
      expect(Array.isArray(backup.sessions)).toBe(true);
    });

    it("同意レコードをバックアップすること", async () => {
      const backup = await backupUserData(
        "test-user-123",
        "Test",
        "admin-123"
      );

      expect(backup.consents).toBeDefined();
      expect(Array.isArray(backup.consents)).toBe(true);
    });

    it("バックアップ開始時にログを記録すること", async () => {
      await backupUserData("test-user-123", "Test", "admin-123");

      expect(logger.info).toHaveBeenCalledWith(
        "ユーザーデータのバックアップを開始",
        expect.objectContaining({
          userId: "test-user-123",
          performedBy: "admin-123",
        })
      );
    });
  });

  describe("deleteUserCompletely", () => {
    it("すべてのコンポーネントを削除すること", async () => {
      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test deletion",
        "backup-123"
      );

      expect(result.success).toBe(true);
      expect(result.backupId).toBe("backup-123");
    });

    it("Firebase Authからユーザーを削除すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(admin.auth().deleteUser).toHaveBeenCalledWith("test-user-123");
    });

    it("BigQueryデータを匿名化すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(deleteUserFromBigQuery).toHaveBeenCalledWith("test-user-123");
    });

    it("Stripe顧客を削除すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(getStripeCustomerId).toHaveBeenCalledWith("test-user-123");
      expect(deleteStripeCustomer).toHaveBeenCalledWith("cus_test123");
    });

    it("Cloud Storageファイルを削除すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(deleteUserStorage).toHaveBeenCalledWith("test-user-123");
    });

    it("削除完了時にログを記録すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(logger.info).toHaveBeenCalledWith(
        "ユーザーの完全削除が完了",
        expect.objectContaining({
          userId: "test-user-123",
          performedBy: "admin-123",
          success: true,
        })
      );
    });

    it("部分的な失敗でもエラー配列を返すこと", async () => {
      // BigQuery削除を失敗させる
      (deleteUserFromBigQuery as jest.Mock).mockResolvedValueOnce({
        deleted: false,
        rowsAffected: 0,
        tablesAffected: [],
        error: "BigQuery error",
      });

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      // 部分的な失敗でもsuccessはfalseにならない（BigQueryは非クリティカル）
      expect(result.bigQueryAnonymized).toBe(false);
    });

    it("Auth削除失敗時もエラーを記録すること", async () => {
      (admin.auth().deleteUser as jest.Mock).mockRejectedValueOnce(
        new Error("Auth deletion failed")
      );

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(result.authDeleted).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("既に削除済みのAuthユーザーは成功として扱うこと", async () => {
      const authError = new Error("User not found");
      (authError as any).code = "auth/user-not-found";
      (admin.auth().deleteUser as jest.Mock).mockRejectedValueOnce(authError);

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(result.authDeleted).toBe(true);
    });
  });

  describe("logForceDeleteAudit", () => {
    it("監査ログをFirestoreに保存すること", async () => {
      const auditLogId = await logForceDeleteAudit({
        performedBy: "admin-123",
        targetUser: "test-user-123",
        reason: "GDPR削除要求",
        backupData: {
          userId: "test-user-123",
          userData: null,
          sessions: [],
          consents: [],
          backupAt: new Date().toISOString(),
          reason: "GDPR削除要求",
          performedBy: "admin-123",
        },
        deleteResult: {
          success: true,
          deletedCollections: ["users"],
          authDeleted: true,
          bigQueryAnonymized: true,
          stripeDeleted: true,
          storageDeleted: true,
          backupId: "backup-123",
        },
      });

      expect(auditLogId).toBeDefined();
      expect(typeof auditLogId).toBe("string");
    });

    it("監査ログ記録時にログを出力すること", async () => {
      await logForceDeleteAudit({
        performedBy: "admin-123",
        targetUser: "test-user-123",
        reason: "Test",
        backupData: {
          userId: "test-user-123",
          userData: null,
          sessions: [],
          consents: [],
          backupAt: new Date().toISOString(),
          reason: "Test",
          performedBy: "admin-123",
        },
        deleteResult: {
          success: true,
          deletedCollections: [],
          authDeleted: true,
          bigQueryAnonymized: true,
          stripeDeleted: true,
          storageDeleted: true,
          backupId: "backup-123",
        },
      });

      expect(logger.info).toHaveBeenCalledWith(
        "強制削除の監査ログを記録",
        expect.objectContaining({
          targetUser: "test-user-123",
          performedBy: "admin-123",
        })
      );
    });
  });

  describe("getDeletePreviewData", () => {
    it("セッション数を返すこと", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview.sessionCount).toBeDefined();
      expect(typeof preview.sessionCount).toBe("number");
    });

    it("同意レコード数を返すこと", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview.consentCount).toBeDefined();
      expect(typeof preview.consentCount).toBe("number");
    });

    it("Stripeアカウント有無を返すこと", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview.hasStripeAccount).toBeDefined();
      expect(typeof preview.hasStripeAccount).toBe("boolean");
    });

    it("Stripe顧客IDを返すこと", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview.stripeCustomerId).toBeDefined();
    });
  });
});

describe("エラーハンドリング", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Storage削除エラー", () => {
    it("Storage削除失敗時もエラーを記録して続行すること", async () => {
      (deleteUserStorage as jest.Mock).mockResolvedValueOnce({
        deleted: false,
        files: [],
        filesCount: 0,
        totalSizeBytes: 0,
        error: "Storage error",
      });

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(result.storageDeleted).toBe(false);
    });
  });

  describe("Stripe削除エラー", () => {
    it("Stripe顧客が存在しない場合は成功として扱うこと", async () => {
      (getStripeCustomerId as jest.Mock).mockResolvedValueOnce(null);

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-123",
        "Test",
        "backup-123"
      );

      expect(result.stripeDeleted).toBe(true);
      expect(deleteStripeCustomer).not.toHaveBeenCalled();
    });
  });
});
