# 017 削除スケジューリング関数

## 概要

30日の猶予期間が過ぎたアカウントを自動で完全削除するスケジュール関数を実装します。

チケット016で「30日後に削除します」と設定しましたが、実際に削除する処理がこのチケットです。毎日自動で実行されて、期限が来たアカウントを消します。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/016: アカウント削除API

## 要件

### スケジュール関数（毎日実行）

1. **日次実行**: 毎日午前4時（日本時間）に実行
2. **対象検出**: scheduledDeletionDateが過去のユーザーを検索
3. **バッチ処理**: 一度に複数ユーザーを処理

### 30日経過ユーザー検出

1. **Firestoreクエリ**: scheduledDeletionDateが現在日時より前のユーザーを取得
2. **ステータスチェック**: status=pendingのリクエストのみ処理

### 完全削除処理

以下のデータを全て削除します：

1. **Firestore**:
   - usersドキュメント
   - sessions サブコレクション
   - 関連する全サブコレクション

2. **Firebase Storage**:
   - ユーザーのアップロードファイル

3. **Firebase Authentication**:
   - 認証アカウント

4. **BigQuery**:
   - 仮名化されたデータも削除（user_id_hashで特定）

5. **Stripe（課金ユーザーの場合）**:
   - 顧客情報
   - サブスクリプション

### 削除ログ記録

1. **監査ログ**: 誰のデータをいつ削除したか記録
2. **保存期間**: 削除ログは1年間保存（法的要件）

## 受け入れ条件

- [ ] スケジュール関数が毎日4時に実行される
- [ ] 30日経過したユーザーが検出される
- [ ] Firestoreのユーザーデータが削除される
- [ ] 全サブコレクションが削除される
- [ ] Firebase Storageのファイルが削除される
- [ ] Firebase Authのアカウントが削除される
- [ ] BigQueryの仮名化データが削除される
- [ ] Stripeの顧客情報が削除される（課金ユーザーのみ）
- [ ] dataDeletionRequestsのstatusがcompletedになる
- [ ] 削除ログが記録される

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション9.2（gdpr_executeScheduledDeletions）
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - セクション8.2（削除手順）

## 技術詳細

### スケジュール関数の実装

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

/**
 * 毎日4時に実行される削除スケジューラ
 *
 * 30日の猶予期間が過ぎたアカウントを自動で完全削除します。
 */
export const gdpr_executeScheduledDeletions = onSchedule(
  {
    schedule: '0 4 * * *',  // 毎日4:00 (UTC)
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
    retryCount: 3,  // 失敗時は3回リトライ
  },
  async (event) => {
    const firestore = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // 削除予定日が過去のリクエストを取得
    const pendingDeletions = await firestore
      .collection('dataDeletionRequests')
      .where('status', '==', 'pending')
      .where('scheduledDeletionDate', '<=', now)
      .limit(100)  // 一度に100件まで処理
      .get();

    console.log(`Found ${pendingDeletions.size} accounts to delete`);

    // 各ユーザーを削除
    for (const doc of pendingDeletions.docs) {
      const request = doc.data();
      try {
        await deleteUserCompletely(request.userId);

        // リクエストを完了に更新
        await doc.ref.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Successfully deleted user: ${request.userId}`);
      } catch (error) {
        console.error(`Failed to delete user ${request.userId}:`, error);
        // エラーログを記録（DLQに似た仕組み）
        await logDeletionError(request.userId, error);
      }
    }
  }
);
```

### 完全削除処理の実装

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * ユーザーデータを完全に削除する
 */
async function deleteUserCompletely(userId: string): Promise<void> {
  const firestore = admin.firestore();
  const auth = admin.auth();
  const storage = admin.storage();

  // 1. ユーザー情報を取得（Stripe IDなどを取得するため）
  const userDoc = await firestore.collection('users').doc(userId).get();
  const userData = userDoc.data();

  // 2. BigQueryの仮名化データを削除
  await deleteBigQueryData(userId);

  // 3. Stripeの顧客情報を削除（課金ユーザーのみ）
  if (userData?.stripeCustomerId) {
    await deleteStripeCustomer(userData.stripeCustomerId);
  }

  // 4. Firebase Storageのファイルを削除
  await deleteUserStorage(userId);

  // 5. Firestoreの全サブコレクションを削除
  await deleteUserFirestoreData(userId);

  // 6. Firebase Authのアカウントを削除
  await auth.deleteUser(userId);

  // 7. 削除ログを記録
  await logDeletion(userId);
}

/**
 * Firestoreのユーザーデータを完全削除
 */
async function deleteUserFirestoreData(userId: string): Promise<void> {
  const firestore = admin.firestore();

  // サブコレクションのリスト
  const subcollections = ['sessions', 'settings', 'notifications'];

  // 各サブコレクションを削除
  for (const subcollection of subcollections) {
    const snapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection(subcollection)
      .get();

    // バッチで削除（500件ずつ）
    const batchSize = 500;
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = firestore.batch();
      const chunk = snapshot.docs.slice(i, i + batchSize);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // ユーザードキュメント本体を削除
  await firestore.collection('users').doc(userId).delete();
}

/**
 * BigQueryのデータを削除
 */
async function deleteBigQueryData(userId: string): Promise<void> {
  const { BigQuery } = require('@google-cloud/bigquery');
  const bigquery = new BigQuery();

  // ユーザーIDをハッシュ化
  const userIdHash = pseudonymizeUserId(userId);

  // 各テーブルから削除
  const tables = ['sessions', 'frames', 'user_aggregates'];
  for (const table of tables) {
    const query = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.analytics_production.${table}\`
      WHERE user_id_hash = @userIdHash
    `;
    await bigquery.query({
      query,
      params: { userIdHash },
    });
  }
}

/**
 * Stripe顧客を削除
 */
async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    // アクティブなサブスクリプションをキャンセル
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    for (const subscription of subscriptions.data) {
      await stripe.subscriptions.cancel(subscription.id);
    }

    // 顧客を削除
    await stripe.customers.del(customerId);
  } catch (error) {
    console.error('Stripe customer deletion error:', error);
    throw error;
  }
}

/**
 * Firebase Storageのファイルを削除
 */
async function deleteUserStorage(userId: string): Promise<void> {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({
    prefix: `users/${userId}/`,
  });

  for (const file of files) {
    await file.delete();
  }
}

/**
 * 削除ログを記録
 */
async function logDeletion(userId: string): Promise<void> {
  const firestore = admin.firestore();

  await firestore.collection('deletionLogs').add({
    userId: userId,  // 監査目的で一時保存
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    deletedBy: 'scheduled_deletion',  // scheduled_deletion, manual, admin
    // 1年後に自動削除（GDPR監査用に一時保存）
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    ),
  });
}
```

### 削除の流れ図

```
毎日4:00 (JST)
    ↓
scheduledDeletionDate <= 現在日時 のユーザーを検索
    ↓
各ユーザーに対して:
    ↓
1. BigQueryデータ削除（仮名化データ）
    ↓
2. Stripe顧客削除（課金ユーザーのみ）
    ↓
3. Firebase Storageファイル削除
    ↓
4. Firestore全データ削除
    ↓
5. Firebase Auth削除
    ↓
6. 削除ログ記録
    ↓
リクエストを「完了」に更新
```

### エラーハンドリング

- 1つのユーザーで失敗しても、他のユーザーの処理は継続
- 失敗したユーザーはログに記録し、次回の実行で再試行
- 3回連続で失敗した場合は管理者にアラート

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-036 | データ消去権（GDPR第17条） |
| NFR-029 | GDPR準拠 |

## 見積もり

5日

## 進捗

- [ ] 未着手
