# 015 ボトムナビゲーション実装

## 概要

メイン画面で使用するボトムナビゲーション（タブバー）を実装します。4つのタブ（ホーム、トレーニング、履歴、プロフィール）を持ち、認証済みユーザーのみがアクセスできるようにします。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 007: スプラッシュ画面実装
- 017: ルーティング設定（Expo Router）

## 要件

### タブ構成

| 順番 | アイコン | ラベル | 遷移先 | Phase |
|-----|---------|--------|--------|-------|
| 1 | Home | ホーム | /(tabs)/home | Phase 1 |
| 2 | Dumbbell | トレーニング | /(tabs)/training | Phase 2 |
| 3 | ChartBar | 履歴 | /(tabs)/history | Phase 2 |
| 4 | User | プロフィール | /(tabs)/profile | Phase 1 |

### デザイン仕様

| 項目 | 値 |
|-----|---|
| 高さ | 56px |
| 背景色 | 白 (#FFFFFF) |
| 選択時の色 | 緑 (#4CAF50) |
| 非選択時の色 | グレー (#757575) |
| アイコンサイズ | 24px |
| ラベルサイズ | 12px |

### 動作仕様

- タブをタップすると対応する画面に遷移
- 選択中のタブはアイコンとラベルが緑色にハイライト
- 非選択タブはグレー表示
- タブ切り替え時にアニメーション（フェード）

### 認証ガード

- 未ログインユーザーはタブ画面にアクセスできない
- 未ログイン時はログイン画面にリダイレクト
- 同意未完了ユーザーは利用規約同意画面にリダイレクト

## 受け入れ条件

- [ ] 4つのタブが表示される
- [ ] 各タブにアイコンとラベルが表示される
- [ ] タブをタップすると対応する画面に遷移する
- [ ] 選択中のタブがハイライトされる
- [ ] 未選択のタブがグレー表示される
- [ ] タブの高さが56pxである
- [ ] 未ログイン時にログイン画面へリダイレクトされる
- [ ] 同意未完了時に利用規約同意画面へリダイレクトされる
- [ ] iOSとAndroidで適切に表示される
- [ ] Safe Area（ノッチ、ホームインジケーター）を考慮した配置

## 参照ドキュメント

- [要件定義書 Part 1](../specs/01_要件定義書_Expo版_v1_Part1.md) - 画面構成
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - セクション1.2, 4.1

## 技術詳細

### Expo Router 実装

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { Redirect } from 'expo-router';

export default function TabLayout() {
  const { user, isLoading } = useAuthStore();

  // ローディング中
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 未ログイン
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // 同意未完了
  if (!user.tosAccepted || !user.ppAccepted) {
    return <Redirect href="/auth/agreement" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          height: 56,
          backgroundColor: '#FFFFFF',
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'トレーニング',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dumbbell" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'プロフィール',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### ディレクトリ構造

```
app/
├── (tabs)/
│   ├── _layout.tsx      # ボトムナビゲーションのレイアウト
│   ├── home.tsx         # ホーム画面
│   ├── training.tsx     # トレーニング画面（Phase 2）
│   ├── history.tsx      # 履歴画面（Phase 2）
│   └── profile.tsx      # プロフィール画面
```

### 使用ライブラリ

- `expo-router`: Tabs コンポーネント
- `@expo/vector-icons`: MaterialCommunityIcons

## 注意事項

- Phase 1ではホームとプロフィール画面のみ実装
- トレーニング・履歴画面はPhase 2で実装（プレースホルダー画面を配置）
- Safe Areaを考慮してiPhone X以降のホームインジケーターと重ならないようにする
- Android のナビゲーションバーとの干渉を避ける
- タブの切り替えはスムーズなアニメーションを伴うこと

## 見積もり

- 想定工数: 1日

## 進捗

- [ ] 未着手
