# 031 Stripe統合基盤

## 概要

Stripe（決済サービス）をFirebase Functionsに統合し、課金機能の基盤を構築するチケットです。Stripe SDKの設定、環境変数の管理、Stripe Customerの作成など、課金機能全体で使う共通部分を作ります。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築
- 004: ユーザープロフィール API

## 要件

### 機能要件

- FR-022: 決済（Stripe）

### 非機能要件

- NFR-032: セキュリティ基準（PCI DSS準拠）
- NFR-016: 課金再試行（指数バックオフ）

## 受け入れ条件（Todo）

- [ ] Stripe Node.js SDKをインストール（`npm install stripe`）
- [ ] Stripe APIキーを環境変数で管理（Secret Manager使用）
- [ ] Stripe Customerを作成するヘルパー関数を実装
- [ ] 既存のCustomerを取得する機能を実装
- [ ] Firestoreに`stripeCustomerId`を保存する機能を実装
- [ ] エラーハンドリングを実装（Stripe APIエラー対応）
- [ ] ユニットテストを作成（カバレッジ 80%以上）
- [ ] Stripe Test Modeでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - Stripe API仕様（8章）
- `docs/common/specs/02-1_機能要件_v1_0.md` - 課金機能要件（FR-019〜FR-022）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件

## 技術詳細

### Stripe SDK インストール

```bash
cd functions
npm install stripe
npm install --save-dev @types/stripe
```

### 環境変数設定

```bash
# Secret Managerにシークレットを登録
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# .env.local（ローカル開発用）
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Stripe初期化コード

```typescript
// functions/src/utils/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});
```

### Customer作成ヘルパー関数

```typescript
// functions/src/services/stripe.ts
import { stripe } from '../utils/stripe';
import * as admin from 'firebase-admin';

/**
 * Stripe Customerを作成または取得する
 * @param userId - Firebase Auth UID
 * @param email - ユーザーのメールアドレス
 * @returns Stripe Customer ID
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Firestoreから既存のCustomer IDを取得
  const userDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .get();

  const existingCustomerId = userDoc.data()?.stripeCustomerId;

  if (existingCustomerId) {
    // 既存のCustomer IDがあれば返す
    return existingCustomerId;
  }

  // 新しいCustomerを作成
  const customer = await stripe.customers.create({
    email: email,
    metadata: {
      firebaseUID: userId,
    },
  });

  // FirestoreにCustomer IDを保存
  await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .update({
      stripeCustomerId: customer.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return customer.id;
}
```

### エラーハンドリング

```typescript
import { HttpsError } from 'firebase-functions/v2/https';

try {
  const customer = await stripe.customers.create({ ... });
} catch (error) {
  if (error instanceof Stripe.errors.StripeError) {
    console.error('Stripe API error:', error.type, error.message);
    throw new HttpsError(
      'internal',
      `決済サービスでエラーが発生しました: ${error.message}`
    );
  }
  throw error;
}
```

### テストコード例

```typescript
// functions/tests/services/stripe.test.ts
import { getOrCreateStripeCustomer } from '../../src/services/stripe';
import * as admin from 'firebase-admin';

describe('Stripe Customer管理', () => {
  it('新しいCustomerを作成できる', async () => {
    const customerId = await getOrCreateStripeCustomer(
      'test_user_123',
      'test@example.com'
    );
    expect(customerId).toMatch(/^cus_/);
  });

  it('既存のCustomer IDがあれば再利用する', async () => {
    // 1回目の呼び出し
    const customerId1 = await getOrCreateStripeCustomer(
      'test_user_456',
      'test2@example.com'
    );

    // 2回目の呼び出し（同じユーザー）
    const customerId2 = await getOrCreateStripeCustomer(
      'test_user_456',
      'test2@example.com'
    );

    expect(customerId1).toBe(customerId2);
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Stripe APIキーは必ずSecret Managerで管理し、コードに直接書かない
- Test Mode（テスト環境）とLive Mode（本番環境）でAPIキーを分ける
- エラーログにはAPIキーやシークレットを含めないよう注意
- PCI DSS準拠のため、カード情報は直接扱わず、Stripeに任せる

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
