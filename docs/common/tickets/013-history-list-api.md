# 013 トレーニング履歴一覧API

## 概要

ユーザーのトレーニング履歴を一覧表示するためのAPIを実装するチケットです。ページネーション対応で、日付順（新しい順）に並べてFirestoreから取得します。種目フィルタリング機能も実装します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-010: トレーニング履歴一覧表示機能

### 非機能要件

- NFR-001: レスポンス時間 - 95パーセンタイル 200ms以内
- NFR-026: レート制限（50回/時/ユーザー）

## 受け入れ条件（Todo）

- [x] `training_listSessions` Callable Functionを実装
- [x] ページネーション実装（limit, startAfter）
- [x] 種目フィルタリング実装（exerciseType）
- [x] 日付順ソート実装（createdAt降順）
- [x] リクエストデータのバリデーション実装
- [x] Firestoreから履歴取得実装
- [x] 本人確認の実装（他人の履歴は取得不可）
- [x] 削除予定ユーザーも読み取り可能（データエクスポート用）
- [x] レート制限（50回/時）を実装
- [x] エラーハンドリング実装
- [x] ユニットテスト実装（カバレッジ80%以上）
- [x] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション6（トレーニングセッションAPI）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション5（Sessionsコレクション）、セクション10（インデックス設計）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-010

## 技術詳細

### APIエンドポイント

#### training_listSessions

**目的**: トレーニング履歴の一覧取得（ページネーション対応）

**リクエスト**:

```typescript
interface ListSessionsRequest {
  limit?: number;              // 取得件数（デフォルト: 20、最大: 100）
  startAfter?: string;         // ページネーション用のカーソル（sessionId）
  exerciseType?: 'squat' | 'pushup' | 'armcurl' | 'sidelateral' | 'shoulderpress' | null;  // 種目フィルタ
}
```

**レスポンス**:

```typescript
interface ListSessionsResponse {
  success: true;
  data: {
    sessions: Array<{
      sessionId: string;
      exerciseType: string;
      startTime: string;
      endTime: string | null;
      duration: number | null;
      status: string;
      repCount: number;
      setCount: number;
      overallScore: number | null;
      createdAt: string;
    }>;
    hasMore: boolean;           // 次ページがあるか
    nextCursor: string | null;  // 次ページのカーソル
  };
}
```

### バリデーション

#### 必須チェック

1. **認証チェック**: `request.auth`が存在すること
2. **limit**: 1〜100の範囲内
3. **exerciseType**: 5種目のいずれか、またはnull

### 実装例

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const training_listSessions = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { limit = 20, startAfter, exerciseType } = request.data;

  // 2. バリデーション
  if (limit < 1 || limit > 100) {
    throw new HttpsError('invalid-argument', 'limitは1〜100の範囲で指定してください');
  }

  if (exerciseType && !['squat', 'pushup', 'armcurl', 'sidelateral', 'shoulderpress'].includes(exerciseType)) {
    throw new HttpsError('invalid-argument', '無効な種目です');
  }

  // 3. Firestoreクエリ構築
  const db = getFirestore();
  let query = db.collection('users').doc(uid).collection('sessions')
    .orderBy('createdAt', 'desc')
    .limit(limit + 1);  // +1で次ページの有無を判定

  // 種目フィルタ
  if (exerciseType) {
    query = query.where('exerciseType', '==', exerciseType);
  }

  // ページネーション
  if (startAfter) {
    const startAfterDoc = await db.collection('users').doc(uid).collection('sessions').doc(startAfter).get();
    if (!startAfterDoc.exists) {
      throw new HttpsError('invalid-argument', '無効なカーソルです');
    }
    query = query.startAfter(startAfterDoc);
  }

  // 4. データ取得
  const snapshot = await query.get();
  const sessions = snapshot.docs.slice(0, limit).map(doc => {
    const data = doc.data();
    return {
      sessionId: data.sessionId,
      exerciseType: data.exerciseType,
      startTime: data.startTime?.toDate().toISOString() || null,
      endTime: data.endTime?.toDate().toISOString() || null,
      duration: data.duration || null,
      status: data.status,
      repCount: data.repCount || 0,
      setCount: data.setCount || 0,
      overallScore: data.formFeedback?.overallScore || null,
      createdAt: data.createdAt.toDate().toISOString()
    };
  });

  const hasMore = snapshot.docs.length > limit;
  const nextCursor = hasMore ? sessions[sessions.length - 1].sessionId : null;

  console.log(`Sessions listed: userId=${uid}, count=${sessions.length}, hasMore=${hasMore}`);

  return {
    success: true,
    data: {
      sessions,
      hasMore,
      nextCursor
    }
  };
});
```

### 必要なFirestoreインデックス

```json
{
  "collectionGroup": "sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**種目フィルタ用インデックス**:

```json
{
  "collectionGroup": "sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "exerciseType", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `invalid-argument` | limitが範囲外、無効なカーソル | 400 |
| `internal` | Firestore読み取りエラー | 500 |

### パフォーマンス考慮事項

- **インデックスの事前作成**: デプロイ前に`firestore.indexes.json`で定義
- **limit + 1のテクニック**: 次ページの有無を1回のクエリで判定
- **カーソルベースページネーション**: offsetより効率的

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] 実装完了（2025-12-10）
- [x] レート制限実装完了（2025-12-10）
- [x] ローカルエミュレータ動作確認完了（2025-12-10）

## 完了日

2025-12-10（主要実装完了）

## 備考

- 単一セッション取得は別チケット（012）で実装済み
- セッション削除は別チケット（014）で実装
- インデックスの作成は`firestore.indexes.json`に定義し、デプロイ時に自動作成

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 主要実装完了 - listSessions API実装、ページネーション・種目フィルタ対応、ユニットテスト追加 |
| 2025-12-10 | レート制限実装完了（50回/時/ユーザー） |
| 2025-12-10 | ローカルエミュレータ動作確認完了 - 全項目完了 |
