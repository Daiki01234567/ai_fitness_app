# 052 Stripe決済基盤セットアップ

## 概要

アプリ内課金の決済処理を行うためのStripe基盤を構築します。クレジットカード決済やサブスクリプション管理を安全に行えるようにします。Stripeをメインの決済手段として使用し、RevenueCatは代替手段として位置づけます。

## Phase

Phase 3（Apple認証・課金）

## 依存チケット

- 001: Expoプロジェクト初期セットアップ
- 004: Firebase Authentication設定

## 要件

### 機能要件（FR-022-1参照）

1. **Stripeアカウント設定**
   - Stripeアカウントの作成と設定
   - 日本向け設定（日本円対応）
   - テスト環境と本番環境の分離

2. **SDK統合**
   - @stripe/stripe-react-native の導入
   - Expo Development Buildでの動作確認

3. **サーバーサイド処理（Cloud Functions）**
   - PaymentIntent作成API
   - 顧客（Customer）管理API
   - サブスクリプション作成API

4. **Webhook設定**
   - 決済イベントの受信
   - サブスクリプション状態の同期
   - 失敗時のリトライ処理

### 決済サービスの方針

| サービス | 役割 | 理由 |
|---------|------|------|
| **Stripe（メイン）** | 主要な決済手段 | Web版との統一、柔軟な価格設定、日本での豊富な実績 |
| **RevenueCat（代替）** | バックアップ | Stripe導入に問題が生じた場合の代替手段 |

## 受け入れ条件

- [ ] Stripeアカウントが正しく設定されている
- [ ] @stripe/stripe-react-nativeが正常に動作する
- [ ] Cloud FunctionsでPaymentIntent作成APIが動作する
- [ ] Webhookでイベントを受信できる
- [ ] テスト環境で決済フローが動作する
- [ ] 日本円での決済ができる

## 参照ドキュメント

- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` - FR-022-1（決済システム）
- [Stripe公式ドキュメント](https://stripe.com/docs)
- [Stripe React Native SDK](https://github.com/stripe/stripe-react-native)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

## 技術詳細

### 使用ライブラリ

**フロントエンド（Expo）:**
```bash
npx expo install @stripe/stripe-react-native
```

**バックエンド（Cloud Functions）:**
```bash
npm install stripe
```

### アーキテクチャ図

```
ユーザー（アプリ）
    |
    v
+-------------------+
| Stripe SDK        |
| (フロントエンド)   |
+-------------------+
    |
    v (PaymentIntent取得)
+-------------------+
| Cloud Functions   |
| (バックエンド)     |
+-------------------+
    |
    v (決済処理)
+-------------------+
| Stripe API        |
+-------------------+
    |
    v (Webhook)
+-------------------+
| Cloud Functions   |
| (Webhook受信)      |
+-------------------+
    |
    v (データ保存)
+-------------------+
| Firestore         |
+-------------------+
```

### 実装手順

#### 1. Stripeアカウント設定

| 設定項目 | 説明 |
|---------|------|
| ビジネス情報 | 会社/個人情報の登録 |
| 銀行口座 | 売上入金先の設定 |
| 税金設定 | 日本の消費税設定 |
| APIキー | テスト用/本番用キーの取得 |

#### 2. 環境変数設定

```
# .env.local
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

#### 3. フロントエンド設定

```typescript
// app/_layout.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.yourapp" // Apple Pay用
    >
      {/* アプリのコンテンツ */}
    </StripeProvider>
  );
}
```

#### 4. Cloud Functions実装

**PaymentIntent作成API:**

```typescript
// functions/src/api/payments/createPaymentIntent.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const createPaymentIntent = functions.https.onCall(
  async (data, context) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }

    const { amount, currency = 'jpy' } = data;

    // Stripe Customer取得または作成
    const customer = await getOrCreateCustomer(context.auth.uid);

    // PaymentIntent作成
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: context.auth.uid,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }
);
```

**Webhook処理:**

```typescript
// functions/src/api/payments/webhook.ts
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // イベント処理
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;
    // ... 他のイベント
  }

  res.json({ received: true });
});
```

### ファイル構成

```
app/
├── services/
│   └── payment/
│       ├── stripeService.ts    # Stripe操作
│       └── paymentApi.ts       # API呼び出し
└── providers/
    └── StripeProvider.tsx      # Stripeプロバイダー設定

functions/
└── src/
    └── api/
        └── payments/
            ├── createPaymentIntent.ts
            ├── createSubscription.ts
            ├── cancelSubscription.ts
            └── webhook.ts
```

### Firestoreデータモデル

```typescript
// Customers コレクション
interface Customer {
  stripeCustomerId: string;    // StripeのCustomer ID
  userId: string;              // Firebase Auth UID
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Payments コレクション
interface Payment {
  userId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: Timestamp;
}
```

## 注意事項

1. **Development Build必須**
   - ネイティブモジュールを使用するため、Expo Goでは動作しない

2. **APIキーの管理**
   - 本番用のSecret Keyは絶対にフロントエンドに含めない
   - 環境変数で安全に管理する

3. **PCI DSS準拠**
   - カード情報はStripeが管理するため、アプリ側で保存しない
   - Stripe Elementsを使用して安全に入力を受け付ける

4. **テストカード**
   - テスト環境では専用のテストカード番号を使用
   - 例: `4242424242424242`（成功）、`4000000000000002`（失敗）

5. **Webhookのセキュリティ**
   - 必ず署名検証を行う
   - 冪等性（同じイベントを複数回受信しても問題ない）を確保

## 見積もり

| 作業項目 | 工数 |
|---------|------|
| Stripeアカウント設定 | 2時間 |
| SDK導入・設定 | 3時間 |
| Cloud Functions API実装 | 8時間 |
| Webhook実装 | 4時間 |
| テスト | 4時間 |
| **合計** | **21時間（約3日）** |

## 進捗

- [ ] Stripeアカウント作成・設定
- [ ] 環境変数設定（テスト/本番）
- [ ] @stripe/stripe-react-native導入
- [ ] StripeProvider設定
- [ ] Customer管理API実装
- [ ] PaymentIntent作成API実装
- [ ] Webhook設定・実装
- [ ] テストカードでの動作確認
- [ ] エラーハンドリング実装
