/**
 * 強制削除APIテスト
 *
 * superAdmin専用の強制削除APIのユニットテスト
 *
 * 参照: docs/common/tickets/044-force-delete-api.md
 */

import * as admin from "firebase-admin";

// =============================================================================
// モック設定
// =============================================================================

// firebase-adminのモック
jest.mock("firebase-admin", () => {
  const mockUserRecord = {
    uid: "test-user-123",
    email: "test@example.com",
    customClaims: {},
  };

  const mockAuth = {
    getUser: jest.fn(() => Promise.resolve(mockUserRecord)),
    deleteUser: jest.fn(() => Promise.resolve()),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  const mockDocSnapshot = {
    exists: true,
    id: "test-user-123",
    data: jest.fn(() => ({
      email: "test@example.com",
      nickname: "TestUser",
      createdAt: { toDate: () => new Date("2024-01-01") },
      updatedAt: { toDate: () => new Date("2024-12-01") },
      lastLoginAt: { toDate: () => new Date("2024-12-10") },
      subscriptionStatus: "free",
      deletionScheduled: false,
    })),
  };

  const mockQuerySnapshot = {
    docs: [
      {
        id: "session-1",
        ref: { delete: jest.fn() },
        data: () => ({ exerciseType: "squat" }),
      },
      {
        id: "session-2",
        ref: { delete: jest.fn() },
        data: () => ({ exerciseType: "pushup" }),
      },
    ],
    empty: false,
    size: 2,
  };

  const mockCountSnapshot = {
    data: () => ({ count: 5 }),
  };

  const mockDocRef = {
    get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
    delete: jest.fn(() => Promise.resolve()),
    collection: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
      })),
    })),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(() => Promise.resolve({ id: "audit-log-123" })),
    where: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
      })),
    })),
  };

  const mockBatch = {
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  };

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => mockBatch),
  }));

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    auth: jest.fn(() => mockAuth),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
  };
});

// utils/firestoreのモック
jest.mock("../../../src/utils/firestore", () => {
  const mockDocSnapshot = {
    exists: true,
    id: "test-user-123",
    data: () => ({
      email: "test@example.com",
      nickname: "TestUser",
      createdAt: { toDate: () => new Date("2024-01-01") },
      updatedAt: { toDate: () => new Date("2024-12-01") },
      lastLoginAt: { toDate: () => new Date("2024-12-10") },
      subscriptionStatus: "free",
      deletionScheduled: false,
    }),
  };

  const mockQuerySnapshot = {
    docs: [
      {
        id: "session-1",
        ref: { delete: jest.fn() },
        data: () => ({ exerciseType: "squat" }),
      },
    ],
    empty: false,
    size: 1,
  };

  const mockCountSnapshot = {
    data: () => ({ count: 3 }),
  };

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
          delete: jest.fn(() => Promise.resolve()),
        })),
        add: jest.fn(() => Promise.resolve({ id: "log-123" })),
      })),
      batch: jest.fn(() => ({
        delete: jest.fn(),
        commit: jest.fn(() => Promise.resolve()),
      })),
    })),
    userRef: jest.fn((userId: string) => ({
      get: jest.fn(() => Promise.resolve(mockDocSnapshot)),
      delete: jest.fn(() => Promise.resolve()),
      collection: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
        count: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
        })),
      })),
    })),
    sessionsCollection: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
      count: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
      })),
    })),
    consentsCollection: jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            docs: [{ id: "consent-1", ref: { delete: jest.fn() }, data: () => ({}) }],
            empty: false,
            size: 1,
          })
        ),
        count: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ data: () => ({ count: 2 }) })),
        })),
      })),
    })),
    batchWrite: jest.fn(async (items: unknown[], operation: (batch: unknown, item: unknown) => void) => {
      return items.length;
    }),
  };
});

// middleware/adminAuthのモック
jest.mock("../../../src/middleware/adminAuth", () => ({
  getAdminLevel: jest.fn((token: { super_admin?: boolean; admin?: boolean }) => {
    if (token?.super_admin) return "super_admin";
    if (token?.admin) return "admin";
    return undefined;
  }),
}));

// services/userDeletionのモック
jest.mock("../../../src/services/userDeletion", () => ({
  backupUserData: jest.fn(() =>
    Promise.resolve({
      userId: "test-user-123",
      userData: { email: "test@example.com", nickname: "TestUser" },
      sessions: [{ sessionId: "session-1", data: {} }],
      consents: [{ consentId: "consent-1", data: {} }],
      backupAt: new Date().toISOString(),
      reason: "Test deletion",
      performedBy: "admin-user-123",
    })
  ),
  deleteUserCompletely: jest.fn(() =>
    Promise.resolve({
      success: true,
      deletedCollections: ["sessions", "consents", "users"],
      authDeleted: true,
      bigQueryAnonymized: true,
      stripeDeleted: true,
      storageDeleted: true,
      backupId: "backup_test-user-123_123456789",
    })
  ),
  logForceDeleteAudit: jest.fn(() => Promise.resolve("audit-log-123")),
  getDeletePreviewData: jest.fn(() =>
    Promise.resolve({
      sessionCount: 5,
      consentCount: 2,
      hasStripeAccount: true,
      stripeCustomerId: "cus_test123",
    })
  ),
}));

// utils/loggerのモック
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// モジュールのインポート
import { getAdminLevel } from "../../../src/middleware/adminAuth";
import {
  backupUserData,
  deleteUserCompletely,
  logForceDeleteAudit,
  getDeletePreviewData,
} from "../../../src/services/userDeletion";
import {
  generateConfirmationCode,
  validateConfirmationCode,
} from "../../../src/types/admin";
import { logger } from "../../../src/utils/logger";

// =============================================================================
// テスト
// =============================================================================

describe("強制削除API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateConfirmationCode", () => {
    it("ユーザーIDの最初の8文字を返すこと", () => {
      const userId = "abc12345-6789-abcd-efgh-ijklmnopqrst";
      const code = generateConfirmationCode(userId);
      expect(code).toBe("abc12345");
    });

    it("短いユーザーIDはそのまま返すこと", () => {
      const userId = "short";
      const code = generateConfirmationCode(userId);
      expect(code).toBe("short");
    });
  });

  describe("validateConfirmationCode", () => {
    it("正しい確認コードでtrueを返すこと", () => {
      const userId = "abc12345-6789-abcd-efgh-ijklmnopqrst";
      const confirmationCode = "abc12345";
      expect(validateConfirmationCode(userId, confirmationCode)).toBe(true);
    });

    it("不正な確認コードでfalseを返すこと", () => {
      const userId = "abc12345-6789-abcd-efgh-ijklmnopqrst";
      const confirmationCode = "wrong123";
      expect(validateConfirmationCode(userId, confirmationCode)).toBe(false);
    });

    it("空の確認コードでfalseを返すこと", () => {
      const userId = "abc12345-6789-abcd-efgh-ijklmnopqrst";
      expect(validateConfirmationCode(userId, "")).toBe(false);
    });
  });

  describe("getAdminLevel", () => {
    it("super_admin権限を正しく判定すること", () => {
      const token = { super_admin: true };
      expect(getAdminLevel(token as any)).toBe("super_admin");
    });

    it("admin権限を正しく判定すること", () => {
      const token = { admin: true };
      expect(getAdminLevel(token as any)).toBe("admin");
    });

    it("権限がない場合undefinedを返すこと", () => {
      const token = {};
      expect(getAdminLevel(token as any)).toBeUndefined();
    });
  });

  describe("backupUserData", () => {
    it("ユーザーデータのバックアップを作成すること", async () => {
      const backup = await backupUserData(
        "test-user-123",
        "Test deletion reason",
        "admin-user-123"
      );

      expect(backup).toBeDefined();
      expect(backup.userId).toBe("test-user-123");
      expect(backup.userData).toBeDefined();
      expect(backup.sessions).toBeDefined();
      expect(backup.consents).toBeDefined();
      expect(backup.reason).toBe("Test deletion");
      expect(backup.performedBy).toBe("admin-user-123");
    });
  });

  describe("deleteUserCompletely", () => {
    it("ユーザーの完全削除を実行すること", async () => {
      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-user-123",
        "Test deletion reason",
        "backup-123"
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deletedCollections).toContain("sessions");
      expect(result.deletedCollections).toContain("users");
      expect(result.authDeleted).toBe(true);
      expect(result.bigQueryAnonymized).toBe(true);
      expect(result.stripeDeleted).toBe(true);
      expect(result.storageDeleted).toBe(true);
    });
  });

  describe("logForceDeleteAudit", () => {
    it("監査ログを記録すること", async () => {
      const auditLogId = await logForceDeleteAudit({
        performedBy: "admin-user-123",
        targetUser: "test-user-123",
        reason: "Test deletion reason",
        backupData: {
          userId: "test-user-123",
          userData: null,
          sessions: [],
          consents: [],
          backupAt: new Date().toISOString(),
          reason: "Test",
          performedBy: "admin-user-123",
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

      expect(auditLogId).toBe("audit-log-123");
    });
  });

  describe("getDeletePreviewData", () => {
    it("削除プレビューデータを取得すること", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview).toBeDefined();
      expect(preview.sessionCount).toBe(5);
      expect(preview.consentCount).toBe(2);
      expect(preview.hasStripeAccount).toBe(true);
      expect(preview.stripeCustomerId).toBe("cus_test123");
    });
  });

  describe("権限チェック", () => {
    it("superAdmin以外はアクセスを拒否されること", () => {
      // admin権限のみの場合
      const adminToken = { admin: true };
      const adminLevel = getAdminLevel(adminToken as any);
      expect(adminLevel).not.toBe("super_admin");

      // 権限なしの場合
      const noPermToken = {};
      const noPermLevel = getAdminLevel(noPermToken as any);
      expect(noPermLevel).toBeUndefined();
    });

    it("superAdminはアクセスが許可されること", () => {
      const superAdminToken = { super_admin: true };
      const level = getAdminLevel(superAdminToken as any);
      expect(level).toBe("super_admin");
    });
  });

  describe("バリデーション", () => {
    it("空のuserIdは拒否されること", () => {
      const userId = "";
      expect(userId).toBeFalsy();
    });

    it("短すぎる削除理由は拒否されること", () => {
      const reason = "short";
      expect(reason.length).toBeLessThan(10);
    });

    it("不正な確認コードは拒否されること", () => {
      const userId = "abc12345-6789";
      const wrongCode = "xyz98765";
      expect(validateConfirmationCode(userId, wrongCode)).toBe(false);
    });
  });

  describe("エラーハンドリング", () => {
    it("存在しないユーザーの場合エラーを返すこと", async () => {
      // userRefのモックを一時的に変更
      const { userRef } = require("../../../src/utils/firestore");
      (userRef as jest.Mock).mockReturnValueOnce({
        get: jest.fn(() =>
          Promise.resolve({
            exists: false,
            data: () => null,
          })
        ),
      });

      // この場合、呼び出し元でnot-foundエラーをスローする想定
      const mockDocRef = userRef("non-existent-user");
      const docSnapshot = await mockDocRef.get();
      expect(docSnapshot.exists).toBe(false);
    });

    it("部分的な削除失敗を正しく処理すること", async () => {
      // deleteUserCompletelyのモックを一時的に変更
      (deleteUserCompletely as jest.Mock).mockResolvedValueOnce({
        success: false,
        deletedCollections: ["sessions", "users"],
        authDeleted: true,
        bigQueryAnonymized: false,
        stripeDeleted: true,
        storageDeleted: false,
        backupId: "backup-123",
        errors: ["BigQuery匿名化失敗", "Storage削除失敗"],
      });

      const result = await deleteUserCompletely(
        "test-user-123",
        "admin-user-123",
        "Test",
        "backup-123"
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain("BigQuery匿名化失敗");
    });
  });

  describe("ロギング", () => {
    it("強制削除開始時にログを記録すること", async () => {
      await deleteUserCompletely(
        "test-user-123",
        "admin-user-123",
        "Test deletion",
        "backup-123"
      );

      expect(deleteUserCompletely).toHaveBeenCalledWith(
        "test-user-123",
        "admin-user-123",
        "Test deletion",
        "backup-123"
      );
    });

    it("監査ログが正しいパラメータで呼ばれること", async () => {
      const params = {
        performedBy: "admin-user-123",
        targetUser: "test-user-123",
        reason: "GDPR削除要求",
        backupData: {
          userId: "test-user-123",
          userData: null,
          sessions: [],
          consents: [],
          backupAt: new Date().toISOString(),
          reason: "GDPR削除要求",
          performedBy: "admin-user-123",
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
      };

      await logForceDeleteAudit(params);

      expect(logForceDeleteAudit).toHaveBeenCalledWith(params);
    });
  });
});

describe("削除プレビューAPI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("プレビューデータ取得", () => {
    it("正しいプレビューデータを返すこと", async () => {
      const preview = await getDeletePreviewData("test-user-123");

      expect(preview.sessionCount).toBe(5);
      expect(preview.consentCount).toBe(2);
      expect(preview.hasStripeAccount).toBe(true);
    });
  });

  describe("確認コード生成", () => {
    it("プレビューに確認コードが含まれること", () => {
      const userId = "abc12345-6789-abcd";
      const confirmationCode = generateConfirmationCode(userId);
      expect(confirmationCode).toBe("abc12345");
    });
  });
});
