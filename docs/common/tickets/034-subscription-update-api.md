# 034 サブスクリプション更新API

## 概要

ユーザーがサブスクリプションのプランを変更（アップグレード・ダウングレード）するAPI（`stripe_updateSubscription`）を実装するチケットです。月額プランの変更や、即時変更・次回請求時変更の切り替えができます。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤

## 要件

### 機能要件

- FR-021: サブスクリプション管理

### 非機能要件

- NFR-002: バリデーション

## 受け入れ条件（Todo）

- [ ] `stripe_updateSubscription` Callable Functionを実装
- [ ] リクエストバリデーションを実装（newPriceId検証）
- [ ] Stripe APIでサブスクリプションを更新する処理を実装
- [ ] 即時変更（proration有効）と次回請求時変更を選択可能にする
- [ ] Firestoreのサブスクリプション情報を更新する処理を実装
- [ ] エラーハンドリングを実装
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021

## 技術詳細

### API仕様

**エンドポイント**: `stripe_updateSubscription`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 10回/時

### リクエスト

```typescript
interface UpdateSubscriptionRequest {
  newPriceId: string;           // 新しいStripe Price ID
  prorationBehavior?: string;   // 'create_prorations' | 'none' | 'always_invoice'
}
```

**prorationBehaviorの説明**:
- `create_prorations`（デフォルト）: 日割り計算を行い、差額を即時請求
- `none`: 次回請求時に新しいプランを適用（日割りなし）
- `always_invoice`: 即座にインボイスを発行

### レスポンス

```typescript
interface UpdateSubscriptionResponse {
  success: true;
  data: {
    subscriptionId: string;
    newPriceId: string;
    status: string;
    currentPeriodEnd: string;
    message: string;
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/updateSubscription.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

export const stripe_updateSubscription = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { newPriceId, prorationBehavior = 'create_prorations' } = request.data;

  // バリデーション
  if (!newPriceId || typeof newPriceId !== 'string') {
    throw new HttpsError('invalid-argument', 'newPriceIdが無効です');
  }

  try {
    // Firestoreからサブスクリプション情報を取得
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .get();

    const subscriptionId = userDoc.data()?.stripeSubscriptionId;

    if (!subscriptionId) {
      throw new HttpsError(
        'failed-precondition',
        'サブスクリプションが見つかりません'
      );
    }

    // Stripeでサブスクリプションを更新
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: prorationBehavior as any,
      }
    );

    // Firestoreを更新
    await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .update({
        subscriptionPlan: newPriceId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      data: {
        subscriptionId: updatedSubscription.id,
        newPriceId: newPriceId,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(
          updatedSubscription.current_period_end * 1000
        ).toISOString(),
        message:
          prorationBehavior === 'none'
            ? '次回請求時に新しいプランに変更されます'
            : 'プランを変更しました',
      },
    };
  } catch (error) {
    console.error('サブスクリプション更新エラー:', error);
    throw new HttpsError(
      'internal',
      'サブスクリプションの更新に失敗しました'
    );
  }
});
```

### バリデーションルール

| フィールド | 条件 | エラーメッセージ |
|-----------|------|----------------|
| newPriceId | 必須、文字列、`price_`で始まる | 'newPriceIdが無効です' |
| prorationBehavior | オプション、指定の値のみ | 'prorationBehaviorが無効です' |

### エラーハンドリング

```typescript
try {
  const updatedSubscription = await stripe.subscriptions.update(...);
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    if (error.message.includes('price')) {
      throw new HttpsError('invalid-argument', '無効な価格IDです');
    }
    if (error.message.includes('subscription')) {
      throw new HttpsError('not-found', 'サブスクリプションが見つかりません');
    }
  }
  throw new HttpsError('internal', 'サブスクリプションの更新に失敗しました');
}
```

### テストコード例

```typescript
// functions/tests/api/stripe/updateSubscription.test.ts
describe('stripe_updateSubscription', () => {
  it('サブスクリプションを更新できる', async () => {
    const result = await stripe_updateSubscription({
      auth: { uid: 'user_with_subscription' },
      data: {
        newPriceId: 'price_yearly_5000',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.newPriceId).toBe('price_yearly_5000');
  });

  it('サブスクリプションがない場合はエラー', async () => {
    await expect(
      stripe_updateSubscription({
        auth: { uid: 'user_without_subscription' },
        data: { newPriceId: 'price_yearly_5000' },
      })
    ).rejects.toThrow('failed-precondition');
  });

  it('無効なpriceIdの場合はエラー', async () => {
    await expect(
      stripe_updateSubscription({
        auth: { uid: 'user_with_subscription' },
        data: { newPriceId: 'invalid_price' },
      })
    ).rejects.toThrow('invalid-argument');
  });
});
```

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- プラン変更時の日割り計算（proration）はStripeが自動で行う
- アップグレード時は差額を即時請求、ダウングレード時は次回請求時に適用するのが一般的
- 変更履歴はStripeの管理画面で確認可能
- プラン変更時にWebhookが発火するため、チケット038の実装と連携する

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
