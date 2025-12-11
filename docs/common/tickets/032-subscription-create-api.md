# 032 サブスクリプション作成API

## 概要

ユーザーが有料プラン（月額500円）に加入するためのAPI（`stripe_createCheckoutSession`）を実装するチケットです。Stripe Checkoutセッションを作成し、ユーザーに決済ページのURLを返します。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤

## 要件

### 機能要件

- FR-020: 月額課金（500円）

### 非機能要件

- NFR-032: セキュリティ基準
- NFR-002: バリデーション

## 受け入れ条件（Todo）

- [x] `stripe_createCheckoutSession` Callable Functionを実装
- [x] リクエストバリデーションを実装（priceId、URL検証）
- [x] Stripe Checkoutセッションを作成する処理を実装
- [x] 成功URLとキャンセルURLを設定できるようにする
- [x] 7日間の無料トライアルを自動適用する
- [x] エラーハンドリングを実装
- [x] ユニットテストを作成（カバレッジ 80%以上）
- [x] 統合テスト（Stripe Test Mode）で動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8.1章（stripe_createCheckoutSession）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-019、FR-020

## 技術詳細

### API仕様

**エンドポイント**: `stripe_createCheckoutSession`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 10回/時

### リクエスト

```typescript
interface CreateCheckoutSessionRequest {
  priceId: string;       // Stripe Price ID（例: 'price_monthly_500'）
  successUrl: string;    // 支払い成功時のリダイレクト先
  cancelUrl: string;     // キャンセル時のリダイレクト先
}
```

### レスポンス

```typescript
interface CreateCheckoutSessionResponse {
  success: true;
  data: {
    sessionId: string;   // Stripe Checkout Session ID
    url: string;         // Stripe Checkoutページへのリンク
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/createCheckoutSession.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import { getOrCreateStripeCustomer } from '../../services/stripe';

export const stripe_createCheckoutSession = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email || '';
  const { priceId, successUrl, cancelUrl } = request.data;

  // バリデーション
  if (!priceId || typeof priceId !== 'string') {
    throw new HttpsError('invalid-argument', 'priceIdが無効です');
  }

  if (!successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'URLが無効です');
  }

  try {
    // Stripe Customerを取得または作成
    const customerId = await getOrCreateStripeCustomer(uid, email);

    // Checkout Sessionを作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 7,  // 7日間無料トライアル
        metadata: {
          firebaseUID: uid,
        },
      },
      allow_promotion_codes: true,  // プロモーションコード入力を許可
    });

    return {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    };
  } catch (error) {
    console.error('Checkout Session作成エラー:', error);
    throw new HttpsError(
      'internal',
      '決済セッションの作成に失敗しました'
    );
  }
});
```

### バリデーションルール

| フィールド | 条件 | エラーメッセージ |
|-----------|------|----------------|
| priceId | 必須、文字列、`price_`で始まる | 'priceIdが無効です' |
| successUrl | 必須、有効なURL | 'successUrlが無効です' |
| cancelUrl | 必須、有効なURL | 'cancelUrlが無効です' |

### エラーハンドリング

```typescript
try {
  const session = await stripe.checkout.sessions.create({ ... });
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    // 無効なpriceIdなどのエラー
    throw new HttpsError('invalid-argument', `無効な価格IDです: ${error.message}`);
  }
  if (error instanceof Stripe.errors.StripeCardError) {
    // カードエラー（通常はCheckout画面で処理されるが、念のため）
    throw new HttpsError('failed-precondition', 'カード情報に問題があります');
  }
  throw new HttpsError('internal', '決済サービスでエラーが発生しました');
}
```

### テストコード例

```typescript
// functions/tests/api/stripe/createCheckoutSession.test.ts
describe('stripe_createCheckoutSession', () => {
  it('Checkout Sessionを作成できる', async () => {
    const result = await stripe_createCheckoutSession({
      auth: { uid: 'test_user', token: { email: 'test@example.com' } },
      data: {
        priceId: 'price_monthly_500',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.sessionId).toMatch(/^cs_test_/);
    expect(result.data.url).toContain('https://checkout.stripe.com');
  });

  it('認証なしの場合はエラー', async () => {
    await expect(
      stripe_createCheckoutSession({
        data: { priceId: 'price_monthly_500' },
      })
    ).rejects.toThrow('unauthenticated');
  });

  it('priceIdが無効な場合はエラー', async () => {
    await expect(
      stripe_createCheckoutSession({
        auth: { uid: 'test_user', token: { email: 'test@example.com' } },
        data: {
          priceId: '',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      })
    ).rejects.toThrow('invalid-argument');
  });
});
```

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] 実装完了

## 完了日

2025-12-11

## 備考

- Stripe Checkoutは、決済ページをStripeが提供する安全なホスティング環境で表示する方式
- PCI DSS準拠が簡単になる（カード情報を直接扱わない）
- プロモーションコード入力機能も標準で利用可能
- Test Modeでは実際に課金されないため、安全にテストできる

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | チケット完了 - stripe_createCheckoutSession実装、バリデーション、7日間無料トライアル対応、テスト完了 |
