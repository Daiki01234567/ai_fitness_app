# 023 エラーレポート機能

## 概要

アプリケーションで発生したエラーを収集し、開発チームに通知する機能を実装するチケットです。エラーが発生したら自動でSlackに通知し、重大なエラーの場合は自動でチケット（Issue）を作成します。これにより問題の早期発見と迅速な対応が可能になります。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/005（認証ミドルウェア実装）

## 要件

### 機能要件

- なし（運用機能のため）

### 非機能要件

- NFR-038: 監視 - エラー発生時の迅速な検知と通知
- NFR-036: ログ記録 - 障害分析に必要な情報の記録

## 受け入れ条件（Todo）

### エラー収集基盤

- [ ] エラー情報の収集関数を実装
- [ ] エラーのカテゴリ分類（重大度）を定義
- [ ] スタックトレースの取得と整形
- [ ] コンテキスト情報（ユーザーID、リクエスト情報等）の収集

### Slack通知

- [ ] Slack Webhook URLを設定（環境変数）
- [ ] エラー通知フォーマットを定義
- [ ] 重大度に応じたチャンネル振り分け
- [ ] 通知のレート制限（同一エラーの連続通知防止）

### 自動チケット作成

- [ ] GitHub Issues APIとの連携設定
- [ ] Issueテンプレートの作成
- [ ] 重複チケット防止ロジックの実装
- [ ] 自動ラベル付け（severity、component等）

### ダッシュボード連携

- [ ] Cloud Monitoringへのエラー情報送信
- [ ] エラー発生率のメトリクス作成
- [ ] アラートポリシーの設定
- [ ] 週次エラーサマリーレポートの自動生成

### テスト

- [ ] エラー収集のテスト
- [ ] Slack通知のテスト（モック使用）
- [ ] Issue作成のテスト（モック使用）
- [ ] レート制限のテスト

## 参照ドキュメント

- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - 監視とログ
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - エラーコード体系

## 技術詳細

### エラー重大度の定義

| レベル | 名前 | 説明 | 通知先 | 自動Issue |
|--------|------|------|--------|----------|
| 1 | CRITICAL | システム全体に影響するエラー | #alerts-critical | 即座に作成 |
| 2 | ERROR | 機能が使えなくなるエラー | #alerts-error | 24時間で3回以上で作成 |
| 3 | WARNING | 処理は続行できるが注意が必要 | #alerts-warning | 作成しない |
| 4 | INFO | 参考情報（エラーではない） | ログのみ | 作成しない |

### エラーレポート構造

```typescript
interface ErrorReport {
  // 基本情報
  id: string;                    // エラーID（UUID）
  timestamp: Date;               // 発生時刻
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';

  // エラー詳細
  name: string;                  // エラー名
  message: string;               // エラーメッセージ
  stack?: string;                // スタックトレース
  code?: string;                 // エラーコード

  // コンテキスト
  context: {
    functionName: string;        // Cloud Functions名
    userId?: string;             // ユーザーID（匿名化）
    requestId?: string;          // リクエストID
    environment: string;         // 環境（development/production）
  };

  // 追加情報
  metadata?: Record<string, unknown>;
}
```

### エラーレポートユーティリティ

```typescript
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';

/**
 * エラーレポートを作成・保存・通知する
 */
export async function reportError(
  error: Error,
  severity: ErrorReport['severity'],
  context: Partial<ErrorReport['context']>,
  metadata?: Record<string, unknown>
): Promise<string> {
  const errorId = crypto.randomUUID();

  const report: ErrorReport = {
    id: errorId,
    timestamp: new Date(),
    severity,
    name: error.name,
    message: error.message,
    stack: error.stack,
    context: {
      functionName: context.functionName || 'unknown',
      userId: context.userId ? hashUserId(context.userId) : undefined,
      requestId: context.requestId,
      environment: process.env.ENVIRONMENT || 'development'
    },
    metadata
  };

  // Firestoreに保存
  await saveErrorReport(report);

  // Slack通知（CRITICAL, ERRORのみ）
  if (severity === 'CRITICAL' || severity === 'ERROR') {
    await sendSlackNotification(report);
  }

  // 自動Issue作成（CRITICALのみ）
  if (severity === 'CRITICAL') {
    await createGitHubIssue(report);
  }

  // Cloud Loggingに記録
  logError(report);

  return errorId;
}

/**
 * ユーザーIDをハッシュ化（プライバシー保護）
 */
function hashUserId(userId: string): string {
  return crypto.createHash('sha256')
    .update(userId + process.env.ERROR_SALT)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Firestoreにエラーレポートを保存
 */
async function saveErrorReport(report: ErrorReport): Promise<void> {
  const db = admin.firestore();
  await db.collection('errorReports').doc(report.id).set({
    ...report,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### Slack通知実装

```typescript
import fetch from 'node-fetch';

const SLACK_WEBHOOKS = {
  CRITICAL: process.env.SLACK_WEBHOOK_CRITICAL,
  ERROR: process.env.SLACK_WEBHOOK_ERROR,
  WARNING: process.env.SLACK_WEBHOOK_WARNING
};

// 同一エラーの連続通知を防ぐキャッシュ
const notificationCache = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5分

/**
 * Slackにエラー通知を送信
 */
async function sendSlackNotification(report: ErrorReport): Promise<void> {
  // レート制限チェック
  const cacheKey = `${report.name}_${report.message}`;
  const lastNotification = notificationCache.get(cacheKey);

  if (lastNotification && Date.now() - lastNotification < NOTIFICATION_COOLDOWN_MS) {
    console.log('Slack通知をスキップ（レート制限）');
    return;
  }

  notificationCache.set(cacheKey, Date.now());

  const webhookUrl = SLACK_WEBHOOKS[report.severity];
  if (!webhookUrl) {
    console.warn(`Slack Webhook URLが未設定: ${report.severity}`);
    return;
  }

  const emoji = report.severity === 'CRITICAL' ? ':rotating_light:' : ':warning:';

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${report.severity}: ${report.name}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*エラーID:*\n${report.id}`
          },
          {
            type: 'mrkdwn',
            text: `*発生時刻:*\n${report.timestamp.toISOString()}`
          },
          {
            type: 'mrkdwn',
            text: `*関数名:*\n${report.context.functionName}`
          },
          {
            type: 'mrkdwn',
            text: `*環境:*\n${report.context.environment}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*メッセージ:*\n\`\`\`${report.message}\`\`\``
        }
      }
    ]
  };

  if (report.stack) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*スタックトレース:*\n\`\`\`${report.stack.substring(0, 500)}...\`\`\``
      }
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Slack通知失敗:', response.status);
    }
  } catch (error) {
    console.error('Slack通知エラー:', error);
  }
}
```

### GitHub Issue自動作成

```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const GITHUB_OWNER = 'your-org';
const GITHUB_REPO = 'ai-fitness-app';

// 重複チェック用キャッシュ
const issueCache = new Map<string, string>();

/**
 * GitHub Issueを自動作成
 */
async function createGitHubIssue(report: ErrorReport): Promise<string | null> {
  // 重複チェック
  const cacheKey = `${report.name}_${report.message}`;
  const existingIssue = issueCache.get(cacheKey);

  if (existingIssue) {
    console.log(`既存のIssueがあるためスキップ: ${existingIssue}`);
    return existingIssue;
  }

  const title = `[${report.severity}] ${report.name}: ${report.message.substring(0, 50)}`;

  const body = `
## エラー概要

- **エラーID**: ${report.id}
- **発生時刻**: ${report.timestamp.toISOString()}
- **重大度**: ${report.severity}
- **関数名**: ${report.context.functionName}
- **環境**: ${report.context.environment}

## エラーメッセージ

\`\`\`
${report.message}
\`\`\`

## スタックトレース

\`\`\`
${report.stack || 'なし'}
\`\`\`

## 追加情報

\`\`\`json
${JSON.stringify(report.metadata || {}, null, 2)}
\`\`\`

---
*このIssueは自動作成されました*
`;

  try {
    const response = await octokit.issues.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title,
      body,
      labels: [
        `severity:${report.severity.toLowerCase()}`,
        'auto-created',
        'needs-triage'
      ]
    });

    const issueUrl = response.data.html_url;
    issueCache.set(cacheKey, issueUrl);

    console.log(`GitHub Issue作成: ${issueUrl}`);
    return issueUrl;
  } catch (error) {
    console.error('GitHub Issue作成エラー:', error);
    return null;
  }
}
```

### 使用例

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { reportError } from './utils/errorReporting';

export const someFunction = onCall(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    // 処理...
  } catch (error) {
    if (error instanceof Error) {
      await reportError(error, 'ERROR', {
        functionName: 'someFunction',
        userId: request.auth?.uid,
        requestId
      });
    }

    throw new HttpsError('internal', '処理中にエラーが発生しました');
  }
});
```

## 見積もり

- 工数: 4日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Slackの代わりにDiscordも検討可能
- 本番環境用のWebhook URLは別途設定が必要
- GitHub Tokenは適切な権限（repo scope）が必要

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
