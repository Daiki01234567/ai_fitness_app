# 042 音声設定機能

## 概要

トレーニング中の音声ガイダンスに関する設定機能を実装します。音声のON/OFF、音量調整、読み上げ速度の設定ができるようにし、ユーザーが自分好みの音声フィードバックを受けられるようにします。

## Phase

Phase 2（機能実装）

## 依存チケット

- 007: スプラッシュ画面実装
- 033: サイドレイズ評価ロジック実装（音声フィードバック機能）

## 要件

### 音声設定項目

#### 1. 音声ガイダンス ON/OFF

- トグルスイッチでON/OFFを切り替え
- OFFにすると全ての音声ガイダンスがミュート
- デフォルト: ON

#### 2. 音量調整

- スライダーで音量を0%〜100%の範囲で調整
- リアルタイムで音量プレビュー
- デフォルト: 80%

#### 3. 読み上げ速度

- 3段階から選択: 遅い / 普通 / 速い
- セグメントコントロールで切り替え
- デフォルト: 普通

### 音声ガイダンスの種類

トレーニング中に以下の音声ガイダンスが再生されます：

| 種類 | 例 | タイミング |
|-----|-----|----------|
| カウント | 「1」「2」「3」... | レップ完了時 |
| フォーム指示 | 「膝をもう少し曲げましょう」 | フォーム問題検出時 |
| 応援 | 「いいですね！」「その調子！」 | 良いフォーム時 |
| 完了 | 「お疲れ様でした」 | セッション終了時 |

### 読み上げ速度の詳細

| 設定 | 速度係数 | 説明 |
|-----|---------|------|
| 遅い | 0.8 | ゆっくりと聞き取りやすく |
| 普通 | 1.0 | 標準的な速度 |
| 速い | 1.2 | テンポよく短く |

## 受け入れ条件

- [ ] 音声ON/OFFの切り替えが正常に動作する
- [ ] 音量スライダーが0-100%の範囲で動作する
- [ ] 読み上げ速度の切り替えが動作する
- [ ] 設定変更がリアルタイムで反映される
- [ ] 音量調整時にプレビュー音声が再生される
- [ ] 設定がアプリ再起動後も保持される
- [ ] トレーニング中に設定が正しく適用される
- [ ] デバイスの音量設定と連動する

## 参照ドキュメント

- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - 設定画面
- `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` - トレーニング実行画面

## 技術詳細

### ファイル構成

```
src/
├── components/
│   └── settings/
│       ├── AudioSettings.tsx       # 音声設定UI
│       ├── VolumeSlider.tsx        # 音量スライダー
│       └── SpeedSelector.tsx       # 速度選択
├── services/
│   └── audio/
│       ├── speechService.ts        # 音声合成サービス
│       ├── audioPreview.ts         # プレビュー機能
│       └── audioMessages.ts        # 音声メッセージ定義
├── stores/
│   └── audioStore.ts               # 音声設定状態
└── hooks/
    └── useSpeech.ts                # 音声再生フック
```

### 使用ライブラリ

```bash
npx expo install expo-speech
```

### 音声合成サービス

```typescript
import * as Speech from 'expo-speech';

interface SpeechOptions {
  volume: number;    // 0-1
  rate: number;      // 0.8, 1.0, 1.2
}

class SpeechService {
  private options: SpeechOptions = {
    volume: 0.8,
    rate: 1.0,
  };

  private enabled: boolean = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      Speech.stop();
    }
  }

  setVolume(volume: number): void {
    this.options.volume = volume / 100;  // 0-100 to 0-1
  }

  setRate(rate: 'slow' | 'normal' | 'fast'): void {
    const rateMap = { slow: 0.8, normal: 1.0, fast: 1.2 };
    this.options.rate = rateMap[rate];
  }

  speak(text: string): void {
    if (!this.enabled) return;

    Speech.speak(text, {
      language: 'ja-JP',
      volume: this.options.volume,
      rate: this.options.rate,
      onDone: () => {
        // 再生完了時の処理
      },
      onError: (error) => {
        console.error('Speech error:', error);
      },
    });
  }

  stop(): void {
    Speech.stop();
  }

  // プレビュー用
  preview(): void {
    this.speak('これはテスト音声です');
  }
}

export const speechService = new SpeechService();
```

### 音声メッセージ定義

```typescript
// services/audio/audioMessages.ts

export const COUNT_MESSAGES: Record<number, string> = {
  1: 'いち',
  2: 'に',
  3: 'さん',
  4: 'よん',
  5: 'ご',
  // ...
  10: 'じゅう',
};

export const FORM_MESSAGES = {
  squat: {
    kneeTooForward: '膝がつま先より前に出ています',
    backNotStraight: '背中をもう少しまっすぐにしましょう',
    notDeepEnough: 'もう少し深くしゃがみましょう',
  },
  pushup: {
    bodyNotStraight: '体をまっすぐに保ちましょう',
    elbowsWide: '肘を少し締めましょう',
  },
  // ... 他の種目
};

export const ENCOURAGEMENT_MESSAGES = [
  'いいですね！',
  'その調子！',
  '完璧なフォームです',
  '素晴らしい！',
];

export const COMPLETION_MESSAGE = 'お疲れ様でした';
```

### 音声設定UIコンポーネント

```typescript
// components/settings/AudioSettings.tsx

const AudioSettings: React.FC = () => {
  const {
    audioEnabled,
    audioVolume,
    speechRate,
    setAudioEnabled,
    setAudioVolume,
    setSpeechRate,
  } = useSettingsStore();

  const handleVolumeChange = (value: number) => {
    setAudioVolume(value);
    speechService.setVolume(value);
  };

  const handlePreview = () => {
    speechService.preview();
  };

  return (
    <View style={styles.container}>
      {/* 音声ガイダンス ON/OFF */}
      <SettingsToggle
        label="音声ガイダンス"
        description="トレーニング中の音声案内"
        value={audioEnabled}
        onValueChange={(value) => {
          setAudioEnabled(value);
          speechService.setEnabled(value);
        }}
      />

      {audioEnabled && (
        <>
          {/* 音量スライダー */}
          <VolumeSlider
            value={audioVolume}
            onValueChange={handleVolumeChange}
            onSlidingComplete={handlePreview}
          />

          {/* 読み上げ速度 */}
          <SpeedSelector
            value={speechRate}
            onValueChange={(rate) => {
              setSpeechRate(rate);
              speechService.setRate(rate);
            }}
          />

          {/* プレビューボタン */}
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreview}
          >
            <Text style={styles.previewText}>音声をテスト</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};
```

### 音量スライダーコンポーネント

```typescript
// components/settings/VolumeSlider.tsx
import Slider from '@react-native-community/slider';

interface VolumeSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: () => void;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  value,
  onValueChange,
  onSlidingComplete,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>音量</Text>
        <Text style={styles.value}>{value}%</Text>
      </View>
      <View style={styles.sliderRow}>
        <Ionicons name="volume-low" size={20} color="#6B7280" />
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={value}
          onValueChange={onValueChange}
          onSlidingComplete={onSlidingComplete}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#D1D5DB"
          thumbTintColor="#3B82F6"
        />
        <Ionicons name="volume-high" size={20} color="#6B7280" />
      </View>
    </View>
  );
};
```

## 注意事項

- デバイスがサイレントモードの場合の動作を確認
- バックグラウンドでは音声再生が停止する
- 他の音声（音楽など）との干渉に注意
- 日本語音声合成の品質はデバイスに依存
- iOS/Androidで音声の品質が異なる可能性あり

## 見積もり

- 実装: 2日
- テスト: 1日
- レビュー・修正: 1日
- **合計: 4日**

## 進捗

- [ ] expo-speechのセットアップ
- [ ] SpeechServiceの実装
- [ ] AudioSettingsコンポーネントの実装
- [ ] VolumeSliderの実装
- [ ] SpeedSelectorの実装
- [ ] 音声メッセージ定義の作成
- [ ] プレビュー機能の実装
- [ ] 設定状態管理（Zustand）の実装
- [ ] トレーニング画面との連携
- [ ] iOS実機テスト
- [ ] Android実機テスト
- [ ] コードレビュー
