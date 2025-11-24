# Ticket #004: Cloud Functions 基盤構築

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 2
**優先度**: 高
**関連仕様書**:
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md`
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
TypeScript/Node.js 24 ベースのCloud Functions基盤を構築し、API開発の土台を作る。

## Todo リスト

### プロジェクト構造
- [ ] ディレクトリ構造作成
  - [ ] `functions/src/api/` - HTTPエンドポイント
  - [ ] `functions/src/triggers/` - Firestoreトリガー
  - [ ] `functions/src/scheduled/` - スケジュール関数
  - [ ] `functions/src/types/` - TypeScript型定義
  - [ ] `functions/src/utils/` - ユーティリティ
  - [ ] `functions/src/middleware/` - ミドルウェア
  - [ ] `functions/src/services/` - ビジネスロジック
- [ ] 環境変数設定ファイル
  - [ ] `.env.development`
  - [ ] `.env.staging`
  - [ ] `.env.production`

### TypeScript 設定
- [ ] `tsconfig.json` 設定
  - [ ] strict モード有効化
  - [ ] ES2022 ターゲット
  - [ ] モジュール解決設定
- [ ] 型定義ファイル作成
  - [ ] Firestore データモデル
  - [ ] API リクエスト/レスポンス
  - [ ] エラー型定義

### ESLint/Prettier 設定
- [ ] ESLint Google スタイル設定
- [ ] ダブルクォート強制
- [ ] セミコロン必須
- [ ] Prettier 統合
- [ ] pre-commit フック設定

### ロギング/モニタリング
- [ ] 構造化ログ実装
  - [ ] ログレベル設定
  - [ ] コンテキスト情報付加
- [ ] Cloud Logging 統合
- [ ] エラートラッキング設定
- [ ] パフォーマンスメトリクス設定

### エラーハンドリング
- [ ] グローバルエラーハンドラー
- [ ] カスタムエラークラス作成
  - [ ] ValidationError
  - [ ] AuthenticationError
  - [ ] AuthorizationError
  - [ ] NotFoundError
- [ ] エラーレスポンス標準化

### ミドルウェア実装
- [ ] 認証ミドルウェア
  - [ ] Firebase Auth トークン検証
  - [ ] カスタムクレームチェック
- [ ] バリデーションミドルウェア
  - [ ] リクエストボディ検証
  - [ ] パラメータ検証
- [ ] レート制限ミドルウェア
- [ ] CORS ミドルウェア

### 共通ユーティリティ
- [ ] Firestore ヘルパー関数
  - [ ] バッチ処理
  - [ ] トランザクション
  - [ ] ページネーション
- [ ] 日付処理ユーティリティ
- [ ] バリデーションユーティリティ
- [ ] 暗号化ユーティリティ

### Cloud Tasks 統合
- [ ] タスクキュー設定
- [ ] リトライポリシー設定
- [ ] Dead Letter Queue 設定
- [ ] タスクハンドラー基盤

### BigQuery 統合準備
- [ ] BigQuery クライアント設定
- [ ] ストリーミングインサート実装
- [ ] エラーハンドリング
- [ ] バッチ処理準備

### デプロイ設定
- [ ] 環境別デプロイスクリプト
- [ ] Functions 設定
  - [ ] メモリ: 256MB～1GB
  - [ ] タイムアウト: 60秒
  - [ ] 最大インスタンス数: 10
  - [ ] 最小インスタンス数: 0（コスト最適化）
- [ ] シークレット管理設定

### テスト基盤
- [ ] Jest 設定
- [ ] テストユーティリティ作成
- [ ] モック作成
  - [ ] Firestore モック
  - [ ] Auth モック
- [ ] E2Eテスト環境準備

## 受け入れ条件
- [ ] TypeScript のビルドが成功
- [ ] ESLint エラーがない
- [ ] 基本的なHTTP関数がデプロイ可能
- [ ] ログが Cloud Logging に出力される
- [ ] エラーハンドリングが機能する

## 注意事項
- Node.js 24 を使用
- コールドスタート最適化を考慮
- 将来の拡張性を確保
- セキュリティベストプラクティスを遵守

## 参考リンク
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)
- [TypeScript for Cloud Functions](https://firebase.google.com/docs/functions/typescript)
- [Cloud Tasks](https://cloud.google.com/tasks/docs)