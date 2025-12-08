# 007 基本UIコンポーネント作成

## 概要

アプリ全体で使用する基本UIコンポーネントを作成します。React Native Paperをベースに、Material Design 3に準拠したテーマ設定と共通コンポーネントを実装します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [002 Expo開発環境構築](./002-dev-environment-setup.md)

## 要件

### 作成するコンポーネント

| コンポーネント | 用途 | 優先度 |
|---------------|------|--------|
| AppButton | 共通ボタン（プライマリ/セカンダリ/テキスト/危険） | 必須 |
| AppTextInput | テキスト入力フォーム | 必須 |
| AppCard | カード型コンテナ | 必須 |
| LoadingSpinner | ローディング表示 | 必須 |
| ErrorMessage | エラーメッセージ表示 | 必須 |
| Header | 画面ヘッダー | 必須 |
| SafeContainer | SafeAreaView付きコンテナ | 必須 |

### テーマ設定（Material Design 3）

#### カラーパレット

| 色 | 用途 | HEXコード |
|---|------|----------|
| プライマリ（緑） | メインアクション | #4CAF50 |
| セカンダリ（青） | リンク、情報 | #2196F3 |
| エラー（赤） | 警告、エラー | #F44336 |
| 成功（緑） | 成功メッセージ | #4CAF50 |
| 背景（白） | 背景色 | #FFFFFF |
| テキスト（黒） | メインテキスト | #212121 |
| サブテキスト（グレー） | 補足情報 | #757575 |

#### タイポグラフィ

| 要素 | フォントサイズ | 太さ |
|-----|---------------|------|
| 見出し1 | 24px | Bold |
| 見出し2 | 20px | Bold |
| 見出し3 | 18px | Semi-Bold |
| 本文 | 16px | Regular |
| キャプション | 14px | Regular |
| 小さい文字 | 12px | Regular |

#### スペーシング

- 基本単位: 8px
- 小: 8px
- 中: 16px
- 大: 24px
- 特大: 32px

## 受け入れ条件

- [ ] React Native Paperのテーマが設定されている
- [ ] AppButtonコンポーネントが作成されている
- [ ] AppTextInputコンポーネントが作成されている
- [ ] AppCardコンポーネントが作成されている
- [ ] LoadingSpinnerコンポーネントが作成されている
- [ ] ErrorMessageコンポーネントが作成されている
- [ ] Headerコンポーネントが作成されている
- [ ] SafeContainerコンポーネントが作成されている
- [ ] カラーパレットが定義されている
- [ ] タイポグラフィが定義されている
- [ ] 各コンポーネントがStorybook等でプレビュー可能（任意）

## 参照ドキュメント

- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - 5. デザインガイドライン

## 技術詳細

### テーマ設定

```typescript
// lib/theme/index.ts
import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  displayLarge: { fontSize: 24, fontWeight: '700' as const },
  displayMedium: { fontSize: 20, fontWeight: '700' as const },
  displaySmall: { fontSize: 18, fontWeight: '600' as const },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const },
  bodySmall: { fontSize: 12, fontWeight: '400' as const },
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#4CAF50',
    secondary: '#2196F3',
    error: '#F44336',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    onSurface: '#212121',
    onSurfaceVariant: '#757575',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export type AppTheme = typeof theme;
```

### AppButton コンポーネント

```typescript
// components/AppButton.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, ButtonProps } from 'react-native-paper';

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

interface AppButtonProps extends Omit<ButtonProps, 'mode'> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function AppButton({
  variant = 'primary',
  fullWidth = false,
  style,
  ...props
}: AppButtonProps) {
  const getMode = (): ButtonProps['mode'] => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return 'contained';
      case 'secondary':
        return 'outlined';
      case 'text':
        return 'text';
      default:
        return 'contained';
    }
  };

  const getButtonColor = () => {
    if (variant === 'danger') {
      return '#F44336';
    }
    return undefined;
  };

  return (
    <Button
      mode={getMode()}
      buttonColor={getButtonColor()}
      style={[fullWidth && styles.fullWidth, style]}
      contentStyle={styles.content}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  content: {
    paddingVertical: 8,
  },
});
```

### AppTextInput コンポーネント

```typescript
// components/AppTextInput.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, TextInputProps, HelperText } from 'react-native-paper';

interface AppTextInputProps extends TextInputProps {
  errorMessage?: string;
  helperText?: string;
}

export function AppTextInput({
  errorMessage,
  helperText,
  style,
  ...props
}: AppTextInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        error={!!errorMessage}
        style={[styles.input, style]}
        {...props}
      />
      {(errorMessage || helperText) && (
        <HelperText type={errorMessage ? 'error' : 'info'} visible>
          {errorMessage || helperText}
        </HelperText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
});
```

### AppCard コンポーネント

```typescript
// components/AppCard.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, CardProps } from 'react-native-paper';

interface AppCardProps extends CardProps {
  children: React.ReactNode;
}

export function AppCard({ children, style, ...props }: AppCardProps) {
  return (
    <Card style={[styles.card, style]} {...props}>
      {children}
    </Card>
  );
}

// サブコンポーネントをエクスポート
AppCard.Title = Card.Title;
AppCard.Content = Card.Content;
AppCard.Actions = Card.Actions;
AppCard.Cover = Card.Cover;

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
});
```

### LoadingSpinner コンポーネント

```typescript
// components/LoadingSpinner.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({
  message,
  size = 'large',
  fullScreen = false
}: LoadingSpinnerProps) {
  const content = (
    <>
      <ActivityIndicator size={size} color="#4CAF50" />
      {message && <Text style={styles.message}>{message}</Text>}
    </>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
});
```

### ErrorMessage コンポーネント

```typescript
// components/ErrorMessage.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Icon } from 'react-native-paper';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.container}>
      <Icon source="alert-circle" size={48} color="#F44336" />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <AppButton variant="secondary" onPress={onRetry}>
          再試行
        </AppButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  message: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#212121',
    textAlign: 'center',
  },
});
```

### SafeContainer コンポーネント

```typescript
// components/SafeContainer.tsx
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SafeContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SafeContainer({ children, style }: SafeContainerProps) {
  return (
    <SafeAreaView style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
```

### コンポーネントのエクスポート

```typescript
// components/index.ts
export { AppButton } from './AppButton';
export { AppTextInput } from './AppTextInput';
export { AppCard } from './AppCard';
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorMessage } from './ErrorMessage';
export { SafeContainer } from './SafeContainer';
export { ErrorBoundary } from './ErrorBoundary';
```

## 注意事項

- すべてのコンポーネントはアクセシビリティを考慮すること（accessibilityLabel等）
- タッチターゲットは最小44x44pxを確保すること
- コンポーネントは再利用性を考慮してpropsを設計すること
- 薬機法対応の表現ガイドラインに沿った文言を使用すること

## 見積もり

- 想定工数: 6-8時間
- 難易度: 中

## 進捗

- [ ] 未着手
