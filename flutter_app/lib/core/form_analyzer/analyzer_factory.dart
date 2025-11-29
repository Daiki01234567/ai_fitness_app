/// Analyzer Factory
///
/// Factory for creating exercise-specific form analyzers.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Usage:
/// ```dart
/// final analyzer = AnalyzerFactory.create(ExerciseType.squat);
/// final result = analyzer.analyze(poseFrame);
/// ```
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'base/base_analyzer.dart';
import 'analyzers/squat_analyzer.dart';
import 'analyzers/bicep_curl_analyzer.dart';
import 'analyzers/lateral_raise_analyzer.dart';
import 'analyzers/shoulder_press_analyzer.dart';
import 'analyzers/pushup_analyzer.dart';

/// Factory for creating form analyzers
class AnalyzerFactory {
  /// Private constructor to prevent instantiation
  AnalyzerFactory._();

  /// Create an analyzer for the specified exercise type
  static BaseFormAnalyzer create(
    ExerciseType exerciseType, {
    AnalyzerConfig? config,
  }) {
    switch (exerciseType) {
      case ExerciseType.squat:
        return SquatAnalyzer(config: config);
      case ExerciseType.armCurl:
        return BicepCurlAnalyzer(config: config);
      case ExerciseType.sideRaise:
        return LateralRaiseAnalyzer(config: config);
      case ExerciseType.shoulderPress:
        return ShoulderPressAnalyzer(config: config);
      case ExerciseType.pushUp:
        return PushUpAnalyzer(config: config);
    }
  }

  /// Create analyzer with custom exercise-specific configuration
  static BaseFormAnalyzer createWithConfig(
    ExerciseType exerciseType, {
    AnalyzerConfig? baseConfig,
    dynamic exerciseConfig,
  }) {
    switch (exerciseType) {
      case ExerciseType.squat:
        return SquatAnalyzer(
          config: baseConfig,
          squatConfig: exerciseConfig as SquatConfig?,
        );
      case ExerciseType.armCurl:
        return BicepCurlAnalyzer(
          config: baseConfig,
          curlConfig: exerciseConfig as BicepCurlConfig?,
        );
      case ExerciseType.sideRaise:
        return LateralRaiseAnalyzer(
          config: baseConfig,
          raiseConfig: exerciseConfig as LateralRaiseConfig?,
        );
      case ExerciseType.shoulderPress:
        return ShoulderPressAnalyzer(
          config: baseConfig,
          pressConfig: exerciseConfig as ShoulderPressConfig?,
        );
      case ExerciseType.pushUp:
        return PushUpAnalyzer(
          config: baseConfig,
          pushUpConfig: exerciseConfig as PushUpConfig?,
        );
    }
  }

  /// Get available exercise types
  static List<ExerciseType> get availableExercises => ExerciseType.values;

  /// Get exercise display name in Japanese
  static String getDisplayName(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return 'スクワット';
      case ExerciseType.armCurl:
        return 'アームカール';
      case ExerciseType.sideRaise:
        return 'サイドレイズ';
      case ExerciseType.shoulderPress:
        return 'ショルダープレス';
      case ExerciseType.pushUp:
        return 'プッシュアップ';
    }
  }

  /// Get exercise description in Japanese
  static String getDescription(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return '下半身の基本トレーニング。膝と股関節の連動、背筋の維持が重要です。';
      case ExerciseType.armCurl:
        return '上腕二頭筋のトレーニング。肘の固定と反動を使わないことがポイントです。';
      case ExerciseType.sideRaise:
        return '三角筋中部のトレーニング。腕を真横に上げ、肩の高さまで持ち上げます。';
      case ExerciseType.shoulderPress:
        return '肩全体のトレーニング。頭上に向かって真っすぐ押し上げる動作です。';
      case ExerciseType.pushUp:
        return '胸・腕・体幹のトレーニング。体を一直線に保ちながら行います。';
    }
  }

  /// Get key body parts for the exercise
  static List<String> getKeyBodyParts(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return ['膝', '股関節', '背中', 'かかと'];
      case ExerciseType.armCurl:
        return ['肘', '肩', '手首'];
      case ExerciseType.sideRaise:
        return ['肩', '肘', '手首', '体幹'];
      case ExerciseType.shoulderPress:
        return ['肘', '肩', '腰'];
      case ExerciseType.pushUp:
        return ['肘', '肩', '腰', '首'];
    }
  }
}
