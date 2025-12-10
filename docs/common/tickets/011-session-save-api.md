# 011 トレーニングセッション保存API

## 概要

トレーニングセッションのデータをFirestoreに保存するAPIを実装するチケットです。MediaPipeで計測した骨格座標データ、フォーム評価結果、メタデータをクライアントから受け取り、適切にバリデーションした上でFirestoreに保存します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-008: トレーニングセッション記録機能

### 非機能要件

- NFR-001: レスポンス時間 - 95パーセンタイル 200ms以内
- NFR-002: 入力値の厳格なバリデーション
- NFR-026: レート制限（100回/日/ユーザー）

## 受け入れ条件（Todo）

- [x] `training_createSession` Callable Functionを実装
- [x] `training_completeSession` Callable Functionを実装
- [x] リクエストデータのバリデーション実装（種目、カメラ設定、セッションメタデータ）
- [x] Firestoreの`sessions`サブコレクションへの書き込み実装
- [x] 削除予定ユーザーのアクセス制御を実装（書き込み禁止）
- [ ] レート制限（100回/日）を実装
- [x] エラーハンドリング実装（認証エラー、権限エラー、バリデーションエラー）
- [x] ユニットテスト実装（カバレッジ80%以上）
- [x] セッション作成・完了のログ出力実装
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション6（トレーニングセッションAPI）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション5（Sessionsコレクション）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-008

## 技術詳細

### APIエンドポイント

#### 1. training_createSession

**目的**: トレーニングセッションの開始

**リクエスト**:

```typescript
interface CreateSessionRequest {
  exerciseType: 'squat' | 'pushup' | 'armcurl' | 'sidelateral' | 'shoulderpress';
  cameraSettings: {
    position: 'front' | 'side';
    resolution: string;  // 例: '1280x720'
    fps: number;         // 例: 30
  };
}
```

**レスポンス**:

```typescript
interface CreateSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    exerciseType: string;
    startTime: string;  // ISO 8601形式
    status: 'active';
  };
}
```

#### 2. training_completeSession

**目的**: トレーニングセッションの完了と結果保存

**リクエスト**:

```typescript
interface CompleteSessionRequest {
  sessionId: string;
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
}
```

**レスポンス**:

```typescript
interface CompleteSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    status: 'completed';
    repCount: number;
    overallScore: number;
    completedAt: string;
  };
  message: string;
}
```

### バリデーション

#### 必須チェック

1. **認証チェック**: `request.auth`が存在すること
2. **削除予定ユーザーチェック**: `deletionScheduled`がfalseであること
3. **exerciseType**: 5種目のいずれかであること
4. **repCount**: 0以上の整数
5. **setCount**: 1以上の整数
6. **overallScore**: 0-100の整数
7. **cameraSettings.fps**: 1以上の整数

### 実装例

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { checkDeletionScheduled } from '../middleware/auth';
import { validateSessionData } from '../utils/validation';

export const training_createSession = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 2. 削除予定ユーザーチェック
  if (await checkDeletionScheduled(uid)) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、新規データを作成できません。'
    );
  }

  // 3. バリデーション
  const { exerciseType, cameraSettings } = request.data;

  if (!['squat', 'pushup', 'armcurl', 'sidelateral', 'shoulderpress'].includes(exerciseType)) {
    throw new HttpsError('invalid-argument', '無効な種目です');
  }

  // 4. Firestoreに保存
  const db = getFirestore();
  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc();

  const sessionData = {
    sessionId: sessionRef.id,
    userId: uid,
    exerciseType,
    startTime: FieldValue.serverTimestamp(),
    endTime: null,
    duration: null,
    status: 'active',
    cameraSettings,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await sessionRef.set(sessionData);

  console.log(`Session created: userId=${uid}, sessionId=${sessionRef.id}, exerciseType=${exerciseType}`);

  return {
    success: true,
    data: {
      sessionId: sessionRef.id,
      userId: uid,
      exerciseType,
      startTime: new Date().toISOString(),
      status: 'active'
    }
  };
});

export const training_completeSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { sessionId, repCount, setCount, formFeedback, sessionMetadata } = request.data;

  // バリデーション
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionIdが無効です');
  }

  if (repCount < 0 || setCount < 1) {
    throw new HttpsError('invalid-argument', '回数・セット数が無効です');
  }

  // セッション更新
  const db = getFirestore();
  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);

  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) {
    throw new HttpsError('not-found', 'セッションが見つかりません');
  }

  const endTime = new Date();
  const startTime = sessionDoc.data()!.startTime.toDate();
  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  await sessionRef.update({
    endTime: FieldValue.serverTimestamp(),
    duration,
    status: 'completed',
    repCount,
    setCount,
    formFeedback,
    sessionMetadata,
    bigquerySyncStatus: 'pending',
    bigquerySyncedAt: null,
    bigquerySyncError: null,
    bigquerySyncRetryCount: 0,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log(`Session completed: userId=${uid}, sessionId=${sessionId}, repCount=${repCount}, score=${formFeedback.overallScore}`);

  return {
    success: true,
    data: {
      sessionId,
      userId: uid,
      status: 'completed',
      repCount,
      overallScore: formFeedback.overallScore,
      completedAt: endTime.toISOString()
    },
    message: 'トレーニングセッションを保存しました'
  };
});
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `permission-denied` | 削除予定ユーザー | 403 |
| `invalid-argument` | バリデーションエラー | 400 |
| `not-found` | セッションが存在しない | 404 |
| `internal` | Firestore書き込みエラー | 500 |

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 実装完了（2025-12-10）
- [ ] レート制限は別途対応（チケット009との連携が必要）
- [ ] ローカルエミュレータ動作確認は別途対応

## 完了日

2025-12-10（主要実装完了）

## 備考

- BigQueryへの同期は別チケット（015）で実装
- フレームデータの保存は別途検討（Phase 2後半）
- レート制限のミドルウェアはチケット009で実装済みを想定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 主要実装完了 - createSession, completeSession API実装、ユニットテスト追加（カバレッジ80%以上達成） |
