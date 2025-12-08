# 006 監視・ログ基盤構築

## 概要

アプリの監視・ログ収集基盤を構築します。Cloud Logging、Firebase Crashlytics、Firebase Performanceを設定し、アプリの品質と安定性を監視できる環境を整えます。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [001 Firebaseプロジェクトセットアップ](./001-firebase-project-setup.md)

## 要件

### 監視対象

| 監視項目 | ツール | 目的 |
|---------|-------|------|
| クラッシュ | Firebase Crashlytics | アプリのクラッシュを検知・分析 |
| パフォーマンス | Firebase Performance | アプリの速度・レスポンスを監視 |
| ログ | Cloud Logging | エラー・イベントログの収集 |
| エラー | Error Boundary | React Native のエラーをキャッチ |

### 非機能要件対応

| 要件ID | 要件 | 対応 |
|--------|------|------|
| NFR-028 | ログ収集（Cloud Logging） | Cloud Functionsログを収集 |
| NFR-029 | エラー監視（Firebase Crashlytics） | クラッシュレポートを自動収集 |
| NFR-030 | パフォーマンス監視（Firebase Performance） | レスポンス時間を測定 |

### 収集するデータ

1. **クラッシュ情報**
   - クラッシュ発生箇所
   - スタックトレース
   - デバイス情報
   - OSバージョン

2. **パフォーマンスデータ**
   - アプリ起動時間（目標: 3秒以内）
   - 画面遷移時間
   - ネットワークリクエスト時間（目標: 200ms以内）

3. **ログデータ**
   - エラーログ
   - 認証イベント
   - 重要な操作（セッション開始・終了など）

## 受け入れ条件

- [ ] Firebase Crashlyticsが有効化されている
- [ ] Firebase Performanceが有効化されている
- [ ] `@react-native-firebase/crashlytics`がインストールされている
- [ ] `@react-native-firebase/perf`がインストールされている
- [ ] Error Boundaryが実装されている
- [ ] テストクラッシュでCrashlyticsにレポートが送信される
- [ ] アプリ起動時間がPerformanceダッシュボードで確認できる
- [ ] Cloud FunctionsのログがCloud Loggingで確認できる

## 参照ドキュメント

- [要件定義書 Part 2（非機能要件）](../specs/02_要件定義書_Expo版_v1_Part2.md) - NFR-028, NFR-029, NFR-030
- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)

## 技術詳細

### 必要なパッケージ

```bash
# Firebase Crashlytics
npx expo install @react-native-firebase/crashlytics

# Firebase Performance
npx expo install @react-native-firebase/perf
```

### Crashlytics設定

```typescript
// lib/firebase/crashlytics.ts
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Crashlyticsの初期化
 */
export function initCrashlytics() {
  // 開発環境ではクラッシュレポートを無効化（任意）
  if (__DEV__) {
    crashlytics().setCrashlyticsCollectionEnabled(false);
  } else {
    crashlytics().setCrashlyticsCollectionEnabled(true);
  }
}

/**
 * ユーザーIDを設定（クラッシュレポートに含める）
 */
export function setUserId(userId: string) {
  crashlytics().setUserId(userId);
}

/**
 * カスタム属性を設定
 */
export function setUserAttributes(attributes: Record<string, string>) {
  Object.entries(attributes).forEach(([key, value]) => {
    crashlytics().setAttribute(key, value);
  });
}

/**
 * 非致命的エラーを記録
 */
export function logError(error: Error, context?: string) {
  if (context) {
    crashlytics().log(context);
  }
  crashlytics().recordError(error);
}

/**
 * カスタムログを記録
 */
export function log(message: string) {
  crashlytics().log(message);
}

/**
 * テストクラッシュ（開発用）
 */
export function testCrash() {
  crashlytics().crash();
}
```

### Performance設定

```typescript
// lib/firebase/performance.ts
import perf from '@react-native-firebase/perf';

/**
 * カスタムトレースを開始
 */
export async function startTrace(traceName: string) {
  const trace = await perf().startTrace(traceName);
  return trace;
}

/**
 * HTTPメトリックを記録
 */
export async function measureHttpRequest(url: string, method: string) {
  const metric = await perf().newHttpMetric(url, method as 'GET' | 'POST' | 'PUT' | 'DELETE');
  return metric;
}

/**
 * アプリ起動時間を計測
 */
export async function measureAppStartup() {
  const trace = await perf().startTrace('app_startup');
  return trace;
}

/**
 * 画面遷移時間を計測
 */
export async function measureScreenTransition(screenName: string) {
  const trace = await perf().startTrace(`screen_${screenName}`);
  return trace;
}
```

### Error Boundary実装

```typescript
// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { logError } from '@/lib/firebase/crashlytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Crashlyticsにエラーを送信
    logError(error, `ErrorBoundary: ${errorInfo.componentStack}`);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>エラーが発生しました</Text>
          <Text style={styles.message}>
            申し訳ございません。予期しないエラーが発生しました。
          </Text>
          <Button title="再試行" onPress={this.handleRetry} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
});
```

### アプリへの統合

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initCrashlytics } from '@/lib/firebase/crashlytics';
import { measureAppStartup } from '@/lib/firebase/performance';

export default function RootLayout() {
  useEffect(() => {
    // Crashlytics初期化
    initCrashlytics();

    // アプリ起動時間計測
    const measureStartup = async () => {
      const trace = await measureAppStartup();
      // アプリが完全に読み込まれたら停止
      // 実際のタイミングは適宜調整
      setTimeout(() => trace.stop(), 1000);
    };
    measureStartup();
  }, []);

  return (
    <ErrorBoundary>
      {/* アプリのコンテンツ */}
    </ErrorBoundary>
  );
}
```

### Cloud Functions用ログ設定

```typescript
// functions/src/utils/logger.ts
import * as functions from 'firebase-functions';

export const logger = {
  info: (message: string, data?: object) => {
    functions.logger.info(message, data);
  },
  warn: (message: string, data?: object) => {
    functions.logger.warn(message, data);
  },
  error: (message: string, error?: Error, data?: object) => {
    functions.logger.error(message, { error: error?.message, stack: error?.stack, ...data });
  },
  debug: (message: string, data?: object) => {
    functions.logger.debug(message, data);
  },
};
```

## 注意事項

- 個人情報（メールアドレス、パスワード等）をログに出力しないこと
- 開発環境ではCrashlyticsを無効化して本番データを汚染しないようにすること
- パフォーマンストレースは適切なタイミングで停止すること（メモリリーク防止）
- ログレベルを適切に設定し、本番環境では過度なログ出力を避けること

## 見積もり

- 想定工数: 4-6時間
- 難易度: 中

## 進捗

- [ ] 未着手
