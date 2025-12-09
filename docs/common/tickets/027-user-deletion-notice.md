# 027 ユーザー削除前通知

## 概要

アカウント削除を予定しているユーザーに対して、削除実行前に通知を送信する機能を実装するチケットです。30日前、7日前、1日前にプッシュ通知を送信し、ユーザーが削除をキャンセルする機会を提供します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 022: プッシュ通知トリガー
- 021: 削除予定管理

## 要件

### 機能要件

- FR-037: ユーザー削除前通知

### 非機能要件

- NFR-010: GDPR準拠（削除権の実装）
- NFR-014: 通知の信頼性

## 受け入れ条件（Todo）

- [ ] 削除予定ユーザーを毎日チェックするScheduled Functionを実装
- [ ] 削除予定日の30日前に通知を送信
- [ ] 削除予定日の7日前に通知を送信
- [ ] 削除予定日の1日前に通知を送信
- [ ] 通知メッセージに削除日とキャンセル方法を含める
- [ ] 通知がOFFの場合は送信しない
- [ ] 通知履歴をFirestoreに保存
- [ ] エラーハンドリングとリトライ機構
- [ ] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-037
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - GDPR対応API
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション

## 技術詳細

### 通知タイミング

| 通知タイミング | 削除までの残日数 | 通知内容 |
|--------------|----------------|---------|
| 30日前 | 30日 | 削除予定日とキャンセル方法 |
| 7日前 | 7日 | 削除予定日とキャンセル方法（緊急） |
| 1日前 | 1日 | 最終確認とキャンセル方法（最終） |

### 実装例: 削除予定通知のScheduled Function

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';

export const gdpr_sendDeletionNotices = onSchedule({
  schedule: 'every day 04:00',  // 毎日午前4時UTC（日本時間13時）
  timeZone: 'UTC',
  region: 'asia-northeast1'
}, async (event) => {
  logger.info('削除予定通知チェック開始');

  const now = new Date();

  // 削除予定ユーザーを取得
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('deletionScheduled', '==', true)
    .get();

  if (usersSnapshot.empty) {
    logger.info('削除予定ユーザーがいません');
    return;
  }

  logger.info('削除予定ユーザー数', { count: usersSnapshot.size });

  const notificationPromises = [];

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const userId = doc.id;

    // 通知設定を確認
    if (!userData.notificationSettings?.enabled || !userData.notificationSettings?.deletionNotice) {
      logger.info('削除通知が無効になっています', { userId });
      continue;
    }

    // 削除予定日を取得
    const scheduledDate = userData.scheduledDeletionDate?.toDate();
    if (!scheduledDate) {
      logger.warn('削除予定日が設定されていません', { userId });
      continue;
    }

    // 残日数を計算
    const daysUntilDeletion = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    logger.info('削除予定ユーザーチェック', { userId, daysUntilDeletion, scheduledDate: scheduledDate.toISOString() });

    // 30日前、7日前、1日前に通知
    if (daysUntilDeletion === 30) {
      notificationPromises.push(
        sendDeletionNotice(userId, 30, scheduledDate)
      );
    } else if (daysUntilDeletion === 7) {
      notificationPromises.push(
        sendDeletionNotice(userId, 7, scheduledDate)
      );
    } else if (daysUntilDeletion === 1) {
      notificationPromises.push(
        sendDeletionNotice(userId, 1, scheduledDate)
      );
    }
  }

  const results = await Promise.allSettled(notificationPromises);

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failureCount = results.filter(r => r.status === 'rejected').length;

  logger.info('削除予定通知送信完了', { total: notificationPromises.length, success: successCount, failure: failureCount });
});

async function sendDeletionNotice(userId: string, daysUntilDeletion: number, scheduledDate: Date): Promise<void> {
  const formattedDate = scheduledDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let title = '';
  let body = '';

  if (daysUntilDeletion === 30) {
    title = 'アカウント削除のお知らせ';
    body = `アカウントは${formattedDate}に削除されます。キャンセルする場合は設定から変更してください。`;
  } else if (daysUntilDeletion === 7) {
    title = 'アカウント削除のお知らせ（7日前）';
    body = `アカウントは${formattedDate}（7日後）に削除されます。キャンセルする場合は設定から変更してください。`;
  } else if (daysUntilDeletion === 1) {
    title = 'アカウント削除のお知らせ（最終確認）';
    body = `アカウントは${formattedDate}（明日）に削除されます。キャンセルする場合は今すぐ設定から変更してください。`;
  }

  await sendNotification({
    userId,
    type: 'deletion_notice',
    title,
    body
  });

  logger.info('削除予定通知送信', { userId, daysUntilDeletion, scheduledDate: formattedDate });
}
```

### 通知メッセージのテンプレート

```typescript
const DELETION_NOTICE_TEMPLATES = {
  30: {
    title: 'アカウント削除のお知らせ',
    body: (date: string) => `アカウントは${date}に削除されます。キャンセルする場合は設定から変更してください。`
  },
  7: {
    title: 'アカウント削除のお知らせ（7日前）',
    body: (date: string) => `アカウントは${date}（7日後）に削除されます。キャンセルする場合は設定から変更してください。`
  },
  1: {
    title: 'アカウント削除のお知らせ（最終確認）',
    body: (date: string) => `アカウントは${date}（明日）に削除されます。キャンセルする場合は今すぐ設定から変更してください。`
  }
};
```

### 通知の重複送信防止

```typescript
interface DeletionNoticeLog {
  userId: string;
  daysBeforeDeletion: number;
  sentAt: Timestamp;
  scheduledDeletionDate: Timestamp;
}

async function hasSentNotice(userId: string, daysBeforeDeletion: number): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const logSnapshot = await admin.firestore()
    .collection('deletionNoticesLog')
    .where('userId', '==', userId)
    .where('daysBeforeDeletion', '==', daysBeforeDeletion)
    .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
    .limit(1)
    .get();

  return !logSnapshot.empty;
}

async function logNotice(userId: string, daysBeforeDeletion: number, scheduledDate: Date): Promise<void> {
  await admin.firestore().collection('deletionNoticesLog').add({
    userId,
    daysBeforeDeletion,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDate)
  });
}
```

## テスト観点

- 削除予定日の30日前、7日前、1日前に通知が送信されること
- 通知設定がOFFの場合、通知が送信されないこと
- 削除予定日が設定されていないユーザーには通知が送信されないこと
- 通知が重複して送信されないこと
- エラーが発生してもリトライされること
- 通知履歴が正しく保存されること

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

- この機能はGDPR第17条（削除権）の実装に必要です
- 通知のスケジューリングには、チケット022（プッシュ通知トリガー）が必要です
- 削除予定の設定は、チケット021（削除予定管理）で実装します
- 実際のアカウント削除は、チケット019（データ削除スケジューラ）で実装します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
