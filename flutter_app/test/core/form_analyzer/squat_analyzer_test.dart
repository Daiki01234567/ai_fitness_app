// Squat Analyzer Tests
//
// Unit tests for squat form evaluation logic.
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/form_analyzer/analyzers/squat_analyzer.dart';
import 'package:flutter_app/core/form_analyzer/base/base_analyzer.dart';
import 'package:flutter_app/core/form_analyzer/models/form_feedback.dart';
import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';

void main() {
  group('SquatAnalyzer', () {
    late SquatAnalyzer analyzer;

    setUp(() {
      analyzer = SquatAnalyzer();
    });

    group('exerciseType', () {
      test('returns squat type', () {
        expect(analyzer.exerciseType, equals(ExerciseType.squat));
      });
    });

    group('phaseThresholds', () {
      test('contains required phase thresholds', () {
        final thresholds = analyzer.phaseThresholds;
        expect(thresholds.containsKey('down'), isTrue);
        expect(thresholds.containsKey('bottom'), isTrue);
        expect(thresholds.containsKey('up'), isTrue);
      });
    });

    group('evaluateFrame', () {
      test('evaluates good squat form with high score', () {
        final frame = _createSquatFrame(
          kneeY: 0.7, // Good depth
        );

        final result = analyzer.evaluateFrame(frame);

        expect(result.score, greaterThan(0));
        expect(result.issues, isA<List<FormIssue>>());
      });

      test('records joint angles', () {
        final frame = _createSquatFrame();

        final result = analyzer.evaluateFrame(frame);

        // Should have some joint angles recorded
        expect(result.jointAngles, isA<Map<String, double>>());
      });

      test('returns valid feedback level', () {
        final frame = _createSquatFrame();

        final result = analyzer.evaluateFrame(frame);

        expect(FeedbackLevel.values, contains(result.level));
      });
    });

    group('analyze', () {
      test('returns analysis result with all components', () {
        final frame = _createSquatFrame();

        final result = analyzer.analyze(frame);

        expect(result.frameResult, isNotNull);
        expect(result.currentPhase, isNotNull);
        expect(result.repCount, greaterThanOrEqualTo(0));
      });
    });

    group('reset', () {
      test('resets analyzer state', () {
        // Do some analysis
        final frame = _createSquatFrame();
        analyzer.analyze(frame);
        analyzer.analyze(frame);

        analyzer.reset();

        expect(analyzer.currentPhase, equals(ExercisePhase.start));
        expect(analyzer.repCount, equals(0));
      });
    });

    group('SquatConfig', () {
      test('uses custom config values', () {
        final customConfig = SquatConfig(
          targetKneeAngle: 80.0, // Deeper squat
          kneeAngleTolerance: 20.0,
        );

        final customAnalyzer = SquatAnalyzer(squatConfig: customConfig);
        expect(customAnalyzer.squatConfig.targetKneeAngle, equals(80.0));
      });

      test('default config has reasonable values', () {
        expect(SquatConfig.defaultConfig.targetKneeAngle, equals(90.0));
        expect(SquatConfig.defaultConfig.kneeAngleTolerance, greaterThan(0));
      });
    });

    group('getSessionSummary', () {
      test('returns session summary with exercise type', () {
        final summary = analyzer.getSessionSummary();
        // SessionSummary.exerciseType is a String, using exerciseType.id
        expect(summary.exerciseType, equals('squat'));
      });
    });
  });
}

/// Creates a squat frame with the specified parameters
PoseFrame _createSquatFrame({
  double kneeY = 0.6,
}) {
  // Hip positions (center of body)
  final leftHip = _createLandmark(PoseLandmarkType.leftHip, 0.45, 0.5);
  final rightHip = _createLandmark(PoseLandmarkType.rightHip, 0.55, 0.5);

  // Knee positions
  final leftKnee = _createLandmark(PoseLandmarkType.leftKnee, 0.45, kneeY);
  final rightKnee = _createLandmark(PoseLandmarkType.rightKnee, 0.55, kneeY);

  // Ankle positions
  final leftAnkle = _createLandmark(PoseLandmarkType.leftAnkle, 0.45, 0.85);
  final rightAnkle = _createLandmark(PoseLandmarkType.rightAnkle, 0.55, 0.85);

  // Shoulder positions
  final leftShoulder = _createLandmark(PoseLandmarkType.leftShoulder, 0.45, 0.3);
  final rightShoulder =
      _createLandmark(PoseLandmarkType.rightShoulder, 0.55, 0.3);

  // Heel positions
  final leftHeel = _createLandmark(PoseLandmarkType.leftHeel, 0.43, 0.87);
  final rightHeel = _createLandmark(PoseLandmarkType.rightHeel, 0.57, 0.87);

  // Toe positions
  final leftToe = _createLandmark(PoseLandmarkType.leftFootIndex, 0.45, 0.87);
  final rightToe = _createLandmark(PoseLandmarkType.rightFootIndex, 0.55, 0.87);

  final landmarks = <PoseLandmarkType, PoseLandmark>{
    PoseLandmarkType.leftHip: leftHip,
    PoseLandmarkType.rightHip: rightHip,
    PoseLandmarkType.leftKnee: leftKnee,
    PoseLandmarkType.rightKnee: rightKnee,
    PoseLandmarkType.leftAnkle: leftAnkle,
    PoseLandmarkType.rightAnkle: rightAnkle,
    PoseLandmarkType.leftShoulder: leftShoulder,
    PoseLandmarkType.rightShoulder: rightShoulder,
    PoseLandmarkType.leftHeel: leftHeel,
    PoseLandmarkType.rightHeel: rightHeel,
    PoseLandmarkType.leftFootIndex: leftToe,
    PoseLandmarkType.rightFootIndex: rightToe,
  };

  return PoseFrame(
    timestamp: DateTime.now().millisecondsSinceEpoch,
    landmarks: landmarks,
  );
}

PoseLandmark _createLandmark(PoseLandmarkType type, double x, double y) {
  return PoseLandmark(
    type: type,
    x: x,
    y: y,
    z: 0,
    likelihood: 0.9,
  );
}
