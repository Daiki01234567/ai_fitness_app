# 046 リアルタイム監視API

## 概要

管理者がシステムの現在の状態をリアルタイムで監視できるAPIを実装するチケットです。Cloud Functionsのステータス、エラー発生状況、リクエスト数などを監視します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築
- 041: 管理者認証基盤

## 要件

### 機能要件

なし（NFR-009から派生）

### 非機能要件

- NFR-009: リアルタイム監視
- NFR-038: 管理者認証
- NFR-042: 管理画面レスポンス（3秒以内）

## 受け入れ条件（Todo）

### システムヘルスチェックAPI

- [ ] システム全体の健全性をチェックするAPIを実装
- [ ] Cloud Functionsの稼働状態を取得
- [ ] Firestoreの接続状態を確認
- [ ] BigQueryの接続状態を確認
- [ ] 各サービスのレスポンス時間を計測

### エラー監視API

- [ ] 過去1時間のエラー発生数を取得するAPIを実装
- [ ] エラーの種類別集計を実装
- [ ] エラー発生トレンドを取得
- [ ] 重大度（severity）別のエラー集計を実装

### リクエスト監視API

- [ ] リアルタイムのリクエスト数を取得するAPIを実装
- [ ] エンドポイント別のリクエスト数を取得
- [ ] レスポンス時間の統計を取得（平均、中央値、95パーセンタイル）
- [ ] エラー率を計算

### パフォーマンス監視API

- [ ] Cloud Functionsのメモリ使用量を取得するAPIを実装
- [ ] Cloud Functionsの実行時間を取得
- [ ] コールドスタート発生率を取得
- [ ] Firestore読み取り/書き込み回数を取得

### テスト

- [ ] システムヘルスチェックのユニットテストを作成
- [ ] エラー監視のユニットテストを作成
- [ ] リクエスト監視のユニットテストを作成
- [ ] パフォーマンス監視のユニットテストを作成
- [ ] 権限チェックのテストを作成

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-009（リアルタイム監視）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ監視

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| システムヘルスチェック | GET | /admin/monitoring/health | admin以上 |
| エラー監視 | GET | /admin/monitoring/errors | admin以上 |
| リクエスト監視 | GET | /admin/monitoring/requests | admin以上 |
| パフォーマンス監視 | GET | /admin/monitoring/performance | admin以上 |
| 総合監視ダッシュボード | GET | /admin/monitoring/dashboard | admin以上 |

### システムヘルスチェックAPI

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Logging } from "@google-cloud/logging";
import * as admin from "firebase-admin";

/**
 * システムヘルスチェックを実行する（管理者専用）
 *
 * 各サービスの接続状態とレスポンス時間を確認します。
 */
export const getSystemHealth = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const healthStatus = {
    overall: "healthy" as "healthy" | "degraded" | "unhealthy",
    services: {} as Record<string, ServiceHealth>,
    checkedAt: new Date().toISOString(),
  };

  // Firestoreヘルスチェック
  healthStatus.services.firestore = await checkFirestoreHealth();

  // BigQueryヘルスチェック
  healthStatus.services.bigquery = await checkBigQueryHealth();

  // Firebase Authenticationヘルスチェック
  healthStatus.services.auth = await checkAuthHealth();

  // 全体の健全性を判定
  const serviceStatuses = Object.values(healthStatus.services);
  if (serviceStatuses.some((s) => s.status === "unhealthy")) {
    healthStatus.overall = "unhealthy";
  } else if (serviceStatuses.some((s) => s.status === "degraded")) {
    healthStatus.overall = "degraded";
  }

  return healthStatus;
});

interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  message?: string;
}

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
      status: responseTime < 1000 ? "healthy" : "degraded",
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
    const { BigQuery } = require("@google-cloud/bigquery");
    const bigquery = new BigQuery();

    // テストクエリを実行
    await bigquery.query({
      query: "SELECT 1 as test",
      location: "asia-northeast1",
    });

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 2000 ? "healthy" : "degraded",
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
    const listUsersResult = await admin.auth().listUsers(1);

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 1000 ? "healthy" : "degraded",
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
```

### エラー監視API

```typescript
/**
 * エラー監視データを取得する（管理者専用）
 *
 * Cloud Loggingからエラーログを集計します。
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（1h, 24h, 7d）
 */
export const getErrorStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "1h" } = request.data;

  // 期間を秒数に変換
  const periodSeconds =
    period === "1h" ? 3600 : period === "24h" ? 86400 : 604800;

  const logging = new Logging();

  // エラーログを取得
  const filter = `
    severity >= ERROR
    AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
    AND resource.type = "cloud_function"
  `;

  const [entries] = await logging.getEntries({
    filter,
    pageSize: 1000,
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
    const severity = entry.metadata.severity || "ERROR";
    errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;

    // エラーメッセージからタイプを判定
    const message = entry.data?.message || "";
    const errorType = categorizeError(message);
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
  });

  // 時系列データ
  const errorTimeline = entries
    .slice(0, 100)
    .map((entry) => ({
      timestamp: entry.metadata.timestamp,
      severity: entry.metadata.severity,
      message: entry.data?.message || "",
      functionName: entry.metadata.resource?.labels?.function_name,
    }));

  return {
    totalErrors: entries.length,
    byType: errorsByType,
    bySeverity: errorsBySeverity,
    timeline: errorTimeline,
    period,
  };
});

/**
 * エラーメッセージからエラータイプを判定
 */
function categorizeError(message: string): string {
  if (message.includes("UNAUTHENTICATED")) return "認証エラー";
  if (message.includes("PERMISSION_DENIED")) return "権限エラー";
  if (message.includes("NOT_FOUND")) return "リソース未発見";
  if (message.includes("DEADLINE_EXCEEDED")) return "タイムアウト";
  if (message.includes("INVALID_ARGUMENT")) return "バリデーションエラー";
  return "その他のエラー";
}
```

### リクエスト監視API

```typescript
/**
 * リクエスト監視データを取得する（管理者専用）
 *
 * Cloud Loggingからリクエストログを集計します。
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（1h, 24h, 7d）
 */
export const getRequestStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "1h" } = request.data;
  const periodSeconds =
    period === "1h" ? 3600 : period === "24h" ? 86400 : 604800;

  const logging = new Logging();

  // リクエストログを取得
  const filter = `
    resource.type = "cloud_function"
    AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
  `;

  const [entries] = await logging.getEntries({
    filter,
    pageSize: 5000,
  });

  // リクエストを集計
  const requestsByFunction: Record<string, number> = {};
  const responseTimes: number[] = [];
  let errorCount = 0;

  entries.forEach((entry) => {
    const functionName =
      entry.metadata.resource?.labels?.function_name || "unknown";
    requestsByFunction[functionName] =
      (requestsByFunction[functionName] || 0) + 1;

    // レスポンス時間
    const executionTime = entry.data?.executionTime;
    if (executionTime) {
      responseTimes.push(executionTime);
    }

    // エラー判定
    if (entry.metadata.severity === "ERROR") {
      errorCount++;
    }
  });

  // 統計を計算
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime =
    responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  const medianResponseTime =
    responseTimes[Math.floor(responseTimes.length / 2)];
  const p95ResponseTime =
    responseTimes[Math.floor(responseTimes.length * 0.95)];

  const totalRequests = entries.length;
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

  return {
    totalRequests,
    errorCount,
    errorRate: Math.round(errorRate * 100) / 100,
    byFunction: requestsByFunction,
    responseTime: {
      avg: Math.round(avgResponseTime),
      median: Math.round(medianResponseTime),
      p95: Math.round(p95ResponseTime),
    },
    period,
  };
});
```

### パフォーマンス監視API

```typescript
/**
 * パフォーマンス監視データを取得する（管理者専用）
 *
 * Cloud Monitoring APIからメトリクスを取得します。
 *
 * @param data - リクエストパラメータ
 * @param data.period - 集計期間（1h, 24h, 7d）
 */
export const getPerformanceStats = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { period = "1h" } = request.data;

  // Cloud Monitoring APIを使用してメトリクスを取得
  // ここでは簡略化のため、Loggingからデータを取得
  const logging = new Logging();
  const periodSeconds =
    period === "1h" ? 3600 : period === "24h" ? 86400 : 604800;

  const filter = `
    resource.type = "cloud_function"
    AND timestamp >= "${new Date(Date.now() - periodSeconds * 1000).toISOString()}"
  `;

  const [entries] = await logging.getEntries({
    filter,
    pageSize: 5000,
  });

  // メトリクスを集計
  const memoryUsage: number[] = [];
  const executionTimes: number[] = [];
  let coldStarts = 0;

  entries.forEach((entry) => {
    // メモリ使用量
    const memory = entry.data?.memoryUsage;
    if (memory) {
      memoryUsage.push(memory);
    }

    // 実行時間
    const executionTime = entry.data?.executionTime;
    if (executionTime) {
      executionTimes.push(executionTime);
    }

    // コールドスタート判定
    if (entry.data?.coldStart === true) {
      coldStarts++;
    }
  });

  // 統計を計算
  const avgMemory =
    memoryUsage.reduce((sum, m) => sum + m, 0) / memoryUsage.length || 0;
  const avgExecutionTime =
    executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length || 0;
  const coldStartRate =
    entries.length > 0 ? (coldStarts / entries.length) * 100 : 0;

  return {
    memory: {
      avg: Math.round(avgMemory),
      unit: "MB",
    },
    executionTime: {
      avg: Math.round(avgExecutionTime),
      unit: "ms",
    },
    coldStarts: {
      count: coldStarts,
      rate: Math.round(coldStartRate * 100) / 100,
    },
    period,
  };
});
```

## 見積もり

- 工数: 4日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Cloud LoggingとCloud MonitoringのAPIを使用するため、適切なIAM権限が必要です
- ログの取得には時間がかかる場合があるため、キャッシュの導入を検討してください
- リアルタイム性が求められる場合は、WebSocketを使用したストリーミング配信を検討してください
- アラート機能は別途Cloud Monitoringのアラート設定で実装することを推奨します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
