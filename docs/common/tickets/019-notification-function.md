# 019 通知送信関数

## 概要

自動でプッシュ通知を送信するスケジュール関数とトリガー関数を実装します。

チケット018で「通知を送る仕組み」を作りました。このチケットでは「いつ、どんな通知を送るか」を決めて、自動で送信される仕組みを作ります。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/018: プッシュ通知基盤

## 要件

### スケジュール通知（トレーニングリマインダー）

1. **毎日指定時刻に送信**: ユーザーが設定した時刻に通知
2. **デフォルト時刻**: 設定がない場合は19:00に送信
3. **送信条件**: 通知設定がONのユーザーのみ

### トリガー通知（成果達成時）

1. **成果達成通知**: 目標を達成したときに通知
   - 「今週の目標を達成しました！」
   - 「10回連続でトレーニングを記録しました！」

2. **送信タイミング**: セッション完了時に自動判定

### 通知履歴記録

1. **送信履歴保存**: いつ、誰に、何を送ったか記録
2. **開封率追跡**: 通知を開いたかどうかを記録（将来対応）

## 受け入れ条件

- [ ] 毎日指定時刻にリマインダー通知が送られる
- [ ] 通知設定がOFFのユーザーには送られない
- [ ] 成果達成時に自動で通知が送られる
- [ ] 送信履歴がFirestoreに記録される
- [ ] 通知内容が正しい（タイトル、本文）

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 通知関連

## 技術詳細

### スケジュール関数の実装

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

/**
 * トレーニングリマインダーを送信するスケジュール関数
 *
 * 毎時0分に実行され、その時刻にリマインダーを設定しているユーザーに通知を送ります。
 */
export const notification_sendWorkoutReminders = onSchedule(
  {
    schedule: '0 * * * *',  // 毎時0分に実行
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
  },
  async (event) => {
    const now = new Date();
    const currentHour = now.getHours();  // 0-23

    const firestore = admin.firestore();

    // この時刻にリマインダーを設定しているユーザーを取得
    const usersSnapshot = await firestore
      .collection('users')
      .where('notificationSettings.reminderEnabled', '==', true)
      .where('notificationSettings.reminderHour', '==', currentHour)
      .get();

    console.log(`Sending reminders to ${usersSnapshot.size} users at ${currentHour}:00`);

    // 各ユーザーに通知を送信
    for (const userDoc of usersSnapshot.docs) {
      try {
        await sendReminderToUser(userDoc.id, userDoc.data());
      } catch (error) {
        console.error(`Failed to send reminder to ${userDoc.id}:`, error);
      }
    }
  }
);

/**
 * ユーザーにリマインダー通知を送信
 */
async function sendReminderToUser(userId: string, userData: any) {
  const firestore = admin.firestore();

  // FCMトークンを取得
  const tokensSnapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .get();

  if (tokensSnapshot.empty) {
    return;  // トークンがなければスキップ
  }

  const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

  // 通知メッセージを作成
  const messages = getReminderMessages();
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  // 通知を送信
  const message = {
    notification: {
      title: randomMessage.title,
      body: randomMessage.body,
    },
    data: {
      type: 'workout_reminder',
      screen: 'training_menu',  // 通知タップ時に開く画面
    },
    tokens: tokens,
  };

  await admin.messaging().sendEachForMulticast(message);

  // 送信履歴を記録
  await firestore.collection('notificationHistory').add({
    userId: userId,
    type: 'workout_reminder',
    title: randomMessage.title,
    body: randomMessage.body,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
  });
}

/**
 * リマインダーメッセージのバリエーション
 */
function getReminderMessages() {
  return [
    {
      title: '今日のトレーニングはいかがですか？',
      body: '少しの運動でも体に良い影響があります。',
    },
    {
      title: 'トレーニングの時間です！',
      body: '今日も一緒にがんばりましょう。',
    },
    {
      title: '運動の習慣を続けましょう',
      body: '継続は力なり。今日もトレーニングしませんか？',
    },
    {
      title: '体を動かしませんか？',
      body: 'フォームチェックで効果的なトレーニングを。',
    },
  ];
}
```

### 成果達成トリガーの実装

```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

/**
 * セッション完了時に成果をチェックして通知を送信
 */
export const notification_checkAchievements = onDocumentWritten(
  'users/{userId}/sessions/{sessionId}',
  async (event) => {
    const sessionData = event.data?.after.data();
    const previousData = event.data?.before.data();

    // 完了したセッションのみ処理
    if (sessionData?.status !== 'completed') {
      return;
    }

    // 既に完了していた場合はスキップ
    if (previousData?.status === 'completed') {
      return;
    }

    const userId = event.params.userId;

    // 成果をチェック
    const achievements = await checkAchievements(userId);

    // 新しい成果があれば通知
    for (const achievement of achievements) {
      if (achievement.isNew) {
        await sendAchievementNotification(userId, achievement);
      }
    }
  }
);

/**
 * 成果をチェックする
 */
async function checkAchievements(userId: string) {
  const firestore = admin.firestore();
  const achievements: Achievement[] = [];

  // 今週のセッション数をカウント
  const weekStart = getWeekStart();
  const sessionsSnapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .where('status', '==', 'completed')
    .where('createdAt', '>=', weekStart)
    .get();

  const weeklyCount = sessionsSnapshot.size;

  // 週間目標達成チェック
  const userDoc = await firestore.collection('users').doc(userId).get();
  const weeklyGoal = userDoc.data()?.weeklyGoal || 3;  // デフォルト3回

  if (weeklyCount === weeklyGoal) {
    achievements.push({
      type: 'weekly_goal',
      title: '今週の目標達成！',
      body: `今週${weeklyCount}回のトレーニングを完了しました！`,
      isNew: true,
    });
  }

  // 連続記録チェック
  const streak = await calculateStreak(userId);
  const streakMilestones = [3, 7, 14, 30, 100];

  if (streakMilestones.includes(streak)) {
    achievements.push({
      type: 'streak',
      title: `${streak}日連続達成！`,
      body: `${streak}日連続でトレーニングを記録しました。素晴らしい継続力です！`,
      isNew: true,
    });
  }

  // 総セッション数チェック
  const totalSessions = await getTotalSessionCount(userId);
  const totalMilestones = [10, 50, 100, 500, 1000];

  if (totalMilestones.includes(totalSessions)) {
    achievements.push({
      type: 'total_sessions',
      title: `${totalSessions}回達成！`,
      body: `累計${totalSessions}回のトレーニングを完了しました！`,
      isNew: true,
    });
  }

  return achievements;
}

interface Achievement {
  type: string;
  title: string;
  body: string;
  isNew: boolean;
}

/**
 * 成果達成通知を送信
 */
async function sendAchievementNotification(userId: string, achievement: Achievement) {
  const firestore = admin.firestore();

  // ユーザーの通知設定をチェック
  const userDoc = await firestore.collection('users').doc(userId).get();
  if (!userDoc.data()?.notificationSettings?.achievementEnabled) {
    return;  // 成果通知がOFFならスキップ
  }

  // FCMトークンを取得
  const tokensSnapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .get();

  if (tokensSnapshot.empty) {
    return;
  }

  const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

  // 通知を送信
  const message = {
    notification: {
      title: achievement.title,
      body: achievement.body,
    },
    data: {
      type: 'achievement',
      achievementType: achievement.type,
      screen: 'achievements',
    },
    tokens: tokens,
  };

  await admin.messaging().sendEachForMulticast(message);

  // 成果を記録
  await firestore
    .collection('users')
    .doc(userId)
    .collection('achievements')
    .add({
      type: achievement.type,
      title: achievement.title,
      achievedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 通知履歴を記録
  await firestore.collection('notificationHistory').add({
    userId: userId,
    type: 'achievement',
    title: achievement.title,
    body: achievement.body,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
  });
}

/**
 * 連続記録日数を計算
 */
async function calculateStreak(userId: string): Promise<number> {
  const firestore = admin.firestore();
  let streak = 0;
  let currentDate = new Date();

  while (true) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const sessionsSnapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .where('status', '==', 'completed')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(dayStart))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
      .limit(1)
      .get();

    if (sessionsSnapshot.empty) {
      break;  // この日にセッションがなければ終了
    }

    streak++;
    currentDate.setDate(currentDate.getDate() - 1);

    // 無限ループ防止（最大1000日）
    if (streak >= 1000) break;
  }

  return streak;
}
```

### 通知設定のデータ構造

```typescript
interface NotificationSettings {
  // リマインダー設定
  reminderEnabled: boolean;      // リマインダー通知ON/OFF
  reminderHour: number;          // 通知時刻（0-23）

  // 成果通知設定
  achievementEnabled: boolean;   // 成果通知ON/OFF

  // その他
  updatesEnabled: boolean;       // アプリ更新通知ON/OFF
}
```

### Firestoreコレクション構造

```
users/{userId}/
├── notificationSettings: NotificationSettings
│
└── achievements/
    └── {achievementId}/
        ├── type: string          // weekly_goal, streak, total_sessions
        ├── title: string
        └── achievedAt: Timestamp

notificationHistory/
└── {historyId}/
    ├── userId: string
    ├── type: string              // workout_reminder, achievement
    ├── title: string
    ├── body: string
    ├── sentAt: Timestamp
    └── status: string            // sent, opened, failed
```

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-031 | プッシュ通知 |
| NFR-001 | 可用性99.9% |

## 見積もり

3日

## 進捗

- [ ] 未着手
