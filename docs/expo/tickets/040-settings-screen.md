# 040 設定画面実装

## 概要

アプリの各種設定を管理する設定画面を実装します。音声設定、通知設定、プライバシー設定、アカウント設定など、ユーザーがアプリの動作をカスタマイズできる機能を提供します。

## Phase

Phase 2（機能実装）

## 依存チケット

- 007: スプラッシュ画面実装
- 015: Cloud Functions基盤構築
- 041: 通知設定機能
- 042: 音声設定機能

## 要件

### 画面構成

設定画面は以下のセクションで構成されます：

#### 1. 音声設定セクション
- 音声ガイダンス ON/OFF
- 音量調整
- 読み上げ速度

#### 2. 通知設定セクション
- リマインダー通知 ON/OFF
- 通知時刻設定
- 通知頻度設定

#### 3. プライバシー設定セクション
- データの利用について（情報表示）
- データエクスポート（ダウンロード）
- 利用規約の確認
- プライバシーポリシーの確認

#### 4. アカウント設定セクション
- プロフィール編集
- パスワード変更
- ログアウト
- アカウント削除

#### 5. アプリ情報セクション
- バージョン情報
- ライセンス情報
- お問い合わせ
- ヘルプセンター

### 設定項目の詳細

| セクション | 項目 | 種類 | 説明 |
|-----------|-----|------|------|
| 音声 | 音声ガイダンス | トグル | ON/OFF切り替え |
| 音声 | 音量 | スライダー | 0-100% |
| 音声 | 読み上げ速度 | セグメント | 遅い/普通/速い |
| 通知 | リマインダー | トグル | ON/OFF切り替え |
| 通知 | 通知時刻 | 時刻選択 | 時刻ピッカー |
| 通知 | 頻度 | 選択 | 毎日/週3回/週1回 |
| プライバシー | データエクスポート | ボタン | タップで実行 |
| アカウント | プロフィール編集 | ナビゲーション | 編集画面へ遷移 |
| アカウント | パスワード変更 | ナビゲーション | 変更画面へ遷移 |
| アカウント | ログアウト | ボタン | 確認ダイアログ表示 |
| アカウント | アカウント削除 | ボタン | 削除フローへ |

## 受け入れ条件

- [ ] 全設定セクションが正しく表示される
- [ ] 各設定の変更が即座に保存される
- [ ] 設定変更時に適切なフィードバックが表示される
- [ ] ログアウト時に確認ダイアログが表示される
- [ ] アカウント削除時に警告と確認が表示される
- [ ] プロフィール編集画面への遷移が動作する
- [ ] パスワード変更画面への遷移が動作する
- [ ] 利用規約・プライバシーポリシーが表示できる
- [ ] ヘルプセンター・お問い合わせへの遷移が動作する
- [ ] 設定がアプリ再起動後も保持される

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 設定画面
- `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` - UI/UX設計

## 技術詳細

### ファイル構成

```
src/
├── app/
│   └── (tabs)/
│       └── settings/
│           ├── index.tsx              # 設定メイン画面
│           ├── audio.tsx              # 音声設定
│           ├── notifications.tsx      # 通知設定
│           ├── privacy.tsx            # プライバシー設定
│           ├── profile.tsx            # プロフィール編集
│           ├── password.tsx           # パスワード変更
│           └── account-deletion.tsx   # アカウント削除
├── components/
│   └── settings/
│       ├── SettingsSection.tsx        # セクションコンテナ
│       ├── SettingsItem.tsx           # 設定項目
│       ├── SettingsToggle.tsx         # トグル設定
│       ├── SettingsSlider.tsx         # スライダー設定
│       ├── SettingsSegment.tsx        # セグメント設定
│       └── SettingsNavigation.tsx     # ナビゲーション項目
├── stores/
│   └── settingsStore.ts               # 設定状態管理
└── hooks/
    └── useSettings.ts                 # 設定操作フック
```

### 設定の永続化（AsyncStorage + Zustand）

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  // 音声設定
  audioEnabled: boolean;
  audioVolume: number;
  speechRate: 'slow' | 'normal' | 'fast';

  // 通知設定
  reminderEnabled: boolean;
  reminderTime: string;  // "HH:mm"
  reminderFrequency: 'daily' | 'threePerWeek' | 'weekly';

  // アクション
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
  setSpeechRate: (rate: 'slow' | 'normal' | 'fast') => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderFrequency: (frequency: 'daily' | 'threePerWeek' | 'weekly') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      audioEnabled: true,
      audioVolume: 80,
      speechRate: 'normal',
      reminderEnabled: false,
      reminderTime: '19:00',
      reminderFrequency: 'daily',

      setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
      setAudioVolume: (volume) => set({ audioVolume: volume }),
      setSpeechRate: (rate) => set({ speechRate: rate }),
      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      setReminderTime: (time) => set({ reminderTime: time }),
      setReminderFrequency: (frequency) => set({ reminderFrequency: frequency }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 設定項目コンポーネント

```typescript
// SettingsToggle.tsx
interface SettingsToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({
  label,
  description,
  value,
  onValueChange,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
        thumbColor={value ? '#3B82F6' : '#F3F4F6'}
      />
    </View>
  );
};
```

### ログアウト確認ダイアログ

```typescript
import { Alert } from 'react-native';

const handleLogout = () => {
  Alert.alert(
    'ログアウト',
    '本当にログアウトしますか？',
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]
  );
};
```

## 注意事項

- 設定変更は即座に適用し、ユーザーに「保存しました」等のフィードバックを表示
- アカウント削除は重要な操作なので、複数回の確認が必要
- 利用規約・プライバシーポリシーはWebView または外部ブラウザで表示
- 設定値はローカル（AsyncStorage）と必要に応じてサーバー（Firestore）に保存
- オフライン時でも設定変更可能（オンライン復帰時に同期）

## 見積もり

- 実装: 4日
- テスト: 2日
- レビュー・修正: 1日
- **合計: 7日**

## 進捗

- [ ] 設定メイン画面のレイアウト作成
- [ ] SettingsSection/SettingsItemコンポーネントの実装
- [ ] 設定状態管理（Zustand + AsyncStorage）の実装
- [ ] 音声設定セクションの実装
- [ ] 通知設定セクションの実装
- [ ] プライバシー設定セクションの実装
- [ ] アカウント設定セクションの実装
- [ ] アプリ情報セクションの実装
- [ ] ログアウト機能の実装
- [ ] プロフィール編集画面への遷移
- [ ] パスワード変更画面への遷移
- [ ] テストの作成
- [ ] コードレビュー
