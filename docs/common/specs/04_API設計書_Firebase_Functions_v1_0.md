# API設計書(Firebase Functions) v1.0

**バージョン**: 1.0
**最終更新日**: 2025年12月9日
**対象**: AIフィットネスアプリ（共通仕様）
**基準**: Expo版要件定義書 v1.0

---

## 目次

1. [ドキュメント概要](#1-ドキュメント概要)
2. [API設計原則](#2-api設計原則)
3. [共通仕様](#3-共通仕様)
4. [認証API](#4-認証api)
5. [ユーザー管理API](#5-ユーザー管理api)
6. [トレーニングセッションAPI](#6-トレーニングセッションapi)
7. [GDPR対応API](#7-gdpr対応api)
8. [課金API（Stripe連携）](#8-課金apistripe連携)
9. [管理API](#9-管理api)
10. [エラーハンドリング](#10-エラーハンドリング)

---

## 1. ドキュメント概要

### 1.1 目的

本ドキュメントは、AIフィットネスアプリのFirebase Functions APIを定義します。

**設計の目標**:
- GDPR完全準拠のAPI設計
- Stripe決済との統合（Expo/Flutter共通）
- セキュリティファーストの実装
- エラーハンドリングの標準化

### 1.2 想定読者

- バックエンドエンジニア
- フロントエンドエンジニア（Expo/React Native、Flutter/Dart）
- QAエンジニア
- プロジェクトマネージャー

### 1.3 参照ドキュメント

| ドキュメント名 | バージョン | 参照目的 |
|--------------|-----------|---------|
| プロジェクト概要 | v1.0 | プロジェクト全体理解 |
| 機能要件 | v1.0 | 機能要件の詳細 |
| 非機能要件 | v1.0 | パフォーマンス・セキュリティ要件 |
| Firestoreデータベース設計書 | v1.0 | データモデル |

### 1.4 用語定義

| 用語 | 定義 |
|-----|------|
| **Firebase Functions** | サーバーレスバックエンド実行環境 |
| **Callable Functions** | クライアントから直接呼び出せるHTTPS関数 |
| **Cloud Tasks** | 非同期タスクキュー |
| **Stripe** | 決済処理プラットフォーム（Expo/Flutter共通） |
| **RevenueCat** | サブスクリプション管理プラットフォーム（緊急時の代替手段） |
| **DLQ** | Dead Letter Queue（処理失敗メッセージの保管場所） |

---

## 2. API設計原則

### 2.1 設計方針

#### 2.1.1 セキュリティファースト
- **全APIで認証必須**（一部のWebhookを除く）
- **Firestore Security Rulesとの二重チェック**
- **入力値の厳格なバリデーション**
- **レート制限の実装**

#### 2.1.2 GDPR完全準拠
- **データ最小化**: 必要最小限のデータのみ収集
- **保存期間制限**: 不要になったデータは自動削除
- **ユーザー権利の保証**: アクセス権、削除権、訂正権
- **同意管理**: 明示的な同意の取得と記録

#### 2.1.3 パフォーマンス最適化
- **応答時間**: 95パーセンタイル 200ms以内
- **非同期処理**: 時間のかかる処理はCloud Tasksで非同期化
- **リトライ戦略**: 一時的なエラーは自動リトライ

### 2.2 命名規則

#### 2.2.1 Function命名規則

```
{domain}_{action}[{resource}]
```

**例**:
- `auth_signUp`: 認証ドメインのサインアップ操作
- `user_updateProfile`: ユーザードメインのプロフィール更新
- `stripe_createCheckoutSession`: Stripe決済セッション作成（Expo版）

### 2.3 レスポンス形式

#### 2.3.1 成功レスポンス

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

**例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": "user@example.com"
  },
  "message": "プロフィールを更新しました"
}
```

#### 2.3.2 エラーレスポンス

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

## 3. 共通仕様

### 3.1 認証

#### 3.1.1 Firebase Authentication

**全てのCallable Functions**は、Firebase Authenticationによる認証が必須です。

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const exampleFunction = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  // 処理...
});
```

#### 3.1.2 削除予定ユーザーのアクセス制御

削除予定ユーザーは読み取り専用モードに制限されます。

```typescript
async function checkDeletionScheduled(uid: string): Promise<boolean> {
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(uid)
    .get();

  return userDoc.data()?.deletionScheduled === true;
}

// 全ての書き込み系APIで使用
export const user_updateProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 削除予定ユーザーチェック
  if (await checkDeletionScheduled(uid)) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、データを変更できません。'
    );
  }

  // 処理...
});
```

### 3.2 レート制限

| API | 制限 | 時間窓 | 備考 |
|-----|------|--------|------|
| **認証系** | | | |
| `auth_signUp` | 10回 | 1時間/IP | スパム防止 |
| **ユーザー管理系** | | | |
| `user_updateProfile` | 50回 | 1時間/ユーザー | 通常更新 |
| **トレーニング系** | | | |
| `training_createSession` | 100回 | 1日/ユーザー | 1日の最大セッション数 |
| **GDPR系** | | | |
| `gdpr_requestDataExport` | 3回 | 1ヶ月/ユーザー | 権利行使制限 |

### 3.3 エラーコード体系

| コード | 説明 | HTTPステータス | リトライ可能 |
|--------|------|---------------|------------|
| `UNAUTHENTICATED` | 認証されていない | 401 | ❌ |
| `PERMISSION_DENIED` | 権限がない | 403 | ❌ |
| `INVALID_ARGUMENT` | 無効な引数 | 400 | ❌ |
| `NOT_FOUND` | リソースが見つからない | 404 | ❌ |
| `RESOURCE_EXHAUSTED` | レート制限超過 | 429 | ✅（遅延後） |
| `INTERNAL` | 内部エラー | 500 | ✅ |
| `UNAVAILABLE` | サービス利用不可 | 503 | ✅ |

---

## 4. 認証API

### 4.1 auth_onCreate (Trigger)

**トリガー**: Firebase Authentication - onCreate
**目的**: 新規ユーザー作成時の初期設定

**処理内容**:
1. Firestoreにユーザードキュメントを作成
2. 初期プロフィール設定
3. 無料プランの設定
4. ログ記録

**実装例**:

```typescript
export const auth_onCreate = onUserCreated(async (event) => {
  const user = event.data;
  const uid = user.uid;
  const email = user.email || '';

  await admin.firestore().collection('users').doc(uid).set({
    userId: uid,
    email: email,
    displayName: null,
    photoURL: null,
    profile: {
      height: null,
      weight: null,
      birthday: null,
      gender: null,
      fitnessLevel: null,
      goals: []
    },
    tosAccepted: false,
    tosAcceptedAt: null,
    tosVersion: null,
    ppAccepted: false,
    ppAcceptedAt: null,
    ppVersion: null,
    isActive: true,
    deletionScheduled: false,
    deletionScheduledAt: null,
    scheduledDeletionDate: null,
    forceLogout: false,
    forceLogoutAt: null,
    subscriptionStatus: 'free',
    subscriptionPlan: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
  });
});
```

### 4.2 auth_onDelete (Trigger)

**トリガー**: Firebase Authentication - onDelete
**目的**: ユーザー削除時のクリーンアップ

**処理内容**:
1. Firestoreからユーザーデータを完全削除
2. BigQueryの仮名化データを削除
3. Stripe顧客情報の削除（Expo版）

---

## 5. ユーザー管理API

### 5.1 user_updateProfile

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 50回/時

**リクエスト**:

```typescript
interface UpdateProfileRequest {
  displayName?: string | null;
  profile?: {
    height?: number | null;
    weight?: number | null;
    birthday?: string | null;  // YYYY-MM-DD
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
    fitnessLevel?: 'beginner' | 'intermediate' | 'advanced' | null;
    goals?: string[];
  };
}
```

**レスポンス**:

```typescript
interface UpdateProfileResponse {
  success: true;
  data: {
    userId: string;
    displayName: string | null;
    profile: UserProfile;
    updatedAt: string;
  };
  message: string;
}
```

### 5.2 user_updateConsent

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 10回/時

**目的**: 利用規約・プライバシーポリシーへの同意を記録

**リクエスト**:

```typescript
interface UpdateConsentRequest {
  tosAccepted: boolean;
  tosVersion: string;
  ppAccepted: boolean;
  ppVersion: string;
}
```

**処理内容**:
1. Firestoreのusersコレクションを更新
2. consentsコレクションに履歴を記録
3. IPアドレスとユーザーエージェントを記録（GDPR監査用）

### 5.3 user_revokeConsent

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 5回/日

**目的**: 同意撤回と強制ログアウト

**処理内容**:
1. Firestoreで同意フラグをfalseに更新
2. `forceLogout`フラグをtrueに設定
3. Firebase Authリフレッシュトークンを無効化
4. カスタムクレームで強制ログアウト設定

**実装例**:

```typescript
export const user_revokeConsent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 1. Firestoreで同意を撤回
  await admin.firestore().collection('users').doc(uid).update({
    tosAccepted: false,
    tosAcceptedAt: null,
    tosVersion: null,
    ppAccepted: false,
    ppAcceptedAt: null,
    ppVersion: null,
    forceLogout: true,
    forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. リフレッシュトークンを無効化
  await admin.auth().revokeRefreshTokens(uid);

  // 3. カスタムクレームで強制ログアウト
  await admin.auth().setCustomUserClaims(uid, {
    forceLogout: true,
    forceLogoutAt: Date.now()
  });

  return {
    success: true,
    message: '同意を撤回しました。即座にログアウトされます。',
    forceLogout: true
  };
});
```

---

## 6. トレーニングセッションAPI

### 6.1 training_createSession

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 100回/日

**リクエスト**:

```typescript
interface CreateSessionRequest {
  exerciseType: 'squat' | 'pushup' | 'armcurl' | 'sidelateral' | 'shoulderpress';
  cameraSettings: {
    position: 'front' | 'side';
    resolution: string;
    fps: number;
  };
}
```

**レスポンス**:

```typescript
interface CreateSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    exerciseType: string;
    startTime: string;
    status: 'active';
  };
}
```

### 6.2 training_completeSession

**HTTP Method**: POST
**認証**: 必須

**リクエスト**:

```typescript
interface CompleteSessionRequest {
  sessionId: string;
  repCount: number;
  setCount: number;
  formFeedback: {
    overallScore: number;
    goodFrames: number;
    warningFrames: number;
    errorFrames: number;
    warnings: Array<{
      type: string;
      count: number;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
  sessionMetadata: {
    totalFrames: number;
    processedFrames: number;
    averageFps: number;
    frameDropCount: number;
    averageConfidence: number;
    mediapipePerformance: {
      averageInferenceTime: number;
      maxInferenceTime: number;
      minInferenceTime: number;
    };
    deviceInfo: {
      platform: 'iOS' | 'Android';
      osVersion: string;
      deviceModel: string;
      deviceMemory: number | null;
    };
  };
}
```

**処理内容**:
1. セッションを完了状態に更新
2. トレーニング結果を保存
3. BigQueryに仮名化データを非同期送信

---

## 7. GDPR対応API

### 7.1 gdpr_requestDataExport

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 3回/月

**目的**: GDPR第15条（アクセス権）の実装

**処理内容**:
1. Firestoreから全ユーザーデータを収集
2. JSON形式でエクスポート
3. 一時ストレージにアップロード
4. ダウンロードURLを生成（24時間有効）
5. メール通知

**レスポンス**:

```typescript
interface DataExportResponse {
  success: true;
  data: {
    exportId: string;
    downloadUrl: string;
    expiresAt: string;  // 24時間後
  };
  message: string;
}
```

### 7.2 gdpr_requestAccountDeletion

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 3回/月

**目的**: GDPR第17条（削除権）の実装

**処理内容**:
1. `deletionScheduled`フラグをtrueに設定
2. `scheduledDeletionDate`を30日後に設定
3. dataDeletionRequestsコレクションに記録
4. メール通知
5. 30日後にCloud Functionsで自動削除

**レスポンス**:

```typescript
interface AccountDeletionResponse {
  success: true;
  data: {
    requestId: string;
    scheduledDeletionDate: string;  // 30日後
  };
  message: string;
}
```

### 7.3 gdpr_cancelAccountDeletion

**HTTP Method**: POST
**認証**: 必須

**目的**: 削除リクエストのキャンセル（30日以内）

**処理内容**:
1. `deletionScheduled`フラグをfalseに設定
2. dataDeletionRequestsのステータスを'cancelled'に更新
3. メール通知

---

## 8. 課金API（Stripe連携）

**決済サービスの統一方針（2025年12月更新）**:
- Expo版、Flutter版ともに**Stripeをメイン決済サービス**として使用
- RevenueCatは緊急時の代替手段としてのみ位置づけ
- 理由: Web版との統一、バックエンド（Cloud Functions）での一元管理が可能

### 8.1 stripe_createCheckoutSession（共通）

**HTTP Method**: POST
**認証**: 必須
**レート制限**: 10回/時

**目的**: Stripe Checkoutセッションを作成

**リクエスト**:

```typescript
interface CreateCheckoutSessionRequest {
  priceId: string;  // Stripe Price ID（例: 'price_monthly_500'）
  successUrl: string;
  cancelUrl: string;
}
```

**レスポンス**:

```typescript
interface CreateCheckoutSessionResponse {
  success: true;
  data: {
    sessionId: string;
    url: string;  // Stripe Checkout URL
  };
}
```

**実装例**:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const stripe_createCheckoutSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { priceId, successUrl, cancelUrl } = request.data;

  // Stripe Customerを作成または取得
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  let customerId = userDoc.data()?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: request.auth.token.email,
      metadata: { firebaseUID: uid }
    });
    customerId = customer.id;

    await admin.firestore().collection('users').doc(uid).update({
      stripeCustomerId: customerId
    });
  }

  // Checkout Sessionを作成
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 7  // 7日間無料トライアル
    }
  });

  return {
    success: true,
    data: {
      sessionId: session.id,
      url: session.url
    }
  };
});
```

**Flutter版の実装**:
- `flutter_stripe`パッケージを使用（`flutter pub add flutter_stripe`でインストール）
- Payment Sheetの表示コードはExpo版とほぼ同じフロー
- iOSの場合はApple Pay、AndroidはGoogle Payも利用可能

### 8.2 stripe_webhook（Webhook）

**HTTP Method**: POST
**認証**: Stripeシグネチャ検証
**目的**: Stripeイベントを受信してFirestoreを更新

**処理するイベント**:
- `customer.subscription.created`: サブスクリプション作成
- `customer.subscription.updated`: サブスクリプション更新
- `customer.subscription.deleted`: サブスクリプション削除
- `invoice.payment_succeeded`: 支払い成功
- `invoice.payment_failed`: 支払い失敗

**実装例**:

```typescript
import { onRequest } from 'firebase-functions/v2/https';

export const stripe_webhook = onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send('Webhook Error');
    return;
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(subscription);
      break;

    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancellation(deletedSubscription);
      break;

    case 'invoice.payment_failed':
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailure(invoice);
      break;
  }

  res.json({ received: true });
});

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const firebaseUID = subscription.metadata.firebaseUID;

  await admin.firestore().collection('users').doc(firebaseUID).update({
    subscriptionStatus: subscription.status === 'active' ? 'premium' : 'free',
    stripeSubscriptionId: subscription.id,
    subscriptionStartDate: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_start * 1000)
    ),
    subscriptionEndDate: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_end * 1000)
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### 8.3 revenuecat_webhook（緊急時の代替手段）

> **注意**: このAPIは緊急時の代替手段としてのみ使用します。通常はStripeを使用してください。

**HTTP Method**: POST
**認証**: RevenueCat Webhook署名検証
**目的**: RevenueCatイベントを受信してFirestoreを更新

**RevenueCatを使用する緊急時の例**:
- Stripeの重大な障害が発生した場合
- 特定の地域でStripeが利用できない場合
- アプリストア（Apple/Google）からの直接課金が必須となった場合

**処理するイベント**:
- `INITIAL_PURCHASE`: 初回購入
- `RENEWAL`: サブスクリプション更新
- `CANCELLATION`: キャンセル
- `EXPIRATION`: 有効期限切れ

**切り替え時の注意点**:
- 既存のStripeユーザーとの整合性を保つため、移行計画を立てること
- RevenueCatのダッシュボードでFirebase UIDとの紐付けを設定すること
- バックエンドのsubscriptionStatusフィールドは共通で使用可能

---

## 9. 管理API

### 9.1 maintenance_deleteExpiredData（Scheduled）

**トリガー**: Cloud Scheduler（毎日午前3時UTC）
**目的**: 3年以上経過したデータを自動削除

**処理内容**:
1. `dataRetentionDate`が過去のユーザーを検索
2. 完全削除を実行
3. BigQueryの仮名化データも削除
4. ログ記録

### 9.2 gdpr_executeScheduledDeletions（Scheduled）

**トリガー**: Cloud Scheduler（毎日午前4時UTC）
**目的**: 30日猶予期間が経過したアカウントを削除

**処理内容**:
1. `scheduledDeletionDate`が過去のリクエストを検索
2. ユーザーデータを完全削除
3. Firebase Authenticationからアカウント削除
4. dataDeletionRequestsのステータスを'completed'に更新

---

## 10. エラーハンドリング

### 10.1 リトライ戦略

| エラーカテゴリ | リトライ回数 | バックオフ | 説明 |
|--------------|------------|-----------|------|
| **一時的なエラー** | 3回 | 指数バックオフ | ネットワークエラー、タイムアウト |
| **レート制限** | 3回 | 固定遅延（10秒） | 429エラー |
| **BigQuery同期** | 10回 | Cloud Tasks | Dead Letter Queue付き |
| **決済エラー** | 0回 | なし | ユーザーに通知 |

### 10.2 Cloud TasksによるBigQuery同期

```typescript
async function syncToBigQueryWithRetry(tableName: string, data: any) {
  try {
    await insertToBigQuery(tableName, data);
  } catch (error) {
    console.error('BigQuery sync failed, enqueuing task for retry:', error);

    const tasksClient = new CloudTasksClient();
    const parent = tasksClient.queuePath(
      process.env.GOOGLE_CLOUD_PROJECT!,
      'asia-northeast1',
      'bigquery-sync-queue'
    );

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `https://asia-northeast1-${process.env.GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/internal_syncToBigQuery`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({
          tableName,
          data,
          retryCount: 0
        })).toString('base64'),
      },
    };

    await tasksClient.createTask({ parent, task });
  }
}
```

### 10.3 エラーログとモニタリング

全てのエラーはCloud Loggingに記録し、重要なエラーはCloud Monitoringでアラート設定します。

**ログレベル**:
- **INFO**: 通常のAPI呼び出し
- **WARNING**: リトライ可能なエラー
- **ERROR**: リトライ不可能なエラー
- **CRITICAL**: システム障害

---

## 変更履歴

| バージョン | 日付 | 主な変更内容 |
|-----------|------|-------------|
| **v1.0** | 2025年12月9日 | 初版作成。Flutter版v3.3を基に、Expo版向けにStripe決済統合を追加。RevenueCatのWebhookも残して両プラットフォーム対応。 |
| **v1.0** | 2025年12月10日 | 決済サービス統一方針を追加。Expo/Flutter両版でStripeをメイン決済サービスに統一。RevenueCatは緊急時の代替手段に格下げ。 |

---

**このドキュメントは、Expo版とFlutter版の両方で共通利用可能です。**

**作成者**: Claude (Documentation Engineer)
**最終確認日**: 2025年12月9日
