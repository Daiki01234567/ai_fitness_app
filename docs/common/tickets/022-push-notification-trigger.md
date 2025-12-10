# 022 プッシュ通知トリガー

## 概要

Firebase Cloud Messaging（FCM）を使用してプッシュ通知を送信する基盤を構築するチケットです。トレーニングのリマインダー、削除前の通知、課金関連のお知らせなど、アプリからユーザーへ通知を送る仕組みを実装します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築

## 要件

### 機能要件

- FR-024: プッシュ通知機能

### 非機能要件

- NFR-014: 通知の信頼性（リトライ機構）
- NFR-015: 非同期処理（Cloud Tasksとの統合）

## 受け入れ条件（Todo）

- [x] FCMトークンを保存する機能を実装（Usersコレクション）
- [x] FCMトークンを更新する機能を実装（クライアントから呼び出し）
- [x] プッシュ通知送信関数を実装（`sendNotification`）
- [x] 通知タイプごとのテンプレートを定義（リマインダー、削除通知、課金通知）
- [x] 通知失敗時のリトライ機構を実装
- [x] 通知履歴をFirestoreに保存（`notifications`コレクション）
- [x] 通知設定のON/OFFを確認する機能を実装
- [x] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認（オプション）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-024
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 通知API
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Notificationsコレクション

## 技術詳細

### データモデル

Usersコレクション（FCMトークン追加）:

```typescript
interface User {
  userId: string;
  fcmToken: string | null;  // FCMトークン
  fcmTokenUpdatedAt: Timestamp | null;
  notificationSettings: {
    enabled: boolean;
    trainingReminder: boolean;
    deletionNotice: boolean;
    billingNotice: boolean;
  };
  // 他のフィールド...
}
```

Notificationsコレクション（通知履歴）:

```typescript
interface Notification {
  notificationId: string;
  userId: string;
  type: 'training_reminder' | 'deletion_notice' | 'billing_notice';
  title: string;
  body: string;
  sentAt: Timestamp;
  status: 'success' | 'failed';
  failureReason: string | null;
}
```

### 実装例: FCMトークン更新

```typescript
export const notification_updateFCMToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { fcmToken } = request.data;

  if (!fcmToken || typeof fcmToken !== 'string') {
    throw new HttpsError('invalid-argument', 'FCMトークンが無効です');
  }

  await admin.firestore().collection('users').doc(uid).update({
    fcmToken: fcmToken,
    fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: 'FCMトークンを更新しました'
  };
});
```

### 実装例: プッシュ通知送信

```typescript
import { getMessaging } from 'firebase-admin/messaging';

interface SendNotificationParams {
  userId: string;
  type: 'training_reminder' | 'deletion_notice' | 'billing_notice';
  title: string;
  body: string;
}

async function sendNotification(params: SendNotificationParams): Promise<void> {
  const { userId, type, title, body } = params;

  // ユーザーのFCMトークンと通知設定を取得
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (!userData || !userData.fcmToken) {
    logger.warn('FCMトークンが見つかりません', { userId });
    return;
  }

  // 通知設定を確認
  if (!userData.notificationSettings?.enabled) {
    logger.info('通知が無効になっています', { userId });
    return;
  }

  const typeEnabled = userData.notificationSettings?.[getNotificationSettingKey(type)];
  if (!typeEnabled) {
    logger.info('この通知タイプが無効になっています', { userId, type });
    return;
  }

  try {
    // FCMで通知送信
    await getMessaging().send({
      token: userData.fcmToken,
      notification: {
        title,
        body
      },
      data: {
        type,
        userId
      }
    });

    // 通知履歴を保存
    await admin.firestore().collection('notifications').add({
      userId,
      type,
      title,
      body,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'success',
      failureReason: null
    });

    logger.info('通知送信成功', { userId, type });
  } catch (error) {
    logger.error('通知送信失敗', { userId, type, error });

    // 失敗履歴を保存
    await admin.firestore().collection('notifications').add({
      userId,
      type,
      title,
      body,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'failed',
      failureReason: error instanceof Error ? error.message : 'Unknown error'
    });

    // リトライキューに追加（Cloud Tasks）
    await enqueueNotificationRetry(params);
  }
}

function getNotificationSettingKey(type: string): string {
  switch (type) {
    case 'training_reminder':
      return 'trainingReminder';
    case 'deletion_notice':
      return 'deletionNotice';
    case 'billing_notice':
      return 'billingNotice';
    default:
      return 'enabled';
  }
}
```

### 通知テンプレート

```typescript
const NOTIFICATION_TEMPLATES = {
  training_reminder: {
    title: 'トレーニングの時間です',
    body: '今日も一緒に頑張りましょう！'
  },
  deletion_notice_30_days: {
    title: 'アカウント削除のお知らせ',
    body: 'アカウントは30日後に削除されます。キャンセルする場合は設定から変更してください。'
  },
  deletion_notice_7_days: {
    title: 'アカウント削除のお知らせ',
    body: 'アカウントは7日後に削除されます。キャンセルする場合は設定から変更してください。'
  },
  deletion_notice_1_day: {
    title: 'アカウント削除のお知らせ',
    body: 'アカウントは明日削除されます。キャンセルする場合は今すぐ設定から変更してください。'
  },
  billing_success: {
    title: '課金完了',
    body: '月額プランの更新が完了しました。'
  }
};
```

## テスト観点

- FCMトークンが正しく保存されること
- 通知設定がOFFの場合、通知が送信されないこと
- 通知送信成功時に履歴が保存されること
- 通知送信失敗時にリトライキューに追加されること
- 通知タイプごとに正しいテンプレートが使用されること

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装ファイル

- `functions/src/api/notification/updateFCMToken.ts` - FCMトークン更新API
- `functions/src/api/notification/settings.ts` - 通知設定API
- `functions/src/services/notificationService.ts` - 通知サービス
- `functions/src/types/notification.ts` - 型定義

## 備考

- この機能はExpo版・Flutter版の両方で使用されます
- 通知のスケジューリングは、チケット023（プッシュ通知スケジューラ）で実装します
- FCMトークンはクライアント側で取得してバックエンドに送信します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
