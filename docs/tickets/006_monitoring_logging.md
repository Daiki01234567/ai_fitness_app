# Ticket #006: 監視・ログ基盤構築

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 2
**優先度**: 高
**ステータス**: 完了 ✅
**完了日**: 2025-11-28
**関連仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

## 概要
Cloud Logging、Cloud Monitoring、Error Reportingを活用した包括的な監視・ログ基盤を構築する。

## 実装ファイル

### バックエンド (Firebase Functions)
- `functions/src/utils/logger.ts` - 構造化ロガー（セキュリティログ、監査ログ対応）
- `functions/src/services/monitoring.ts` - メトリクス・トレーシング・エラーレポート
- `functions/src/services/securityMonitoring.ts` - セキュリティ監視サービス

### フロントエンド (Flutter)
- `flutter_app/lib/core/monitoring/monitoring_service.dart` - Crashlytics/Performance スタブ
- `flutter_app/lib/core/monitoring/app_logger.dart` - アプリロガー
- `flutter_app/lib/main.dart` - グローバルエラーハンドリング統合

### IaC / 設定
- `monitoring/alert-policies.yaml` - アラートポリシー定義
- `monitoring/notification-channels.yaml` - 通知チャネル設定
- `monitoring/budget-alerts.yaml` - 予算アラート設定
- `monitoring/setup-monitoring.sh` - セットアップスクリプト
- `monitoring/dashboards/system-overview.json` - ダッシュボード定義

### ログ分析クエリ
- `monitoring/log-queries/error-analysis.md`
- `monitoring/log-queries/security-analysis.md`
- `monitoring/log-queries/performance-analysis.md`
- `monitoring/log-queries/api-metrics.md`
- `monitoring/log-queries/user-activity.md`

### ドキュメント
- `docs/MONITORING_DESIGN.md` - 監視設計書
- `docs/ALERT_RUNBOOK.md` - アラート対応手順書

## Todo リスト

### Cloud Logging 設定
- [x] ログレベル設定
  - [x] DEBUG (開発環境のみ)
  - [x] INFO
  - [x] WARNING
  - [x] ERROR
  - [x] CRITICAL
- [x] 構造化ログフォーマット定義
  ```typescript
  {
    timestamp: string,
    severity: string,
    message: string,
    userId?: string,
    sessionId?: string,
    functionName: string,
    executionId: string,
    latency?: number,
    metadata?: object
  }
  ```
- [x] ログローテーション設定
- [x] ログ保存期間設定（30日/400日/7年）

### Cloud Monitoring 設定
- [x] カスタムメトリクス定義
  - [x] API レスポンスタイム
  - [x] エラー率
  - [x] 同時接続数
  - [x] トレーニングセッション数
  - [x] MediaPipe処理FPS
- [x] ダッシュボード作成
  - [x] システム概要ダッシュボード
  - [x] パフォーマンスダッシュボード
  - [x] エラー分析ダッシュボード
  - [x] ユーザーアクティビティダッシュボード
- [x] SLI/SLO設定
  - [x] API可用性: 99.5%
  - [x] レスポンスタイム: p95 < 500ms
  - [x] エラー率: < 0.1%

### アラート設定
- [x] 重要度別アラートポリシー
  - [x] Critical: 即時対応必要
  - [x] High: 1時間以内対応
  - [x] Medium: 営業時間内対応
  - [x] Low: 定期レビュー
- [x] アラート条件
  - [x] API エラー率 > 1%
  - [x] レスポンスタイム > 5秒
  - [x] Cloud Functions メモリ使用率 > 80%
  - [x] Firestore エラー検知
  - [x] 認証失敗の急増
- [x] 通知チャネル設定
  - [x] Slack
  - [x] Email
  - [x] PagerDuty（オプション）

### Error Reporting 設定
- [x] 自動エラー収集設定
- [x] エラーグループ化ルール
- [x] エラー通知設定
- [x] スタックトレース収集
- [x] ソースマップ設定（TypeScript）

### Cloud Trace 設定
- [x] 分散トレーシング有効化
- [x] カスタムスパン実装
- [x] パフォーマンスボトルネック分析
- [x] レイテンシー分析

### セキュリティ監視
- [x] 不正アクセス検知
  - [x] 複数回の認証失敗
  - [x] 異常なAPIアクセスパターン
  - [x] 権限昇格の試み
- [x] データアクセス監視
  - [x] 大量データダウンロード
  - [x] 権限外アクセス試行
- [x] 監査ログ
  - [x] 管理者操作
  - [x] データ削除操作
  - [x] 設定変更

### Flutter アプリ監視
- [x] Firebase Crashlytics 統合（スタブ実装）
- [x] Firebase Performance 統合（スタブ実装）
- [x] カスタムイベントトラッキング
  - [x] 画面遷移
  - [x] ボタンクリック
  - [x] エラー発生
- [x] ANR (Application Not Responding) 検知

### コスト監視
- [x] 予算アラート設定
- [x] リソース使用量追跡
  - [x] Firestore 読み取り/書き込み
  - [x] Cloud Functions 実行時間
  - [x] BigQuery クエリコスト
  - [x] Storage 使用量
- [x] コスト最適化レポート

### ログ分析クエリ
- [x] よく使うクエリをライブラリ化
  - [x] エラー分析
  - [x] ユーザー行動分析
  - [x] パフォーマンス分析
  - [x] セキュリティ分析
- [ ] 定期レポート生成（将来実装）

### ドキュメント
- [x] 監視設計書
- [x] アラート対応手順書
- [x] ログ分析ガイド
- [x] インシデント対応フロー

## 受け入れ条件
- [x] すべてのログが構造化形式で出力される
- [x] ダッシュボードで主要メトリクスが確認できる
- [x] アラートが適切にトリガーされる
- [x] エラーが自動で収集・分類される
- [x] コスト監視が機能する

## 注意事項
- GDPR準拠（個人情報のログ出力に注意）→ センシティブデータマスキング実装済み
- ログのコスト最適化 → ログタイプ別保存期間設定
- 適切なサンプリングレート設定
- 機密情報のマスキング → sanitize関数で自動マスキング

## デプロイ手順

1. Firebase Functions をデプロイ
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. Cloud Monitoring セットアップを実行
   ```bash
   cd monitoring
   chmod +x setup-monitoring.sh
   ./setup-monitoring.sh
   ```

3. 通知チャネルを Cloud Console で設定

4. アラートポリシーを適用
   ```bash
   gcloud alpha monitoring policies create --policy-from-file=alert-policies.yaml
   ```

## 参考リンク
- [Cloud Logging](https://cloud.google.com/logging/docs)
- [Cloud Monitoring](https://cloud.google.com/monitoring/docs)
- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics)
