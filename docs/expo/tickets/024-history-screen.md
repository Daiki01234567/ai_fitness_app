# 024 履歴画面実装

## 概要

過去のトレーニング記録を一覧表示する履歴画面を実装します。種目別、日付別にフィルタリングでき、各セッションの詳細を確認できます。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/010: ボトムナビゲーション
- common/011: トレーニングセッション保存API（バックエンド）

## 要件

### 機能要件

- FR-007: トレーニング記録保存機能
- FR-008: トレーニング履歴閲覧機能

### 非機能要件

- NFR-019: レスポンシブデザイン対応
- NFR-026: オフライン対応（Firestoreキャッシュ利用）

## 受け入れ条件（Todo）

- [ ] トレーニング履歴が日付降順で表示される
- [ ] 各セッションのサマリー（種目、回数、スコア、日時）が表示される
- [ ] 種目別フィルター機能が動作する（全て、スクワット、プッシュアップ等）
- [ ] 日付範囲フィルター機能が動作する（今週、今月、全期間）
- [ ] セッションをタップすると詳細画面に遷移する
- [ ] 無限スクロール（ページネーション）が実装されている
- [ ] データがない場合は空状態メッセージが表示される
- [ ] 読み込み中はローディング表示が出る
- [ ] オフライン時はキャッシュデータが表示される

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-007, FR-008
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 履歴画面UI設計

## 技術詳細

### 画面構成

```
+----------------------------------+
| 履歴                              |
+----------------------------------+
| [全て▼] [今月▼]         [カレンダー] | ← フィルター
+----------------------------------+
| 2025/12/10 14:30                 |
| スクワット | 10回 | 85点           | ← セッションカード
| メモ: 良い調子                    |
+----------------------------------+
| 2025/12/09 10:15                 |
| プッシュアップ | 15回 | 78点        |
+----------------------------------+
| 2025/12/08 16:45                 |
| アームカール | 12回 | 90点          |
+----------------------------------+
| [さらに読み込む...]               | ← 無限スクロール
+----------------------------------+
```

### 使用ライブラリ

- **@react-native-firebase/firestore**: Firestoreクエリ
- **React Native Paper**: UIコンポーネント（Card, Chip, FAB）
- **@tanstack/react-query**: サーバー状態管理、キャッシング
- **Expo Router**: 画面遷移

### 主要コンポーネント

```typescript
// components/history/HistoryScreen.tsx

import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card, Chip, FAB } from 'react-native-paper';
import { fetchTrainingSessions } from '@/services/training/historyService';

export function HistoryScreen() {
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<'week' | 'month' | 'all'>('month');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['training-sessions', exerciseFilter, dateRangeFilter],
    queryFn: ({ pageParam = null }) =>
      fetchTrainingSessions({
        exerciseType: exerciseFilter,
        dateRange: dateRangeFilter,
        lastDoc: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) => lastPage.lastDoc,
  });

  const sessions = data?.pages.flatMap(page => page.sessions) ?? [];

  const handleSessionPress = (sessionId: string) => {
    router.push(`/history/${sessionId}`);
  };

  const handleCalendarPress = () => {
    router.push('/history/calendar');
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return <ErrorScreen message="履歴の読み込みに失敗しました" />;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        message="まだトレーニング記録がありません"
        actionLabel="トレーニングを始める"
        onActionPress={() => router.push('/training/menu')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FilterBar
        exerciseFilter={exerciseFilter}
        onExerciseFilterChange={setExerciseFilter}
        dateRangeFilter={dateRangeFilter}
        onDateRangeFilterChange={setDateRangeFilter}
        onCalendarPress={handleCalendarPress}
      />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => handleSessionPress(item.id)}
          />
        )}
        onEndReached={() => {
          if (hasNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasNextPage ? <ActivityIndicator /> : null
        }
      />

      <FAB
        icon="plus"
        label="トレーニング"
        onPress={() => router.push('/training/menu')}
        style={styles.fab}
      />
    </View>
  );
}
```

### セッションカードコンポーネント

```typescript
// components/history/SessionCard.tsx

import { Card, Text, Chip } from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface SessionCardProps {
  session: TrainingSession;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const exerciseLabel = getExerciseLabel(session.exerciseType);
  const scoreColor = getScoreColor(session.averageScore);

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="bodySmall">
            {formatDistanceToNow(session.createdAt.toDate(), {
              addSuffix: true,
              locale: ja
            })}
          </Text>
          <Chip
            mode="outlined"
            textStyle={{ color: scoreColor }}
          >
            {session.averageScore}点
          </Chip>
        </View>

        <Text variant="titleMedium">{exerciseLabel}</Text>

        <View style={styles.stats}>
          <Text>{session.reps}回</Text>
          <Text> • </Text>
          <Text>{formatDuration(session.duration)}</Text>
        </View>

        {session.memo && (
          <Text variant="bodySmall" numberOfLines={2}>
            メモ: {session.memo}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}
```

### フィルターバーコンポーネント

```typescript
// components/history/FilterBar.tsx

import { SegmentedButtons, Menu, IconButton } from 'react-native-paper';

export function FilterBar({
  exerciseFilter,
  onExerciseFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  onCalendarPress,
}) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.filterBar}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button onPress={() => setMenuVisible(true)}>
            {getExerciseLabel(exerciseFilter) || '全て'}
          </Button>
        }
      >
        <Menu.Item onPress={() => onExerciseFilterChange(null)} title="全て" />
        <Menu.Item onPress={() => onExerciseFilterChange('squat')} title="スクワット" />
        <Menu.Item onPress={() => onExerciseFilterChange('pushup')} title="プッシュアップ" />
        <Menu.Item onPress={() => onExerciseFilterChange('armcurl')} title="アームカール" />
        <Menu.Item onPress={() => onExerciseFilterChange('sideraise')} title="サイドレイズ" />
        <Menu.Item onPress={() => onExerciseFilterChange('shoulderpress')} title="ショルダープレス" />
      </Menu>

      <SegmentedButtons
        value={dateRangeFilter}
        onValueChange={onDateRangeFilterChange}
        buttons={[
          { value: 'week', label: '今週' },
          { value: 'month', label: '今月' },
          { value: 'all', label: '全期間' },
        ]}
      />

      <IconButton
        icon="calendar"
        onPress={onCalendarPress}
      />
    </View>
  );
}
```

### Firestoreクエリサービス

```typescript
// services/training/historyService.ts

import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { subWeeks, subMonths } from 'date-fns';

interface FetchSessionsParams {
  exerciseType?: string | null;
  dateRange: 'week' | 'month' | 'all';
  lastDoc?: any;
  limit: number;
}

export async function fetchTrainingSessions({
  exerciseType,
  dateRange,
  lastDoc,
  limit,
}: FetchSessionsParams) {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');

  let query = firestore()
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .orderBy('createdAt', 'desc');

  // 種目フィルター
  if (exerciseType) {
    query = query.where('exerciseType', '==', exerciseType);
  }

  // 日付範囲フィルター
  if (dateRange === 'week') {
    const weekAgo = subWeeks(new Date(), 1);
    query = query.where('createdAt', '>=', weekAgo);
  } else if (dateRange === 'month') {
    const monthAgo = subMonths(new Date(), 1);
    query = query.where('createdAt', '>=', monthAgo);
  }

  // ページネーション
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }

  query = query.limit(limit);

  const snapshot = await query.get();
  const sessions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    sessions,
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
  };
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] フィルター機能が正しく動作する
- [ ] セッションカードが正しく表示される
- [ ] 空状態が正しく表示される

### 統合テスト

- [ ] Firestoreクエリが正しく実行される
- [ ] ページネーションが正しく動作する
- [ ] オフライン時にキャッシュが使用される

### 実機テスト

- [ ] iPhone（iOS）で正しく表示される
- [ ] Android端末で正しく表示される
- [ ] 無限スクロールがスムーズに動作する

## 見積もり

- 工数: 3日
- 難易度: 中（Firestoreクエリ、無限スクロール）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- バックエンドのセッション保存API（common/011）が完了している必要あり
- カレンダー表示機能（expo/025）とグラフ表示機能（expo/026）への遷移を含む
- オフライン対応はFirestoreの自動キャッシュ機能を利用

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
