/**
 * 監視サービス
 *
 * Cloud Monitoring API、Error Reporting、メトリクス収集機能を提供
 *
 * 参照: docs/specs/01_システムアーキテクチャ設計書_v3_2.md Section 13
 * 参照: docs/MONITORING_DESIGN.md
 *
 * @version 1.0.0
 * @date 2025-11-29
 */

import { logger } from "../utils/logger";

// =============================================================================
// 型定義
// =============================================================================

/**
 * カスタムメトリクスの種類
 */
export type MetricType =
  | "api_request"
  | "api_latency"
  | "api_error"
  | "auth_success"
  | "auth_failure"
  | "session_created"
  | "session_completed"
  | "firestore_read"
  | "firestore_write"
  | "bigquery_sync"
  | "mediapipe_fps";

/**
 * エラーの重要度
 */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

/**
 * メトリクスラベル
 */
export interface MetricLabels {
  [key: string]: string | number | boolean | undefined;
}

// =============================================================================
// メトリクスサービス
// =============================================================================

class MetricsService {
  private static instance: MetricsService;

  // In-memory metrics buffer (for batching)
  private metricsBuffer: Array<{
    type: MetricType;
    value: number;
    labels: MetricLabels;
    timestamp: Date;
  }> = [];

  private constructor() {}

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * APIリクエストを記録
   */
  recordApiRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    latencyMs: number,
  ): void {
    this.addMetric("api_request", 1, {
      endpoint,
      method,
      statusCode,
      success: statusCode < 400,
    });

    this.addMetric("api_latency", latencyMs, {
      endpoint,
      method,
    });

    if (statusCode >= 400) {
      this.addMetric("api_error", 1, {
        endpoint,
        method,
        statusCode,
      });
    }

    logger.debug(`API metrics recorded: ${method} ${endpoint}`, {
      statusCode,
      latencyMs,
    });
  }

  /**
   * 認証成功を記録
   */
  recordAuthSuccess(method: string, userId: string): void {
    this.addMetric("auth_success", 1, {
      method,
      userId: this.hashUserId(userId),
    });
  }

  /**
   * 認証失敗を記録
   */
  recordAuthFailure(method: string, reason: string): void {
    this.addMetric("auth_failure", 1, {
      method,
      reason,
    });
  }

  /**
   * セッション作成を記録
   */
  recordSessionCreated(exerciseType: string): void {
    this.addMetric("session_created", 1, {
      exerciseType,
    });
  }

  /**
   * セッション完了を記録
   */
  recordSessionCompleted(
    exerciseType: string,
    durationSeconds: number,
    formScore: number,
  ): void {
    this.addMetric("session_completed", 1, {
      exerciseType,
      durationSeconds,
      formScoreBucket: this.getScoreBucket(formScore),
    });
  }

  /**
   * Firestore読み取りを記録
   */
  recordFirestoreRead(collection: string, documentCount: number): void {
    this.addMetric("firestore_read", documentCount, {
      collection,
    });
  }

  /**
   * Firestore書き込みを記録
   */
  recordFirestoreWrite(collection: string, documentCount: number): void {
    this.addMetric("firestore_write", documentCount, {
      collection,
    });
  }

  /**
   * BigQuery同期を記録
   */
  recordBigQuerySync(success: boolean, recordCount: number): void {
    this.addMetric("bigquery_sync", recordCount, {
      success,
    });
  }

  /**
   * MediaPipe FPSを記録
   */
  recordMediaPipeFps(fps: number, deviceType: string): void {
    this.addMetric("mediapipe_fps", fps, {
      deviceType,
      fpsBucket: this.getFpsBucket(fps),
    });
  }

  /**
   * メトリクスをバッファに追加
   */
  private addMetric(
    type: MetricType,
    value: number,
    labels: MetricLabels,
  ): void {
    this.metricsBuffer.push({
      type,
      value,
      labels,
      timestamp: new Date(),
    });

    // Auto-flush if buffer is large
    if (this.metricsBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * バッファをフラッシュ（Cloud Monitoringに送信）
   * Note: 本番環境ではCloud Monitoring APIを使用
   */
  flush(): void {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    // Log metrics for now (in production, send to Cloud Monitoring)
    logger.debug(`Flushing ${metrics.length} metrics`, {
      types: [...new Set(metrics.map((m) => m.type))],
    });

    // TODO: Implement Cloud Monitoring API integration
    // const monitoring = new Monitoring.MetricServiceClient();
    // await monitoring.createTimeSeries({ ... });
  }

  /**
   * ユーザーIDをハッシュ化（プライバシー保護）
   */
  private hashUserId(userId: string): string {
    // Simple hash for privacy
    return userId.substring(0, 8) + "...";
  }

  /**
   * スコアをバケットに分類
   */
  private getScoreBucket(score: number): string {
    if (score >= 90) return "excellent";
    if (score >= 70) return "good";
    if (score >= 50) return "fair";
    return "needs_improvement";
  }

  /**
   * FPSをバケットに分類
   */
  private getFpsBucket(fps: number): string {
    if (fps >= 30) return "optimal";
    if (fps >= 24) return "good";
    if (fps >= 15) return "acceptable";
    return "low";
  }
}

// =============================================================================
// エラーレポーティングサービス
// =============================================================================

class ErrorReportingService {
  private static instance: ErrorReportingService;

  private constructor() {}

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * エラーを報告
   */
  report(
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.reportWithSeverity("error", message, error, context);
  }

  /**
   * 警告を報告
   */
  reportWarning(
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.reportWithSeverity("warning", message, error, context);
  }

  /**
   * 重大なエラーを報告
   */
  reportCritical(
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.reportWithSeverity("critical", message, error, context);
  }

  /**
   * 重要度付きでエラーを報告
   */
  private reportWithSeverity(
    severity: ErrorSeverity,
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    const errorReport = {
      severity,
      message,
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      context: this.sanitizeContext(context),
      timestamp: new Date().toISOString(),
      service: "ai-fitness-functions",
      version: process.env.K_REVISION || "unknown",
    };

    // Log the error (Cloud Logging will pick this up)
    if (severity === "critical") {
      logger.critical(message, error, context);
    } else if (severity === "error") {
      logger.error(message, error, context);
    } else if (severity === "warning") {
      logger.warn(message, context);
    } else {
      logger.info(message, context);
    }

    // In production, also send to Error Reporting API
    // const errorReporting = new ErrorReporting();
    // errorReporting.report(error);

    logger.debug("Error reported", errorReport);
  }

  /**
   * コンテキストからセンシティブ情報を除去
   */
  private sanitizeContext(
    context?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!context) return {};

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "cookie",
      "credential",
    ];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// =============================================================================
// トレーシングサービス
// =============================================================================

class TracingService {
  private static instance: TracingService;

  private constructor() {}

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  /**
   * スパンを開始
   */
  startSpan(
    name: string,
    attributes?: Record<string, string>,
  ): { end: () => void; addAttribute: (key: string, value: string) => void } {
    const startTime = Date.now();

    logger.debug(`Span started: ${name}`, { attributes });

    return {
      end: () => {
        const duration = Date.now() - startTime;
        logger.debug(`Span ended: ${name}`, { duration, attributes });
      },
      addAttribute: (key: string, value: string) => {
        if (attributes) {
          attributes[key] = value;
        }
      },
    };
  }

  /**
   * 関数実行をトレース
   */
  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string>,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await fn();
      return result;
    } catch (error) {
      span.addAttribute("error", "true");
      throw error;
    } finally {
      span.end();
    }
  }
}

// =============================================================================
// エクスポート
// =============================================================================

export const metricsService = MetricsService.getInstance();
export const errorReportingService = ErrorReportingService.getInstance();
export const tracingService = TracingService.getInstance();

export { MetricsService, ErrorReportingService, TracingService };
