/// フレームレートモニター
///
/// フレーム処理レートを監視し、パフォーマンス低下時にフォールバックをトリガーします。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-035)
///
/// 実装:
/// - FPS計算用の30フレーム移動平均
/// - 20fps未満で警告
/// - 3段階フォールバック: 解像度 -> FPS -> 簡易描画
library;

import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// フレームレートモニタープロバイダー
final frameRateMonitorProvider =
    StateNotifierProvider<FrameRateMonitorNotifier, FrameRateState>((ref) {
  return FrameRateMonitorNotifier();
});

/// フレームレート状態
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

  /// 現在の瞬間FPS
  final double currentFps;

  /// 30フレーム移動平均FPS
  final double averageFps;

  /// 記録された最小FPS
  final double minFps;

  /// 記録された最大FPS
  final double maxFps;

  /// 現在のパフォーマンス状態
  final FrameRateStatus status;

  /// 現在のフォールバックレベル
  final FallbackLevel fallbackLevel;

  /// 処理された総フレーム数
  final int frameCount;

  /// ドロップされたフレーム数
  final int droppedFrames;

  /// パフォーマンス警告が最後に発行された時刻
  final DateTime? lastWarningTime;

  /// ドロップ率のパーセンテージを取得
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

/// フレームレートパフォーマンス状態
enum FrameRateStatus {
  /// FPS >= 25、パフォーマンスは良好
  good,

  /// 20 <= FPS < 25、パフォーマンスは許容範囲
  acceptable,

  /// 15 <= FPS < 20、パフォーマンスは低下
  warning,

  /// FPS < 15、パフォーマンスは危機的
  critical,
}

/// パフォーマンス最適化のためのフォールバックレベル
enum FallbackLevel {
  /// フォールバックなし、フル品質
  none,

  /// レベル1: 解像度低下 (720p -> 480p)
  reducedResolution,

  /// レベル2: FPS低下 (30fps -> 24fps)
  reducedFps,

  /// レベル3: 簡易描画（姿勢オーバーレイをスキップ）
  simplifiedRendering,
}

/// フレームレートモニター状態Notifier
class FrameRateMonitorNotifier extends StateNotifier<FrameRateState> {
  FrameRateMonitorNotifier() : super(const FrameRateState());

  /// 移動平均ウィンドウサイズ（仕様に従い30フレーム）
  static const int _windowSize = 30;

  /// 警告閾値FPS
  static const double _warningFps = 20.0;

  /// 危機的閾値FPS
  static const double _criticalFps = 15.0;

  /// フォールバック適用間の最小間隔（5秒）
  static const Duration _fallbackCooldown = Duration(seconds: 5);

  /// 移動平均計算用キュー
  final Queue<double> _fpsHistory = Queue<double>();

  /// 最後のフレームタイムスタンプ
  int? _lastFrameTimestamp;

  /// 最後のフォールバック時刻
  DateTime? _lastFallbackTime;

  /// フォールバックが必要な時のコールバック
  void Function(FallbackLevel)? onFallbackNeeded;

  /// 処理されたフレームを記録
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

  /// ドロップされたフレームを記録
  void recordDroppedFrame() {
    state = state.copyWith(
      droppedFrames: state.droppedFrames + 1,
    );
  }

  /// FPS読み取り値を追加し状態を更新
  void _addFpsReading(double fps) {
    // 履歴に追加
    _fpsHistory.addLast(fps);
    if (_fpsHistory.length > _windowSize) {
      _fpsHistory.removeFirst();
    }

    // 移動平均を計算
    final averageFps = _fpsHistory.isEmpty
        ? 0.0
        : _fpsHistory.reduce((a, b) => a + b) / _fpsHistory.length;

    // 最小/最大を更新
    final minFps = fps < state.minFps ? fps : state.minFps;
    final maxFps = fps > state.maxFps ? fps : state.maxFps;

    // 状態を判定
    final status = _determineStatus(averageFps);

    // フォールバックが必要かチェック
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

  /// FPSに基づいてパフォーマンス状態を判定
  FrameRateStatus _determineStatus(double fps) {
    if (fps >= 25) return FrameRateStatus.good;
    if (fps >= _warningFps) return FrameRateStatus.acceptable;
    if (fps >= _criticalFps) return FrameRateStatus.warning;
    return FrameRateStatus.critical;
  }

  /// フォールバックを適用すべきかチェック
  void _checkFallbackNeeded(FrameRateStatus status, double averageFps) {
    // 十分なサンプルが集まった後のみチェック
    if (_fpsHistory.length < _windowSize ~/ 2) return;

    // クールダウンをチェック
    if (_lastFallbackTime != null) {
      final timeSinceLastFallback = DateTime.now().difference(_lastFallbackTime!);
      if (timeSinceLastFallback < _fallbackCooldown) return;
    }

    // フォールバックが必要か判定
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

        // コールバックに通知
        onFallbackNeeded?.call(nextLevel);
      }
    }
  }

  /// 次のフォールバックレベルを取得
  FallbackLevel? _getNextFallbackLevel() {
    switch (state.fallbackLevel) {
      case FallbackLevel.none:
        return FallbackLevel.reducedResolution;
      case FallbackLevel.reducedResolution:
        return FallbackLevel.reducedFps;
      case FallbackLevel.reducedFps:
        return FallbackLevel.simplifiedRendering;
      case FallbackLevel.simplifiedRendering:
        return null; // 既に最大フォールバック
    }
  }

  /// モニター状態をリセット
  void reset() {
    _fpsHistory.clear();
    _lastFrameTimestamp = null;
    _lastFallbackTime = null;
    state = const FrameRateState();
  }

  /// パフォーマンスサマリーを取得
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
