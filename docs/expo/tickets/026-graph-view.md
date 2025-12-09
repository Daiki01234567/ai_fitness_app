# 026 グラフ表示機能

## 概要

トレーニングの進捗をグラフで可視化する機能を実装します。スコアの推移、種目別の回数推移、週間・月間の統計情報を視覚的に表示します。

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

- [ ] スコア推移の折れ線グラフが表示される
- [ ] 種目別の回数推移の棒グラフが表示される
- [ ] 週間・月間の統計サマリーが表示される
- [ ] 期間フィルター（週、月、3ヶ月、全期間）が機能する
- [ ] 種目フィルター（全て、個別種目）が機能する
- [ ] グラフをタップすると該当日の詳細が表示される
- [ ] データがない場合は空状態メッセージが表示される
- [ ] 横スクロールで長期間のデータを閲覧できる

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-008
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - グラフ画面UI設計

## 技術詳細

### 画面構成

```
+----------------------------------+
| 進捗グラフ                        |
+----------------------------------+
| [週▼] [全て▼]                    | ← フィルター
+----------------------------------+
| 統計サマリー                      |
| 平均スコア: 82点                  |
| 総回数: 150回                     |
| トレーニング日数: 12日             |
+----------------------------------+
| スコア推移                        |
| 100 ┤                            |
|  80 ┤    ●──●                    | ← 折れ線グラフ
|  60 ┤  ●──     ●                 |
|  40 ┤                            |
|   0 └─────────────               |
+----------------------------------+
| 回数推移（種目別）                |
|     ███                          | ← 棒グラフ
|     ███  ██                      |
|  ██ ███  ██  ███                 |
| 12/5 12/7 12/9 12/10             |
+----------------------------------+
```

### 使用ライブラリ

- **react-native-chart-kit**: グラフ描画
- **@react-native-firebase/firestore**: データ取得
- **React Native Paper**: UIコンポーネント（Card, SegmentedButtons）
- **@tanstack/react-query**: データキャッシング
- **date-fns**: 日付処理

### インストール

```bash
npm install react-native-chart-kit react-native-svg
```

### 主要コンポーネント

```typescript
// components/history/GraphView.tsx

import { LineChart, BarChart } from 'react-native-chart-kit';
import { useQuery } from '@tanstack/react-query';
import { Card, SegmentedButtons } from 'react-native-paper';
import { fetchGraphData } from '@/services/training/historyService';

export function GraphView() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3months' | 'all'>('month');
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['graph-data', dateRange, exerciseFilter],
    queryFn: () => fetchGraphData({ dateRange, exerciseType: exerciseFilter }),
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!data || data.sessions.length === 0) {
    return (
      <EmptyState
        message="表示するデータがありません"
        actionLabel="トレーニングを始める"
        onActionPress={() => router.push('/training/menu')}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        exerciseFilter={exerciseFilter}
        onExerciseFilterChange={setExerciseFilter}
      />

      <StatsCard stats={data.stats} />

      <ScoreLineChart data={data.scoreData} />

      <RepsBarChart data={data.repsData} />
    </ScrollView>
  );
}
```

### 統計サマリーカード

```typescript
// components/history/StatsCard.tsx

import { Card, Text } from 'react-native-paper';

interface StatsCardProps {
  stats: {
    averageScore: number;
    totalReps: number;
    trainingDays: number;
  };
}

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">統計サマリー</Text>

        <View style={styles.statsGrid}>
          <StatItem
            label="平均スコア"
            value={`${stats.averageScore.toFixed(1)}点`}
            color={getScoreColor(stats.averageScore)}
          />
          <StatItem
            label="総回数"
            value={`${stats.totalReps}回`}
          />
          <StatItem
            label="トレーニング日数"
            value={`${stats.trainingDays}日`}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

function StatItem({ label, value, color }: any) {
  return (
    <View style={styles.statItem}>
      <Text variant="bodySmall">{label}</Text>
      <Text variant="titleLarge" style={{ color }}>{value}</Text>
    </View>
  );
}
```

### スコア推移折れ線グラフ

```typescript
// components/history/ScoreLineChart.tsx

import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Card, Text } from 'react-native-paper';

interface ScoreLineChartProps {
  data: {
    labels: string[];
    datasets: [{ data: number[] }];
  };
}

export function ScoreLineChart({ data }: ScoreLineChartProps) {
  const screenWidth = Dimensions.get('window').width;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">スコア推移</Text>

        <LineChart
          data={data}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#6200ee',
            },
          }}
          bezier
          style={styles.chart}
        />
      </Card.Content>
    </Card>
  );
}
```

### 回数推移棒グラフ

```typescript
// components/history/RepsBarChart.tsx

import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Card, Text } from 'react-native-paper';

interface RepsBarChartProps {
  data: {
    labels: string[];
    datasets: [{ data: number[] }];
  };
}

export function RepsBarChart({ data }: RepsBarChartProps) {
  const screenWidth = Dimensions.get('window').width;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">回数推移（種目別）</Text>

        <BarChart
          data={data}
          width={screenWidth - 40}
          height={220}
          yAxisLabel=""
          yAxisSuffix="回"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
          }}
          style={styles.chart}
        />
      </Card.Content>
    </Card>
  );
}
```

### グラフデータ取得サービス

```typescript
// services/training/historyService.ts

import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { subWeeks, subMonths, format } from 'date-fns';

interface FetchGraphDataParams {
  dateRange: 'week' | 'month' | '3months' | 'all';
  exerciseType?: string | null;
}

export async function fetchGraphData({
  dateRange,
  exerciseType,
}: FetchGraphDataParams) {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');

  let startDate: Date | null = null;

  switch (dateRange) {
    case 'week':
      startDate = subWeeks(new Date(), 1);
      break;
    case 'month':
      startDate = subMonths(new Date(), 1);
      break;
    case '3months':
      startDate = subMonths(new Date(), 3);
      break;
    case 'all':
      startDate = null;
      break;
  }

  let query = firestore()
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .orderBy('createdAt', 'asc');

  if (startDate) {
    query = query.where('createdAt', '>=', startDate);
  }

  if (exerciseType) {
    query = query.where('exerciseType', '==', exerciseType);
  }

  const snapshot = await query.get();
  const sessions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // グラフデータ整形
  const labels = sessions.map(s =>
    format(s.createdAt.toDate(), 'M/d')
  );
  const scoreData = sessions.map(s => s.averageScore);
  const repsData = sessions.map(s => s.reps);

  // 統計計算
  const stats = {
    averageScore: scoreData.reduce((a, b) => a + b, 0) / scoreData.length || 0,
    totalReps: repsData.reduce((a, b) => a + b, 0),
    trainingDays: sessions.length,
  };

  return {
    sessions,
    scoreData: {
      labels,
      datasets: [{ data: scoreData }],
    },
    repsData: {
      labels,
      datasets: [{ data: repsData }],
    },
    stats,
  };
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] グラフデータ整形ロジックが正しい
- [ ] 統計計算が正しい
- [ ] 空データ処理が正しい

### 統合テスト

- [ ] グラフデータ取得が正しく動作する
- [ ] フィルター変更時にグラフが更新される
- [ ] 期間フィルターが正しく動作する

### 実機テスト

- [ ] iPhone（iOS）でグラフが正しく表示される
- [ ] Android端末でグラフが正しく表示される
- [ ] 横スクロールがスムーズに動作する

## 見積もり

- 工数: 3日
- 難易度: 中（react-native-chart-kit統合、データ整形）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- expo/024（履歴画面実装）が完了している必要あり
- グラフライブラリは react-native-chart-kit を使用
- 長期間データの場合は横スクロールで対応

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
