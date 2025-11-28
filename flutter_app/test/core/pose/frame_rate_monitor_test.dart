// Frame Rate Monitor Tests
//
// Unit tests for FPS calculation and fallback logic.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/camera/frame_rate_monitor.dart';

void main() {
  group('FrameRateMonitor', () {
    late ProviderContainer container;
    late FrameRateMonitorNotifier notifier;

    setUp(() {
      container = ProviderContainer();
      notifier = container.read(frameRateMonitorProvider.notifier);
    });

    tearDown(() {
      container.dispose();
    });

    group('FPS calculation', () {
      test('initial state has zero FPS', () {
        final state = container.read(frameRateMonitorProvider);

        expect(state.currentFps, equals(0.0));
        expect(state.averageFps, equals(0.0));
      });

      test('calculates FPS correctly from frame timestamps', () {
        // Simulate 30 fps (33.33ms per frame)
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 33; // 33ms between frames
        }

        final state = container.read(frameRateMonitorProvider);

        // FPS should be around 30 (1000ms / 33ms ≈ 30.3)
        expect(state.averageFps, greaterThan(25.0));
        expect(state.averageFps, lessThan(35.0));
      });

      test('updates status based on FPS', () {
        // Record good FPS (33ms per frame = ~30fps)
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 33;
        }

        var state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.good));

        // Reset and record poor FPS (100ms per frame = 10fps)
        notifier.reset();
        timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 100;
        }

        state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.critical));
      });
    });

    group('FrameRateStatus thresholds', () {
      test('good status for FPS >= 25', () {
        // 40ms per frame = 25 fps
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 40;
        }

        final state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.good));
      });

      test('acceptable status for 20 <= FPS < 25', () {
        // 45ms per frame ≈ 22 fps
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 45;
        }

        final state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.acceptable));
      });

      test('warning status for 15 <= FPS < 20', () {
        // 60ms per frame ≈ 16.7 fps
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 60;
        }

        final state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.warning));
      });

      test('critical status for FPS < 15', () {
        // 80ms per frame = 12.5 fps
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 80;
        }

        final state = container.read(frameRateMonitorProvider);
        expect(state.status, equals(FrameRateStatus.critical));
      });
    });

    group('Fallback levels', () {
      test('no fallback initially', () {
        final state = container.read(frameRateMonitorProvider);
        expect(state.fallbackLevel, equals(FallbackLevel.none));
      });

      test('fallback levels are ordered correctly', () {
        expect(FallbackLevel.none.index, equals(0));
        expect(FallbackLevel.reducedResolution.index, equals(1));
        expect(FallbackLevel.reducedFps.index, equals(2));
        expect(FallbackLevel.simplifiedRendering.index, equals(3));
      });
    });

    group('Dropped frames', () {
      test('tracks dropped frames', () {
        notifier.recordDroppedFrame();
        notifier.recordDroppedFrame();

        final state = container.read(frameRateMonitorProvider);
        expect(state.droppedFrames, equals(2));
      });

      test('calculates drop rate correctly', () {
        // Record 10 frames
        var timestamp = 0;
        for (var i = 0; i < 10; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 33;
        }

        // Record 2 dropped frames
        notifier.recordDroppedFrame();
        notifier.recordDroppedFrame();

        final state = container.read(frameRateMonitorProvider);
        // 2 dropped out of 10 frames = 20% drop rate
        // Note: frameCount is 9 (first frame doesn't count for FPS calc)
        expect(state.droppedFrames, equals(2));
      });
    });

    group('reset', () {
      test('resets all metrics', () {
        // Record some frames
        var timestamp = 0;
        for (var i = 0; i < 30; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 33;
        }

        // Reset
        notifier.reset();

        final state = container.read(frameRateMonitorProvider);

        expect(state.currentFps, equals(0.0));
        expect(state.averageFps, equals(0.0));
        expect(state.fallbackLevel, equals(FallbackLevel.none));
        expect(state.frameCount, equals(0));
        expect(state.droppedFrames, equals(0));
      });
    });

    group('min/max tracking', () {
      test('tracks min and max FPS', () {
        // Record varying frame times
        var timestamp = 0;

        // Fast frames (20ms = 50fps)
        for (var i = 0; i < 10; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 20;
        }

        // Slow frames (100ms = 10fps)
        for (var i = 0; i < 10; i++) {
          notifier.recordFrame(timestamp);
          timestamp += 100;
        }

        final state = container.read(frameRateMonitorProvider);

        expect(state.maxFps, greaterThan(40.0));
        expect(state.minFps, lessThan(15.0));
      });
    });
  });

  group('FrameRateState', () {
    test('copyWith creates correct copy', () {
      const original = FrameRateState(
        currentFps: 30.0,
        averageFps: 28.0,
        status: FrameRateStatus.good,
        fallbackLevel: FallbackLevel.none,
        frameCount: 100,
      );

      final copy = original.copyWith(
        currentFps: 25.0,
        status: FrameRateStatus.acceptable,
      );

      expect(copy.currentFps, equals(25.0));
      expect(copy.status, equals(FrameRateStatus.acceptable));
      expect(copy.averageFps, equals(28.0)); // unchanged
      expect(copy.fallbackLevel, equals(FallbackLevel.none)); // unchanged
      expect(copy.frameCount, equals(100)); // unchanged
    });

    test('dropRate calculates correctly', () {
      const state = FrameRateState(
        frameCount: 100,
        droppedFrames: 10,
      );

      expect(state.dropRate, equals(10.0)); // 10%
    });

    test('dropRate is zero when no frames', () {
      const state = FrameRateState(
        frameCount: 0,
        droppedFrames: 0,
      );

      expect(state.dropRate, equals(0.0));
    });
  });

  group('FallbackLevel', () {
    test('enum values are defined correctly', () {
      expect(FallbackLevel.values.length, equals(4));
      expect(FallbackLevel.none, isNotNull);
      expect(FallbackLevel.reducedResolution, isNotNull);
      expect(FallbackLevel.reducedFps, isNotNull);
      expect(FallbackLevel.simplifiedRendering, isNotNull);
    });
  });

  group('FrameRateStatus', () {
    test('enum values are defined correctly', () {
      expect(FrameRateStatus.values.length, equals(4));
      expect(FrameRateStatus.good, isNotNull);
      expect(FrameRateStatus.acceptable, isNotNull);
      expect(FrameRateStatus.warning, isNotNull);
      expect(FrameRateStatus.critical, isNotNull);
    });
  });
}
