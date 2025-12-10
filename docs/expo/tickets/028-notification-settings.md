# 028 通知設定機能

## 概要

通知設定の詳細画面を実装します。リマインダー通知の時刻設定、通知頻度（曜日選択）、プッシュ通知の許可リクエスト、設定のFirestore同期、ローカル永続化を行います。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/027: 設定画面実装（通知セクションからの遷移）
- common/026: 通知設定API（バックエンド連携）

## 要件

### 機能要件

- FR-011: 通知設定（リマインダー通知のON/OFF、時刻、頻度設定）
- FR-017: リマインダー通知（プッシュ通知の送信）

### 非機能要件

- NFR-019: レスポンシブデザイン対応
- NFR-021: 操作性（直感的な時刻・曜日選択UI）

## 受け入れ条件（Todo）

- [x] 通知設定画面が表示される
- [x] リマインダー通知の全体ON/OFF切り替えが動作する
- [x] リマインダー時刻の設定が動作する（TimePicker）
- [x] 通知頻度の設定が動作する
  - [x] 毎日（全曜日選択）
  - [x] 週3回（月・水・金）
  - [x] 週1回（日曜日）
  - [x] カスタム（個別曜日選択）
- [x] 曜日の個別選択が動作する（複数選択可）
- [x] プッシュ通知の許可リクエストが動作する
- [x] 通知許可状態の表示が正しい
- [x] 設定変更がFirestoreに保存される
- [x] 設定変更がローカルに永続化される
- [x] オフライン時はローカルに保存し、オンライン復帰時に同期される
- [x] タイムゾーンが自動検出される
- [x] 削除予定ユーザーは編集が無効化される
- [x] ダークモード対応

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-011, FR-017
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-019, NFR-021
- `docs/common/tickets/026-notification-settings-api.md` - 通知設定APIの仕様
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - セクション3.13（設定画面）

## 技術詳細

### 画面構成

```
+-------------------------------+
| [<- 設定]  通知設定             |
|                               |
|  ============================  |
|  プッシュ通知                  |
|  ============================  |
|                               |
|  通知の許可状態: 許可済み       |
|  [通知設定を開く]              |
|                               |
|  ============================  |
|  トレーニングリマインダー       |
|  ============================  |
|                               |
|  リマインダー通知              |
|  [ON  /  OFF]                 |
|                               |
|  通知時刻                      |
|  [ 19:00 ]                    |
|                               |
|  通知頻度                      |
|  ( ) 毎日                      |
|  (*) 週3回（月・水・金）        |
|  ( ) 週1回（日曜日）            |
|  ( ) カスタム                  |
|                               |
|  曜日を選択                    |
|  [月] [火] [水] [木] [金] [土] [日]|
|       *         *         *    |
|                               |
|  ============================  |
|                               |
|   +-------------------------+ |
|   |       設定を保存         | |
|   +-------------------------+ |
|                               |
+-------------------------------+
```

### 使用ライブラリ

- **React Native Paper**: List, Switch, RadioButton, Chip, Button
- **@react-native-community/datetimepicker**: 時刻選択
- **expo-notifications**: プッシュ通知許可
- **@react-native-firebase/firestore**: Firestore連携
- **Zustand**: 通知設定状態管理
- **AsyncStorage**: ローカル永続化

### 主要コンポーネント

#### ファイル配置

```
expo_app/
├── app/
│   └── settings/
│       └── notifications.tsx   # 通知設定画面
├── services/
│   └── notification/
│       └── notificationService.ts  # 通知サービス
└── store/
    └── notificationStore.ts    # 通知設定ストア
```

#### 通知設定ストア

```typescript
// store/notificationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type FrequencyPreset = 'daily' | 'three_times' | 'weekly' | 'custom';

interface NotificationSettingsState {
  // 設定値
  enabled: boolean;
  trainingReminder: boolean;
  reminderTime: string;  // "HH:MM" format
  reminderDays: DayOfWeek[];
  frequencyPreset: FrequencyPreset;
  timezone: string;
  deletionNotice: boolean;
  billingNotice: boolean;

  // 同期状態
  isSynced: boolean;
  lastSyncedAt: string | null;

  // アクション
  setEnabled: (enabled: boolean) => void;
  setTrainingReminder: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderDays: (days: DayOfWeek[]) => void;
  setFrequencyPreset: (preset: FrequencyPreset) => void;
  toggleDay: (day: DayOfWeek) => void;
  setTimezone: (timezone: string) => void;
  markSynced: () => void;
  loadFromServer: (settings: Partial<NotificationSettingsState>) => void;
}

const DEFAULT_DAYS: DayOfWeek[] = ['monday', 'wednesday', 'friday'];

export const useNotificationStore = create<NotificationSettingsState>()(
  persist(
    (set, get) => ({
      enabled: true,
      trainingReminder: true,
      reminderTime: '19:00',
      reminderDays: DEFAULT_DAYS,
      frequencyPreset: 'three_times',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deletionNotice: true,
      billingNotice: true,
      isSynced: false,
      lastSyncedAt: null,

      setEnabled: (enabled) => set({ enabled, isSynced: false }),
      setTrainingReminder: (trainingReminder) => set({ trainingReminder, isSynced: false }),
      setReminderTime: (reminderTime) => set({ reminderTime, isSynced: false }),
      setReminderDays: (reminderDays) => set({ reminderDays, isSynced: false }),
      setFrequencyPreset: (frequencyPreset) => {
        let days: DayOfWeek[];
        switch (frequencyPreset) {
          case 'daily':
            days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            break;
          case 'three_times':
            days = ['monday', 'wednesday', 'friday'];
            break;
          case 'weekly':
            days = ['sunday'];
            break;
          case 'custom':
            days = get().reminderDays;
            break;
          default:
            days = DEFAULT_DAYS;
        }
        set({ frequencyPreset, reminderDays: days, isSynced: false });
      },
      toggleDay: (day) => {
        const current = get().reminderDays;
        const newDays = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        // Ensure at least one day is selected
        if (newDays.length > 0) {
          set({ reminderDays: newDays, frequencyPreset: 'custom', isSynced: false });
        }
      },
      setTimezone: (timezone) => set({ timezone, isSynced: false }),
      markSynced: () => set({ isSynced: true, lastSyncedAt: new Date().toISOString() }),
      loadFromServer: (settings) => set({ ...settings, isSynced: true }),
    }),
    {
      name: 'notification-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

#### 通知サービス

```typescript
// services/notification/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

// 通知許可状態を取得
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return {
    granted: status === 'granted',
    canAskAgain,
  };
}

// 通知許可をリクエスト
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// FCMトークンを取得
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // expo.dev project ID
    });
    return token.data;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

// 設定をサーバーに保存
export async function saveNotificationSettings(settings: {
  enabled?: boolean;
  trainingReminder?: boolean;
  reminderTime?: string;
  reminderDays?: string[];
  timezone?: string;
  deletionNotice?: boolean;
  billingNotice?: boolean;
}): Promise<void> {
  const updateSettings = httpsCallable(functions, 'notification_updateSettings');
  await updateSettings(settings);
}

// 設定をサーバーから取得
export async function getNotificationSettings(): Promise<any> {
  const getSettings = httpsCallable(functions, 'notification_getSettings');
  const result = await getSettings();
  return (result.data as any).data;
}

// システムの通知設定画面を開く
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.openSettingsAsync();
  } else {
    // Android: Use linking to open app settings
    const { Linking } = require('react-native');
    await Linking.openSettings();
  }
}
```

#### 通知設定画面

```typescript
// app/settings/notifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  List,
  Switch,
  RadioButton,
  Chip,
  Button,
  Text,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  saveNotificationSettings,
  getNotificationSettings,
  openNotificationSettings,
  NotificationPermissionStatus,
} from '@/services/notification/notificationService';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: '月曜日', short: '月' },
  { key: 'tuesday', label: '火曜日', short: '火' },
  { key: 'wednesday', label: '水曜日', short: '水' },
  { key: 'thursday', label: '木曜日', short: '木' },
  { key: 'friday', label: '金曜日', short: '金' },
  { key: 'saturday', label: '土曜日', short: '土' },
  { key: 'sunday', label: '日曜日', short: '日' },
];

export default function NotificationSettingsScreen() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { userData } = useAuthStore();
  const {
    enabled,
    trainingReminder,
    reminderTime,
    reminderDays,
    frequencyPreset,
    timezone,
    setEnabled,
    setTrainingReminder,
    setReminderTime,
    setFrequencyPreset,
    toggleDay,
    markSynced,
    loadFromServer,
  } = useNotificationStore();

  const isDeletionScheduled = userData?.deletionScheduled === true;

  // 初期化
  useEffect(() => {
    const initialize = async () => {
      try {
        // 通知許可状態を取得
        const status = await getNotificationPermissionStatus();
        setPermissionStatus(status);

        // サーバーから設定を取得
        const serverSettings = await getNotificationSettings();
        if (serverSettings) {
          loadFromServer(serverSettings);
        }
      } catch (error) {
        console.error('Failed to initialize notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // 通知許可をリクエスト
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionStatus({ granted, canAskAgain: !granted });

    if (!granted) {
      Alert.alert(
        '通知が許可されていません',
        '通知を受け取るには、設定アプリから通知を許可してください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '設定を開く', onPress: openNotificationSettings },
        ]
      );
    }
  }, []);

  // 時刻選択
  const handleTimeChange = useCallback((event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setReminderTime(`${hours}:${minutes}`);
    }
  }, []);

  // 設定を保存
  const handleSave = useCallback(async () => {
    if (isDeletionScheduled) return;

    setIsSaving(true);
    try {
      await saveNotificationSettings({
        enabled,
        trainingReminder,
        reminderTime,
        reminderDays,
        timezone,
      });
      markSynced();
      Alert.alert('保存完了', '通知設定を保存しました');
      router.back();
    } catch (error) {
      Alert.alert('エラー', '設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [enabled, trainingReminder, reminderTime, reminderDays, timezone, isDeletionScheduled]);

  // 時刻文字列からDateオブジェクトを作成
  const getTimeAsDate = useCallback(() => {
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [reminderTime]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* プッシュ通知セクション */}
      <List.Section>
        <List.Subheader>プッシュ通知</List.Subheader>
        <View style={styles.permissionSection}>
          <Text variant="bodyMedium">
            通知の許可状態: {permissionStatus?.granted ? '許可済み' : '未許可'}
          </Text>
          {!permissionStatus?.granted && (
            <Button
              mode="outlined"
              onPress={handleRequestPermission}
              style={styles.permissionButton}
            >
              {permissionStatus?.canAskAgain ? '通知を許可する' : '設定を開く'}
            </Button>
          )}
        </View>
      </List.Section>

      <Divider />

      {/* トレーニングリマインダーセクション */}
      <List.Section>
        <List.Subheader>トレーニングリマインダー</List.Subheader>

        <List.Item
          title="リマインダー通知"
          description="設定した時刻にトレーニングをお知らせ"
          left={(props) => <List.Icon {...props} icon="bell-ring" />}
          right={() => (
            <Switch
              value={trainingReminder}
              onValueChange={setTrainingReminder}
              disabled={isDeletionScheduled || !permissionStatus?.granted}
            />
          )}
        />

        {trainingReminder && (
          <>
            {/* 時刻設定 */}
            <List.Item
              title="通知時刻"
              description={reminderTime}
              left={(props) => <List.Icon {...props} icon="clock" />}
              onPress={() => setShowTimePicker(true)}
              disabled={isDeletionScheduled}
            />

            {showTimePicker && (
              <DateTimePicker
                value={getTimeAsDate()}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={handleTimeChange}
              />
            )}

            {/* 頻度設定 */}
            <List.Subheader style={styles.subSubheader}>通知頻度</List.Subheader>
            <RadioButton.Group
              onValueChange={(value) => setFrequencyPreset(value as any)}
              value={frequencyPreset}
            >
              <RadioButton.Item
                label="毎日"
                value="daily"
                disabled={isDeletionScheduled}
              />
              <RadioButton.Item
                label="週3回（月・水・金）"
                value="three_times"
                disabled={isDeletionScheduled}
              />
              <RadioButton.Item
                label="週1回（日曜日）"
                value="weekly"
                disabled={isDeletionScheduled}
              />
              <RadioButton.Item
                label="カスタム"
                value="custom"
                disabled={isDeletionScheduled}
              />
            </RadioButton.Group>

            {/* 曜日選択 */}
            {frequencyPreset === 'custom' && (
              <View style={styles.daysContainer}>
                <Text variant="bodyMedium" style={styles.daysLabel}>
                  曜日を選択
                </Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Chip
                      key={day.key}
                      selected={reminderDays.includes(day.key)}
                      onPress={() => toggleDay(day.key)}
                      disabled={isDeletionScheduled}
                      style={styles.dayChip}
                      showSelectedCheck={false}
                    >
                      {day.short}
                    </Chip>
                  ))}
                </View>
                {reminderDays.length === 0 && (
                  <Text style={styles.errorText}>
                    少なくとも1つの曜日を選択してください
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </List.Section>

      <Divider />

      {/* タイムゾーン情報 */}
      <List.Section>
        <List.Subheader>タイムゾーン</List.Subheader>
        <List.Item
          title="検出されたタイムゾーン"
          description={timezone}
          left={(props) => <List.Icon {...props} icon="earth" />}
        />
      </List.Section>

      {/* 削除予定の警告表示 */}
      {isDeletionScheduled && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            アカウント削除が予定されているため、設定を変更できません。
          </Text>
        </View>
      )}

      {/* 保存ボタン */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isDeletionScheduled || reminderDays.length === 0}
          style={styles.saveButton}
        >
          設定を保存
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionSection: {
    padding: 16,
  },
  permissionButton: {
    marginTop: 12,
  },
  subSubheader: {
    paddingTop: 8,
  },
  daysContainer: {
    padding: 16,
  },
  daysLabel: {
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    marginBottom: 4,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 8,
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    color: '#E65100',
    fontSize: 14,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    paddingVertical: 8,
  },
});
```

### オフライン対応

```typescript
// オフライン時の設定同期処理
import NetInfo from '@react-native-community/netinfo';

export function useSyncNotificationSettings() {
  const { isSynced, ...settings } = useNotificationStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !isSynced) {
        // オンライン復帰時に同期
        saveNotificationSettings(settings)
          .then(() => useNotificationStore.getState().markSynced())
          .catch(console.error);
      }
    });

    return unsubscribe;
  }, [isSynced]);
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] 通知設定ストアの初期値が正しい
- [ ] 頻度プリセット変更時に曜日が正しく設定される
- [ ] 曜日のトグルが正しく動作する
- [ ] 時刻フォーマットが正しい（HH:MM形式）
- [ ] タイムゾーンが自動検出される

### 統合テスト

- [ ] 通知設定画面が正しく表示される
- [ ] サーバーから設定が正しく読み込まれる
- [ ] 設定変更がサーバーに保存される
- [ ] オフライン時にローカル保存される

### 実機テスト

- [ ] iPhone（iOS）で通知許可リクエストが動作する
- [ ] Android端末で通知許可リクエストが動作する
- [ ] TimePickerが正しく動作する
- [ ] 曜日選択のChipが正しく動作する
- [ ] 実際にプッシュ通知が届く（common/022-023完了後）

## 見積もり

- 工数: 2.5日
- 難易度: 中（プッシュ通知許可、時刻選択UI、Firestore同期）

## 進捗

- [x] 実装完了（2025-12-11）

## 完了日

2025-12-11



## 備考

- expo/027（設定画面）の「通知の詳細設定」リンクから遷移
- 実際のプッシュ通知送信はcommon/022（プッシュ通知トリガー）とcommon/023（プッシュ通知スケジューラ）で実装
- common/026（通知設定API）と連携してFirestoreに設定を保存
- オフライン対応として、設定変更はまずローカルに保存し、オンライン時にサーバーに同期
- タイムゾーンは`Intl.DateTimeFormat().resolvedOptions().timeZone`で自動検出
- 曜日は少なくとも1つ選択が必須（バリデーション）

## 実装済みファイル一覧

- `expo_app/app/settings/notifications.tsx` - 通知設定画面
- `expo_app/services/notification/notificationService.ts` - 通知サービス
- `expo_app/stores/notificationStore.ts` - 通知設定ストア

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-11 | 初版作成 |
| 2025-12-11 | コード実装完了（notificationService, notificationStore, 通知設定画面） |
