# 038 Stripe Webhookハンドラ

## 概要

Stripeから送られてくるイベント（支払い成功、サブスクリプション更新など）を受け取るWebhookエンドポイントを実装するチケットです。Webhookの署名検証、イベント処理、Firestoreへの反映を行います。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤
- 002: Firestore セキュリティルール

## 要件

### 機能要件

- なし（非機能要件のみ）

### 非機能要件

- NFR-013: Webhook（べき等性、リトライ対応）
- NFR-032: セキュリティ基準（署名検証）

## 受け入れ条件（Todo）

- [ ] `stripe_webhook` HTTP Functionを実装
- [ ] Webhookシグネチャ検証を実装
- [ ] 主要イベントハンドラを実装（下記5つ）
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] べき等性を担保する処理を実装（重複イベント防止）
- [ ] エラーハンドリングとリトライ対応を実装
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストでStripe CLIを使った動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8.2章（stripe_webhook）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-013

## 技術詳細

### Webhookエンドポイント

**エンドポイント**: `stripe_webhook`
**HTTPメソッド**: POST
**認証**: Stripeシグネチャ検証
**URL**: `https://asia-northeast1-{project-id}.cloudfunctions.net/stripe_webhook`

### 実装例

```typescript
// functions/src/webhooks/stripe/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { stripe } from '../../utils/stripe';

export const stripe_webhook = onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('Stripe署名がありません');
    res.status(400).send('Webhook Error: No signature');
    return;
  }

  let event: Stripe.Event;

  try {
    // Webhookシグネチャを検証
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook署名検証失敗:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(`Webhookイベント受信: ${event.type}`);

  try {
    // イベントタイプ別に処理を振り分け
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`未処理のイベント: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhookイベント処理エラー:', error);
    res.status(500).send('Webhook processing failed');
  }
});
```

### イベントハンドラ実装

#### 1. サブスクリプション作成

```typescript
// functions/src/webhooks/stripe/subscriptionCreated.ts
import * as admin from 'firebase-admin';

export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const firebaseUID = subscription.metadata.firebaseUID;

  if (!firebaseUID) {
    console.error('Firebase UIDがありません:', subscription.id);
    return;
  }

  await admin
    .firestore()
    .collection('users')
    .doc(firebaseUID)
    .update({
      subscriptionStatus: subscription.status === 'active' ? 'premium' : 'free',
      stripeSubscriptionId: subscription.id,
      subscriptionStartDate: admin.firestore.Timestamp.fromDate(
        new Date(subscription.current_period_start * 1000)
      ),
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(
        new Date(subscription.current_period_end * 1000)
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`サブスクリプション作成: ${firebaseUID}, ${subscription.id}`);
}
```

#### 2. サブスクリプション更新

```typescript
// functions/src/webhooks/stripe/subscriptionUpdated.ts
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const firebaseUID = subscription.metadata.firebaseUID;

  if (!firebaseUID) {
    console.error('Firebase UIDがありません:', subscription.id);
    return;
  }

  // ステータス変更を記録
  const statusMap: { [key: string]: string } = {
    active: 'premium',
    trialing: 'premium',
    past_due: 'past_due',
    canceled: 'free',
    incomplete: 'free',
  };

  await admin
    .firestore()
    .collection('users')
    .doc(firebaseUID)
    .update({
      subscriptionStatus: statusMap[subscription.status] || 'free',
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(
        new Date(subscription.current_period_end * 1000)
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`サブスクリプション更新: ${firebaseUID}, ステータス: ${subscription.status}`);
}
```

#### 3. サブスクリプション削除

```typescript
// functions/src/webhooks/stripe/subscriptionDeleted.ts
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const firebaseUID = subscription.metadata.firebaseUID;

  if (!firebaseUID) {
    console.error('Firebase UIDがありません:', subscription.id);
    return;
  }

  await admin
    .firestore()
    .collection('users')
    .doc(firebaseUID)
    .update({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      stripeSubscriptionId: null,
      subscriptionEndDate: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`サブスクリプション削除: ${firebaseUID}`);
}
```

#### 4. 支払い成功

```typescript
// functions/src/webhooks/stripe/invoicePaymentSucceeded.ts
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;

  const customer = await stripe.customers.retrieve(customerId);
  const firebaseUID = customer.metadata?.firebaseUID;

  if (!firebaseUID) {
    console.error('Firebase UIDがありません:', customerId);
    return;
  }

  // 支払い履歴を保存
  await admin.firestore().collection('payments').add({
    userId: firebaseUID,
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    paidAt: admin.firestore.Timestamp.fromDate(
      new Date(invoice.status_transitions.paid_at! * 1000)
    ),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`支払い成功: ${firebaseUID}, ${invoice.amount_paid / 100}円`);
}
```

#### 5. 支払い失敗

```typescript
// functions/src/webhooks/stripe/invoicePaymentFailed.ts
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  // チケット037で実装済み
  console.log(`支払い失敗: ${invoice.id}, 試行回数: ${invoice.attempt_count}`);
}
```

### べき等性の担保

```typescript
// Firestoreにイベント処理履歴を保存
async function isEventProcessed(eventId: string): Promise<boolean> {
  const eventDoc = await admin
    .firestore()
    .collection('webhookEvents')
    .doc(eventId)
    .get();

  return eventDoc.exists;
}

async function markEventAsProcessed(eventId: string): Promise<void> {
  await admin
    .firestore()
    .collection('webhookEvents')
    .doc(eventId)
    .set({
      eventId: eventId,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// Webhookハンドラで使用
if (await isEventProcessed(event.id)) {
  console.log(`イベント既に処理済み: ${event.id}`);
  res.json({ received: true });
  return;
}

// イベント処理...

await markEventAsProcessed(event.id);
```

### Stripe CLIでのテスト

```bash
# Stripe CLIをインストール
# https://stripe.com/docs/stripe-cli

# ローカルでWebhookをリッスン
stripe listen --forward-to http://localhost:5001/{project-id}/asia-northeast1/stripe_webhook

# テストイベントを送信
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### テストコード例

```typescript
// functions/tests/webhooks/stripe.test.ts
describe('Stripe Webhook', () => {
  it('subscription.createdイベントを処理できる', async () => {
    const event = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test123',
          metadata: { firebaseUID: 'test_user' },
          status: 'active',
        },
      },
    };

    await handleSubscriptionCreated(event.data.object);

    // Firestoreが更新されたか確認
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Webhookエンドポイントは必ず署名検証を行う（セキュリティ）
- べき等性を担保することで、重複イベントに対応
- Stripeは失敗時に自動でリトライする（最大3日間）
- StripeダッシュボードでWebhookエンドポイントを登録する必要がある
- テスト環境と本番環境でWebhook URLとシークレットが異なる

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
