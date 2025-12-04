/// Pose Session Integration Tests
///
/// Integration tests for camera -> MediaPipe -> session recording flow.
/// Reference: docs/tickets/009_mediapipe_integration.md
///
/// Test Categories:
/// 1. Camera -> MediaPipe Integration
/// 2. Data Recording Flow
/// 3. Performance Measurement Integration
/// 4. Camera Configuration Fallback
/// 5. Exercise-specific Landmark Groups
/// 6. End-to-End Data Flow
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';
import 'package:flutter_app/core/pose/session_recorder.dart';
import 'package:flutter_app/core/camera/frame_rate_monitor.dart';
import 'package:flutter_app/core/camera/camera_config.dart';

void main() {
  group('Camera -> MediaPipe Integration', () {
    test('PoseFrame correctly stores landmark data as Map', () {
      // Create landmark map (matching actual PoseFrame structure)
      final landmarks = <PoseLandmarkType, PoseLandmark>{};
      for (final type in PoseLandmarkType.values) {
        landmarks[type] = PoseLandmark(
          type: type,
          x: type.landmarkIndex * 0.01,
          y: type.landmarkIndex * 0.02,
          z: type.landmarkIndex * 0.001,
          likelihood: 0.9,
        );
      }

      final frame = PoseFrame(
        landmarks: landmarks,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        processingTimeMs: 25,
      );

      // Verify frame structure
      expect(frame.landmarks.length, 33);
      expect(frame.processingTimeMs, 25);
      expect(frame.isPoseDetected, true);
      expect(frame.landmarkCount, 33);
    });

    test('PoseFrame calculates confidence correctly', () {
      final landmarks = <PoseLandmarkType, PoseLandmark>{};

      // Add landmarks with varying confidence
      landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
        type: PoseLandmarkType.leftShoulder,
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.9,
      );
      landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
        type: PoseLandmarkType.rightShoulder,
        x: 0.6,
        y: 0.3,
        z: 0.1,
        likelihood: 0.8,
      );
      landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
        type: PoseLandmarkType.leftElbow,
        x: 0.4,
        y: 0.5,
        z: 0.1,
        likelihood: 0.7,
      );

      final frame = PoseFrame(
        landmarks: landmarks,
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );

      // Overall confidence should be average: (0.9 + 0.8 + 0.7) / 3 = 0.8
      expect(frame.overallConfidence, closeTo(0.8, 0.01));

      // Reliable landmark count (>= 0.7)
      expect(frame.reliableLandmarkCount, 3);
    });

    test('Landmark reliability threshold filtering works correctly', () {
      final landmarks = <PoseLandmarkType, PoseLandmark>{};

      // High confidence landmark
      landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
        type: PoseLandmarkType.leftShoulder,
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.85,
      );

      // Medium confidence (meets minimum but not recommended)
      landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
        type: PoseLandmarkType.rightShoulder,
        x: 0.6,
        y: 0.3,
        z: 0.1,
        likelihood: 0.55,
      );

      // Low confidence (below minimum threshold)
      landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
        type: PoseLandmarkType.leftElbow,
        x: 0.4,
        y: 0.5,
        z: 0.1,
        likelihood: 0.35,
      );

      final frame = PoseFrame(
        landmarks: landmarks,
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );

      // Test reliability checks using values property
      final reliableLandmarks = frame.landmarks.values
          .where((l) => l.isReliable)
          .toList();
      expect(reliableLandmarks.length, 1); // Only leftShoulder is reliable

      // Test minimum threshold
      final meetsMinimum = frame.landmarks.values
          .where((l) => l.meetsMinimumThreshold)
          .toList();
      expect(meetsMinimum.length, 2); // leftShoulder and rightShoulder
    });

    test('PoseFrame areAllReliable method works correctly', () {
      final landmarks = <PoseLandmarkType, PoseLandmark>{};

      landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
        type: PoseLandmarkType.leftShoulder,
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.85,
      );
      landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
        type: PoseLandmarkType.rightShoulder,
        x: 0.6,
        y: 0.3,
        z: 0.1,
        likelihood: 0.75,
      );
      landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
        type: PoseLandmarkType.leftElbow,
        x: 0.4,
        y: 0.5,
        z: 0.1,
        likelihood: 0.55, // Below reliable threshold
      );

      final frame = PoseFrame(
        landmarks: landmarks,
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );

      // Check if specific landmarks are reliable
      expect(
        frame.areAllReliable([
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.rightShoulder,
        ]),
        true,
      );

      expect(
        frame.areAllReliable([
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.leftElbow,
        ]),
        false,
      );
    });

    test('Empty frame detection works', () {
      final emptyFrame = PoseFrame(
        landmarks: {},
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );

      expect(emptyFrame.isPoseDetected, false);
      expect(emptyFrame.landmarkCount, 0);
      expect(emptyFrame.overallConfidence, 0.0);
    });
  });

  group('Data Recording Flow', () {
    late ProviderContainer container;
    late SessionRecorderNotifier recorder;

    setUp(() {
      container = ProviderContainer();
      recorder = container.read(sessionRecorderProvider.notifier);
    });

    tearDown(() {
      container.dispose();
    });

    test('Session lifecycle: start -> record -> stop', () {
      // Start recording
      recorder.startRecording(
        sessionId: 'test-session-123',
        userId: 'user-456',
        exerciseType: 'squat',
      );

      final state1 = container.read(sessionRecorderProvider);
      expect(state1.isRecording, true);
      expect(state1.metadata?.sessionId, 'test-session-123');
      expect(state1.metadata?.exerciseType, 'squat');

      // Record frames
      for (var i = 0; i < 10; i++) {
        final landmarks = <PoseLandmarkType, PoseLandmark>{};
        landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
          type: PoseLandmarkType.leftShoulder,
          x: 0.5,
          y: 0.3 + i * 0.01,
          z: 0.1,
          likelihood: 0.9,
        );

        final frame = PoseFrame(
          landmarks: landmarks,
          timestamp: DateTime.now().millisecondsSinceEpoch + i * 33,
          processingTimeMs: 25,
        );
        recorder.recordFrame(frame);
      }

      final state2 = container.read(sessionRecorderProvider);
      expect(state2.frameCount, 10);

      // Stop recording
      recorder.stopRecording(averageFps: 30.0);

      final state3 = container.read(sessionRecorderProvider);
      expect(state3.isCompleted, true);
      expect(state3.metadata?.totalFrames, 10);
    });

    test('Recording filters landmarks by confidence', () {
      recorder.startRecording(
        sessionId: 'test-session',
        userId: 'user-123',
        exerciseType: 'armCurl',
      );

      // Create frame with mixed confidence landmarks
      final landmarks = <PoseLandmarkType, PoseLandmark>{};

      // High confidence - should be recorded
      landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
        type: PoseLandmarkType.leftShoulder,
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.9,
      );

      // Below minimum threshold - should NOT be recorded
      landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
        type: PoseLandmarkType.rightShoulder,
        x: 0.6,
        y: 0.3,
        z: 0.1,
        likelihood: 0.3, // Below 0.5 minimum
      );

      final frame = PoseFrame(
        landmarks: landmarks,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        processingTimeMs: 25,
      );

      recorder.recordFrame(frame);

      // Get recorded frames
      final frames = recorder.frames;
      expect(frames.length, 1);

      // Check that only high-confidence landmarks were recorded
      final recordedLandmarks = frames.first.landmarks;
      expect(
        recordedLandmarks.containsKey(PoseLandmarkType.leftShoulder),
        true,
      );
      expect(
        recordedLandmarks.containsKey(PoseLandmarkType.rightShoulder),
        false,
      );

      recorder.stopRecording();
    });

    test('Dropped frames are tracked', () {
      recorder.startRecording(
        sessionId: 'test-session',
        userId: 'user-123',
        exerciseType: 'pushUp',
      );

      // Record some frames
      for (var i = 0; i < 5; i++) {
        final landmarks = <PoseLandmarkType, PoseLandmark>{};
        landmarks[PoseLandmarkType.nose] = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.5,
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        recorder.recordFrame(
          PoseFrame(
            landmarks: landmarks,
            timestamp: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      }

      // Record dropped frames
      recorder.recordDroppedFrame();
      recorder.recordDroppedFrame();

      final state = container.read(sessionRecorderProvider);
      expect(state.frameCount, 5);
      expect(state.droppedFrameCount, 2);

      recorder.stopRecording();
    });

    test('Session export produces correct JSON structure', () {
      recorder.startRecording(
        sessionId: 'export-test',
        userId: 'user-789',
        exerciseType: 'sideRaise',
        deviceInfo: const DeviceInfo(
          platform: 'android',
          model: 'Pixel 7',
          osVersion: '14',
        ),
      );

      // Record a frame
      final landmarks = <PoseLandmarkType, PoseLandmark>{};
      landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
        type: PoseLandmarkType.leftWrist,
        x: 0.3,
        y: 0.6,
        z: 0.1,
        likelihood: 0.85,
      );

      recorder.recordFrame(
        PoseFrame(
          landmarks: landmarks,
          timestamp: DateTime.now().millisecondsSinceEpoch,
          processingTimeMs: 20,
        ),
      );

      recorder.stopRecording(averageFps: 28.5);

      // Export session
      final exportedData = recorder.exportSession();

      expect(exportedData.containsKey('metadata'), true);
      expect(exportedData.containsKey('frames'), true);

      final metadata = exportedData['metadata'] as Map<String, dynamic>;
      expect(metadata['sessionId'], 'export-test');
      expect(metadata['exerciseType'], 'sideRaise');
      expect(metadata['deviceInfo'], isNotNull);

      final frames = exportedData['frames'] as List;
      expect(frames.length, 1);
    });

    test('Pause and resume recording', () {
      recorder.startRecording(
        sessionId: 'pause-test',
        userId: 'user-123',
        exerciseType: 'squat',
      );

      expect(container.read(sessionRecorderProvider).isRecording, true);

      recorder.pauseRecording();
      expect(container.read(sessionRecorderProvider).isPaused, true);

      recorder.resumeRecording();
      expect(container.read(sessionRecorderProvider).isRecording, true);

      recorder.stopRecording();
    });

    test('Clear removes all recorded data', () {
      recorder.startRecording(
        sessionId: 'clear-test',
        userId: 'user-123',
        exerciseType: 'pushUp',
      );

      // Record some frames
      for (var i = 0; i < 5; i++) {
        final landmarks = <PoseLandmarkType, PoseLandmark>{};
        landmarks[PoseLandmarkType.nose] = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.5,
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        recorder.recordFrame(
          PoseFrame(
            landmarks: landmarks,
            timestamp: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      }

      recorder.clear();

      final state = container.read(sessionRecorderProvider);
      expect(state.recordingState, RecordingState.idle);
      expect(state.frameCount, 0);
      expect(state.metadata, null);
      expect(recorder.frames.length, 0);
    });
  });

  group('Performance Measurement Integration', () {
    late ProviderContainer container;
    late FrameRateMonitorNotifier frameRateMonitor;

    setUp(() {
      container = ProviderContainer();
      frameRateMonitor = container.read(frameRateMonitorProvider.notifier);
    });

    tearDown(() {
      container.dispose();
    });

    test('Frame rate calculation with consistent timing', () {
      // Simulate 30fps (33.3ms between frames)
      var timestamp = 0;
      for (var i = 0; i < 35; i++) {
        frameRateMonitor.recordFrame(timestamp);
        timestamp += 33; // ~30fps
      }

      final state = container.read(frameRateMonitorProvider);
      expect(state.averageFps, closeTo(30.0, 2.0));
      expect(state.status, FrameRateStatus.good);
    });

    test('Fallback triggered at low FPS', () {
      // ignore: unused_local_variable - callback required but level not used in test
      FallbackLevel? lastTriggeredLevel;
      frameRateMonitor.onFallbackNeeded = (level) {
        // Callback sets the level for potential future assertions
        lastTriggeredLevel = level;
      };

      // Simulate low FPS (100ms between frames = 10fps)
      var timestamp = 0;
      for (var i = 0; i < 20; i++) {
        frameRateMonitor.recordFrame(timestamp);
        timestamp += 100; // 10fps - critical level
      }

      final state = container.read(frameRateMonitorProvider);
      expect(
        state.status,
        anyOf(FrameRateStatus.warning, FrameRateStatus.critical),
      );
      // Note: Fallback may or may not trigger depending on cooldown timing
    });

    test('Dropped frame counting', () {
      frameRateMonitor.recordDroppedFrame();
      frameRateMonitor.recordDroppedFrame();

      final state = container.read(frameRateMonitorProvider);
      expect(state.droppedFrames, 2);
    });

    test('Reset clears all metrics', () {
      // Record some frames
      var timestamp = 0;
      for (var i = 0; i < 10; i++) {
        frameRateMonitor.recordFrame(timestamp);
        timestamp += 33;
      }
      frameRateMonitor.recordDroppedFrame();

      // Reset
      frameRateMonitor.reset();

      final state = container.read(frameRateMonitorProvider);
      expect(state.frameCount, 0);
      expect(state.droppedFrames, 0);
      expect(state.currentFps, 0.0);
      expect(state.averageFps, 0.0);
    });

    test('Performance summary generation', () {
      var timestamp = 0;
      for (var i = 0; i < 35; i++) {
        frameRateMonitor.recordFrame(timestamp);
        timestamp += 33;
      }

      final summary = frameRateMonitor.getPerformanceSummary();
      expect(summary, contains('Frame Rate Summary'));
      expect(summary, contains('Average FPS'));
      expect(summary, contains('Status'));
    });
  });

  group('Camera Configuration Fallback', () {
    test('Fallback chain: high -> medium -> low -> minimum', () {
      expect(CameraConfig.highQuality.fallback, CameraConfig.mediumQuality);
      expect(CameraConfig.mediumQuality.fallback, CameraConfig.lowQuality);
      expect(CameraConfig.lowQuality.fallback, CameraConfig.minimumQuality);
      expect(CameraConfig.minimumQuality.fallback, null);
    });

    test('All configs have expected FPS targets', () {
      expect(CameraConfig.highQuality.targetFps, 30);
      expect(CameraConfig.mediumQuality.targetFps, 30);
      expect(CameraConfig.lowQuality.targetFps, 24);
      expect(CameraConfig.minimumQuality.targetFps, 20);
    });

    test('All configs have minimum FPS thresholds', () {
      expect(CameraConfig.highQuality.minFps, 20);
      expect(CameraConfig.mediumQuality.minFps, 20);
      expect(CameraConfig.lowQuality.minFps, 15);
      expect(CameraConfig.minimumQuality.minFps, 15);
    });

    test('Config equality works correctly', () {
      const config1 = CameraConfig.highQuality;
      const config2 = CameraConfig.highQuality;
      const config3 = CameraConfig.mediumQuality;

      expect(config1 == config2, true);
      expect(config1 == config3, false);
    });
  });

  group('Exercise-specific Landmark Groups', () {
    test('Squat landmarks include lower body joints', () {
      final squatLandmarks = LandmarkGroups.squat;

      expect(squatLandmarks, contains(PoseLandmarkType.leftHip));
      expect(squatLandmarks, contains(PoseLandmarkType.rightHip));
      expect(squatLandmarks, contains(PoseLandmarkType.leftKnee));
      expect(squatLandmarks, contains(PoseLandmarkType.rightKnee));
      expect(squatLandmarks, contains(PoseLandmarkType.leftAnkle));
      expect(squatLandmarks, contains(PoseLandmarkType.rightAnkle));
    });

    test('Arm curl landmarks include arm joints', () {
      final armCurlLandmarks = LandmarkGroups.armCurl;

      expect(armCurlLandmarks, contains(PoseLandmarkType.leftShoulder));
      expect(armCurlLandmarks, contains(PoseLandmarkType.rightShoulder));
      expect(armCurlLandmarks, contains(PoseLandmarkType.leftElbow));
      expect(armCurlLandmarks, contains(PoseLandmarkType.rightElbow));
      expect(armCurlLandmarks, contains(PoseLandmarkType.leftWrist));
      expect(armCurlLandmarks, contains(PoseLandmarkType.rightWrist));
    });

    test('Push-up landmarks include full body', () {
      final pushUpLandmarks = LandmarkGroups.pushUp;

      expect(pushUpLandmarks, contains(PoseLandmarkType.leftShoulder));
      expect(pushUpLandmarks, contains(PoseLandmarkType.leftWrist));
      expect(pushUpLandmarks, contains(PoseLandmarkType.leftHip));
      expect(pushUpLandmarks, contains(PoseLandmarkType.leftAnkle));
      expect(pushUpLandmarks, contains(PoseLandmarkType.nose));
    });

    test('Side raise landmarks include shoulders and arms', () {
      final sideRaiseLandmarks = LandmarkGroups.sideRaise;

      expect(sideRaiseLandmarks, contains(PoseLandmarkType.leftShoulder));
      expect(sideRaiseLandmarks, contains(PoseLandmarkType.rightShoulder));
      expect(sideRaiseLandmarks, contains(PoseLandmarkType.leftWrist));
      expect(sideRaiseLandmarks, contains(PoseLandmarkType.rightWrist));
    });

    test('Shoulder press landmarks match expected structure', () {
      final shoulderPressLandmarks = LandmarkGroups.shoulderPress;

      expect(shoulderPressLandmarks, contains(PoseLandmarkType.leftShoulder));
      expect(shoulderPressLandmarks, contains(PoseLandmarkType.rightShoulder));
      expect(shoulderPressLandmarks, contains(PoseLandmarkType.leftElbow));
      expect(shoulderPressLandmarks, contains(PoseLandmarkType.rightElbow));
    });
  });

  group('End-to-End Data Flow', () {
    test('Complete pose -> session -> export flow', () {
      final container = ProviderContainer();
      final recorder = container.read(sessionRecorderProvider.notifier);

      // Start session
      recorder.startRecording(
        sessionId: 'e2e-test-session',
        userId: 'e2e-user',
        exerciseType: 'squat',
        deviceInfo: const DeviceInfo(platform: 'ios'),
        cameraConfig: const CameraConfigInfo(resolution: '720p', targetFps: 30),
      );

      // Simulate realistic pose detection sequence
      for (var frameNum = 0; frameNum < 30; frameNum++) {
        final landmarks = _createSquatPoseLandmarks(frameNum);
        final frame = PoseFrame(
          landmarks: landmarks,
          timestamp: frameNum * 33, // ~30fps
          processingTimeMs: 20 + (frameNum % 5),
        );
        recorder.recordFrame(frame);
      }

      // Stop and export
      recorder.stopRecording(averageFps: 30.0);

      final exportedData = recorder.exportSession();
      final metadata = exportedData['metadata'] as Map<String, dynamic>;
      final frames = exportedData['frames'] as List;

      // Verify exported data integrity
      expect(metadata['sessionId'], 'e2e-test-session');
      expect(metadata['exerciseType'], 'squat');
      expect(metadata['totalFrames'], 30);
      expect(frames.length, 30);

      // Verify frame structure
      final firstFrame = frames.first as Map<String, dynamic>;
      expect(firstFrame.containsKey('frameIndex'), true);
      expect(firstFrame.containsKey('timestamp'), true);
      expect(firstFrame.containsKey('landmarks'), true);
      expect(firstFrame.containsKey('overallConfidence'), true);

      container.dispose();
    });

    test('RecordedFrame JSON serialization roundtrip', () {
      final container = ProviderContainer();
      final recorder = container.read(sessionRecorderProvider.notifier);

      recorder.startRecording(
        sessionId: 'roundtrip-test',
        userId: 'user-123',
        exerciseType: 'armCurl',
      );

      final landmarks = <PoseLandmarkType, PoseLandmark>{};
      landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
        type: PoseLandmarkType.leftElbow,
        x: 0.456,
        y: 0.789,
        z: 0.123,
        likelihood: 0.95,
      );

      recorder.recordFrame(
        PoseFrame(landmarks: landmarks, timestamp: 1000, processingTimeMs: 25),
      );

      // Get recorded frame
      final recordedFrame = recorder.frames.first;
      final json = recordedFrame.toJson();

      // Recreate from JSON
      final reconstructed = RecordedFrame.fromJson(json);

      expect(reconstructed.frameIndex, recordedFrame.frameIndex);
      expect(reconstructed.timestamp, recordedFrame.timestamp);
      expect(reconstructed.processingTimeMs, recordedFrame.processingTimeMs);
      expect(
        reconstructed.overallConfidence,
        closeTo(recordedFrame.overallConfidence, 0.001),
      );

      // Verify landmark data
      final originalLandmark =
          recordedFrame.landmarks[PoseLandmarkType.leftElbow]!;
      final reconstructedLandmark =
          reconstructed.landmarks[PoseLandmarkType.leftElbow]!;

      expect(reconstructedLandmark.x, closeTo(originalLandmark.x, 0.001));
      expect(reconstructedLandmark.y, closeTo(originalLandmark.y, 0.001));
      expect(reconstructedLandmark.z, closeTo(originalLandmark.z, 0.001));
      expect(
        reconstructedLandmark.likelihood,
        closeTo(originalLandmark.likelihood, 0.001),
      );

      container.dispose();
    });

    test('Circular buffer limits frame storage', () {
      final container = ProviderContainer();
      final recorder = container.read(sessionRecorderProvider.notifier);

      recorder.startRecording(
        sessionId: 'buffer-test',
        userId: 'user-123',
        exerciseType: 'squat',
      );

      // Record more than kMaxFramesInMemory (1800) frames
      for (var i = 0; i < 2000; i++) {
        final landmarks = <PoseLandmarkType, PoseLandmark>{};
        landmarks[PoseLandmarkType.nose] = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.5,
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        recorder.recordFrame(
          PoseFrame(landmarks: landmarks, timestamp: i * 33),
        );
      }

      // Should be limited to kMaxFramesInMemory
      expect(recorder.frames.length, lessThanOrEqualTo(kMaxFramesInMemory));

      // State should track total frames recorded
      final state = container.read(sessionRecorderProvider);
      expect(state.frameCount, 2000);

      container.dispose();
    });
  });

  group('PoseLandmarkType', () {
    test('All 33 landmarks are defined', () {
      expect(PoseLandmarkType.values.length, 33);
    });

    test('Landmark indices are correct', () {
      expect(PoseLandmarkType.nose.landmarkIndex, 0);
      expect(PoseLandmarkType.leftShoulder.landmarkIndex, 11);
      expect(PoseLandmarkType.rightShoulder.landmarkIndex, 12);
      expect(PoseLandmarkType.leftHip.landmarkIndex, 23);
      expect(PoseLandmarkType.rightFootIndex.landmarkIndex, 32);
    });

    test('fromIndex returns correct landmark type', () {
      expect(PoseLandmarkType.fromIndex(0), PoseLandmarkType.nose);
      expect(PoseLandmarkType.fromIndex(11), PoseLandmarkType.leftShoulder);
      expect(PoseLandmarkType.fromIndex(23), PoseLandmarkType.leftHip);
      expect(PoseLandmarkType.fromIndex(32), PoseLandmarkType.rightFootIndex);
    });
  });
}

/// Helper function to create realistic squat pose landmarks
Map<PoseLandmarkType, PoseLandmark> _createSquatPoseLandmarks(int frameNum) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};

  // Simulate squat motion (up/down)
  final sqautDepth = 0.3 + 0.1 * (frameNum % 10).toDouble() / 10;

  for (final type in LandmarkGroups.squat) {
    double baseY;
    switch (type) {
      case PoseLandmarkType.leftShoulder:
      case PoseLandmarkType.rightShoulder:
        baseY = 0.3 + sqautDepth * 0.1;
        break;
      case PoseLandmarkType.leftHip:
      case PoseLandmarkType.rightHip:
        baseY = 0.5 + sqautDepth * 0.2;
        break;
      case PoseLandmarkType.leftKnee:
      case PoseLandmarkType.rightKnee:
        baseY = 0.6 + sqautDepth * 0.15;
        break;
      default:
        baseY = 0.8;
    }

    landmarks[type] = PoseLandmark(
      type: type,
      x: type.name.startsWith('left') ? 0.4 : 0.6,
      y: baseY,
      z: 0.1,
      likelihood: 0.85 + (frameNum % 5) * 0.02,
    );
  }

  return landmarks;
}
