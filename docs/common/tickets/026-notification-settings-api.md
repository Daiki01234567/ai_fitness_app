# 026 通知設定API

## 概要

ユーザーの通知設定（ON/OFF、時刻、頻度など）を保存・取得するAPIを実装するチケットです。通知設定はFirestoreのUsersコレクションに保存され、プッシュ通知のスケジューラで参照されます。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestore セキュリティルール実装
- 004: ユーザープロフィール API

## 要件

### 機能要件

- FR-021: 通知設定

### 非機能要件

- NFR-002: データ整合性の保証
- NFR-014: 通知の信頼性

## 受け入れ条件（Todo）

- [x] 通知設定保存APIを実装（`notification_updateSettings`）
- [x] 通知設定取得APIを実装（`notification_getSettings`）
- [x] 通知の全体ON/OFF機能
- [x] トレーニングリマインダーの時刻設定（HH:MM形式）
- [x] トレーニングリマインダーの曜日設定（複数選択可）
- [x] 削除通知のON/OFF機能
- [x] 課金通知のON/OFF機能
- [x] タイムゾーンの自動検出と保存
- [x] レート制限の実装（10回/時）
- [x] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認（オプション）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - ユーザー管理API
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション

## 技術詳細

### データモデル

Usersコレクション（通知設定）:

```typescript
interface User {
  userId: string;
  notificationSettings: {
    enabled: boolean;  // 通知の全体ON/OFF
    trainingReminder: boolean;  // トレーニングリマインダーのON/OFF
    reminderTime: string;  // リマインダー時刻（"HH:MM"形式、例: "19:00"）
    reminderDays: string[];  // リマインダー曜日（例: ["monday", "wednesday", "friday"]）
    timezone: string;  // タイムゾーン（例: "Asia/Tokyo"）
    deletionNotice: boolean;  // 削除通知のON/OFF
    billingNotice: boolean;  // 課金通知のON/OFF
  };
  fcmToken: string | null;  // FCMトークン（チケット022で実装）
  // 他のフィールド...
}
```

### 通知設定の初期値

```typescript
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  trainingReminder: true,
  reminderTime: '19:00',
  reminderDays: ['monday', 'wednesday', 'friday'],
  timezone: 'Asia/Tokyo',
  deletionNotice: true,
  billingNotice: true
};
```

### 実装例: 通知設定保存API

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

interface UpdateNotificationSettingsRequest {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: string[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
}

export const notification_updateSettings = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const settings = request.data as UpdateNotificationSettingsRequest;

  // バリデーション
  if (settings.reminderTime) {
    const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(settings.reminderTime)) {
      throw new HttpsError('invalid-argument', '時刻の形式が無効です（HH:MM形式で指定してください）');
    }
  }

  if (settings.reminderDays) {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const invalidDays = settings.reminderDays.filter(day => !validDays.includes(day));

    if (invalidDays.length > 0) {
      throw new HttpsError('invalid-argument', `無効な曜日が含まれています: ${invalidDays.join(', ')}`);
    }

    if (settings.reminderDays.length === 0) {
      throw new HttpsError('invalid-argument', '少なくとも1つの曜日を選択してください');
    }
  }

  // 削除予定ユーザーチェック
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (userDoc.data()?.deletionScheduled === true) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、設定を変更できません。'
    );
  }

  // 設定を更新
  const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (settings.enabled !== undefined) {
    updateData['notificationSettings.enabled'] = settings.enabled;
  }
  if (settings.trainingReminder !== undefined) {
    updateData['notificationSettings.trainingReminder'] = settings.trainingReminder;
  }
  if (settings.reminderTime !== undefined) {
    updateData['notificationSettings.reminderTime'] = settings.reminderTime;
  }
  if (settings.reminderDays !== undefined) {
    updateData['notificationSettings.reminderDays'] = settings.reminderDays;
  }
  if (settings.timezone !== undefined) {
    updateData['notificationSettings.timezone'] = settings.timezone;
  }
  if (settings.deletionNotice !== undefined) {
    updateData['notificationSettings.deletionNotice'] = settings.deletionNotice;
  }
  if (settings.billingNotice !== undefined) {
    updateData['notificationSettings.billingNotice'] = settings.billingNotice;
  }

  await admin.firestore().collection('users').doc(uid).update(updateData);

  logger.info('通知設定更新完了', { userId: uid, updatedFields: Object.keys(updateData) });

  return {
    success: true,
    message: '通知設定を更新しました'
  };
});
```

### 実装例: 通知設定取得API

```typescript
export const notification_getSettings = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  const userDoc = await admin.firestore().collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data();
  const settings = userData?.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

  return {
    success: true,
    data: settings
  };
});
```

### 曜日の多言語対応

```typescript
const DAY_NAMES = {
  en: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  },
  ja: {
    monday: '月曜日',
    tuesday: '火曜日',
    wednesday: '水曜日',
    thursday: '木曜日',
    friday: '金曜日',
    saturday: '土曜日',
    sunday: '日曜日'
  }
};
```

## テスト観点

- 認証されていないユーザーは設定を更新できないこと
- 時刻の形式が無効な場合、エラーが返ること
- 曜日の指定が無効な場合、エラーが返ること
- 曜日が1つも選択されていない場合、エラーが返ること
- 削除予定ユーザーは設定を更新できないこと
- 設定が正しくFirestoreに保存されること
- 設定が正しく取得できること
- デフォルト設定が正しく返されること

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装ファイル

- `functions/src/api/notification/settings.ts` - 通知設定API
- `functions/src/types/notification.ts` - 通知設定の型定義

## 備考

- この機能はチケット023（プッシュ通知スケジューラ）で使用されます
- タイムゾーンの自動検出はクライアント側で実装します
- 通知の送信はチケット022（プッシュ通知トリガー）で実装します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
