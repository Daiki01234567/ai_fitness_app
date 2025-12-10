# 010 ボトムナビゲーション

## 概要

Material Design 3準拠のボトムナビゲーション（タブバー）を実装し、アプリ内の主要画面間のナビゲーションを提供するチケットです。Expo Routerのタブ機能を使用します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 004 Expo Router設定
- 005 React Native Paper UI基盤

## 要件

### 機能要件

- FR-007: 画面遷移（ボトムナビゲーション）

### 非機能要件

- NFR-040: Material Design 3準拠のUI
- NFR-041: ダークモード対応

## 受け入れ条件（Todo）

- [x] `app/(app)/(tabs)/_layout.tsx` が実装されている
- [x] 4つのタブが表示されている（ホーム、トレーニング、履歴、設定）
- [x] MaterialCommunityIconsでアイコンが表示されている
- [x] アクティブ/非アクティブ状態でスタイルが切り替わる
- [x] ダーク/ライトモード対応
- [x] タブ切り替えが正常に動作する

## 参照ドキュメント

- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - 画面設計
- `docs/expo/specs/01_技術スタック_v1_0.md` - 技術仕様
- Expo Router Tabs: https://docs.expo.dev/router/advanced/tabs/

## 技術詳細

### タブ構成

| タブ | ファイル | アイコン（active） | アイコン（inactive） |
|-----|---------|-------------------|---------------------|
| ホーム | `index.tsx` | `home` | `home-outline` |
| トレーニング | `training.tsx` | `dumbbell` | `dumbbell` |
| 履歴 | `history.tsx` | `history` | `history` |
| 設定 | `settings.tsx` | `cog` | `cog-outline` |

### カラー定義

| 要素 | ライトモード | ダークモード |
|-----|------------|------------|
| アクティブタブ | `#4CAF50` | `#4CAF50` |
| 非アクティブタブ | `#999999` | `#999999` |
| 背景色 | `#FFFFFF` | `#121212` |
| ボーダー | `#E0E0E0` | `#333333` |

### app/(app)/(tabs)/_layout.tsx

**タブナビゲーションレイアウト**

```typescript
import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// テーマカラー定義
const THEME_COLORS = {
  primary: '#4CAF50',          // アクティブタブ色
  inactive: '#999999',         // 非アクティブタブ色
  backgroundLight: '#FFFFFF',  // ライトモード背景
  backgroundDark: '#121212',   // ダークモード背景
  textLight: '#212121',        // ライトモードテキスト
  textDark: '#FFFFFF',         // ダークモードテキスト
  borderLight: '#E0E0E0',      // ライトモードボーダー
  borderDark: '#333333',       // ダークモードボーダー
};

// タブバーアイコンコンポーネント
function TabBarIcon(props: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons
      size={props.size ?? 24}
      style={{ marginBottom: -3 }}
      {...props}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME_COLORS.primary,
        tabBarInactiveTintColor: THEME_COLORS.inactive,
        tabBarStyle: {
          backgroundColor: isDark
            ? THEME_COLORS.backgroundDark
            : THEME_COLORS.backgroundLight,
          borderTopColor: isDark
            ? THEME_COLORS.borderDark
            : THEME_COLORS.borderLight,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: isDark
            ? THEME_COLORS.backgroundDark
            : THEME_COLORS.backgroundLight,
        },
        headerTintColor: isDark
          ? THEME_COLORS.textDark
          : THEME_COLORS.textLight,
        headerShadowVisible: false,
      }}
    >
      {/* ホームタブ */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'home' : 'home-outline'}
              color={color}
            />
          ),
        }}
      />

      {/* トレーニングタブ */}
      <Tabs.Screen
        name="training"
        options={{
          title: 'トレーニング',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="dumbbell" color={color} />
          ),
        }}
      />

      {/* 履歴タブ */}
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="history" color={color} />
          ),
        }}
      />

      {/* 設定タブ */}
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'cog' : 'cog-outline'}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

### app/(app)/(tabs)/training.tsx

**トレーニング画面（プレースホルダー）**

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { router } from 'expo-router';

const EXERCISE_TYPES = [
  { id: 'squat', name: 'スクワット', icon: 'human' },
  { id: 'pushup', name: 'プッシュアップ', icon: 'arm-flex' },
  { id: 'armcurl', name: 'アームカール', icon: 'dumbbell' },
  { id: 'sideraise', name: 'サイドレイズ', icon: 'human-handsup' },
  { id: 'shoulderpress', name: 'ショルダープレス', icon: 'weight-lifter' },
];

export default function TrainingScreen() {
  const handleStartTraining = (exerciseId: string) => {
    // Phase 2で実装
    alert(`${exerciseId}トレーニングは準備中です`);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        トレーニングを選択
      </Text>

      {EXERCISE_TYPES.map((exercise) => (
        <Card
          key={exercise.id}
          style={styles.card}
          onPress={() => handleStartTraining(exercise.id)}
        >
          <Card.Title
            title={exercise.name}
            left={(props) => (
              <MaterialCommunityIcons
                name={exercise.icon as any}
                size={24}
                color="#4CAF50"
              />
            )}
            right={(props) => (
              <Button mode="contained" onPress={() => handleStartTraining(exercise.id)}>
                開始
              </Button>
            )}
          />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginBottom: 16,
    fontWeight: '600',
  },
  card: {
    marginBottom: 12,
  },
});
```

### app/(app)/(tabs)/history.tsx

**履歴画面（プレースホルダー）**

```typescript
import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SessionHistory {
  id: string;
  exerciseType: string;
  score: number;
  reps: number;
  duration: number;
  createdAt: Date;
}

const fetchSessionHistory = async (userId: string): Promise<SessionHistory[]> => {
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(sessionsRef, orderBy('createdAt', 'desc'), limit(20));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
  })) as SessionHistory[];
};

const EXERCISE_NAMES: Record<string, string> = {
  squat: 'スクワット',
  pushup: 'プッシュアップ',
  armcurl: 'アームカール',
  sideraise: 'サイドレイズ',
  shoulderpress: 'ショルダープレス',
};

export default function HistoryScreen() {
  const { user } = useAuthStore();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessionHistory', user?.uid],
    queryFn: () => fetchSessionHistory(user!.uid),
    enabled: !!user?.uid,
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          トレーニング履歴がありません
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtext}>
          トレーニングを始めましょう！
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">
              {EXERCISE_NAMES[item.exerciseType] || item.exerciseType}
            </Text>
            <View style={styles.statsRow}>
              <Text variant="bodyMedium">スコア: {item.score}点</Text>
              <Text variant="bodyMedium">レップ数: {item.reps}回</Text>
            </View>
            <Text variant="bodySmall" style={styles.date}>
              {item.createdAt?.toLocaleDateString('ja-JP')}
            </Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#666',
  },
  card: {
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  date: {
    marginTop: 8,
    color: '#666',
  },
});
```

### ディレクトリ構造

```
expo_app/app/(app)/(tabs)/
├── _layout.tsx      # タブナビゲーションレイアウト
├── index.tsx        # ホーム画面（チケット008）
├── training.tsx     # トレーニング選択画面
├── history.tsx      # 履歴画面
└── settings.tsx     # 設定画面（チケット009）
```

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 備考

- Expo RouterのTabs機能を使用してファイルベースのタブナビゲーションを実装
- MaterialCommunityIconsでアイコンを表示
- ダークモード対応済み
- トレーニング画面と履歴画面はPhase 2で詳細実装予定
- Badge表示（未読通知など）は将来実装予定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、標準フォーマットで再作成 |
