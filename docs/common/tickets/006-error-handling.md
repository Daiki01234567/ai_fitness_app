# 006 エラーハンドリング基盤

## 概要

Firebase Cloud Functionsで発生する全てのエラーを統一的に処理し、クライアントに適切なエラーレスポンスを返す基盤を構築するチケットです。エラーコードの標準化、エラーメッセージの多言語対応、リトライ可能なエラーの判定、ログ記録などを実装します。

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

- NFR-001: エラーハンドリング - 全てのエラーを適切に処理し、ユーザーにわかりやすいメッセージを表示
- NFR-022: エラーメッセージ - 平易な言語で表示

## 受け入れ条件（Todo）

- [ ] エラーコード体系の定義（TypeScript型定義）
- [ ] カスタムエラークラスの実装（`AppError`）
- [ ] エラーハンドラーユーティリティの実装（`handleError`）
- [ ] Firebase Functionsエラー変換関数の実装（`toHttpsError`）
- [ ] エラーレスポンス形式の統一
- [ ] リトライ可能エラーの判定ロジック
- [ ] エラーログ記録の実装（Cloud Logging統合）
- [ ] エラーハンドリングの単体テスト（カバレッジ80%以上）
- [ ] ドキュメント作成（JSDoc、使用例）

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - エラーハンドリング詳細
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-001, NFR-022
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - ログ記録のセキュリティ要件

## 技術詳細

### エラーコード体系

#### エラーコード定義

```typescript
/**
 * アプリケーション全体で使用するエラーコード
 */
export enum ErrorCode {
  // 認証エラー (401)
  UNAUTHENTICATED = 'UNAUTHENTICATED',

  // 権限エラー (403)
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // バリデーションエラー (400)
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',

  // リソース未検出エラー (404)
  NOT_FOUND = 'NOT_FOUND',

  // レート制限エラー (429)
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  // サーバー内部エラー (500)
  INTERNAL = 'INTERNAL',

  // サービス利用不可エラー (503)
  UNAVAILABLE = 'UNAVAILABLE',

  // その他のエラー
  UNKNOWN = 'UNKNOWN',
}

/**
 * エラーコードの属性
 */
export interface ErrorCodeInfo {
  httpStatus: number;
  retryable: boolean;
  message: string;
}

/**
 * エラーコード情報マップ
 */
export const ErrorCodeInfoMap: Record<ErrorCode, ErrorCodeInfo> = {
  [ErrorCode.UNAUTHENTICATED]: {
    httpStatus: 401,
    retryable: false,
    message: '認証が必要です。ログインしてください。',
  },
  [ErrorCode.PERMISSION_DENIED]: {
    httpStatus: 403,
    retryable: false,
    message: 'この操作を実行する権限がありません。',
  },
  [ErrorCode.INVALID_ARGUMENT]: {
    httpStatus: 400,
    retryable: false,
    message: '入力内容に誤りがあります。',
  },
  [ErrorCode.NOT_FOUND]: {
    httpStatus: 404,
    retryable: false,
    message: 'リソースが見つかりません。',
  },
  [ErrorCode.RESOURCE_EXHAUSTED]: {
    httpStatus: 429,
    retryable: true,
    message: 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
  },
  [ErrorCode.INTERNAL]: {
    httpStatus: 500,
    retryable: true,
    message: 'サーバーでエラーが発生しました。時間をおいて再試行してください。',
  },
  [ErrorCode.UNAVAILABLE]: {
    httpStatus: 503,
    retryable: true,
    message: 'サービスが一時的に利用できません。時間をおいて再試行してください。',
  },
  [ErrorCode.UNKNOWN]: {
    httpStatus: 500,
    retryable: false,
    message: '予期しないエラーが発生しました。',
  },
};
```

### カスタムエラークラス

```typescript
/**
 * アプリケーション全体で使用するカスタムエラークラス
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * このエラーがリトライ可能かどうか
   */
  get isRetryable(): boolean {
    return ErrorCodeInfoMap[this.code].retryable;
  }

  /**
   * HTTPステータスコードを取得
   */
  get httpStatus(): number {
    return ErrorCodeInfoMap[this.code].httpStatus;
  }

  /**
   * Firebase HttpsErrorに変換
   */
  toHttpsError(): HttpsError {
    return new HttpsError(
      this.code.toLowerCase() as FunctionsErrorCode,
      this.message,
      this.details
    );
  }
}
```

### エラーハンドラーユーティリティ

```typescript
import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * エラーを処理し、適切なHttpsErrorに変換する
 * @param error - 発生したエラー
 * @param context - エラーコンテキスト（ログ用）
 * @returns HttpsError
 */
export function handleError(error: unknown, context?: Record<string, any>): HttpsError {
  // AppErrorの場合はそのまま変換
  if (error instanceof AppError) {
    logError(error, context);
    return error.toHttpsError();
  }

  // HttpsErrorの場合はそのまま返す
  if (error instanceof HttpsError) {
    logError(error, context);
    return error;
  }

  // その他のエラーはINTERNALエラーとして扱う
  const appError = new AppError(
    ErrorCode.INTERNAL,
    'サーバーでエラーが発生しました。',
    error instanceof Error ? error.message : String(error)
  );

  logError(appError, context);
  return appError.toHttpsError();
}

/**
 * エラーをCloud Loggingに記録
 * @param error - エラー
 * @param context - エラーコンテキスト
 */
function logError(error: Error | AppError | HttpsError, context?: Record<string, any>): void {
  const logData: Record<string, any> = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  };

  if (error instanceof AppError) {
    logData.errorCode = error.code;
    logData.httpStatus = error.httpStatus;
    logData.retryable = error.isRetryable;
    logData.details = error.details;
  }

  // リトライ可能なエラーはWARNING、それ以外はERROR
  if (error instanceof AppError && error.isRetryable) {
    logger.warn('Retryable error occurred', logData);
  } else {
    logger.error('Error occurred', logData);
  }
}
```

### エラーレスポンス形式

#### 成功レスポンス

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

#### エラーレスポンス

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 使用例

#### API関数でのエラーハンドリング

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { handleError, AppError, ErrorCode } from '../utils/error-handling';

export const user_updateProfile = onCall(async (request) => {
  try {
    // 認証チェック
    if (!request.auth) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        '認証が必要です。ログインしてください。'
      );
    }

    // バリデーション
    if (!request.data.displayName) {
      throw new AppError(
        ErrorCode.INVALID_ARGUMENT,
        '表示名は必須です。',
        { field: 'displayName' }
      );
    }

    // ビジネスロジック
    // ...

    return {
      success: true,
      data: { userId: request.auth.uid },
      message: 'プロフィールを更新しました。',
    };
  } catch (error) {
    throw handleError(error, {
      function: 'user_updateProfile',
      userId: request.auth?.uid,
    });
  }
});
```

#### 非同期処理でのエラーハンドリング

```typescript
import { handleError } from '../utils/error-handling';

async function syncToBigQuery(data: any): Promise<void> {
  try {
    // BigQueryへの同期処理
    await bigquery.insert(data);
  } catch (error) {
    // エラーをログに記録し、リトライキューに追加
    handleError(error, {
      function: 'syncToBigQuery',
      data: data,
    });

    // Cloud Tasksに再試行タスクを追加
    await enqueueRetryTask(data);
  }
}
```

### ディレクトリ構成

```
functions/
├── src/
│   ├── utils/
│   │   ├── error-handling.ts    # エラーハンドリングユーティリティ
│   │   ├── errors.ts            # エラーコード定義、AppErrorクラス
│   │   └── index.ts             # エクスポート
│   └── tests/
│       └── utils/
│           └── error-handling.test.ts  # テスト
```

### テストケース

#### AppErrorクラスのテスト

- ✅ エラーコードとメッセージを正しく保持
- ✅ `isRetryable` プロパティが正しく動作
- ✅ `httpStatus` プロパティが正しく動作
- ✅ `toHttpsError()` が正しくHttpsErrorに変換

#### handleError関数のテスト

- ✅ AppErrorを正しくHttpsErrorに変換
- ✅ HttpsErrorをそのまま返す
- ✅ 一般的なErrorをINTERNALエラーとして処理
- ✅ 不明なエラーをINTERNALエラーとして処理
- ✅ エラーログが正しく記録される

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### エラーメッセージのベストプラクティス

- **ユーザー向けメッセージ**: 専門用語を避け、平易な日本語で記述
- **詳細情報**: `details` フィールドに技術的な詳細を含める（デバッグ用）
- **センシティブ情報の除外**: パスワードやトークンなどをログに含めない

### リトライ戦略

リトライ可能なエラー（`retryable: true`）は、以下の戦略でリトライします：

- **指数バックオフ**: 1秒 → 2秒 → 4秒 → 8秒
- **最大リトライ回数**: 3回
- **Cloud Tasks**: BigQuery同期など重要な処理は、Cloud Tasksでリトライキューに追加

### 多言語対応（Phase 4以降）

将来的には、エラーメッセージを多言語対応します：

```typescript
const messages = {
  ja: '認証が必要です。ログインしてください。',
  en: 'Authentication required. Please log in.',
};
```

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
