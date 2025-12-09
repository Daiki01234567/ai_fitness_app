# 014 セッション削除API

## 概要

トレーニングセッションを削除するAPIを実装するチケットです。ユーザーが不要なトレーニング記録を削除できるようにします。物理削除ではなく、論理削除（ステータスを'cancelled'に変更）を実装します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-011: トレーニングセッション削除機能

### 非機能要件

- NFR-001: レスポンス時間 - 95パーセンタイル 200ms以内
- NFR-026: レート制限（20回/時/ユーザー）

## 受け入れ条件（Todo）

- [ ] `training_deleteSession` Callable Functionを実装
- [ ] 論理削除の実装（statusを'cancelled'に変更）
- [ ] リクエストデータのバリデーション実装（sessionId）
- [ ] 本人確認の実装（他人のセッションは削除不可）
- [ ] 削除予定ユーザーは削除不可（書き込み禁止）
- [ ] レート制限（20回/時）を実装
- [ ] エラーハンドリング実装
- [ ] ユニットテスト実装（カバレッジ80%以上）
- [ ] 削除操作のログ出力実装
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション6（トレーニングセッションAPI）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション5（Sessionsコレクション）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-011

## 技術詳細

### APIエンドポイント

#### training_deleteSession

**目的**: トレーニングセッションの削除（論理削除）

**リクエスト**:

```typescript
interface DeleteSessionRequest {
  sessionId: string;
}
```

**レスポンス**:

```typescript
interface DeleteSessionResponse {
  success: true;
  data: {
    sessionId: string;
    status: 'cancelled';
    deletedAt: string;
  };
  message: string;
}
```

### バリデーション

#### 必須チェック

1. **認証チェック**: `request.auth`が存在すること
2. **削除予定ユーザーチェック**: `deletionScheduled`がfalseであること
3. **sessionId**: 空文字列でないこと
4. **本人確認**: セッションの`userId`がリクエストユーザーと一致すること
5. **セッション存在確認**: セッションが存在すること

### 実装例

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { checkDeletionScheduled } from '../middleware/auth';

export const training_deleteSession = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { sessionId } = request.data;

  // 2. 削除予定ユーザーチェック
  if (await checkDeletionScheduled(uid)) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、データを変更できません。'
    );
  }

  // 3. バリデーション
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionIdが無効です');
  }

  // 4. Firestoreから取得
  const db = getFirestore();
  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);

  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError('not-found', 'セッションが見つかりません');
  }

  const sessionData = sessionDoc.data()!;

  // 5. 本人確認
  if (sessionData.userId !== uid) {
    throw new HttpsError('permission-denied', '他人のセッションは削除できません');
  }

  // 6. 論理削除（statusを'cancelled'に変更）
  await sessionRef.update({
    status: 'cancelled',
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log(`Session deleted (logical): userId=${uid}, sessionId=${sessionId}`);

  return {
    success: true,
    data: {
      sessionId,
      status: 'cancelled',
      deletedAt: new Date().toISOString()
    },
    message: 'セッションを削除しました'
  };
});
```

### 論理削除 vs 物理削除

#### 論理削除を採用する理由

- **データ保全**: 誤削除時の復旧が可能
- **分析用**: 削除されたセッションも統計分析に含められる
- **GDPR対応**: ユーザーが完全削除を要求した場合は別途対応（チケット018）

#### 物理削除が必要な場合

- ユーザーがGDPR第17条（削除権）を行使した場合
- データ保持期限（3年）が経過した場合

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `permission-denied` | 削除予定ユーザー、他人のセッション | 403 |
| `invalid-argument` | sessionIdが無効 | 400 |
| `not-found` | セッションが存在しない | 404 |
| `internal` | Firestore更新エラー | 500 |

### Firestoreセキュリティルール

```javascript
match /users/{userId}/sessions/{sessionId} {
  // 削除予定ユーザーは書き込み不可
  allow update: if request.auth != null
                && request.auth.uid == userId
                && !get(/databases/$(database)/documents/users/$(userId)).data.deletionScheduled;

  // 物理削除はCloud Functionsのみ
  allow delete: if false;
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

- 物理削除はチケット018（GDPR削除リクエスト）で実装
- 削除されたセッションは履歴一覧に表示されないようフィルタリングが必要（クライアント側）
- BigQueryには論理削除されたセッションも含めて同期（分析用）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
