/// Performance Monitor
///
/// Monitors system performance during pose detection sessions.
/// Tracks FPS, CPU usage, memory, battery, and temperature.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-024, NFR-025)
library;

import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Performance thresholds
class PerformanceThresholds {
  const PerformanceThresholds({
    this.criticalFps = 15.0,
    this.warningFps = 20.0,
    this.targetFps = 30.0,
    this.criticalProcessingTimeMs = 66,
    this.warningProcessingTimeMs = 50,
    this.targetProcessingTimeMs = 33,
    this.memoryWarningMb = 200.0,
    this.memoryCriticalMb = 300.0,
  });

  /// FPS below this triggers critical alert
  final double criticalFps;

  /// FPS below this triggers warning
  final double warningFps;

  /// Target FPS for optimal performance
  final double targetFps;

  /// Processing time above this is critical (ms)
  final int criticalProcessingTimeMs;

  /// Processing time above this is warning (ms)
  final int warningProcessingTimeMs;

  /// Target processing time (ms)
  final int targetProcessingTimeMs;

  /// Memory usage warning threshold (MB)
  final double memoryWarningMb;

  /// Memory usage critical threshold (MB)
  final double memoryCriticalMb;

  static const defaultThresholds = PerformanceThresholds();
}

/// Performance status levels
enum PerformanceLevel {
  /// Performance is optimal
  optimal,

  /// Performance is acceptable
  acceptable,

  /// Performance is degraded (warning)
  warning,

  /// Performance is critically low
  critical,
}

/// Performance metrics snapshot
class PerformanceMetrics {
  const PerformanceMetrics({
    required this.timestamp,
    this.fps = 0.0,
    this.processingTimeMs = 0,
    this.frameDropRate = 0.0,
    this.memoryUsageMb,
    this.cpuUsagePercent,
    this.batteryLevel,
    this.isCharging,
    this.thermalState,
  });

  /// Timestamp when metrics were recorded
  final DateTime timestamp;

  /// Current frames per second
  final double fps;

  /// Average processing time per frame (ms)
  final int processingTimeMs;

  /// Frame drop rate (0.0 - 1.0)
  final double frameDropRate;

  /// Memory usage in megabytes
  final double? memoryUsageMb;

  /// CPU usage percentage (0-100)
  final double? cpuUsagePercent;

  /// Battery level (0.0 - 1.0)
  final double? batteryLevel;

  /// Whether device is charging
  final bool? isCharging;

  /// Thermal state of the device
  final ThermalState? thermalState;

  PerformanceMetrics copyWith({
    DateTime? timestamp,
    double? fps,
    int? processingTimeMs,
    double? frameDropRate,
    double? memoryUsageMb,
    double? cpuUsagePercent,
    double? batteryLevel,
    bool? isCharging,
    ThermalState? thermalState,
  }) {
    return PerformanceMetrics(
      timestamp: timestamp ?? this.timestamp,
      fps: fps ?? this.fps,
      processingTimeMs: processingTimeMs ?? this.processingTimeMs,
      frameDropRate: frameDropRate ?? this.frameDropRate,
      memoryUsageMb: memoryUsageMb ?? this.memoryUsageMb,
      cpuUsagePercent: cpuUsagePercent ?? this.cpuUsagePercent,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      isCharging: isCharging ?? this.isCharging,
      thermalState: thermalState ?? this.thermalState,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'fps': fps,
      'processingTimeMs': processingTimeMs,
      'frameDropRate': frameDropRate,
      if (memoryUsageMb != null) 'memoryUsageMb': memoryUsageMb,
      if (cpuUsagePercent != null) 'cpuUsagePercent': cpuUsagePercent,
      if (batteryLevel != null) 'batteryLevel': batteryLevel,
      if (isCharging != null) 'isCharging': isCharging,
      if (thermalState != null) 'thermalState': thermalState!.name,
    };
  }
}

/// Thermal state of the device
enum ThermalState {
  /// Normal operating temperature
  nominal,

  /// Slightly elevated temperature
  fair,

  /// High temperature, performance may be throttled
  serious,

  /// Critical temperature, significant throttling
  critical,
}

/// Performance monitor state
class PerformanceMonitorState {
  const PerformanceMonitorState({
    this.isMonitoring = false,
    this.currentMetrics,
    this.overallLevel = PerformanceLevel.optimal,
    this.alerts = const [],
    this.averageFps = 0.0,
    this.averageProcessingTimeMs = 0,
  });

  /// Whether monitoring is active
  final bool isMonitoring;

  /// Current performance metrics
  final PerformanceMetrics? currentMetrics;

  /// Overall performance level
  final PerformanceLevel overallLevel;

  /// Active performance alerts
  final List<PerformanceAlert> alerts;

  /// Average FPS since monitoring started
  final double averageFps;

  /// Average processing time since monitoring started
  final int averageProcessingTimeMs;

  PerformanceMonitorState copyWith({
    bool? isMonitoring,
    PerformanceMetrics? currentMetrics,
    PerformanceLevel? overallLevel,
    List<PerformanceAlert>? alerts,
    double? averageFps,
    int? averageProcessingTimeMs,
  }) {
    return PerformanceMonitorState(
      isMonitoring: isMonitoring ?? this.isMonitoring,
      currentMetrics: currentMetrics ?? this.currentMetrics,
      overallLevel: overallLevel ?? this.overallLevel,
      alerts: alerts ?? this.alerts,
      averageFps: averageFps ?? this.averageFps,
      averageProcessingTimeMs:
          averageProcessingTimeMs ?? this.averageProcessingTimeMs,
    );
  }
}

/// Performance alert
class PerformanceAlert {
  const PerformanceAlert({
    required this.type,
    required this.level,
    required this.message,
    required this.timestamp,
  });

  final PerformanceAlertType type;
  final PerformanceLevel level;
  final String message;
  final DateTime timestamp;
}

/// Performance alert types
enum PerformanceAlertType {
  lowFps,
  highProcessingTime,
  highMemory,
  highTemperature,
  lowBattery,
  frameDrops,
}

/// Performance monitor provider
final performanceMonitorProvider =
    StateNotifierProvider<PerformanceMonitorNotifier, PerformanceMonitorState>(
        (ref) {
  return PerformanceMonitorNotifier();
});

/// Performance monitor notifier
class PerformanceMonitorNotifier
    extends StateNotifier<PerformanceMonitorState> {
  PerformanceMonitorNotifier({
    this.thresholds = PerformanceThresholds.defaultThresholds,
  }) : super(const PerformanceMonitorState());

  final PerformanceThresholds thresholds;

  /// FPS history for averaging
  final Queue<double> _fpsHistory = Queue<double>();

  /// Processing time history for averaging
  final Queue<int> _processingTimeHistory = Queue<int>();

  /// Frame count for drop rate calculation
  int _totalFrames = 0;
  int _droppedFrames = 0;

  /// History size for averaging
  static const int _historySize = 60;

  /// Update timer
  Timer? _updateTimer;

  /// Start monitoring
  void startMonitoring() {
    if (state.isMonitoring) return;

    _fpsHistory.clear();
    _processingTimeHistory.clear();
    _totalFrames = 0;
    _droppedFrames = 0;

    state = state.copyWith(
      isMonitoring: true,
      alerts: [],
    );

    // Start periodic update (every 1 second)
    _updateTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateMetrics();
    });

    debugPrint('PerformanceMonitor: Started monitoring');
  }

  /// Stop monitoring
  void stopMonitoring() {
    if (!state.isMonitoring) return;

    _updateTimer?.cancel();
    _updateTimer = null;

    state = state.copyWith(isMonitoring: false);

    debugPrint('PerformanceMonitor: Stopped monitoring');
  }

  /// Record a frame (called for each processed frame)
  void recordFrame({
    required double fps,
    required int processingTimeMs,
  }) {
    if (!state.isMonitoring) return;

    _totalFrames++;

    // Add to history
    _fpsHistory.addLast(fps);
    if (_fpsHistory.length > _historySize) {
      _fpsHistory.removeFirst();
    }

    _processingTimeHistory.addLast(processingTimeMs);
    if (_processingTimeHistory.length > _historySize) {
      _processingTimeHistory.removeFirst();
    }
  }

  /// Record a dropped frame
  void recordDroppedFrame() {
    if (!state.isMonitoring) return;
    _droppedFrames++;
  }

  /// Update system metrics (battery, memory, etc.)
  void updateSystemMetrics({
    double? memoryUsageMb,
    double? cpuUsagePercent,
    double? batteryLevel,
    bool? isCharging,
    ThermalState? thermalState,
  }) {
    if (!state.isMonitoring) return;

    final current = state.currentMetrics ?? PerformanceMetrics(
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      currentMetrics: current.copyWith(
        memoryUsageMb: memoryUsageMb,
        cpuUsagePercent: cpuUsagePercent,
        batteryLevel: batteryLevel,
        isCharging: isCharging,
        thermalState: thermalState,
      ),
    );
  }

  /// Update metrics and check thresholds
  void _updateMetrics() {
    if (!state.isMonitoring) return;

    // Calculate averages
    final avgFps = _fpsHistory.isEmpty
        ? 0.0
        : _fpsHistory.reduce((a, b) => a + b) / _fpsHistory.length;

    final avgProcessingTime = _processingTimeHistory.isEmpty
        ? 0
        : (_processingTimeHistory.reduce((a, b) => a + b) /
                _processingTimeHistory.length)
            .round();

    final frameDropRate =
        _totalFrames > 0 ? _droppedFrames / _totalFrames : 0.0;

    // Create new metrics
    final metrics = PerformanceMetrics(
      timestamp: DateTime.now(),
      fps: avgFps,
      processingTimeMs: avgProcessingTime,
      frameDropRate: frameDropRate,
      memoryUsageMb: state.currentMetrics?.memoryUsageMb,
      cpuUsagePercent: state.currentMetrics?.cpuUsagePercent,
      batteryLevel: state.currentMetrics?.batteryLevel,
      isCharging: state.currentMetrics?.isCharging,
      thermalState: state.currentMetrics?.thermalState,
    );

    // Check thresholds and generate alerts
    final alerts = _checkThresholds(metrics);

    // Determine overall level
    final overallLevel = _determineOverallLevel(metrics, alerts);

    state = state.copyWith(
      currentMetrics: metrics,
      overallLevel: overallLevel,
      alerts: alerts,
      averageFps: avgFps,
      averageProcessingTimeMs: avgProcessingTime,
    );
  }

  /// Check thresholds and return alerts
  List<PerformanceAlert> _checkThresholds(PerformanceMetrics metrics) {
    final alerts = <PerformanceAlert>[];
    final now = DateTime.now();

    // FPS check
    if (metrics.fps < thresholds.criticalFps && metrics.fps > 0) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.lowFps,
        level: PerformanceLevel.critical,
        message: 'FPS が非常に低下しています (${metrics.fps.toStringAsFixed(1)})',
        timestamp: now,
      ));
    } else if (metrics.fps < thresholds.warningFps && metrics.fps > 0) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.lowFps,
        level: PerformanceLevel.warning,
        message: 'FPS が低下しています (${metrics.fps.toStringAsFixed(1)})',
        timestamp: now,
      ));
    }

    // Processing time check
    if (metrics.processingTimeMs > thresholds.criticalProcessingTimeMs) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.highProcessingTime,
        level: PerformanceLevel.critical,
        message: '処理時間が非常に長くなっています (${metrics.processingTimeMs}ms)',
        timestamp: now,
      ));
    } else if (metrics.processingTimeMs > thresholds.warningProcessingTimeMs) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.highProcessingTime,
        level: PerformanceLevel.warning,
        message: '処理時間が長くなっています (${metrics.processingTimeMs}ms)',
        timestamp: now,
      ));
    }

    // Memory check
    if (metrics.memoryUsageMb != null) {
      if (metrics.memoryUsageMb! > thresholds.memoryCriticalMb) {
        alerts.add(PerformanceAlert(
          type: PerformanceAlertType.highMemory,
          level: PerformanceLevel.critical,
          message:
              'メモリ使用量が非常に高くなっています (${metrics.memoryUsageMb!.toStringAsFixed(0)}MB)',
          timestamp: now,
        ));
      } else if (metrics.memoryUsageMb! > thresholds.memoryWarningMb) {
        alerts.add(PerformanceAlert(
          type: PerformanceAlertType.highMemory,
          level: PerformanceLevel.warning,
          message:
              'メモリ使用量が高くなっています (${metrics.memoryUsageMb!.toStringAsFixed(0)}MB)',
          timestamp: now,
        ));
      }
    }

    // Thermal check
    if (metrics.thermalState == ThermalState.critical) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.highTemperature,
        level: PerformanceLevel.critical,
        message: 'デバイスが過熱しています',
        timestamp: now,
      ));
    } else if (metrics.thermalState == ThermalState.serious) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.highTemperature,
        level: PerformanceLevel.warning,
        message: 'デバイス温度が上昇しています',
        timestamp: now,
      ));
    }

    // Battery check
    if (metrics.batteryLevel != null &&
        metrics.batteryLevel! < 0.1 &&
        metrics.isCharging != true) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.lowBattery,
        level: PerformanceLevel.warning,
        message: 'バッテリー残量が少なくなっています',
        timestamp: now,
      ));
    }

    // Frame drop check
    if (metrics.frameDropRate > 0.1) {
      alerts.add(PerformanceAlert(
        type: PerformanceAlertType.frameDrops,
        level: PerformanceLevel.warning,
        message:
            'フレームドロップが発生しています (${(metrics.frameDropRate * 100).toStringAsFixed(1)}%)',
        timestamp: now,
      ));
    }

    return alerts;
  }

  /// Determine overall performance level
  PerformanceLevel _determineOverallLevel(
    PerformanceMetrics metrics,
    List<PerformanceAlert> alerts,
  ) {
    // If any critical alert, return critical
    if (alerts.any((a) => a.level == PerformanceLevel.critical)) {
      return PerformanceLevel.critical;
    }

    // If any warning alert, return warning
    if (alerts.any((a) => a.level == PerformanceLevel.warning)) {
      return PerformanceLevel.warning;
    }

    // Check if meeting targets
    if (metrics.fps >= thresholds.targetFps &&
        metrics.processingTimeMs <= thresholds.targetProcessingTimeMs) {
      return PerformanceLevel.optimal;
    }

    return PerformanceLevel.acceptable;
  }

  /// Get performance summary for session
  Map<String, dynamic> getSummary() {
    return {
      'averageFps': state.averageFps,
      'averageProcessingTimeMs': state.averageProcessingTimeMs,
      'totalFrames': _totalFrames,
      'droppedFrames': _droppedFrames,
      'frameDropRate': _totalFrames > 0 ? _droppedFrames / _totalFrames : 0.0,
      'overallLevel': state.overallLevel.name,
    };
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
  }
}
