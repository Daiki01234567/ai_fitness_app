# 023 プッシュ通知スケジューラ

## 概要

定期的なトレーニングリマインダーや、アカウント削除前の通知を自動で送信するスケジューラを実装するチケットです。Cloud Schedulerを使用して、指定された時刻に通知を送る仕組みを構築します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 022: プッシュ通知トリガー

## 要件

### 機能要件

- FR-024: プッシュ通知機能（定期通知）
- FR-037: ユーザー削除前通知

### 非機能要件

- NFR-015: 非同期処理（Cloud Schedulerとの統合）
- NFR-014: 通知の信頼性

## 受け入れ条件（Todo）

- [ ] トレーニングリマインダーの時刻設定を保存する機能を実装
- [ ] ユーザーごとのリマインダー時刻を管理する機能を実装
- [ ] Cloud Schedulerでトリガーされるリマインダー送信関数を実装
- [ ] 削除予定ユーザーに30日前、7日前、1日前の通知を送信する機能を実装
- [ ] 削除予定日を毎日チェックするスケジュール関数を実装（午前4時UTC）
- [ ] リマインダー設定のON/OFF機能を実装
- [ ] タイムゾーンを考慮した通知時刻の計算を実装
- [ ] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-024, FR-037
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 通知API
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション

## 技術詳細

### データモデル

Usersコレクション（リマインダー設定追加）:

```typescript
interface User {
  userId: string;
  notificationSettings: {
    enabled: boolean;
    trainingReminder: boolean;
    reminderTime: string;  // "HH:MM" 形式（例: "19:00"）
    reminderDays: string[];  // 曜日（例: ["monday", "wednesday", "friday"]）
    timezone: string;  // タイムゾーン（例: "Asia/Tokyo"）
  };
  // 他のフィールド...
}
```

### 実装例: リマインダー設定API

```typescript
export const notification_updateReminderSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { reminderTime, reminderDays, timezone } = request.data;

  // バリデーション
  if (!reminderTime || !reminderDays || !timezone) {
    throw new HttpsError('invalid-argument', '必須項目が不足しています');
  }

  await admin.firestore().collection('users').doc(uid).update({
    'notificationSettings.reminderTime': reminderTime,
    'notificationSettings.reminderDays': reminderDays,
    'notificationSettings.timezone': timezone,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: 'リマインダー設定を更新しました'
  };
});
```

### 実装例: トレーニングリマインダー送信（Scheduled Function）

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const notification_sendTrainingReminders = onSchedule({
  schedule: 'every 1 hours',  // 1時間ごとに実行
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = getDayOfWeek(now);

  // リマインダーを送信すべきユーザーを検索
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('notificationSettings.enabled', '==', true)
    .where('notificationSettings.trainingReminder', '==', true)
    .get();

  const notificationPromises = [];

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const { reminderTime, reminderDays, timezone } = userData.notificationSettings;

    // ユーザーのタイムゾーンで現在時刻を計算
    const userLocalTime = getLocalTime(now, timezone);
    const userHour = userLocalTime.getHours();

    // リマインダー時刻と曜日をチェック
    const [targetHour] = reminderTime.split(':').map(Number);

    if (userHour === targetHour && reminderDays.includes(currentDay)) {
      notificationPromises.push(
        sendNotification({
          userId: doc.id,
          type: 'training_reminder',
          title: 'トレーニングの時間です',
          body: '今日も一緒に頑張りましょう！'
        })
      );
    }
  }

  await Promise.allSettled(notificationPromises);
  logger.info('トレーニングリマインダー送信完了', { count: notificationPromises.length });
});

function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function getLocalTime(date: Date, timezone: string): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}
```

### 実装例: 削除予定通知（Scheduled Function）

```typescript
export const notification_sendDeletionNotices = onSchedule({
  schedule: 'every day 04:00',  // 毎日午前4時UTC
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  const now = new Date();

  // 削除予定ユーザーを取得
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('deletionScheduled', '==', true)
    .get();

  const notificationPromises = [];

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const scheduledDate = userData.scheduledDeletionDate.toDate();
    const daysUntilDeletion = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 30日前、7日前、1日前に通知
    if (daysUntilDeletion === 30 || daysUntilDeletion === 7 || daysUntilDeletion === 1) {
      notificationPromises.push(
        sendNotification({
          userId: doc.id,
          type: 'deletion_notice',
          title: 'アカウント削除のお知らせ',
          body: `アカウントは${daysUntilDeletion}日後に削除されます。キャンセルする場合は設定から変更してください。`
        })
      );
    }
  }

  await Promise.allSettled(notificationPromises);
  logger.info('削除予定通知送信完了', { count: notificationPromises.length });
});
```

## テスト観点

- ユーザーのタイムゾーンを考慮した通知時刻の計算が正しいこと
- 指定された曜日にのみリマインダーが送信されること
- 削除予定日の30日前、7日前、1日前に通知が送信されること
- リマインダー設定がOFFの場合、通知が送信されないこと
- スケジュール関数が定期的に実行されること

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

- この機能はチケット022（プッシュ通知トリガー）に依存します
- タイムゾーンの考慮が必要です（日本時間、UTC、ユーザーの現地時間）
- Cloud Schedulerの料金が発生します（月3ジョブまで無料）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
