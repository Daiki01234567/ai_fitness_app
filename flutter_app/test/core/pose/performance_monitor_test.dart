// Performance Monitor Tests
//
// Unit tests for performance monitoring functionality.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/pose/performance_monitor.dart';

void main() {
  group('PerformanceMonitor', () {
    late ProviderContainer container;
    late PerformanceMonitorNotifier monitor;

    setUp(() {
      container = ProviderContainer();
      monitor = container.read(performanceMonitorProvider.notifier);
    });

    tearDown(() {
      monitor.stopMonitoring();
      container.dispose();
    });

    group('Monitoring lifecycle', () {
      test('initial state is not monitoring', () {
        final state = container.read(performanceMonitorProvider);

        expect(state.isMonitoring, isFalse);
        expect(state.currentMetrics, isNull);
        expect(state.overallLevel, equals(PerformanceLevel.optimal));
      });

      test('startMonitoring sets monitoring flag', () {
        monitor.startMonitoring();

        final state = container.read(performanceMonitorProvider);

        expect(state.isMonitoring, isTrue);
      });

      test('stopMonitoring clears monitoring flag', () {
        monitor.startMonitoring();
        monitor.stopMonitoring();

        final state = container.read(performanceMonitorProvider);

        expect(state.isMonitoring, isFalse);
      });
    });

    group('Frame recording', () {
      test('recordFrame updates metrics when monitoring', () {
        monitor.startMonitoring();

        for (var i = 0; i < 30; i++) {
          monitor.recordFrame(fps: 30.0, processingTimeMs: 33);
        }

        // averageFps is updated by periodic timer, so check summary's totalFrames
        final summary = monitor.getSummary();

        expect(summary['totalFrames'], equals(30));
      });

      test('recordFrame does nothing when not monitoring', () {
        // Don't start monitoring
        monitor.recordFrame(fps: 30.0, processingTimeMs: 33);

        final state = container.read(performanceMonitorProvider);

        expect(state.averageFps, equals(0.0));
      });

      test('recordDroppedFrame increments counter when monitoring', () {
        monitor.startMonitoring();
        monitor.recordDroppedFrame();
        monitor.recordDroppedFrame();

        final summary = monitor.getSummary();

        expect(summary['droppedFrames'], equals(2));
      });
    });

    group('System metrics', () {
      test('updateSystemMetrics updates current metrics', () {
        monitor.startMonitoring();
        monitor.updateSystemMetrics(
          memoryUsageMb: 150.0,
          cpuUsagePercent: 45.0,
          batteryLevel: 0.8,
          isCharging: false,
          thermalState: ThermalState.nominal,
        );

        final state = container.read(performanceMonitorProvider);

        expect(state.currentMetrics?.memoryUsageMb, equals(150.0));
        expect(state.currentMetrics?.cpuUsagePercent, equals(45.0));
        expect(state.currentMetrics?.batteryLevel, equals(0.8));
        expect(state.currentMetrics?.isCharging, equals(false));
        expect(state.currentMetrics?.thermalState, equals(ThermalState.nominal));
      });
    });

    group('Summary', () {
      test('getSummary returns correct structure', () {
        monitor.startMonitoring();

        for (var i = 0; i < 10; i++) {
          monitor.recordFrame(fps: 30.0, processingTimeMs: 33);
        }
        monitor.recordDroppedFrame();

        final summary = monitor.getSummary();

        expect(summary.containsKey('averageFps'), isTrue);
        expect(summary.containsKey('averageProcessingTimeMs'), isTrue);
        expect(summary.containsKey('totalFrames'), isTrue);
        expect(summary.containsKey('droppedFrames'), isTrue);
        expect(summary.containsKey('frameDropRate'), isTrue);
        expect(summary.containsKey('overallLevel'), isTrue);
      });
    });
  });

  group('PerformanceThresholds', () {
    test('default thresholds have correct values', () {
      const thresholds = PerformanceThresholds.defaultThresholds;

      expect(thresholds.criticalFps, equals(15.0));
      expect(thresholds.warningFps, equals(20.0));
      expect(thresholds.targetFps, equals(30.0));
      expect(thresholds.criticalProcessingTimeMs, equals(66));
      expect(thresholds.warningProcessingTimeMs, equals(50));
      expect(thresholds.targetProcessingTimeMs, equals(33));
    });

    test('custom thresholds can be created', () {
      const thresholds = PerformanceThresholds(
        criticalFps: 10.0,
        warningFps: 15.0,
        targetFps: 25.0,
      );

      expect(thresholds.criticalFps, equals(10.0));
      expect(thresholds.warningFps, equals(15.0));
      expect(thresholds.targetFps, equals(25.0));
    });
  });

  group('PerformanceMetrics', () {
    test('creates correctly with required fields', () {
      final metrics = PerformanceMetrics(
        timestamp: DateTime(2024, 1, 1),
        fps: 30.0,
        processingTimeMs: 33,
        frameDropRate: 0.01,
      );

      expect(metrics.fps, equals(30.0));
      expect(metrics.processingTimeMs, equals(33));
      expect(metrics.frameDropRate, equals(0.01));
    });

    test('copyWith creates correct copy', () {
      final original = PerformanceMetrics(
        timestamp: DateTime(2024, 1, 1),
        fps: 30.0,
        processingTimeMs: 33,
      );

      final updated = original.copyWith(
        fps: 25.0,
        memoryUsageMb: 150.0,
      );

      expect(updated.fps, equals(25.0));
      expect(updated.processingTimeMs, equals(33)); // unchanged
      expect(updated.memoryUsageMb, equals(150.0));
    });

    test('toJson creates correct format', () {
      final metrics = PerformanceMetrics(
        timestamp: DateTime(2024, 1, 1, 10, 0, 0),
        fps: 30.0,
        processingTimeMs: 33,
        frameDropRate: 0.01,
        memoryUsageMb: 150.0,
        thermalState: ThermalState.nominal,
      );

      final json = metrics.toJson();

      expect(json['fps'], equals(30.0));
      expect(json['processingTimeMs'], equals(33));
      expect(json['frameDropRate'], equals(0.01));
      expect(json['memoryUsageMb'], equals(150.0));
      expect(json['thermalState'], equals('nominal'));
    });
  });

  group('PerformanceLevel', () {
    test('enum has all expected levels', () {
      expect(PerformanceLevel.values.length, equals(4));
      expect(PerformanceLevel.optimal, isNotNull);
      expect(PerformanceLevel.acceptable, isNotNull);
      expect(PerformanceLevel.warning, isNotNull);
      expect(PerformanceLevel.critical, isNotNull);
    });

    test('levels are in correct order', () {
      expect(PerformanceLevel.optimal.index, lessThan(PerformanceLevel.acceptable.index));
      expect(PerformanceLevel.acceptable.index, lessThan(PerformanceLevel.warning.index));
      expect(PerformanceLevel.warning.index, lessThan(PerformanceLevel.critical.index));
    });
  });

  group('ThermalState', () {
    test('enum has all expected states', () {
      expect(ThermalState.values.length, equals(4));
      expect(ThermalState.nominal, isNotNull);
      expect(ThermalState.fair, isNotNull);
      expect(ThermalState.serious, isNotNull);
      expect(ThermalState.critical, isNotNull);
    });
  });

  group('PerformanceAlert', () {
    test('creates correctly with all fields', () {
      final alert = PerformanceAlert(
        type: PerformanceAlertType.lowFps,
        level: PerformanceLevel.warning,
        message: 'FPS is low',
        timestamp: DateTime(2024, 1, 1),
      );

      expect(alert.type, equals(PerformanceAlertType.lowFps));
      expect(alert.level, equals(PerformanceLevel.warning));
      expect(alert.message, equals('FPS is low'));
    });
  });

  group('PerformanceAlertType', () {
    test('enum has all expected types', () {
      expect(PerformanceAlertType.values.length, equals(6));
      expect(PerformanceAlertType.lowFps, isNotNull);
      expect(PerformanceAlertType.highProcessingTime, isNotNull);
      expect(PerformanceAlertType.highMemory, isNotNull);
      expect(PerformanceAlertType.highTemperature, isNotNull);
      expect(PerformanceAlertType.lowBattery, isNotNull);
      expect(PerformanceAlertType.frameDrops, isNotNull);
    });
  });

  group('PerformanceMonitorState', () {
    test('initial state has correct defaults', () {
      const state = PerformanceMonitorState();

      expect(state.isMonitoring, isFalse);
      expect(state.currentMetrics, isNull);
      expect(state.overallLevel, equals(PerformanceLevel.optimal));
      expect(state.alerts, isEmpty);
      expect(state.averageFps, equals(0.0));
      expect(state.averageProcessingTimeMs, equals(0));
    });

    test('copyWith creates correct copy', () {
      const original = PerformanceMonitorState(
        isMonitoring: false,
        overallLevel: PerformanceLevel.optimal,
      );

      final updated = original.copyWith(
        isMonitoring: true,
        overallLevel: PerformanceLevel.warning,
        averageFps: 25.0,
      );

      expect(updated.isMonitoring, isTrue);
      expect(updated.overallLevel, equals(PerformanceLevel.warning));
      expect(updated.averageFps, equals(25.0));
    });
  });
}
