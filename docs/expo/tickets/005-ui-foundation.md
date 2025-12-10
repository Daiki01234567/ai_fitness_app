# 005 React Native Paper UI基盤

## 概要

React Native PaperによるMaterial Design 3準拠のUI基盤を構築するチケットです。テーマ設定、共通コンポーネントの作成、スタイルガイドの整備を行います。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 002 Expo開発環境セットアップ

## 要件

### 機能要件

- なし（UI基盤構築チケットのため）

### 非機能要件

- NFR-040: Material Design 3準拠のUI

## 受け入れ条件（Todo）

- [x] React Native Paperがインストールされている
- [x] カスタムテーマが実装されている（`lib/theme/index.ts`）
- [x] 共通コンポーネントが実装されている
  - [x] Button（プライマリ、セカンダリ）→ `AppButton.tsx`
  - [x] TextInput（アウトライン、フラット）→ `AppTextInput.tsx`
  - [x] Card（トレーニングカード、統計カード）→ `AppCard.tsx`
  - [ ] BottomSheet（メニュー表示用）→ Phase 2で実装予定
  - [x] LoadingOverlay（ローディング表示）→ `LoadingOverlay.tsx`
- [x] カラーパレットが定義されている
- [x] タイポグラフィが定義されている
- [x] スペーシング（余白）が定義されている

## 参照ドキュメント

- `docs/expo/specs/01_技術スタック_v1_0.md` - React Native Paper使用方法
- React Native Paper公式ドキュメント: https://callstack.github.io/react-native-paper/

## 技術詳細

### ディレクトリ構造

```
expo_app/
├── theme/
│   ├── index.ts           # テーマ定義
│   ├── colors.ts          # カラーパレット
│   ├── typography.ts      # タイポグラフィ
│   └── spacing.ts         # スペーシング
└── components/
    └── ui/
        ├── Button.tsx
        ├── TextInput.tsx
        ├── Card.tsx
        ├── BottomSheet.tsx
        └── LoadingOverlay.tsx
```

### theme/index.ts

**カスタムテーマ定義**

```typescript
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { colors } from './colors';

const fontConfig = {
  displayLarge: {
    fontFamily: 'System',
    fontSize: 57,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 64,
  },
  // ... 他のフォント設定
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    error: colors.error,
    background: colors.background,
    surface: colors.surface,
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primaryDark,
    secondary: colors.secondaryDark,
    error: colors.errorDark,
    background: colors.backgroundDark,
    surface: colors.surfaceDark,
  },
  fonts: configureFonts({ config: fontConfig }),
};
```

### theme/colors.ts

**カラーパレット**

```typescript
export const colors = {
  // プライマリカラー（グリーン）
  primary: '#4CAF50',
  primaryLight: '#81C784',
  primaryDark: '#388E3C',

  // セカンダリカラー（ブルー）
  secondary: '#2196F3',
  secondaryLight: '#64B5F6',
  secondaryDark: '#1976D2',

  // エラーカラー（レッド）
  error: '#F44336',
  errorLight: '#E57373',
  errorDark: '#D32F2F',

  // 背景色
  background: '#FFFFFF',
  backgroundDark: '#121212',

  // サーフェス色
  surface: '#F5F5F5',
  surfaceDark: '#1E1E1E',

  // テキスト色
  text: '#333333',
  textSecondary: '#666666',
  textDisabled: '#999999',
  textDark: '#FFFFFF',
  textSecondaryDark: '#CCCCCC',

  // ボーダー色
  border: '#E0E0E0',
  borderDark: '#424242',
};
```

### theme/spacing.ts

**スペーシング**

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### components/ui/Button.tsx

**カスタムボタンコンポーネント**

```typescript
import React from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ variant = 'primary', ...props }: CustomButtonProps) {
  const mode = variant === 'outline' ? 'outlined' : 'contained';
  const buttonColor = variant === 'secondary' ? 'secondary' : 'primary';

  return (
    <PaperButton
      mode={mode}
      buttonColor={buttonColor}
      style={{ borderRadius: 8 }}
      {...props}
    />
  );
}
```

### components/ui/TextInput.tsx

**カスタムテキスト入力コンポーネント**

```typescript
import React from 'react';
import { TextInput as PaperTextInput, TextInputProps } from 'react-native-paper';

interface CustomTextInputProps extends TextInputProps {
  errorMessage?: string;
}

export function TextInput({ errorMessage, ...props }: CustomTextInputProps) {
  return (
    <>
      <PaperTextInput
        mode="outlined"
        error={!!errorMessage}
        style={{ marginBottom: 8 }}
        {...props}
      />
      {errorMessage && (
        <Text style={{ color: 'red', fontSize: 12 }}>{errorMessage}</Text>
      )}
    </>
  );
}
```

### components/ui/Card.tsx

**カスタムカードコンポーネント**

```typescript
import React from 'react';
import { Card as PaperCard, CardProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';

export function Card({ style, ...props }: CardProps) {
  return (
    <PaperCard
      style={[styles.card, style]}
      elevation={2}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 16,
  },
});
```

### app/_layout.tsx への統合

```typescript
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '@/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <Slot />
    </PaperProvider>
  );
}
```

### 使用例

```typescript
import { Button, TextInput, Card } from '@/components/ui';

function LoginScreen() {
  return (
    <View>
      <Card>
        <Card.Content>
          <TextInput
            label="メールアドレス"
            placeholder="example@example.com"
          />
          <TextInput
            label="パスワード"
            secureTextEntry
          />
          <Button variant="primary" onPress={handleLogin}>
            ログイン
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}
```

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了（BottomSheet以外）

## 完了日

2025-12-10（部分完了: BottomSheetはPhase 2で実装予定）

## 備考

- Material Design 3準拠のUIコンポーネントを使用
- テーマはライト/ダークモード対応
- 共通コンポーネントは段階的に追加していく
- カスタマイズ性を保つため、React Native Paperのコンポーネントをラップする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
