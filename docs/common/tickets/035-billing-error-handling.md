# 035 課金エラーハンドリング

## 概要

決済失敗時のリトライ処理、猶予期間の設定、ユーザーへの通知など、課金に関するエラーを適切に処理する機能を実装するチケットです。ユーザーにとって分かりやすく、かつビジネス上の損失を最小限にする対応を行います。

## Phase

Phase 3（課金バックエンド実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/031（Stripe Webhook実装）

## 要件

### 機能要件

- FR-029: 決済処理 - 決済失敗時の適切な対応

### 非機能要件

- NFR-016: リトライ - 一時的なエラーの自動リトライ

## 受け入れ条件（Todo）

### リトライ処理

- [ ] Stripeの自動リトライ設定を確認・調整
- [ ] カスタムリトライスケジュールを設定（1日後、3日後、7日後）
- [ ] リトライ履歴の記録
- [ ] 最終リトライ後の処理（サブスク停止）

### 猶予期間（Grace Period）

- [ ] 猶予期間を7日に設定
- [ ] 猶予期間中のプレミアム機能継続
- [ ] 猶予期間終了通知
- [ ] 猶予期間終了後の機能制限

### ユーザー通知

- [ ] 決済失敗メール通知
- [ ] リマインダーメール（3日後、6日後）
- [ ] アプリ内通知
- [ ] プッシュ通知

### 支払い方法更新フロー

- [ ] 支払い方法更新ページへの誘導
- [ ] 更新後の自動リトライ
- [ ] 更新完了通知

### テスト

- [ ] 決済失敗シナリオのテスト
- [ ] 猶予期間のテスト
- [ ] 通知送信のテスト

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - エラーハンドリング
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - リトライ戦略

## 技術詳細

### 決済失敗時のフロー

```
決済失敗
    ↓
猶予期間開始（7日間）
    ├─ 1日後: メール通知「決済が失敗しました」
    ├─ 1日後: Stripeが自動リトライ
    ├─ 3日後: リマインダーメール
    ├─ 3日後: Stripeが自動リトライ
    ├─ 6日後: 最終通知「明日でプレミアム終了」
    ├─ 7日後: Stripeが最終リトライ
    └─ 7日後:
        ├─ 成功 → プレミアム継続
        └─ 失敗 → プレミアム終了、無料プランへ
```

### Stripeの自動リトライ設定

Stripeダッシュボードで以下を設定：

1. **Smart Retries**: 有効化（Stripeが最適なタイミングでリトライ）
2. **リトライスケジュール**: 1日後、3日後、7日後
3. **失敗後のサブスクリプション**: 7日後にキャンセル

### 決済失敗処理関数

```typescript
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface PaymentFailureContext {
  userId: string;
  email: string;
  invoiceId: string;
  amount: number;
  currency: string;
  attemptCount: number;
  lastAttemptAt: Date;
  nextRetryAt: Date | null;
}

/**
 * 決済失敗時の処理
 *
 * Stripe Webhookのinvoice.payment_failedイベントから呼び出されます。
 */
export async function handlePaymentFailure(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;
  const db = admin.firestore();

  // ユーザーを検索
  const usersSnapshot = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('ユーザーが見つかりません:', customerId);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();

  // 失敗回数を取得
  const attemptCount = invoice.attempt_count || 1;
  const nextRetryAt = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000)
    : null;

  const context: PaymentFailureContext = {
    userId,
    email: userData.email,
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    attemptCount,
    lastAttemptAt: new Date(),
    nextRetryAt
  };

  console.log('決済失敗:', context);

  // 猶予期間を設定
  await setGracePeriod(context);

  // 失敗履歴を記録
  await recordPaymentFailure(context);

  // ユーザーに通知
  await sendPaymentFailureNotification(context);
}

/**
 * 猶予期間を設定する
 */
async function setGracePeriod(context: PaymentFailureContext): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(context.userId);

  const gracePeriodDays = 7;
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

  await userRef.update({
    subscriptionStatus: 'past_due',
    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodEnd),
    paymentAttemptCount: context.attemptCount,
    nextPaymentRetry: context.nextRetryAt
      ? admin.firestore.Timestamp.fromDate(context.nextRetryAt)
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`猶予期間設定: ${context.userId} (終了: ${gracePeriodEnd.toISOString()})`);
}

/**
 * 決済失敗履歴を記録
 */
async function recordPaymentFailure(
  context: PaymentFailureContext
): Promise<void> {
  const db = admin.firestore();

  await db.collection('paymentFailures').add({
    userId: context.userId,
    invoiceId: context.invoiceId,
    amount: context.amount,
    currency: context.currency,
    attemptCount: context.attemptCount,
    nextRetryAt: context.nextRetryAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### ユーザー通知関数

```typescript
import * as nodemailer from 'nodemailer';

// メール送信用のトランスポーター（SendGridなどを使用）
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});

/**
 * 決済失敗通知を送信
 */
async function sendPaymentFailureNotification(
  context: PaymentFailureContext
): Promise<void> {
  // メール通知
  await sendPaymentFailureEmail(context);

  // Firestore通知（アプリ内通知用）
  await createInAppNotification(context);

  // プッシュ通知（FCM）
  await sendPushNotification(context);
}

/**
 * 決済失敗メールを送信
 */
async function sendPaymentFailureEmail(
  context: PaymentFailureContext
): Promise<void> {
  const subject = '【AIフィットネス】お支払いの確認が必要です';

  const html = `
    <h2>お支払いの確認が必要です</h2>

    <p>${context.email} 様</p>

    <p>
      サブスクリプションの更新料金のお支払いに問題が発生しました。
    </p>

    <p>
      <strong>金額:</strong> ¥${context.amount}<br>
      <strong>請求ID:</strong> ${context.invoiceId}
    </p>

    <p>
      現在、7日間の猶予期間中です。この期間中はプレミアム機能をご利用いただけますが、
      お支払い方法を更新していただく必要があります。
    </p>

    <p>
      <a href="${process.env.APP_URL}/settings/payment"
         style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        お支払い方法を更新する
      </a>
    </p>

    <p>
      ご不明な点がございましたら、サポートまでお問い合わせください。
    </p>

    <p>
      AIフィットネス サポートチーム
    </p>
  `;

  await transporter.sendMail({
    from: '"AIフィットネス" <noreply@ai-fitness.app>',
    to: context.email,
    subject,
    html
  });

  console.log(`決済失敗メール送信: ${context.email}`);
}

/**
 * アプリ内通知を作成
 */
async function createInAppNotification(
  context: PaymentFailureContext
): Promise<void> {
  const db = admin.firestore();

  await db.collection('users')
    .doc(context.userId)
    .collection('notifications')
    .add({
      type: 'payment_failed',
      title: 'お支払いの確認が必要です',
      body: 'サブスクリプションの更新に問題があります。お支払い方法を確認してください。',
      actionUrl: '/settings/payment',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * プッシュ通知を送信
 */
async function sendPushNotification(
  context: PaymentFailureContext
): Promise<void> {
  const db = admin.firestore();

  // FCMトークンを取得
  const userDoc = await db.collection('users').doc(context.userId).get();
  const fcmToken = userDoc.data()?.fcmToken;

  if (!fcmToken) {
    console.log('FCMトークンなし:', context.userId);
    return;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'お支払いの確認が必要です',
        body: 'サブスクリプションの更新に問題があります'
      },
      data: {
        type: 'payment_failed',
        actionUrl: '/settings/payment'
      }
    });

    console.log(`プッシュ通知送信: ${context.userId}`);
  } catch (error) {
    console.error('プッシュ通知エラー:', error);
  }
}
```

### リマインダースケジューラ

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * 毎日10時にリマインダーを送信
 */
export const billing_sendReminders = onSchedule({
  schedule: 'every day 10:00',
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async () => {
  const db = admin.firestore();
  const now = new Date();

  // 猶予期間中のユーザーを取得
  const usersSnapshot = await db.collection('users')
    .where('subscriptionStatus', '==', 'past_due')
    .get();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    if (!userData.gracePeriodEnd) continue;

    const gracePeriodEnd = userData.gracePeriodEnd.toDate();
    const daysRemaining = Math.ceil(
      (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 3日前と1日前にリマインダー送信
    if (daysRemaining === 3 || daysRemaining === 1) {
      await sendReminderEmail(userId, userData.email, daysRemaining);
    }

    // 猶予期間終了処理
    if (daysRemaining <= 0) {
      await handleGracePeriodExpired(userId);
    }
  }
});

/**
 * リマインダーメールを送信
 */
async function sendReminderEmail(
  userId: string,
  email: string,
  daysRemaining: number
): Promise<void> {
  const subject = daysRemaining === 1
    ? '【AIフィットネス】明日でプレミアム機能が終了します'
    : `【AIフィットネス】プレミアム機能終了まであと${daysRemaining}日です`;

  const html = `
    <h2>プレミアム機能終了のお知らせ</h2>

    <p>
      お支払い方法の問題が解決されない場合、あと${daysRemaining}日で
      プレミアム機能がご利用いただけなくなります。
    </p>

    <p>
      <a href="${process.env.APP_URL}/settings/payment">
        今すぐお支払い方法を更新する
      </a>
    </p>
  `;

  await transporter.sendMail({
    from: '"AIフィットネス" <noreply@ai-fitness.app>',
    to: email,
    subject,
    html
  });

  console.log(`リマインダー送信: ${email} (残り${daysRemaining}日)`);
}

/**
 * 猶予期間終了時の処理
 */
async function handleGracePeriodExpired(userId: string): Promise<void> {
  const db = admin.firestore();

  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'free',
    gracePeriodEnd: null,
    subscriptionEndDate: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // カスタムクレームを更新
  await updateUserClaims(userId, {
    premium: false,
    subscriptionEnd: null
  });

  console.log(`猶予期間終了、無料プランに変更: ${userId}`);
}
```

### 支払い方法更新後のリトライ

```typescript
/**
 * 支払い方法更新時にリトライを実行
 *
 * Stripe Webhookのpayment_method.attachedイベントから呼び出し
 */
export async function handlePaymentMethodUpdated(
  paymentMethod: Stripe.PaymentMethod
): Promise<void> {
  const customerId = paymentMethod.customer as string;

  // 未払いの請求書を取得
  const invoices = await stripe.invoices.list({
    customer: customerId,
    status: 'open',
    limit: 1
  });

  if (invoices.data.length === 0) {
    console.log('未払い請求書なし');
    return;
  }

  const invoice = invoices.data[0];

  try {
    // 請求書の支払いを再試行
    await stripe.invoices.pay(invoice.id);
    console.log(`支払いリトライ成功: ${invoice.id}`);
  } catch (error) {
    console.error(`支払いリトライ失敗: ${invoice.id}`, error);
  }
}
```

### エラー状態のダッシュボード用データ

```typescript
/**
 * 決済失敗の統計を取得（管理者用）
 */
export const admin_getPaymentFailureStats = onCall({
  region: 'asia-northeast1',
  maxInstances: 5
}, async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', '管理者権限が必要です');
  }

  const db = admin.firestore();

  // 過去30日の決済失敗
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const failuresSnapshot = await db.collection('paymentFailures')
    .where('createdAt', '>=', thirtyDaysAgo)
    .get();

  // 猶予期間中のユーザー数
  const pastDueSnapshot = await db.collection('users')
    .where('subscriptionStatus', '==', 'past_due')
    .get();

  return {
    success: true,
    data: {
      totalFailuresLast30Days: failuresSnapshot.size,
      currentPastDueUsers: pastDueSnapshot.size,
      // 追加の統計...
    }
  };
});
```

## 見積もり

- 工数: 4日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- メール送信にはSendGridを使用予定
- 猶予期間は7日間に設定（変更可能）
- リトライ設定はStripeダッシュボードで調整

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
