/**
 * 音声フィードバックサービス
 *
 * トレーニング中に音声でリアルタイムのフォーム参考情報を伝えるサービスです。
 * expo-speechを使用して日本語音声でガイダンスを提供します。
 *
 * 薬機法対応:
 * - すべてのフィードバックに「参考:」プレフィックスを付与
 * - 医療用語（「治療」「診断」「治す」など）は使用禁止
 *
 * @see docs/expo/tickets/023-voice-feedback.md
 * @see docs/common/specs/09_利用規約_v1_0.md
 */

import { Platform } from "react-native";

/**
 * Speech module interface (subset of expo-speech)
 */
interface SpeechModule {
  speak: (text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    volume?: number;
    onDone?: () => void;
    onError?: (error: unknown) => void;
  }) => void;
  stop: () => Promise<void>;
}

// expo-speech is optional - will be loaded dynamically
let Speech: SpeechModule | null = null;

// Dynamically load expo-speech
async function loadSpeech(): Promise<SpeechModule | null> {
  if (Speech) return Speech;

  try {
    // Dynamic import for optional dependency
    // @ts-expect-error - expo-speech may not be installed
    const module = await import("expo-speech");
    Speech = module as SpeechModule;
    return Speech;
  } catch (error) {
    console.warn("[VoiceFeedbackService] expo-speech not available:", error);
    return null;
  }
}

/**
 * 音声フィードバックオプション
 */
export interface VoiceFeedbackOptions {
  /** 音量 (0.0 - 1.0) */
  volume: number;
  /** 読み上げ速度 (0.5 - 2.0) */
  rate: number;
  /** 有効/無効 */
  enabled: boolean;
}

/**
 * デフォルトの音声設定
 */
const DEFAULT_OPTIONS: VoiceFeedbackOptions = {
  volume: 0.8,
  rate: 1.0,
  enabled: true,
};

/**
 * 薬機法対応: メッセージに「参考:」プレフィックスを付与
 */
function addReferencePrefix(message: string): string {
  // Already has prefix
  if (message.startsWith("参考:") || message.startsWith("参考：")) {
    return message;
  }
  // Rep count messages don't need prefix
  if (/^\d+回$/.test(message)) {
    return message;
  }
  // Session start/end messages
  if (
    message.includes("開始") ||
    message.includes("終了") ||
    message.includes("一時停止") ||
    message.includes("再開")
  ) {
    return message;
  }
  return `参考: ${message}`;
}

/**
 * 音声フィードバックサービスクラス
 */
class VoiceFeedbackService {
  private isSpeaking: boolean = false;
  private speechQueue: string[] = [];
  private options: VoiceFeedbackOptions = { ...DEFAULT_OPTIONS };

  /**
   * オプションを設定
   */
  setOptions(options: Partial<VoiceFeedbackOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 現在のオプションを取得
   */
  getOptions(): VoiceFeedbackOptions {
    return { ...this.options };
  }

  /**
   * メッセージを読み上げる
   */
  async speak(message: string, options?: Partial<VoiceFeedbackOptions>): Promise<void> {
    const currentOptions = { ...this.options, ...options };

    // Check if enabled
    if (!currentOptions.enabled) {
      return;
    }

    // Skip on web platform
    if (Platform.OS === "web") {
      console.log("[VoiceFeedback] Web platform - skipping speech:", message);
      return;
    }

    // Load speech module
    const speechModule = await loadSpeech();
    if (!speechModule) {
      console.warn("[VoiceFeedback] Speech module not available");
      return;
    }

    // Add to queue if already speaking
    if (this.isSpeaking) {
      this.speechQueue.push(message);
      return;
    }

    // Apply reference prefix for compliance
    const prefixedMessage = addReferencePrefix(message);

    this.isSpeaking = true;

    try {
      await speechModule.speak(prefixedMessage, {
        language: "ja-JP",
        pitch: 1.0,
        rate: currentOptions.rate,
        volume: currentOptions.volume,
        onDone: () => {
          this.isSpeaking = false;
          this.processQueue();
        },
        onError: (error: unknown) => {
          console.error("[VoiceFeedback] Speech error:", error);
          this.isSpeaking = false;
          this.processQueue();
        },
      });
    } catch (error) {
      console.error("[VoiceFeedback] Failed to speak:", error);
      this.isSpeaking = false;
      this.processQueue();
    }
  }

  /**
   * キューから次のメッセージを処理
   */
  private processQueue(): void {
    if (this.speechQueue.length > 0) {
      const nextMessage = this.speechQueue.shift();
      if (nextMessage) {
        this.speak(nextMessage);
      }
    }
  }

  /**
   * 読み上げを停止
   */
  async stop(): Promise<void> {
    const speechModule = await loadSpeech();
    if (speechModule) {
      await speechModule.stop();
    }
    this.isSpeaking = false;
    this.speechQueue = [];
  }

  /**
   * レップカウントを読み上げ
   */
  async speakRepCount(count: number): Promise<void> {
    await this.speak(`${count}回`);
  }

  /**
   * フォームフィードバックを読み上げ
   */
  async speakFormFeedback(feedback: string): Promise<void> {
    await this.speak(feedback);
  }

  /**
   * セッション開始を読み上げ
   */
  async speakSessionStart(): Promise<void> {
    await this.speak("トレーニングを開始します");
  }

  /**
   * セッション終了を読み上げ
   */
  async speakSessionEnd(): Promise<void> {
    await this.speak("トレーニング終了です。お疲れ様でした");
  }

  /**
   * 一時停止を読み上げ
   */
  async speakPause(): Promise<void> {
    await this.speak("一時停止しました");
  }

  /**
   * 再開を読み上げ
   */
  async speakResume(): Promise<void> {
    await this.speak("再開します");
  }

  /**
   * スコアを読み上げ
   */
  async speakScore(score: number): Promise<void> {
    let message: string;
    if (score >= 90) {
      message = `スコア${score}点、素晴らしいです`;
    } else if (score >= 80) {
      message = `スコア${score}点、良いフォームです`;
    } else if (score >= 60) {
      message = `スコア${score}点、改善の余地があります`;
    } else {
      message = `スコア${score}点、フォームを確認しましょう`;
    }
    await this.speak(message);
  }

  /**
   * 現在読み上げ中かどうか
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * キューに溜まっているメッセージ数
   */
  getQueueLength(): number {
    return this.speechQueue.length;
  }

  /**
   * キューをクリア
   */
  clearQueue(): void {
    this.speechQueue = [];
  }
}

// Singleton instance
export const voiceFeedbackService = new VoiceFeedbackService();

export default voiceFeedbackService;
