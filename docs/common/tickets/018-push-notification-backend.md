# 018 プッシュ通知基盤

## 概要

プッシュ通知を送信するためのバックエンド基盤を構築します。

プッシュ通知とは、アプリを開いていなくてもスマホに「通知」を送る機能です。「今日のトレーニングはいかがですか？」のようなリマインダーを送れるようになります。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/003: Firebase Authentication 統合

## 要件

### FCMトークン管理

1. **トークン登録API**: アプリから送られてくるFCMトークンを保存
2. **トークン更新**: トークンが変わったら自動で更新
3. **無効トークン削除**: 使われなくなったトークンを削除

### トピック購読管理

1. **トピック購読API**: ユーザーが特定のトピックを購読
2. **トピック解除API**: ユーザーがトピックの購読を解除
3. **対応トピック**:
   - `workout_reminders`: トレーニングリマインダー
   - `achievements`: 成果達成通知
   - `updates`: アプリ更新情報

### 通知送信API

1. **個別送信**: 特定のユーザーに通知を送信
2. **トピック送信**: トピック購読者全員に通知を送信
3. **送信ログ記録**: 送信履歴を記録

## 受け入れ条件

- [ ] FCMトークン登録APIが動作する
- [ ] トークンがFirestoreに保存される
- [ ] トピック購読APIが動作する
- [ ] トピック解除APIが動作する
- [ ] 個別通知送信APIが動作する
- [ ] トピック通知送信APIが動作する
- [ ] 送信ログが記録される
- [ ] 無効トークンが自動削除される

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 通知関連
- Firebase Cloud Messaging公式ドキュメント

## 技術詳細

### FCM（Firebase Cloud Messaging）とは？

Googleが提供する無料のプッシュ通知サービスです。

```
アプリ起動時
    ↓
FCMトークン取得（端末固有のID）
    ↓
バックエンドにトークン登録
    ↓
後でバックエンドがこのトークンを使って通知を送る
```

### APIエンドポイント

| 関数名 | メソッド | 説明 | レート制限 |
|--------|---------|------|-----------|
| `notification_registerToken` | POST | FCMトークン登録 | 10回/時 |
| `notification_subscribeToTopic` | POST | トピック購読 | 20回/日 |
| `notification_unsubscribeFromTopic` | POST | トピック解除 | 20回/日 |
| `notification_send` | POST | 通知送信（管理者用） | 100回/日 |

### FCMトークン登録APIの実装

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * FCMトークンを登録する
 *
 * アプリがFCMトークンを取得したら、このAPIで登録します。
 * トークンは端末ごとに異なり、アプリの再インストールなどで変わることがあります。
 */
export const notification_registerToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { token, deviceInfo } = request.data;

  // バリデーション
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'トークンが不正です');
  }

  const firestore = admin.firestore();

  // トークンを保存
  await firestore
    .collection('users')
    .doc(uid)
    .collection('fcmTokens')
    .doc(token)
    .set({
      token: token,
      deviceInfo: deviceInfo || null,  // iOS/Android, デバイスモデルなど
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    success: true,
    message: 'トークンを登録しました',
  };
});
```

### トピック購読APIの実装

```typescript
/**
 * トピックを購読する
 *
 * トピックとは、特定の種類の通知をまとめたグループです。
 * 例: workout_reminders に購読すると、トレーニングリマインダーが届く
 */
export const notification_subscribeToTopic = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { topic, token } = request.data;

  // 許可されたトピックかチェック
  const allowedTopics = ['workout_reminders', 'achievements', 'updates'];
  if (!allowedTopics.includes(topic)) {
    throw new HttpsError('invalid-argument', '無効なトピックです');
  }

  // FCMでトピックに購読
  await admin.messaging().subscribeToTopic(token, topic);

  // 購読状態を記録
  const firestore = admin.firestore();
  await firestore
    .collection('users')
    .doc(uid)
    .collection('topicSubscriptions')
    .doc(topic)
    .set({
      topic: topic,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      token: token,
    });

  return {
    success: true,
    message: `${topic}の通知を購読しました`,
  };
});
```

### 通知送信APIの実装

```typescript
/**
 * 通知を送信する
 *
 * 特定のユーザーまたはトピック購読者全員に通知を送ります。
 */
export const notification_send = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  // 管理者権限チェック（将来実装）
  // if (!request.auth.token.admin) {
  //   throw new HttpsError('permission-denied', '管理者権限が必要です');
  // }

  const { type, targetUserId, topic, title, body, data } = request.data;

  let response;

  if (type === 'individual' && targetUserId) {
    // 個別送信
    response = await sendToUser(targetUserId, { title, body, data });
  } else if (type === 'topic' && topic) {
    // トピック送信
    response = await sendToTopic(topic, { title, body, data });
  } else {
    throw new HttpsError('invalid-argument', 'typeとtargetUserIdまたはtopicが必要です');
  }

  // 送信ログを記録
  await logNotification({
    type,
    targetUserId,
    topic,
    title,
    body,
    sentAt: new Date().toISOString(),
    response,
  });

  return {
    success: true,
    message: '通知を送信しました',
    data: response,
  };
});

/**
 * 特定のユーザーに通知を送信
 */
async function sendToUser(
  userId: string,
  notification: { title: string; body: string; data?: any }
) {
  const firestore = admin.firestore();

  // ユーザーのFCMトークンを取得
  const tokensSnapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .get();

  if (tokensSnapshot.empty) {
    throw new HttpsError('not-found', 'FCMトークンが登録されていません');
  }

  const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

  // 通知を送信
  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    tokens: tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // 無効なトークンを削除
  await cleanupInvalidTokens(userId, tokens, response);

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

/**
 * トピック購読者全員に通知を送信
 */
async function sendToTopic(
  topic: string,
  notification: { title: string; body: string; data?: any }
) {
  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    topic: topic,
  };

  const response = await admin.messaging().send(message);

  return {
    messageId: response,
  };
}
```

### Firestoreコレクション構造

```
users/{userId}/
├── fcmTokens/
│   └── {token}/
│       ├── token: string           // FCMトークン
│       ├── deviceInfo: object      // デバイス情報
│       ├── createdAt: Timestamp
│       └── lastUsedAt: Timestamp
│
└── topicSubscriptions/
    └── {topic}/
        ├── topic: string           // トピック名
        ├── subscribedAt: Timestamp
        └── token: string           // 使用しているトークン

notificationLogs/
└── {logId}/
    ├── type: string                // individual, topic
    ├── targetUserId: string | null
    ├── topic: string | null
    ├── title: string
    ├── body: string
    ├── sentAt: Timestamp
    └── response: object
```

### 無効トークンのクリーンアップ

```typescript
/**
 * 送信に失敗したトークンを削除
 */
async function cleanupInvalidTokens(
  userId: string,
  tokens: string[],
  response: admin.messaging.BatchResponse
) {
  const firestore = admin.firestore();
  const invalidTokens: string[] = [];

  response.responses.forEach((resp, index) => {
    if (!resp.success) {
      const error = resp.error;
      // 無効なトークンエラーの場合
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  // 無効なトークンを削除
  for (const token of invalidTokens) {
    await firestore
      .collection('users')
      .doc(userId)
      .collection('fcmTokens')
      .doc(token)
      .delete();
  }
}
```

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-031 | プッシュ通知 |
| NFR-001 | 可用性99.9% |

## 見積もり

4日

## 進捗

- [ ] 未着手
