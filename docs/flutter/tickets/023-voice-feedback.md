# 023 音声フィードバック機能

## 概要

トレーニング中にリアルタイムで音声によるフィードバックを提供する機能を実装するチケットです。flutter_ttsパッケージを使用して、フォーム改善のアドバイスやレップカウントを音声で通知します。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 021: トレーニング実行画面

## 要件

### 機能要件

- FR-016: トレーニング中に音声でフィードバックが提供される
- FR-017: ユーザーは音声フィードバックのオン/オフを切り替えられる

### 非機能要件

- NFR-026: 音声フィードバックの遅延は500ms以内
- NFR-027: 音声フィードバックは日本語で提供される

## 受け入れ条件（Todo）

- [ ] flutter_ttsパッケージがインストールされている
- [ ] レップ完了時に「1回」「2回」と音声カウントされる
- [ ] フォームが悪いときに改善アドバイスが音声で流れる（例: 「膝を少し曲げてください」）
- [ ] 音声フィードバックのオン/オフを設定画面で切り替えられる
- [ ] 音声の再生速度と音量を調整できる
- [ ] iOS/Androidの両方で正しく動作する
- [ ] バックグラウンド再生に対応していない（トレーニング中のみ）
- [ ] 音声が重複して再生されないように制御されている
- [ ] ユニットテストがある（モック使用）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-016, FR-017
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - フィードバックメッセージ

## 技術詳細

### パッケージインストール

```yaml
# pubspec.yaml
dependencies:
  flutter_tts: ^4.0.2
```

### TTSサービス実装

```dart
// lib/services/tts_service.dart
import 'package:flutter_tts/flutter_tts.dart';

class TtsService {
  final FlutterTts _flutterTts = FlutterTts();
  bool _isEnabled = true;
  bool _isSpeaking = false;

  Future<void> initialize() async {
    // 日本語設定
    await _flutterTts.setLanguage('ja-JP');

    // 音声設定
    await _flutterTts.setSpeechRate(0.5); // 通常速度
    await _flutterTts.setVolume(1.0); // 最大音量
    await _flutterTts.setPitch(1.0); // 通常ピッチ

    // コールバック設定
    _flutterTts.setStartHandler(() {
      _isSpeaking = true;
    });

    _flutterTts.setCompletionHandler(() {
      _isSpeaking = false;
    });

    _flutterTts.setErrorHandler((msg) {
      print('TTS Error: $msg');
      _isSpeaking = false;
    });
  }

  Future<void> speak(String text) async {
    if (!_isEnabled || _isSpeaking) return;

    await _flutterTts.speak(text);
  }

  Future<void> stop() async {
    await _flutterTts.stop();
    _isSpeaking = false;
  }

  void setEnabled(bool enabled) {
    _isEnabled = enabled;
    if (!enabled) {
      stop();
    }
  }

  Future<void> setSpeechRate(double rate) async {
    await _flutterTts.setSpeechRate(rate);
  }

  Future<void> setVolume(double volume) async {
    await _flutterTts.setVolume(volume);
  }
}
```

### Riverpod Provider

```dart
// lib/providers/tts_provider.dart
@riverpod
TtsService ttsService(TtsServiceRef ref) {
  final service = TtsService();
  service.initialize();

  // Providerが破棄されるときにクリーンアップ
  ref.onDispose(() {
    service.stop();
  });

  return service;
}

@riverpod
class TtsSettings extends _$TtsSettings {
  @override
  TtsSettingsState build() {
    return TtsSettingsState(
      enabled: true,
      speechRate: 0.5,
      volume: 1.0,
    );
  }

  void setEnabled(bool enabled) {
    state = state.copyWith(enabled: enabled);
    ref.read(ttsServiceProvider).setEnabled(enabled);
  }

  void setSpeechRate(double rate) {
    state = state.copyWith(speechRate: rate);
    ref.read(ttsServiceProvider).setSpeechRate(rate);
  }

  void setVolume(double volume) {
    state = state.copyWith(volume: volume);
    ref.read(ttsServiceProvider).setVolume(volume);
  }
}

@freezed
class TtsSettingsState with _$TtsSettingsState {
  const factory TtsSettingsState({
    required bool enabled,
    required double speechRate,
    required double volume,
  }) = _TtsSettingsState;
}
```

### フィードバックメッセージ定義

```dart
// lib/constants/feedback_messages.dart
class FeedbackMessages {
  // レップカウント
  static String repCount(int count) => '${count}回';

  // セット完了
  static const String setCompleted = 'セット完了。休憩してください。';

  // スクワット
  static const Map<String, String> squat = {
    'knee_angle_too_shallow': '膝をもう少し曲げてください',
    'knee_over_toe': '膝がつま先より前に出ています',
    'back_not_straight': '背中をまっすぐ保ってください',
    'good_form': 'フォームが良いです',
  };

  // プッシュアップ
  static const Map<String, String> pushup = {
    'elbow_angle_too_shallow': '肘をもっと曲げてください',
    'hips_sagging': '腰が落ちています',
    'body_not_straight': '体をまっすぐ保ってください',
    'good_form': 'フォームが良いです',
  };

  // アームカール
  static const Map<String, String> armCurl = {
    'using_momentum': '反動を使わないでください',
    'elbow_moving': '肘を固定してください',
    'good_form': 'フォームが良いです',
  };

  // サイドレイズ
  static const Map<String, String> sideRaise = {
    'arms_too_low': '腕をもう少し上げてください',
    'arms_too_high': '腕を上げすぎです',
    'asymmetric': '左右対称に上げてください',
    'good_form': 'フォームが良いです',
  };

  // ショルダープレス
  static const Map<String, String> shoulderPress = {
    'back_arching': '腰を反らないでください',
    'elbows_not_aligned': '肘の位置を揃えてください',
    'good_form': 'フォームが良いです',
  };
}
```

### トレーニング画面での使用

```dart
// lib/screens/training/training_screen.dart（一部抜粋）
class _TrainingScreenState extends ConsumerState<TrainingScreen> {
  late TtsService _ttsService;

  @override
  void initState() {
    super.initState();
    _ttsService = ref.read(ttsServiceProvider);
  }

  void _onRepCompleted(int repCount) {
    setState(() {
      _repCount = repCount;
    });

    // レップカウントを音声で通知
    _ttsService.speak(FeedbackMessages.repCount(repCount));
  }

  void _onFormFeedback(String feedbackKey) {
    final settings = ref.read(ttsSettingsProvider);
    if (!settings.enabled) return;

    // フィードバックメッセージを取得
    final message = _getFeedbackMessage(widget.exerciseType, feedbackKey);

    if (message != null) {
      _ttsService.speak(message);
    }
  }

  String? _getFeedbackMessage(ExerciseType type, String key) {
    switch (type) {
      case ExerciseType.squat:
        return FeedbackMessages.squat[key];
      case ExerciseType.pushup:
        return FeedbackMessages.pushup[key];
      case ExerciseType.armCurl:
        return FeedbackMessages.armCurl[key];
      case ExerciseType.sideRaise:
        return FeedbackMessages.sideRaise[key];
      case ExerciseType.shoulderPress:
        return FeedbackMessages.shoulderPress[key];
      default:
        return null;
    }
  }

  @override
  void dispose() {
    _ttsService.stop();
    super.dispose();
  }
}
```

### 設定画面での制御

```dart
// lib/screens/settings/tts_settings_screen.dart
class TtsSettingsScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(ttsSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: Text('音声フィードバック設定')),
      body: ListView(
        children: [
          SwitchListTile(
            title: Text('音声フィードバックを有効にする'),
            value: settings.enabled,
            onChanged: (value) {
              ref.read(ttsSettingsProvider.notifier).setEnabled(value);
            },
          ),

          ListTile(
            title: Text('読み上げ速度'),
            subtitle: Slider(
              value: settings.speechRate,
              min: 0.3,
              max: 1.0,
              divisions: 7,
              label: '${(settings.speechRate * 100).toInt()}%',
              onChanged: settings.enabled
                  ? (value) {
                      ref.read(ttsSettingsProvider.notifier).setSpeechRate(value);
                    }
                  : null,
            ),
          ),

          ListTile(
            title: Text('音量'),
            subtitle: Slider(
              value: settings.volume,
              min: 0.0,
              max: 1.0,
              divisions: 10,
              label: '${(settings.volume * 100).toInt()}%',
              onChanged: settings.enabled
                  ? (value) {
                      ref.read(ttsSettingsProvider.notifier).setVolume(value);
                    }
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- flutter_ttsはiOS/Androidで異なるエンジンを使用（iOS: AVSpeechSynthesizer、Android: TextToSpeech）
- 音声設定はshared_preferencesで永続化（チケット027で実装）
- トレーニング中のみ音声を再生（バックグラウンドでは停止）
- 音声が重複しないように、_isSpeakingフラグで制御

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
