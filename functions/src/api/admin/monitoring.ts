/**
 * リアルタイム監視API
 *
 * 管理者向けのシステム監視機能を提供するAPI
 * - システムヘルスチェック
 * - エラー監視
 * - リクエスト監視
 * - パフォーマンス監視
 * - 総合監視ダッシュボード
 *
 * 参照: docs/common/specs/02-2_非機能要件_v1_0.md（NFR-009: リアルタイム監視）
 * 参照: docs/common/tickets/046-realtime-monitoring-api.md
 *
 * @version 1.0.0
 * @date 2025-12-12
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { Logging, Entry } from "@google-cloud/logging";

import { getAdminLevel } from "../../middleware/adminAuth";
import { logger } from "../../utils/logger";
import { success } from "../../utils/response";

// =============================================================================
// 型定義
// =============================================================================

/**
 * 監視期間
 */
export type MonitoringPeriod = "1h" | "24h" | "7d";

/**
 * 監視期間リクエスト
 */
export interface MonitoringPeriodRequest {
  /** 集計期間（1時間、24時間、7日） */
  period?: MonitoringPeriod;
}

/**
 * サービスヘルスステータス
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * サービスヘルス情報
 */
export interface ServiceHealth {
  /** ヘルスステータス */
  status: HealthStatus;
  /** レスポンス時間（ミリ秒） */
  responseTime: number;
  /** メッセージ */
  message?: string;
}

/**
 * システムヘルスチェックレスポンス
 */
export interface SystemHealthResponse {
  /** 全体のヘルスステータス */
  overall: HealthStatus;
  /** サービス別ヘルス情報 */
  services: Record<string, ServiceHealth>;
  /** チェック日時（ISO8601） */
  checkedAt: string;
}

/**
 * エラータイムライン項目
 */
export interface ErrorTimelineItem {
  /** タイムスタンプ */
  timestamp: string | undefined;
  /** 重大度 */
  severity: string | undefined;
  /** エラーメッセージ */
  message: string;
  /** 関数名 */
  functionName: string | undefined;
}

/**
 * エラー統計レスポンス
 */
export interface ErrorStatsResponse {
  /** 総エラー数 */
  totalErrors: number;
  /** タイプ別エラー数 */
  byType: Record<string, number>;
  /** 重大度別エラー数 */
  bySeverity: Record<string, number>;
  /** エラータイムライン（最新100件） */
  timeline: ErrorTimelineItem[];
  /** 集計期間 */
  period: MonitoringPeriod;
}

/**
 * レスポンスタイム統計
 */
export interface ResponseTimeStats {
  /** 平均（ミリ秒） */
  avg: number;
  /** 中央値（ミリ秒） */
  median: number;
  /** 95パーセンタイル（ミリ秒） */
  p95: number;
}

/**
 * リクエスト統計レスポンス
 */
export interface RequestStatsResponse {
  /** 総リクエスト数 */
  totalRequests: number;
  /** エラー数 */
  errorCount: number;
  /** エラー率（%） */
  errorRate: number;
  /** 関数別リクエスト数 */
  byFunction: Record<string, number>;
  /** レスポンスタイム統計 */
  responseTime: ResponseTimeStats;
  /** 集計期間 */
  period: MonitoringPeriod;
}

/**
 * メモリ統計
 */
export interface MemoryStats {
  /** 平均メモリ使用量 */
  avg: number;
  /** 最大メモリ使用量 */
  max: number;
  /** 単位 */
  unit: string;
}

/**
 * 実行時間統計
 */
export interface ExecutionTimeStats {
  /** 平均実行時間 */
  avg: number;
  /** 最大実行時間 */
  max: number;
  /** 単位 */
  unit: string;
}

/**
 * コールドスタート統計
 */
export interface ColdStartStats {
  /** コールドスタート回数 */
  count: number;
  /** コールドスタート率（%） */
  rate: number;
}

/**
 * Firestore操作統計
 */
export interface FirestoreStats {
  /** 読み取り回数 */
  reads: number;
  /** 書き込み回数 */
  writes: number;
}

/**
 * パフォーマンス統計レスポンス
 */
export interface PerformanceStatsResponse {
  /** メモリ統計 */
  memory: MemoryStats;
  /** 実行時間統計 */
  executionTime: ExecutionTimeStats;
  /** コールドスタート統計 */
  coldStarts: ColdStartStats;
  /** Firestore操作統計 */
  firestore: FirestoreStats;
  /** 集計期間 */
  period: MonitoringPeriod;
}

/**
 * 監視ダッシュボードレスポンス
 */
export interface MonitoringDashboardResponse {
  /** システムヘルス */
  health: SystemHealthResponse;
  /** エラー統計 */
  errors: ErrorStatsResponse;
  /** リクエスト統計 */
  requests: RequestStatsResponse;
  /** パフォーマンス統計 */
  performance: PerformanceStatsResponse;
  /** 生成日時（ISO8601） */
  generatedAt: string;
}

// =============================================================================
// 定数
// =============================================================================

/**
 * 監視API関連定数
 */
export const MONITORING_CONSTANTS = {
  /** デフォルト期間 */
  DEFAULT_PERIOD: "1h" as MonitoringPeriod,
  /** Firestoreヘルスチェックの閾値（ミリ秒） */
  FIRESTORE_HEALTHY_THRESHOLD: 1000,
  /** BigQueryヘルスチェックの閾値（ミリ秒） */
  BIGQUERY_HEALTHY_THRESHOLD: 2000,
  /** Firebase Authヘルスチェックの閾値（ミリ秒） */
  AUTH_HEALTHY_THRESHOLD: 1000,
  /** 期間を秒数に変換するマッピング */
  PERIOD_TO_SECONDS: {
    "1h": 3600,
    "24h": 86400,
    "7d": 604800,
  } as const,
  /** エラータイムラインの最大件数 */
  MAX_TIMELINE_ENTRIES: 100,
  /** ログ取得の最大件数 */
  MAX_LOG_ENTRIES: 5000,
} as const;

// =============================================================================
// Cloud Logging クライアント（テスト用にモック可能）
// =============================================================================

/**
 * Cloud Logging クライアントインターフェース
 */
export interface ILoggingClient {
  getEntries(options: { filter: string; pageSize: number }): Promise<[Entry[], unknown, unknown]>;
}

/**
 * デフォルトのCloud Loggingクライアント
 */
let loggingClient: ILoggingClient | null = null;

/**
 * Cloud Loggingクライアントを取得（シングルトン）
 */
export function getLoggingClient(): ILoggingClient {
  if (!loggingClient) {
    loggingClient = new Logging() as ILoggingClient;
  }
  return loggingClient as ILoggingClient;
}

/**
 * Cloud Loggingクライアントを設定（テスト用）
 */
export function setLoggingClient(client: ILoggingClient): void {
  loggingClient = client;
}

/**
 * Cloud Loggingクライアントをリセット（テスト用）
 */
export function resetLoggingClient(): void {
  loggingClient = null;
}

// =============================================================================
// 管理者権限チェックヘルパー
// =============================================================================

/**
 * 管理者権限をチェック（admin, super_admin, supportのいずれか）
 *
 * @param request - Callableリクエスト
 * @throws 権限がない場合はHttpsErrorをスロー
 */
function requireAdminOrSupport(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const level = getAdminLevel(request.auth.token);

  if (!level) {
    logger.warn("Monitoring API access denied - not admin", {
      hasAuth: !!request.auth,
      uid: request.auth.uid,
    });
    throw new HttpsError("permission-denied", "この操作には管理者権限が必要です");
  }
}

/**
 * 期間パラメータをバリデート
 *
 * @param period - 期間パラメータ
 * @returns 有効な期間
 */
function validatePeriod(period?: string): MonitoringPeriod {
  if (!period) {
    return MONITORING_CONSTANTS.DEFAULT_PERIOD;
  }

  if (period !== "1h" && period !== "24h" && period !== "7d") {
    throw new HttpsError(
      "invalid-argument",
      "periodは1h, 24h, 7dのいずれかを指定してください",
    );
  }

  return period;
}

// =============================================================================
// ヘルスチェックヘルパー関数
// =============================================================================

/**
 * Firestoreの接続状態を確認
 */
async function checkFirestoreHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // テスト用ドキュメントの読み取り
    await admin
      .firestore()
      .collection("_healthCheck")
      .doc("test")
      .get();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < MONITORING_CONSTANTS.FIRESTORE_HEALTHY_THRESHOLD ? "healthy" : "degraded",
      responseTime,
      message: `Firestoreは正常に動作しています（${responseTime}ms）`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: `Firestoreに接続できません: ${error}`,
    };
  }
}

/**
 * BigQueryの接続状態を確認
 */
async function checkBigQueryHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BigQuery } = require("@google-cloud/bigquery");
    const bigquery = new BigQuery();

    // テストクエリを実行
    await bigquery.query({
      query: "SELECT 1 as test",
      location: "asia-northeast1",
    });

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < MONITORING_CONSTANTS.BIGQUERY_HEALTHY_THRESHOLD ? "healthy" : "degraded",
      responseTime,
      message: `BigQueryは正常に動作しています（${responseTime}ms）`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: `BigQueryに接続できません: ${error}`,
    };
  }
}

/**
 * Firebase Authenticationの状態を確認
 */
async function checkAuthHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // ユーザー数を取得（簡易的なヘルスチェック）
    await admin.auth().listUsers(1);

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < MONITORING_CONSTANTS.AUTH_HEALTHY_THRESHOLD ? "healthy" : "degraded",
      responseTime,
      message: `Firebase Authenticationは正常に動作しています（${responseTime}ms）`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: `Firebase Authenticationに接続できません: ${error}`,
    };
  }
}

// =============================================================================
// エラー分類ヘルパー
// =============================================================================

/**
 * エラーメッセージからエラータイプを判定
 *
 * @param message - エラーメッセージ
 * @returns エラータイプ（日本語）
 */
function categorizeError(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("unauthenticated")) return "認証エラー";
  if (lowerMessage.includes("permission_denied") || lowerMessage.includes("permission-denied")) {
    return "権限エラー";
  }
  if (lowerMessage.includes("not_found") || lowerMessage.includes("not-found")) return "リソース未発見";
  if (lowerMessage.includes("deadline_exceeded") || lowerMessage.includes("timeout")) {
    return "タイムアウト";
  }
  if (lowerMessage.includes("invalid_argument") || lowerMessage.includes("invalid-argument")) {
    return "バリデーションエラー";
  }
  if (lowerMessage.includes("resource_exhausted") || lowerMessage.includes("quota")) {
    return "クォータ超過";
  }
  if (lowerMessage.includes("internal")) return "内部エラー";
  if (lowerMessage.includes("unavailable")) return "サービス利用不可";

  return "その他のエラー";
}

// =============================================================================
// システムヘルスチェックAPI
// =============================================================================

/**
 * システムヘルスチェックを実行（管理者専用）
 *
 * 各サービス（Firestore, BigQuery, Firebase Auth）の接続状態と
 * レスポンス時間を確認します。
 *
 * @returns システムヘルス情報
 */
export const admin_getSystemHealth = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getSystemHealth");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      logger.info("Executing system health check", {
        adminId: request.auth?.uid,
      });

      const healthStatus: SystemHealthResponse = {
        overall: "healthy",
        services: {},
        checkedAt: new Date().toISOString(),
      };

      // 各サービスのヘルスチェックを並列実行
      const [firestoreHealth, bigqueryHealth, authHealth] = await Promise.all([
        checkFirestoreHealth(),
        checkBigQueryHealth(),
        checkAuthHealth(),
      ]);

      healthStatus.services.firestore = firestoreHealth;
      healthStatus.services.bigquery = bigqueryHealth;
      healthStatus.services.auth = authHealth;

      // 全体の健全性を判定
      const serviceStatuses = Object.values(healthStatus.services);
      if (serviceStatuses.some((s) => s.status === "unhealthy")) {
        healthStatus.overall = "unhealthy";
      } else if (serviceStatuses.some((s) => s.status === "degraded")) {
        healthStatus.overall = "degraded";
      }

      logger.functionEnd("admin_getSystemHealth", Date.now() - startTime, {
        overall: healthStatus.overall,
        servicesChecked: Object.keys(healthStatus.services).length,
      });

      return success(healthStatus, "システムヘルスチェックを完了しました");
    } catch (error) {
      logger.error("admin_getSystemHealth failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "システムヘルスチェックに失敗しました",
      );
    }
  },
);

// =============================================================================
// エラー監視API
// =============================================================================

/**
 * エラー監視データを取得（管理者専用）
 *
 * Cloud Loggingからエラーログを集計します。
 *
 * @param request.data.period - 集計期間（1h, 24h, 7d）
 * @returns エラー統計
 */
export const admin_getErrorStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getErrorStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as MonitoringPeriodRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching error stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // 期間を秒数に変換
      const periodSeconds = MONITORING_CONSTANTS.PERIOD_TO_SECONDS[validPeriod];

      const logging = getLoggingClient();

      // エラーログを取得
      const filter = `
        severity >= ERROR
        AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
        AND resource.type = "cloud_function"
      `;

      const [entries] = await logging.getEntries({
        filter,
        pageSize: MONITORING_CONSTANTS.MAX_LOG_ENTRIES,
      });

      // エラーを集計
      const errorsByType: Record<string, number> = {};
      const errorsBySeverity: Record<string, number> = {
        ERROR: 0,
        CRITICAL: 0,
        ALERT: 0,
        EMERGENCY: 0,
      };

      entries.forEach((entry) => {
        const severity = entry.metadata?.severity || "ERROR";
        errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;

        // エラーメッセージからタイプを判定
        const entryData = entry.data as { message?: string } | undefined;
        const message = entryData?.message || "";
        const errorType = categorizeError(message);
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });

      // 時系列データ（最新100件）
      const errorTimeline: ErrorTimelineItem[] = entries
        .slice(0, MONITORING_CONSTANTS.MAX_TIMELINE_ENTRIES)
        .map((entry) => {
          const entryData = entry.data as { message?: string } | undefined;
          const resourceLabels = entry.metadata?.resource?.labels as { function_name?: string } | undefined;
          return {
            timestamp: entry.metadata?.timestamp as string | undefined,
            severity: entry.metadata?.severity as string | undefined,
            message: entryData?.message || "",
            functionName: resourceLabels?.function_name,
          };
        });

      const result: ErrorStatsResponse = {
        totalErrors: entries.length,
        byType: errorsByType,
        bySeverity: errorsBySeverity,
        timeline: errorTimeline,
        period: validPeriod,
      };

      logger.functionEnd("admin_getErrorStats", Date.now() - startTime, {
        period: validPeriod,
        totalErrors: result.totalErrors,
      });

      return success(result, "エラー統計を取得しました");
    } catch (error) {
      logger.error("admin_getErrorStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "エラー統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// リクエスト監視API
// =============================================================================

/**
 * リクエスト監視データを取得（管理者専用）
 *
 * Cloud Loggingからリクエストログを集計します。
 *
 * @param request.data.period - 集計期間（1h, 24h, 7d）
 * @returns リクエスト統計
 */
export const admin_getRequestStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getRequestStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as MonitoringPeriodRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching request stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      const periodSeconds = MONITORING_CONSTANTS.PERIOD_TO_SECONDS[validPeriod];

      const logging = getLoggingClient();

      // リクエストログを取得
      const filter = `
        resource.type = "cloud_function"
        AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
      `;

      const [entries] = await logging.getEntries({
        filter,
        pageSize: MONITORING_CONSTANTS.MAX_LOG_ENTRIES,
      });

      // リクエストを集計
      const requestsByFunction: Record<string, number> = {};
      const responseTimes: number[] = [];
      let errorCount = 0;

      entries.forEach((entry) => {
        const resourceLabels = entry.metadata?.resource?.labels as { function_name?: string } | undefined;
        const functionName = resourceLabels?.function_name || "unknown";
        requestsByFunction[functionName] = (requestsByFunction[functionName] || 0) + 1;

        // レスポンス時間
        const entryData = entry.data as { executionTime?: number } | undefined;
        const executionTime = entryData?.executionTime;
        if (typeof executionTime === "number") {
          responseTimes.push(executionTime);
        }

        // エラー判定
        if (entry.metadata?.severity === "ERROR") {
          errorCount++;
        }
      });

      // 統計を計算
      responseTimes.sort((a, b) => a - b);
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;
      const medianResponseTime = responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length / 2)]
        : 0;
      const p95ResponseTime = responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.95)]
        : 0;

      const totalRequests = entries.length;
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

      const result: RequestStatsResponse = {
        totalRequests,
        errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
        byFunction: requestsByFunction,
        responseTime: {
          avg: Math.round(avgResponseTime),
          median: Math.round(medianResponseTime),
          p95: Math.round(p95ResponseTime),
        },
        period: validPeriod,
      };

      logger.functionEnd("admin_getRequestStats", Date.now() - startTime, {
        period: validPeriod,
        totalRequests: result.totalRequests,
        errorRate: result.errorRate,
      });

      return success(result, "リクエスト統計を取得しました");
    } catch (error) {
      logger.error("admin_getRequestStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "リクエスト統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// パフォーマンス監視API
// =============================================================================

/**
 * パフォーマンス監視データを取得（管理者専用）
 *
 * Cloud Loggingからパフォーマンスメトリクスを取得します。
 *
 * @param request.data.period - 集計期間（1h, 24h, 7d）
 * @returns パフォーマンス統計
 */
export const admin_getPerformanceStats = onCall(
  {
    region: "asia-northeast1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getPerformanceStats");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as MonitoringPeriodRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching performance stats", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      const periodSeconds = MONITORING_CONSTANTS.PERIOD_TO_SECONDS[validPeriod];

      const logging = getLoggingClient();

      const filter = `
        resource.type = "cloud_function"
        AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
      `;

      const [entries] = await logging.getEntries({
        filter,
        pageSize: MONITORING_CONSTANTS.MAX_LOG_ENTRIES,
      });

      // メトリクスを集計
      const memoryUsage: number[] = [];
      const executionTimes: number[] = [];
      let coldStarts = 0;
      let firestoreReads = 0;
      let firestoreWrites = 0;

      entries.forEach((entry) => {
        const entryData = entry.data as {
          memoryUsage?: number;
          executionTime?: number;
          coldStart?: boolean;
          firestoreReads?: number;
          firestoreWrites?: number;
        } | undefined;

        // メモリ使用量
        if (typeof entryData?.memoryUsage === "number") {
          memoryUsage.push(entryData.memoryUsage);
        }

        // 実行時間
        if (typeof entryData?.executionTime === "number") {
          executionTimes.push(entryData.executionTime);
        }

        // コールドスタート判定
        if (entryData?.coldStart === true) {
          coldStarts++;
        }

        // Firestore操作回数
        if (typeof entryData?.firestoreReads === "number") {
          firestoreReads += entryData.firestoreReads;
        }
        if (typeof entryData?.firestoreWrites === "number") {
          firestoreWrites += entryData.firestoreWrites;
        }
      });

      // 統計を計算
      const avgMemory = memoryUsage.length > 0
        ? memoryUsage.reduce((sum, m) => sum + m, 0) / memoryUsage.length
        : 0;
      const maxMemory = memoryUsage.length > 0
        ? Math.max(...memoryUsage)
        : 0;

      const avgExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0;
      const maxExecutionTime = executionTimes.length > 0
        ? Math.max(...executionTimes)
        : 0;

      const coldStartRate = entries.length > 0
        ? (coldStarts / entries.length) * 100
        : 0;

      const result: PerformanceStatsResponse = {
        memory: {
          avg: Math.round(avgMemory),
          max: Math.round(maxMemory),
          unit: "MB",
        },
        executionTime: {
          avg: Math.round(avgExecutionTime),
          max: Math.round(maxExecutionTime),
          unit: "ms",
        },
        coldStarts: {
          count: coldStarts,
          rate: Math.round(coldStartRate * 100) / 100,
        },
        firestore: {
          reads: firestoreReads,
          writes: firestoreWrites,
        },
        period: validPeriod,
      };

      logger.functionEnd("admin_getPerformanceStats", Date.now() - startTime, {
        period: validPeriod,
        avgMemory: result.memory.avg,
        avgExecutionTime: result.executionTime.avg,
        coldStartRate: result.coldStarts.rate,
      });

      return success(result, "パフォーマンス統計を取得しました");
    } catch (error) {
      logger.error("admin_getPerformanceStats failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "パフォーマンス統計の取得に失敗しました",
      );
    }
  },
);

// =============================================================================
// 総合監視ダッシュボードAPI
// =============================================================================

/**
 * 総合監視ダッシュボードデータを取得（管理者専用）
 *
 * システムヘルス、エラー、リクエスト、パフォーマンスの
 * 全監視データをまとめて取得します。
 *
 * @param request.data.period - 集計期間（1h, 24h, 7d）
 * @returns 監視ダッシュボードデータ
 */
export const admin_getMonitoringDashboard = onCall(
  {
    region: "asia-northeast1",
    memory: "1GiB",
    timeoutSeconds: 180,
  },
  async (request) => {
    const startTime = Date.now();

    logger.functionStart("admin_getMonitoringDashboard");

    try {
      // 管理者権限チェック
      requireAdminOrSupport(request);

      const { period } = request.data as MonitoringPeriodRequest;
      const validPeriod = validatePeriod(period);

      logger.info("Fetching monitoring dashboard", {
        adminId: request.auth?.uid,
        period: validPeriod,
      });

      // システムヘルスチェック
      const healthStatus: SystemHealthResponse = {
        overall: "healthy",
        services: {},
        checkedAt: new Date().toISOString(),
      };

      const [firestoreHealth, bigqueryHealth, authHealth] = await Promise.all([
        checkFirestoreHealth(),
        checkBigQueryHealth(),
        checkAuthHealth(),
      ]);

      healthStatus.services.firestore = firestoreHealth;
      healthStatus.services.bigquery = bigqueryHealth;
      healthStatus.services.auth = authHealth;

      const serviceStatuses = Object.values(healthStatus.services);
      if (serviceStatuses.some((s) => s.status === "unhealthy")) {
        healthStatus.overall = "unhealthy";
      } else if (serviceStatuses.some((s) => s.status === "degraded")) {
        healthStatus.overall = "degraded";
      }

      // Cloud Loggingからデータを取得
      const periodSeconds = MONITORING_CONSTANTS.PERIOD_TO_SECONDS[validPeriod];
      const logging = getLoggingClient();

      const filter = `
        resource.type = "cloud_function"
        AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
      `;

      const [entries] = await logging.getEntries({
        filter,
        pageSize: MONITORING_CONSTANTS.MAX_LOG_ENTRIES,
      });

      // エラー統計を集計
      const errorsByType: Record<string, number> = {};
      const errorsBySeverity: Record<string, number> = {
        ERROR: 0,
        CRITICAL: 0,
        ALERT: 0,
        EMERGENCY: 0,
      };
      const errorTimeline: ErrorTimelineItem[] = [];

      // リクエスト統計を集計
      const requestsByFunction: Record<string, number> = {};
      const responseTimes: number[] = [];
      let totalErrors = 0;

      // パフォーマンス統計を集計
      const memoryUsage: number[] = [];
      const executionTimes: number[] = [];
      let coldStarts = 0;
      let firestoreReads = 0;
      let firestoreWrites = 0;

      entries.forEach((entry) => {
        const entryData = entry.data as {
          message?: string;
          executionTime?: number;
          memoryUsage?: number;
          coldStart?: boolean;
          firestoreReads?: number;
          firestoreWrites?: number;
        } | undefined;
        const resourceLabels = entry.metadata?.resource?.labels as { function_name?: string } | undefined;

        // リクエスト集計
        const functionName = resourceLabels?.function_name || "unknown";
        requestsByFunction[functionName] = (requestsByFunction[functionName] || 0) + 1;

        // エラー集計
        const severity = entry.metadata?.severity;
        if (severity === "ERROR" || severity === "CRITICAL" ||
            severity === "ALERT" || severity === "EMERGENCY") {
          totalErrors++;
          errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;

          const message = entryData?.message || "";
          const errorType = categorizeError(message);
          errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

          if (errorTimeline.length < MONITORING_CONSTANTS.MAX_TIMELINE_ENTRIES) {
            errorTimeline.push({
              timestamp: entry.metadata?.timestamp as string | undefined,
              severity,
              message,
              functionName,
            });
          }
        }

        // レスポンスタイム
        if (typeof entryData?.executionTime === "number") {
          responseTimes.push(entryData.executionTime);
          executionTimes.push(entryData.executionTime);
        }

        // メモリ
        if (typeof entryData?.memoryUsage === "number") {
          memoryUsage.push(entryData.memoryUsage);
        }

        // コールドスタート
        if (entryData?.coldStart === true) {
          coldStarts++;
        }

        // Firestore操作
        if (typeof entryData?.firestoreReads === "number") {
          firestoreReads += entryData.firestoreReads;
        }
        if (typeof entryData?.firestoreWrites === "number") {
          firestoreWrites += entryData.firestoreWrites;
        }
      });

      // 統計計算
      responseTimes.sort((a, b) => a - b);
      const totalRequests = entries.length;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      const result: MonitoringDashboardResponse = {
        health: healthStatus,
        errors: {
          totalErrors,
          byType: errorsByType,
          bySeverity: errorsBySeverity,
          timeline: errorTimeline,
          period: validPeriod,
        },
        requests: {
          totalRequests,
          errorCount: totalErrors,
          errorRate: Math.round(errorRate * 100) / 100,
          byFunction: requestsByFunction,
          responseTime: {
            avg: responseTimes.length > 0
              ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
              : 0,
            median: responseTimes.length > 0
              ? Math.round(responseTimes[Math.floor(responseTimes.length / 2)])
              : 0,
            p95: responseTimes.length > 0
              ? Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)])
              : 0,
          },
          period: validPeriod,
        },
        performance: {
          memory: {
            avg: memoryUsage.length > 0
              ? Math.round(memoryUsage.reduce((sum, m) => sum + m, 0) / memoryUsage.length)
              : 0,
            max: memoryUsage.length > 0 ? Math.round(Math.max(...memoryUsage)) : 0,
            unit: "MB",
          },
          executionTime: {
            avg: executionTimes.length > 0
              ? Math.round(executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length)
              : 0,
            max: executionTimes.length > 0 ? Math.round(Math.max(...executionTimes)) : 0,
            unit: "ms",
          },
          coldStarts: {
            count: coldStarts,
            rate: totalRequests > 0 ? Math.round((coldStarts / totalRequests) * 10000) / 100 : 0,
          },
          firestore: {
            reads: firestoreReads,
            writes: firestoreWrites,
          },
          period: validPeriod,
        },
        generatedAt: new Date().toISOString(),
      };

      logger.functionEnd("admin_getMonitoringDashboard", Date.now() - startTime, {
        period: validPeriod,
        overall: result.health.overall,
        totalRequests: result.requests.totalRequests,
        totalErrors: result.errors.totalErrors,
      });

      return success(result, "監視ダッシュボードを取得しました");
    } catch (error) {
      logger.error("admin_getMonitoringDashboard failed", error as Error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "監視ダッシュボードの取得に失敗しました",
      );
    }
  },
);
