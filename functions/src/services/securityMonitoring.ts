/**
 * セキュリティ監視サービス
 *
 * 異常検知、不正アクセス検知、セキュリティインシデント管理機能を提供
 *
 * 参照: docs/specs/07_セキュリティポリシー_v1_0.md Section 11.2
 * 参照: docs/specs/01_システムアーキテクチャ設計書_v3_2.md Section 13.4
 *
 * @version 1.0.0
 * @date 2025-11-28
 */

import * as admin from "firebase-admin";
import { logger } from "../utils/logger";
import { metricsService, errorReportingService } from "./monitoring";

// =============================================================================
// 型定義
// =============================================================================

/**
 * セキュリティイベントの種類
 */
export type SecurityEventType =
  | "BRUTE_FORCE_DETECTED"
  | "UNAUTHORIZED_ACCESS"
  | "MASS_DATA_DOWNLOAD"
  | "RATE_LIMIT_EXCEEDED"
  | "SUSPICIOUS_ACTIVITY"
  | "ACCOUNT_LOCKOUT"
  | "PRIVILEGE_ESCALATION"
  | "DATA_EXFILTRATION_ATTEMPT"
  | "ANOMALY_DETECTED"
  | "GDPR_VIOLATION_RISK";

/**
 * セキュリティイベントの重要度
 */
export type SecuritySeverity = "low" | "medium" | "high" | "critical";

/**
 * セキュリティイベント
 */
export interface SecurityEvent {
  id?: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: FirebaseFirestore.Timestamp;
  sourceIp?: string;
  userId?: string;
  targetResource?: string;
  description: string;
  indicators: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: FirebaseFirestore.Timestamp;
  resolvedBy?: string;
  notes?: string;
}

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  blockDurationSeconds?: number;
}

/**
 * 異常検知設定
 */
export interface AnomalyConfig {
  metric: string;
  threshold: number;
  comparison: "gt" | "lt" | "gte" | "lte";
  windowMinutes: number;
}

// =============================================================================
// セキュリティ監視サービス
// =============================================================================

class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private db: FirebaseFirestore.Firestore | null = null;

  // In-memory rate limiting cache (for non-distributed scenarios)
  private rateLimitCache: Map<string, { count: number; resetAt: number }> =
    new Map();

  // Failed login attempts tracking
  private failedLoginAttempts: Map<
    string,
    { count: number; lastAttempt: number }
  > = new Map();

  // Configuration
  private readonly config = {
    bruteForce: {
      maxAttempts: 5,
      windowSeconds: 300, // 5 minutes
      lockoutSeconds: 900, // 15 minutes
    },
    massDownload: {
      threshold: 100, // records
      windowSeconds: 60, // 1 minute
    },
    rateLimit: {
      default: {
        windowSeconds: 60,
        maxRequests: 100,
      } as RateLimitConfig,
    },
  };

  private constructor() {}

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Firestoreインスタンスを初期化
   */
  private getDb(): FirebaseFirestore.Firestore {
    if (!this.db) {
      this.db = admin.firestore();
    }
    return this.db;
  }

  // ===========================================================================
  // ブルートフォース検知
  // ===========================================================================

  /**
   * ログイン失敗を記録し、ブルートフォース攻撃を検知
   */
  async recordLoginFailure(
    identifier: string,
    sourceIp?: string,
    userId?: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    const now = Date.now();
    const key = `login:${identifier}`;
    const existing = this.failedLoginAttempts.get(key);

    let count = 1;
    const windowMs = this.config.bruteForce.windowSeconds * 1000;

    if (existing && now - existing.lastAttempt < windowMs) {
      count = existing.count + 1;
    }

    this.failedLoginAttempts.set(key, { count, lastAttempt: now });

    const remainingAttempts = Math.max(
      0,
      this.config.bruteForce.maxAttempts - count,
    );
    const blocked = count >= this.config.bruteForce.maxAttempts;

    // Log the security event
    logger.security({
      eventType: "LOGIN_FAILURE",
      severity: blocked ? "high" : "medium",
      description: `Login failure for ${identifier} (attempt ${count}/${this.config.bruteForce.maxAttempts})`,
      sourceIp,
      indicators: {
        identifier,
        attemptCount: count,
        blocked,
      },
    });

    // Record metrics
    metricsService.recordAuthFailure("login", blocked ? "blocked" : "failed");

    if (blocked) {
      // Create security event
      await this.createSecurityEvent({
        type: "BRUTE_FORCE_DETECTED",
        severity: "high",
        description: `Brute force attack detected for ${identifier}`,
        sourceIp,
        userId,
        indicators: {
          identifier,
          attemptCount: count,
          windowSeconds: this.config.bruteForce.windowSeconds,
        },
      });

      // Log brute force detection
      logger.bruteForceDetected(sourceIp || "unknown", count, userId);
    }

    return { blocked, remainingAttempts };
  }

  /**
   * ログイン成功時にカウンターをリセット
   */
  clearLoginFailures(identifier: string): void {
    const key = `login:${identifier}`;
    this.failedLoginAttempts.delete(key);
  }

  /**
   * アカウントがロックされているか確認
   */
  isAccountLocked(identifier: string): boolean {
    const key = `login:${identifier}`;
    const existing = this.failedLoginAttempts.get(key);

    if (!existing) return false;

    const now = Date.now();
    const windowMs = this.config.bruteForce.windowSeconds * 1000;

    if (now - existing.lastAttempt >= windowMs) {
      // Window expired, clear the record
      this.failedLoginAttempts.delete(key);
      return false;
    }

    return existing.count >= this.config.bruteForce.maxAttempts;
  }

  // ===========================================================================
  // レート制限
  // ===========================================================================

  /**
   * レート制限をチェック
   */
  checkRateLimit(
    identifier: string,
    endpoint: string,
    config?: RateLimitConfig,
  ): { allowed: boolean; remaining: number; resetIn: number } {
    const limitConfig = config || this.config.rateLimit.default;
    const key = `rate:${endpoint}:${identifier}`;
    const now = Date.now();
    const existing = this.rateLimitCache.get(key);

    if (existing && now < existing.resetAt) {
      const allowed = existing.count < limitConfig.maxRequests;
      if (!allowed) {
        // Log rate limit exceeded
        logger.rateLimitExceeded(
          identifier,
          endpoint,
          existing.count,
          limitConfig.windowSeconds,
        );
      }

      if (allowed) {
        existing.count++;
      }

      return {
        allowed,
        remaining: Math.max(0, limitConfig.maxRequests - existing.count),
        resetIn: Math.ceil((existing.resetAt - now) / 1000),
      };
    }

    // Create new window
    const resetAt = now + limitConfig.windowSeconds * 1000;
    this.rateLimitCache.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: limitConfig.maxRequests - 1,
      resetIn: limitConfig.windowSeconds,
    };
  }

  /**
   * レート制限キャッシュをクリーンアップ
   */
  cleanupRateLimitCache(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now >= value.resetAt) {
        this.rateLimitCache.delete(key);
      }
    }
  }

  // ===========================================================================
  // 大量データダウンロード検知
  // ===========================================================================

  /**
   * データアクセスを記録し、大量ダウンロードを検知
   */
  async recordDataAccess(
    userId: string,
    resourceType: string,
    recordCount: number,
    sourceIp?: string,
  ): Promise<{ flagged: boolean }> {
    const threshold = this.config.massDownload.threshold;
    const flagged = recordCount >= threshold;

    if (flagged) {
      // Log mass data download
      logger.massDataDownload(userId, recordCount, resourceType, sourceIp);

      // Create security event
      await this.createSecurityEvent({
        type: "MASS_DATA_DOWNLOAD",
        severity: "high",
        description: `Mass data download detected: ${recordCount} ${resourceType} records`,
        userId,
        sourceIp,
        targetResource: resourceType,
        indicators: {
          recordCount,
          threshold,
          resourceType,
        },
      });
    }

    return { flagged };
  }

  // ===========================================================================
  // 不正アクセス検知
  // ===========================================================================

  /**
   * 不正アクセス試行を記録
   */
  async recordUnauthorizedAccess(
    userId: string,
    targetResource: string,
    requestedPermission: string,
    sourceIp?: string,
  ): Promise<void> {
    // Log unauthorized access attempt
    logger.unauthorizedAccessAttempt(
      userId,
      targetResource,
      requestedPermission,
      sourceIp,
    );

    // Create security event
    await this.createSecurityEvent({
      type: "UNAUTHORIZED_ACCESS",
      severity: "medium",
      description: `Unauthorized access attempt to ${targetResource}`,
      userId,
      sourceIp,
      targetResource,
      indicators: {
        requestedPermission,
      },
    });
  }

  /**
   * 権限昇格試行を記録
   */
  async recordPrivilegeEscalation(
    userId: string,
    currentRole: string,
    attemptedRole: string,
    sourceIp?: string,
  ): Promise<void> {
    logger.security({
      eventType: "PRIVILEGE_ESCALATION",
      severity: "critical",
      description: `Privilege escalation attempt from ${currentRole} to ${attemptedRole}`,
      sourceIp,
      indicators: {
        userId,
        currentRole,
        attemptedRole,
      },
    });

    await this.createSecurityEvent({
      type: "PRIVILEGE_ESCALATION",
      severity: "critical",
      description: `User ${userId} attempted to escalate from ${currentRole} to ${attemptedRole}`,
      userId,
      sourceIp,
      indicators: {
        currentRole,
        attemptedRole,
      },
    });
  }

  // ===========================================================================
  // 異常検知
  // ===========================================================================

  /**
   * 異常を検知して記録
   */
  async recordAnomaly(
    description: string,
    severity: SecuritySeverity,
    indicators: Record<string, unknown>,
    userId?: string,
    sourceIp?: string,
  ): Promise<void> {
    logger.security({
      eventType: "ANOMALY_DETECTED",
      severity,
      description,
      sourceIp,
      indicators,
    });

    await this.createSecurityEvent({
      type: "ANOMALY_DETECTED",
      severity,
      description,
      userId,
      sourceIp,
      indicators,
    });
  }

  /**
   * GDPR違反リスクを記録
   */
  async recordGdprViolationRisk(
    description: string,
    userId?: string,
    indicators?: Record<string, unknown>,
  ): Promise<void> {
    logger.security({
      eventType: "GDPR_VIOLATION_RISK",
      severity: "critical",
      description,
      indicators: indicators || {},
    });

    await this.createSecurityEvent({
      type: "GDPR_VIOLATION_RISK",
      severity: "critical",
      description,
      userId,
      indicators: indicators || {},
    });

    // Also report as error for immediate attention
    errorReportingService.reportCritical(
      `GDPR Violation Risk: ${description}`,
      new Error(description),
      { userId },
    );
  }

  // ===========================================================================
  // セキュリティイベント管理
  // ===========================================================================

  /**
   * セキュリティイベントを作成
   */
  async createSecurityEvent(
    event: Omit<SecurityEvent, "id" | "timestamp" | "resolved">,
  ): Promise<string> {
    try {
      const db = this.getDb();
      const docRef = await db.collection("securityEvents").add({
        ...event,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        resolved: false,
      });

      logger.info(`Security event created: ${event.type}`, {
        eventId: docRef.id,
        type: event.type,
        severity: event.severity,
      });

      return docRef.id;
    } catch (error) {
      logger.error("Failed to create security event", error as Error, {
        type: event.type,
        severity: event.severity,
      });
      throw error;
    }
  }

  /**
   * セキュリティイベントを解決済みにマーク
   */
  async resolveSecurityEvent(
    eventId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<void> {
    try {
      const db = this.getDb();
      await db
        .collection("securityEvents")
        .doc(eventId)
        .update({
          resolved: true,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedBy,
          notes,
        });

      logger.info(`Security event resolved: ${eventId}`, {
        eventId,
        resolvedBy,
      });
    } catch (error) {
      logger.error("Failed to resolve security event", error as Error, {
        eventId,
      });
      throw error;
    }
  }

  /**
   * 未解決のセキュリティイベントを取得
   */
  async getUnresolvedEvents(
    severity?: SecuritySeverity,
    limit = 100,
  ): Promise<SecurityEvent[]> {
    try {
      const db = this.getDb();
      let query = db
        .collection("securityEvents")
        .where("resolved", "==", false)
        .orderBy("timestamp", "desc")
        .limit(limit);

      if (severity) {
        query = query.where("severity", "==", severity);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as SecurityEvent,
      );
    } catch (error) {
      logger.error("Failed to get unresolved events", error as Error);
      return [];
    }
  }

  // ===========================================================================
  // ヘルパーメソッド
  // ===========================================================================

  /**
   * IPアドレスから国コードを取得（スタブ）
   */
  getGeoLocation(ip: string): { country?: string; region?: string } {
    // In production, use a GeoIP service
    logger.debug(`GeoIP lookup for ${ip} (stub implementation)`);
    return {};
  }

  /**
   * セキュリティ統計を取得
   */
  async getSecurityStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolvedCount: number;
  }> {
    try {
      const db = this.getDb();
      const snapshot = await db
        .collection("securityEvents")
        .where(
          "timestamp",
          ">=",
          admin.firestore.Timestamp.fromDate(startDate),
        )
        .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endDate))
        .get();

      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      let unresolvedCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as SecurityEvent;
        byType[data.type] = (byType[data.type] || 0) + 1;
        bySeverity[data.severity] = (bySeverity[data.severity] || 0) + 1;
        if (!data.resolved) unresolvedCount++;
      });

      return {
        totalEvents: snapshot.size,
        byType,
        bySeverity,
        unresolvedCount,
      };
    } catch (error) {
      logger.error("Failed to get security stats", error as Error);
      return {
        totalEvents: 0,
        byType: {},
        bySeverity: {},
        unresolvedCount: 0,
      };
    }
  }
}

// =============================================================================
// エクスポート
// =============================================================================

export const securityMonitoringService = SecurityMonitoringService.getInstance();
export { SecurityMonitoringService };
