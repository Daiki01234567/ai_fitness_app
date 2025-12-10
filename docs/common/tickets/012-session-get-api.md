# 012 セッション取得API

## 概要

特定のトレーニングセッションの詳細データを取得するAPIを実装するチケットです。ユーザーが過去のトレーニング結果を確認するために、セッションIDを指定してFirestoreから単一セッションのデータを取得します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-009: トレーニング履歴取得機能

### 非機能要件

- NFR-001: レスポンス時間 - 95パーセンタイル 200ms以内
- NFR-026: レート制限（50回/時/ユーザー）

## 受け入れ条件（Todo）

- [x] `training_getSession` Callable Functionを実装
- [x] リクエストデータのバリデーション実装（sessionId）
- [x] Firestoreからセッション取得実装
- [x] 本人確認の実装（他人のセッションは取得不可）
- [x] 削除予定ユーザーも読み取り可能（データエクスポート用）
- [ ] レート制限（50回/時）を実装
- [x] エラーハンドリング実装（認証エラー、権限エラー、存在しないセッション）
- [x] ユニットテスト実装（カバレッジ80%以上）
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション6（トレーニングセッションAPI）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション5（Sessionsコレクション）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-009

## 技術詳細

### APIエンドポイント

#### training_getSession

**目的**: 単一セッションの取得

**リクエスト**:

```typescript
interface GetSessionRequest {
  sessionId: string;
}
```

**レスポンス**:

```typescript
interface GetSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    exerciseType: string;
    startTime: string;
    endTime: string | null;
    duration: number | null;
    status: 'active' | 'completed' | 'cancelled';
    repCount: number;
    setCount: number;
    formFeedback: {
      overallScore: number;
      goodFrames: number;
      warningFrames: number;
      errorFrames: number;
      warnings: Array<{
        type: string;
        count: number;
        severity: string;
      }>;
    };
    cameraSettings: {
      position: string;
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
        platform: string;
        osVersion: string;
        deviceModel: string;
        deviceMemory: number | null;
      };
    };
    createdAt: string;
    updatedAt: string;
  };
}
```

### バリデーション

#### 必須チェック

1. **認証チェック**: `request.auth`が存在すること
2. **sessionId**: 空文字列でないこと
3. **本人確認**: セッションの`userId`がリクエストユーザーと一致すること

### 実装例

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const training_getSession = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { sessionId } = request.data;

  // 2. バリデーション
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionIdが無効です');
  }

  // 3. Firestoreから取得
  const db = getFirestore();
  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);

  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError('not-found', 'セッションが見つかりません');
  }

  const sessionData = sessionDoc.data()!;

  // 4. 本人確認
  if (sessionData.userId !== uid) {
    throw new HttpsError('permission-denied', '他人のセッションにはアクセスできません');
  }

  console.log(`Session retrieved: userId=${uid}, sessionId=${sessionId}`);

  // 5. レスポンス
  return {
    success: true,
    data: {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      exerciseType: sessionData.exerciseType,
      startTime: sessionData.startTime?.toDate().toISOString() || null,
      endTime: sessionData.endTime?.toDate().toISOString() || null,
      duration: sessionData.duration || null,
      status: sessionData.status,
      repCount: sessionData.repCount || 0,
      setCount: sessionData.setCount || 0,
      formFeedback: sessionData.formFeedback || null,
      cameraSettings: sessionData.cameraSettings,
      sessionMetadata: sessionData.sessionMetadata || null,
      createdAt: sessionData.createdAt.toDate().toISOString(),
      updatedAt: sessionData.updatedAt.toDate().toISOString()
    }
  };
});
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `permission-denied` | 他人のセッションへのアクセス | 403 |
| `invalid-argument` | sessionIdが無効 | 400 |
| `not-found` | セッションが存在しない | 404 |
| `internal` | Firestore読み取りエラー | 500 |

### セキュリティ考慮事項

#### 削除予定ユーザーの扱い

- 削除予定ユーザーでも**読み取りは許可**（GDPR第20条: データポータビリティ権）
- データエクスポート機能で使用される

#### Firestoreセキュリティルールとの連携

```javascript
match /users/{userId}/sessions/{sessionId} {
  // 本人のみ読み取り可能（削除予定ユーザーも含む）
  allow read: if request.auth != null
              && request.auth.uid == userId;
}
```

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- セッション一覧取得は別チケット（013）で実装
- フレームデータの取得は別途検討（Phase 2後半）
- レート制限のミドルウェアはチケット009で実装済みを想定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
