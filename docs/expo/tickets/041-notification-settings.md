# 041 通知設定機能

## 概要

トレーニングリマインダーの通知設定機能を実装します。ユーザーが通知のON/OFF、通知時刻、通知頻度を設定できるようにし、設定に基づいてリマインダー通知をスケジュールします。

## Phase

Phase 2（機能実装）

## 依存チケット

- 007: スプラッシュ画面実装

## 要件

### 通知設定項目

#### 1. リマインダー通知 ON/OFF

- トグルスイッチでON/OFFを切り替え
- OFFにすると全てのリマインダー通知がキャンセルされる
- ONにすると設定に基づいて通知がスケジュールされる

#### 2. 通知時刻設定

- 時刻ピッカーで通知時刻を選択
- デフォルト: 19:00
- 5分刻みで選択可能
- 設定した時刻に毎日（または頻度に応じて）通知

#### 3. 通知頻度設定

| 頻度 | 説明 |
|-----|------|
| 毎日 | 毎日設定した時刻に通知 |
| 週3回 | 月・水・金に通知 |
| 週1回 | 月曜日のみ通知 |

### 通知の内容

**通知タイトル**: 「トレーニングの時間です」

**通知本文の例**:
- 「今日も一緒に運動しましょう！」
- 「5分だけでもトレーニングしませんか？」
- 「運動で気分をリフレッシュしましょう」

### 動作仕様

1. **通知有効化時**
   - 通知権限をリクエスト
   - 許可された場合、設定に基づいて通知をスケジュール
   - 拒否された場合、設定画面への誘導メッセージを表示

2. **設定変更時**
   - 既存のスケジュール済み通知をキャンセル
   - 新しい設定で通知を再スケジュール

3. **通知タップ時**
   - アプリを開く
   - トレーニング選択画面に遷移

## 受け入れ条件

- [ ] 通知ON/OFFの切り替えが正常に動作する
- [ ] 通知時刻の選択が動作する
- [ ] 通知頻度の選択が動作する
- [ ] 設定した時刻に通知が届く
- [ ] 設定した頻度で通知が届く
- [ ] 通知をタップするとアプリが開く
- [ ] 設定がアプリ再起動後も保持される
- [ ] 通知権限が拒否されている場合、適切なメッセージが表示される
- [ ] 通知OFFで既存の通知がキャンセルされる

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 設定画面
- `docs/expo/specs/02_要件定義書_Expo版_v1_Part2.md` - 非機能要件（通知）

## 技術詳細

### ファイル構成

```
src/
├── components/
│   └── settings/
│       ├── NotificationSettings.tsx   # 通知設定UI
│       ├── TimePicker.tsx             # 時刻選択
│       └── FrequencySelector.tsx      # 頻度選択
├── services/
│   └── notification/
│       ├── notificationService.ts     # 通知サービス
│       ├── notificationScheduler.ts   # スケジュール管理
│       └── notificationPermission.ts  # 権限管理
├── stores/
│   └── notificationStore.ts           # 通知設定状態
└── constants/
    └── notificationMessages.ts        # 通知メッセージ定義
```

### 使用ライブラリ

```bash
npx expo install expo-notifications
```

### 通知サービス実装

```typescript
import * as Notifications from 'expo-notifications';

// 通知のデフォルト設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 通知権限のリクエスト
export const requestNotificationPermission = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// 通知のスケジュール
export const scheduleReminderNotification = async (
  time: string,  // "HH:mm"
  frequency: 'daily' | 'threePerWeek' | 'weekly'
): Promise<void> => {
  // 既存の通知をキャンセル
  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hours, minutes] = time.split(':').map(Number);

  if (frequency === 'daily') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'トレーニングの時間です',
        body: getRandomMessage(),
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
  } else if (frequency === 'threePerWeek') {
    // 月・水・金
    for (const weekday of [2, 4, 6]) {  // 1=日, 2=月, ...
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'トレーニングの時間です',
          body: getRandomMessage(),
        },
        trigger: {
          weekday,
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });
    }
  } else if (frequency === 'weekly') {
    // 月曜日のみ
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'トレーニングの時間です',
        body: getRandomMessage(),
      },
      trigger: {
        weekday: 2,  // 月曜日
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
  }
};

// 全通知のキャンセル
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
```

### 通知メッセージ

```typescript
// constants/notificationMessages.ts
export const REMINDER_MESSAGES = [
  '今日も一緒に運動しましょう！',
  '5分だけでもトレーニングしませんか？',
  '運動で気分をリフレッシュしましょう',
  '体を動かして元気に過ごしましょう',
  '今日のトレーニング、始めませんか？',
];

export const getRandomMessage = (): string => {
  const index = Math.floor(Math.random() * REMINDER_MESSAGES.length);
  return REMINDER_MESSAGES[index];
};
```

### 時刻ピッカーコンポーネント

```typescript
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimePickerProps {
  value: string;  // "HH:mm"
  onChange: (time: string) => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [show, setShow] = useState(false);

  const timeDate = useMemo(() => {
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [value]);

  const handleChange = (_: any, selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      onChange(`${hours}:${minutes}`);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShow(true)}>
        <Text style={styles.timeText}>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          is24Hour
          display="spinner"
          minuteInterval={5}
          onChange={handleChange}
        />
      )}
    </>
  );
};
```

## 注意事項

- iOS/Androidで通知の動作が若干異なるため、両プラットフォームでテスト
- バックグラウンド時も通知が届くことを確認
- アプリがキルされた状態でも通知が届くことを確認
- デバイスの「おやすみモード」等の影響に注意
- 通知権限が後から取り消された場合の処理を考慮

## 見積もり

- 実装: 3日
- テスト: 2日
- レビュー・修正: 1日
- **合計: 6日**

## 進捗

- [ ] expo-notificationsのセットアップ
- [ ] 通知権限リクエストの実装
- [ ] 通知スケジュール機能の実装
- [ ] NotificationSettings UIの実装
- [ ] TimePickerの実装
- [ ] FrequencySelectorの実装
- [ ] 通知状態管理（Zustand）の実装
- [ ] 設定変更時の再スケジュール処理
- [ ] 通知タップ時のナビゲーション
- [ ] 通知メッセージのランダム化
- [ ] iOS実機テスト
- [ ] Android実機テスト
- [ ] コードレビュー
