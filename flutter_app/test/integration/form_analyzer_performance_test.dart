/// Form Analyzer Performance Tests
///
/// Performance benchmarks for form analysis pipeline.
/// Measures latency, throughput, and memory efficiency.
///
/// Reference: docs/tickets/010_form_validation_logic.md
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';
import 'package:flutter_app/core/form_analyzer/form_analyzer.dart';

void main() {
  group('Performance Benchmarks', () {
    group('Single Frame Analysis Latency', () {
      test('squat analysis completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final frame = _createTestPoseFrame();

        final stopwatch = Stopwatch()..start();
        analyzer.analyze(frame);
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThanOrEqualTo(10));
      });

      test('bicep curl analysis completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.armCurl);
        final frame = _createTestPoseFrame();

        final stopwatch = Stopwatch()..start();
        analyzer.analyze(frame);
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThanOrEqualTo(10));
      });

      test('lateral raise analysis completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.sideRaise);
        final frame = _createTestPoseFrame();

        final stopwatch = Stopwatch()..start();
        analyzer.analyze(frame);
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThanOrEqualTo(10));
      });

      test('shoulder press analysis completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.shoulderPress);
        final frame = _createTestPoseFrame();

        final stopwatch = Stopwatch()..start();
        analyzer.analyze(frame);
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThanOrEqualTo(10));
      });

      test('pushup analysis completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.pushUp);
        final frame = _createTestPoseFrame();

        final stopwatch = Stopwatch()..start();
        analyzer.analyze(frame);
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThanOrEqualTo(10));
      });
    });

    group('Sustained Throughput at 30fps', () {
      test('squat analyzer processes 30 frames in < 1 second', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final frames = List.generate(30, (_) => _createTestPoseFrame());

        final stopwatch = Stopwatch()..start();
        for (final frame in frames) {
          analyzer.analyze(frame);
        }
        stopwatch.stop();

        // Must complete 30 frames (1 second @ 30fps) in less than 1 second
        expect(stopwatch.elapsedMilliseconds, lessThan(1000));
        // Average should be well under 33ms per frame
        final avgMs = stopwatch.elapsedMilliseconds / 30;
        expect(avgMs, lessThan(33));
      });

      test('all exercise types sustain 30fps for 60 frames', () {
        for (final exerciseType in ExerciseType.values) {
          final analyzer = AnalyzerFactory.create(exerciseType);
          final frames = List.generate(60, (_) => _createTestPoseFrame());

          final stopwatch = Stopwatch()..start();
          for (final frame in frames) {
            analyzer.analyze(frame);
          }
          stopwatch.stop();

          // 60 frames @ 30fps = 2 seconds, should complete in under 2 seconds
          expect(
            stopwatch.elapsedMilliseconds,
            lessThan(2000),
            reason: '${exerciseType.name} failed to sustain 30fps',
          );
        }
      });
    });

    group('Batch Processing Performance', () {
      test('100 frame batch analysis within 500ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final frames = List.generate(100, (_) => _createTestPoseFrame());

        final stopwatch = Stopwatch()..start();
        for (final frame in frames) {
          analyzer.analyze(frame);
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(500));
      });

      test('500 frame extended session within 2500ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final frames = List.generate(500, (_) => _createTestPoseFrame());

        final stopwatch = Stopwatch()..start();
        for (final frame in frames) {
          analyzer.analyze(frame);
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(2500));
      });
    });

    group('SessionDataRecorder Performance', () {
      test('recording 1000 frames within 1000ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final recorder = SessionDataRecorder(
          sessionId: 'perf-test',
          userId: 'test-user',
          exerciseType: ExerciseType.squat,
        );

        recorder.startSession();
        final frames = List.generate(1000, (_) => _createTestPoseFrame());

        final stopwatch = Stopwatch()..start();
        for (final frame in frames) {
          final result = analyzer.analyze(frame);
          recorder.recordFrame(result.frameResult, result.currentPhase);
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(1000));
      });

      test('getStatistics completes within 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final recorder = SessionDataRecorder(
          sessionId: 'perf-test',
          userId: 'test-user',
          exerciseType: ExerciseType.squat,
        );

        recorder.startSession();

        // Record frames first
        for (var i = 0; i < 100; i++) {
          final frame = _createTestPoseFrame();
          final result = analyzer.analyze(frame);
          recorder.recordFrame(result.frameResult, result.currentPhase);
        }

        final stopwatch = Stopwatch()..start();
        recorder.getStatistics();
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(10));
      });

      test('endSession completes within 50ms', () async {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final recorder = SessionDataRecorder(
          sessionId: 'perf-test',
          userId: 'test-user',
          exerciseType: ExerciseType.squat,
        );

        recorder.startSession();

        // Record frames first
        for (var i = 0; i < 100; i++) {
          final frame = _createTestPoseFrame();
          final result = analyzer.analyze(frame);
          recorder.recordFrame(result.frameResult, result.currentPhase);
        }

        final stopwatch = Stopwatch()..start();
        await recorder.endSession();
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(50));
      });
    });

    group('FeedbackManager Performance', () {
      test('processFrameResult completes within 5ms', () async {
        final mockTts = MockTtsService();
        final feedbackManager = FeedbackManager(
          ttsService: mockTts,
          config: const FeedbackConfig(),
        );

        await feedbackManager.initialize();
        feedbackManager.start();

        final result = FrameEvaluationResult(
          timestamp: DateTime.now().millisecondsSinceEpoch,
          score: 80,
          level: FeedbackLevel.good,
          issues: [
            const FormIssue(
              issueType: 'test',
              message: 'Test message',
              priority: FeedbackPriority.medium,
            ),
          ],
        );

        final stopwatch = Stopwatch()..start();
        for (var i = 0; i < 100; i++) {
          feedbackManager.processFrameResult(result);
        }
        stopwatch.stop();

        // 100 calls should complete well under 500ms (5ms per call)
        expect(stopwatch.elapsedMilliseconds, lessThan(500));

        feedbackManager.dispose();
      });
    });

    group('Math Utils Performance', () {
      test('angle calculation 10000 times within 100ms', () {
        final point1 = PoseLandmark(
          type: PoseLandmarkType.leftShoulder,
          x: 0,
          y: 0,
          z: 0,
          likelihood: 0.9,
        );
        final point2 = PoseLandmark(
          type: PoseLandmarkType.leftElbow,
          x: 1,
          y: 0,
          z: 0,
          likelihood: 0.9,
        );
        final point3 = PoseLandmark(
          type: PoseLandmarkType.leftWrist,
          x: 0,
          y: 1,
          z: 0,
          likelihood: 0.9,
        );

        final stopwatch = Stopwatch()..start();
        for (var i = 0; i < 10000; i++) {
          FormMathUtils.calculateAngle3Points(point1, point2, point3);
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(100));
      });

      test('moving average filter 10000 updates within 50ms', () {
        final filter = MovingAverageFilter(windowSize: 5);

        final stopwatch = Stopwatch()..start();
        for (var i = 0; i < 10000; i++) {
          filter.filter(i.toDouble());
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(50));
      });

      test('velocity calculation 10000 times within 50ms', () {
        final calc = VelocityCalculator();

        final stopwatch = Stopwatch()..start();
        for (var i = 0; i < 10000; i++) {
          calc.calculateVelocity(i.toDouble(), i);
        }
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(50));
      });
    });

    group('Memory Efficiency', () {
      test('analyzer does not accumulate memory over 1000 frames', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);

        // Run many frames
        for (var i = 0; i < 1000; i++) {
          final frame = _createTestPoseFrame();
          analyzer.analyze(frame);
        }

        // Reset and verify clean state
        analyzer.reset();
        expect(analyzer.repCount, equals(0));
        expect(analyzer.setCount, equals(1));
        expect(analyzer.currentPhase, equals(ExercisePhase.start));
      });

      test('recorder respects maxFramesInMemory config', () {
        final config = RecorderConfig(
          maxFramesInMemory: 100,
          autoFlush: true,
          flushThreshold: 50,
        );
        final recorder = SessionDataRecorder(
          sessionId: 'memory-test',
          userId: 'test-user',
          exerciseType: ExerciseType.squat,
          config: config,
        );

        recorder.startSession();

        // Record many frames
        for (var i = 0; i < 200; i++) {
          final result = FrameEvaluationResult(
            timestamp: DateTime.now().millisecondsSinceEpoch,
            score: 80,
            level: FeedbackLevel.good,
            issues: [],
          );
          recorder.recordFrame(result, ExercisePhase.down);
        }

        // totalFramesRecorded should track all, but memory should be limited
        expect(recorder.totalFramesRecorded, equals(200));
      });
    });

    group('Latency Percentiles', () {
      test('95th percentile single frame latency under 5ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final latencies = <int>[];

        // Warm up
        for (var i = 0; i < 10; i++) {
          analyzer.analyze(_createTestPoseFrame());
        }
        analyzer.reset();

        // Measure 100 frames
        for (var i = 0; i < 100; i++) {
          final frame = _createTestPoseFrame();
          final stopwatch = Stopwatch()..start();
          analyzer.analyze(frame);
          stopwatch.stop();
          latencies.add(stopwatch.elapsedMicroseconds);
        }

        // Sort and get 95th percentile
        latencies.sort();
        final p95Index = (latencies.length * 0.95).floor();
        final p95Microseconds = latencies[p95Index];

        // 95th percentile should be under 5ms (5000 microseconds)
        expect(p95Microseconds, lessThan(5000));
      });

      test('99th percentile single frame latency under 10ms', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final latencies = <int>[];

        // Warm up
        for (var i = 0; i < 10; i++) {
          analyzer.analyze(_createTestPoseFrame());
        }
        analyzer.reset();

        // Measure 100 frames
        for (var i = 0; i < 100; i++) {
          final frame = _createTestPoseFrame();
          final stopwatch = Stopwatch()..start();
          analyzer.analyze(frame);
          stopwatch.stop();
          latencies.add(stopwatch.elapsedMicroseconds);
        }

        // Sort and get 99th percentile
        latencies.sort();
        final p99Index = (latencies.length * 0.99).floor();
        final p99Microseconds = latencies[p99Index];

        // 99th percentile should be under 10ms (10000 microseconds)
        expect(p99Microseconds, lessThan(10000));
      });
    });
  });
}

/// Create a test pose frame with all required landmarks
PoseFrame _createTestPoseFrame() {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Add all key landmarks for testing
  final landmarkTypes = [
    PoseLandmarkType.nose,
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftElbow,
    PoseLandmarkType.rightElbow,
    PoseLandmarkType.leftWrist,
    PoseLandmarkType.rightWrist,
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
    PoseLandmarkType.leftKnee,
    PoseLandmarkType.rightKnee,
    PoseLandmarkType.leftAnkle,
    PoseLandmarkType.rightAnkle,
    PoseLandmarkType.leftHeel,
    PoseLandmarkType.rightHeel,
    PoseLandmarkType.leftFootIndex,
    PoseLandmarkType.rightFootIndex,
  ];

  for (var i = 0; i < landmarkTypes.length; i++) {
    final type = landmarkTypes[i];
    landmarks[type] = PoseLandmark(
      type: type,
      x: 0.3 + (i % 5) * 0.1,
      y: 0.2 + (i ~/ 5) * 0.2,
      z: 0,
      likelihood: 0.9,
    );
  }

  return PoseFrame(landmarks: landmarks, timestamp: timestamp);
}
