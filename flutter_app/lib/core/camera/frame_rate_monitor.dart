/// Frame Rate Monitor
///
/// Monitors frame processing rate and triggers fallback when performance degrades.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-035)
///
/// Implementation:
/// - 30-frame moving average for FPS calculation
/// - Warning at < 20fps
/// - 3-stage fallback: Resolution -> FPS -> Simplified rendering
library;

import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Frame rate monitor provider
final frameRateMonitorProvider =
    StateNotifierProvider<FrameRateMonitorNotifier, FrameRateState>((ref) {
  return FrameRateMonitorNotifier();
});

/// Frame rate state
class FrameRateState {
  const FrameRateState({
    this.currentFps = 0.0,
    this.averageFps = 0.0,
    this.minFps = double.infinity,
    this.maxFps = 0.0,
    this.status = FrameRateStatus.good,
    this.fallbackLevel = FallbackLevel.none,
    this.frameCount = 0,
    this.droppedFrames = 0,
    this.lastWarningTime,
  });

  /// Current instantaneous FPS
  final double currentFps;

  /// 30-frame moving average FPS
  final double averageFps;

  /// Minimum FPS recorded
  final double minFps;

  /// Maximum FPS recorded
  final double maxFps;

  /// Current performance status
  final FrameRateStatus status;

  /// Current fallback level
  final FallbackLevel fallbackLevel;

  /// Total frames processed
  final int frameCount;

  /// Number of dropped frames
  final int droppedFrames;

  /// Last time a performance warning was issued
  final DateTime? lastWarningTime;

  /// Get drop rate percentage
  double get dropRate {
    if (frameCount == 0) return 0.0;
    return (droppedFrames / frameCount) * 100;
  }

  FrameRateState copyWith({
    double? currentFps,
    double? averageFps,
    double? minFps,
    double? maxFps,
    FrameRateStatus? status,
    FallbackLevel? fallbackLevel,
    int? frameCount,
    int? droppedFrames,
    DateTime? lastWarningTime,
  }) {
    return FrameRateState(
      currentFps: currentFps ?? this.currentFps,
      averageFps: averageFps ?? this.averageFps,
      minFps: minFps ?? this.minFps,
      maxFps: maxFps ?? this.maxFps,
      status: status ?? this.status,
      fallbackLevel: fallbackLevel ?? this.fallbackLevel,
      frameCount: frameCount ?? this.frameCount,
      droppedFrames: droppedFrames ?? this.droppedFrames,
      lastWarningTime: lastWarningTime ?? this.lastWarningTime,
    );
  }
}

/// Frame rate performance status
enum FrameRateStatus {
  /// FPS >= 25, performance is good
  good,

  /// 20 <= FPS < 25, performance is acceptable
  acceptable,

  /// 15 <= FPS < 20, performance is degraded
  warning,

  /// FPS < 15, performance is critical
  critical,
}

/// Fallback level for performance optimization
enum FallbackLevel {
  /// No fallback applied, full quality
  none,

  /// Level 1: Reduced resolution (720p -> 480p)
  reducedResolution,

  /// Level 2: Reduced FPS (30fps -> 24fps)
  reducedFps,

  /// Level 3: Simplified rendering (skip pose overlay)
  simplifiedRendering,
}

/// Frame rate monitor state notifier
class FrameRateMonitorNotifier extends StateNotifier<FrameRateState> {
  FrameRateMonitorNotifier() : super(const FrameRateState());

  /// Moving average window size (30 frames per spec)
  static const int _windowSize = 30;

  /// Warning threshold FPS
  static const double _warningFps = 20.0;

  /// Critical threshold FPS
  static const double _criticalFps = 15.0;

  /// Minimum interval between fallback applications (5 seconds)
  static const Duration _fallbackCooldown = Duration(seconds: 5);

  /// Queue for moving average calculation
  final Queue<double> _fpsHistory = Queue<double>();

  /// Last frame timestamp
  int? _lastFrameTimestamp;

  /// Last fallback time
  DateTime? _lastFallbackTime;

  /// Callback for when fallback is needed
  void Function(FallbackLevel)? onFallbackNeeded;

  /// Record a frame being processed
  void recordFrame(int timestampMs) {
    final now = timestampMs;

    if (_lastFrameTimestamp != null) {
      final deltaMs = now - _lastFrameTimestamp!;
      if (deltaMs > 0) {
        final instantFps = 1000.0 / deltaMs;
        _addFpsReading(instantFps);
      }
    }

    _lastFrameTimestamp = now;
  }

  /// Record a dropped frame
  void recordDroppedFrame() {
    state = state.copyWith(
      droppedFrames: state.droppedFrames + 1,
    );
  }

  /// Add FPS reading and update state
  void _addFpsReading(double fps) {
    // Add to history
    _fpsHistory.addLast(fps);
    if (_fpsHistory.length > _windowSize) {
      _fpsHistory.removeFirst();
    }

    // Calculate moving average
    final averageFps = _fpsHistory.isEmpty
        ? 0.0
        : _fpsHistory.reduce((a, b) => a + b) / _fpsHistory.length;

    // Update min/max
    final minFps = fps < state.minFps ? fps : state.minFps;
    final maxFps = fps > state.maxFps ? fps : state.maxFps;

    // Determine status
    final status = _determineStatus(averageFps);

    // Check if fallback is needed
    _checkFallbackNeeded(status, averageFps);

    state = state.copyWith(
      currentFps: fps,
      averageFps: averageFps,
      minFps: minFps,
      maxFps: maxFps,
      status: status,
      frameCount: state.frameCount + 1,
    );
  }

  /// Determine performance status based on FPS
  FrameRateStatus _determineStatus(double fps) {
    if (fps >= 25) return FrameRateStatus.good;
    if (fps >= _warningFps) return FrameRateStatus.acceptable;
    if (fps >= _criticalFps) return FrameRateStatus.warning;
    return FrameRateStatus.critical;
  }

  /// Check if fallback should be applied
  void _checkFallbackNeeded(FrameRateStatus status, double averageFps) {
    // Only check after we have enough samples
    if (_fpsHistory.length < _windowSize ~/ 2) return;

    // Check cooldown
    if (_lastFallbackTime != null) {
      final timeSinceLastFallback = DateTime.now().difference(_lastFallbackTime!);
      if (timeSinceLastFallback < _fallbackCooldown) return;
    }

    // Determine if fallback is needed
    if (status == FrameRateStatus.warning || status == FrameRateStatus.critical) {
      final nextLevel = _getNextFallbackLevel();
      if (nextLevel != null && nextLevel != state.fallbackLevel) {
        debugPrint('FrameRateMonitor: Performance degraded (${averageFps.toStringAsFixed(1)} fps), '
            'applying fallback level: $nextLevel');

        _lastFallbackTime = DateTime.now();
        state = state.copyWith(
          fallbackLevel: nextLevel,
          lastWarningTime: DateTime.now(),
        );

        // Notify callback
        onFallbackNeeded?.call(nextLevel);
      }
    }
  }

  /// Get next fallback level
  FallbackLevel? _getNextFallbackLevel() {
    switch (state.fallbackLevel) {
      case FallbackLevel.none:
        return FallbackLevel.reducedResolution;
      case FallbackLevel.reducedResolution:
        return FallbackLevel.reducedFps;
      case FallbackLevel.reducedFps:
        return FallbackLevel.simplifiedRendering;
      case FallbackLevel.simplifiedRendering:
        return null; // Already at maximum fallback
    }
  }

  /// Reset monitor state
  void reset() {
    _fpsHistory.clear();
    _lastFrameTimestamp = null;
    _lastFallbackTime = null;
    state = const FrameRateState();
  }

  /// Get performance summary
  String getPerformanceSummary() {
    return '''
Frame Rate Summary:
  Current FPS: ${state.currentFps.toStringAsFixed(1)}
  Average FPS: ${state.averageFps.toStringAsFixed(1)}
  Min FPS: ${state.minFps.toStringAsFixed(1)}
  Max FPS: ${state.maxFps.toStringAsFixed(1)}
  Status: ${state.status.name}
  Fallback Level: ${state.fallbackLevel.name}
  Total Frames: ${state.frameCount}
  Dropped Frames: ${state.droppedFrames} (${state.dropRate.toStringAsFixed(1)}%)
''';
  }
}
