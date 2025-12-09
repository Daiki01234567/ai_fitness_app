# 025 カレンダー表示機能

## 概要

トレーニング記録をカレンダー形式で表示する機能を実装します。月別にトレーニング実施日を視覚的に確認でき、日付をタップするとその日の記録一覧を表示します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/024: 履歴画面実装

## 要件

### 機能要件

- FR-008: トレーニング履歴閲覧機能

### 非機能要件

- NFR-019: レスポンシブデザイン対応

## 受け入れ条件（Todo）

- [ ] 月別カレンダーが表示される
- [ ] トレーニング実施日にマーカー（ドット）が表示される
- [ ] 日付をタップするとその日のセッション一覧が表示される
- [ ] 前月・次月への移動ができる
- [ ] 今日の日付が強調表示される
- [ ] セッション数が多い日は複数のドットで表現される
- [ ] データがない月は空カレンダーが表示される
- [ ] カレンダーから履歴画面に戻れる

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-008
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - カレンダー画面UI設計

## 技術詳細

### 画面構成

```
+----------------------------------+
| [<] 2025年12月           [>]     | ← 月選択
+----------------------------------+
| 日  月  火  水  木  金  土        | ← 曜日ヘッダー
+----------------------------------+
| 1   2   3   4   5   6   7       |
|         ●       ●               | ← トレーニング実施日
| 8   9  10  11  12  13  14       |
|     ●  ●●       ●               | ← ●: 1セッション、●●: 2セッション
| 15  16  17  18  19  20  21      |
|             ●                   |
| 22  23  24  25  26  27  28      |
|                                 |
| 29  30  31                      |
+----------------------------------+
| 2025/12/10 のトレーニング        | ← 選択日の詳細
| • スクワット | 10回 | 85点        |
| • プッシュアップ | 15回 | 78点     |
+----------------------------------+
```

### 使用ライブラリ

- **react-native-calendars**: カレンダーUI
- **@react-native-firebase/firestore**: セッションデータ取得
- **React Native Paper**: UIコンポーネント（Card, List）
- **@tanstack/react-query**: データキャッシング

### インストール

```bash
npm install react-native-calendars
```

### 主要コンポーネント

```typescript
// components/history/CalendarView.tsx

import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useQuery } from '@tanstack/react-query';
import { Card, List } from 'react-native-paper';
import { fetchMonthSessions } from '@/services/training/historyService';

// 日本語ロケール設定
LocaleConfig.locales['ja'] = {
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: '今日',
};
LocaleConfig.defaultLocale = 'ja';

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().split('T')[0].substring(0, 7)
  );

  // 月別セッションデータ取得
  const { data: monthSessions, isLoading } = useQuery({
    queryKey: ['month-sessions', currentMonth],
    queryFn: () => fetchMonthSessions(currentMonth),
  });

  // マーカー作成（日付ごとのドット表示）
  const markedDates = useMemo(() => {
    if (!monthSessions) return {};

    const marked: any = {};

    monthSessions.forEach((session: any) => {
      const date = session.date;
      if (!marked[date]) {
        marked[date] = { dots: [] };
      }
      marked[date].dots.push({
        color: getExerciseColor(session.exerciseType),
      });
    });

    // 選択日をハイライト
    if (marked[selectedDate]) {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = '#6200ee';
    } else {
      marked[selectedDate] = { selected: true, selectedColor: '#6200ee' };
    }

    return marked;
  }, [monthSessions, selectedDate]);

  // 選択日のセッション取得
  const selectedDaySessions = useMemo(() => {
    if (!monthSessions) return [];
    return monthSessions.filter((s: any) => s.date === selectedDate);
  }, [monthSessions, selectedDate]);

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const handleMonthChange = (month: any) => {
    setCurrentMonth(month.dateString.substring(0, 7));
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          todayTextColor: '#6200ee',
          selectedDayBackgroundColor: '#6200ee',
          dotColor: '#6200ee',
          arrowColor: '#6200ee',
        }}
      />

      <View style={styles.sessionList}>
        <Text variant="titleMedium">
          {selectedDate} のトレーニング
        </Text>

        {selectedDaySessions.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            この日はトレーニングがありません
          </Text>
        ) : (
          <FlatList
            data={selectedDaySessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SessionListItem
                session={item}
                onPress={() => router.push(`/history/${item.id}`)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
```

### セッションリストアイテム

```typescript
// components/history/SessionListItem.tsx

import { List, Chip } from 'react-native-paper';

interface SessionListItemProps {
  session: TrainingSession;
  onPress: () => void;
}

export function SessionListItem({ session, onPress }: SessionListItemProps) {
  const exerciseLabel = getExerciseLabel(session.exerciseType);
  const scoreColor = getScoreColor(session.averageScore);

  return (
    <List.Item
      title={exerciseLabel}
      description={`${session.reps}回 • ${formatDuration(session.duration)}`}
      left={(props) => (
        <List.Icon
          {...props}
          icon={getExerciseIcon(session.exerciseType)}
          color={getExerciseColor(session.exerciseType)}
        />
      )}
      right={() => (
        <Chip
          mode="outlined"
          textStyle={{ color: scoreColor }}
        >
          {session.averageScore}点
        </Chip>
      )}
      onPress={onPress}
    />
  );
}
```

### 月別セッション取得サービス

```typescript
// services/training/historyService.ts

import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function fetchMonthSessions(month: string) {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = startOfMonth(new Date(year, monthNum - 1));
  const endDate = endOfMonth(new Date(year, monthNum - 1));

  const snapshot = await firestore()
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    date: doc.data().createdAt.toDate().toISOString().split('T')[0],
    ...doc.data(),
  }));
}
```

### ユーティリティ関数

```typescript
// utils/exerciseUtils.ts

export function getExerciseColor(exerciseType: string): string {
  const colors = {
    squat: '#4CAF50',
    pushup: '#2196F3',
    armcurl: '#FF9800',
    sideraise: '#9C27B0',
    shoulderpress: '#F44336',
  };
  return colors[exerciseType] || '#757575';
}

export function getExerciseIcon(exerciseType: string): string {
  const icons = {
    squat: 'human',
    pushup: 'arm-flex',
    armcurl: 'dumbbell',
    sideraise: 'weight-lifter',
    shoulderpress: 'weight',
  };
  return icons[exerciseType] || 'dumbbell';
}

export function getExerciseLabel(exerciseType: string): string {
  const labels = {
    squat: 'スクワット',
    pushup: 'プッシュアップ',
    armcurl: 'アームカール',
    sideraise: 'サイドレイズ',
    shoulderpress: 'ショルダープレス',
  };
  return labels[exerciseType] || exerciseType;
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] マーカー生成ロジックが正しい
- [ ] 日付フォーマットが正しい
- [ ] 種目別の色分けが正しい

### 統合テスト

- [ ] 月別セッション取得が正しく動作する
- [ ] 日付選択時に正しいセッションが表示される
- [ ] 前月・次月への移動が正しく動作する

### 実機テスト

- [ ] iPhone（iOS）で正しく表示される
- [ ] Android端末で正しく表示される
- [ ] タップ操作がスムーズに動作する

## 見積もり

- 工数: 2日
- 難易度: 中（react-native-calendars統合）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- expo/024（履歴画面実装）が完了している必要あり
- カレンダーライブラリは react-native-calendars を使用
- 種目ごとにドットの色を変えることで視覚的に分かりやすく表現

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
