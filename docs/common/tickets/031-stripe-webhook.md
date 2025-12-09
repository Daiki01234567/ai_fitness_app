# 031 Stripe Webhook実装

## 概要

Stripeから送られてくる決済イベント（支払い完了、サブスクリプション更新など）を受け取り、処理するWebhookエンドポイントを実装するチケットです。Webhookを使うことで、Stripeでの決済状況をリアルタイムでFirestoreに反映できます。

## Phase

Phase 3（課金バックエンド実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/003（Firebase Authentication統合）

## 要件

### 機能要件

- FR-029: 決済処理 - Stripeを使用した決済処理

### 非機能要件

- NFR-013: Webhook - 外部サービスからのイベント処理

## 受け入れ条件（Todo）

### Webhook基盤

- [ ] Stripe Webhook用のHTTPエンドポイントを作成
- [ ] Stripe署名検証を実装（セキュリティ対策）
- [ ] rawBodyを取得できるように設定
- [ ] 環境変数にWebhook Secretを設定

### イベント処理実装

- [ ] `checkout.session.completed` の処理を実装
- [ ] `customer.subscription.created` の処理を実装
- [ ] `customer.subscription.updated` の処理を実装
- [ ] `customer.subscription.deleted` の処理を実装
- [ ] `invoice.payment_succeeded` の処理を実装
- [ ] `invoice.payment_failed` の処理を実装

### Firestore連携

- [ ] ユーザーの課金ステータスを更新
- [ ] 課金履歴を保存
- [ ] カスタムクレームの更新トリガー

### エラーハンドリング

- [ ] 処理失敗時のリトライ戦略を実装
- [ ] Dead Letter Queue（DLQ）を設定
- [ ] エラー発生時のSlack通知
- [ ] 詳細なログ出力

### テスト

- [ ] Stripe CLIを使ったローカルテスト
- [ ] 各イベントの処理テスト
- [ ] 署名検証のテスト
- [ ] 異常系のテスト

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - stripe_webhook仕様
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - Webhook署名検証

## 技術詳細

### Stripeの仕組み

Stripeは決済処理サービスです。ユーザーがクレジットカードで支払うと、Stripeが安全に処理し、結果をWebhookで通知します。

```
ユーザー → アプリ → Stripe（決済処理）
                     ↓ Webhook
                Cloud Functions → Firestore（状態更新）
```

### 環境変数の設定

```bash
# Firebase環境変数に設定
firebase functions:config:set stripe.secret_key="sk_test_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

### Webhook実装

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Stripe Webhookを受け取るエンドポイント
 *
 * Stripeからのイベントを受け取り、ユーザーの課金状態を更新します。
 * 署名検証により、リクエストがStripeからのものであることを確認します。
 */
export const stripe_webhook = onRequest({
  region: 'asia-northeast1',
  maxInstances: 10,
  timeoutSeconds: 60,
}, async (req, res) => {
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // 署名検証（Stripeからのリクエストであることを確認）
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('署名検証失敗:', err);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  console.log('Webhookイベント受信:', event.type);

  try {
    // イベントタイプに応じた処理
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('未処理のイベント:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook処理エラー:', error);
    // Stripeにリトライを促すため500を返す
    res.status(500).send('Webhook processing failed');
  }
});
```

### イベント処理関数

```typescript
/**
 * Checkout完了時の処理
 *
 * ユーザーが決済を完了したときに呼ばれます。
 * サブスクリプションが作成され、ユーザーがプレミアム会員になります。
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log('Checkout完了:', session.id);

  // セッションからStripe Customer IDを取得
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Firebaseユーザーを検索
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('ユーザーが見つかりません:', customerId);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  // サブスクリプション情報を取得
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Firestoreを更新
  await admin.firestore().collection('users').doc(userId).update({
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: 'premium',
    subscriptionPlan: 'monthly', // または年間プラン
    subscriptionStartDate: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_start * 1000)
    ),
    subscriptionEndDate: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_end * 1000)
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('ユーザーをプレミアムに更新:', userId);
}

/**
 * サブスクリプション更新時の処理
 *
 * サブスクリプションの状態が変わったときに呼ばれます。
 * プラン変更、更新、一時停止などを処理します。
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('サブスクリプション更新:', subscription.id);

  const customerId = subscription.customer as string;

  // Firebaseユーザーを検索
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('ユーザーが見つかりません:', customerId);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  // サブスクリプション状態をマッピング
  const statusMap: Record<string, string> = {
    'active': 'premium',
    'trialing': 'trial',
    'past_due': 'past_due',
    'canceled': 'free',
    'unpaid': 'suspended',
    'incomplete': 'pending',
    'incomplete_expired': 'free'
  };

  const subscriptionStatus = statusMap[subscription.status] || 'free';

  // Firestoreを更新
  await admin.firestore().collection('users').doc(userId).update({
    subscriptionStatus,
    subscriptionEndDate: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_end * 1000)
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('サブスクリプション状態を更新:', userId, subscriptionStatus);
}

/**
 * サブスクリプション削除時の処理
 *
 * ユーザーがサブスクリプションを解約したときに呼ばれます。
 * ユーザーを無料プランに戻します。
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('サブスクリプション削除:', subscription.id);

  const customerId = subscription.customer as string;

  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('ユーザーが見つかりません:', customerId);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  // Firestoreを更新（無料プランに戻す）
  await admin.firestore().collection('users').doc(userId).update({
    subscriptionStatus: 'free',
    subscriptionPlan: null,
    stripeSubscriptionId: null,
    subscriptionEndDate: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('ユーザーを無料プランに変更:', userId);
}

/**
 * 支払い成功時の処理
 *
 * サブスクリプションの更新支払いが成功したときに呼ばれます。
 * 課金履歴に記録します。
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log('支払い成功:', invoice.id);

  const customerId = invoice.customer as string;

  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return;
  }

  const userId = usersSnapshot.docs[0].id;

  // 課金履歴に記録
  await admin.firestore()
    .collection('users')
    .doc(userId)
    .collection('billingHistory')
    .add({
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      paidAt: admin.firestore.Timestamp.fromDate(
        new Date((invoice.status_transitions?.paid_at || 0) * 1000)
      ),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * 支払い失敗時の処理
 *
 * クレジットカードの期限切れなどで支払いが失敗したときに呼ばれます。
 * ユーザーに通知し、猶予期間を設定します。
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log('支払い失敗:', invoice.id);

  const customerId = invoice.customer as string;

  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const email = userDoc.data().email;

  // 課金履歴に記録
  await admin.firestore()
    .collection('users')
    .doc(userId)
    .collection('billingHistory')
    .add({
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

  // ユーザー状態を更新
  await admin.firestore().collection('users').doc(userId).update({
    subscriptionStatus: 'past_due',
    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // TODO: ユーザーへのメール通知（035-billing-error-handlingで実装）
  console.log('支払い失敗通知:', email);
}
```

### Stripe CLIを使ったローカルテスト

```bash
# Stripe CLIのインストール
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# Webhookをローカルにフォワード
stripe listen --forward-to localhost:5001/tokyo-list-478804-e5/asia-northeast1/stripe_webhook

# テストイベントの送信
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### Firestore構造

```
users/{userId}/
├── stripeCustomerId: string
├── stripeSubscriptionId: string | null
├── subscriptionStatus: 'free' | 'trial' | 'premium' | 'past_due' | 'suspended'
├── subscriptionPlan: 'monthly' | 'yearly' | null
├── subscriptionStartDate: timestamp | null
├── subscriptionEndDate: timestamp | null
├── paymentFailedAt: timestamp | null
└── billingHistory/
    └── {historyId}/
        ├── invoiceId: string
        ├── amount: number
        ├── currency: string
        ├── status: 'paid' | 'failed'
        ├── paidAt: timestamp | null
        ├── failedAt: timestamp | null
        └── createdAt: timestamp
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Webhook Secretは本番環境と開発環境で別々に設定
- Stripeダッシュボードでエンドポイントを登録する必要あり
- 処理済みイベントの重複処理防止（冪等性）は032で実装

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
