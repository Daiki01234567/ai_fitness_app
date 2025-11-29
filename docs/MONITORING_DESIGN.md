# 監視・ロギング設計書

AIフィットネスアプリの監視・ロギング基盤の設計と運用ガイドです。

## 1. 概要

### 1.1 目的

- システムの可用性と信頼性の確保
- パフォーマンス問題の早期検出
- セキュリティインシデントの検知と対応
- GDPR コンプライアンスの監査証跡
- コスト最適化

### 1.2 対象範囲

| コンポーネント | 監視方法 |
|--------------|---------|
| Cloud Functions | Cloud Monitoring, Cloud Logging |
| Firestore | Cloud Monitoring メトリクス |
| Flutter アプリ | Firebase Crashlytics, Performance Monitoring |
| BigQuery | Cloud Monitoring, ジョブ監視 |
| Cloud Storage | Cloud Monitoring |

### 1.3 参照仕様書

- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` Section 13
- `docs/specs/07_セキュリティポリシー_v1_0.md` Section 11

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Flutter App                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  AppLogger       │  │  MonitoringService│  │  Crashlytics     │  │
│  │  (app_logger)    │  │  (performance)    │  │  (errors)        │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼───────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Firebase                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Cloud Functions │  │  Firestore       │  │  Cloud Storage   │  │
│  │  (logger.ts)     │  │  (triggers)      │  │                  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼───────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Google Cloud Platform                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Cloud Logging   │  │  Cloud Monitoring│  │  Error Reporting │  │
│  │  (構造化ログ)    │  │  (メトリクス)    │  │  (エラー集約)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                      │                      │            │
│           ▼                      ▼                      ▼            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    アラートポリシー                           │  │
│  │                    (alert-policies.yaml)                      │  │
│  └────────────────────────────┬─────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  通知チャネル: Slack / Email / PagerDuty                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. ログ設計

### 3.1 ログレベル

| レベル | 用途 | 例 |
|-------|------|-----|
| DEBUG | 開発時のデバッグ情報 | 変数値、処理フロー |
| INFO | 正常な操作の記録 | API呼び出し、ユーザーアクション |
| WARNING | 潜在的な問題 | レート制限接近、非推奨API使用 |
| ERROR | エラー発生 | 例外、API失敗 |
| CRITICAL | 重大な障害 | サービス停止、データ整合性問題 |

### 3.2 ログタイプ

| タイプ | 説明 | 保存期間 |
|-------|------|---------|
| access | アクセスログ | 400日 |
| error | エラーログ | 400日 |
| audit | 監査ログ | 7年（GDPR） |
| security | セキュリティログ | 7年 |
| performance | パフォーマンスログ | 90日 |
| general | 一般ログ | 30日 |

### 3.3 構造化ログフォーマット

```json
{
  "timestamp": "2025-11-28T10:30:00.000Z",
  "severity": "INFO",
  "logType": "access",
  "message": "API request processed",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "sourceIp": "203.0.113.1",
  "durationMs": 150,
  "httpRequest": {
    "method": "POST",
    "url": "/api/users/profile",
    "status": 200
  },
  "context": {
    "functionName": "api",
    "region": "asia-northeast1"
  }
}
```

### 3.4 センシティブデータの取り扱い

以下のフィールドは自動的にマスクまたは除外：

- `password`, `token`, `secret`, `key`
- `email` → マスク処理（`u***@example.com`）
- `phoneNumber` → マスク処理（`+81***1234`）
- クレジットカード情報

## 4. メトリクス設計

### 4.1 システムメトリクス（自動収集）

| メトリクス | 説明 | 閾値 |
|-----------|------|------|
| function/execution_count | 関数実行回数 | - |
| function/execution_times | 実行時間 | P99 < 5s |
| function/user_memory_bytes | メモリ使用量 | < 200MB |
| firestore/document_reads | 読み取り数 | - |
| firestore/document_writes | 書き込み数 | - |

### 4.2 カスタムメトリクス

| メトリクス | 説明 | 単位 |
|-----------|------|------|
| api_latency | APIレイテンシ | ms |
| api_error_count | APIエラー数 | count |
| auth_failure_count | 認証失敗数 | count |
| session_count | セッション数 | count |
| mediapipe_fps | MediaPipe FPS | fps |

### 4.3 SLI/SLO

| サービス | SLI | SLO |
|---------|-----|-----|
| API 可用性 | 成功リクエスト率 | 99.5% |
| API レイテンシ | P95 応答時間 | < 500ms |
| エラー率 | 5xx エラー率 | < 0.1% |
| Firestore | 読み取り成功率 | 99.9% |

## 5. アラート設計

### 5.1 重要度レベル

| レベル | 対応時間 | 通知先 | 例 |
|-------|---------|--------|-----|
| Critical | 15分以内 | PagerDuty + Slack | サービス停止 |
| High | 1時間以内 | Slack + Email | エラー率急上昇 |
| Medium | 4時間以内 | Slack | パフォーマンス低下 |
| Low | 24時間以内 | Email | 予算警告 |

### 5.2 アラートポリシー一覧

詳細は `monitoring/alert-policies.yaml` を参照。

| アラート名 | 条件 | 重要度 |
|-----------|------|--------|
| API Error Rate High | エラー率 > 1% | High |
| API Latency High | P99 > 5s | Medium |
| Auth Failures Spike | 失敗数 > 10/5分 | High |
| Budget 80% Reached | 予算の80%到達 | Medium |
| Uptime Check Failed | ヘルスチェック失敗 | Critical |

## 6. セキュリティ監視

### 6.1 監視対象イベント

| イベント | 検知方法 | 対応 |
|---------|---------|------|
| ブルートフォース | 5回連続失敗/5分 | アカウントロック |
| 大量データダウンロード | 100件以上/分 | 管理者通知 |
| 不正アクセス試行 | 権限エラー | ログ記録 |
| レート制限超過 | 閾値超え | 一時ブロック |
| 権限昇格試行 | 管理者API不正使用 | 即時ブロック |

### 6.2 セキュリティイベントの保存

```typescript
// Firestore コレクション: securityEvents
{
  type: "BRUTE_FORCE_DETECTED",
  severity: "high",
  timestamp: Timestamp,
  sourceIp: "203.0.113.1",
  userId: "user_xyz",
  description: "5 failed login attempts in 5 minutes",
  indicators: { attemptCount: 5 },
  resolved: false
}
```

## 7. Flutter アプリ監視

### 7.1 Crashlytics

- クラッシュレポート自動収集
- 非致命的エラーの記録
- ユーザーコンテキストの追加

### 7.2 Performance Monitoring

- アプリ起動時間
- 画面レンダリング時間
- ネットワークリクエスト
- カスタムトレース（MediaPipe 処理など）

### 7.3 AppLogger 使用例

```dart
// 画面遷移
appLogger.screenView('HomeScreen');

// ユーザーアクション
appLogger.userAction('start_workout', parameters: {
  'exercise_type': 'squat',
});

// MediaPipe パフォーマンス
appLogger.mediaPipePerformance(
  fps: 28.5,
  processTimeMs: 35,
  frameDropCount: 2,
);

// エラー
appLogger.error(
  'Failed to save session',
  error: exception,
  stackTrace: stackTrace,
);
```

## 8. 運用手順

### 8.1 日次チェック

1. Cloud Monitoring ダッシュボードを確認
2. Error Reporting で新規エラーを確認
3. 未解決のセキュリティイベントを確認

### 8.2 週次レビュー

1. SLO 達成状況の確認
2. パフォーマンストレンドの分析
3. コスト推移の確認
4. アラート閾値の見直し

### 8.3 インシデント対応

詳細は `docs/ALERT_RUNBOOK.md` を参照。

## 9. ファイル構成

```
monitoring/
├── alert-policies.yaml      # アラートポリシー定義
├── notification-channels.yaml # 通知チャネル設定
├── budget-alerts.yaml       # 予算アラート設定
├── setup-monitoring.sh      # セットアップスクリプト
├── dashboards/
│   └── system-overview.json # ダッシュボード定義
└── log-queries/
    ├── README.md
    ├── error-analysis.md
    ├── security-analysis.md
    ├── performance-analysis.md
    ├── api-metrics.md
    └── user-activity.md

functions/src/
├── utils/
│   └── logger.ts            # 構造化ログ
└── services/
    ├── monitoring.ts        # メトリクス・トレーシング
    └── securityMonitoring.ts # セキュリティ監視

flutter_app/lib/core/monitoring/
├── monitoring_service.dart  # 監視サービス
└── app_logger.dart         # アプリロガー
```

## 10. 参考リンク

- [Cloud Monitoring ドキュメント](https://cloud.google.com/monitoring/docs)
- [Cloud Logging ドキュメント](https://cloud.google.com/logging/docs)
- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics)
- [Firebase Performance](https://firebase.google.com/docs/perf-mon)
