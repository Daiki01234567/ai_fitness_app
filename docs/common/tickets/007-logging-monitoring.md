# 007 ロギング・監視基盤

## 概要

Firebase Cloud FunctionsとモバイルアプリのログをCloud Loggingに統合し、エラー監視、パフォーマンス監視、異常検知を実装するチケットです。Cloud Monitoring（旧Stackdriver）でアラート設定を行い、問題が発生した際に迅速に対応できる体制を構築します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築

## 要件

### 機能要件

- なし（基盤機能のため）

### 非機能要件

- NFR-028: ログ収集 - Cloud Loggingによるログ収集
- NFR-029: エラー監視 - Firebase Crashlyticsによるエラー監視
- NFR-030: パフォーマンス監視 - Firebase Performanceによるパフォーマンス監視
- NFR-036: 監視・ログ - 全体的な監視体制の構築

## 受け入れ条件（Todo）

- [ ] ロギングユーティリティの実装（構造化ログ）
- [ ] Cloud Logging統合の実装
- [ ] ログレベル定義（INFO, WARNING, ERROR, CRITICAL）
- [ ] Cloud Monitoring アラート設定（エラー率、レイテンシ）
- [ ] Firebase Crashlytics 統合（モバイルアプリ）
- [ ] Firebase Performance Monitoring 統合（モバイルアプリ）
- [ ] ログ保存期間の設定（30日間）
- [ ] ダッシュボード作成（Cloud Monitoring）
- [ ] アラート通知先の設定（メール、Slack等）
- [ ] ドキュメント作成（ログ出力ガイド、アラート対応手順）

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-028, NFR-029, NFR-030, NFR-036
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - ログ記録のセキュリティ要件

## 技術詳細

### ログレベル定義

| レベル | 用途 | 例 |
|--------|------|-----|
| **INFO** | 通常のAPI呼び出し、処理成功 | ユーザー登録成功、セッション作成 |
| **WARNING** | リトライ可能なエラー、非クリティカルな問題 | BigQuery同期失敗（リトライ予定）、レート制限 |
| **ERROR** | リトライ不可能なエラー、予期しない問題 | バリデーションエラー、権限エラー |
| **CRITICAL** | システム障害、緊急対応が必要 | データベース接続失敗、サービス全体停止 |

### ロギングユーティリティ

#### 構造化ログの実装

```typescript
import { logger } from 'firebase-functions/v2';

/**
 * 構造化ログのインターフェース
 */
export interface LogContext {
  userId?: string;
  sessionId?: string;
  functionName?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * 構造化ログユーティリティ
 */
export class Logger {
  /**
   * INFOレベルのログを出力
   */
  static info(message: string, context?: LogContext): void {
    logger.info(message, context);
  }

  /**
   * WARNINGレベルのログを出力
   */
  static warn(message: string, context?: LogContext): void {
    logger.warn(message, context);
  }

  /**
   * ERRORレベルのログを出力
   */
  static error(message: string, error: Error, context?: LogContext): void {
    logger.error(message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * CRITICALレベルのログを出力（アラート通知）
   */
  static critical(message: string, error: Error, context?: LogContext): void {
    logger.error(message, {
      ...context,
      severity: 'CRITICAL',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }
}
```

#### センシティブ情報の除外

```typescript
/**
 * ログからセンシティブ情報を除外
 * @param data - ログデータ
 * @returns センシティブ情報を除外したデータ
 */
export function sanitizeLogData(data: any): any {
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard'];

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized: any = Array.isArray(data) ? [] : {};

  for (const key in data) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object') {
      sanitized[key] = sanitizeLogData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
}
```

### 使用例

#### API関数でのログ出力

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { Logger } from '../utils/logger';

export const user_updateProfile = onCall(async (request) => {
  const startTime = Date.now();
  const uid = request.auth?.uid;

  try {
    Logger.info('プロフィール更新開始', {
      userId: uid,
      functionName: 'user_updateProfile',
    });

    // ビジネスロジック
    // ...

    const duration = Date.now() - startTime;
    Logger.info('プロフィール更新成功', {
      userId: uid,
      functionName: 'user_updateProfile',
      duration,
    });

    return { success: true };
  } catch (error) {
    Logger.error('プロフィール更新失敗', error as Error, {
      userId: uid,
      functionName: 'user_updateProfile',
      duration: Date.now() - startTime,
    });
    throw error;
  }
});
```

### Cloud Monitoring アラート設定

#### アラートポリシー

| アラート名 | 条件 | 通知先 | 対応 |
|-----------|------|--------|------|
| **エラー率高騰** | エラー率 > 5% （5分間） | メール、Slack | 即座に調査 |
| **レイテンシ増加** | P95レイテンシ > 1秒 （10分間） | メール | パフォーマンス調査 |
| **Cloud Functions失敗** | 関数実行失敗 > 10回/分 | メール、Slack | 緊急対応 |
| **BigQuery同期失敗** | DLQ滞留 > 100件 | メール | リトライ処理確認 |
| **認証失敗急増** | 認証失敗 > 50回/分 | Slack | 不正アクセス調査 |

#### アラート通知先の設定

```bash
# Slackへの通知チャンネル設定
gcloud alpha monitoring channels create \
  --display-name="AI Fitness App Alerts" \
  --type=slack \
  --channel-labels=url=<SLACK_WEBHOOK_URL>
```

### Firebase Crashlytics 統合

#### Expo版（React Native）

```typescript
// app/_layout.tsx
import crashlytics from '@react-native-firebase/crashlytics';

// クラッシュレポート送信
crashlytics().log('User signed in');
crashlytics().recordError(new Error('Test error'));
```

#### Flutter版

```dart
// lib/main.dart
import 'package:firebase_crashlytics/firebase_crashlytics.dart';

void main() async {
  // Crashlytics初期化
  FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterError;

  runApp(MyApp());
}
```

### Firebase Performance Monitoring 統合

#### Expo版（React Native）

```typescript
import perf from '@react-native-firebase/perf';

// カスタムトレース
const trace = await perf().startTrace('training_session');
await processTrainingSession();
await trace.stop();
```

#### Flutter版

```dart
import 'package:firebase_performance/firebase_performance.dart';

// カスタムトレース
final trace = FirebasePerformance.instance.newTrace('training_session');
await trace.start();
await processTrainingSession();
await trace.stop();
```

### ダッシュボード構成

#### Cloud Monitoring ダッシュボード

- **API呼び出し数**: 時系列グラフ（関数別）
- **エラー率**: 時系列グラフ（関数別）
- **レイテンシ**: P50, P95, P99の時系列グラフ
- **BigQuery同期状況**: 成功/失敗の時系列グラフ
- **アクティブユーザー数**: 日次グラフ

#### Firebase Console ダッシュボード

- **Crashlytics**: クラッシュ率、影響を受けたユーザー数
- **Performance**: 画面表示時間、ネットワークリクエスト時間
- **Analytics**: アクティブユーザー、セッション時間

### ログ保存期間

| ログタイプ | 保存期間 | 理由 |
|----------|---------|------|
| **Cloud Logging** | 30日間 | コスト削減、デバッグに十分な期間 |
| **監査ログ** | 2年間 | GDPR準拠（NFR-039） |
| **Crashlytics** | 90日間 | Firebase標準設定 |

### ディレクトリ構成

```
functions/
├── src/
│   ├── utils/
│   │   ├── logger.ts            # ロギングユーティリティ
│   │   └── index.ts             # エクスポート
│   └── tests/
│       └── utils/
│           └── logger.test.ts   # テスト
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### ログ出力のベストプラクティス

- **構造化ログ**: JSON形式で出力し、検索しやすくする
- **コンテキスト情報**: userId, sessionId, functionNameなどを含める
- **パフォーマンス計測**: 処理時間（duration）を記録
- **センシティブ情報の除外**: パスワード、トークンなどをログに含めない

### アラート対応フロー

1. **アラート受信**: Slack/メールで通知を受ける
2. **ダッシュボード確認**: Cloud Monitoring/Firebase Consoleで状況確認
3. **ログ検索**: Cloud Loggingで詳細ログを検索
4. **原因特定**: エラーログ、スタックトレースから原因を特定
5. **緊急対応**: 必要に応じてロールバック、緊急パッチ適用
6. **事後報告**: インシデントレポート作成、再発防止策を検討

### GDPR対応

ログに個人情報が含まれる場合、以下の対応が必要です：

- **仮名化**: ユーザーIDは仮名化されたIDを使用
- **保存期間制限**: 30日間で自動削除
- **アクセス制限**: ログへのアクセスは管理者のみに制限

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
