# 033 課金状態同期関数

## 概要

Stripeの課金情報をFirestoreと同期し、さらにFirebase Authenticationのカスタムクレーム（ユーザーの権限情報）を更新する関数を実装するチケットです。これにより、ユーザーが課金するとすぐにプレミアム機能が使えるようになります。

## Phase

Phase 3（課金バックエンド実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/031（Stripe Webhook実装）
- common/032（サブスクリプション管理API）

## 要件

### 機能要件

- FR-029: 決済処理 - Stripe→Firestoreの課金状態同期

### 非機能要件

- NFR-034: アクセス制御 - 課金状態に基づくアクセス制御

## 受け入れ条件（Todo）

### Stripe→Firestore同期

- [ ] Webhookから受け取った情報をFirestoreに反映
- [ ] サブスクリプション状態のマッピングを定義
- [ ] 更新履歴を記録（監査ログ）
- [ ] 同期エラー時のリトライ処理

### カスタムクレーム更新

- [ ] premiumフラグをカスタムクレームに設定
- [ ] サブスクリプション終了日をカスタムクレームに設定
- [ ] カスタムクレーム更新後のトークン強制更新通知
- [ ] クレーム更新のログ記録

### 定期同期バッチ

- [ ] 毎日の同期チェックバッチを実装
- [ ] Stripe側とFirestore側の不整合を検出
- [ ] 不整合があった場合のアラート
- [ ] 自動修復機能

### テスト

- [ ] 同期処理の単体テスト
- [ ] カスタムクレーム更新のテスト
- [ ] 不整合検出のテスト

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - アクセス制御

## 技術詳細

### カスタムクレームとは

Firebase Authenticationのカスタムクレームは、ユーザーのトークンに埋め込まれる追加情報です。これを使うと、クライアント側でもサーバー側でも、ユーザーがプレミアム会員かどうかをすぐに判定できます。

```
ユーザートークン = {
  uid: "user123",
  email: "user@example.com",
  // カスタムクレーム
  premium: true,
  subscriptionEnd: 1735689600000  // Unix timestamp
}
```

### サブスクリプション状態のマッピング

```typescript
// Stripeの状態 → アプリの状態 → カスタムクレーム
const SUBSCRIPTION_STATUS_MAP = {
  // Stripe状態        アプリ状態      プレミアムフラグ
  'active':           { status: 'premium',   isPremium: true },
  'trialing':         { status: 'trial',     isPremium: true },
  'past_due':         { status: 'past_due',  isPremium: true },  // 猶予期間中
  'canceled':         { status: 'free',      isPremium: false },
  'unpaid':           { status: 'suspended', isPremium: false },
  'incomplete':       { status: 'pending',   isPremium: false },
  'incomplete_expired': { status: 'free',    isPremium: false },
  'paused':           { status: 'paused',    isPremium: false }
};
```

### 課金状態同期関数

```typescript
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface SyncResult {
  userId: string;
  previousStatus: string;
  newStatus: string;
  customClaimsUpdated: boolean;
}

/**
 * Stripeの課金情報をFirestoreとカスタムクレームに同期する
 *
 * @param userId FirebaseユーザーID
 * @param subscription Stripeサブスクリプション情報
 */
export async function syncBillingStatus(
  userId: string,
  subscription: Stripe.Subscription | null
): Promise<SyncResult> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);

  // 現在のユーザー情報を取得
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error(`ユーザーが見つかりません: ${userId}`);
  }

  const userData = userDoc.data()!;
  const previousStatus = userData.subscriptionStatus || 'free';

  // 新しい状態を決定
  let newStatus = 'free';
  let isPremium = false;
  let subscriptionEndDate: Date | null = null;

  if (subscription) {
    const mapping = SUBSCRIPTION_STATUS_MAP[subscription.status];
    if (mapping) {
      newStatus = mapping.status;
      isPremium = mapping.isPremium;
    }
    subscriptionEndDate = new Date(subscription.current_period_end * 1000);
  }

  // Firestoreを更新
  await userRef.update({
    subscriptionStatus: newStatus,
    subscriptionEndDate: subscriptionEndDate
      ? admin.firestore.Timestamp.fromDate(subscriptionEndDate)
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 同期履歴を記録（監査ログ）
  await db.collection('billingSyncLogs').add({
    userId,
    previousStatus,
    newStatus,
    stripeSubscriptionId: subscription?.id || null,
    syncedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // カスタムクレームを更新
  const customClaimsUpdated = await updateCustomClaims(
    userId,
    isPremium,
    subscriptionEndDate
  );

  console.log(`課金状態同期完了: ${userId} (${previousStatus} → ${newStatus})`);

  return {
    userId,
    previousStatus,
    newStatus,
    customClaimsUpdated
  };
}

/**
 * カスタムクレームを更新する
 *
 * @param userId FirebaseユーザーID
 * @param isPremium プレミアム会員かどうか
 * @param subscriptionEndDate サブスクリプション終了日
 */
async function updateCustomClaims(
  userId: string,
  isPremium: boolean,
  subscriptionEndDate: Date | null
): Promise<boolean> {
  try {
    // 現在のカスタムクレームを取得
    const user = await admin.auth().getUser(userId);
    const currentClaims = user.customClaims || {};

    // 新しいカスタムクレーム
    const newClaims = {
      ...currentClaims,
      premium: isPremium,
      subscriptionEnd: subscriptionEndDate
        ? subscriptionEndDate.getTime()
        : null,
      claimsUpdatedAt: Date.now()
    };

    // カスタムクレームを設定
    await admin.auth().setCustomUserClaims(userId, newClaims);

    // トークン強制更新フラグを設定（クライアントに通知）
    await admin.firestore().collection('users').doc(userId).update({
      tokenRefreshRequired: true,
      tokenRefreshAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`カスタムクレーム更新: ${userId} (premium: ${isPremium})`);
    return true;
  } catch (error) {
    console.error(`カスタムクレーム更新失敗: ${userId}`, error);
    return false;
  }
}
```

### Firestoreトリガーでの自動同期

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

/**
 * ユーザードキュメントが更新されたときにカスタムクレームを同期
 */
export const billing_onUserUpdated = onDocumentUpdated({
  document: 'users/{userId}',
  region: 'asia-northeast1'
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  // サブスクリプション状態が変わった場合のみ処理
  if (before.subscriptionStatus === after.subscriptionStatus) {
    return;
  }

  const userId = event.params.userId;

  console.log(`サブスクリプション状態変更検知: ${userId}`);

  // カスタムクレームを更新
  const isPremium = ['premium', 'trial', 'past_due'].includes(after.subscriptionStatus);
  const subscriptionEndDate = after.subscriptionEndDate?.toDate() || null;

  await updateCustomClaims(userId, isPremium, subscriptionEndDate);
});
```

### 定期同期チェックバッチ

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * 毎日午前5時にStripeとFirestoreの整合性をチェック
 */
export const billing_dailySync = onSchedule({
  schedule: 'every day 05:00',
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async () => {
  console.log('課金状態の定期同期チェック開始');

  const db = admin.firestore();
  const inconsistencies: Array<{
    userId: string;
    firestoreStatus: string;
    stripeStatus: string;
  }> = [];

  // プレミアムユーザーを取得
  const premiumUsers = await db.collection('users')
    .where('subscriptionStatus', 'in', ['premium', 'trial', 'past_due'])
    .get();

  for (const userDoc of premiumUsers.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    if (!userData.stripeSubscriptionId) {
      // Stripe IDがないのにプレミアム
      inconsistencies.push({
        userId,
        firestoreStatus: userData.subscriptionStatus,
        stripeStatus: 'no_subscription'
      });
      continue;
    }

    try {
      // Stripeから最新情報を取得
      const subscription = await stripe.subscriptions.retrieve(
        userData.stripeSubscriptionId
      );

      const expectedStatus = SUBSCRIPTION_STATUS_MAP[subscription.status]?.status || 'free';

      if (userData.subscriptionStatus !== expectedStatus) {
        inconsistencies.push({
          userId,
          firestoreStatus: userData.subscriptionStatus,
          stripeStatus: subscription.status
        });

        // 自動修復
        await syncBillingStatus(userId, subscription);
      }
    } catch (error) {
      // サブスクリプションが見つからない場合
      if ((error as any).code === 'resource_missing') {
        inconsistencies.push({
          userId,
          firestoreStatus: userData.subscriptionStatus,
          stripeStatus: 'not_found'
        });

        // 無料プランに戻す
        await syncBillingStatus(userId, null);
      } else {
        console.error(`Stripe取得エラー: ${userId}`, error);
      }
    }
  }

  if (inconsistencies.length > 0) {
    console.warn('不整合が見つかりました:', inconsistencies);

    // アラート送信
    await sendSlackAlert(
      `課金状態の不整合: ${inconsistencies.length}件\n` +
      inconsistencies.map(i =>
        `- ${i.userId}: Firestore=${i.firestoreStatus}, Stripe=${i.stripeStatus}`
      ).join('\n')
    );
  }

  console.log(`課金状態の定期同期チェック完了: ${premiumUsers.size}件チェック, ${inconsistencies.length}件修復`);
});
```

### クライアント側でのトークン更新

```typescript
// Expo/React Native側のコード例
import { getAuth, getIdTokenResult } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// ユーザードキュメントの変更を監視
const userId = auth.currentUser?.uid;
const unsubscribe = onSnapshot(doc(db, 'users', userId), async (snapshot) => {
  const data = snapshot.data();

  if (data?.tokenRefreshRequired) {
    // トークンを強制更新
    await auth.currentUser?.getIdToken(true);

    // フラグをリセット
    await updateDoc(doc(db, 'users', userId), {
      tokenRefreshRequired: false
    });

    // 新しいカスタムクレームを確認
    const tokenResult = await getIdTokenResult(auth.currentUser!);
    console.log('Premium:', tokenResult.claims.premium);
  }
});
```

### Firestoreセキュリティルールでの活用

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // プレミアム機能へのアクセス制御
    function isPremium() {
      return request.auth.token.premium == true;
    }

    function isSubscriptionValid() {
      return request.auth.token.subscriptionEnd > request.time.toMillis();
    }

    // プレミアム専用コレクション
    match /premiumFeatures/{docId} {
      allow read: if isPremium() && isSubscriptionValid();
    }
  }
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- カスタムクレームの更新は即座に反映されない（次回トークン更新時）
- トークン強制更新のためにクライアント側の実装も必要
- 不整合は1日1回のバッチで自動修復

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
