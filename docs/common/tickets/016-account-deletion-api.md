# 016 アカウント削除API

## 概要

ユーザーがアカウントを削除できるAPIを実装します。

GDPR（ヨーロッパのプライバシー法）では、ユーザーが「データを消してほしい」と言ったら、削除しないといけません。これを「消去権」または「忘れられる権利」といいます。

ただし、いきなり消すと「間違えて押しちゃった！」という人が困るので、**30日間の猶予期間**を設けます。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/002: Firestoreセキュリティルール実装
- common/003: Firebase Authentication 統合

## 要件

### 削除リクエストAPI

1. **削除リクエスト受付**: ユーザーからの削除リクエストを受け付け
2. **30日猶予期間設定**: すぐには削除せず、30日間待機
3. **deletionScheduledフラグ管理**: 削除予定状態を管理

### 削除キャンセルAPI

1. **キャンセル受付**: 30日以内ならキャンセル可能
2. **フラグリセット**: deletionScheduledをfalseに戻す
3. **通常状態に復帰**: データの読み書きが再び可能に

### 削除予定ユーザーの制限

削除予定のユーザーは、以下のように制限されます：

1. **読み取り**: 可能（データを確認・エクスポートできる）
2. **書き込み**: 不可（新しいデータを保存できない）
3. **削除キャンセル**: 可能

## 受け入れ条件

- [ ] 削除リクエストAPIが動作する
- [ ] deletionScheduledがtrueになる
- [ ] scheduledDeletionDateが30日後に設定される
- [ ] dataDeletionRequestsコレクションに記録される
- [ ] キャンセルAPIでdeletionScheduledがfalseに戻る
- [ ] 削除予定ユーザーは新規データを作成できない
- [ ] レート制限（3回/月）が適用される

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション7.2（gdpr_requestAccountDeletion）、7.3（gdpr_cancelAccountDeletion）
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - セクション8（データ保存期間と削除）

## 技術詳細

### APIエンドポイント

| 関数名 | メソッド | 説明 | レート制限 |
|--------|---------|------|-----------|
| `gdpr_requestAccountDeletion` | POST | 削除リクエスト | 3回/月 |
| `gdpr_cancelAccountDeletion` | POST | 削除キャンセル | 10回/月 |
| `gdpr_getDeletionStatus` | GET | 削除状況確認 | 20回/日 |

### リクエスト/レスポンス

```typescript
// 削除リクエストのレスポンス
interface AccountDeletionResponse {
  success: true;
  data: {
    requestId: string;              // リクエストID
    scheduledDeletionDate: string;  // 削除予定日（30日後）
  };
  message: string;
}

// キャンセルのレスポンス
interface CancelDeletionResponse {
  success: true;
  data: {
    requestId: string;
    status: 'cancelled';
  };
  message: string;
}
```

### 削除リクエストAPIの実装

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const gdpr_requestAccountDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const firestore = admin.firestore();

  // 既に削除予定かチェック
  const userDoc = await firestore.collection('users').doc(uid).get();
  if (userDoc.data()?.deletionScheduled) {
    throw new HttpsError(
      'already-exists',
      '既に削除がスケジュールされています'
    );
  }

  // 30日後の日付を計算
  const scheduledDeletionDate = new Date();
  scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

  // トランザクションで更新
  const requestId = firestore.collection('dataDeletionRequests').doc().id;

  await firestore.runTransaction(async (transaction) => {
    // ユーザードキュメントを更新
    transaction.update(firestore.collection('users').doc(uid), {
      deletionScheduled: true,
      deletionScheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 削除リクエストを記録
    transaction.set(firestore.collection('dataDeletionRequests').doc(requestId), {
      requestId: requestId,
      userId: uid,
      status: 'pending',  // pending, cancelled, completed
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
      cancelledAt: null,
      completedAt: null,
    });
  });

  // メール通知を送信
  await sendDeletionConfirmationEmail(uid, scheduledDeletionDate);

  return {
    success: true,
    data: {
      requestId,
      scheduledDeletionDate: scheduledDeletionDate.toISOString(),
    },
    message: `アカウント削除をスケジュールしました。${scheduledDeletionDate.toLocaleDateString('ja-JP')}に完全に削除されます。30日以内であればキャンセル可能です。`,
  };
});
```

### キャンセルAPIの実装

```typescript
export const gdpr_cancelAccountDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const firestore = admin.firestore();

  // 削除予定かチェック
  const userDoc = await firestore.collection('users').doc(uid).get();
  if (!userDoc.data()?.deletionScheduled) {
    throw new HttpsError(
      'failed-precondition',
      '削除はスケジュールされていません'
    );
  }

  // 削除リクエストを取得
  const requestsSnapshot = await firestore
    .collection('dataDeletionRequests')
    .where('userId', '==', uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (requestsSnapshot.empty) {
    throw new HttpsError('not-found', '削除リクエストが見つかりません');
  }

  const requestDoc = requestsSnapshot.docs[0];

  // トランザクションでキャンセル
  await firestore.runTransaction(async (transaction) => {
    // ユーザードキュメントを更新
    transaction.update(firestore.collection('users').doc(uid), {
      deletionScheduled: false,
      deletionScheduledAt: null,
      scheduledDeletionDate: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 削除リクエストをキャンセル
    transaction.update(requestDoc.ref, {
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    data: {
      requestId: requestDoc.id,
      status: 'cancelled',
    },
    message: 'アカウント削除をキャンセルしました。引き続きサービスをご利用いただけます。',
  };
});
```

### Firestoreコレクション構造

```
dataDeletionRequests/
└── {requestId}/
    ├── requestId: string          // リクエストID
    ├── userId: string             // ユーザーID
    ├── status: string             // pending, cancelled, completed
    ├── requestedAt: Timestamp     // リクエスト日時
    ├── scheduledDeletionDate: Timestamp  // 削除予定日
    ├── cancelledAt: Timestamp | null     // キャンセル日時
    └── completedAt: Timestamp | null     // 完了日時
```

### 削除予定ユーザーの制限（Firestoreルール）

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 削除予定ユーザーは書き込み不可
    match /users/{userId}/sessions/{sessionId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId
                   && !get(/databases/$(database)/documents/users/$(userId)).data.deletionScheduled;
    }
  }
}
```

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-036 | データ消去権（GDPR第17条） |
| NFR-029 | GDPR準拠 |

## 見積もり

4日

## 進捗

- [ ] 未着手
