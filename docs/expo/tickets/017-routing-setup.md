# 017 ルーティング設定（Expo Router）

## 概要

Expo Routerを使用したファイルベースルーティングを設定します。認証状態に応じたルートガード、画面遷移アニメーション、ディープリンク対応などを実装します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 002: Firebase基盤構築

## 要件

### ルーティング構造

```
app/
├── _layout.tsx              # ルートレイアウト（Provider設定）
├── index.tsx                # エントリーポイント（スプラッシュへリダイレクト）
├── (splash)/
│   └── index.tsx            # スプラッシュ画面
├── onboarding/
│   └── index.tsx            # オンボーディング画面
├── auth/
│   ├── _layout.tsx          # 認証フロー用レイアウト
│   ├── login.tsx            # ログイン画面
│   ├── register.tsx         # 新規登録画面
│   ├── agreement.tsx        # 利用規約同意画面
│   └── forgot-password.tsx  # パスワードリセット画面
├── (tabs)/
│   ├── _layout.tsx          # タブナビゲーション（認証ガード付き）
│   ├── home.tsx             # ホーム画面
│   ├── training.tsx         # トレーニング画面（Phase 2）
│   ├── history.tsx          # 履歴画面（Phase 2）
│   └── profile.tsx          # プロフィール画面
├── training/                 # Phase 2で実装
│   ├── setup.tsx            # カメラ設定画面
│   ├── session.tsx          # トレーニング実行画面
│   └── result.tsx           # セッション結果画面
├── settings/
│   └── index.tsx            # 設定画面
└── subscription/            # Phase 3で実装
    ├── plans.tsx            # 課金画面
    └── manage.tsx           # サブスクリプション管理画面
```

### 認証ガード

認証状態に応じて自動的にリダイレクト:

| 状態 | 遷移先 |
|-----|-------|
| 未ログイン + 初回起動 | オンボーディング画面 |
| 未ログイン + 2回目以降 | ログイン画面 |
| ログイン済み + 同意未完了 | 利用規約同意画面 |
| ログイン済み + 同意済み | ホーム画面 |
| 削除予約中 | 特別な警告表示付きで制限モード |

### 画面遷移アニメーション

| 遷移パターン | アニメーション |
|------------|--------------|
| スタック遷移（push） | スライドイン（右から左） |
| モーダル表示 | ボトムシート（下から上） |
| タブ切り替え | フェード |
| 認証フロー | フェード |

### ディープリンク対応

将来の拡張に備えてディープリンクスキームを設定:
- `aifitness://` スキーム
- ユニバーサルリンク対応準備

## 受け入れ条件

- [ ] ファイルベースルーティングが機能する
- [ ] 未ログイン時にログイン画面へリダイレクトされる
- [ ] ログイン済み・同意未完了時に利用規約同意画面へリダイレクトされる
- [ ] ログイン済み・同意済み時にホーム画面が表示される
- [ ] タブナビゲーションが正しく機能する
- [ ] スタック遷移がスライドアニメーションで行われる
- [ ] 戻るボタン・ジェスチャーが正しく機能する
- [ ] 認証状態の変更が即座にルーティングに反映される
- [ ] Phase 2/3用のルートがプレースホルダーとして存在する

## 参照ドキュメント

- [要件定義書 Part 3](../specs/03_要件定義書_Expo版_v1_Part3.md) - システムアーキテクチャ
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - セクション2, 6

## 技術詳細

### ルートレイアウト（_layout.tsx）

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initAuthListener } from '@/stores/authStore';
import { theme } from '@/lib/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    initAuthListener();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(splash)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="auth"
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="training" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="subscription" />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
```

### タブレイアウト（認証ガード付き）

```typescript
// app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function TabLayout() {
  const { user, userData, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  if (!userData?.tosAccepted || !userData?.ppAccepted) {
    return <Redirect href="/auth/agreement" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#757575',
        headerShown: false,
      }}
    >
      {/* タブ設定 */}
    </Tabs>
  );
}
```

### スプラッシュ画面からの初期ルーティング

```typescript
// app/(splash)/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';

export default function SplashScreen() {
  const { user, userData, isLoading } = useAuthStore();

  useEffect(() => {
    const checkInitialRoute = async () => {
      if (isLoading) return;

      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

      if (!user) {
        // 未ログイン
        if (!hasSeenOnboarding) {
          router.replace('/onboarding');
        } else {
          router.replace('/auth/login');
        }
      } else {
        // ログイン済み
        if (!userData?.tosAccepted || !userData?.ppAccepted) {
          router.replace('/auth/agreement');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    };

    checkInitialRoute();
  }, [user, userData, isLoading]);

  return <SplashUI />;
}
```

### app.json の設定

```json
{
  "expo": {
    "scheme": "aifitness",
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

## 注意事項

- Phase 1では実装しない画面もルートファイルを作成し、「準備中」プレースホルダーを表示
- `router.replace()` を使用して認証リダイレクト時に戻るスタックを残さない
- 認証状態のローディング中は必ずローディング画面を表示
- 型安全なルーティングのため、`expo-router` の typed routes を有効化

## 見積もり

- 想定工数: 1〜2日

## 進捗

- [ ] 未着手
