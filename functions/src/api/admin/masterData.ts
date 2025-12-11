/**
 * マスタデータ管理API
 *
 * 種目マスタ、プランマスタ、お知らせマスタ、アプリ設定の管理機能を提供
 *
 * チケット049: マスタデータ管理API
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  requireAdminFromRequest,
  requireAction,
  executeAdminAction,
} from "../../middleware/adminAuth";
import { requireCsrfProtection } from "../../middleware/csrf";
import {
  ExerciseMaster,
  PlanMaster,
  Announcement,
  AppSettings,
  ListExercisesRequest,
  ListExercisesResponse,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  ExerciseResponse,
  ListPlansRequest,
  ListPlansResponse,
  UpdatePlanRequest,
  PlanResponse,
  ListAnnouncementsRequest,
  ListAnnouncementsResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  DeleteAnnouncementRequest,
  AnnouncementResponse,
  GetAppSettingsResponse,
  UpdateAppSettingsRequest,
  AppSettingsResponse,
  MASTER_DATA_CONSTANTS,
} from "../../types/admin";
import { SuccessResponse } from "../../types/api";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Firestoreタイムスタンプを変換してマスタデータを返す
 */
function convertTimestamps<T extends { createdAt?: unknown; updatedAt?: unknown }>(
  data: T,
): T {
  return {
    ...data,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * 取得件数を検証
 */
function validateLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return MASTER_DATA_CONSTANTS.DEFAULT_LIMIT;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > MASTER_DATA_CONSTANTS.MAX_LIMIT) {
    return MASTER_DATA_CONSTANTS.MAX_LIMIT;
  }
  return Math.floor(limit);
}

// =============================================================================
// 種目マスタAPI
// =============================================================================

/**
 * 種目一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listExercises = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListExercisesResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_master_data");

    const data = request.data as ListExercisesRequest;
    const adminId = request.auth!.uid;

    logger.info("Admin listing exercises", {
      adminId,
      enabledOnly: data.enabledOnly,
      category: data.category,
    });

    try {
      let query: admin.firestore.Query = db.collection(
        MASTER_DATA_CONSTANTS.EXERCISES_COLLECTION,
      );

      // Apply filters
      if (data.enabledOnly) {
        query = query.where("enabled", "==", true);
      }
      if (data.category) {
        query = query.where("category", "==", data.category);
      }

      // Sort by displayOrder
      query = query.orderBy("displayOrder", "asc");

      const snapshot = await query.get();

      const exercises: ExerciseMaster[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data() as Omit<ExerciseMaster, "id">),
      }));

      logger.info("Exercises listed successfully", {
        adminId,
        count: exercises.length,
      });

      return {
        success: true,
        data: {
          exercises,
          totalCount: exercises.length,
        },
      };
    } catch (error) {
      logger.error("Failed to list exercises", error as Error, { adminId });
      throw new HttpsError("internal", "種目一覧の取得に失敗しました");
    }
  },
);

/**
 * 種目作成
 *
 * superAdmin権限が必要
 */
export const admin_createExercise = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ExerciseResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as CreateExerciseRequest;
    const adminId = request.auth!.uid;

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("種目名は必須です");
    }
    if (!data.nameEn || data.nameEn.trim().length === 0) {
      throw new ValidationError("種目名（英語）は必須です");
    }
    if (!data.category || data.category.trim().length === 0) {
      throw new ValidationError("カテゴリは必須です");
    }
    if (!data.difficulty) {
      throw new ValidationError("難易度は必須です");
    }

    logger.info("Admin creating exercise", {
      adminId,
      name: data.name,
      category: data.category,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `種目作成: ${data.name}`,
      },
      async () => {
        const now = admin.firestore.FieldValue.serverTimestamp();

        // Get next display order
        const lastExercise = await db
          .collection(MASTER_DATA_CONSTANTS.EXERCISES_COLLECTION)
          .orderBy("displayOrder", "desc")
          .limit(1)
          .get();

        const nextDisplayOrder = lastExercise.empty
          ? 1
          : (lastExercise.docs[0].data().displayOrder || 0) + 1;

        const exerciseData = {
          name: data.name.trim(),
          nameEn: data.nameEn.trim(),
          description: data.description || "",
          category: data.category.trim(),
          targetMuscles: data.targetMuscles || [],
          difficulty: data.difficulty,
          enabled: true,
          displayOrder: data.displayOrder ?? nextDisplayOrder,
          createdAt: now,
          updatedAt: now,
        };

        const docRef = await db
          .collection(MASTER_DATA_CONSTANTS.EXERCISES_COLLECTION)
          .add(exerciseData);

        const createdDoc = await docRef.get();
        const exercise: ExerciseMaster = {
          id: docRef.id,
          ...convertTimestamps(createdDoc.data() as Omit<ExerciseMaster, "id">),
        };

        logger.info("Exercise created successfully", {
          adminId,
          exerciseId: docRef.id,
          name: data.name,
        });

        return {
          success: true as const,
          data: { exercise },
        };
      },
    );
  },
);

/**
 * 種目更新
 *
 * superAdmin権限が必要
 */
export const admin_updateExercise = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ExerciseResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as UpdateExerciseRequest;
    const adminId = request.auth!.uid;

    if (!data.exerciseId) {
      throw new ValidationError("exerciseIdは必須です");
    }

    logger.info("Admin updating exercise", {
      adminId,
      exerciseId: data.exerciseId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `種目更新: ${data.exerciseId}`,
      },
      async () => {
        const docRef = db
          .collection(MASTER_DATA_CONSTANTS.EXERCISES_COLLECTION)
          .doc(data.exerciseId);

        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          throw new NotFoundError("種目", data.exerciseId);
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.nameEn !== undefined) updateData.nameEn = data.nameEn.trim();
        if (data.description !== undefined) updateData.description = data.description;
        if (data.category !== undefined) updateData.category = data.category.trim();
        if (data.targetMuscles !== undefined) updateData.targetMuscles = data.targetMuscles;
        if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
        if (data.enabled !== undefined) updateData.enabled = data.enabled;
        if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        const exercise: ExerciseMaster = {
          id: docRef.id,
          ...convertTimestamps(updatedDoc.data() as Omit<ExerciseMaster, "id">),
        };

        logger.info("Exercise updated successfully", {
          adminId,
          exerciseId: data.exerciseId,
        });

        return {
          success: true as const,
          data: { exercise },
        };
      },
    );
  },
);

// =============================================================================
// プランマスタAPI
// =============================================================================

/**
 * プラン一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listPlans = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListPlansResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_master_data");

    const data = request.data as ListPlansRequest;
    const adminId = request.auth!.uid;

    logger.info("Admin listing plans", {
      adminId,
      enabledOnly: data.enabledOnly,
    });

    try {
      let query: admin.firestore.Query = db.collection(
        MASTER_DATA_CONSTANTS.PLANS_COLLECTION,
      );

      if (data.enabledOnly) {
        query = query.where("enabled", "==", true);
      }

      const snapshot = await query.get();

      const plans: PlanMaster[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data() as Omit<PlanMaster, "id">),
      }));

      logger.info("Plans listed successfully", {
        adminId,
        count: plans.length,
      });

      return {
        success: true,
        data: {
          plans,
          totalCount: plans.length,
        },
      };
    } catch (error) {
      logger.error("Failed to list plans", error as Error, { adminId });
      throw new HttpsError("internal", "プラン一覧の取得に失敗しました");
    }
  },
);

/**
 * プラン更新
 *
 * superAdmin権限が必要
 */
export const admin_updatePlan = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<PlanResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as UpdatePlanRequest;
    const adminId = request.auth!.uid;

    if (!data.planId) {
      throw new ValidationError("planIdは必須です");
    }

    logger.info("Admin updating plan", {
      adminId,
      planId: data.planId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `プラン更新: ${data.planId}`,
      },
      async () => {
        const docRef = db
          .collection(MASTER_DATA_CONSTANTS.PLANS_COLLECTION)
          .doc(data.planId);

        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          throw new NotFoundError("プラン", data.planId);
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.priceMonthly !== undefined) updateData.priceMonthly = data.priceMonthly;
        if (data.priceYearly !== undefined) updateData.priceYearly = data.priceYearly;
        if (data.features !== undefined) updateData.features = data.features;
        if (data.trialDays !== undefined) updateData.trialDays = data.trialDays;
        if (data.enabled !== undefined) updateData.enabled = data.enabled;

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        const plan: PlanMaster = {
          id: docRef.id,
          ...convertTimestamps(updatedDoc.data() as Omit<PlanMaster, "id">),
        };

        logger.info("Plan updated successfully", {
          adminId,
          planId: data.planId,
        });

        return {
          success: true as const,
          data: { plan },
        };
      },
    );
  },
);

// =============================================================================
// お知らせマスタAPI
// =============================================================================

/**
 * お知らせ一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listAnnouncements = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListAnnouncementsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_master_data");

    const data = request.data as ListAnnouncementsRequest;
    const adminId = request.auth!.uid;
    const limit = validateLimit(data.limit);

    logger.info("Admin listing announcements", {
      adminId,
      enabledOnly: data.enabledOnly,
      type: data.type,
      limit,
    });

    try {
      let query: admin.firestore.Query = db.collection(
        MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION,
      );

      if (data.enabledOnly) {
        query = query.where("enabled", "==", true);
      }
      if (data.type) {
        query = query.where("type", "==", data.type);
      }

      // Sort by priority (desc) and startDate (desc)
      query = query.orderBy("priority", "desc").orderBy("startDate", "desc");

      // Apply cursor
      if (data.cursor) {
        const cursorDoc = await db
          .collection(MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION)
          .doc(data.cursor)
          .get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      query = query.limit(limit + 1);

      const snapshot = await query.get();

      // Get total count
      const totalSnapshot = await db
        .collection(MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION)
        .count()
        .get();
      const totalCount = totalSnapshot.data().count;

      const docs = snapshot.docs;
      const hasMore = docs.length > limit;

      const announcements: Announcement[] = docs
        .slice(0, limit)
        .map((doc) => ({
          id: doc.id,
          ...convertTimestamps(doc.data() as Omit<Announcement, "id">),
        }));

      const nextCursor = hasMore ? docs[limit - 1].id : undefined;

      logger.info("Announcements listed successfully", {
        adminId,
        count: announcements.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          announcements,
          nextCursor,
          totalCount,
        },
      };
    } catch (error) {
      logger.error("Failed to list announcements", error as Error, { adminId });
      throw new HttpsError("internal", "お知らせ一覧の取得に失敗しました");
    }
  },
);

/**
 * お知らせ作成
 *
 * admin以上の権限が必要
 */
export const admin_createAnnouncement = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<AnnouncementResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as CreateAnnouncementRequest;
    const adminId = request.auth!.uid;

    // Validate required fields
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError("タイトルは必須です");
    }
    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError("内容は必須です");
    }
    if (!data.type) {
      throw new ValidationError("タイプは必須です");
    }
    if (!data.startDate) {
      throw new ValidationError("公開開始日時は必須です");
    }

    logger.info("Admin creating announcement", {
      adminId,
      title: data.title,
      type: data.type,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `お知らせ作成: ${data.title}`,
      },
      async () => {
        const now = admin.firestore.FieldValue.serverTimestamp();

        const announcementData = {
          title: data.title.trim(),
          content: data.content.trim(),
          type: data.type,
          priority: data.priority ?? 0,
          targetAudience: data.targetAudience ?? "all",
          startDate: admin.firestore.Timestamp.fromDate(new Date(data.startDate)),
          endDate: data.endDate
            ? admin.firestore.Timestamp.fromDate(new Date(data.endDate))
            : null,
          enabled: true,
          createdAt: now,
          createdBy: adminId,
          updatedAt: now,
        };

        const docRef = await db
          .collection(MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION)
          .add(announcementData);

        const createdDoc = await docRef.get();
        const announcement: Announcement = {
          id: docRef.id,
          ...convertTimestamps(createdDoc.data() as Omit<Announcement, "id">),
        };

        logger.info("Announcement created successfully", {
          adminId,
          announcementId: docRef.id,
          title: data.title,
        });

        return {
          success: true as const,
          data: { announcement },
        };
      },
    );
  },
);

/**
 * お知らせ更新
 *
 * admin以上の権限が必要
 */
export const admin_updateAnnouncement = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<AnnouncementResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as UpdateAnnouncementRequest;
    const adminId = request.auth!.uid;

    if (!data.announcementId) {
      throw new ValidationError("announcementIdは必須です");
    }

    logger.info("Admin updating announcement", {
      adminId,
      announcementId: data.announcementId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `お知らせ更新: ${data.announcementId}`,
      },
      async () => {
        const docRef = db
          .collection(MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION)
          .doc(data.announcementId);

        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          throw new NotFoundError("お知らせ", data.announcementId);
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.content !== undefined) updateData.content = data.content.trim();
        if (data.type !== undefined) updateData.type = data.type;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.targetAudience !== undefined) updateData.targetAudience = data.targetAudience;
        if (data.startDate !== undefined) {
          updateData.startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
        }
        if (data.endDate !== undefined) {
          updateData.endDate = data.endDate
            ? admin.firestore.Timestamp.fromDate(new Date(data.endDate))
            : null;
        }
        if (data.enabled !== undefined) updateData.enabled = data.enabled;

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        const announcement: Announcement = {
          id: docRef.id,
          ...convertTimestamps(updatedDoc.data() as Omit<Announcement, "id">),
        };

        logger.info("Announcement updated successfully", {
          adminId,
          announcementId: data.announcementId,
        });

        return {
          success: true as const,
          data: { announcement },
        };
      },
    );
  },
);

/**
 * お知らせ削除
 *
 * admin以上の権限が必要
 */
export const admin_deleteAnnouncement = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ message: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as DeleteAnnouncementRequest;
    const adminId = request.auth!.uid;

    if (!data.announcementId) {
      throw new ValidationError("announcementIdは必須です");
    }

    logger.info("Admin deleting announcement", {
      adminId,
      announcementId: data.announcementId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: `お知らせ削除: ${data.announcementId}`,
      },
      async () => {
        const docRef = db
          .collection(MASTER_DATA_CONSTANTS.ANNOUNCEMENTS_COLLECTION)
          .doc(data.announcementId);

        const existingDoc = await docRef.get();
        if (!existingDoc.exists) {
          throw new NotFoundError("お知らせ", data.announcementId);
        }

        await docRef.delete();

        logger.info("Announcement deleted successfully", {
          adminId,
          announcementId: data.announcementId,
        });

        return {
          success: true as const,
          data: { message: "お知らせを削除しました" },
        };
      },
    );
  },
);

// =============================================================================
// アプリ設定API
// =============================================================================

/**
 * アプリ設定取得
 *
 * admin以上の権限が必要
 */
export const admin_getAppSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<GetAppSettingsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_master_data");

    const adminId = request.auth!.uid;

    logger.info("Admin getting app settings", { adminId });

    try {
      const docRef = db.doc(MASTER_DATA_CONSTANTS.APP_SETTINGS_DOC_PATH);
      const doc = await docRef.get();

      let settings: AppSettings;

      if (!doc.exists) {
        // Return default settings
        settings = {
          maintenanceMode: false,
          maintenanceMessage: undefined,
          minAppVersion: {
            ios: "1.0.0",
            android: "1.0.0",
          },
          featureFlags: {},
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: "system",
        };
      } else {
        settings = doc.data() as AppSettings;
      }

      logger.info("App settings retrieved successfully", { adminId });

      return {
        success: true,
        data: { settings },
      };
    } catch (error) {
      logger.error("Failed to get app settings", error as Error, { adminId });
      throw new HttpsError("internal", "アプリ設定の取得に失敗しました");
    }
  },
);

/**
 * アプリ設定更新
 *
 * superAdmin権限が必要
 */
export const admin_updateAppSettings = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<AppSettingsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "edit_master_data");

    const data = request.data as UpdateAppSettingsRequest;
    const adminId = request.auth!.uid;

    logger.info("Admin updating app settings", {
      adminId,
      maintenanceMode: data.maintenanceMode,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: "",
        action: "edit_master_data",
        reason: "アプリ設定更新",
        metadata: {
          maintenanceMode: data.maintenanceMode,
          minAppVersion: data.minAppVersion,
        },
      },
      async () => {
        const docRef = db.doc(MASTER_DATA_CONSTANTS.APP_SETTINGS_DOC_PATH);

        // Get existing settings or create defaults
        const existingDoc = await docRef.get();
        const existingSettings = existingDoc.exists
          ? (existingDoc.data() as AppSettings)
          : {
              maintenanceMode: false,
              minAppVersion: { ios: "1.0.0", android: "1.0.0" },
              featureFlags: {},
            };

        // Build update object
        const updateData: Record<string, unknown> = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: adminId,
        };

        if (data.maintenanceMode !== undefined) {
          updateData.maintenanceMode = data.maintenanceMode;
        }
        if (data.maintenanceMessage !== undefined) {
          updateData.maintenanceMessage = data.maintenanceMessage;
        }
        if (data.minAppVersion !== undefined) {
          updateData.minAppVersion = {
            ios: data.minAppVersion.ios ?? existingSettings.minAppVersion.ios,
            android: data.minAppVersion.android ?? existingSettings.minAppVersion.android,
          };
        }
        if (data.featureFlags !== undefined) {
          updateData.featureFlags = {
            ...existingSettings.featureFlags,
            ...data.featureFlags,
          };
        }

        await docRef.set(updateData, { merge: true });

        const updatedDoc = await docRef.get();
        const settings = updatedDoc.data() as AppSettings;

        logger.info("App settings updated successfully", {
          adminId,
          maintenanceMode: settings.maintenanceMode,
        });

        return {
          success: true as const,
          data: {
            settings,
            message: "アプリ設定を更新しました",
          },
        };
      },
    );
  },
);
