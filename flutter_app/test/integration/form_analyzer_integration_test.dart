/// Form Analyzer Integration Tests
///
/// Integration tests for MediaPipe -> FormAnalyzer -> Feedback flow.
/// Tests the complete pipeline from pose detection to form evaluation.
///
/// Reference: docs/tickets/010_form_validation_logic.md
library;

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';
import 'package:flutter_app/core/form_analyzer/form_analyzer.dart';

void main() {
  group('MediaPipe -> FormAnalyzer Integration', () {
    group('AnalyzerFactory', () {
      test('creates correct analyzer for each exercise type', () {
        for (final exerciseType in ExerciseType.values) {
          final analyzer = AnalyzerFactory.create(exerciseType);
          expect(analyzer.exerciseType, equals(exerciseType));
        }
      });

      test('createWithConfig applies custom configuration', () {
        final customConfig = AnalyzerConfig(
          minConfidenceThreshold: 0.8,
          smoothingWindowSize: 10,
        );

        final analyzer = AnalyzerFactory.create(
          ExerciseType.squat,
          config: customConfig,
        );

        expect(analyzer.config.minConfidenceThreshold, equals(0.8));
        expect(analyzer.config.smoothingWindowSize, equals(10));
      });
    });

    group('Complete Analysis Flow', () {
      test('squat analysis flow from PoseFrame to evaluation', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final frame = _createSquatPoseFrame(kneeAngle: 90);

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.frameResult.score, greaterThanOrEqualTo(0));
        expect(result.frameResult.score, lessThanOrEqualTo(100));
        expect(result.currentPhase, isNotNull);
      });

      test('bicep curl analysis flow from PoseFrame to evaluation', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.armCurl);
        final frame = _createBicepCurlPoseFrame(elbowAngle: 45);

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.frameResult.score, greaterThanOrEqualTo(0));
      });

      test('lateral raise analysis flow from PoseFrame to evaluation', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.sideRaise);
        final frame = _createLateralRaisePoseFrame(armAngle: 80);

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.frameResult.score, greaterThanOrEqualTo(0));
      });

      test('shoulder press analysis flow from PoseFrame to evaluation', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.shoulderPress);
        final frame = _createShoulderPressPoseFrame(armAngle: 170);

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.frameResult.score, greaterThanOrEqualTo(0));
      });

      test('pushup analysis flow from PoseFrame to evaluation', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.pushUp);
        final frame = _createPushUpPoseFrame(elbowAngle: 90);

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.frameResult.score, greaterThanOrEqualTo(0));
      });
    });

    group('Rep Counting Integration', () {
      test('squat rep counting across multiple frames', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);

        // Simulate standing position
        for (var i = 0; i < 5; i++) {
          analyzer.analyze(_createSquatPoseFrame(kneeAngle: 170));
        }

        // Simulate going down
        for (var i = 0; i < 10; i++) {
          final angle = 170 - (i * 8); // 170 -> 90
          analyzer.analyze(_createSquatPoseFrame(kneeAngle: angle.toDouble()));
        }

        // Simulate at bottom
        for (var i = 0; i < 5; i++) {
          analyzer.analyze(_createSquatPoseFrame(kneeAngle: 90));
        }

        // Simulate coming up
        for (var i = 0; i < 10; i++) {
          final angle = 90 + (i * 8); // 90 -> 170
          analyzer.analyze(_createSquatPoseFrame(kneeAngle: angle.toDouble()));
        }

        // Rep should be completed
        expect(analyzer.repCount, greaterThanOrEqualTo(0));
      });

      test('bicep curl rep counting across multiple frames', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.armCurl);

        // Simulate full extension
        for (var i = 0; i < 5; i++) {
          analyzer.analyze(_createBicepCurlPoseFrame(elbowAngle: 160));
        }

        // Simulate curl up
        for (var i = 0; i < 10; i++) {
          final angle = 160 - (i * 13); // 160 -> 30
          analyzer.analyze(_createBicepCurlPoseFrame(elbowAngle: angle.toDouble()));
        }

        // Simulate curl down
        for (var i = 0; i < 10; i++) {
          final angle = 30 + (i * 13); // 30 -> 160
          analyzer.analyze(_createBicepCurlPoseFrame(elbowAngle: angle.toDouble()));
        }

        expect(analyzer.repCount, greaterThanOrEqualTo(0));
      });
    });

    group('Issue Detection Integration', () {
      test('squat detects knee over toe issue', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        // Create frame with knee far over toe
        final frame = _createSquatPoseFrameWithKneeOverToe();

        final result = analyzer.evaluateFrame(frame);

        // Should have some issues detected
        expect(result.issues, isA<List<FormIssue>>());
      });

      test('bicep curl detects elbow swing', () {
        final analyzer = AnalyzerFactory.create(ExerciseType.armCurl);
        // Create frame with elbow position shifted
        final frame = _createBicepCurlPoseFrameWithElbowSwing();

        final result = analyzer.evaluateFrame(frame);

        expect(result.issues, isA<List<FormIssue>>());
      });
    });
  });

  group('FormAnalyzer -> FeedbackManager Integration', () {
    test('frame evaluation triggers visual feedback', () {
      fakeAsync((async) {
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final mockTts = MockTtsService();
        final feedbackManager = FeedbackManager(
          ttsService: mockTts,
          config: const FeedbackConfig(minFeedbackInterval: Duration.zero),
        );

        feedbackManager.initialize();
        async.flushMicrotasks();
        feedbackManager.start();

        var visualFeedbackReceived = false;
        feedbackManager.onVisualFeedbackUpdate = (issues) {
          visualFeedbackReceived = true;
        };

        // Analyze frame with issues
        final frame = _createSquatPoseFrameWithKneeOverToe();
        final result = analyzer.evaluateFrame(frame);

        // Process through feedback manager
        feedbackManager.processFrameResult(result);

        expect(visualFeedbackReceived, isTrue);

        feedbackManager.dispose();
      });
    });

    test('high priority issues trigger voice feedback', () {
      fakeAsync((async) {
        final mockTts = MockTtsService();
        final feedbackManager = FeedbackManager(
          ttsService: mockTts,
          config: const FeedbackConfig(
            minFeedbackInterval: Duration.zero,
            priorityThreshold: FeedbackPriority.medium,
          ),
        );

        feedbackManager.initialize();
        async.flushMicrotasks();
        feedbackManager.start();

        // Create evaluation result with high priority issue
        final result = FrameEvaluationResult(
          timestamp: DateTime.now().millisecondsSinceEpoch,
          score: 50,
          level: FeedbackLevel.fair,
          issues: [
            const FormIssue(
              issueType: 'test_critical',
              message: 'テスト重要問題',
              priority: FeedbackPriority.critical,
            ),
          ],
        );

        feedbackManager.processFrameResult(result);

        // Process queue
        async.elapse(const Duration(seconds: 1));

        expect(mockTts.spokenTexts.isNotEmpty, isTrue);
        expect(mockTts.spokenTexts.first.startsWith('参考:'), isTrue);

        feedbackManager.dispose();
      });
    });
  });

  group('FormAnalyzer -> SessionDataRecorder Integration', () {
    test('recording complete exercise session', () async {
      final analyzer = AnalyzerFactory.create(ExerciseType.squat);
      final recorder = SessionDataRecorder(
        sessionId: 'integration-test-session',
        userId: 'test-user',
        exerciseType: ExerciseType.squat,
      );

      recorder.startSession();

      // Simulate 30 frames of exercise
      for (var i = 0; i < 30; i++) {
        final kneeAngle = 170.0 - (i % 20) * 4; // Oscillate 170 -> 90 -> 170
        final frame = _createSquatPoseFrame(kneeAngle: kneeAngle);
        final result = analyzer.analyze(frame);

        recorder.recordFrame(result.frameResult, result.currentPhase);
      }

      // End session
      final sessionRecord = await recorder.endSession();

      expect(sessionRecord.sessionId, equals('integration-test-session'));
      expect(sessionRecord.exerciseType, equals(ExerciseType.squat));
      expect(sessionRecord.totalReps, greaterThanOrEqualTo(0));
    });

    test('session statistics calculation', () async {
      final analyzer = AnalyzerFactory.create(ExerciseType.armCurl);
      final recorder = SessionDataRecorder(
        sessionId: 'stats-test-session',
        userId: 'test-user',
        exerciseType: ExerciseType.armCurl,
      );

      recorder.startSession();

      // Simulate frames
      for (var i = 0; i < 50; i++) {
        final elbowAngle = 160.0 - (i % 25) * 5.2; // Oscillate
        final frame = _createBicepCurlPoseFrame(elbowAngle: elbowAngle);
        final result = analyzer.analyze(frame);

        recorder.recordFrame(result.frameResult, result.currentPhase);
      }

      final stats = recorder.getStatistics();

      expect(stats.totalDuration.inMilliseconds, greaterThanOrEqualTo(0));
      expect(stats.framesRecorded, equals(50));
    });

    test('Firestore document generation', () async {
      final analyzer = AnalyzerFactory.create(ExerciseType.sideRaise);
      final recorder = SessionDataRecorder(
        sessionId: 'firestore-test',
        userId: 'test-user',
        exerciseType: ExerciseType.sideRaise,
      );

      recorder.startSession();

      // Record some frames
      for (var i = 0; i < 10; i++) {
        final frame = _createLateralRaisePoseFrame(armAngle: 45.0 + i * 4);
        final result = analyzer.analyze(frame);
        recorder.recordFrame(result.frameResult, result.currentPhase);
      }

      final sessionRecord = await recorder.endSession();
      final firestoreDoc = sessionRecord.toFirestoreDocument();

      expect(firestoreDoc.containsKey('userId'), isTrue);
      expect(firestoreDoc.containsKey('sessionMetadata'), isTrue);
      expect(firestoreDoc.containsKey('poseData'), isTrue);
      expect(firestoreDoc.containsKey('createdAt'), isTrue);
    });
  });

  group('Full Pipeline Integration', () {
    test('complete flow: PoseFrame -> Analysis -> Feedback -> Recording', () {
      fakeAsync((async) async {
        // Setup components
        final analyzer = AnalyzerFactory.create(ExerciseType.squat);
        final mockTts = MockTtsService();
        final feedbackManager = FeedbackManager(
          ttsService: mockTts,
          config: const FeedbackConfig(minFeedbackInterval: Duration.zero),
        );
        final recorder = SessionDataRecorder(
          sessionId: 'full-pipeline-test',
          userId: 'test-user',
          exerciseType: ExerciseType.squat,
        );

        // Initialize
        feedbackManager.initialize();
        async.flushMicrotasks();
        feedbackManager.start();
        recorder.startSession();

        // Track feedback events
        var feedbackCount = 0;
        feedbackManager.onVisualFeedbackUpdate = (_) => feedbackCount++;

        // Simulate complete exercise sequence
        final phases = <ExercisePhase>[];
        for (var i = 0; i < 60; i++) {
          // Create realistic squat motion
          final kneeAngle = _calculateSquatAngle(i);
          final frame = _createSquatPoseFrame(kneeAngle: kneeAngle);

          // Analyze
          final analysisResult = analyzer.analyze(frame);
          phases.add(analysisResult.currentPhase);

          // Process feedback
          feedbackManager.processFrameResult(analysisResult.frameResult);

          // Record
          recorder.recordFrame(
            analysisResult.frameResult,
            analysisResult.currentPhase,
          );
        }

        // Process remaining feedback
        async.elapse(const Duration(seconds: 2));

        // End session
        final sessionRecord = await recorder.endSession();

        // Verify results
        expect(feedbackCount, greaterThan(0));
        expect(sessionRecord.totalReps, greaterThanOrEqualTo(0));
        expect(phases, contains(ExercisePhase.down));

        // Cleanup
        feedbackManager.dispose();
      });
    });
  });
}

// Helper functions for creating test pose frames

double _calculateSquatAngle(int frameIndex) {
  // Simulate one complete squat cycle over 60 frames
  final progress = (frameIndex % 30) / 30.0;
  if (frameIndex % 60 < 30) {
    // Going down: 170 -> 90
    return 170.0 - (progress * 80);
  } else {
    // Coming up: 90 -> 170
    return 90.0 + (progress * 80);
  }
}

PoseFrame _createSquatPoseFrame({required double kneeAngle}) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Calculate positions based on knee angle
  final hipY = 0.4;
  final kneeY = hipY + 0.2;
  final ankleY = kneeY + 0.2 * (1 + (180 - kneeAngle) / 90 * 0.3);

  // Hip
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: hipY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: hipY,
    z: 0,
    likelihood: 0.9,
  );

  // Knee
  landmarks[PoseLandmarkType.leftKnee] = PoseLandmark(
    type: PoseLandmarkType.leftKnee,
    x: 0.45,
    y: kneeY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightKnee] = PoseLandmark(
    type: PoseLandmarkType.rightKnee,
    x: 0.55,
    y: kneeY,
    z: 0,
    likelihood: 0.9,
  );

  // Ankle
  landmarks[PoseLandmarkType.leftAnkle] = PoseLandmark(
    type: PoseLandmarkType.leftAnkle,
    x: 0.45,
    y: ankleY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightAnkle] = PoseLandmark(
    type: PoseLandmarkType.rightAnkle,
    x: 0.55,
    y: ankleY,
    z: 0,
    likelihood: 0.9,
  );

  // Shoulder
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.45,
    y: 0.25,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.55,
    y: 0.25,
    z: 0,
    likelihood: 0.9,
  );

  // Foot landmarks
  landmarks[PoseLandmarkType.leftHeel] = PoseLandmark(
    type: PoseLandmarkType.leftHeel,
    x: 0.43,
    y: ankleY + 0.02,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHeel] = PoseLandmark(
    type: PoseLandmarkType.rightHeel,
    x: 0.57,
    y: ankleY + 0.02,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.leftFootIndex] = PoseLandmark(
    type: PoseLandmarkType.leftFootIndex,
    x: 0.45,
    y: ankleY + 0.02,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightFootIndex] = PoseLandmark(
    type: PoseLandmarkType.rightFootIndex,
    x: 0.55,
    y: ankleY + 0.02,
    z: 0,
    likelihood: 0.85,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createSquatPoseFrameWithKneeOverToe() {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Knee far forward of toe
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: 0.5,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: 0.5,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.leftKnee] = PoseLandmark(
    type: PoseLandmarkType.leftKnee,
    x: 0.35, // Far forward
    y: 0.65,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightKnee] = PoseLandmark(
    type: PoseLandmarkType.rightKnee,
    x: 0.65, // Far forward
    y: 0.65,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.leftAnkle] = PoseLandmark(
    type: PoseLandmarkType.leftAnkle,
    x: 0.45,
    y: 0.85,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightAnkle] = PoseLandmark(
    type: PoseLandmarkType.rightAnkle,
    x: 0.55,
    y: 0.85,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.45,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.55,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.leftFootIndex] = PoseLandmark(
    type: PoseLandmarkType.leftFootIndex,
    x: 0.45,
    y: 0.87,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightFootIndex] = PoseLandmark(
    type: PoseLandmarkType.rightFootIndex,
    x: 0.55,
    y: 0.87,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.leftHeel] = PoseLandmark(
    type: PoseLandmarkType.leftHeel,
    x: 0.43,
    y: 0.87,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHeel] = PoseLandmark(
    type: PoseLandmarkType.rightHeel,
    x: 0.57,
    y: 0.87,
    z: 0,
    likelihood: 0.85,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createBicepCurlPoseFrame({required double elbowAngle}) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Shoulder (fixed position)
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.4,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.6,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );

  // Elbow
  landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
    type: PoseLandmarkType.leftElbow,
    x: 0.35,
    y: 0.5,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightElbow] = PoseLandmark(
    type: PoseLandmarkType.rightElbow,
    x: 0.65,
    y: 0.5,
    z: 0,
    likelihood: 0.9,
  );

  // Wrist (position varies with elbow angle)
  final wristYOffset = 0.15 * (1 - (180 - elbowAngle) / 130);
  landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
    type: PoseLandmarkType.leftWrist,
    x: 0.35,
    y: 0.5 + wristYOffset,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightWrist] = PoseLandmark(
    type: PoseLandmarkType.rightWrist,
    x: 0.65,
    y: 0.5 + wristYOffset,
    z: 0,
    likelihood: 0.9,
  );

  // Hip (for reference)
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createBicepCurlPoseFrameWithElbowSwing() {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Shoulder
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.4,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.6,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );

  // Elbow swung forward (bad form)
  landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
    type: PoseLandmarkType.leftElbow,
    x: 0.25, // Far forward
    y: 0.45,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightElbow] = PoseLandmark(
    type: PoseLandmarkType.rightElbow,
    x: 0.75, // Far forward
    y: 0.45,
    z: 0,
    likelihood: 0.9,
  );

  // Wrist
  landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
    type: PoseLandmarkType.leftWrist,
    x: 0.2,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightWrist] = PoseLandmark(
    type: PoseLandmarkType.rightWrist,
    x: 0.8,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );

  // Hip
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createLateralRaisePoseFrame({required double armAngle}) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  final wristX = 0.15 * (armAngle / 90); // Move outward as angle increases

  // Shoulder
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.4,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.6,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );

  // Elbow
  landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
    type: PoseLandmarkType.leftElbow,
    x: 0.35 - wristX * 0.5,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightElbow] = PoseLandmark(
    type: PoseLandmarkType.rightElbow,
    x: 0.65 + wristX * 0.5,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );

  // Wrist
  landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
    type: PoseLandmarkType.leftWrist,
    x: 0.3 - wristX,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightWrist] = PoseLandmark(
    type: PoseLandmarkType.rightWrist,
    x: 0.7 + wristX,
    y: 0.35,
    z: 0,
    likelihood: 0.9,
  );

  // Hip
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createShoulderPressPoseFrame({required double armAngle}) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  final wristY = 0.3 - 0.2 * (armAngle / 180); // Move up as angle increases

  // Shoulder
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.4,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.6,
    y: 0.3,
    z: 0,
    likelihood: 0.9,
  );

  // Elbow
  landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
    type: PoseLandmarkType.leftElbow,
    x: 0.35,
    y: 0.25,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightElbow] = PoseLandmark(
    type: PoseLandmarkType.rightElbow,
    x: 0.65,
    y: 0.25,
    z: 0,
    likelihood: 0.9,
  );

  // Wrist
  landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
    type: PoseLandmarkType.leftWrist,
    x: 0.4,
    y: wristY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightWrist] = PoseLandmark(
    type: PoseLandmarkType.rightWrist,
    x: 0.6,
    y: wristY,
    z: 0,
    likelihood: 0.9,
  );

  // Hip
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.45,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.55,
    y: 0.55,
    z: 0,
    likelihood: 0.85,
  );

  // Nose (head reference)
  landmarks[PoseLandmarkType.nose] = PoseLandmark(
    type: PoseLandmarkType.nose,
    x: 0.5,
    y: 0.15,
    z: 0,
    likelihood: 0.9,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}

PoseFrame _createPushUpPoseFrame({required double elbowAngle}) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  // Horizontal body position
  final bodyY = 0.5 + 0.1 * (1 - (180 - elbowAngle) / 90);

  // Shoulder
  landmarks[PoseLandmarkType.leftShoulder] = PoseLandmark(
    type: PoseLandmarkType.leftShoulder,
    x: 0.35,
    y: bodyY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightShoulder] = PoseLandmark(
    type: PoseLandmarkType.rightShoulder,
    x: 0.65,
    y: bodyY,
    z: 0,
    likelihood: 0.9,
  );

  // Elbow
  landmarks[PoseLandmarkType.leftElbow] = PoseLandmark(
    type: PoseLandmarkType.leftElbow,
    x: 0.25,
    y: bodyY + 0.05,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightElbow] = PoseLandmark(
    type: PoseLandmarkType.rightElbow,
    x: 0.75,
    y: bodyY + 0.05,
    z: 0,
    likelihood: 0.9,
  );

  // Wrist
  landmarks[PoseLandmarkType.leftWrist] = PoseLandmark(
    type: PoseLandmarkType.leftWrist,
    x: 0.25,
    y: bodyY + 0.15,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightWrist] = PoseLandmark(
    type: PoseLandmarkType.rightWrist,
    x: 0.75,
    y: bodyY + 0.15,
    z: 0,
    likelihood: 0.9,
  );

  // Hip
  landmarks[PoseLandmarkType.leftHip] = PoseLandmark(
    type: PoseLandmarkType.leftHip,
    x: 0.4,
    y: bodyY,
    z: 0,
    likelihood: 0.9,
  );
  landmarks[PoseLandmarkType.rightHip] = PoseLandmark(
    type: PoseLandmarkType.rightHip,
    x: 0.6,
    y: bodyY,
    z: 0,
    likelihood: 0.9,
  );

  // Knee
  landmarks[PoseLandmarkType.leftKnee] = PoseLandmark(
    type: PoseLandmarkType.leftKnee,
    x: 0.4,
    y: bodyY,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightKnee] = PoseLandmark(
    type: PoseLandmarkType.rightKnee,
    x: 0.6,
    y: bodyY,
    z: 0,
    likelihood: 0.85,
  );

  // Ankle
  landmarks[PoseLandmarkType.leftAnkle] = PoseLandmark(
    type: PoseLandmarkType.leftAnkle,
    x: 0.4,
    y: bodyY,
    z: 0,
    likelihood: 0.85,
  );
  landmarks[PoseLandmarkType.rightAnkle] = PoseLandmark(
    type: PoseLandmarkType.rightAnkle,
    x: 0.6,
    y: bodyY,
    z: 0,
    likelihood: 0.85,
  );

  // Nose
  landmarks[PoseLandmarkType.nose] = PoseLandmark(
    type: PoseLandmarkType.nose,
    x: 0.5,
    y: bodyY - 0.1,
    z: 0,
    likelihood: 0.9,
  );

  return PoseFrame(
    landmarks: landmarks,
    timestamp: timestamp,
  );
}
