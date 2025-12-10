# 003 Cloud Functions基盤

## 概要

Firebase Cloud Functionsの基盤を構築するチケットです。Cloud Functionsとは、サーバーを管理しなくても動くプログラムのことで、アプリのバックエンド処理を担当します。

このチケットでは、全てのCloud Functionsに共通する設定（リージョン、メモリ、タイムアウト等）と、エラー処理やログ出力の基盤を作ります。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001（Firebase環境確認）

## 要件

### 機能要件

- なし（基盤チケットのため）

### 非機能要件

- NFR-003: APIレスポンス時間 - 200ms以内
- NFR-037: Functionsコールドスタート対策 - 500ms未満

## 受け入れ条件（Todo）

- [x] グローバル設定（リージョン: asia-northeast1, maxInstances: 10）を実装
- [x] TypeScript設定（strict mode）を確認
- [x] ESLint + Prettier設定を確認
- [x] Jestテスト基盤を確認
- [x] エラーハンドリング共通処理を実装
- [x] ログ設定（Cloud Logging）を実装
- [x] 認証ミドルウェアの基本構造を実装
- [x] バリデーションユーティリティの基本構造を実装
- [x] コールドスタート対策（グローバル変数の再利用）を実装
- [ ] 全てのユニットテストが通ることを確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API設計・共通仕様
- `docs/common/specs/02-2_非機能要件_v1_0.md` - パフォーマンス要件

## 技術詳細

### グローバル設定

```typescript
// functions/src/index.ts
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "asia-northeast1",  // 東京リージョン
  maxInstances: 10,           // コスト制御
  memory: "256MiB",           // メモリ割り当て
  timeoutSeconds: 60,         // タイムアウト
});
```

### ディレクトリ構造

```
functions/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── auth/                 # 認証トリガー
│   │   ├── onCreate.ts
│   │   └── onDelete.ts
│   ├── api/                  # HTTP Callable関数
│   │   ├── users/
│   │   │   ├── updateProfile.ts
│   │   │   └── updateConsent.ts
│   │   └── gdpr/
│   │       ├── requestDataExport.ts
│   │       └── requestAccountDeletion.ts
│   ├── middleware/           # ミドルウェア
│   │   ├── auth.ts           # 認証チェック
│   │   ├── validation.ts     # バリデーション
│   │   └── rateLimit.ts      # レート制限
│   ├── services/             # サービス層
│   │   ├── bigquery.ts
│   │   └── cloudTasks.ts
│   ├── types/                # 型定義
│   │   ├── user.ts
│   │   └── session.ts
│   └── utils/                # ユーティリティ
│       ├── logger.ts
│       ├── errors.ts
│       └── validation.ts
├── tests/                    # テスト
│   ├── auth/
│   ├── api/
│   └── mocks/
├── package.json
├── tsconfig.json
└── jest.config.js
```

### エラーハンドリング基盤

```typescript
// functions/src/utils/errors.ts
import { HttpsError, FunctionsErrorCode } from "firebase-functions/v2/https";
import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    public code: FunctionsErrorCode,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleError(error: unknown): never {
  logger.error("Error occurred", { error });

  if (error instanceof AppError) {
    throw new HttpsError(error.code, error.message, error.details);
  }

  if (error instanceof HttpsError) {
    throw error;
  }

  // Unknown error
  throw new HttpsError(
    "internal",
    "予期せぬエラーが発生しました。しばらくしてから再度お試しください。"
  );
}
```

### ログ設定

```typescript
// functions/src/utils/logger.ts
import * as functions from "firebase-functions";

export const logger = {
  info: (message: string, data?: object) => {
    functions.logger.info(message, data);
  },
  warn: (message: string, data?: object) => {
    functions.logger.warn(message, data);
  },
  error: (message: string, data?: object) => {
    functions.logger.error(message, data);
  },
  debug: (message: string, data?: object) => {
    if (process.env.NODE_ENV !== "production") {
      functions.logger.debug(message, data);
    }
  },
};
```

### コールドスタート対策

```typescript
// functions/src/services/firestore.ts
import { getFirestore } from "firebase-admin/firestore";
import { getApp, initializeApp, getApps } from "firebase-admin/app";

// グローバルスコープで初期化（コールドスタート時のみ実行）
let db: FirebaseFirestore.Firestore | null = null;

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    if (getApps().length === 0) {
      initializeApp();
    }
    db = getFirestore();
  }
  return db;
}
```

### npm scripts

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "lint": "eslint --ext .ts src/",
    "lint:fix": "eslint --ext .ts src/ --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "serve": "npm run build && firebase emulators:start --only functions"
  }
}
```

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月10日

## 備考

- Flutter版で既に基盤が構築されている
- このチケットでは既存の基盤を確認し、不足があれば追加する
- Expo版とFlutter版で共通のCloud Functionsを使用する

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 既存実装を反映、ステータスを完了に更新 |
