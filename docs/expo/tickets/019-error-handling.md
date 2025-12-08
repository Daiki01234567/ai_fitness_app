# 019 エラーハンドリング基盤

## 概要

アプリ全体で一貫したエラーハンドリングを実現するための基盤を構築します。グローバルエラーハンドラー、日本語エラーメッセージ、エラーログ収集の仕組みを実装します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 006: Expo Routerルーティング設定
- 007: スプラッシュ画面実装

## 要件

### 1. グローバルエラーハンドラー

#### 未捕捉エラーのキャッチ
- JavaScript例外をグローバルでキャッチ
- Promise rejectをグローバルでキャッチ
- エラー発生時にユーザーへ通知

#### エラー種別ごとの処理

| エラー種別 | 処理 |
|----------|------|
| 認証エラー | ログイン画面へリダイレクト |
| ネットワークエラー | 再試行オプションを表示 |
| 権限エラー | エラーメッセージを表示 |
| バリデーションエラー | フィールド単位でエラー表示 |
| サーバーエラー | エラーメッセージ + 再試行オプション |
| 未知のエラー | 汎用エラーメッセージ |

### 2. エラーメッセージ表示（日本語）

#### エラーコードと日本語メッセージのマッピング

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // 認証エラー
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/user-disabled': 'このアカウントは無効化されています',
  'auth/user-not-found': 'アカウントが見つかりません',
  'auth/wrong-password': 'パスワードが正しくありません',
  'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
  'auth/weak-password': 'パスワードが弱すぎます',
  'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください',

  // Firestoreエラー
  'permission-denied': 'この操作を行う権限がありません',
  'not-found': 'データが見つかりません',
  'unavailable': 'サーバーに接続できません。通信環境を確認してください',

  // ネットワークエラー
  'network-request-failed': 'ネットワーク接続を確認してください',

  // バリデーションエラー
  'validation/required': '必須項目です',
  'validation/invalid-email': 'メールアドレスの形式が正しくありません',
  'validation/min-length': '{min}文字以上で入力してください',
  'validation/max-length': '{max}文字以内で入力してください',

  // デフォルト
  'unknown': '予期しないエラーが発生しました',
};
```

### 3. エラー表示UI

#### トースト通知
- 短いエラーメッセージを画面下部に表示
- 自動で消える（3秒後）
- 赤色の背景

#### ダイアログ表示
- 重要なエラー（認証エラー、権限エラーなど）
- ユーザーの確認が必要な場合
- 再試行ボタン付き

#### インラインエラー
- フォームフィールドのバリデーションエラー
- フィールド直下に赤色テキストで表示

### 4. エラーログ収集

#### 収集する情報
- エラーメッセージ
- スタックトレース
- 発生画面
- ユーザーID（匿名化）
- デバイス情報
- アプリバージョン
- 発生日時

#### ログ送信先（Phase 2で有効化）
- Firebase Crashlytics
- 重大なエラーのみ送信

## 受け入れ条件

- [ ] 未捕捉のJavaScript例外がキャッチされる
- [ ] 未捕捉のPromise rejectがキャッチされる
- [ ] Firebaseエラーコードが日本語メッセージに変換される
- [ ] トースト通知でエラーメッセージが表示される
- [ ] 重要なエラーはダイアログで表示される
- [ ] フォームのバリデーションエラーがインライン表示される
- [ ] 認証エラー時にログイン画面へリダイレクトされる
- [ ] ネットワークエラー時に再試行オプションが表示される
- [ ] エラーログが収集される（コンソール出力、Phase 2でCrashlytics連携）
- [ ] ユーザーには技術的な詳細を見せない

## 参照ドキュメント

- [要件定義書 Part 2](../specs/02_要件定義書_Expo版_v1_Part2.md) - 非機能要件
- [要件定義書 Part 5](../specs/05_要件定義書_Expo版_v1_Part5.md) - APIエラーの種類

## 技術詳細

### ディレクトリ構造

```
lib/
├── errors/
│   ├── index.ts              # エクスポート
│   ├── ErrorHandler.ts       # グローバルエラーハンドラー
│   ├── errorMessages.ts      # エラーメッセージマッピング
│   ├── ErrorBoundary.tsx     # Reactエラーバウンダリ
│   └── types.ts              # エラー型定義

components/
├── error/
│   ├── ErrorToast.tsx        # トースト通知
│   ├── ErrorDialog.tsx       # エラーダイアログ
│   └── ErrorFallback.tsx     # フォールバックUI
```

### グローバルエラーハンドラー

```typescript
// lib/errors/ErrorHandler.ts
import { ErrorInfo } from 'react';
import { useUIStore } from '@/stores/uiStore';

class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  initialize() {
    // 未捕捉のPromise reject
    if (typeof global !== 'undefined') {
      global.onunhandledrejection = (event) => {
        this.handleError(event.reason);
      };
    }

    // 未捕捉の例外（React Native）
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.handleError(error, isFatal);
    });
  }

  handleError(error: Error | unknown, isFatal = false) {
    const errorMessage = this.getErrorMessage(error);

    // ログ出力
    console.error('[ErrorHandler]', error);

    // UIへの通知
    const uiStore = useUIStore.getState();
    if (isFatal) {
      uiStore.showErrorDialog(errorMessage);
    } else {
      uiStore.showToast(errorMessage, 'error');
    }

    // ログ収集（Phase 2でCrashlytics連携）
    this.logError(error);
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof FirebaseError) {
      return ERROR_MESSAGES[error.code] || ERROR_MESSAGES.unknown;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return ERROR_MESSAGES.unknown;
  }

  logError(error: unknown) {
    // Phase 1: コンソール出力のみ
    // Phase 2: Crashlyticsへ送信
  }
}

export const errorHandler = ErrorHandler.getInstance();
```

### Reactエラーバウンダリ

```typescript
// lib/errors/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { errorHandler } from './ErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorHandler.handleError(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
```

### エラーメッセージマッピング

```typescript
// lib/errors/errorMessages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  // Firebase Auth
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/user-disabled': 'このアカウントは無効化されています',
  'auth/user-not-found': 'アカウントが見つかりません',
  'auth/wrong-password': 'パスワードが正しくありません',
  'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
  'auth/weak-password': 'パスワードが弱すぎます。8文字以上で英字と数字を含めてください',
  'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらくお待ちください',
  'auth/network-request-failed': 'ネットワーク接続を確認してください',

  // Firestore
  'permission-denied': 'この操作を行う権限がありません',
  'not-found': 'データが見つかりません',
  'unavailable': 'サーバーに接続できません。通信環境を確認してください',
  'resource-exhausted': '利用制限に達しました。しばらくお待ちください',

  // カスタムエラー
  'deletion-scheduled': 'アカウント削除予約中のため、この操作はできません',
  'consent-required': '利用規約への同意が必要です',

  // デフォルト
  'unknown': '予期しないエラーが発生しました。時間をおいて再度お試しください',
};

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown;
}
```

### UIストアとの連携

```typescript
// stores/uiStore.ts（エラー関連部分）
interface UIState {
  // ... 他の状態

  // エラー表示
  errorToast: { message: string; visible: boolean };
  errorDialog: { message: string; visible: boolean; onRetry?: () => void };

  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  showErrorDialog: (message: string, onRetry?: () => void) => void;
  hideErrorDialog: () => void;
}
```

### アプリエントリーポイントでの初期化

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { errorHandler } from '@/lib/errors/ErrorHandler';
import { ErrorBoundary } from '@/lib/errors/ErrorBoundary';

export default function RootLayout() {
  useEffect(() => {
    errorHandler.initialize();
  }, []);

  return (
    <ErrorBoundary>
      {/* アプリコンテンツ */}
    </ErrorBoundary>
  );
}
```

## 注意事項

- ユーザーには技術的な詳細（スタックトレース等）を表示しない
- 開発環境ではコンソールに詳細なエラー情報を出力
- 本番環境では最小限の情報のみ表示
- エラーログには個人情報を含めない（ユーザーIDはハッシュ化）
- Phase 2でFirebase Crashlyticsと連携して本番エラーを収集

## 見積もり

- 想定工数: 2日

## 進捗

- [ ] 未着手
