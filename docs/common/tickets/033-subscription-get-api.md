# 033 サブスクリプション確認API

## 概要

ユーザーが現在加入しているサブスクリプション（有料プラン）の状態を確認するAPI（`stripe_getSubscription`）を実装するチケットです。プラン名、次回請求日、ステータスなどを取得できます。

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

- NFR-001: 応答時間（200ms以内）

## 受け入れ条件（Todo）

- [ ] `stripe_getSubscription` Callable Functionを実装
- [ ] Firestoreから`stripeSubscriptionId`を取得する処理を実装
- [ ] Stripe APIでサブスクリプション詳細を取得する処理を実装
- [ ] サブスクリプションがない場合の処理を実装
- [ ] エラーハンドリングを実装
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021

## 技術詳細

### API仕様

**エンドポイント**: `stripe_getSubscription`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 50回/時

### リクエスト

```typescript
interface GetSubscriptionRequest {
  // パラメータなし（認証情報から自動取得）
}
```

### レスポンス

```typescript
interface GetSubscriptionResponse {
  success: true;
  data: {
    hasSubscription: boolean;
    subscription?: {
      id: string;                    // Stripe Subscription ID
      status: string;                // 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
      planName: string;              // プラン名（例: 'Premium Monthly'）
      currentPeriodStart: string;    // 現在の課金期間開始日（ISO 8601形式）
      currentPeriodEnd: string;      // 現在の課金期間終了日
      cancelAtPeriodEnd: boolean;    // 期間終了時に解約するか
      trialEnd?: string;             // トライアル終了日（トライアル中の場合）
    };
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/getSubscription.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

export const stripe_getSubscription = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  try {
    // Firestoreからサブスクリプション情報を取得
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .get();

    const subscriptionId = userDoc.data()?.stripeSubscriptionId;

    // サブスクリプションがない場合
    if (!subscriptionId) {
      return {
        success: true,
        data: {
          hasSubscription: false,
        },
      };
    }

    // Stripeからサブスクリプション詳細を取得
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return {
      success: true,
      data: {
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planName: subscription.items.data[0].price.nickname || 'Premium',
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ).toISOString(),
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : undefined,
        },
      },
    };
  } catch (error) {
    console.error('サブスクリプション取得エラー:', error);
    throw new HttpsError(
      'internal',
      'サブスクリプション情報の取得に失敗しました'
    );
  }
});
```

### サブスクリプションステータス

| ステータス | 説明 | ユーザーへの表示 |
|-----------|------|----------------|
| `active` | アクティブ（課金中） | 「有効」 |
| `trialing` | トライアル期間中 | 「無料トライアル中」 |
| `past_due` | 支払い遅延 | 「支払いが必要です」 |
| `canceled` | キャンセル済み | 「解約済み」 |
| `incomplete` | 支払い未完了 | 「支払いを完了してください」 |

### エラーハンドリング

```typescript
try {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    // サブスクリプションIDが無効な場合
    console.warn('無効なサブスクリプションID:', subscriptionId);
    return {
      success: true,
      data: { hasSubscription: false },
    };
  }
  throw error;
}
```

### テストコード例

```typescript
// functions/tests/api/stripe/getSubscription.test.ts
describe('stripe_getSubscription', () => {
  it('サブスクリプション情報を取得できる', async () => {
    const result = await stripe_getSubscription({
      auth: { uid: 'user_with_subscription' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.hasSubscription).toBe(true);
    expect(result.data.subscription?.status).toBe('active');
  });

  it('サブスクリプションがない場合', async () => {
    const result = await stripe_getSubscription({
      auth: { uid: 'user_without_subscription' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.hasSubscription).toBe(false);
  });

  it('認証なしの場合はエラー', async () => {
    await expect(
      stripe_getSubscription({ data: {} })
    ).rejects.toThrow('unauthenticated');
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

- サブスクリプション情報はFirestoreにキャッシュされているが、最新情報はStripe APIから取得する
- レスポンスタイムを意識し、Stripe APIへのリクエストを最小限にする
- Webhookでサブスクリプション情報が更新された場合、Firestoreに反映される（チケット038）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
