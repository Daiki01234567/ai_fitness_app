/**
 * マスタデータ管理API Unit Tests
 *
 * チケット049: マスタデータ管理API
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import { mockTimestamp } from "../../mocks/firestore";

// =============================================================================
// モックセットアップ
// =============================================================================

// Mock firestore references
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

// Document mock for add result (DocumentReference returned by collection.add())
const mockAddDocRef = {
  get: jest.fn(),
  id: "new-doc-id",
};

const mockAdd = jest.fn().mockResolvedValue(mockAddDocRef);

// Document mock
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  id: "test-doc-id",
};

// Query mock
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  }),
};

// Collection mock
const mockCollection = {
  doc: jest.fn().mockReturnValue(mockDocRef),
  add: mockAdd,
  where: jest.fn().mockReturnValue(mockQuery),
  orderBy: jest.fn().mockReturnValue(mockQuery),
  limit: jest.fn().mockReturnValue(mockQuery),
  get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  }),
};

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => ({ _isFieldValue: true, type: "delete" })),
  };

  const mockTimestampFn = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => mockCollection),
        doc: jest.fn(() => mockDocRef),
      })),
      {
        FieldValue: mockFieldValue,
        Timestamp: mockTimestampFn,
      },
    ),
  };
});

// Mock admin auth middleware
const mockRequireAdminFromRequest = jest.fn();
const mockRequireAction = jest.fn();
const mockExecuteAdminAction = jest.fn(
  <T>(_params: unknown, operation: () => Promise<T>) => operation(),
);

jest.mock("../../../src/middleware/adminAuth", () => ({
  requireAdminFromRequest: mockRequireAdminFromRequest,
  requireAction: mockRequireAction,
  executeAdminAction: mockExecuteAdminAction,
}));

// Mock CSRF middleware
jest.mock("../../../src/middleware/csrf", () => ({
  requireCsrfProtection: jest.fn(),
}));

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// HttpsError class for tests
class HttpsError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "HttpsError";
  }
}

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    if (typeof options === "function") {
      return options;
    }
    return handler;
  }),
  HttpsError,
}));

// Mock custom errors
jest.mock("../../../src/utils/errors", () => ({
  NotFoundError: class NotFoundError extends Error {
    code = "not-found";
    constructor(resource: string, id?: string) {
      super(
        id ? `${resource}(${id})が見つかりません` : `${resource}が見つかりません`,
      );
      this.name = "NotFoundError";
    }
  },
  ValidationError: class ValidationError extends Error {
    code = "invalid-argument";
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

// =============================================================================
// ヘルパー関数
// =============================================================================

function createMockRequest(
  data: unknown,
  auth: { uid: string; token?: Record<string, unknown> } | null,
) {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: auth.token || { admin: true, role: "superAdmin" },
        }
      : null,
    rawRequest: {},
  };
}

function createMockExerciseData(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    name: "スクワット",
    nameEn: "Squat",
    description: "下半身を鍛える基本的なエクササイズ",
    category: "lower_body",
    targetMuscles: ["quadriceps", "glutes", "hamstrings"],
    difficulty: "beginner",
    enabled: true,
    displayOrder: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockPlanData(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    name: "プレミアム",
    description: "全機能が利用可能なプラン",
    priceMonthly: 980,
    priceYearly: 9800,
    currency: "JPY",
    features: ["無制限トレーニング", "詳細分析", "広告なし"],
    trialDays: 7,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockAnnouncementData(overrides: Record<string, unknown> = {}) {
  const now = mockTimestamp();
  return {
    title: "メンテナンスのお知らせ",
    content: "明日メンテナンスを実施します",
    type: "maintenance",
    priority: 10,
    targetAudience: "all",
    startDate: now,
    endDate: null,
    enabled: true,
    createdAt: now,
    createdBy: "admin-uid",
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// テスト
// =============================================================================

describe("Admin Master Data API", () => {
  let handlers: Record<string, (request: unknown) => Promise<unknown>>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/admin/masterData");
      handlers = {
        listExercises: module.admin_listExercises,
        createExercise: module.admin_createExercise,
        updateExercise: module.admin_updateExercise,
        listPlans: module.admin_listPlans,
        updatePlan: module.admin_updatePlan,
        listAnnouncements: module.admin_listAnnouncements,
        createAnnouncement: module.admin_createAnnouncement,
        updateAnnouncement: module.admin_updateAnnouncement,
        deleteAnnouncement: module.admin_deleteAnnouncement,
        getAppSettings: module.admin_getAppSettings,
        updateAppSettings: module.admin_updateAppSettings,
      };
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock implementations
    mockRequireAdminFromRequest.mockImplementation(() => {});
    mockRequireAction.mockImplementation(() => {});

    mockGet.mockResolvedValue({
      exists: true,
      id: "test-doc-id",
      data: () => createMockExerciseData(),
    });

    mockQuery.get.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });

    mockAdd.mockResolvedValue({
      id: "new-doc-id",
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => createMockExerciseData(),
      }),
    });

    mockSet.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  // ===========================================================================
  // 種目マスタAPI
  // ===========================================================================

  describe("admin_listExercises", () => {
    it("should require admin authentication", async () => {
      mockRequireAdminFromRequest.mockImplementation(() => {
        throw new HttpsError("permission-denied", "管理者権限が必要です");
      });

      const request = createMockRequest({}, null);

      await expect(handlers.listExercises(request)).rejects.toThrow(
        "管理者権限が必要です",
      );
    });

    it("should return empty list when no exercises exist", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listExercises(request)) as {
        success: boolean;
        data: { exercises: unknown[]; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.exercises).toHaveLength(0);
      expect(result.data.totalCount).toBe(0);
    });

    it("should return exercises list", async () => {
      const mockExercises = [
        { id: "ex1", ...createMockExerciseData({ name: "スクワット" }) },
        { id: "ex2", ...createMockExerciseData({ name: "プッシュアップ" }) },
      ];

      mockQuery.get.mockResolvedValue({
        docs: mockExercises.map((ex) => ({
          id: ex.id,
          data: () => ex,
        })),
        empty: false,
        size: 2,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listExercises(request)) as {
        success: boolean;
        data: { exercises: Array<{ id: string }>; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.exercises.length).toBe(2);
    });
  });

  describe("admin_createExercise", () => {
    it("should require name field", async () => {
      const request = createMockRequest(
        {
          nameEn: "Squat",
          category: "lower_body",
          difficulty: "beginner",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createExercise(request)).rejects.toThrow(
        "種目名は必須です",
      );
    });

    it("should require nameEn field", async () => {
      const request = createMockRequest(
        {
          name: "スクワット",
          category: "lower_body",
          difficulty: "beginner",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createExercise(request)).rejects.toThrow(
        "種目名（英語）は必須です",
      );
    });

    it("should require category field", async () => {
      const request = createMockRequest(
        {
          name: "スクワット",
          nameEn: "Squat",
          difficulty: "beginner",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createExercise(request)).rejects.toThrow(
        "カテゴリは必須です",
      );
    });

    it("should create exercise successfully", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });

      // Setup mockAddDocRef.get for the newly created document
      mockAddDocRef.get.mockResolvedValue({
        exists: true,
        id: "new-exercise-id",
        data: () => createMockExerciseData(),
      });

      mockAdd.mockResolvedValue(mockAddDocRef);

      const request = createMockRequest(
        {
          name: "スクワット",
          nameEn: "Squat",
          description: "下半身トレーニング",
          category: "lower_body",
          targetMuscles: ["quadriceps"],
          difficulty: "beginner",
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.createExercise(request)) as {
        success: boolean;
        data: { exercise: { name: string } };
      };

      expect(result.success).toBe(true);
      expect(result.data.exercise).toBeDefined();
    });
  });

  describe("admin_updateExercise", () => {
    it("should require exerciseId", async () => {
      const request = createMockRequest(
        { name: "新しい名前" },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateExercise(request)).rejects.toThrow(
        "exerciseIdは必須です",
      );
    });

    it("should throw error when exercise not found", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        id: "non-existent",
        data: () => null,
      });

      const request = createMockRequest(
        { exerciseId: "non-existent", name: "新しい名前" },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateExercise(request)).rejects.toThrow();
    });

    it("should update exercise successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          id: "ex-1",
          data: () => createMockExerciseData(),
        })
        .mockResolvedValueOnce({
          exists: true,
          id: "ex-1",
          data: () => createMockExerciseData({ name: "新しい名前" }),
        });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { exerciseId: "ex-1", name: "新しい名前" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateExercise(request)) as {
        success: boolean;
        data: { exercise: { name: string } };
      };

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // プランマスタAPI
  // ===========================================================================

  describe("admin_listPlans", () => {
    it("should return plans list", async () => {
      const mockPlans = [
        { id: "free", ...createMockPlanData({ name: "無料" }) },
        { id: "premium", ...createMockPlanData({ name: "プレミアム" }) },
      ];

      // Use mockCollection.get for direct collection query
      mockCollection.get.mockResolvedValue({
        docs: mockPlans.map((plan) => ({
          id: plan.id,
          data: () => plan,
        })),
        empty: false,
        size: 2,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listPlans(request)) as {
        success: boolean;
        data: { plans: Array<{ id: string }>; totalCount: number };
      };

      expect(result.success).toBe(true);
      expect(result.data.plans.length).toBe(2);
    });
  });

  describe("admin_updatePlan", () => {
    it("should require planId", async () => {
      const request = createMockRequest(
        { name: "新プラン名" },
        { uid: "admin-uid" },
      );

      await expect(handlers.updatePlan(request)).rejects.toThrow(
        "planIdは必須です",
      );
    });

    it("should update plan successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          id: "premium",
          data: () => createMockPlanData(),
        })
        .mockResolvedValueOnce({
          exists: true,
          id: "premium",
          data: () => createMockPlanData({ priceMonthly: 1480 }),
        });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { planId: "premium", priceMonthly: 1480 },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updatePlan(request)) as {
        success: boolean;
        data: { plan: { priceMonthly: number } };
      };

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // お知らせマスタAPI
  // ===========================================================================

  describe("admin_listAnnouncements", () => {
    it("should return announcements list", async () => {
      const mockAnnouncements = [
        { id: "ann1", ...createMockAnnouncementData({ title: "お知らせ1" }) },
        { id: "ann2", ...createMockAnnouncementData({ title: "お知らせ2" }) },
      ];

      mockQuery.get.mockResolvedValue({
        docs: mockAnnouncements.map((ann) => ({
          id: ann.id,
          data: () => ann,
        })),
        empty: false,
        size: 2,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.listAnnouncements(request)) as {
        success: boolean;
        data: { announcements: Array<{ id: string }>; totalCount: number };
      };

      expect(result.success).toBe(true);
    });
  });

  describe("admin_createAnnouncement", () => {
    it("should require title field", async () => {
      const request = createMockRequest(
        {
          content: "内容",
          type: "info",
          startDate: "2025-01-01T00:00:00Z",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createAnnouncement(request)).rejects.toThrow(
        "タイトルは必須です",
      );
    });

    it("should require content field", async () => {
      const request = createMockRequest(
        {
          title: "タイトル",
          type: "info",
          startDate: "2025-01-01T00:00:00Z",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createAnnouncement(request)).rejects.toThrow(
        "内容は必須です",
      );
    });

    it("should create announcement successfully", async () => {
      // Setup mockAddDocRef.get for the newly created document
      mockAddDocRef.get.mockResolvedValue({
        exists: true,
        id: "new-announcement-id",
        data: () => createMockAnnouncementData(),
      });

      mockAdd.mockResolvedValue(mockAddDocRef);

      const request = createMockRequest(
        {
          title: "重要なお知らせ",
          content: "本文です",
          type: "info",
          startDate: "2025-01-01T00:00:00Z",
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.createAnnouncement(request)) as {
        success: boolean;
        data: { announcement: { title: string } };
      };

      expect(result.success).toBe(true);
    });
  });

  describe("admin_updateAnnouncement", () => {
    it("should require announcementId", async () => {
      const request = createMockRequest(
        { title: "新タイトル" },
        { uid: "admin-uid" },
      );

      await expect(handlers.updateAnnouncement(request)).rejects.toThrow(
        "announcementIdは必須です",
      );
    });

    it("should update announcement successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          id: "ann-1",
          data: () => createMockAnnouncementData(),
        })
        .mockResolvedValueOnce({
          exists: true,
          id: "ann-1",
          data: () => createMockAnnouncementData({ title: "新タイトル" }),
        });

      mockUpdate.mockResolvedValue({});

      const request = createMockRequest(
        { announcementId: "ann-1", title: "新タイトル" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateAnnouncement(request)) as {
        success: boolean;
        data: { announcement: { title: string } };
      };

      expect(result.success).toBe(true);
    });
  });

  describe("admin_deleteAnnouncement", () => {
    it("should require announcementId", async () => {
      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.deleteAnnouncement(request)).rejects.toThrow(
        "announcementIdは必須です",
      );
    });

    it("should delete announcement successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: "ann-1",
        data: () => createMockAnnouncementData(),
      });

      mockDelete.mockResolvedValue({});

      const request = createMockRequest(
        { announcementId: "ann-1" },
        { uid: "admin-uid" },
      );

      const result = (await handlers.deleteAnnouncement(request)) as {
        success: boolean;
        data: { message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("お知らせを削除しました");
    });
  });

  // ===========================================================================
  // アプリ設定API
  // ===========================================================================

  describe("admin_getAppSettings", () => {
    it("should return default settings when not configured", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getAppSettings(request)) as {
        success: boolean;
        data: { settings: { maintenanceMode: boolean } };
      };

      expect(result.success).toBe(true);
      expect(result.data.settings.maintenanceMode).toBe(false);
    });

    it("should return current settings", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          maintenanceMode: true,
          maintenanceMessage: "メンテナンス中",
          minAppVersion: { ios: "2.0.0", android: "2.0.0" },
          featureFlags: { newFeature: true },
          updatedAt: mockTimestamp(),
          updatedBy: "admin-uid",
        }),
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      const result = (await handlers.getAppSettings(request)) as {
        success: boolean;
        data: { settings: { maintenanceMode: boolean; maintenanceMessage: string } };
      };

      expect(result.success).toBe(true);
      expect(result.data.settings.maintenanceMode).toBe(true);
      expect(result.data.settings.maintenanceMessage).toBe("メンテナンス中");
    });
  });

  describe("admin_updateAppSettings", () => {
    it("should update maintenance mode", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            maintenanceMode: false,
            minAppVersion: { ios: "1.0.0", android: "1.0.0" },
            featureFlags: {},
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            maintenanceMode: true,
            maintenanceMessage: "緊急メンテナンス",
            minAppVersion: { ios: "1.0.0", android: "1.0.0" },
            featureFlags: {},
            updatedAt: mockTimestamp(),
            updatedBy: "admin-uid",
          }),
        });

      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        {
          maintenanceMode: true,
          maintenanceMessage: "緊急メンテナンス",
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateAppSettings(request)) as {
        success: boolean;
        data: { settings: { maintenanceMode: boolean }; message: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("アプリ設定を更新しました");
    });

    it("should update feature flags", async () => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            maintenanceMode: false,
            minAppVersion: { ios: "1.0.0", android: "1.0.0" },
            featureFlags: { oldFeature: true },
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            maintenanceMode: false,
            minAppVersion: { ios: "1.0.0", android: "1.0.0" },
            featureFlags: { oldFeature: true, newFeature: true },
            updatedAt: mockTimestamp(),
            updatedBy: "admin-uid",
          }),
        });

      mockSet.mockResolvedValue({});

      const request = createMockRequest(
        {
          featureFlags: { newFeature: true },
        },
        { uid: "admin-uid" },
      );

      const result = (await handlers.updateAppSettings(request)) as {
        success: boolean;
        data: { settings: { featureFlags: Record<string, boolean> } };
      };

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // 権限チェックテスト
  // ===========================================================================

  describe("Permission checks", () => {
    it("should require view_master_data permission for listing", async () => {
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "view_master_data") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest({}, { uid: "admin-uid" });

      await expect(handlers.listExercises(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });

    it("should require edit_master_data permission for creating", async () => {
      mockRequireAction.mockImplementation((token, action) => {
        if (action === "edit_master_data") {
          throw new HttpsError(
            "permission-denied",
            "このアクションを実行する権限がありません",
          );
        }
      });

      const request = createMockRequest(
        {
          name: "テスト",
          nameEn: "Test",
          category: "test",
          difficulty: "beginner",
        },
        { uid: "admin-uid" },
      );

      await expect(handlers.createExercise(request)).rejects.toThrow(
        "このアクションを実行する権限がありません",
      );
    });
  });
});
