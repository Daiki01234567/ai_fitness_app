# 032 サブスクリプション管理API

## 概要

ユーザーがサブスクリプション（定期課金）を確認・変更・解約できるAPIを実装するチケットです。アプリからこれらのAPIを呼び出すことで、ユーザーは自分のプランを管理できます。

## Phase

Phase 3（課金バックエンド実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/031（Stripe Webhook実装）

## 要件

### 機能要件

- FR-030: サブスクリプション管理 - ユーザーがプランを確認・変更・解約できる

### 非機能要件

- NFR-034: アクセス制御 - 本人のみがサブスクリプションを管理可能

## 受け入れ条件（Todo）

### サブスクリプション状態取得API

- [ ] 現在のサブスクリプション状態を返すAPIを実装
- [ ] プラン情報（名前、価格、更新日）を返す
- [ ] 次回の請求予定を表示
- [ ] 支払い方法の最後4桁を表示

### プラン変更API

- [ ] 月額プランから年額プランへの変更を実装
- [ ] 年額プランから月額プランへの変更を実装
- [ ] 即時適用と次回更新時適用の選択
- [ ] プラン変更時の差額計算

### サブスクリプション解約API

- [ ] 解約リクエストを受け付ける
- [ ] 次回更新日まで利用可能にする
- [ ] 解約理由を記録する
- [ ] 解約確認メールを送信

### カスタマーポータル

- [ ] Stripe Customer Portal URLを生成するAPIを実装
- [ ] ユーザーが自分で支払い方法を変更可能にする

### テスト

- [ ] 各APIの正常系テスト
- [ ] 権限チェックのテスト
- [ ] Stripeとの連携テスト

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - ユーザーデータ構造

## 技術詳細

### API一覧

| API名 | 説明 | レート制限 |
|------|------|-----------|
| `subscription_getStatus` | サブスクリプション状態取得 | 60回/時 |
| `subscription_changePlan` | プラン変更 | 10回/日 |
| `subscription_cancel` | サブスクリプション解約 | 3回/月 |
| `subscription_getPortalUrl` | カスタマーポータルURL取得 | 10回/時 |

### サブスクリプション状態取得API

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface SubscriptionStatusResponse {
  success: true;
  data: {
    status: string;
    plan: {
      name: string;
      price: number;
      currency: string;
      interval: 'month' | 'year';
    } | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentMethod: {
      brand: string;
      last4: string;
    } | null;
  };
}

/**
 * サブスクリプション状態を取得するAPI
 *
 * ユーザーの現在のサブスクリプション状態を返します。
 * プラン情報、次回更新日、支払い方法などを含みます。
 */
export const subscription_getStatus = onCall({
  region: 'asia-northeast1',
  maxInstances: 10,
}, async (request): Promise<SubscriptionStatusResponse> => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const userId = request.auth.uid;

  // ユーザー情報を取得
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  // 無料プランの場合
  if (!userData.stripeSubscriptionId) {
    return {
      success: true,
      data: {
        status: 'free',
        plan: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentMethod: null
      }
    };
  }

  // Stripeからサブスクリプション情報を取得
  const subscription = await stripe.subscriptions.retrieve(
    userData.stripeSubscriptionId,
    { expand: ['default_payment_method'] }
  );

  // プラン情報を抽出
  const priceItem = subscription.items.data[0];
  const price = priceItem.price;

  // 支払い方法を抽出
  let paymentMethod = null;
  if (subscription.default_payment_method &&
      typeof subscription.default_payment_method !== 'string') {
    const pm = subscription.default_payment_method;
    if (pm.type === 'card' && pm.card) {
      paymentMethod = {
        brand: pm.card.brand,
        last4: pm.card.last4
      };
    }
  }

  return {
    success: true,
    data: {
      status: userData.subscriptionStatus,
      plan: {
        name: price.nickname || 'プレミアムプラン',
        price: price.unit_amount! / 100, // 日本円の場合は100で割る必要なし
        currency: price.currency,
        interval: price.recurring?.interval as 'month' | 'year'
      },
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod
    }
  };
});
```

### プラン変更API

```typescript
interface ChangePlanRequest {
  newPriceId: string;  // 新しいプランのStripe Price ID
  prorationBehavior: 'create_prorations' | 'none' | 'always_invoice';
}

/**
 * サブスクリプションプランを変更するAPI
 *
 * 月額プランから年額プラン、またはその逆に変更します。
 * prorationBehaviorで差額の扱いを指定できます。
 */
export const subscription_changePlan = onCall({
  region: 'asia-northeast1',
  maxInstances: 10,
}, async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const userId = request.auth.uid;
  const { newPriceId, prorationBehavior } = request.data as ChangePlanRequest;

  // 入力バリデーション
  if (!newPriceId) {
    throw new HttpsError('invalid-argument', 'プランIDが必要です');
  }

  // ユーザー情報を取得
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  if (!userData.stripeSubscriptionId) {
    throw new HttpsError('failed-precondition', '有効なサブスクリプションがありません');
  }

  // 現在のサブスクリプションを取得
  const subscription = await stripe.subscriptions.retrieve(
    userData.stripeSubscriptionId
  );

  // プランを変更
  const updatedSubscription = await stripe.subscriptions.update(
    userData.stripeSubscriptionId,
    {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId
      }],
      proration_behavior: prorationBehavior || 'create_prorations'
    }
  );

  // Firestoreを更新
  const interval = updatedSubscription.items.data[0].price.recurring?.interval;
  await admin.firestore().collection('users').doc(userId).update({
    subscriptionPlan: interval === 'year' ? 'yearly' : 'monthly',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('プラン変更完了:', userId, newPriceId);

  return {
    success: true,
    data: {
      newPlan: interval === 'year' ? 'yearly' : 'monthly'
    },
    message: 'プランを変更しました'
  };
});
```

### サブスクリプション解約API

```typescript
interface CancelSubscriptionRequest {
  reason?: string;         // 解約理由
  feedback?: string;       // フィードバック
  cancelImmediately?: boolean;  // 即時解約（通常はfalse）
}

/**
 * サブスクリプションを解約するAPI
 *
 * サブスクリプションを解約します。
 * 通常は次回更新日まで利用可能です（即時解約も可能）。
 */
export const subscription_cancel = onCall({
  region: 'asia-northeast1',
  maxInstances: 10,
}, async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const userId = request.auth.uid;
  const { reason, feedback, cancelImmediately } = request.data as CancelSubscriptionRequest;

  // ユーザー情報を取得
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  if (!userData.stripeSubscriptionId) {
    throw new HttpsError('failed-precondition', '有効なサブスクリプションがありません');
  }

  // 解約理由を記録
  await admin.firestore()
    .collection('users')
    .doc(userId)
    .collection('cancellationReasons')
    .add({
      reason: reason || 'not_specified',
      feedback: feedback || null,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp()
    });

  let subscription;

  if (cancelImmediately) {
    // 即時解約
    subscription = await stripe.subscriptions.cancel(
      userData.stripeSubscriptionId
    );
  } else {
    // 次回更新日に解約（更新日まで利用可能）
    subscription = await stripe.subscriptions.update(
      userData.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
  }

  // Firestoreを更新
  await admin.firestore().collection('users').doc(userId).update({
    cancelAtPeriodEnd: !cancelImmediately,
    subscriptionStatus: cancelImmediately ? 'free' : userData.subscriptionStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('解約処理完了:', userId, cancelImmediately ? '即時' : '更新日');

  return {
    success: true,
    data: {
      cancelledAt: cancelImmediately
        ? new Date().toISOString()
        : new Date(subscription.current_period_end * 1000).toISOString(),
      immediate: cancelImmediately
    },
    message: cancelImmediately
      ? 'サブスクリプションを解約しました'
      : '次回更新日にサブスクリプションが終了します'
  };
});
```

### カスタマーポータルURL取得API

```typescript
/**
 * Stripe Customer PortalのURLを取得するAPI
 *
 * ユーザーが自分で支払い方法を変更したり、
 * 請求履歴を確認したりできるポータルへのURLを返します。
 */
export const subscription_getPortalUrl = onCall({
  region: 'asia-northeast1',
  maxInstances: 10,
}, async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const userId = request.auth.uid;

  // ユーザー情報を取得
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  if (!userData.stripeCustomerId) {
    throw new HttpsError('failed-precondition', 'Stripe顧客情報がありません');
  }

  // Customer Portalセッションを作成
  const session = await stripe.billingPortal.sessions.create({
    customer: userData.stripeCustomerId,
    return_url: `${process.env.APP_URL}/settings/subscription`
  });

  return {
    success: true,
    data: {
      url: session.url
    }
  };
});
```

### 解約理由の選択肢

```typescript
const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: '料金が高い' },
  { id: 'not_using', label: 'あまり使わなくなった' },
  { id: 'missing_features', label: '欲しい機能がない' },
  { id: 'technical_issues', label: '技術的な問題がある' },
  { id: 'found_alternative', label: '他のサービスを見つけた' },
  { id: 'temporary', label: '一時的に利用を停止したい' },
  { id: 'other', label: 'その他' }
];
```

## 見積もり

- 工数: 4日
- 難易度: 中〜高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Customer Portalの設定はStripeダッシュボードで行う
- 解約理由は製品改善に活用する
- 年額プランへの変更時は割引を検討

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
