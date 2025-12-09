# 039 課金履歴API

## 概要

ユーザーの過去の支払い履歴（課金履歴）を取得するAPI（`stripe_getBillingHistory`）を実装するチケットです。いつ、いくら支払ったか、領収書のダウンロードリンクなどを提供します。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤

## 要件

### 機能要件

- FR-023: 課金履歴

### 非機能要件

- NFR-001: 応答時間（200ms以内）

## 受け入れ条件（Todo）

- [ ] `stripe_getBillingHistory` Callable Functionを実装
- [ ] Firestoreから支払い履歴を取得する処理を実装
- [ ] Stripe APIでInvoice情報を取得する処理を実装
- [ ] ページネーション（10件ずつ取得）を実装
- [ ] 領収書PDFのダウンロードURLを提供する処理を実装
- [ ] エラーハンドリングを実装
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-023

## 技術詳細

### API仕様

**エンドポイント**: `stripe_getBillingHistory`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 50回/時

### リクエスト

```typescript
interface GetBillingHistoryRequest {
  limit?: number;           // 取得件数（デフォルト: 10）
  startingAfter?: string;   // ページネーション用（Invoice ID）
}
```

### レスポンス

```typescript
interface GetBillingHistoryResponse {
  success: true;
  data: {
    payments: Array<{
      id: string;                  // Invoice ID
      amount: number;              // 支払い金額（円）
      currency: string;            // 通貨（'jpy'）
      status: string;              // 'paid', 'open', 'void', 'uncollectible'
      paidAt: string;              // 支払い日時（ISO 8601形式）
      invoicePdfUrl: string;       // 領収書PDF URL
      description: string;         // 支払い内容
    }>;
    hasMore: boolean;            // 次のページがあるか
    nextCursor?: string;         // 次のページ用のカーソル
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/getBillingHistory.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

export const stripe_getBillingHistory = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { limit = 10, startingAfter } = request.data;

  try {
    // Firestoreから顧客IDを取得
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .get();

    const customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      return {
        success: true,
        data: {
          payments: [],
          hasMore: false,
        },
      };
    }

    // Stripe APIでInvoice一覧を取得
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: limit,
      starting_after: startingAfter,
    });

    const payments = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100, // セント → 円
      currency: invoice.currency,
      status: invoice.status || 'unknown',
      paidAt: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      invoicePdfUrl: invoice.invoice_pdf || '',
      description: invoice.lines.data[0]?.description || 'サブスクリプション',
    }));

    return {
      success: true,
      data: {
        payments: payments,
        hasMore: invoices.has_more,
        nextCursor: invoices.has_more
          ? invoices.data[invoices.data.length - 1].id
          : undefined,
      },
    };
  } catch (error) {
    console.error('課金履歴取得エラー:', error);
    throw new HttpsError('internal', '課金履歴の取得に失敗しました');
  }
});
```

### Firestoreキャッシュの活用（オプション）

```typescript
// Webhookで支払い履歴をFirestoreに保存している場合（チケット038）
const paymentsSnapshot = await admin
  .firestore()
  .collection('payments')
  .where('userId', '==', uid)
  .orderBy('paidAt', 'desc')
  .limit(limit)
  .get();

const payments = paymentsSnapshot.docs.map((doc) => doc.data());
```

### ページネーション

```typescript
// 1ページ目
const result1 = await stripe_getBillingHistory({
  auth: { uid: 'test_user' },
  data: { limit: 10 },
});

// 2ページ目
if (result1.data.hasMore) {
  const result2 = await stripe_getBillingHistory({
    auth: { uid: 'test_user' },
    data: {
      limit: 10,
      startingAfter: result1.data.nextCursor,
    },
  });
}
```

### エラーハンドリング

```typescript
try {
  const invoices = await stripe.invoices.list({ ... });
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    console.error('無効なCustomer ID:', customerId);
    return {
      success: true,
      data: { payments: [], hasMore: false },
    };
  }
  throw new HttpsError('internal', '課金履歴の取得に失敗しました');
}
```

### テストコード例

```typescript
// functions/tests/api/stripe/getBillingHistory.test.ts
describe('stripe_getBillingHistory', () => {
  it('課金履歴を取得できる', async () => {
    const result = await stripe_getBillingHistory({
      auth: { uid: 'user_with_payments' },
      data: { limit: 10 },
    });

    expect(result.success).toBe(true);
    expect(result.data.payments.length).toBeGreaterThan(0);
    expect(result.data.payments[0].amount).toBeGreaterThan(0);
  });

  it('支払い履歴がない場合', async () => {
    const result = await stripe_getBillingHistory({
      auth: { uid: 'user_without_payments' },
      data: { limit: 10 },
    });

    expect(result.success).toBe(true);
    expect(result.data.payments.length).toBe(0);
  });

  it('ページネーションが動作する', async () => {
    const result1 = await stripe_getBillingHistory({
      auth: { uid: 'user_with_many_payments' },
      data: { limit: 5 },
    });

    expect(result1.data.hasMore).toBe(true);

    const result2 = await stripe_getBillingHistory({
      auth: { uid: 'user_with_many_payments' },
      data: {
        limit: 5,
        startingAfter: result1.data.nextCursor,
      },
    });

    expect(result2.data.payments[0].id).not.toBe(result1.data.payments[0].id);
  });
});
```

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Stripe Invoiceには領収書PDFのURLが含まれる
- 領収書PDFは自動生成され、ダウンロード可能
- ページネーションで大量の履歴にも対応
- Firestoreにキャッシュを保存すれば、Stripe APIへのリクエストを削減できる
- 課金履歴は最大3年間保存される（Stripeのデフォルト）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
