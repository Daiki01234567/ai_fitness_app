# 053 サブスクリプション管理

## 概要

ユーザーのサブスクリプション（月額課金）状態を管理する機能を実装します。無料プラン・有料プラン・トライアル期間の状態を正しく管理し、ユーザーが利用できる機能を制御します。

## Phase

Phase 3（Apple認証・課金）

## 依存チケット

- 052: Stripe決済基盤セットアップ

## 要件

### 機能要件（FR-019参照）

1. **プラン状態管理**
   - 無料プラン（free）
   - 有料プラン（premium）
   - トライアル期間（trial）

2. **有効期限確認**
   - サブスクリプションの有効期限をリアルタイムで確認
   - 期限切れの自動検知と状態更新

3. **Stripe連携**
   - Stripeのサブスクリプション情報との同期
   - Webhookによるリアルタイム更新

4. **自動更新管理**
   - 自動更新ON/OFFの状態管理
   - 更新失敗時の処理

## 受け入れ条件

- [ ] プラン状態（free/premium/trial）が正しく管理される
- [ ] サブスクリプションの有効期限が正しく保存・表示される
- [ ] Stripeからのイベント（作成、更新、キャンセル）を正しく処理できる
- [ ] アプリ起動時に最新のプラン状態を取得できる
- [ ] オフライン時でもキャッシュされた状態で動作する
- [ ] 期限切れ時に自動的に無料プランに戻る

## 参照ドキュメント

- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` - FR-019（サブスクリプション管理）
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Subscription Lifecycle](https://stripe.com/docs/billing/subscriptions/overview#subscription-lifecycle)

## 技術詳細

### プラン状態の定義

```typescript
type PlanStatus = 'free' | 'premium' | 'trial';

interface Subscription {
  userId: string;
  planStatus: PlanStatus;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;       // 期間終了時にキャンセル予定
  trialStart: Date | null;
  trialEnd: Date | null;
  autoRenewEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 状態遷移図

```
+-------+     購入      +---------+
| free  | -----------> | premium |
+-------+              +---------+
    ^                      |
    |                      | 解約（期間終了後）
    +----------------------+

+-------+     7日経過   +-------+
| trial | -----------> | free  |
+-------+              +-------+
    |
    | 購入
    v
+---------+
| premium |
+---------+
```

### Firestoreデータモデル

```typescript
// Subscriptions コレクション
interface SubscriptionDoc {
  userId: string;

  // プラン状態
  planStatus: 'free' | 'premium' | 'trial';

  // Stripe連携
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;

  // 期間情報
  currentPeriodStart: Timestamp | null;
  currentPeriodEnd: Timestamp | null;

  // トライアル情報
  trialStart: Timestamp | null;
  trialEnd: Timestamp | null;
  hasUsedTrial: boolean;  // トライアル使用済みフラグ

  // キャンセル情報
  cancelAtPeriodEnd: boolean;
  canceledAt: Timestamp | null;

  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Cloud Functions実装

#### サブスクリプション作成API

```typescript
// functions/src/api/subscriptions/create.ts
export const createSubscription = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }

    const { priceId } = data;
    const userId = context.auth.uid;

    // Stripe Customerを取得または作成
    const customer = await getOrCreateStripeCustomer(userId);

    // サブスクリプション作成
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId },
    });

    // Firestoreに保存
    await saveSubscription(userId, subscription);

    return {
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any).payment_intent.client_secret,
    };
  }
);
```

#### Webhookイベント処理

```typescript
// functions/src/api/subscriptions/webhookHandlers.ts

// サブスクリプション作成時
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata.userId;

  await db.collection('Subscriptions').doc(userId).set({
    userId,
    planStatus: subscription.status === 'trialing' ? 'trial' : 'premium',
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    stripePriceId: subscription.items.data[0].price.id,
    currentPeriodStart: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_start * 1000
    ),
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_end * 1000
    ),
    trialEnd: subscription.trial_end
      ? admin.firestore.Timestamp.fromMillis(subscription.trial_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// サブスクリプション更新時
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata.userId;

  let planStatus: PlanStatus = 'free';
  if (subscription.status === 'active') {
    planStatus = 'premium';
  } else if (subscription.status === 'trialing') {
    planStatus = 'trial';
  }

  await db.collection('Subscriptions').doc(userId).update({
    planStatus,
    currentPeriodStart: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_start * 1000
    ),
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_end * 1000
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// サブスクリプションキャンセル時
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata.userId;

  await db.collection('Subscriptions').doc(userId).update({
    planStatus: 'free',
    stripeSubscriptionId: null,
    stripePriceId: null,
    canceledAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

### フロントエンド実装

#### Zustand Store

```typescript
// stores/subscriptionStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
  planStatus: PlanStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  isLoading: boolean;

  // アクション
  fetchSubscription: () => Promise<void>;
  isPremium: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      planStatus: 'free',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isLoading: false,

      fetchSubscription: async () => {
        set({ isLoading: true });
        try {
          const doc = await getDoc(
            doc(db, 'Subscriptions', auth.currentUser!.uid)
          );
          if (doc.exists()) {
            const data = doc.data();
            set({
              planStatus: data.planStatus,
              currentPeriodEnd: data.currentPeriodEnd?.toDate() || null,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      isPremium: () => {
        const { planStatus, currentPeriodEnd } = get();
        if (planStatus === 'free') return false;
        if (currentPeriodEnd && new Date() > currentPeriodEnd) return false;
        return true;
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

#### リアルタイム同期フック

```typescript
// hooks/useSubscriptionSync.ts
import { useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';

export function useSubscriptionSync() {
  const setSubscription = useSubscriptionStore((state) => state.setSubscription);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'Subscriptions', userId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setSubscription({
            planStatus: data.planStatus,
            currentPeriodEnd: data.currentPeriodEnd?.toDate(),
            cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          });
        }
      }
    );

    return () => unsubscribe();
  }, []);
}
```

### ファイル構成

```
app/
├── stores/
│   └── subscriptionStore.ts    # サブスクリプション状態管理
├── hooks/
│   ├── useSubscription.ts      # サブスクリプション操作フック
│   └── useSubscriptionSync.ts  # リアルタイム同期
└── services/
    └── subscription/
        └── subscriptionApi.ts  # API呼び出し

functions/
└── src/
    └── api/
        └── subscriptions/
            ├── create.ts       # 作成API
            ├── cancel.ts       # キャンセルAPI
            ├── getStatus.ts    # 状態取得API
            └── webhookHandlers.ts # Webhookハンドラー
```

## 注意事項

1. **オフライン対応**
   - AsyncStorageでキャッシュして、オフライン時も直近の状態を表示

2. **期限切れチェック**
   - アプリ起動時に有効期限をチェック
   - サーバー時刻を信頼する（クライアント時刻を信頼しない）

3. **Webhookの冪等性**
   - 同じイベントを複数回受信しても正しく動作するように実装

4. **セキュリティルール**
   - ユーザーは自分のサブスクリプション情報のみ読み取り可能
   - 書き込みはCloud Functionsのみ

5. **トライアル重複防止**
   - `hasUsedTrial`フラグでトライアルの二重利用を防止

## 見積もり

| 作業項目 | 工数 |
|---------|------|
| Firestoreスキーマ設計 | 2時間 |
| Cloud Functions実装 | 6時間 |
| Webhookハンドラー実装 | 4時間 |
| Zustand Store実装 | 3時間 |
| リアルタイム同期実装 | 2時間 |
| テスト | 4時間 |
| **合計** | **21時間（約3日）** |

## 進捗

- [ ] Firestoreスキーマ作成
- [ ] セキュリティルール設定
- [ ] サブスクリプション作成API実装
- [ ] サブスクリプション取得API実装
- [ ] Webhookハンドラー実装
- [ ] Zustand Store実装
- [ ] リアルタイム同期実装
- [ ] オフラインキャッシュ実装
- [ ] 期限切れ処理実装
- [ ] 統合テスト
