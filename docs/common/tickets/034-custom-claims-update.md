# 034 カスタムクレーム更新

## 概要

Firebase Authenticationのカスタムクレーム（ユーザーの権限情報）を管理する機能を強化するチケットです。premiumフラグの設定、トークン強制更新通知、クレームの一貫性チェックなどを実装します。

## Phase

Phase 3（課金バックエンド実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/033（課金状態同期関数）

## 要件

### 機能要件

- なし（セキュリティ機能のため）

### 非機能要件

- NFR-034: アクセス制御 - カスタムクレームによるきめ細かいアクセス制御

## 受け入れ条件（Todo）

### premiumフラグ管理

- [ ] premiumフラグの設定関数を実装
- [ ] 複数のクレームをまとめて更新する関数を実装
- [ ] クレーム更新のログ記録
- [ ] 更新失敗時のリトライ処理

### トークン強制更新

- [ ] クライアントへのトークン更新通知を実装
- [ ] リアルタイム通知（Firestoreリスナー経由）
- [ ] プッシュ通知（バックグラウンド時）
- [ ] 更新確認のフローを実装

### クレーム一貫性チェック

- [ ] Firestoreとクレームの整合性チェック
- [ ] 不整合時の自動修復
- [ ] 不整合アラートの送信

### 管理者機能

- [ ] 管理者によるクレーム強制更新API
- [ ] クレーム履歴の表示
- [ ] 緊急時のプレミアム付与/剥奪

### テスト

- [ ] クレーム更新のテスト
- [ ] トークン更新通知のテスト
- [ ] 一貫性チェックのテスト

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - アクセス制御

## 技術詳細

### カスタムクレームの構造

```typescript
interface CustomClaims {
  // プレミアム関連
  premium: boolean;                    // プレミアム会員フラグ
  subscriptionEnd: number | null;      // サブスクリプション終了日（Unix ms）
  subscriptionPlan: 'monthly' | 'yearly' | null;  // プラン種別

  // 権限関連
  admin: boolean;                      // 管理者フラグ
  moderator: boolean;                  // モデレーターフラグ

  // メタ情報
  claimsUpdatedAt: number;            // クレーム更新日時（Unix ms）
  claimsVersion: number;              // クレームバージョン（整合性チェック用）
}
```

### クレーム更新関数

```typescript
import * as admin from 'firebase-admin';

interface ClaimUpdate {
  premium?: boolean;
  subscriptionEnd?: number | null;
  subscriptionPlan?: 'monthly' | 'yearly' | null;
  admin?: boolean;
  moderator?: boolean;
}

/**
 * カスタムクレームを更新する
 *
 * @param userId FirebaseユーザーID
 * @param updates 更新するクレーム
 * @param options オプション
 */
export async function updateUserClaims(
  userId: string,
  updates: ClaimUpdate,
  options: { notifyClient?: boolean } = {}
): Promise<void> {
  const db = admin.firestore();

  // 現在のユーザー情報を取得
  const user = await admin.auth().getUser(userId);
  const currentClaims = (user.customClaims || {}) as Partial<CustomClaims>;

  // クレームバージョンをインクリメント
  const newVersion = (currentClaims.claimsVersion || 0) + 1;

  // 新しいクレームを構築
  const newClaims: CustomClaims = {
    premium: updates.premium ?? currentClaims.premium ?? false,
    subscriptionEnd: updates.subscriptionEnd !== undefined
      ? updates.subscriptionEnd
      : currentClaims.subscriptionEnd ?? null,
    subscriptionPlan: updates.subscriptionPlan !== undefined
      ? updates.subscriptionPlan
      : currentClaims.subscriptionPlan ?? null,
    admin: updates.admin ?? currentClaims.admin ?? false,
    moderator: updates.moderator ?? currentClaims.moderator ?? false,
    claimsUpdatedAt: Date.now(),
    claimsVersion: newVersion
  };

  // カスタムクレームを設定
  await admin.auth().setCustomUserClaims(userId, newClaims);

  // 更新ログを記録
  await db.collection('claimsUpdateLogs').add({
    userId,
    previousClaims: currentClaims,
    newClaims,
    updatedBy: 'system',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`カスタムクレーム更新: ${userId}`, newClaims);

  // クライアントへの通知
  if (options.notifyClient !== false) {
    await notifyClaimsUpdate(userId, newVersion);
  }
}

/**
 * クライアントにクレーム更新を通知する
 *
 * Firestoreのフラグを更新してクライアントに通知します。
 * クライアントはこのフラグを監視してトークンを更新します。
 */
async function notifyClaimsUpdate(
  userId: string,
  claimsVersion: number
): Promise<void> {
  const db = admin.firestore();

  await db.collection('users').doc(userId).update({
    tokenRefreshRequired: true,
    claimsVersion,
    tokenRefreshAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`トークン更新通知: ${userId} (version: ${claimsVersion})`);
}
```

### プレミアムフラグ専用関数

```typescript
/**
 * ユーザーをプレミアム会員にする
 */
export async function grantPremium(
  userId: string,
  plan: 'monthly' | 'yearly',
  endDate: Date
): Promise<void> {
  await updateUserClaims(userId, {
    premium: true,
    subscriptionPlan: plan,
    subscriptionEnd: endDate.getTime()
  });

  console.log(`プレミアム付与: ${userId} (${plan}, 終了: ${endDate.toISOString()})`);
}

/**
 * ユーザーのプレミアム会員資格を取り消す
 */
export async function revokePremium(userId: string): Promise<void> {
  await updateUserClaims(userId, {
    premium: false,
    subscriptionPlan: null,
    subscriptionEnd: null
  });

  console.log(`プレミアム剥奪: ${userId}`);
}

/**
 * プレミアム期間を延長する
 */
export async function extendPremium(
  userId: string,
  newEndDate: Date
): Promise<void> {
  await updateUserClaims(userId, {
    subscriptionEnd: newEndDate.getTime()
  });

  console.log(`プレミアム延長: ${userId} (新終了日: ${newEndDate.toISOString()})`);
}
```

### クレーム一貫性チェック

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * 毎時間クレームの一貫性をチェック
 */
export const claims_consistencyCheck = onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async () => {
  console.log('クレーム一貫性チェック開始');

  const db = admin.firestore();
  const inconsistencies: Array<{
    userId: string;
    issue: string;
    firestoreStatus: string;
    claimsPremium: boolean;
  }> = [];

  // プレミアムステータスのユーザーを取得
  const usersSnapshot = await db.collection('users')
    .where('subscriptionStatus', 'in', ['premium', 'trial', 'past_due', 'free'])
    .limit(1000)
    .get();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    try {
      // Firebase Authからクレームを取得
      const user = await admin.auth().getUser(userId);
      const claims = (user.customClaims || {}) as Partial<CustomClaims>;

      const firestoreIsPremium = ['premium', 'trial', 'past_due'].includes(
        userData.subscriptionStatus
      );
      const claimsIsPremium = claims.premium === true;

      // Firestoreとクレームの不整合チェック
      if (firestoreIsPremium !== claimsIsPremium) {
        inconsistencies.push({
          userId,
          issue: 'premium_mismatch',
          firestoreStatus: userData.subscriptionStatus,
          claimsPremium: claimsIsPremium
        });

        // 自動修復（Firestoreを正とする）
        await updateUserClaims(userId, {
          premium: firestoreIsPremium,
          subscriptionEnd: userData.subscriptionEndDate?.toDate().getTime() || null
        });
      }

      // クレームバージョンチェック
      if (userData.claimsVersion !== claims.claimsVersion) {
        inconsistencies.push({
          userId,
          issue: 'version_mismatch',
          firestoreStatus: userData.subscriptionStatus,
          claimsPremium: claimsIsPremium
        });
      }
    } catch (error) {
      console.error(`クレームチェックエラー: ${userId}`, error);
    }
  }

  if (inconsistencies.length > 0) {
    console.warn('クレーム不整合:', inconsistencies);

    await sendSlackAlert(
      `クレーム不整合: ${inconsistencies.length}件\n` +
      inconsistencies.slice(0, 10).map(i =>
        `- ${i.userId}: ${i.issue}`
      ).join('\n') +
      (inconsistencies.length > 10 ? `\n...他${inconsistencies.length - 10}件` : '')
    );
  }

  console.log(`クレーム一貫性チェック完了: ${usersSnapshot.size}件, 不整合${inconsistencies.length}件`);
});
```

### 管理者用クレーム強制更新API

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * 管理者によるクレーム強制更新API
 *
 * 緊急時にプレミアム付与/剥奪を行うための管理者専用API
 */
export const admin_updateUserClaims = onCall({
  region: 'asia-northeast1',
  maxInstances: 5
}, async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  // 管理者権限チェック
  if (!request.auth.token.admin) {
    throw new HttpsError('permission-denied', '管理者権限が必要です');
  }

  const { targetUserId, claims, reason } = request.data as {
    targetUserId: string;
    claims: ClaimUpdate;
    reason: string;
  };

  if (!targetUserId || !claims) {
    throw new HttpsError('invalid-argument', '対象ユーザーIDとクレームが必要です');
  }

  if (!reason) {
    throw new HttpsError('invalid-argument', '更新理由が必要です');
  }

  // 対象ユーザーの存在確認
  try {
    await admin.auth().getUser(targetUserId);
  } catch {
    throw new HttpsError('not-found', '対象ユーザーが見つかりません');
  }

  // クレームを更新
  await updateUserClaims(targetUserId, claims);

  // 管理者操作ログを記録
  await admin.firestore().collection('adminOperationLogs').add({
    operationType: 'update_claims',
    targetUserId,
    claims,
    reason,
    operatorId: request.auth.uid,
    operatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`管理者によるクレーム更新: ${targetUserId} by ${request.auth.uid}`);

  return {
    success: true,
    message: 'クレームを更新しました'
  };
});
```

### クライアント側の実装例

```typescript
// Expo/React Native側のコード

import { getAuth, onIdTokenChanged, getIdTokenResult } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

class ClaimsManager {
  private unsubscribeFirestore: (() => void) | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  /**
   * クレーム監視を開始
   */
  startWatching(userId: string) {
    const db = getFirestore();
    const auth = getAuth();

    // Firestoreのトークン更新フラグを監視
    this.unsubscribeFirestore = onSnapshot(
      doc(db, 'users', userId),
      async (snapshot) => {
        const data = snapshot.data();

        if (data?.tokenRefreshRequired) {
          console.log('トークン更新が必要');

          // トークンを強制更新
          await auth.currentUser?.getIdToken(true);

          // フラグをリセット
          await updateDoc(doc(db, 'users', userId), {
            tokenRefreshRequired: false
          });
        }
      }
    );

    // トークン変更を監視
    this.unsubscribeAuth = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        console.log('クレーム更新:', tokenResult.claims);

        // アプリの状態を更新
        this.onClaimsUpdated(tokenResult.claims);
      }
    });
  }

  /**
   * クレーム監視を停止
   */
  stopWatching() {
    this.unsubscribeFirestore?.();
    this.unsubscribeAuth?.();
  }

  /**
   * クレーム更新時のコールバック
   */
  private onClaimsUpdated(claims: any) {
    // プレミアム状態をアプリに反映
    if (claims.premium) {
      // プレミアム機能を有効化
    } else {
      // プレミアム機能を無効化
    }
  }
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- カスタムクレームのサイズ制限は1000バイト
- クレームの更新は即座に反映されない（次回トークン取得時）
- 強制更新にはgetIdToken(true)を使用

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
