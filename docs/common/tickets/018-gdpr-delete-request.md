# 018 GDPRデータ削除リクエストAPI

## 概要

GDPR第17条（削除権）を実装するチケットです。ユーザーがアカウント削除をリクエストした際、30日間の猶予期間を設け、その後自動的に全データを削除します。猶予期間中はキャンセル可能です。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-035: GDPR第17条（削除権）対応

### 非機能要件

- NFR-008: データ削除 - 30日猶予期間
- NFR-027: バックアップ・復旧機構

## 受け入れ条件（Todo）

- [ ] `gdpr_requestAccountDeletion` Callable Functionを実装
- [ ] `gdpr_cancelAccountDeletion` Callable Functionを実装
- [ ] 削除リクエスト時の処理実装（deletionScheduled=true、scheduledDeletionDate=+30日）
- [ ] DataDeletionRequestsコレクションへの記録実装
- [ ] キャンセル時の処理実装（deletionScheduled=false、status='cancelled'）
- [ ] 削除予定ユーザーのアクセス制御実装（読み取り専用）
- [ ] メール通知実装（削除リクエスト、キャンセル確認）
- [ ] レート制限（3回/月）を実装
- [ ] エラーハンドリング実装
- [ ] ユニットテスト実装（カバレッジ80%以上）
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション7（GDPR対応API）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション4.3.3（削除猶予期間管理）、セクション7（DataDeletionRequests）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-035
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠

## 技術詳細

### APIエンドポイント

#### 1. gdpr_requestAccountDeletion

**目的**: アカウント削除リクエスト（30日猶予期間）

**リクエスト**:

```typescript
interface RequestAccountDeletionRequest {
  // リクエストボディなし（認証ユーザーが対象）
}
```

**レスポンス**:

```typescript
interface RequestAccountDeletionResponse {
  success: true;
  data: {
    requestId: string;
    scheduledDeletionDate: string;  // 30日後のISO 8601形式
  };
  message: string;
}
```

#### 2. gdpr_cancelAccountDeletion

**目的**: 削除リクエストのキャンセル（30日以内）

**リクエスト**:

```typescript
interface CancelAccountDeletionRequest {
  // リクエストボディなし
}
```

**レスポンス**:

```typescript
interface CancelAccountDeletionResponse {
  success: true;
  message: string;
}
```

### 実装例

#### gdpr_requestAccountDeletion

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

export const gdpr_requestAccountDeletion = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 2. ユーザー情報取得
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  // 3. すでに削除予定の場合はエラー
  if (userData.deletionScheduled) {
    throw new HttpsError(
      'failed-precondition',
      'すでに削除がリクエストされています。'
    );
  }

  // 4. 削除予定日を計算（30日後）
  const now = new Date();
  const scheduledDeletionDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 5. Usersコレクションを更新
  await userRef.update({
    deletionScheduled: true,
    deletionScheduledAt: FieldValue.serverTimestamp(),
    scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
    updatedAt: FieldValue.serverTimestamp()
  });

  // 6. DataDeletionRequestsコレクションに記録
  const deletionRequestRef = db.collection('dataDeletionRequests').doc();
  await deletionRequestRef.set({
    requestId: deletionRequestRef.id,
    userId: uid,
    requestedAt: FieldValue.serverTimestamp(),
    scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
    status: 'pending',
    completedAt: null,
    cancelledAt: null
  });

  console.log(`Deletion requested: userId=${uid}, requestId=${deletionRequestRef.id}`);

  // 7. メール通知（実装は別途）
  // await sendDeletionRequestEmail(userData.email, scheduledDeletionDate);

  return {
    success: true,
    data: {
      requestId: deletionRequestRef.id,
      scheduledDeletionDate: scheduledDeletionDate.toISOString()
    },
    message: `アカウント削除をリクエストしました。${scheduledDeletionDate.toLocaleDateString('ja-JP')}に削除されます。`
  };
});
```

#### gdpr_cancelAccountDeletion

```typescript
export const gdpr_cancelAccountDeletion = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 2. ユーザー情報取得
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  // 3. 削除予定でない場合はエラー
  if (!userData.deletionScheduled) {
    throw new HttpsError(
      'failed-precondition',
      '削除リクエストが存在しません。'
    );
  }

  // 4. 削除予定日を過ぎている場合はエラー
  const scheduledDeletionDate = userData.scheduledDeletionDate.toDate();
  if (new Date() > scheduledDeletionDate) {
    throw new HttpsError(
      'failed-precondition',
      '削除予定日を過ぎているため、キャンセルできません。'
    );
  }

  // 5. Usersコレクションを更新
  await userRef.update({
    deletionScheduled: false,
    deletionScheduledAt: null,
    scheduledDeletionDate: null,
    updatedAt: FieldValue.serverTimestamp()
  });

  // 6. DataDeletionRequestsコレクションを更新
  const deletionRequestQuery = await db.collection('dataDeletionRequests')
    .where('userId', '==', uid)
    .where('status', '==', 'pending')
    .get();

  for (const doc of deletionRequestQuery.docs) {
    await doc.ref.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp()
    });
  }

  console.log(`Deletion cancelled: userId=${uid}`);

  // 7. メール通知（実装は別途）
  // await sendDeletionCancelledEmail(userData.email);

  return {
    success: true,
    message: 'アカウント削除をキャンセルしました。'
  };
});
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `not-found` | ユーザーが存在しない | 404 |
| `failed-precondition` | すでに削除予定、削除予定日超過 | 412 |
| `internal` | Firestore更新エラー | 500 |

### 削除予定ユーザーのアクセス制御

#### Firestoreセキュリティルール

```javascript
match /users/{userId} {
  // 削除予定ユーザーは読み取りのみ許可
  allow read: if request.auth != null
              && request.auth.uid == userId;

  // 削除予定ユーザーは書き込み禁止
  allow write: if request.auth != null
               && request.auth.uid == userId
               && !resource.data.deletionScheduled
               && !request.resource.data.deletionScheduled;
}
```

#### Cloud Functionsでのチェック

```typescript
async function checkDeletionScheduled(uid: string): Promise<boolean> {
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.data()?.deletionScheduled === true;
}
```

### メール通知実装

```typescript
import * as sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

async function sendDeletionRequestEmail(email: string, deletionDate: Date) {
  const msg = {
    to: email,
    from: 'noreply@ai-fitness-app.com',
    subject: 'アカウント削除リクエストを受け付けました',
    text: `
      アカウント削除リクエストを受け付けました。

      削除予定日: ${deletionDate.toLocaleDateString('ja-JP')}

      この日までにキャンセルすることができます。
      キャンセルする場合は、アプリの設定画面から「削除をキャンセル」を選択してください。
    `,
    html: `
      <p>アカウント削除リクエストを受け付けました。</p>
      <p><strong>削除予定日</strong>: ${deletionDate.toLocaleDateString('ja-JP')}</p>
      <p>この日までにキャンセルすることができます。</p>
    `
  };

  await sgMail.send(msg);
}
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- 実際の削除処理は別チケット（019）で実装
- メール通知はSendGrid使用を想定（環境変数で設定）
- レート制限のミドルウェアはチケット009で実装済みを想定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
