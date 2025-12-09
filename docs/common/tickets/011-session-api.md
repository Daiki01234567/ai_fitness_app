# 011 セッションAPI

## 概要

トレーニングセッション（1回のトレーニング記録）を保存・取得するAPIを実装します。

ユーザーがトレーニングを完了したとき、その結果（種目、回数、スコアなど）をサーバーに保存し、後から履歴として見られるようにするための機能です。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/002: Firestoreセキュリティルール実装
- common/003: Firebase Authentication 統合

## 要件

### セッション保存API（training_createSession / training_completeSession）

1. **セッション開始API**: トレーニング開始時にセッションを作成
   - リクエスト: 種目名、カメラ設定
   - レスポンス: セッションID

2. **セッション完了API**: トレーニング終了時にデータを保存
   - リクエスト: セッションID、レップ数、セット数、フォーム評価、メタデータ
   - レスポンス: 保存結果

### セッション取得API（getSession / getSessions）

1. **単一セッション取得**: 指定したセッションIDのデータを取得
2. **セッション一覧取得**: ユーザーの過去のセッションを一覧で取得（ページネーション対応）

### セッション統計取得API

1. **期間別統計**: 週・月単位でのトレーニング回数、合計レップ数
2. **種目別統計**: 各種目ごとの平均スコア、トレーニング回数

## 対象種目（5種類）

1. スクワット（squat）
2. プッシュアップ（pushup）
3. アームカール（armcurl）
4. サイドレイズ（sidelateral）
5. ショルダープレス（shoulderpress）

## 受け入れ条件

- [ ] セッション開始APIが動作する（sessionIdが返る）
- [ ] セッション完了APIでデータがFirestoreに保存される
- [ ] 単一セッション取得APIで正しいデータが返る
- [ ] セッション一覧APIでページネーションが動作する
- [ ] 週・月の統計データが取得できる
- [ ] 種目別の統計データが取得できる
- [ ] 認証されていないリクエストは401エラーになる
- [ ] 他のユーザーのデータにはアクセスできない（403エラー）
- [ ] レート制限（100回/日）が適用される

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション6（トレーニングセッションAPI）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - sessionsコレクション

## 技術詳細

### データ構造（Firestore）

```typescript
// sessions コレクション
interface Session {
  sessionId: string;
  userId: string;
  exerciseType: 'squat' | 'pushup' | 'armcurl' | 'sidelateral' | 'shoulderpress';
  startTime: Timestamp;
  endTime: Timestamp | null;
  duration: number;  // 秒
  status: 'active' | 'completed' | 'cancelled';
  repCount: number;
  setCount: number;
  formFeedback: {
    overallScore: number;  // 0-100
    goodFrames: number;
    warningFrames: number;
    errorFrames: number;
    warnings: Array<{
      type: string;
      count: number;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
  cameraSettings: {
    position: 'front' | 'side';
    resolution: string;
    fps: number;
  };
  sessionMetadata: {
    totalFrames: number;
    processedFrames: number;
    averageFps: number;
    frameDropCount: number;
    averageConfidence: number;
    mediapipePerformance: {
      averageInferenceTime: number;
      maxInferenceTime: number;
      minInferenceTime: number;
    };
    deviceInfo: {
      platform: 'iOS' | 'Android';
      osVersion: string;
      deviceModel: string;
      deviceMemory: number | null;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### APIエンドポイント

| 関数名 | メソッド | 説明 | レート制限 |
|--------|---------|------|-----------|
| `training_createSession` | POST | セッション開始 | 100回/日 |
| `training_completeSession` | POST | セッション完了 | 100回/日 |
| `training_getSession` | GET | 単一取得 | 200回/時 |
| `training_getSessions` | GET | 一覧取得 | 100回/時 |
| `training_getStats` | GET | 統計取得 | 50回/時 |

### レスポンス形式

```typescript
// 成功時
{
  success: true,
  data: { ... },
  message: "セッションを保存しました"
}

// エラー時
{
  success: false,
  error: {
    code: "INVALID_ARGUMENT",
    message: "種目名が不正です"
  }
}
```

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-014 | トレーニング記録の保存 |
| FR-015 | トレーニング履歴の表示 |
| NFR-001 | API応答時間200ms以内（95パーセンタイル） |

## 見積もり

5日

## 進捗

- [ ] 未着手
