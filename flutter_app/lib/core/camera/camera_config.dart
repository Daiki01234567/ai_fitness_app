/// カメラ設定
///
/// カメラキャプチャの設定。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-024, NFR-025, NFR-035)
library;

import 'package:camera/camera.dart';

/// カメラ解像度プリセット設定
class CameraConfig {
  const CameraConfig({
    required this.resolution,
    required this.targetFps,
    required this.minFps,
    this.enableAudio = false,
  });

  /// カメラ解像度プリセット
  final ResolutionPreset resolution;

  /// ターゲットフレームレート（FPS）
  final int targetFps;

  /// フォールバックをトリガーする前の最小許容FPS
  final int minFps;

  /// 音声キャプチャを有効にするかどうか
  final bool enableAudio;

  /// デフォルトの高画質設定
  /// ターゲット: 720p 30fps
  static const highQuality = CameraConfig(
    resolution: ResolutionPreset.high, // 720p
    targetFps: 30,
    minFps: 20,
  );

  /// 中画質フォールバック設定
  /// ターゲット: 480p 30fps
  static const mediumQuality = CameraConfig(
    resolution: ResolutionPreset.medium, // 480p
    targetFps: 30,
    minFps: 20,
  );

  /// 低画質フォールバック設定
  /// ターゲット: 480p 24fps
  static const lowQuality = CameraConfig(
    resolution: ResolutionPreset.medium, // 480p
    targetFps: 24,
    minFps: 15,
  );

  /// 最低画質フォールバック設定
  /// ターゲット: 360p 20fps
  static const minimumQuality = CameraConfig(
    resolution: ResolutionPreset.low, // 360p
    targetFps: 20,
    minFps: 15,
  );

  /// 次のフォールバック設定を取得
  CameraConfig? get fallback {
    if (this == highQuality) return mediumQuality;
    if (this == mediumQuality) return lowQuality;
    if (this == lowQuality) return minimumQuality;
    return null;
  }

  /// 品質順に全設定を取得
  static const List<CameraConfig> allConfigs = [
    highQuality,
    mediumQuality,
    lowQuality,
    minimumQuality,
  ];

  @override
  String toString() =>
      'CameraConfig(resolution: ${resolution.name}, '
      'targetFps: $targetFps, minFps: $minFps)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CameraConfig &&
          runtimeType == other.runtimeType &&
          resolution == other.resolution &&
          targetFps == other.targetFps &&
          minFps == other.minFps;

  @override
  int get hashCode =>
      resolution.hashCode ^ targetFps.hashCode ^ minFps.hashCode;
}

// 注意: package:camera/camera.dartのCameraLensDirectionを使用
// あいまいなインポートを避けるためこのenumは削除されました

/// カメラ状態列挙型
enum CameraState {
  /// カメラが初期化されていない
  uninitialized,

  /// カメラが初期化中
  initializing,

  /// カメラがストリーミング準備完了
  ready,

  /// カメラが一時停止中
  paused,

  /// カメラがエラー状態
  error,

  /// カメラが破棄済み
  disposed,
}
