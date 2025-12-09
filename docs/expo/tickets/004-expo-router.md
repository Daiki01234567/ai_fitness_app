# 004 Expo Router設定

## 概要

Expo Routerを使用したファイルベースルーティングを設定するチケットです。認証状態に応じた画面遷移制御、タブナビゲーション、スタック間の遷移を実装します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 002 Expo開発環境セットアップ

## 要件

### 機能要件

- FR-006: 画面遷移（15画面）

### 非機能要件

- NFR-036: Expo Routerの使用

## 受け入れ条件（Todo）

- [x] `app/_layout.tsx` にルートレイアウトが実装されている
- [x] `app/(auth)/_layout.tsx` に認証画面グループが実装されている
- [x] `app/(app)/_layout.tsx` にアプリ画面グループが実装されている
- [x] `app/(app)/(tabs)/_layout.tsx` にタブナビゲーションが実装されている
- [x] 認証状態に応じたリダイレクト処理が実装されている
- [x] 深いリンク（Deep Link）が動作する
- [x] 404エラー画面が実装されている
- [x] ナビゲーションのTypeScript型定義が完全である

## 参照ドキュメント

- `docs/expo/specs/01_技術スタック_v1_0.md` - Expo Router使用方法
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 画面遷移設計
- Expo Router公式ドキュメント: https://docs.expo.dev/router/introduction/

## 技術詳細

### ディレクトリ構造

```
app/
├── _layout.tsx                 # ルートレイアウト
├── index.tsx                   # スプラッシュ画面
├── +html.tsx                   # HTMLカスタマイズ
├── +not-found.tsx              # 404エラー画面
├── (auth)/                     # 認証画面グループ
│   ├── _layout.tsx
│   ├── login.tsx               # ログイン
│   ├── signup.tsx              # 新規登録
│   └── forgot-password.tsx     # パスワードリセット
├── (app)/                      # アプリ画面グループ
│   ├── _layout.tsx
│   └── (tabs)/                 # タブナビゲーション
│       ├── _layout.tsx
│       ├── index.tsx           # ホーム画面
│       ├── training.tsx        # トレーニング画面
│       ├── history.tsx         # 履歴画面
│       └── settings.tsx        # 設定画面
└── onboarding/                 # オンボーディング
    ├── _layout.tsx
    └── index.tsx
```

### app/_layout.tsx

**ルートレイアウト（認証制御）**

```typescript
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!isAuthenticated && inAppGroup) {
      // 未ログインでアプリ画面にいる場合 → ログイン画面へ
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // ログイン済みで認証画面にいる場合 → ホーム画面へ
      router.replace('/(app)/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  return <Slot />;
}
```

### app/(app)/(tabs)/_layout.tsx

**タブナビゲーション**

```typescript
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'トレーニング',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dumbbell" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### ナビゲーション例

```typescript
import { router } from 'expo-router';

// 画面遷移
router.push('/training/session'); // スタックに追加
router.replace('/auth/login');    // 置き換え
router.back();                    // 戻る

// パラメータ付き遷移
router.push({
  pathname: '/training/result',
  params: { sessionId: '123', score: 85 },
});
```

### Deep Link設定

**app.json**

```json
{
  "expo": {
    "scheme": "aifitness",
    "web": {
      "bundler": "metro"
    }
  }
}
```

**使用例**

```bash
# アプリを開く
aifitness://

# ログイン画面を開く
aifitness://auth/login

# トレーニング画面を開く
aifitness://app/training
```

### TypeScript型定義

```typescript
// types/navigation.ts
export type RootStackParamList = {
  '(auth)/login': undefined;
  '(auth)/signup': undefined;
  '(auth)/forgot-password': undefined;
  '(app)/(tabs)': undefined;
  '(app)/training/session': { exerciseType: string };
  '(app)/training/result': { sessionId: string; score: number };
};
```

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月9日

## 備考

- ファイルベースルーティングが実装済み
- 認証状態に応じたリダイレクト処理が実装済み
- タブナビゲーションが実装済み
- 404エラー画面が実装済み
- Deep Linkは将来のプッシュ通知で使用予定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、完了ステータスに更新 |
