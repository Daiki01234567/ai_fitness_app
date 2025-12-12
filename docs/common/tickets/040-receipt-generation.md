# 040 領収書生成・送信

## 概要

課金成功時にユーザーへ領収書を自動送信し、過去の領収書を再送信できる機能を実装するチケットです。Stripeの領収書機能をベースに、日本語対応とメール送信機能を追加します。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤
- 022: プッシュ通知トリガー（メール送信基盤）

## 要件

### 機能要件

- FR-021: サブスクリプション管理（領収書提供）
- FR-022: 決済（Stripe）

### 非機能要件

- NFR-001: 応答時間（メール送信は非同期処理）
- NFR-012: データ保護（領収書データの安全な取り扱い）

## 受け入れ条件（Todo）

### 領収書自動送信機能

- [x] 支払い成功時（invoice.payment_succeeded）に領収書メールを自動送信
- [x] Stripeの領収書URL（invoice_pdf）をメール本文に含める
- [x] 日本語のメールテンプレートを作成
- [x] 送信履歴をFirestore（receiptEmails）に記録

### 領収書再送信API

- [x] `stripe_resendReceipt` Callable Functionを実装
- [x] Invoice IDからStripeの領収書URLを取得
- [x] ユーザーのメールアドレスに領収書を再送信
- [x] 再送信のレート制限（1日5回まで）を実装

### Stripe設定（Stripeダッシュボード）

- [ ] Stripe側で領収書の日本語化設定を確認
- [ ] 日本円（JPY）表示の確認
- [ ] 会社名・住所の設定確認

### テスト

- [x] 領収書自動送信のユニットテストを作成
- [x] 再送信APIのユニットテストを作成
- [x] エラーケースのテストを作成
- [x] モックを使用したメール送信テストを実装

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021, FR-022
- Stripe Invoice API: https://stripe.com/docs/api/invoices

## 技術詳細

### 実装方針

Stripeは自動的に`invoice.invoice_pdf`（領収書/請求書PDF）を生成します。このチケットでは以下を追加実装します：

1. **自動メール送信**: Webhookで支払い成功を検知し、ユーザーにメール送信
2. **再送信API**: ユーザーが過去の領収書を再度受け取るためのエンドポイント
3. **送信履歴**: いつ、どの領収書を送信したかの記録

### API仕様

#### 領収書再送信API

**エンドポイント**: `stripe_resendReceipt`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 5回/日/ユーザー

### リクエスト

```typescript
interface ResendReceiptRequest {
  invoiceId: string;  // 再送信するInvoice ID
}
```

### レスポンス

```typescript
interface ResendReceiptResponse {
  success: true;
  data: {
    sent: boolean;            // 送信成功フラグ
    invoiceId: string;        // Invoice ID
    email: string;            // 送信先メールアドレス（マスク済み）
    sentAt: string;           // 送信日時（ISO 8601形式）
  };
}
```

### Firestoreスキーマ

```typescript
// receiptEmails コレクション
interface ReceiptEmail {
  id: string;                      // ドキュメントID
  userId: string;                  // ユーザーID
  invoiceId: string;               // Stripe Invoice ID
  email: string;                   // 送信先メールアドレス
  status: 'sent' | 'failed';       // 送信ステータス
  type: 'auto' | 'resend';         // 自動送信 or 再送信
  invoicePdfUrl: string;           // 領収書PDF URL
  amount: number;                  // 金額
  currency: string;                // 通貨
  sentAt: Timestamp;               // 送信日時
  errorMessage?: string;           // エラー時のメッセージ
  createdAt: Timestamp;            // 作成日時
}
```

### 実装例

#### 自動送信（Webhook拡張）

```typescript
// functions/src/webhooks/stripe/invoicePaymentSucceeded.ts への追加

import { sendReceiptEmail } from '../../services/email/receiptEmail';

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  // ... 既存の処理 ...

  // 領収書メールを送信
  if (invoice.invoice_pdf && invoice.customer_email) {
    await sendReceiptEmail({
      userId: firebaseUID,
      email: invoice.customer_email,
      invoiceId: invoice.id,
      invoicePdfUrl: invoice.invoice_pdf,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      type: 'auto',
    });
  }
}
```

#### 領収書メール送信サービス

```typescript
// functions/src/services/email/receiptEmail.ts

import * as admin from 'firebase-admin';
import { logger } from '../../utils/logger';

interface SendReceiptEmailParams {
  userId: string;
  email: string;
  invoiceId: string;
  invoicePdfUrl: string;
  amount: number;
  currency: string;
  type: 'auto' | 'resend';
}

export async function sendReceiptEmail(
  params: SendReceiptEmailParams,
): Promise<boolean> {
  const db = admin.firestore();

  try {
    // メール送信（Firebase Extensions - Trigger Emailを使用）
    await db.collection('mail').add({
      to: params.email,
      template: {
        name: 'receipt',
        data: {
          invoiceId: params.invoiceId,
          invoicePdfUrl: params.invoicePdfUrl,
          amount: formatAmount(params.amount, params.currency),
          currency: params.currency.toUpperCase(),
          date: new Date().toLocaleDateString('ja-JP'),
        },
      },
    });

    // 送信履歴を記録
    await db.collection('receiptEmails').add({
      userId: params.userId,
      invoiceId: params.invoiceId,
      email: params.email,
      status: 'sent',
      type: params.type,
      invoicePdfUrl: params.invoicePdfUrl,
      amount: params.amount,
      currency: params.currency,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('領収書メール送信成功', {
      userId: params.userId,
      invoiceId: params.invoiceId,
      type: params.type,
    });

    return true;
  } catch (error) {
    // 失敗を記録
    await db.collection('receiptEmails').add({
      userId: params.userId,
      invoiceId: params.invoiceId,
      email: params.email,
      status: 'failed',
      type: params.type,
      invoicePdfUrl: params.invoicePdfUrl,
      amount: params.amount,
      currency: params.currency,
      errorMessage: (error as Error).message,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.error('領収書メール送信失敗', error as Error, {
      userId: params.userId,
      invoiceId: params.invoiceId,
    });

    return false;
  }
}

function formatAmount(amount: number, currency: string): string {
  if (currency.toLowerCase() === 'jpy') {
    return `¥${amount.toLocaleString('ja-JP')}`;
  }
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}
```

#### 再送信API

```typescript
// functions/src/api/stripe/resendReceipt.ts

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { sendReceiptEmail } from '../../services/email/receiptEmail';
import { logger } from '../../utils/logger';
import { getStripeClient } from '../../utils/stripe';

const DAILY_RESEND_LIMIT = 5;

export const stripe_resendReceipt = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const uid = request.auth.uid;
    const { invoiceId } = request.data as { invoiceId: string };

    if (!invoiceId || typeof invoiceId !== 'string') {
      throw new HttpsError('invalid-argument', '無効なInvoice IDです');
    }

    const db = admin.firestore();

    // レート制限チェック（1日5回まで）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resendCount = await db
      .collection('receiptEmails')
      .where('userId', '==', uid)
      .where('type', '==', 'resend')
      .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .count()
      .get();

    if (resendCount.data().count >= DAILY_RESEND_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `領収書の再送信は1日${DAILY_RESEND_LIMIT}回までです`,
      );
    }

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'ユーザーが見つかりません');
    }

    const userData = userDoc.data();
    const customerId = userData?.stripeCustomerId;
    const email = userData?.email;

    if (!customerId || !email) {
      throw new HttpsError('failed-precondition', '課金情報がありません');
    }

    // Stripeからインボイスを取得
    const stripe = getStripeClient();
    const invoice = await stripe.invoices.retrieve(invoiceId);

    // 所有権の確認
    if (invoice.customer !== customerId) {
      logger.warn('不正な領収書アクセス試行', {
        userId: uid,
        invoiceId,
        expectedCustomerId: customerId,
        actualCustomerId: invoice.customer,
      });
      throw new HttpsError('permission-denied', 'この領収書にアクセスする権限がありません');
    }

    if (!invoice.invoice_pdf) {
      throw new HttpsError('not-found', '領収書PDFが見つかりません');
    }

    // 領収書を再送信
    const sent = await sendReceiptEmail({
      userId: uid,
      email: email,
      invoiceId: invoice.id,
      invoicePdfUrl: invoice.invoice_pdf,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      type: 'resend',
    });

    if (!sent) {
      throw new HttpsError('internal', '領収書の送信に失敗しました');
    }

    // メールアドレスをマスク
    const maskedEmail = maskEmail(email);

    return {
      success: true,
      data: {
        sent: true,
        invoiceId: invoice.id,
        email: maskedEmail,
        sentAt: new Date().toISOString(),
      },
    };
  },
);

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
```

### メールテンプレート

```html
<!-- functions/templates/receipt.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>お支払い領収書</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">お支払い領収書</h1>

  <p>いつもAIフィットネスアプリをご利用いただきありがとうございます。</p>

  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>お支払い金額:</strong> {{amount}}</p>
    <p><strong>お支払い日:</strong> {{date}}</p>
    <p><strong>領収書番号:</strong> {{invoiceId}}</p>
  </div>

  <p>
    <a href="{{invoicePdfUrl}}"
       style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
      領収書をダウンロード
    </a>
  </p>

  <p style="color: #666; font-size: 12px; margin-top: 40px;">
    このメールは自動送信されています。
    ご不明な点がございましたら、アプリ内のお問い合わせからご連絡ください。
  </p>
</body>
</html>
```

### Stripe側の設定確認項目

1. **ダッシュボード > 設定 > Branding**
   - 会社名（日本語）
   - ロゴ画像
   - ブランドカラー

2. **ダッシュボード > 設定 > Customer emails**
   - Stripe側の自動送信メールを無効化（このチケットで独自送信するため）
   - または併用する場合は有効のまま

3. **ダッシュボード > 設定 > Business settings**
   - 住所（日本の住所形式）
   - 連絡先情報

### Firestoreセキュリティルール

```javascript
// receiptEmails コレクション
match /receiptEmails/{receiptId} {
  // ユーザーは自分の送信履歴のみ読み取り可能
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;

  // 書き込みはCloud Functionsのみ
  allow write: if false;
}

// mail コレクション（Firebase Extensions用）
match /mail/{mailId} {
  // 書き込みはCloud Functionsのみ
  allow read, write: if false;
}
```

### エラーハンドリング

| エラーコード | 説明 | 対処法 |
|-------------|------|--------|
| `unauthenticated` | 認証なし | ログインを促す |
| `invalid-argument` | 無効なInvoice ID | 正しいIDを指定 |
| `resource-exhausted` | 1日の再送信上限超過 | 翌日まで待つ |
| `not-found` | Invoice未発見 | IDを確認 |
| `permission-denied` | 他人のInvoice | 本人確認 |
| `internal` | メール送信失敗 | サポートに連絡 |

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-12

## 備考

- Stripeは`invoice.invoice_pdf`で領収書PDFを自動生成する
- 日本の税務要件に対応するため、Stripeダッシュボードで事業者情報を正確に設定すること
- メール送信にはFirebase Extensions（Trigger Email）またはSendGridを使用
- 領収書の再発行は法的に問題がないため、再送信は制限付きで許可
- Stripeのデフォルト領収書メール送信と重複しないよう、設定を確認すること

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-12 | 初版作成 |
| 2025-12-12 | 実装完了: 領収書メール送信サービス、再送信API、Webhook拡張、ユニットテスト35件 |
