# 038 カレンダー表示機能

## 概要

履歴画面にカレンダー形式でトレーニング実施日を表示する機能を実装します。ユーザーが視覚的にトレーニングの継続状況を確認でき、日付をタップすることでその日のトレーニング詳細を表示します。

## Phase

Phase 2（機能実装）

## 依存チケット

- 037: 履歴画面実装

## 要件

### カレンダー表示機能

1. **月別カレンダー表示**
   - 月ごとにカレンダーを表示
   - 左右スワイプで月を切り替え
   - ヘッダーに年月を表示（例: 2025年1月）

2. **トレーニング日のマーキング**
   - トレーニングを実施した日にドットマーカーを表示
   - 種目ごとに異なる色でマーキング
   - 複数種目を実施した日は複数のドットを表示

3. **日付選択機能**
   - 日付をタップするとその日のトレーニング一覧を表示
   - 選択中の日付はハイライト表示
   - 今日の日付は特別なスタイルで表示

4. **ストリーク表示**
   - 連続トレーニング日数をカレンダー上部に表示
   - 連続日はカレンダー上で視覚的に強調

### マーキングの色分け

| 種目 | 色 |
|-----|-----|
| スクワット | 青 (#3B82F6) |
| プッシュアップ | 赤 (#EF4444) |
| アームカール | 緑 (#22C55E) |
| サイドレイズ | 紫 (#A855F7) |
| ショルダープレス | オレンジ (#F97316) |

### 日別詳細表示

日付をタップした際に表示する内容：

- その日のトレーニング一覧
- 各セッションの種目、回数、スコア
- タップでセッション詳細画面へ遷移

## 受け入れ条件

- [ ] 月別カレンダーが正しく表示される
- [ ] 月の切り替えがスムーズに動作する
- [ ] トレーニング実施日にドットマーカーが表示される
- [ ] 種目ごとに異なる色でマーキングされる
- [ ] 日付タップでその日のセッション一覧が表示される
- [ ] 選択中の日付がハイライト表示される
- [ ] 今日の日付が強調表示される
- [ ] 連続トレーニング日数が正しく計算・表示される
- [ ] 過去の月のデータも正しく表示される
- [ ] ローディング中は適切なインジケーターが表示される

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 履歴画面（カレンダー）
- `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` - UI/UX設計

## 技術詳細

### ファイル構成

```
src/
├── components/
│   └── calendar/
│       ├── TrainingCalendar.tsx    # カレンダーコンポーネント
│       ├── DayCell.tsx             # 日付セル
│       ├── DayMarkers.tsx          # マーカー表示
│       ├── MonthHeader.tsx         # 月ヘッダー
│       ├── StreakBadge.tsx         # ストリーク表示
│       └── DaySessionsSheet.tsx    # 日別セッション表示
├── hooks/
│   └── useCalendarData.ts          # カレンダーデータ取得
└── utils/
    └── calendarUtils.ts            # カレンダー計算ユーティリティ
```

### 使用ライブラリ

**react-native-calendars**:

```bash
npx expo install react-native-calendars
```

### カレンダーコンポーネント実装

```typescript
import { Calendar, DateData } from 'react-native-calendars';

interface TrainingCalendarProps {
  onDayPress: (date: string) => void;
}

const TrainingCalendar: React.FC<TrainingCalendarProps> = ({ onDayPress }) => {
  const { markedDates, isLoading } = useCalendarData();

  return (
    <Calendar
      onDayPress={(day: DateData) => onDayPress(day.dateString)}
      markedDates={markedDates}
      markingType="multi-dot"
      theme={{
        todayTextColor: '#3B82F6',
        selectedDayBackgroundColor: '#3B82F6',
        dotColor: '#3B82F6',
      }}
      enableSwipeMonths
    />
  );
};
```

### マーキングデータの形式

```typescript
// react-native-calendarsのmarkedDates形式
interface MarkedDates {
  [date: string]: {
    dots?: Array<{ key: string; color: string }>;
    selected?: boolean;
    selectedColor?: string;
  };
}

// 例
const markedDates: MarkedDates = {
  '2025-01-15': {
    dots: [
      { key: 'squat', color: '#3B82F6' },
      { key: 'pushup', color: '#EF4444' },
    ],
  },
  '2025-01-16': {
    dots: [
      { key: 'armcurl', color: '#22C55E' },
    ],
    selected: true,
    selectedColor: '#3B82F6',
  },
};
```

### カレンダーデータ取得フック

```typescript
interface UseCalendarDataResult {
  markedDates: MarkedDates;
  isLoading: boolean;
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  streak: number;
}

const useCalendarData = (year: number, month: number): UseCalendarDataResult => {
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  useEffect(() => {
    // Firestoreからその月のセッションを取得
    const fetchSessions = async () => {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const sessions = await getSessions({ startDate, endDate });

      // セッションをマーキング形式に変換
      const marks = sessionsToMarkedDates(sessions);
      setMarkedDates(marks);
    };

    fetchSessions();
  }, [year, month]);

  return { markedDates, isLoading, ... };
};
```

### ストリーク計算

```typescript
const calculateStreak = (sessions: Session[]): number => {
  if (sessions.length === 0) return 0;

  // セッションがある日付を抽出（重複除去）
  const trainingDates = [...new Set(
    sessions.map(s => formatDate(s.startedAt, 'YYYY-MM-DD'))
  )].sort().reverse();

  let streak = 0;
  let currentDate = new Date();

  for (const dateStr of trainingDates) {
    const date = parseDate(dateStr);
    const diff = diffDays(currentDate, date);

    if (diff === 0 || diff === 1) {
      streak++;
      currentDate = date;
    } else {
      break;
    }
  }

  return streak;
};
```

## 注意事項

- カレンダーデータは月ごとにキャッシュする
- 過去のデータを大量に読み込まないよう、表示月のみフェッチ
- 日本語ロケールに対応（曜日表示など）
- アクセシビリティ対応（VoiceOver/TalkBack）

## 見積もり

- 実装: 3日
- テスト: 1日
- レビュー・修正: 1日
- **合計: 5日**

## 進捗

- [ ] react-native-calendarsのセットアップ
- [ ] TrainingCalendarコンポーネントの実装
- [ ] マーキング機能の実装
- [ ] 日付選択機能の実装
- [ ] 日別セッション表示の実装
- [ ] ストリーク計算の実装
- [ ] ストリーク表示UIの実装
- [ ] 月切り替え時のデータ読み込み
- [ ] 日本語ロケール対応
- [ ] テストの作成
- [ ] コードレビュー
