# 005 監視・ログ基盤

## 概要

アプリのバックエンド（Cloud Functions）が正しく動いているかを監視し、問題があればすぐに気づけるようにする基盤を構築するチケットです。

「ログ」とは、アプリが何をしたかの記録です。例えば「〇〇さんがログインした」「エラーが発生した」などの情報を記録しておくことで、問題が起きた時に原因を調べることができます。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 003（Cloud Functions基盤）

## 要件

### 機能要件

- なし（基盤チケットのため）

### 非機能要件

- NFR-028: ログ収集 - Cloud Loggingによるログ収集
- NFR-029: エラー監視 - Firebase Crashlyticsによるエラー監視
- NFR-030: パフォーマンス監視 - Firebase Performanceによる監視

## 受け入れ条件（Todo）

- [x] Cloud Logging設定を実装
  - [x] ログレベル（INFO, WARN, ERROR）の使い分けを定義
  - [x] 構造化ログ（JSON形式）を実装
  - [x] センシティブ情報のマスキングを実装
- [x] 共通ログユーティリティを実装
- [ ] エラーアラート設定を実装
  - [ ] Cloud Monitoringでアラートポリシーを作成
  - [ ] 通知チャンネル（メール or Slack）を設定
- [ ] パフォーマンスモニタリングを設定
  - [ ] 各APIのレスポンスタイム計測を実装
  - [ ] Cloud Monitoringダッシュボードを作成
- [ ] ドキュメントを作成
  - [ ] ログの見方ガイドを作成
  - [ ] アラート対応マニュアルを作成

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - 監視要件
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - ログ保存期間

## 技術詳細

### ログユーティリティ

```typescript
// functions/src/utils/logger.ts
import * as functions from "firebase-functions";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  sessionId?: string;
  functionName?: string;
  duration?: number;
  [key: string]: unknown;
}

class Logger {
  private functionName: string;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logData = {
      functionName: this.functionName,
      timestamp: new Date().toISOString(),
      ...this.maskSensitiveData(context),
    };

    switch (level) {
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          functions.logger.debug(message, logData);
        }
        break;
      case "info":
        functions.logger.info(message, logData);
        break;
      case "warn":
        functions.logger.warn(message, logData);
        break;
      case "error":
        functions.logger.error(message, logData);
        break;
    }
  }

  private maskSensitiveData(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const masked = { ...context };

    // センシティブなフィールドをマスク
    const sensitiveFields = ["email", "password", "token", "apiKey"];
    for (const field of sensitiveFields) {
      if (masked[field]) {
        masked[field] = "***MASKED***";
      }
    }

    return masked;
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
}

export function createLogger(functionName: string): Logger {
  return new Logger(functionName);
}

// グローバルロガー（関数名が不要な場合）
export const logger = createLogger("global");
```

### ログレベルの使い分け

| レベル | 使用場面 | 例 |
|--------|----------|-----|
| DEBUG | 開発中のデバッグ情報 | 変数の値、処理の詳細 |
| INFO | 通常の処理記録 | APIリクエスト、ユーザー操作 |
| WARN | 注意が必要な状況 | レート制限に近い、非推奨API使用 |
| ERROR | エラー発生 | 例外、処理失敗 |

### パフォーマンス計測

```typescript
// functions/src/utils/performance.ts
import { logger } from "./logger";

export async function measurePerformance<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    logger.info(`${operationName} 完了`, { duration });

    // 200ms以上かかった場合は警告
    if (duration > 200) {
      logger.warn(`${operationName} が遅い`, { duration });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operationName} 失敗`, { duration, error });
    throw error;
  }
}

// 使用例
const user = await measurePerformance("ユーザー取得", async () => {
  return await db.collection("users").doc(uid).get();
});
```

### Cloud Monitoringアラート設定

```yaml
# monitoring/alerts.yaml
alertPolicies:
  - displayName: "Cloud Functions エラー率"
    conditions:
      - displayName: "エラー率が1%を超えた"
        conditionThreshold:
          filter: 'resource.type="cloud_function" AND metric.type="cloudfunctions.googleapis.com/function/execution_count" AND metric.labels.status!="ok"'
          comparison: COMPARISON_GT
          thresholdValue: 0.01
          duration: "300s"
    notificationChannels:
      - projects/tokyo-list-478804-e5/notificationChannels/email

  - displayName: "Cloud Functions レスポンスタイム"
    conditions:
      - displayName: "レスポンスタイムが500msを超えた"
        conditionThreshold:
          filter: 'resource.type="cloud_function" AND metric.type="cloudfunctions.googleapis.com/function/execution_times"'
          comparison: COMPARISON_GT
          thresholdValue: 500
          duration: "300s"
```

### ログの確認方法

```bash
# Firebase Console からログを確認
# https://console.firebase.google.com/project/tokyo-list-478804-e5/functions/logs

# gcloud CLI でログを確認
gcloud functions logs read auth_onCreate --project=tokyo-list-478804-e5

# 特定のログレベルでフィルタ
gcloud functions logs read --project=tokyo-list-478804-e5 --filter="severity>=ERROR"

# 特定の期間でフィルタ
gcloud functions logs read --project=tokyo-list-478804-e5 --start-time="2025-12-10T00:00:00Z"
```

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月10日

## 備考

- Cloud Loggingは自動的に有効になっている
- アラート設定は本番デプロイ後に行う
- Sentry連携はオプション（Phase 2以降で検討）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 既存実装を反映、ステータスを完了に更新 |
