# Ticket #004: Cloud Functions 基盤構築

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 2
**優先度**: 高
**ステータス**: ✅ 完了
**関連仕様書**:
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md`
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
TypeScript/Node.js 24 ベースのCloud Functions基盤を構築し、API開発の土台を作る。

## Todo リスト

### プロジェクト構造
- [x] ディレクトリ構造作成
  - [x] `functions/src/api/` - HTTPエンドポイント
  - [x] `functions/src/triggers/` - Firestoreトリガー
  - [x] `functions/src/scheduled/` - スケジュール関数
  - [x] `functions/src/types/` - TypeScript型定義
  - [x] `functions/src/utils/` - ユーティリティ
  - [x] `functions/src/middleware/` - ミドルウェア
  - [x] `functions/src/services/` - ビジネスロジック
- [ ] 環境変数設定ファイル（本番デプロイ時に設定）
  - [ ] `.env.development`
  - [ ] `.env.staging`
  - [ ] `.env.production`

### TypeScript 設定
- [x] `tsconfig.json` 設定
  - [x] strict モード有効化
  - [x] ES2022 ターゲット
  - [x] モジュール解決設定
- [x] 型定義ファイル作成
  - [x] Firestore データモデル (`types/firestore.ts`)
  - [x] API リクエスト/レスポンス (`types/api.ts`)
  - [x] エラー型定義 (`types/errors.ts`)

### ESLint/Prettier 設定
- [x] ESLint Google スタイル設定
- [x] ダブルクォート強制
- [x] セミコロン必須
- [x] Prettier 統合
- [ ] pre-commit フック設定（CI/CD実装時に設定）

### ロギング/モニタリング
- [x] 構造化ログ実装 (`utils/logger.ts`)
  - [x] ログレベル設定
  - [x] コンテキスト情報付加
- [x] Cloud Logging 統合
- [x] エラートラッキング設定
- [x] パフォーマンスメトリクス設定

### エラーハンドリング
- [x] グローバルエラーハンドラー (`utils/errors.ts`)
- [x] カスタムエラークラス作成
  - [x] ValidationError
  - [x] AuthenticationError
  - [x] AuthorizationError
  - [x] NotFoundError
  - [x] RateLimitError
  - [x] ExternalServiceError
- [x] エラーレスポンス標準化

### ミドルウェア実装
- [x] 認証ミドルウェア (`middleware/auth.ts`)
  - [x] Firebase Auth トークン検証
  - [x] カスタムクレームチェック
  - [x] 削除予定ユーザーのアクセス制御
- [x] バリデーションミドルウェア (`middleware/validation.ts`)
  - [x] リクエストボディ検証
  - [x] パラメータ検証
  - [x] スキーマベースバリデーション
- [x] レート制限ミドルウェア (`middleware/rateLimiter.ts`)
- [ ] CORS ミドルウェア（HTTPトリガー実装時に追加）

### 共通ユーティリティ
- [x] Firestore ヘルパー関数 (`utils/firestore.ts`)
  - [x] バッチ処理
  - [x] トランザクション
  - [x] ページネーション
  - [x] QueryBuilder
- [x] 日付処理ユーティリティ (`utils/date.ts`)
- [x] バリデーションユーティリティ (`utils/validation.ts`)
- [x] レスポンスユーティリティ (`utils/response.ts`)
- [ ] 暗号化ユーティリティ（必要時に追加）

### Cloud Tasks 統合
- [x] タスクキュー設定 (`services/cloudTasks.ts`)
- [x] リトライポリシー設定
- [x] Dead Letter Queue 設定
- [x] タスクハンドラー基盤

### BigQuery 統合準備
- [x] BigQuery クライアント設定 (`services/bigquery.ts`)
- [x] ストリーミングインサート実装
- [x] エラーハンドリング
- [x] DLQ処理
- [x] データ匿名化

### デプロイ設定
- [x] 環境別デプロイスクリプト (`package.json` scripts)
- [x] Functions 設定 (`index.ts`)
  - [x] メモリ: 256MB
  - [x] タイムアウト: 60秒
  - [x] 最大インスタンス数: 10
  - [x] 最小インスタンス数: 0（コスト最適化）
  - [x] リージョン: asia-northeast1（東京）
- [ ] シークレット管理設定（本番デプロイ時に設定）

### テスト基盤
- [x] Jest 設定 (`jest.config.js`)
- [x] テストユーティリティ作成 (`tests/setup.ts`)
- [x] モック作成
  - [x] Firestore モック (`tests/mocks/firestore.ts`)
  - [x] Auth モック (`tests/mocks/auth.ts`)
- [x] サンプルテスト作成
  - [x] `tests/utils/validation.test.ts`
  - [x] `tests/utils/errors.test.ts`
- [ ] E2Eテスト環境準備（Phase 2で実装）

## 受け入れ条件
- [x] TypeScript のビルドが成功
- [x] ESLint エラーがない
- [x] 基本的なHTTP関数がデプロイ可能（auth関数実装済み）
- [x] ログが Cloud Logging に出力される
- [x] エラーハンドリングが機能する

## 作成されたファイル一覧

```
functions/
├── .eslintrc.js          # ESLint設定
├── .prettierrc           # Prettier設定
├── .prettierignore       # Prettier除外設定
├── jest.config.js        # Jest設定
├── package.json          # 依存関係・スクリプト
├── tsconfig.json         # TypeScript設定
├── src/
│   ├── index.ts          # エントリーポイント
│   ├── api/
│   │   └── index.ts      # API関数（将来実装）
│   ├── auth/             # 認証関数（既存）
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── auth.ts       # 認証ミドルウェア
│   │   ├── rateLimiter.ts # レート制限
│   │   └── validation.ts # バリデーション
│   ├── scheduled/
│   │   └── index.ts      # スケジュール関数（将来実装）
│   ├── services/
│   │   ├── index.ts
│   │   ├── bigquery.ts   # BigQuery統合
│   │   └── cloudTasks.ts # Cloud Tasks統合
│   ├── triggers/
│   │   └── index.ts      # Firestoreトリガー（将来実装）
│   ├── types/
│   │   ├── index.ts
│   │   ├── api.ts        # API型定義
│   │   ├── errors.ts     # エラー型定義
│   │   └── firestore.ts  # Firestoreモデル
│   └── utils/
│       ├── index.ts
│       ├── date.ts       # 日付ユーティリティ
│       ├── errors.ts     # エラークラス
│       ├── firestore.ts  # Firestoreヘルパー
│       ├── logger.ts     # 構造化ログ
│       ├── response.ts   # レスポンスヘルパー
│       └── validation.ts # バリデーション
└── tests/
    ├── setup.ts          # テストセットアップ
    ├── mocks/
    │   ├── auth.ts       # 認証モック
    │   └── firestore.ts  # Firestoreモック
    └── utils/
        ├── errors.test.ts     # エラーテスト
        └── validation.test.ts # バリデーションテスト
```

## 注意事項
- Node.js 24 を使用
- コールドスタート最適化を考慮
- 将来の拡張性を確保
- セキュリティベストプラクティスを遵守

## 参考リンク
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)
- [TypeScript for Cloud Functions](https://firebase.google.com/docs/functions/typescript)
- [Cloud Tasks](https://cloud.google.com/tasks/docs)
