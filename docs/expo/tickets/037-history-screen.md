# 037 履歴画面実装

## 概要

過去のトレーニング記録を一覧で確認できる履歴画面を実装します。トレーニングの履歴をリスト形式で表示し、種目や日付でフィルタリングする機能、および大量のデータを効率的に表示するためのページネーション機能を含みます。

## Phase

Phase 2（機能実装）

## 依存チケット

- 007: スプラッシュ画面実装
- 015: Cloud Functions基盤構築
- 036: セッション管理

## 要件

### 画面構成

履歴画面は以下の要素で構成されます：

1. **ヘッダー部分**
   - 画面タイトル「履歴」
   - フィルターボタン

2. **フィルター部分**（展開/折りたたみ可能）
   - 種目フィルター（全て / 個別種目）
   - 日付範囲フィルター（今週 / 今月 / 3ヶ月 / カスタム）

3. **サマリー部分**
   - 表示期間の合計セッション数
   - 合計運動時間
   - 平均スコア

4. **トレーニング一覧**
   - 日付ごとにグループ化
   - 各セッションをカード形式で表示
   - 無限スクロールでページネーション

### トレーニングカードの表示項目

各トレーニングセッションは以下の情報を表示します：

- 種目アイコンと種目名
- 実施日時
- レップ数 x セット数
- 平均スコア（円形のスコアバッジ）
- 運動時間
- 消費カロリー（あれば）

### フィルター機能

**種目フィルター**:
- 全て
- スクワット
- プッシュアップ
- アームカール
- サイドレイズ
- ショルダープレス

**日付範囲フィルター**:
- 今週（今週の月曜日から今日まで）
- 今月（今月1日から今日まで）
- 3ヶ月（過去3ヶ月）
- カスタム（日付ピッカーで範囲指定）

### ページネーション

- 初期表示: 20件
- 追加読み込み: 20件ずつ
- 無限スクロールで自動読み込み
- 読み込み中はローディングインジケーター表示
- 全件読み込み完了時は「すべて表示しました」メッセージ

## 受け入れ条件

- [ ] トレーニング履歴が日付ごとにグループ化されて表示される
- [ ] 種目でのフィルタリングが正常に動作する
- [ ] 日付範囲でのフィルタリングが正常に動作する
- [ ] カスタム日付範囲の指定が動作する
- [ ] 無限スクロールによるページネーションが動作する
- [ ] サマリー情報が正しく計算・表示される
- [ ] トレーニングカードをタップすると詳細画面に遷移する
- [ ] データがない場合は空状態メッセージが表示される
- [ ] 読み込み中はスケルトン/ローディング表示される
- [ ] エラー時はエラーメッセージとリトライボタンが表示される

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 履歴画面
- `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` - UI/UX設計

## 技術詳細

### ファイル構成

```
src/
├── app/
│   └── (tabs)/
│       └── history/
│           ├── index.tsx         # 履歴画面
│           └── [sessionId].tsx   # セッション詳細画面
├── components/
│   └── history/
│       ├── HistoryHeader.tsx     # ヘッダー
│       ├── HistoryFilter.tsx     # フィルター
│       ├── HistorySummary.tsx    # サマリー
│       ├── SessionCard.tsx       # セッションカード
│       ├── SessionGroup.tsx      # 日付グループ
│       └── EmptyHistory.tsx      # 空状態
├── hooks/
│   └── useHistory.ts             # 履歴データ取得フック
└── stores/
    └── historyStore.ts           # フィルター状態管理
```

### データ取得フック

```typescript
interface UseHistoryOptions {
  exerciseType?: ExerciseType;
  startDate?: Date;
  endDate?: Date;
}

interface UseHistoryResult {
  sessions: GroupedSessions[];
  summary: HistorySummary;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

// 日付でグループ化されたセッション
interface GroupedSessions {
  date: string;          // "2025-01-15"
  displayDate: string;   // "1月15日（水）"
  sessions: Session[];
}
```

### UIコンポーネント例

```typescript
// SessionCard.tsx
interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.iconContainer}>
        <ExerciseIcon type={session.exerciseType} />
      </View>
      <View style={styles.content}>
        <Text style={styles.exerciseName}>
          {getExerciseDisplayName(session.exerciseType)}
        </Text>
        <Text style={styles.details}>
          {session.repCount}回 x {session.setCount}セット
        </Text>
        <Text style={styles.time}>
          {formatDuration(session.duration)}
        </Text>
      </View>
      <View style={styles.scoreContainer}>
        <ScoreBadge score={session.averageScore} />
      </View>
    </TouchableOpacity>
  );
};
```

### FlashListの使用

大量のデータを効率的に表示するため、`@shopify/flash-list`を使用します：

```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={groupedSessions}
  renderItem={({ item }) => <SessionGroup {...item} />}
  estimatedItemSize={120}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={isLoadingMore ? <LoadingFooter /> : null}
  ListEmptyComponent={<EmptyHistory />}
/>
```

## 注意事項

- データ量が多い場合のパフォーマンスに注意
- 日付のフォーマットは日本語形式（例: 1月15日（水））
- スコアの色分け: 0-59=赤、60-79=黄、80-100=緑
- オフライン時はローカルキャッシュから表示

## 見積もり

- 実装: 4日
- テスト: 2日
- レビュー・修正: 1日
- **合計: 7日**

## 進捗

- [ ] 画面レイアウトの作成
- [ ] HistoryHeaderの実装
- [ ] HistoryFilterの実装
- [ ] SessionCardの実装
- [ ] SessionGroupの実装
- [ ] HistorySummaryの実装
- [ ] useHistoryフックの実装
- [ ] ページネーションの実装
- [ ] フィルター機能の実装
- [ ] 空状態・エラー状態の実装
- [ ] スタイリングの調整
- [ ] テストの作成
- [ ] コードレビュー
