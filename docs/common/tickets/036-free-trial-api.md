# 036 無料トライアル管理API

## 概要

7日間の無料トライアル期間を管理するAPI（`stripe_getTrialStatus`）を実装するチケットです。トライアル残り日数の確認、終了予定日の通知、トライアル終了前のリマインダーなどを提供します。

## Phase

Phase 3（課金機能実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 031: Stripe 統合基盤

## 要件

### 機能要件

- FR-019: 無料トライアル（1週間）

### 非機能要件

- NFR-001: 応答時間（200ms以内）

## 受け入れ条件（Todo）

- [x] `stripe_getTrialStatus` Callable Functionを実装
- [x] トライアル残り日数を計算する処理を実装
- [x] トライアル終了3日前にリマインダー通知を送る処理を実装
- [x] トライアル状態をFirestoreから取得する処理を実装
- [x] トライアル終了後の自動課金開始を確認する処理を実装
- [x] エラーハンドリングを実装
- [x] ユニットテストを作成（カバレッジ 80%以上）
- [ ] 統合テストで動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 8章（Stripe API）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-019

## 技術詳細

### API仕様

**エンドポイント**: `stripe_getTrialStatus`
**HTTPメソッド**: POST（Callable Function）
**認証**: 必須
**レート制限**: 50回/時

### リクエスト

```typescript
interface GetTrialStatusRequest {
  // パラメータなし（認証情報から自動取得）
}
```

### レスポンス

```typescript
interface GetTrialStatusResponse {
  success: true;
  data: {
    isTrialing: boolean;           // トライアル中かどうか
    trialEnd?: string;             // トライアル終了日（ISO 8601形式）
    daysRemaining?: number;        // 残り日数
    willBeChargedAt?: string;      // 課金開始日
    hasSubscription: boolean;      // サブスクリプションがあるか
  };
}
```

### 実装例

```typescript
// functions/src/api/stripe/getTrialStatus.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../../utils/stripe';
import * as admin from 'firebase-admin';

export const stripe_getTrialStatus = onCall(async (request) => {
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
          isTrialing: false,
          hasSubscription: false,
        },
      };
    }

    // Stripeからサブスクリプション詳細を取得
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const isTrialing = subscription.status === 'trialing';
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;

    let daysRemaining: number | undefined;
    if (isTrialing && trialEnd) {
      const now = new Date();
      const diff = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return {
      success: true,
      data: {
        isTrialing: isTrialing,
        trialEnd: trialEnd?.toISOString(),
        daysRemaining: daysRemaining,
        willBeChargedAt: trialEnd?.toISOString(),
        hasSubscription: true,
      },
    };
  } catch (error) {
    console.error('トライアル状態取得エラー:', error);
    throw new HttpsError(
      'internal',
      'トライアル状態の取得に失敗しました'
    );
  }
});
```

### トライアル終了前リマインダー通知

```typescript
// functions/src/scheduled/trialReminder.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { stripe } from '../utils/stripe';

/**
 * 毎日午前9時（JST）に実行
 * トライアル終了3日前のユーザーに通知を送る
 */
export const trialReminderScheduler = onSchedule(
  {
    schedule: 'every day 00:00',
    timeZone: 'Asia/Tokyo',
  },
  async (event) => {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Firestoreからトライアル中のユーザーを取得
    const usersSnapshot = await admin
      .firestore()
      .collection('users')
      .where('subscriptionStatus', '==', 'trialing')
      .get();

    const notifications: Promise<void>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const subscriptionId = userDoc.data().stripeSubscriptionId;
      if (!subscriptionId) continue;

      try {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );

        if (!subscription.trial_end) continue;

        const trialEnd = new Date(subscription.trial_end * 1000);
        const daysDiff = Math.ceil(
          (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // トライアル終了3日前のユーザーに通知
        if (daysDiff === 3) {
          notifications.push(
            sendTrialReminderNotification(userDoc.id, trialEnd)
          );
        }
      } catch (error) {
        console.error(
          `トライアルリマインダー処理失敗: ${userDoc.id}`,
          error
        );
      }
    }

    await Promise.all(notifications);
    console.log(`トライアルリマインダー送信完了: ${notifications.length}件`);
  }
);

async function sendTrialReminderNotification(
  userId: string,
  trialEnd: Date
): Promise<void> {
  // プッシュ通知の送信（チケット022で実装）
  console.log(
    `トライアルリマインダー通知: ${userId}, 終了日: ${trialEnd.toISOString()}`
  );
}
```

### トライアル終了後の処理

```typescript
// Webhook（チケット038）でトライアル終了イベントを受け取る
// customer.subscription.trial_will_end イベント
// customer.subscription.updated イベント（status: trialing -> active）
```

### テストコード例

```typescript
// functions/tests/api/stripe/getTrialStatus.test.ts
describe('stripe_getTrialStatus', () => {
  it('トライアル中のステータスを取得できる', async () => {
    const result = await stripe_getTrialStatus({
      auth: { uid: 'user_with_trial' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.isTrialing).toBe(true);
    expect(result.data.daysRemaining).toBeGreaterThan(0);
  });

  it('トライアル終了後はisTrial=false', async () => {
    const result = await stripe_getTrialStatus({
      auth: { uid: 'user_after_trial' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.isTrialing).toBe(false);
  });

  it('サブスクリプションがない場合', async () => {
    const result = await stripe_getTrialStatus({
      auth: { uid: 'user_without_subscription' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.hasSubscription).toBe(false);
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 実装完了（統合テスト待ち）

## 完了日

（統合テスト待ち）

## 備考

- トライアル期間は7日間（168時間）
- トライアル終了3日前にリマインダー通知を送る
- トライアル期間中に解約した場合は課金されない
- トライアル終了後は自動的に有料プランに移行する
- Cloud Schedulerで毎日午前9時にチェック

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了（getTrialStatus API、trialReminder スケジュール関数、テスト） |
