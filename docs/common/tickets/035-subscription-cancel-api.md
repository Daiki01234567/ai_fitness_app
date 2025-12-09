# 035 サブスクリプション解約API

## 概要

ユーザーがサブスクリプション（有料プラン）を解約するAPI（`stripe_cancelSubscription`）を実装するチケットです。即時解約と期間終了時解約の2つのモードをサポートします。

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

- [ ] `stripe_cancelSubscription` Callable Functionを実装
- [ ] 即時解約と期間終了時解約の切り替えを実装
- [ ] Stripe APIでサブスクリプションをキャンセルする処理を実装
- [ ] Firestoreのサブスクリプション情報を更新する処理を実装
- [ ] 解約確認メールを送信する処理を実装（オプション）
- [ ] エラーハンドリングを実装
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021

## 技術詳細

### API仕様

**エンドポイント**: `stripe_cancelSubscription`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 10回/時

### リクエスト

```typescript
interface CancelSubscriptionRequest {
  cancelImmediately?: boolean;  // true: 即時解約、false: 期間終了時解約（デフォルト）
}
```

### レスポンス

```typescript
interface CancelSubscriptionResponse {
  success: true;
  data: {
    subscriptionId: string;
    status: string;              // 'canceled' or 'active'
    cancelAt?: string;           // 解約予定日（期間終了時解約の場合）
    message: string;
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/cancelSubscription.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

export const stripe_cancelSubscription = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { cancelImmediately = false } = request.data;

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

    let canceledSubscription;

    if (cancelImmediately) {
      // 即時解約
      canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

      // Firestoreを更新
      await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .update({
          subscriptionStatus: 'free',
          subscriptionPlan: null,
          stripeSubscriptionId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        success: true,
        data: {
          subscriptionId: canceledSubscription.id,
          status: 'canceled',
          message: 'サブスクリプションを解約しました',
        },
      };
    } else {
      // 期間終了時に解約（デフォルト）
      canceledSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      // Firestoreを更新（まだ有効だが解約予定）
      await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        success: true,
        data: {
          subscriptionId: canceledSubscription.id,
          status: 'active',
          cancelAt: new Date(
            canceledSubscription.current_period_end * 1000
          ).toISOString(),
          message: `${new Date(
            canceledSubscription.current_period_end * 1000
          ).toLocaleDateString()}にサブスクリプションが解約されます`,
        },
      };
    }
  } catch (error) {
    console.error('サブスクリプション解約エラー:', error);
    throw new HttpsError(
      'internal',
      'サブスクリプションの解約に失敗しました'
    );
  }
});
```

### 解約モードの違い

| モード | 即時解約 | 期間終了時解約 |
|-------|---------|--------------|
| `cancelImmediately` | `true` | `false`（デフォルト） |
| アクセス | 即座に無効化 | 期間終了まで有効 |
| 返金 | なし | なし |
| ステータス | `canceled` | `active`（解約予定） |

### エラーハンドリング

```typescript
try {
  const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    if (error.message.includes('No such subscription')) {
      throw new HttpsError('not-found', 'サブスクリプションが見つかりません');
    }
    if (error.message.includes('already canceled')) {
      throw new HttpsError('failed-precondition', '既に解約済みです');
    }
  }
  throw new HttpsError('internal', 'サブスクリプションの解約に失敗しました');
}
```

### 解約確認メールの送信（オプション）

```typescript
// functions/src/services/email.ts
import * as admin from 'firebase-admin';

export async function sendCancellationEmail(
  email: string,
  cancelAt?: Date
): Promise<void> {
  const message = cancelAt
    ? `サブスクリプションは${cancelAt.toLocaleDateString()}に解約されます。`
    : 'サブスクリプションを解約しました。';

  // Cloud Functionsでメール送信（SendGrid、Firebase Extensions等）
  // 実装例は省略
}
```

### テストコード例

```typescript
// functions/tests/api/stripe/cancelSubscription.test.ts
describe('stripe_cancelSubscription', () => {
  it('期間終了時に解約できる', async () => {
    const result = await stripe_cancelSubscription({
      auth: { uid: 'user_with_subscription' },
      data: { cancelImmediately: false },
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
    expect(result.data.cancelAt).toBeDefined();
  });

  it('即時解約できる', async () => {
    const result = await stripe_cancelSubscription({
      auth: { uid: 'user_with_subscription' },
      data: { cancelImmediately: true },
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('canceled');
  });

  it('サブスクリプションがない場合はエラー', async () => {
    await expect(
      stripe_cancelSubscription({
        auth: { uid: 'user_without_subscription' },
        data: {},
      })
    ).rejects.toThrow('failed-precondition');
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

- 期間終了時解約がユーザーフレンドリー（残りの期間は有効）
- 即時解約は返金なし（Stripeの仕様）
- 解約後も過去のトレーニング記録は保持される
- 再度加入する際は新しいサブスクリプションが作成される
- Webhookで解約イベントが通知される（チケット038で実装）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
