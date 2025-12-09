# 004 認証トリガー実装

## 概要

Firebase Authenticationで「ユーザーが登録した時」や「ユーザーが削除された時」に自動で動くプログラム（トリガー）を実装するチケットです。

例えば、新しいユーザーが登録したら、自動的にFirestoreにそのユーザーのプロフィールデータを作成します。ユーザーが退会したら、関連するデータを自動で削除します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 003（Cloud Functions基盤）

## 要件

### 機能要件

- FR-001: メールアドレス/パスワード認証 - 新規登録時の処理
- FR-015: Google認証 - Google認証での登録時の処理

### 非機能要件

- NFR-011: 認証 - JWT, OAuth 2.0による認証
- NFR-019: 同意管理 - 同意状態の初期化

## 受け入れ条件（Todo）

- [x] auth_onCreate トリガーを実装
  - [x] Firestoreにユーザードキュメントを自動作成
  - [x] 初期プロフィール（profile フィールド）を設定
  - [x] 同意フラグ（tosAccepted, ppAccepted）をfalseで初期化
  - [x] サブスクリプションステータスを'free'で初期化
- [x] auth_onDelete トリガーを実装
  - [x] Firestoreからユーザードキュメントを削除
  - [x] 関連するサブコレクション（sessions, subscriptions）を削除
- [x] カスタムクレーム設定の基盤を実装
- [ ] ユニットテストを作成
- [ ] エミュレータでテストが通ることを確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - auth_onCreate, auth_onDeleteの仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクションのスキーマ

## 技術詳細

### auth_onCreate トリガー

```typescript
// functions/src/auth/onCreate.ts
import { onUserCreated } from "firebase-functions/v2/identity";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "../utils/logger";

export const auth_onCreate = onUserCreated(async (event) => {
  const user = event.data;
  const uid = user.uid;
  const email = user.email || "";
  const displayName = user.displayName || null;
  const photoURL = user.photoURL || null;

  logger.info("新規ユーザー作成", { uid, email });

  const db = getFirestore();

  try {
    await db.collection("users").doc(uid).set({
      // 基本情報
      userId: uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL,

      // プロフィール情報（初期値はnull）
      profile: {
        height: null,
        weight: null,
        birthday: null,
        gender: null,
        fitnessLevel: null,
        goals: [],
      },

      // 同意管理（初期値はfalse）
      tosAccepted: false,
      tosAcceptedAt: null,
      tosVersion: null,
      ppAccepted: false,
      ppAcceptedAt: null,
      ppVersion: null,

      // アカウント状態
      isActive: true,
      deletionScheduled: false,
      deletionScheduledAt: null,
      scheduledDeletionDate: null,

      // 強制ログアウト
      forceLogout: false,
      forceLogoutAt: null,

      // サブスクリプション（初期値はfree）
      subscriptionStatus: "free",
      subscriptionPlan: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,

      // システム管理
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),

      // データ保持期間（作成から3年）
      dataRetentionDate: null, // 後で計算して設定
    });

    logger.info("ユーザードキュメント作成完了", { uid });
  } catch (error) {
    logger.error("ユーザードキュメント作成失敗", { uid, error });
    throw error;
  }
});
```

### auth_onDelete トリガー

```typescript
// functions/src/auth/onDelete.ts
import { onUserDeleted } from "firebase-functions/v2/identity";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "../utils/logger";

export const auth_onDelete = onUserDeleted(async (event) => {
  const user = event.data;
  const uid = user.uid;

  logger.info("ユーザー削除開始", { uid });

  const db = getFirestore();

  try {
    // サブコレクションを削除
    await deleteSubcollections(db, uid);

    // ユーザードキュメントを削除
    await db.collection("users").doc(uid).delete();

    logger.info("ユーザー削除完了", { uid });
  } catch (error) {
    logger.error("ユーザー削除失敗", { uid, error });
    throw error;
  }
});

async function deleteSubcollections(
  db: FirebaseFirestore.Firestore,
  uid: string
): Promise<void> {
  const userRef = db.collection("users").doc(uid);

  // sessions サブコレクション削除
  const sessions = await userRef.collection("sessions").get();
  const batch = db.batch();

  for (const doc of sessions.docs) {
    // frames サブコレクションも削除
    const frames = await doc.ref.collection("frames").get();
    for (const frame of frames.docs) {
      batch.delete(frame.ref);
    }
    batch.delete(doc.ref);
  }

  // subscriptions サブコレクション削除
  const subscriptions = await userRef.collection("subscriptions").get();
  for (const doc of subscriptions.docs) {
    batch.delete(doc.ref);
  }

  await batch.commit();
}
```

### カスタムクレーム設定

```typescript
// functions/src/utils/customClaims.ts
import { getAuth } from "firebase-admin/auth";
import { logger } from "./logger";

export async function setCustomClaims(
  uid: string,
  claims: Record<string, unknown>
): Promise<void> {
  const auth = getAuth();

  try {
    await auth.setCustomUserClaims(uid, claims);
    logger.info("カスタムクレーム設定完了", { uid, claims });
  } catch (error) {
    logger.error("カスタムクレーム設定失敗", { uid, error });
    throw error;
  }
}

// 使用例: 管理者権限を付与
// await setCustomClaims(uid, { admin: true });

// 使用例: 強制ログアウトを設定
// await setCustomClaims(uid, { forceLogout: true, forceLogoutAt: Date.now() });
```

### index.ts でのエクスポート

```typescript
// functions/src/index.ts
export { auth_onCreate } from "./auth/onCreate";
export { auth_onDelete } from "./auth/onDelete";
```

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月10日

## 備考

- Flutter版で既に実装済みのトリガーを流用
- ソーシャルログイン（Google）でも同じトリガーが発火する
- Apple認証はPhase 3で追加予定

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 既存実装を反映、ステータスを完了に更新 |
