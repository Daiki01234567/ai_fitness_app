/// Camera Configuration
///
/// Configuration settings for camera capture.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-024, NFR-025, NFR-035)
library;

import 'package:camera/camera.dart';

/// Camera resolution preset configurations
class CameraConfig {
  const CameraConfig({
    required this.resolution,
    required this.targetFps,
    required this.minFps,
    this.enableAudio = false,
  });

  /// Camera resolution preset
  final ResolutionPreset resolution;

  /// Target frames per second
  final int targetFps;

  /// Minimum acceptable FPS before triggering fallback
  final int minFps;

  /// Whether to enable audio capture
  final bool enableAudio;

  /// Default high-quality configuration
  /// Target: 720p at 30fps
  static const highQuality = CameraConfig(
    resolution: ResolutionPreset.high, // 720p
    targetFps: 30,
    minFps: 20,
  );

  /// Medium quality fallback configuration
  /// Target: 480p at 30fps
  static const mediumQuality = CameraConfig(
    resolution: ResolutionPreset.medium, // 480p
    targetFps: 30,
    minFps: 20,
  );

  /// Low quality fallback configuration
  /// Target: 480p at 24fps
  static const lowQuality = CameraConfig(
    resolution: ResolutionPreset.medium, // 480p
    targetFps: 24,
    minFps: 15,
  );

  /// Minimum quality fallback configuration
  /// Target: 360p at 20fps
  static const minimumQuality = CameraConfig(
    resolution: ResolutionPreset.low, // 360p
    targetFps: 20,
    minFps: 15,
  );

  /// Get the next fallback configuration
  CameraConfig? get fallback {
    if (this == highQuality) return mediumQuality;
    if (this == mediumQuality) return lowQuality;
    if (this == lowQuality) return minimumQuality;
    return null;
  }

  /// Get all configurations in order of quality
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

// Note: Use CameraLensDirection from package:camera/camera.dart
// This enum was removed to avoid ambiguous imports

/// Camera state enumeration
enum CameraState {
  /// Camera is not initialized
  uninitialized,

  /// Camera is initializing
  initializing,

  /// Camera is ready and streaming
  ready,

  /// Camera is paused
  paused,

  /// Camera encountered an error
  error,

  /// Camera is disposed
  disposed,
}
