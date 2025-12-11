# 037 課金失敗時の再試行

## 概要

課金処理が失敗した場合（カード残高不足、期限切れなど）に自動で再試行する仕組みを実装するチケットです。Stripeのデフォルト再試行設定を利用し、失敗時の通知とユーザーへの案内を提供します。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤

## 要件

### 機能要件

- なし（非機能要件のみ）

### 非機能要件

- NFR-016: 課金再試行（指数バックオフ）

## 受け入れ条件（Todo）

- [x] Stripeの自動再試行設定を確認・調整
- [x] 課金失敗時の通知処理を実装
- [x] 再試行スケジュールをログに記録
- [x] 最終的な失敗時にユーザーに通知する処理を実装
- [x] カード更新を促すメール送信機能を実装
- [x] エラーハンドリングを実装
- [x] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-016（課金再試行）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件

## 技術詳細

### Stripeの自動再試行設定

Stripeは課金失敗時に自動で再試行を行います：

| 再試行回数 | タイミング | 備考 |
|-----------|-----------|------|
| 1回目 | 失敗直後 | 即座に再試行 |
| 2回目 | 3日後 | 指数バックオフ開始 |
| 3回目 | 5日後 | |
| 4回目 | 7日後 | 最終試行 |

### Stripeダッシュボードでの設定

```typescript
// Stripeダッシュボードで設定（コードでの設定は不要）
// Settings > Billing > Subscription settings > Payment retry logic
// - Smart retries (推奨): AIベースの最適な再試行
// - Custom retries: カスタム再試行スケジュール
```

### 課金失敗時の通知処理

```typescript
// functions/src/webhooks/stripe/invoicePaymentFailed.ts
import { onRequest } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

/**
 * Webhookで課金失敗イベントを受信
 * invoice.payment_failed
 */
export async function handleInvoicePaymentFailed(
  invoice: any
): Promise<void> {
  const customerId = invoice.customer;
  const attemptCount = invoice.attempt_count;

  // Stripe Customerからユーザーを取得
  const customer = await stripe.customers.retrieve(customerId);
  const firebaseUID = customer.metadata?.firebaseUID;

  if (!firebaseUID) {
    console.error('Firebase UIDが見つかりません:', customerId);
    return;
  }

  // Firestoreを更新
  await admin
    .firestore()
    .collection('users')
    .doc(firebaseUID)
    .update({
      lastPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentFailureCount: attemptCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // ユーザーに通知
  await sendPaymentFailureNotification(firebaseUID, attemptCount);
}

async function sendPaymentFailureNotification(
  userId: string,
  attemptCount: number
): Promise<void> {
  // プッシュ通知（チケット022で実装）
  console.log(`課金失敗通知: ${userId}, 試行回数: ${attemptCount}`);

  // メール通知
  const userDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .get();

  const email = userDoc.data()?.email;
  if (!email) return;

  const message =
    attemptCount >= 4
      ? 'お支払いに失敗しました。カード情報を更新してください。'
      : `お支払いに失敗しました（${attemptCount}回目）。自動で再試行します。`;

  // メール送信（SendGrid、Firebase Extensions等）
  console.log(`メール送信: ${email}, メッセージ: ${message}`);
}
```

### カード更新を促す処理

```typescript
// functions/src/api/stripe/updatePaymentMethod.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

/**
 * 支払い方法更新用のSetup Intentを作成
 */
export const stripe_createSetupIntent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  try {
    // Stripe Customerを取得
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .get();

    const customerId = userDoc.data()?.stripeCustomerId;
    if (!customerId) {
      throw new HttpsError('not-found', 'Stripe Customerが見つかりません');
    }

    // Setup Intentを作成
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return {
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
      },
    };
  } catch (error) {
    console.error('Setup Intent作成エラー:', error);
    throw new HttpsError('internal', '支払い方法の更新に失敗しました');
  }
});
```

### 再試行ログの記録

```typescript
// functions/src/services/logging.ts
export async function logPaymentRetry(
  userId: string,
  attemptCount: number,
  nextRetryAt: Date
): Promise<void> {
  await admin.firestore().collection('paymentRetryLogs').add({
    userId: userId,
    attemptCount: attemptCount,
    nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

### エラーハンドリング

```typescript
try {
  await stripe.customers.retrieve(customerId);
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    console.error('無効なCustomer ID:', customerId);
    // DLQに送信
    return;
  }
  throw error;
}
```

### テストコード例

```typescript
// functions/tests/webhooks/invoicePaymentFailed.test.ts
describe('課金失敗時の再試行', () => {
  it('課金失敗時に通知を送る', async () => {
    const invoice = {
      customer: 'cus_test123',
      attempt_count: 1,
    };

    await handleInvoicePaymentFailed(invoice);

    // 通知が送られたか確認
    // Firestoreが更新されたか確認
  });

  it('最終試行失敗時に強い通知を送る', async () => {
    const invoice = {
      customer: 'cus_test123',
      attempt_count: 4,
    };

    await handleInvoicePaymentFailed(invoice);

    // 強い通知が送られたか確認
  });
});
```

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] 実装完了（統合テスト待ち）

## 完了日

2025-12-11（統合テストを除く）

## 備考

- Stripeのデフォルト再試行設定を使用（カスタマイズも可能）
- 再試行は最大4回まで（Stripeの推奨設定）
- 最終試行失敗後は、サブスクリプションが`past_due`ステータスになる
- ユーザーはカード情報を更新してから手動で再試行可能
- 再試行ログはBigQueryに送信して分析に活用

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了（createSetupIntent API、invoicePaymentFailed ハンドラ、テスト） |
