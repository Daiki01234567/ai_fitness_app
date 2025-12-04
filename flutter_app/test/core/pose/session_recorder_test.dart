// Session Recorder Tests
//
// Unit tests for pose data recording functionality.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';
import 'package:flutter_app/core/pose/session_recorder.dart';

void main() {
  group('SessionRecorder', () {
    late ProviderContainer container;
    late SessionRecorderNotifier recorder;

    setUp(() {
      container = ProviderContainer();
      recorder = container.read(sessionRecorderProvider.notifier);
    });

    tearDown(() {
      container.dispose();
    });

    group('Recording lifecycle', () {
      test('initial state is idle', () {
        final state = container.read(sessionRecorderProvider);

        expect(state.recordingState, equals(RecordingState.idle));
        expect(state.metadata, isNull);
        expect(state.frameCount, equals(0));
      });

      test('startRecording transitions to recording state', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        final state = container.read(sessionRecorderProvider);

        expect(state.isRecording, isTrue);
        expect(state.metadata, isNotNull);
        expect(state.metadata!.sessionId, equals('test-session'));
        expect(state.metadata!.userId, equals('test-user'));
        expect(state.metadata!.exerciseType, equals('squat'));
      });

      test('pauseRecording transitions to paused state', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );
        recorder.pauseRecording();

        final state = container.read(sessionRecorderProvider);

        expect(state.isPaused, isTrue);
        expect(state.isRecording, isFalse);
      });

      test('resumeRecording transitions back to recording', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );
        recorder.pauseRecording();
        recorder.resumeRecording();

        final state = container.read(sessionRecorderProvider);

        expect(state.isRecording, isTrue);
        expect(state.isPaused, isFalse);
      });

      test('stopRecording transitions to completed state', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );
        recorder.stopRecording(averageFps: 30.0);

        final state = container.read(sessionRecorderProvider);

        expect(state.isCompleted, isTrue);
        expect(state.metadata!.averageFps, equals(30.0));
        expect(state.metadata!.endTime, isNotNull);
      });

      test('clear resets all state', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );
        recorder.clear();

        final state = container.read(sessionRecorderProvider);

        expect(state.recordingState, equals(RecordingState.idle));
        expect(state.metadata, isNull);
        expect(state.frameCount, equals(0));
      });
    });

    group('Frame recording', () {
      test('records frames when recording', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        final frame = _createTestFrame();
        recorder.recordFrame(frame);

        final state = container.read(sessionRecorderProvider);

        expect(state.frameCount, equals(1));
        expect(recorder.frames.length, equals(1));
      });

      test('does not record frames when not recording', () {
        final frame = _createTestFrame();
        recorder.recordFrame(frame);

        final state = container.read(sessionRecorderProvider);

        expect(state.frameCount, equals(0));
        expect(recorder.frames.length, equals(0));
      });

      test('tracks dropped frames', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        recorder.recordDroppedFrame();
        recorder.recordDroppedFrame();

        final state = container.read(sessionRecorderProvider);

        expect(state.droppedFrameCount, equals(2));
      });

      test('only stores landmarks meeting threshold', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.nose: PoseLandmark(
              type: PoseLandmarkType.nose,
              x: 0.5,
              y: 0.5,
              z: 0.0,
              likelihood: 0.8, // Above threshold
            ),
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.4,
              y: 0.6,
              z: 0.0,
              likelihood: 0.3, // Below threshold
            ),
          },
          timestamp: 0,
          processingTimeMs: 33,
        );

        recorder.recordFrame(frame);

        final recordedFrame = recorder.frames.first;

        // Only the nose landmark should be stored
        expect(recordedFrame.landmarks.length, equals(1));
        expect(
          recordedFrame.landmarks.containsKey(PoseLandmarkType.nose),
          isTrue,
        );
        expect(
          recordedFrame.landmarks.containsKey(PoseLandmarkType.leftShoulder),
          isFalse,
        );
      });
    });

    group('Frame retrieval', () {
      test('getLatestFrames returns correct number of frames', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        for (var i = 0; i < 10; i++) {
          recorder.recordFrame(_createTestFrame());
        }

        final latestFrames = recorder.getLatestFrames(5);

        expect(latestFrames.length, equals(5));
      });

      test('getLatestFrames returns all frames if count exceeds total', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        for (var i = 0; i < 3; i++) {
          recorder.recordFrame(_createTestFrame());
        }

        final latestFrames = recorder.getLatestFrames(10);

        expect(latestFrames.length, equals(3));
      });
    });

    group('Export', () {
      test('exportSession returns valid data', () {
        recorder.startRecording(
          sessionId: 'test-session',
          userId: 'test-user',
          exerciseType: 'squat',
        );

        recorder.recordFrame(_createTestFrame());
        recorder.stopRecording(averageFps: 30.0);

        final exported = recorder.exportSession();

        expect(exported.containsKey('metadata'), isTrue);
        expect(exported.containsKey('frames'), isTrue);
        expect((exported['frames'] as List).length, equals(1));
      });

      test('exportSession throws when no metadata', () {
        expect(() => recorder.exportSession(), throwsStateError);
      });
    });
  });

  group('RecordedFrame', () {
    test('toJson and fromJson roundtrip', () {
      final original = RecordedFrame(
        frameIndex: 42,
        timestamp: 1000,
        landmarks: {
          PoseLandmarkType.nose: RecordedLandmark(
            x: 0.5,
            y: 0.3,
            z: 0.1,
            likelihood: 0.9,
          ),
        },
        processingTimeMs: 33,
        overallConfidence: 0.85,
      );

      final json = original.toJson();
      final restored = RecordedFrame.fromJson(json);

      expect(restored.frameIndex, equals(original.frameIndex));
      expect(restored.timestamp, equals(original.timestamp));
      expect(restored.processingTimeMs, equals(original.processingTimeMs));
      expect(restored.overallConfidence, equals(original.overallConfidence));
      expect(restored.landmarks.length, equals(original.landmarks.length));
    });
  });

  group('RecordedLandmark', () {
    test('toJson creates correct format', () {
      const landmark = RecordedLandmark(
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.9,
      );

      final json = landmark.toJson();

      expect(json['x'], equals(0.5));
      expect(json['y'], equals(0.3));
      expect(json['z'], equals(0.1));
      expect(json['l'], equals(0.9));
    });

    test('fromPoseLandmark creates correct instance', () {
      final poseLandmark = PoseLandmark(
        type: PoseLandmarkType.nose,
        x: 0.5,
        y: 0.3,
        z: 0.1,
        likelihood: 0.9,
      );

      final recorded = RecordedLandmark.fromPoseLandmark(poseLandmark);

      expect(recorded.x, equals(poseLandmark.x));
      expect(recorded.y, equals(poseLandmark.y));
      expect(recorded.z, equals(poseLandmark.z));
      expect(recorded.likelihood, equals(poseLandmark.likelihood));
    });
  });

  group('SessionMetadata', () {
    test('copyWith creates correct copy', () {
      final original = SessionMetadata(
        sessionId: 'test-session',
        userId: 'test-user',
        exerciseType: 'squat',
        startTime: DateTime(2024, 1, 1, 10, 0),
      );

      final endTime = DateTime(2024, 1, 1, 10, 30);
      final updated = original.copyWith(
        endTime: endTime,
        averageFps: 29.5,
        totalFrames: 53100,
        droppedFrames: 50,
      );

      expect(updated.sessionId, equals('test-session'));
      expect(updated.endTime, equals(endTime));
      expect(updated.averageFps, equals(29.5));
      expect(updated.totalFrames, equals(53100));
      expect(updated.droppedFrames, equals(50));
    });

    test('durationMs calculates correctly', () {
      final metadata = SessionMetadata(
        sessionId: 'test-session',
        userId: 'test-user',
        exerciseType: 'squat',
        startTime: DateTime(2024, 1, 1, 10, 0, 0),
        endTime: DateTime(2024, 1, 1, 10, 0, 30),
      );

      expect(metadata.durationMs, equals(30000)); // 30 seconds
    });

    test('durationMs returns null without endTime', () {
      final metadata = SessionMetadata(
        sessionId: 'test-session',
        userId: 'test-user',
        exerciseType: 'squat',
        startTime: DateTime(2024, 1, 1, 10, 0),
      );

      expect(metadata.durationMs, isNull);
    });
  });
}

/// Helper function to create a test pose frame
PoseFrame _createTestFrame() {
  return PoseFrame(
    landmarks: {
      PoseLandmarkType.nose: PoseLandmark(
        type: PoseLandmarkType.nose,
        x: 0.5,
        y: 0.3,
        z: 0.0,
        likelihood: 0.9,
      ),
      PoseLandmarkType.leftShoulder: PoseLandmark(
        type: PoseLandmarkType.leftShoulder,
        x: 0.4,
        y: 0.5,
        z: 0.0,
        likelihood: 0.85,
      ),
      PoseLandmarkType.rightShoulder: PoseLandmark(
        type: PoseLandmarkType.rightShoulder,
        x: 0.6,
        y: 0.5,
        z: 0.0,
        likelihood: 0.85,
      ),
    },
    timestamp: DateTime.now().millisecondsSinceEpoch,
    processingTimeMs: 33,
  );
}
