# 008 ホーム画面

## 概要

アプリのメイン画面（ホーム）を実装するチケットです。トレーニング開始ボタン、最近のトレーニング履歴、週次統計サマリーを表示し、ユーザーがすぐにトレーニングを開始できるようにします。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 005 React Native Paper UI基盤
- 010 ボトムナビゲーション

## 関連Commonチケット

- Common/011 セッション保存API（Phase 2で本格連携）

## 要件

### 機能要件

- FR-006: 画面遷移（ホーム画面からトレーニング画面への遷移）

### 非機能要件

- NFR-040: Material Design 3準拠のUI
- NFR-015: レスポンシブデザイン

## 受け入れ条件（Todo）

- [ ] `app/(app)/(tabs)/index.tsx` が実装されている
- [ ] ウェルカムメッセージが表示される（ユーザー名含む）
- [ ] 今日のセッション数が大きく表示される
- [ ] 週間進捗グラフが表示される（棒グラフ、7日分）
- [ ] 最近のトレーニング履歴カードが表示される（最大3件）
- [ ] トレーニング開始ボタンが配置されている
- [ ] 無料プランの場合、残り回数表示とアップグレードリンクが表示される
- [ ] ローディング状態の表示が実装されている
- [ ] エラーハンドリングが実装されている
- [ ] Pull-to-Refresh機能が実装されている

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-006
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - ホーム画面設計
- `docs/expo/specs/01_技術スタック_v1_0.md` - TanStack Query, Zustand使用方法

## 技術詳細

### 画面レイアウト

```
+-------------------------------+
|           ホーム               |
|                               |
|   こんにちは、[名前]さん!       |
|                               |
|  ============================  |
|  今日のセッション              |
|  ============================  |
|         [  3回  ]              |
|                               |
|  ============================  |
|  週間の進捗                    |
|  ============================  |
|  10+     #                    |
|    |   # #                    |
|   5+ # # # # #                |
|    | # # # # # # #            |
|   0+--------------            |
|    月 火 水 木 金 土 日         |
|                               |
|  ============================  |
|  直近の履歴                    |
|  ============================  |
| +---------------------------+ |
| | 15:30 | スクワット         | |
| | スコア: 85点 | 12回        | |
| +---------------------------+ |
| +---------------------------+ |
| | 14:00 | アームカール       | |
| | スコア: 78点 | 10回        | |
| +---------------------------+ |
|                               |
|   +-------------------------+ |
|   |  トレーニング開始         | |
|   +-------------------------+ |
|                               |
|  無料プラン: 残り 2回/3回      |
|  [プレミアムにアップグレード]   |
|                               |
+-------------------------------+
| [Home] [Training] [History] [Profile] |
+-------------------------------+
```

### app/(app)/(tabs)/index.tsx

**ホーム画面**

```typescript
import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, ProgressBar, Surface } from 'react-native-paper';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { WeeklyProgressChart } from '@/components/home/WeeklyProgressChart';
import { RecentSessionCard } from '@/components/home/RecentSessionCard';
import { LoadingOverlay } from '@/components/ui';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 今日のセッション数を取得
async function fetchTodaySessions(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    where('startTime', '>=', today)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.length;
}

// 最近のセッションを取得
async function fetchRecentSessions(userId: string) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    orderBy('startTime', 'desc'),
    limit(3)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 週間進捗を取得
async function fetchWeeklyProgress(userId: string) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    where('startTime', '>=', weekAgo)
  );

  const snapshot = await getDocs(q);

  // 曜日ごとにセッション数を集計
  const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // 月〜日
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const day = new Date(data.startTime.toDate()).getDay();
    // 日曜日を最後に調整（0=日 -> 6）
    const adjustedDay = day === 0 ? 6 : day - 1;
    weeklyData[adjustedDay]++;
  });

  return weeklyData;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const userId = user?.uid || '';

  // 今日のセッション数
  const {
    data: todaySessions = 0,
    isLoading: loadingToday,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ['sessions', 'today', userId],
    queryFn: () => fetchTodaySessions(userId),
    enabled: !!userId,
  });

  // 最近のセッション
  const {
    data: recentSessions = [],
    isLoading: loadingRecent,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: ['sessions', 'recent', userId],
    queryFn: () => fetchRecentSessions(userId),
    enabled: !!userId,
  });

  // 週間進捗
  const {
    data: weeklyProgress = [0, 0, 0, 0, 0, 0, 0],
    isLoading: loadingWeekly,
    refetch: refetchWeekly,
  } = useQuery({
    queryKey: ['sessions', 'weekly', userId],
    queryFn: () => fetchWeeklyProgress(userId),
    enabled: !!userId,
  });

  const isLoading = loadingToday || loadingRecent || loadingWeekly;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchToday(), refetchRecent(), refetchWeekly()]);
    setRefreshing(false);
  };

  const handleStartTraining = () => {
    router.push('/(app)/(tabs)/training');
  };

  const handleUpgrade = () => {
    router.push('/subscription/plans');
  };

  // 無料プランの残り回数（Phase 3で本格実装）
  const freeLimit = 3;
  const remainingFree = Math.max(0, freeLimit - todaySessions);
  const isPremium = false; // Phase 3で実装

  if (isLoading && !refreshing) {
    return <LoadingOverlay visible />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* ウェルカムメッセージ */}
      <Text variant="headlineSmall" style={styles.welcome}>
        こんにちは、{user?.displayName || 'ゲスト'}さん!
      </Text>

      {/* 今日のセッション */}
      <Card style={styles.card}>
        <Card.Title title="今日のセッション" />
        <Card.Content style={styles.sessionCountContainer}>
          <Text variant="displayLarge" style={styles.sessionCount}>
            {todaySessions}回
          </Text>
        </Card.Content>
      </Card>

      {/* 週間の進捗 */}
      <Card style={styles.card}>
        <Card.Title title="週間の進捗" />
        <Card.Content>
          <WeeklyProgressChart data={weeklyProgress} />
        </Card.Content>
      </Card>

      {/* 直近の履歴 */}
      <Card style={styles.card}>
        <Card.Title title="直近の履歴" />
        <Card.Content>
          {recentSessions.length > 0 ? (
            recentSessions.map((session: any) => (
              <RecentSessionCard key={session.id} session={session} />
            ))
          ) : (
            <Text style={styles.emptyText}>
              まだトレーニング記録がありません
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* トレーニング開始ボタン */}
      <Button
        mode="contained"
        onPress={handleStartTraining}
        style={styles.startButton}
        contentStyle={styles.startButtonContent}
      >
        トレーニング開始
      </Button>

      {/* 無料プラン制限表示（プレミアムでない場合） */}
      {!isPremium && (
        <Surface style={styles.freeLimitContainer}>
          <Text style={styles.freeLimitText}>
            無料プラン: 残り {remainingFree}回/{freeLimit}回
          </Text>
          <Button mode="text" onPress={handleUpgrade}>
            プレミアムにアップグレード
          </Button>
        </Surface>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  welcome: {
    marginBottom: 16,
    marginTop: 8,
  },
  card: {
    marginBottom: 16,
  },
  sessionCountContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  sessionCount: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 16,
  },
  startButton: {
    marginVertical: 16,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  freeLimitContainer: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  freeLimitText: {
    color: '#666',
    marginBottom: 8,
  },
});
```

### components/home/WeeklyProgressChart.tsx

**週間進捗グラフコンポーネント**

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface WeeklyProgressChartProps {
  data: number[];
}

const DAYS = ['月', '火', '水', '木', '金', '土', '日'];

export function WeeklyProgressChart({ data }: WeeklyProgressChartProps) {
  const maxValue = Math.max(...data, 1);

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        {data.map((value, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  { height: `${(value / maxValue) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.dayLabel}>{DAYS[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: 24,
    height: 100,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    backgroundColor: '#4CAF50',
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  dayLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
});
```

### components/home/RecentSessionCard.tsx

**最近のセッションカードコンポーネント**

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Divider } from 'react-native-paper';

interface Session {
  id: string;
  exerciseType: string;
  score: number;
  reps: number;
  startTime: { toDate: () => Date };
}

interface RecentSessionCardProps {
  session: Session;
}

const EXERCISE_NAMES: Record<string, string> = {
  squat: 'スクワット',
  pushup: 'プッシュアップ',
  armCurl: 'アームカール',
  sideRaise: 'サイドレイズ',
  shoulderPress: 'ショルダープレス',
};

export function RecentSessionCard({ session }: RecentSessionCardProps) {
  const startTime = session.startTime?.toDate() || new Date();
  const timeString = startTime.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const exerciseName = EXERCISE_NAMES[session.exerciseType] || session.exerciseType;

  return (
    <Surface style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.time}>{timeString}</Text>
        <Text style={styles.exercise}>{exerciseName}</Text>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>スコア: {session.score}点</Text>
        <Text style={styles.stat}>{session.reps}回</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  exercise: {
    fontSize: 16,
    fontWeight: '500',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontSize: 14,
    color: '#666',
  },
});
```

### Zustand Store（homeStore.ts）

**ホーム画面用の状態管理（オプション）**

```typescript
import { create } from 'zustand';

interface HomeState {
  todaySessions: number;
  weeklyProgress: number[];
  isLoading: boolean;
  setTodaySessions: (count: number) => void;
  setWeeklyProgress: (data: number[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  todaySessions: 0,
  weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
  isLoading: false,
  setTodaySessions: (count) => set({ todaySessions: count }),
  setWeeklyProgress: (data) => set({ weeklyProgress: data }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

- Phase 1では基本的なUI構造を実装し、データはモックまたはFirestoreから取得
- 週間進捗グラフはPhase 2でreact-native-chart-kitに置き換え可能
- 無料プラン制限はPhase 3で本格実装
- TanStack Queryを使用してサーバー状態を効率的に管理
- Pull-to-Refreshでデータの再取得が可能

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | チケット形式を統一して再作成 |
