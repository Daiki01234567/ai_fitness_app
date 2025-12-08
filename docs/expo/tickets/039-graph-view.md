# 039 グラフ表示機能

## 概要

ユーザーのトレーニング統計を視覚的に表示するグラフ機能を実装します。7日間の運動時間グラフと30日間の運動頻度グラフを表示し、ユーザーがトレーニングの進捗を直感的に把握できるようにします。

## Phase

Phase 2（機能実装）

## 依存チケット

- 037: 履歴画面実装

## 要件

### グラフの種類

#### 1. 7日間の運動時間グラフ（棒グラフ）

過去7日間の日別運動時間を棒グラフで表示します。

**表示内容**:
- X軸: 曜日（月〜日）
- Y軸: 運動時間（分）
- 各棒にその日の運動時間を表示
- 今日の棒は強調表示
- 7日間の合計運動時間を表示

**デザイン仕様**:
- 棒の色: プライマリカラー（#3B82F6）
- 今日の棒: より濃い色または別色
- 運動していない日は棒を表示しない（または薄い色）

#### 2. 30日間の運動頻度グラフ（折れ線グラフ）

過去30日間の週ごとの運動回数を折れ線グラフで表示します。

**表示内容**:
- X軸: 週（4週間分）
- Y軸: 運動回数（セッション数）
- データポイントにマーカーを表示
- 30日間の平均運動回数を表示

**デザイン仕様**:
- 線の色: プライマリカラー（#3B82F6）
- 塗りつぶし: グラデーション（透明→プライマリカラー）
- マーカー: 円形

### 追加の統計情報

グラフと一緒に以下の統計情報を表示します：

| 項目 | 説明 |
|-----|------|
| 今週の運動時間 | 今週の合計運動時間 |
| 先週比 | 先週との比較（%） |
| 平均スコア | 期間内の平均スコア |
| 最もやった種目 | 最も多く実施した種目 |

### 期間切り替え

ユーザーが表示期間を切り替えられるようにします：

- 7日間（デフォルト）
- 30日間
- 90日間

## 受け入れ条件

- [ ] 7日間の運動時間棒グラフが正しく表示される
- [ ] 30日間の運動頻度折れ線グラフが正しく表示される
- [ ] データがない日/週は適切に表示される
- [ ] 統計情報が正しく計算・表示される
- [ ] 期間切り替えが正常に動作する
- [ ] グラフのアニメーションがスムーズに動作する
- [ ] データ読み込み中はスケルトン表示される
- [ ] レスポンシブデザインで各画面サイズに対応
- [ ] アクセシビリティ対応（スクリーンリーダーで数値を読み上げ）

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 履歴画面（グラフ）
- `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` - UI/UX設計

## 技術詳細

### ファイル構成

```
src/
├── components/
│   └── graphs/
│       ├── DurationBarChart.tsx      # 運動時間棒グラフ
│       ├── FrequencyLineChart.tsx    # 運動頻度折れ線グラフ
│       ├── StatsSummary.tsx          # 統計サマリー
│       ├── PeriodSelector.tsx        # 期間選択
│       └── GraphSkeleton.tsx         # ローディング表示
├── hooks/
│   └── useGraphData.ts               # グラフデータ取得
└── utils/
    └── graphUtils.ts                 # グラフ計算ユーティリティ
```

### 使用ライブラリ

**react-native-chart-kit**:

```bash
npx expo install react-native-chart-kit react-native-svg
```

### 棒グラフ実装

```typescript
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

interface DurationBarChartProps {
  data: DailyDuration[];
}

interface DailyDuration {
  date: string;
  dayOfWeek: string;  // '月', '火', etc.
  duration: number;   // 分
  isToday: boolean;
}

const DurationBarChart: React.FC<DurationBarChartProps> = ({ data }) => {
  const screenWidth = Dimensions.get('window').width - 32; // padding考慮

  const chartData = {
    labels: data.map(d => d.dayOfWeek),
    datasets: [{
      data: data.map(d => d.duration),
    }],
  };

  return (
    <BarChart
      data={chartData}
      width={screenWidth}
      height={220}
      yAxisSuffix="分"
      chartConfig={{
        backgroundColor: '#ffffff',
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        labelColor: () => '#6B7280',
        barPercentage: 0.6,
      }}
      style={{
        borderRadius: 16,
      }}
    />
  );
};
```

### 折れ線グラフ実装

```typescript
import { LineChart } from 'react-native-chart-kit';

interface FrequencyLineChartProps {
  data: WeeklyFrequency[];
}

interface WeeklyFrequency {
  weekLabel: string;  // '第1週', '第2週', etc.
  count: number;      // セッション数
}

const FrequencyLineChart: React.FC<FrequencyLineChartProps> = ({ data }) => {
  const chartData = {
    labels: data.map(d => d.weekLabel),
    datasets: [{
      data: data.map(d => d.count),
      strokeWidth: 2,
    }],
  };

  return (
    <LineChart
      data={chartData}
      width={screenWidth}
      height={220}
      chartConfig={{
        backgroundColor: '#ffffff',
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        labelColor: () => '#6B7280',
        propsForDots: {
          r: '6',
          strokeWidth: '2',
          stroke: '#3B82F6',
        },
      }}
      bezier
      style={{
        borderRadius: 16,
      }}
    />
  );
};
```

### グラフデータ取得フック

```typescript
interface UseGraphDataResult {
  dailyDuration: DailyDuration[];
  weeklyFrequency: WeeklyFrequency[];
  stats: GraphStats;
  isLoading: boolean;
  error: Error | null;
  period: Period;
  setPeriod: (period: Period) => void;
}

interface GraphStats {
  totalDuration: number;      // 合計運動時間（分）
  weekOverWeekChange: number; // 先週比（%）
  averageScore: number;       // 平均スコア
  mostFrequentExercise: ExerciseType | null;
}

type Period = '7days' | '30days' | '90days';

const useGraphData = (): UseGraphDataResult => {
  const [period, setPeriod] = useState<Period>('7days');

  // training_getStatistics APIを呼び出してデータ取得
  // ...
};
```

### 統計計算

```typescript
const calculateWeekOverWeekChange = (
  thisWeekDuration: number,
  lastWeekDuration: number
): number => {
  if (lastWeekDuration === 0) {
    return thisWeekDuration > 0 ? 100 : 0;
  }
  return Math.round(
    ((thisWeekDuration - lastWeekDuration) / lastWeekDuration) * 100
  );
};

const findMostFrequentExercise = (
  sessions: Session[]
): ExerciseType | null => {
  if (sessions.length === 0) return null;

  const counts = sessions.reduce((acc, session) => {
    acc[session.exerciseType] = (acc[session.exerciseType] || 0) + 1;
    return acc;
  }, {} as Record<ExerciseType, number>);

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)[0][0] as ExerciseType;
};
```

## 注意事項

- グラフデータはキャッシュして不要なAPI呼び出しを減らす
- データがない期間は0として表示（グラフが崩れないように）
- 数値が大きい場合は適切に丸める（例: 120分 → 2時間）
- 色覚特性に配慮した色選択
- 端末の向き変更時にグラフサイズを再計算

## 見積もり

- 実装: 3日
- テスト: 1日
- レビュー・修正: 1日
- **合計: 5日**

## 進捗

- [ ] react-native-chart-kitのセットアップ
- [ ] DurationBarChartの実装
- [ ] FrequencyLineChartの実装
- [ ] StatsSummaryの実装
- [ ] PeriodSelectorの実装
- [ ] useGraphDataフックの実装
- [ ] グラフデータ計算ロジックの実装
- [ ] アニメーションの追加
- [ ] レスポンシブ対応
- [ ] アクセシビリティ対応
- [ ] テストの作成
- [ ] コードレビュー
