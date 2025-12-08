# 013 ホーム画面実装

## 概要

ログイン後のメイン画面となるホーム画面を実装します。今日のトレーニング状況、週間の進捗、直近の履歴を表示し、トレーニングを開始するためのエントリーポイントとなります。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 007: スプラッシュ画面実装
- 015: ボトムナビゲーション実装
- 016: 状態管理基盤（Zustand）

## 要件

### 画面構成

#### ヘッダー部分
- 挨拶メッセージ「こんにちは、[ユーザー名]さん!」
- 時間帯に応じた挨拶（おはようございます/こんにちは/こんばんは）

#### 今日のセッション
- 今日完了したトレーニング回数を大きく表示
- 数字は視覚的に目立つデザイン

#### 週間の進捗
- 過去7日間のトレーニング回数を棒グラフで表示
- X軸: 曜日（月〜日）
- Y軸: トレーニング回数
- 当日はハイライト表示

#### 直近の履歴
- 最新2件のトレーニング記録を表示
- 各記録には以下を表示:
  - 時刻
  - 種目名
  - スコア
  - 回数

#### トレーニング開始ボタン
- 画面下部に大きな緑色のボタン
- タップでメニュー選択画面へ遷移

#### 無料プラン制限表示（Phase 3で有効化）
- 無料プランユーザーの場合に表示
- 「無料プラン: 残り X回/3回」
- 「プレミアムにアップグレード」リンク

### データ取得

- Firestoreから今日のセッション数を取得
- Firestoreから過去7日間のセッション数を取得
- Firestoreから最新2件のセッションを取得
- TanStack Queryでキャッシュとリフレッシュを管理

### 画面遷移

- 「トレーニング開始」ボタン → メニュー選択画面
- 履歴カード タップ → セッション詳細画面（Phase 2で実装）
- 「プレミアムにアップグレード」 → 課金画面（Phase 3で実装）
- ボトムナビゲーション → 各タブ画面

## 受け入れ条件

- [ ] ユーザー名を含む挨拶が表示される
- [ ] 今日のセッション数が表示される（0の場合も表示）
- [ ] 週間の進捗グラフが表示される
- [ ] 直近の履歴（最大2件）が表示される
- [ ] トレーニングがない場合は「まだ記録がありません」と表示される
- [ ] 「トレーニング開始」ボタンが動作する
- [ ] ボトムナビゲーションが表示される
- [ ] ホームタブがアクティブ状態で表示される
- [ ] Pull-to-refreshでデータが更新される
- [ ] ローディング状態が適切に表示される
- [ ] エラー時に再試行オプションが表示される

## 参照ドキュメント

- [要件定義書 Part 1](../specs/01_要件定義書_Expo版_v1_Part1.md) - FR-007, FR-008, FR-009
- [要件定義書 Part 5](../specs/05_要件定義書_Expo版_v1_Part5.md) - sessionsコレクション
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - セクション3.6

## 技術詳細

### Expo Router パス

`/(tabs)/home`

### 使用ライブラリ

- `react-native-paper`: Card, Text, Button
- `react-native-chart-kit` または `victory-native`: 棒グラフ
- `@tanstack/react-query`: データフェッチング

### Zustand Store

```typescript
interface HomeState {
  todaySessions: number;
  weeklyProgress: number[]; // 過去7日間の配列
  recentSessions: Session[];
  isLoading: boolean;
}
```

### TanStack Query

```typescript
// 今日のセッション数を取得
const { data: todayCount } = useQuery({
  queryKey: ['sessions', 'today', userId],
  queryFn: () => fetchTodaySessions(userId),
});

// 週間進捗を取得
const { data: weeklyProgress } = useQuery({
  queryKey: ['sessions', 'weekly', userId],
  queryFn: () => fetchWeeklySessions(userId),
});

// 直近の履歴を取得
const { data: recentSessions } = useQuery({
  queryKey: ['sessions', 'recent', userId],
  queryFn: () => fetchRecentSessions(userId, 2),
});
```

### Firestoreクエリ

```typescript
// 今日のセッションを取得
const today = new Date();
today.setHours(0, 0, 0, 0);

const q = query(
  collection(db, `users/${userId}/sessions`),
  where('startedAt', '>=', today),
  orderBy('startedAt', 'desc')
);
```

## 注意事項

- Phase 1ではトレーニング機能が未実装のため、履歴とグラフはモックデータまたは空表示
- 無料プラン制限の表示はPhase 3で有効化（UIのみ先に実装可）
- グラフライブラリは軽量なものを選択すること（パフォーマンス考慮）
- 時間帯による挨拶は端末のローカル時刻を使用

## 見積もり

- 想定工数: 2〜3日

## 進捗

- [ ] 未着手
