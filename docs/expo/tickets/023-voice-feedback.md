# 023 音声フィードバック機能

## 概要

トレーニング中に音声でリアルタイムのフォーム参考情報を伝える機能を実装します。ユーザーが画面を見なくてもトレーニングに集中できるよう、日本語音声でガイダンスを提供します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/021: トレーニング実行画面

## 要件

### 機能要件

- FR-005: 音声フィードバック機能

### 非機能要件

- NFR-021: 音量・速度調整機能
- NFR-037: 薬機法準拠（「参考:」プレフィックス必須）

## 受け入れ条件（Todo）

- [ ] 日本語で音声が再生される
- [ ] フォームの参考情報が音声で伝えられる（「参考: 良いフォームです」など）
- [ ] レップカウントが読み上げられる（「1回」「2回」など）
- [ ] 音量調整が設定画面（expo/027）から変更できる
- [ ] 読み上げ速度調整が設定画面から変更できる
- [ ] ON/OFF切替が設定画面から変更できる
- [ ] 音声再生中は重複して再生されない
- [ ] すべてのフィードバックに「参考:」プレフィックスが付く（薬機法対応）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-005
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-021, NFR-037
- `docs/expo/specs/01_技術スタック_v1_0.md` - expo-speech使用方法

## 技術詳細

### 使用ライブラリ

- **expo-speech**: テキスト読み上げ（Text-to-Speech）
- **Zustand**: 設定状態管理（音量、速度、ON/OFF）

### インストール

```bash
npx expo install expo-speech
```

### 主要機能実装

```typescript
// services/training/voiceFeedbackService.ts

import * as Speech from 'expo-speech';
import { useSettingsStore } from '@/store/settingsStore';

interface VoiceFeedbackOptions {
  volume: number; // 0.0 - 1.0
  rate: number; // 0.5 - 2.0
  enabled: boolean;
}

export class VoiceFeedbackService {
  private isSpeaking = false;

  async speak(message: string, options: VoiceFeedbackOptions) {
    if (!options.enabled || this.isSpeaking) return;

    // 薬機法対応: すべてのメッセージに「参考:」を付ける
    const prefixedMessage = message.startsWith('参考:')
      ? message
      : `参考: ${message}`;

    this.isSpeaking = true;

    try {
      await Speech.speak(prefixedMessage, {
        language: 'ja-JP',
        pitch: 1.0,
        rate: options.rate,
        volume: options.volume,
        onDone: () => {
          this.isSpeaking = false;
        },
        onError: (error) => {
          console.error('Speech error:', error);
          this.isSpeaking = false;
        },
      });
    } catch (error) {
      console.error('Failed to speak:', error);
      this.isSpeaking = false;
    }
  }

  stop() {
    Speech.stop();
    this.isSpeaking = false;
  }

  async speakRepCount(count: number) {
    const message = `${count}回`;
    await this.speak(message, this.getOptions());
  }

  async speakFormFeedback(feedback: string) {
    await this.speak(feedback, this.getOptions());
  }

  private getOptions(): VoiceFeedbackOptions {
    const settings = useSettingsStore.getState();
    return {
      volume: settings.voiceVolume,
      rate: settings.voiceRate,
      enabled: settings.voiceEnabled,
    };
  }
}

export const voiceFeedbackService = new VoiceFeedbackService();
```

### トレーニング実行画面への統合

```typescript
// components/training/TrainingExecutionScreen.tsx

import { voiceFeedbackService } from '@/services/training/voiceFeedbackService';
import { useEffect } from 'react';

export function TrainingExecutionScreen() {
  const { sessionData } = useTrainingStore();
  const { voiceEnabled } = useSettingsStore();

  // レップカウント読み上げ
  useEffect(() => {
    if (voiceEnabled && sessionData.reps > 0) {
      voiceFeedbackService.speakRepCount(sessionData.reps);
    }
  }, [sessionData.reps, voiceEnabled]);

  // フォームフィードバック読み上げ
  useEffect(() => {
    if (voiceEnabled && formFeedback) {
      voiceFeedbackService.speakFormFeedback(formFeedback);
    }
  }, [formFeedback, voiceEnabled]);

  // クリーンアップ: 画面を離れる時に音声停止
  useEffect(() => {
    return () => {
      voiceFeedbackService.stop();
    };
  }, []);

  // ...
}
```

### フィードバックメッセージ定義

```typescript
// constants/voiceFeedbackMessages.ts

export const VOICE_FEEDBACK_MESSAGES = {
  // 一般的なフィードバック
  good: "良いフォームです",
  excellent: "素晴らしいフォームです",
  keepGoing: "その調子で続けましょう",

  // スクワット
  squat: {
    kneesForward: "膝が前に出すぎているかもしれません",
    kneesInward: "膝が内側に入っているかもしれません",
    backStraight: "背中をまっすぐにしてみましょう",
    depthGood: "良い深さです",
  },

  // プッシュアップ
  pushup: {
    bodyLine: "体のラインを維持しましょう",
    elbowAngle: "肘の角度を確認してみてください",
    hipsUp: "腰が上がっているかもしれません",
  },

  // アームカール
  armcurl: {
    elbowStable: "肘を固定しましょう",
    noSwing: "反動を使わないようにしましょう",
    fullRange: "可動域を最大限に使いましょう",
  },

  // サイドレイズ
  sideraise: {
    height: "良い高さです",
    symmetry: "左右対称を意識しましょう",
    elbowBend: "肘を少し曲げましょう",
  },

  // ショルダープレス
  shoulderpress: {
    elbowPath: "肘の軌道を確認してみてください",
    backArch: "腰の反りに注意しましょう",
    fullExtension: "しっかり伸ばしましょう",
  },
};
```

### 設定ストア（Zustand）

```typescript
// store/settingsStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  voiceEnabled: boolean;
  voiceVolume: number; // 0.0 - 1.0
  voiceRate: number; // 0.5 - 2.0
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceVolume: (volume: number) => void;
  setVoiceRate: (rate: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      voiceVolume: 0.8,
      voiceRate: 1.0,
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setVoiceVolume: (volume) => set({ voiceVolume: volume }),
      setVoiceRate: (rate) => set({ voiceRate: rate }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 音声設定UI（expo/027で実装）

```typescript
// components/settings/VoiceSettingsSection.tsx

import { Switch, Text } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '@/store/settingsStore';

export function VoiceSettingsSection() {
  const {
    voiceEnabled,
    voiceVolume,
    voiceRate,
    setVoiceEnabled,
    setVoiceVolume,
    setVoiceRate,
  } = useSettingsStore();

  return (
    <View>
      <Text variant="titleMedium">音声フィードバック</Text>

      <View style={styles.row}>
        <Text>音声ガイド</Text>
        <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} />
      </View>

      {voiceEnabled && (
        <>
          <Text>音量: {Math.round(voiceVolume * 100)}%</Text>
          <Slider
            value={voiceVolume}
            onValueChange={setVoiceVolume}
            minimumValue={0}
            maximumValue={1}
            step={0.1}
          />

          <Text>速度: {voiceRate.toFixed(1)}x</Text>
          <Slider
            value={voiceRate}
            onValueChange={setVoiceRate}
            minimumValue={0.5}
            maximumValue={2.0}
            step={0.1}
          />
        </>
      )}
    </View>
  );
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] フィードバックメッセージに「参考:」プレフィックスが付く
- [ ] 音声が重複して再生されない
- [ ] 設定が正しく保存される

### 統合テスト

- [ ] レップカウント時に音声が再生される
- [ ] フォームフィードバック時に音声が再生される
- [ ] 設定変更が即座に反映される

### 実機テスト

- [ ] iPhone（iOS）で日本語音声が正しく再生される
- [ ] Android端末で日本語音声が正しく再生される
- [ ] 音量・速度調整が正しく動作する

## 見積もり

- 工数: 3日
- 難易度: 中（expo-speech統合、設定管理）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- すべてのフィードバックに「参考:」プレフィックスを付ける（薬機法対応、NFR-037）
- 医療用語（「治療」「診断」「治す」など）は使用禁止
- 音声設定UIはexpo/027（設定画面実装）で実装
- バックグラウンド再生は不要（トレーニング中のみ使用）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
