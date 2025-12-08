# 035 トレーニング記録保存API

## 概要

トレーニングセッションの記録を保存・取得・統計計算するためのAPIを実装します。ユーザーがトレーニングを完了した際に、その記録をFirestoreに保存し、後から履歴や統計情報を取得できるようにします。

## Phase

Phase 2（機能実装）

## 依存チケット

- 001: Expoプロジェクト初期セットアップ
- 003: Firestoreセキュリティルール実装

## 要件

### 実装するAPI

#### 1. training_createSession

新しいトレーニングセッションを記録するAPI。

**リクエストパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| exerciseType | string | はい | 運動の種類（squat, pushup, armcurl, sideraise, shoulderpress） |
| repCount | number | はい | レップ数（回数） |
| setCount | number | はい | セット数 |
| averageScore | number | はい | 平均スコア（0-100） |
| duration | number | はい | 運動時間（秒） |
| calories | number | いいえ | 消費カロリー（推定） |
| deviceInfo | object | はい | デバイス情報 |
| frames | array | いいえ | フレームごとの骨格データ |

**レスポンス**:

```typescript
{
  success: true,
  data: {
    sessionId: string,
    createdAt: string
  }
}
```

#### 2. training_getSessions

過去のトレーニング履歴を取得するAPI。

**リクエストパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| limit | number | いいえ | 取得件数（デフォルト: 20、最大: 100） |
| startAfter | string | いいえ | ページネーション用のカーソル |
| exerciseType | string | いいえ | 種目でフィルター |
| startDate | string | いいえ | 開始日（ISO 8601形式） |
| endDate | string | いいえ | 終了日（ISO 8601形式） |

**レスポンス**:

```typescript
{
  success: true,
  data: {
    sessions: Session[],
    nextCursor: string | null,
    totalCount: number
  }
}
```

#### 3. training_getStatistics

期間を指定して統計データを取得するAPI。

**リクエストパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| period | string | はい | 期間（7days, 30days, 90days, all） |
| exerciseType | string | いいえ | 種目でフィルター |

**レスポンス**:

```typescript
{
  success: true,
  data: {
    totalSessions: number,      // セッション総数
    totalReps: number,          // 合計レップ数
    totalDuration: number,      // 合計運動時間（秒）
    totalCalories: number,      // 合計消費カロリー
    averageScore: number,       // 平均スコア
    streakDays: number,         // 連続トレーニング日数
    exerciseBreakdown: {        // 種目別内訳
      [exerciseType: string]: {
        count: number,
        avgScore: number
      }
    }
  }
}
```

### バリデーションルール

- exerciseType: squat, pushup, armcurl, sideraise, shoulderpress のいずれか
- repCount: 1以上、1000以下の整数
- setCount: 1以上、100以下の整数
- averageScore: 0以上、100以下の数値
- duration: 1以上、86400以下の整数（最大24時間）

### レート制限

- training_createSession: 100回/日/ユーザー
- training_getSessions: 100回/分/ユーザー
- training_getStatistics: 30回/分/ユーザー

## 受け入れ条件

- [ ] training_createSession APIが正常に動作し、セッションがFirestoreに保存される
- [ ] training_getSessions APIでページネーションが正しく動作する
- [ ] training_getSessions APIで種目・日付によるフィルターが動作する
- [ ] training_getStatistics APIで期間ごとの統計が正しく計算される
- [ ] 全APIで認証チェックが実装されている
- [ ] 全APIでバリデーションが実装されている
- [ ] レート制限が実装されている
- [ ] エラーハンドリングが適切に実装されている
- [ ] 単体テストが作成されている（カバレッジ80%以上）

## 参照ドキュメント

- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - 2.2.3 トレーニング関連API
- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - 1.3.2 sessions コレクション
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` - トレーニングAPI仕様

## 技術詳細

### ファイル構成

```
functions/src/
├── api/
│   └── training/
│       ├── createSession.ts    # セッション作成API
│       ├── getSessions.ts      # セッション取得API
│       ├── getStatistics.ts    # 統計取得API
│       └── index.ts            # エクスポート
├── types/
│   └── training.ts             # 型定義
└── utils/
    └── trainingValidator.ts    # バリデーション
```

### データ構造

**sessionsドキュメント**:

```typescript
interface Session {
  sessionId: string;
  userId: string;
  exerciseType: ExerciseType;
  repCount: number;
  setCount: number;
  averageScore: number;
  duration: number;
  calories?: number;
  startedAt: Timestamp;
  endedAt: Timestamp;
  deviceInfo: DeviceInfo;
  createdAt: Timestamp;
}
```

### Firestoreパス

- セッション: `/users/{userId}/sessions/{sessionId}`
- フレーム: `/users/{userId}/sessions/{sessionId}/frames/{frameId}`

## 注意事項

- 無料プランの場合、1日の利用回数制限をチェックする必要がある（Phase 3で実装）
- 骨格データ（frames）は容量が大きいため、必要に応じて圧縮を検討
- 削除予約中（deletionScheduled=true）のユーザーはセッション作成不可
- 統計計算は負荷が高いため、キャッシュの導入を検討

## 見積もり

- 実装: 3日
- テスト: 2日
- レビュー・修正: 1日
- **合計: 6日**

## 進捗

- [ ] API仕様の確認
- [ ] 型定義の作成
- [ ] training_createSession の実装
- [ ] training_getSessions の実装
- [ ] training_getStatistics の実装
- [ ] バリデーションの実装
- [ ] レート制限の実装
- [ ] 単体テストの作成
- [ ] 統合テストの作成
- [ ] コードレビュー
- [ ] 修正対応
