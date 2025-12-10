/**
 * データ削除リクエストトリガーのテスト
 *
 * dataDeletionRequestsコレクションのonCreateトリガーの動作を検証
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

// Firebase Functions v2 Firestore トリガーのモック
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((config, handler) => {
    // ハンドラーを返してテストで呼び出せるようにする
    return handler;
  }),
}));

// Cloud Tasks サービスのモック
jest.mock("../../src/services/cloudTasks", () => ({
  cloudTasks: {
    createDataDeletionTask: jest.fn(() => Promise.resolve("deletion-task-123")),
    createDataExportTask: jest.fn(() => Promise.resolve("export-task-456")),
  },
  QueueNames: {
    DATA_DELETION: "data-deletion",
    DATA_EXPORT: "data-export",
  },
}));

// ロガーのモック
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Firebase Admin のモック
const mockUserDoc = {
  exists: true,
  data: jest.fn(() => ({
    email: "test@example.com",
    deletionScheduled: false,
    tosAccepted: true,
    ppAccepted: true,
  })),
};

const mockDocRef = {
  get: jest.fn(() => Promise.resolve(mockUserDoc)),
  update: jest.fn(() => Promise.resolve()),
  set: jest.fn(() => Promise.resolve()),
};

const mockCollectionRef = {
  doc: jest.fn(() => mockDocRef),
  add: jest.fn(() => Promise.resolve({ id: "new-doc-id" })),
};

const mockDb = {
  collection: jest.fn(() => mockCollectionRef),
};

const mockAuth = {
  getUser: jest.fn(() => Promise.resolve({
    uid: "test-user-id",
    email: "test@example.com",
    customClaims: {},
  })),
  setCustomUserClaims: jest.fn(() => Promise.resolve()),
  revokeRefreshTokens: jest.fn(() => Promise.resolve()),
};

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockDb),
  auth: jest.fn(() => mockAuth),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
    increment: jest.fn((n: number) => n),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      _seconds: Math.floor(date.getTime() / 1000),
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      _seconds: Math.floor(Date.now() / 1000),
    })),
  },
}));

import { cloudTasks } from "../../src/services/cloudTasks";
import { logger } from "../../src/utils/logger";

// テスト対象のモジュールをインポート
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { onDataDeletionRequestCreated } = require("../../src/triggers/dataDeletionRequests");

describe("onDataDeletionRequestCreated", () => {
  // テスト用のイベントデータを作成するヘルパー関数
  const createMockEvent = (requestData: Record<string, unknown>, requestId = "test-request-id") => {
    const snapshotRef = {
      update: jest.fn(() => Promise.resolve()),
    };

    return {
      data: {
        data: () => requestData,
        ref: snapshotRef,
      },
      params: {
        requestId,
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトのモック動作をリセット
    mockUserDoc.exists = true;
    mockUserDoc.data.mockReturnValue({
      email: "test@example.com",
      deletionScheduled: false,
      tosAccepted: true,
      ppAccepted: true,
    });
  });

  describe("正常系", () => {
    it("削除リクエストを正常に処理する", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // ユーザードキュメントが更新されたことを確認
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deletionScheduled: true,
        })
      );

      // Cloud Tasks が呼び出されたことを確認
      expect(cloudTasks.createDataDeletionTask).toHaveBeenCalledWith(
        "test-user-id",
        "test-request-id",
        expect.any(Date)
      );

      // ログが記録されたことを確認
      expect(logger.info).toHaveBeenCalledWith(
        "Processing data deletion request",
        expect.objectContaining({
          requestId: "test-request-id",
          userId: "test-user-id",
        })
      );

      // リクエストドキュメントが更新されたことを確認
      expect(event.data.ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
        })
      );
    });

    it("エクスポートリクエスト付きの削除リクエストを処理する", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: true,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // データエクスポートタスクが作成されたことを確認
      expect(cloudTasks.createDataExportTask).toHaveBeenCalledWith(
        "test-user-id",
        "test-request-id"
      );

      // 削除タスクも作成されたことを確認
      expect(cloudTasks.createDataDeletionTask).toHaveBeenCalled();
    });

    it("カスタムクレームが設定されることを確認", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({
          deletionScheduled: true,
          forceLogout: true,
        })
      );
    });

    it("リフレッシュトークンが無効化されることを確認", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("test-user-id");
    });

    it("通知が作成されることを確認", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // notifications コレクションに追加されたことを確認
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user-id",
          type: "system",
          title: "アカウント削除予定",
        })
      );
    });
  });

  describe("異常系", () => {
    it("データなしのイベントをスキップする", async () => {
      const event = {
        data: null,
        params: { requestId: "test-request-id" },
      };

      await onDataDeletionRequestCreated(event);

      expect(logger.warn).toHaveBeenCalledWith(
        "No data in deletion request creation event"
      );
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it("存在しないユーザーの場合はリクエストをキャンセル", async () => {
      mockUserDoc.exists = false;

      const requestData = {
        userId: "non-existent-user",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      expect(logger.warn).toHaveBeenCalledWith(
        "User not found for deletion request",
        expect.objectContaining({
          userId: "non-existent-user",
        })
      );

      expect(event.data.ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          reason: "User not found",
        })
      );
    });

    it("既に削除予定のユーザーの場合はスキップ", async () => {
      mockUserDoc.data.mockReturnValue({
        email: "test@example.com",
        deletionScheduled: true,
        tosAccepted: true,
        ppAccepted: true,
      });

      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      expect(logger.info).toHaveBeenCalledWith(
        "User already scheduled for deletion",
        expect.objectContaining({
          userId: "test-user-id",
        })
      );

      expect(event.data.ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          reason: "Already scheduled for deletion",
        })
      );

      // Cloud Tasks は呼び出されないことを確認
      expect(cloudTasks.createDataDeletionTask).not.toHaveBeenCalled();
    });

    it("Cloud Tasks 作成失敗時も処理を継続", async () => {
      (cloudTasks.createDataDeletionTask as jest.Mock).mockRejectedValueOnce(
        new Error("Task creation failed")
      );

      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // エラーログが記録されたことを確認
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create deletion task",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-id",
        })
      );

      // ユーザードキュメントは更新されることを確認
      expect(mockDocRef.update).toHaveBeenCalled();
    });

    it("エクスポートタスク作成失敗時も処理を継続", async () => {
      (cloudTasks.createDataExportTask as jest.Mock).mockRejectedValueOnce(
        new Error("Export task creation failed")
      );

      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: true,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // エラーログが記録されたことを確認
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create export task",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-id",
        })
      );

      // 削除タスクは作成されることを確認
      expect(cloudTasks.createDataDeletionTask).toHaveBeenCalled();
    });

    it("カスタムクレーム設定失敗時も処理を継続", async () => {
      mockAuth.setCustomUserClaims.mockRejectedValueOnce(
        new Error("Custom claims failed")
      );

      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // エラーログが記録されたことを確認
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to set custom claims",
        expect.any(Error),
        expect.objectContaining({
          userId: "test-user-id",
        })
      );

      // 処理は継続されることを確認
      expect(event.data.ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
        })
      );
    });

    it("ユーザードキュメント更新失敗時はエラーを投げる", async () => {
      mockDocRef.update.mockRejectedValueOnce(
        new Error("Firestore update failed")
      );

      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);

      await expect(onDataDeletionRequestCreated(event)).rejects.toThrow(
        "Firestore update failed"
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to process data deletion request",
        expect.any(Error),
        expect.objectContaining({
          requestId: "test-request-id",
          userId: "test-user-id",
        })
      );
    });
  });

  describe("30日猶予期間", () => {
    it("削除予定日が30日後に設定される", async () => {
      const requestData = {
        userId: "test-user-id",
        status: "pending",
        requestedAt: { toDate: () => new Date() },
        exportRequested: false,
      };

      const event = createMockEvent(requestData);
      await onDataDeletionRequestCreated(event);

      // Cloud Tasks に渡された日付を確認
      const taskCall = (cloudTasks.createDataDeletionTask as jest.Mock).mock.calls[0];
      const scheduledDate = taskCall[2] as Date;

      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() + 30);

      // 日付が約30日後であることを確認（1日の誤差を許容）
      const diffDays = Math.abs(
        (scheduledDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeLessThan(1);
    });
  });
});
