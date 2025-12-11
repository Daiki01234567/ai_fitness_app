/**
 * セキュリティ監視API
 *
 * セキュリティダッシュボード、セキュリティイベント管理、
 * アラートルール管理、インシデント管理機能を提供
 *
 * チケット047: セキュリティ監視API
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
  getAdminLevel,
} from "../../middleware/adminAuth";
import { requireCsrfProtection } from "../../middleware/csrf";
import {
  SecurityEventType,
  SecuritySeverity,
  SecurityEventStatus,
  ThreatLevel,
  SecurityIncidentStatus,
  IncidentCategory,
  SecurityDashboardResponse,
  SecurityEventSummary,
  ListSecurityEventsRequest,
  ListSecurityEventsResponse,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  ListAlertRulesRequest,
  ListAlertRulesResponse,
  AlertRuleSummary,
  CreateIncidentRequest,
  UpdateIncidentRequest,
  AddIncidentActionRequest,
  ListIncidentsRequest,
  ListIncidentsResponse,
  IncidentSummary,
  IncidentDetailResponse,
  SECURITY_MONITORING_CONSTANTS,
} from "../../types/security";
import { SuccessResponse } from "../../types/api";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// Admin SDK initialization check
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// 定数
// =============================================================================

const {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SECURITY_EVENTS_COLLECTION,
  ALERT_RULES_COLLECTION,
  INCIDENTS_COLLECTION,
  ALERT_HISTORY_COLLECTION,
  BLOCKED_IPS_COLLECTION,
  THREAT_LEVEL_THRESHOLDS,
} = SECURITY_MONITORING_CONSTANTS;

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 取得件数を検証
 */
function validateLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > MAX_LIMIT) {
    return MAX_LIMIT;
  }
  return Math.floor(limit);
}

/**
 * Firestoreタイムスタンプを ISO8601文字列に変換
 */
function timestampToISOString(
  timestamp: admin.firestore.Timestamp | undefined | null,
): string | null {
  if (!timestamp || !timestamp.toDate) {
    return null;
  }
  return timestamp.toDate().toISOString();
}

/**
 * superAdmin権限をチェック
 */
function requireSuperAdmin(request: { auth?: { token?: unknown } | null }): void {
  const level = getAdminLevel(request.auth?.token as admin.auth.DecodedIdToken | undefined);
  if (level !== "super_admin") {
    throw new HttpsError(
      "permission-denied",
      "この操作にはsuperAdmin権限が必要です",
    );
  }
}

// =============================================================================
// セキュリティダッシュボードAPI
// =============================================================================

/**
 * セキュリティダッシュボード取得
 *
 * セキュリティ状態の概要を取得
 * admin以上の権限が必要
 */
export const admin_getSecurityDashboard = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<SecurityDashboardResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const adminId = request.auth!.uid;

    logger.info("Admin getting security dashboard", { adminId });

    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last1h = new Date(now.getTime() - 60 * 60 * 1000);

      // Run queries in parallel
      const [
        eventsLast24hSnapshot,
        eventsLast7dSnapshot,
        activeIncidentsSnapshot,
        recentEventsSnapshot,
        blockedIpsSnapshot,
        alertRulesSnapshot,
        triggeredAlertsSnapshot,
        eventsLast1hSnapshot,
      ] = await Promise.all([
        // Events in last 24h
        db.collection(SECURITY_EVENTS_COLLECTION)
          .where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(last24h))
          .count()
          .get(),
        // Events in last 7d
        db.collection(SECURITY_EVENTS_COLLECTION)
          .where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(last7d))
          .count()
          .get(),
        // Active incidents
        db.collection(INCIDENTS_COLLECTION)
          .where("status", "in", ["open", "investigating", "contained"])
          .count()
          .get(),
        // Recent events (for display)
        db.collection(SECURITY_EVENTS_COLLECTION)
          .orderBy("detectedAt", "desc")
          .limit(10)
          .get(),
        // Blocked IPs
        db.collection(BLOCKED_IPS_COLLECTION)
          .where("expiresAt", ">", admin.firestore.Timestamp.now())
          .count()
          .get(),
        // Active alert rules
        db.collection(ALERT_RULES_COLLECTION)
          .where("enabled", "==", true)
          .count()
          .get(),
        // Triggered alerts in last 24h
        db.collection(ALERT_HISTORY_COLLECTION)
          .where("triggeredAt", ">=", admin.firestore.Timestamp.fromDate(last24h))
          .count()
          .get(),
        // Events in last 1h for threat level calculation
        db.collection(SECURITY_EVENTS_COLLECTION)
          .where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(last1h))
          .get(),
      ]);

      // Calculate threat level
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;

      eventsLast1hSnapshot.docs.forEach((doc) => {
        const event = doc.data();
        switch (event.severity) {
          case "critical":
            criticalCount++;
            break;
          case "high":
            highCount++;
            break;
          case "medium":
            mediumCount++;
            break;
        }
      });

      let threatLevel: ThreatLevel = "low";
      if (criticalCount >= THREAT_LEVEL_THRESHOLDS.CRITICAL_EVENTS_FOR_CRITICAL) {
        threatLevel = "critical";
      } else if (highCount >= THREAT_LEVEL_THRESHOLDS.HIGH_EVENTS_FOR_CRITICAL) {
        threatLevel = "critical";
      } else if (highCount >= THREAT_LEVEL_THRESHOLDS.HIGH_EVENTS_FOR_HIGH) {
        threatLevel = "high";
      } else if (mediumCount >= THREAT_LEVEL_THRESHOLDS.MEDIUM_EVENTS_FOR_HIGH) {
        threatLevel = "high";
      } else if (mediumCount >= THREAT_LEVEL_THRESHOLDS.MEDIUM_EVENTS_FOR_MEDIUM) {
        threatLevel = "medium";
      }

      // Count events by severity in last 24h
      let criticalEventsCount = 0;
      let highEventsCount = 0;

      const eventsLast24hDocsSnapshot = await db.collection(SECURITY_EVENTS_COLLECTION)
        .where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(last24h))
        .get();

      eventsLast24hDocsSnapshot.docs.forEach((doc) => {
        const event = doc.data();
        if (event.severity === "critical") criticalEventsCount++;
        if (event.severity === "high") highEventsCount++;
      });

      // Count login failures and suspicious IPs
      const authLogsSnapshot = await db.collection("authLogs")
        .where("action", "==", "LOGIN_FAILED")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(last24h))
        .get();

      const suspiciousIps = new Set<string>();
      authLogsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.ipAddress) {
          suspiciousIps.add(data.ipAddress);
        }
      });

      // Format recent events
      const recentEvents: SecurityEventSummary[] = recentEventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type as SecurityEventType,
          severity: data.severity as SecuritySeverity,
          title: data.title,
          detectedAt: timestampToISOString(data.detectedAt) || new Date().toISOString(),
          status: data.status as SecurityEventStatus,
        };
      });

      const dashboard: SecurityDashboardResponse = {
        summary: {
          threatLevel,
          eventsLast24h: eventsLast24hSnapshot.data().count,
          eventsLast7d: eventsLast7dSnapshot.data().count,
          activeIncidents: activeIncidentsSnapshot.data().count,
          criticalEvents: criticalEventsCount,
          highEvents: highEventsCount,
        },
        loginSecurity: {
          failuresLast24h: authLogsSnapshot.size,
          suspiciousIpCount: suspiciousIps.size,
          blockedIps: blockedIpsSnapshot.data().count,
        },
        recentEvents,
        alerts: {
          activeAlerts: alertRulesSnapshot.data().count,
          triggeredLast24h: triggeredAlertsSnapshot.data().count,
        },
        generatedAt: now.toISOString(),
      };

      logger.info("Security dashboard retrieved successfully", {
        adminId,
        threatLevel,
      });

      return {
        success: true,
        data: dashboard,
      };
    } catch (error) {
      logger.error("Failed to get security dashboard", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "セキュリティダッシュボードの取得に失敗しました");
    }
  },
);

// =============================================================================
// セキュリティイベントAPI
// =============================================================================

/**
 * セキュリティイベント一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listSecurityEvents = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListSecurityEventsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as ListSecurityEventsRequest;
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin listing security events", {
      adminId,
      limit,
      severity: data.severity,
      status: data.status,
      type: data.type,
    });

    try {
      // Build query
      let query: admin.firestore.Query = db.collection(SECURITY_EVENTS_COLLECTION);

      // Apply filters
      if (data.severity) {
        query = query.where("severity", "==", data.severity);
      }
      if (data.status) {
        query = query.where("status", "==", data.status);
      }
      if (data.type) {
        query = query.where("type", "==", data.type);
      }
      if (data.startDate) {
        const startDate = new Date(data.startDate);
        query = query.where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(startDate));
      }
      if (data.endDate) {
        const endDate = new Date(data.endDate);
        query = query.where("detectedAt", "<=", admin.firestore.Timestamp.fromDate(endDate));
      }

      // Order by detectedAt
      query = query.orderBy("detectedAt", "desc");

      // Apply cursor
      if (data.cursor) {
        const cursorDoc = await db.collection(SECURITY_EVENTS_COLLECTION).doc(data.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      // Apply limit + 1 to check for more
      query = query.limit(limit + 1);

      // Execute query
      const snapshot = await query.get();

      // Get total count
      const totalSnapshot = await db.collection(SECURITY_EVENTS_COLLECTION).count().get();
      const totalCount = totalSnapshot.data().count;

      // Build response
      const events: SecurityEventSummary[] = [];
      let nextCursor: string | undefined;
      const hasMore = snapshot.docs.length > limit;

      for (let i = 0; i < Math.min(snapshot.docs.length, limit); i++) {
        const doc = snapshot.docs[i];
        const eventData = doc.data();
        events.push({
          id: doc.id,
          type: eventData.type as SecurityEventType,
          severity: eventData.severity as SecuritySeverity,
          title: eventData.title,
          detectedAt: timestampToISOString(eventData.detectedAt) || new Date().toISOString(),
          status: eventData.status as SecurityEventStatus,
        });
      }

      if (hasMore && snapshot.docs.length > limit) {
        nextCursor = snapshot.docs[limit - 1].id;
      }

      logger.info("Security events listed successfully", {
        adminId,
        count: events.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          events,
          nextCursor,
          totalCount,
        },
      };
    } catch (error) {
      logger.error("Failed to list security events", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "セキュリティイベント一覧の取得に失敗しました");
    }
  },
);

// =============================================================================
// アラートルール管理API
// =============================================================================

/**
 * アラートルール一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listAlertRules = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListAlertRulesResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as ListAlertRulesRequest;
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin listing alert rules", {
      adminId,
      limit,
      enabled: data.enabled,
      eventType: data.eventType,
    });

    try {
      // Build query
      let query: admin.firestore.Query = db.collection(ALERT_RULES_COLLECTION);

      // Apply filters
      if (data.enabled !== undefined) {
        query = query.where("enabled", "==", data.enabled);
      }
      if (data.eventType) {
        query = query.where("eventType", "==", data.eventType);
      }

      // Order by createdAt
      query = query.orderBy("createdAt", "desc");

      // Apply cursor
      if (data.cursor) {
        const cursorDoc = await db.collection(ALERT_RULES_COLLECTION).doc(data.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      // Apply limit + 1
      query = query.limit(limit + 1);

      // Execute query
      const snapshot = await query.get();

      // Get total count
      const totalSnapshot = await db.collection(ALERT_RULES_COLLECTION).count().get();
      const totalCount = totalSnapshot.data().count;

      // Build response
      const rules: AlertRuleSummary[] = [];
      let nextCursor: string | undefined;
      const hasMore = snapshot.docs.length > limit;

      for (let i = 0; i < Math.min(snapshot.docs.length, limit); i++) {
        const doc = snapshot.docs[i];
        const ruleData = doc.data();
        rules.push({
          id: doc.id,
          name: ruleData.name,
          description: ruleData.description,
          enabled: ruleData.enabled,
          eventType: ruleData.eventType as SecurityEventType,
          severity: ruleData.severity as SecuritySeverity,
          createdAt: timestampToISOString(ruleData.createdAt) || new Date().toISOString(),
        });
      }

      if (hasMore && snapshot.docs.length > limit) {
        nextCursor = snapshot.docs[limit - 1].id;
      }

      logger.info("Alert rules listed successfully", {
        adminId,
        count: rules.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          rules,
          nextCursor,
          totalCount,
        },
      };
    } catch (error) {
      logger.error("Failed to list alert rules", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "アラートルール一覧の取得に失敗しました");
    }
  },
);

/**
 * アラートルール作成
 *
 * superAdmin権限が必要
 */
export const admin_createAlertRule = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ ruleId: string; createdAt: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireSuperAdmin(request);

    const data = request.data as CreateAlertRuleRequest;
    const adminId = request.auth!.uid;

    // Validation
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("ルール名は必須です");
    }
    if (!data.eventType) {
      throw new ValidationError("イベントタイプは必須です");
    }
    if (!data.severity) {
      throw new ValidationError("重要度は必須です");
    }
    if (!data.conditions || data.conditions.length === 0) {
      throw new ValidationError("アラート条件を1つ以上設定してください");
    }
    if (!data.notifications || data.notifications.length === 0) {
      throw new ValidationError("通知先を1つ以上設定してください");
    }
    if (data.cooldownMinutes === undefined || data.cooldownMinutes < 0) {
      throw new ValidationError("クールダウン時間は0以上で設定してください");
    }

    logger.info("Admin creating alert rule", {
      adminId,
      ruleName: data.name,
      eventType: data.eventType,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "アラートルール作成",
        metadata: { ruleName: data.name, eventType: data.eventType },
      },
      async () => {
        const now = admin.firestore.Timestamp.now();
        const ruleId = db.collection(ALERT_RULES_COLLECTION).doc().id;

        const ruleData = {
          id: ruleId,
          name: data.name.trim(),
          description: data.description || "",
          enabled: true,
          eventType: data.eventType,
          conditions: data.conditions,
          severity: data.severity,
          notifications: data.notifications,
          cooldownMinutes: data.cooldownMinutes,
          createdAt: now,
          createdBy: adminId,
          updatedAt: now,
        };

        await db.collection(ALERT_RULES_COLLECTION).doc(ruleId).set(ruleData);

        logger.info("Alert rule created successfully", {
          adminId,
          ruleId,
          ruleName: data.name,
        });

        return {
          success: true as const,
          data: {
            ruleId,
            createdAt: now.toDate().toISOString(),
          },
        };
      },
    );
  },
);

/**
 * アラートルール更新
 *
 * superAdmin権限が必要
 */
export const admin_updateAlertRule = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ ruleId: string; updatedAt: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireSuperAdmin(request);

    const data = request.data as UpdateAlertRuleRequest;
    const adminId = request.auth!.uid;

    if (!data.ruleId) {
      throw new ValidationError("ruleIdは必須です");
    }

    logger.info("Admin updating alert rule", {
      adminId,
      ruleId: data.ruleId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "アラートルール更新",
        metadata: { ruleId: data.ruleId },
      },
      async () => {
        const ruleDoc = await db.collection(ALERT_RULES_COLLECTION).doc(data.ruleId).get();

        if (!ruleDoc.exists) {
          throw new NotFoundError("アラートルール", data.ruleId);
        }

        const now = admin.firestore.Timestamp.now();
        const updateData: Record<string, unknown> = {
          updatedAt: now,
        };

        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description;
        if (data.enabled !== undefined) updateData.enabled = data.enabled;
        if (data.conditions !== undefined) updateData.conditions = data.conditions;
        if (data.severity !== undefined) updateData.severity = data.severity;
        if (data.notifications !== undefined) updateData.notifications = data.notifications;
        if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;

        await db.collection(ALERT_RULES_COLLECTION).doc(data.ruleId).update(updateData);

        logger.info("Alert rule updated successfully", {
          adminId,
          ruleId: data.ruleId,
        });

        return {
          success: true as const,
          data: {
            ruleId: data.ruleId,
            updatedAt: now.toDate().toISOString(),
          },
        };
      },
    );
  },
);

/**
 * アラートルール削除
 *
 * superAdmin権限が必要
 */
export const admin_deleteAlertRule = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ ruleId: string; deletedAt: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication - superAdmin required
    requireAdminFromRequest(request);
    requireSuperAdmin(request);

    const data = request.data as { ruleId: string };
    const adminId = request.auth!.uid;

    if (!data.ruleId) {
      throw new ValidationError("ruleIdは必須です");
    }

    logger.info("Admin deleting alert rule", {
      adminId,
      ruleId: data.ruleId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "アラートルール削除",
        metadata: { ruleId: data.ruleId },
      },
      async () => {
        const ruleDoc = await db.collection(ALERT_RULES_COLLECTION).doc(data.ruleId).get();

        if (!ruleDoc.exists) {
          throw new NotFoundError("アラートルール", data.ruleId);
        }

        await db.collection(ALERT_RULES_COLLECTION).doc(data.ruleId).delete();

        const deletedAt = new Date().toISOString();

        logger.info("Alert rule deleted successfully", {
          adminId,
          ruleId: data.ruleId,
        });

        return {
          success: true as const,
          data: {
            ruleId: data.ruleId,
            deletedAt,
          },
        };
      },
    );
  },
);

// =============================================================================
// インシデント管理API
// =============================================================================

/**
 * インシデント一覧取得
 *
 * admin以上の権限が必要
 */
export const admin_listIncidents = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (request): Promise<SuccessResponse<ListIncidentsResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as ListIncidentsRequest;
    const limit = validateLimit(data.limit);
    const adminId = request.auth!.uid;

    logger.info("Admin listing incidents", {
      adminId,
      limit,
      status: data.status,
      severity: data.severity,
      category: data.category,
    });

    try {
      // Build query
      let query: admin.firestore.Query = db.collection(INCIDENTS_COLLECTION);

      // Apply filters
      if (data.status) {
        query = query.where("status", "==", data.status);
      }
      if (data.severity) {
        query = query.where("severity", "==", data.severity);
      }
      if (data.category) {
        query = query.where("category", "==", data.category);
      }

      // Order by createdAt
      query = query.orderBy("createdAt", "desc");

      // Apply cursor
      if (data.cursor) {
        const cursorDoc = await db.collection(INCIDENTS_COLLECTION).doc(data.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      // Apply limit + 1
      query = query.limit(limit + 1);

      // Execute query
      const snapshot = await query.get();

      // Get total count
      const totalSnapshot = await db.collection(INCIDENTS_COLLECTION).count().get();
      const totalCount = totalSnapshot.data().count;

      // Build response
      const incidents: IncidentSummary[] = [];
      let nextCursor: string | undefined;
      const hasMore = snapshot.docs.length > limit;

      for (let i = 0; i < Math.min(snapshot.docs.length, limit); i++) {
        const doc = snapshot.docs[i];
        const incidentData = doc.data();
        incidents.push({
          id: doc.id,
          title: incidentData.title,
          severity: incidentData.severity as SecuritySeverity,
          status: incidentData.status as SecurityIncidentStatus,
          category: incidentData.category as IncidentCategory,
          affectedUsers: incidentData.affectedUsers || 0,
          assignee: incidentData.assignee,
          detectedAt: timestampToISOString(incidentData.detectedAt) || new Date().toISOString(),
          createdAt: timestampToISOString(incidentData.createdAt) || new Date().toISOString(),
        });
      }

      if (hasMore && snapshot.docs.length > limit) {
        nextCursor = snapshot.docs[limit - 1].id;
      }

      logger.info("Incidents listed successfully", {
        adminId,
        count: incidents.length,
        totalCount,
      });

      return {
        success: true,
        data: {
          incidents,
          nextCursor,
          totalCount,
        },
      };
    } catch (error) {
      logger.error("Failed to list incidents", error as Error, {
        adminId,
      });
      throw new HttpsError("internal", "インシデント一覧の取得に失敗しました");
    }
  },
);

/**
 * インシデント詳細取得
 *
 * admin以上の権限が必要
 */
export const admin_getIncidentDetail = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<IncidentDetailResponse>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as { incidentId: string };
    const adminId = request.auth!.uid;

    if (!data.incidentId) {
      throw new ValidationError("incidentIdは必須です");
    }

    logger.info("Admin getting incident detail", {
      adminId,
      incidentId: data.incidentId,
    });

    try {
      const incidentDoc = await db.collection(INCIDENTS_COLLECTION).doc(data.incidentId).get();

      if (!incidentDoc.exists) {
        throw new NotFoundError("インシデント", data.incidentId);
      }

      const incidentData = incidentDoc.data()!;

      // Format timeline
      const timeline = (incidentData.timeline || []).map((action: Record<string, unknown>) => ({
        id: action.id as string,
        action: action.action as string,
        performedBy: action.performedBy as string,
        performedAt: timestampToISOString(action.performedAt as admin.firestore.Timestamp) || "",
        notes: action.notes as string,
      }));

      logger.info("Incident detail retrieved successfully", {
        adminId,
        incidentId: data.incidentId,
      });

      return {
        success: true,
        data: {
          incident: {
            id: incidentDoc.id,
            title: incidentData.title,
            description: incidentData.description,
            severity: incidentData.severity as SecuritySeverity,
            status: incidentData.status as SecurityIncidentStatus,
            category: incidentData.category as IncidentCategory,
            affectedUsers: incidentData.affectedUsers || 0,
            affectedSystems: incidentData.affectedSystems || [],
            relatedEvents: incidentData.relatedEvents || [],
            assignee: incidentData.assignee,
            timeline,
            detectedAt: timestampToISOString(incidentData.detectedAt) || new Date().toISOString(),
            containedAt: timestampToISOString(incidentData.containedAt) || undefined,
            resolvedAt: timestampToISOString(incidentData.resolvedAt) || undefined,
            closedAt: timestampToISOString(incidentData.closedAt) || undefined,
            rootCause: incidentData.rootCause,
            remediation: incidentData.remediation,
            lessonsLearned: incidentData.lessonsLearned,
            createdAt: timestampToISOString(incidentData.createdAt) || new Date().toISOString(),
            createdBy: incidentData.createdBy,
            updatedAt: timestampToISOString(incidentData.updatedAt) || new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error("Failed to get incident detail", error as Error, {
        adminId,
        incidentId: data.incidentId,
      });
      throw new HttpsError("internal", "インシデント詳細の取得に失敗しました");
    }
  },
);

/**
 * インシデント作成
 *
 * admin以上の権限が必要
 */
export const admin_createIncident = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ incidentId: string; createdAt: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as CreateIncidentRequest;
    const adminId = request.auth!.uid;

    // Validation
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError("タイトルは必須です");
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError("説明は必須です");
    }
    if (!data.severity) {
      throw new ValidationError("重要度は必須です");
    }
    if (!data.category) {
      throw new ValidationError("カテゴリは必須です");
    }

    logger.info("Admin creating incident", {
      adminId,
      title: data.title,
      severity: data.severity,
      category: data.category,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "インシデント作成",
        metadata: { title: data.title, severity: data.severity, category: data.category },
      },
      async () => {
        const now = admin.firestore.Timestamp.now();
        const incidentId = db.collection(INCIDENTS_COLLECTION).doc().id;

        const incidentData = {
          id: incidentId,
          title: data.title.trim(),
          description: data.description.trim(),
          severity: data.severity,
          status: "open" as SecurityIncidentStatus,
          category: data.category,
          affectedUsers: 0,
          affectedSystems: data.affectedSystems || [],
          relatedEvents: data.relatedEvents || [],
          timeline: [{
            id: `action_${Date.now()}`,
            action: "インシデント登録",
            performedBy: adminId,
            performedAt: now,
            notes: "インシデントが登録されました",
          }],
          detectedAt: now,
          createdAt: now,
          createdBy: adminId,
          updatedAt: now,
        };

        await db.collection(INCIDENTS_COLLECTION).doc(incidentId).set(incidentData);

        // Update related security events if specified
        if (data.relatedEvents && data.relatedEvents.length > 0) {
          const batch = db.batch();
          for (const eventId of data.relatedEvents) {
            const eventRef = db.collection(SECURITY_EVENTS_COLLECTION).doc(eventId);
            batch.update(eventRef, {
              status: "investigating" as SecurityEventStatus,
              incidentId,
            });
          }
          await batch.commit();
        }

        logger.info("Incident created successfully", {
          adminId,
          incidentId,
          title: data.title,
        });

        return {
          success: true as const,
          data: {
            incidentId,
            createdAt: now.toDate().toISOString(),
          },
        };
      },
    );
  },
);

/**
 * インシデント更新
 *
 * admin以上の権限が必要
 */
export const admin_updateIncident = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ incidentId: string; updatedAt: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as UpdateIncidentRequest;
    const adminId = request.auth!.uid;

    if (!data.incidentId) {
      throw new ValidationError("incidentIdは必須です");
    }

    logger.info("Admin updating incident", {
      adminId,
      incidentId: data.incidentId,
      status: data.status,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "インシデント更新",
        metadata: { incidentId: data.incidentId, status: data.status },
      },
      async () => {
        const incidentDoc = await db.collection(INCIDENTS_COLLECTION).doc(data.incidentId).get();

        if (!incidentDoc.exists) {
          throw new NotFoundError("インシデント", data.incidentId);
        }

        const now = admin.firestore.Timestamp.now();
        const updateData: Record<string, unknown> = {
          updatedAt: now,
        };

        // Handle status transitions
        if (data.status !== undefined) {
          updateData.status = data.status;

          // Set status-specific timestamps
          if (data.status === "contained") {
            updateData.containedAt = now;
          } else if (data.status === "resolved") {
            updateData.resolvedAt = now;
          } else if (data.status === "closed") {
            updateData.closedAt = now;
          }
        }

        if (data.assignee !== undefined) updateData.assignee = data.assignee;
        if (data.rootCause !== undefined) updateData.rootCause = data.rootCause;
        if (data.remediation !== undefined) updateData.remediation = data.remediation;
        if (data.lessonsLearned !== undefined) updateData.lessonsLearned = data.lessonsLearned;
        if (data.affectedUsers !== undefined) updateData.affectedUsers = data.affectedUsers;

        await db.collection(INCIDENTS_COLLECTION).doc(data.incidentId).update(updateData);

        logger.info("Incident updated successfully", {
          adminId,
          incidentId: data.incidentId,
        });

        return {
          success: true as const,
          data: {
            incidentId: data.incidentId,
            updatedAt: now.toDate().toISOString(),
          },
        };
      },
    );
  },
);

/**
 * インシデントアクション追加
 *
 * admin以上の権限が必要
 */
export const admin_addIncidentAction = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
  },
  async (request): Promise<SuccessResponse<{ incidentId: string; actionId: string }>> => {
    // CSRF protection
    requireCsrfProtection(request);

    // Admin authentication
    requireAdminFromRequest(request);
    requireAction(request.auth!.token, "view_audit_logs");

    const data = request.data as AddIncidentActionRequest;
    const adminId = request.auth!.uid;

    if (!data.incidentId) {
      throw new ValidationError("incidentIdは必須です");
    }
    if (!data.action || data.action.trim().length === 0) {
      throw new ValidationError("アクション内容は必須です");
    }

    logger.info("Admin adding incident action", {
      adminId,
      incidentId: data.incidentId,
    });

    return executeAdminAction(
      {
        adminId,
        targetUserId: adminId,
        action: "view_audit_logs",
        reason: "インシデントアクション追加",
        metadata: { incidentId: data.incidentId },
      },
      async () => {
        const incidentDoc = await db.collection(INCIDENTS_COLLECTION).doc(data.incidentId).get();

        if (!incidentDoc.exists) {
          throw new NotFoundError("インシデント", data.incidentId);
        }

        const now = admin.firestore.Timestamp.now();
        const actionId = `action_${Date.now()}`;

        const newAction = {
          id: actionId,
          action: data.action.trim(),
          performedBy: adminId,
          performedAt: now,
          notes: data.notes || "",
        };

        await db.collection(INCIDENTS_COLLECTION).doc(data.incidentId).update({
          timeline: admin.firestore.FieldValue.arrayUnion(newAction),
          updatedAt: now,
        });

        logger.info("Incident action added successfully", {
          adminId,
          incidentId: data.incidentId,
          actionId,
        });

        return {
          success: true as const,
          data: {
            incidentId: data.incidentId,
            actionId,
          },
        };
      },
    );
  },
);

// =============================================================================
// 不正アクセス検知ヘルパー関数（スケジューラー等から利用）
// =============================================================================

/**
 * セキュリティイベントを作成
 *
 * 不正アクセス検知ロジック等から呼び出される
 */
export async function createSecurityEvent(input: {
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  sourceIp: string;
  userId?: string;
  userAgent?: string;
  endpoint?: string;
  details: Record<string, unknown>;
}): Promise<string> {
  const now = admin.firestore.Timestamp.now();
  const id = db.collection(SECURITY_EVENTS_COLLECTION).doc().id;

  const event = {
    id,
    ...input,
    status: "new" as SecurityEventStatus,
    detectedAt: now,
  };

  await db.collection(SECURITY_EVENTS_COLLECTION).doc(id).set(event);

  // Check and trigger alerts
  await checkAndTriggerAlerts(event);

  logger.warn("Security event created", {
    eventId: id,
    type: input.type,
    severity: input.severity,
  });

  return id;
}

/**
 * アラートルールをチェックしてトリガー
 */
async function checkAndTriggerAlerts(event: {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
}): Promise<void> {
  try {
    // Get enabled alert rules for this event type
    const rulesSnapshot = await db.collection(ALERT_RULES_COLLECTION)
      .where("enabled", "==", true)
      .where("eventType", "==", event.type)
      .get();

    for (const ruleDoc of rulesSnapshot.docs) {
      const rule = ruleDoc.data();

      // Check severity threshold
      if (shouldTriggerBySeverity(event.severity, rule.severity)) {
        // Check cooldown
        const canTrigger = await checkCooldown(rule.id, rule.cooldownMinutes);
        if (!canTrigger) continue;

        // Record alert trigger
        await db.collection(ALERT_HISTORY_COLLECTION).add({
          ruleId: rule.id,
          ruleName: rule.name,
          eventId: event.id,
          eventType: event.type,
          severity: event.severity,
          triggeredAt: admin.firestore.Timestamp.now(),
        });

        logger.info("Alert triggered", {
          ruleId: rule.id,
          eventId: event.id,
        });

        // TODO: Send actual notifications (email, slack, webhook)
        // This would be implemented based on rule.notifications
      }
    }
  } catch (error) {
    logger.error("Failed to check and trigger alerts", error as Error, {
      eventId: event.id,
    });
  }
}

/**
 * 重要度に基づいてトリガーすべきか判定
 */
function shouldTriggerBySeverity(eventSeverity: SecuritySeverity, ruleSeverity: SecuritySeverity): boolean {
  const severityOrder: Record<SecuritySeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return severityOrder[eventSeverity] >= severityOrder[ruleSeverity];
}

/**
 * クールダウン期間をチェック
 */
async function checkCooldown(ruleId: string, cooldownMinutes: number): Promise<boolean> {
  if (cooldownMinutes <= 0) return true;

  const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recentTriggers = await db.collection(ALERT_HISTORY_COLLECTION)
    .where("ruleId", "==", ruleId)
    .where("triggeredAt", ">=", admin.firestore.Timestamp.fromDate(cooldownStart))
    .limit(1)
    .get();

  return recentTriggers.empty;
}

/**
 * IPアドレスを一時的にブロック
 */
export async function temporarilyBlockIp(
  ip: string,
  durationMinutes: number,
  reason?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  await db.collection(BLOCKED_IPS_COLLECTION).add({
    ip,
    blockedAt: admin.firestore.Timestamp.now(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    durationMinutes,
    reason: reason || "自動ブロック",
  });

  logger.warn("IP temporarily blocked", {
    ip,
    durationMinutes,
    reason,
  });
}
