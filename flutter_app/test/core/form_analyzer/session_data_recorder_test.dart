// Session Data Recorder Tests
//
// Unit tests for training session data recording.
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/form_analyzer/services/session_data_recorder.dart';
import 'package:flutter_app/core/form_analyzer/base/base_analyzer.dart';
import 'package:flutter_app/core/form_analyzer/models/form_feedback.dart';

void main() {
  group('SessionDataRecorder', () {
    late SessionDataRecorder recorder;

    setUp(() {
      recorder = SessionDataRecorder(
        sessionId: 'test-session-123',
        userId: 'user-456',
        exerciseType: ExerciseType.squat,
      );
    });

    group('startSession', () {
      test('enables recording', () {
        recorder.startSession();
        expect(recorder.isRecording, isTrue);
      });

      test('initializes session start time', () {
        recorder.startSession();

        // Session start time should be set (tested via statistics)
        final stats = recorder.getStatistics();
        expect(stats.totalDuration.inMilliseconds, greaterThanOrEqualTo(0));
      });
    });

    group('recordFrame', () {
      test('records frame when active', () {
        recorder.startSession();
        final result = _createFrameResult(score: 85);

        recorder.recordFrame(result, ExercisePhase.down);

        expect(recorder.totalFramesRecorded, equals(1));
      });

      test('does not record when not active', () {
        // Don't call startSession
        final result = _createFrameResult(score: 85);

        recorder.recordFrame(result, ExercisePhase.down);

        expect(recorder.totalFramesRecorded, equals(0));
      });

      test('respects sample rate', () {
        final config = RecorderConfig(sampleRate: 2); // Every other frame
        recorder = SessionDataRecorder(
          sessionId: 'test',
          userId: 'user',
          exerciseType: ExerciseType.squat,
          config: config,
        );
        recorder.startSession();

        // Record 10 frames
        for (var i = 0; i < 10; i++) {
          recorder.recordFrame(
            _createFrameResult(score: 80),
            ExercisePhase.down,
          );
        }

        // Should only record 5 (every other frame)
        expect(recorder.totalFramesRecorded, equals(5));
      });

      test('emits frame recorded event', () {
        recorder.startSession();
        SessionEvent? receivedEvent;
        recorder.onEvent = (event) {
          if (event.type == SessionEventType.frameRecorded) {
            receivedEvent = event;
          }
        };

        recorder.recordFrame(_createFrameResult(score: 80), ExercisePhase.down);

        expect(receivedEvent, isNotNull);
        expect(receivedEvent!.type, equals(SessionEventType.frameRecorded));
      });
    });

    group('recordRepCompleted', () {
      test('increments rep count', () {
        recorder.startSession();
        expect(recorder.currentRepNumber, equals(0));

        recorder.recordRepCompleted(_createRepSummary(repNumber: 1));

        expect(recorder.currentRepNumber, equals(1));
      });

      test('emits rep completed event', () {
        recorder.startSession();
        SessionEvent? receivedEvent;
        recorder.onEvent = (event) {
          if (event.type == SessionEventType.repCompleted) {
            receivedEvent = event;
          }
        };

        recorder.recordRepCompleted(_createRepSummary(repNumber: 1));

        expect(receivedEvent, isNotNull);
        expect(receivedEvent!.data, isA<RecordedRep>());
      });
    });

    group('recordSetCompleted', () {
      test('increments set count', () {
        recorder.startSession();
        expect(recorder.currentSetNumber, equals(1));

        recorder.recordSetCompleted(_createSetSummary(setNumber: 1));

        expect(recorder.currentSetNumber, equals(2));
      });

      test('resets rep count', () {
        recorder.startSession();
        recorder.recordRepCompleted(_createRepSummary(repNumber: 1));
        recorder.recordRepCompleted(_createRepSummary(repNumber: 2));

        recorder.recordSetCompleted(_createSetSummary(setNumber: 1));

        expect(recorder.currentRepNumber, equals(0));
      });
    });

    group('endSession', () {
      test('returns session record', () async {
        recorder.startSession();
        recorder.recordRepCompleted(_createRepSummary(repNumber: 1, score: 80));
        recorder.recordRepCompleted(_createRepSummary(repNumber: 2, score: 90));
        recorder.recordSetCompleted(
          _createSetSummary(
            setNumber: 1,
            repCount: 2,
            reps: [
              _createRepSummary(repNumber: 1, score: 80),
              _createRepSummary(repNumber: 2, score: 90),
            ],
          ),
        );

        final record = await recorder.endSession();

        expect(record.sessionId, equals('test-session-123'));
        expect(record.userId, equals('user-456'));
        expect(record.exerciseType, equals(ExerciseType.squat));
        expect(record.totalSets, equals(1));
      });

      test('stops recording', () async {
        recorder.startSession();
        await recorder.endSession();

        expect(recorder.isRecording, isFalse);
      });

      test('emits session ended event', () async {
        recorder.startSession();
        SessionEvent? receivedEvent;
        recorder.onEvent = (event) {
          if (event.type == SessionEventType.sessionEnded) {
            receivedEvent = event;
          }
        };

        await recorder.endSession();

        expect(receivedEvent, isNotNull);
        expect(receivedEvent!.data, isA<SessionRecord>());
      });
    });

    group('cancelSession', () {
      test('stops recording without saving', () {
        recorder.startSession();
        recorder.recordRepCompleted(_createRepSummary(repNumber: 1));

        recorder.cancelSession();

        expect(recorder.isRecording, isFalse);
      });
    });

    group('getStatistics', () {
      test('returns empty stats when no data', () {
        recorder.startSession();
        final stats = recorder.getStatistics();

        expect(stats.totalReps, equals(0));
        expect(stats.totalSets, equals(0));
      });

      test('calculates statistics correctly', () {
        recorder.startSession();
        recorder.recordRepCompleted(_createRepSummary(repNumber: 1, score: 80));
        recorder.recordRepCompleted(_createRepSummary(repNumber: 2, score: 90));
        recorder.recordRepCompleted(
          _createRepSummary(repNumber: 3, score: 100),
        );

        final stats = recorder.getStatistics();

        expect(stats.totalReps, equals(3));
        expect(stats.averageScore, closeTo(90.0, 0.1));
        expect(stats.minScore, equals(80.0));
        expect(stats.maxScore, equals(100.0));
      });
    });

    group('getMostCommonIssues', () {
      test('returns empty list when no issues', () {
        recorder.startSession();
        final issues = recorder.getMostCommonIssues();
        expect(issues, isEmpty);
      });

      test('returns issues sorted by frequency', () {
        recorder.startSession();
        recorder.recordRepCompleted(
          _createRepSummary(repNumber: 1, issues: ['issue_a', 'issue_b']),
        );
        recorder.recordRepCompleted(
          _createRepSummary(repNumber: 2, issues: ['issue_a']),
        );
        recorder.recordRepCompleted(
          _createRepSummary(repNumber: 3, issues: ['issue_a', 'issue_c']),
        );

        final issues = recorder.getMostCommonIssues(limit: 2);

        expect(issues.first, equals('issue_a')); // Most common
        expect(issues.length, equals(2));
      });
    });

    group('metadata', () {
      test('can store custom metadata', () {
        recorder.metadata['device'] = 'iPhone 15';
        recorder.metadata['appVersion'] = '1.0.0';

        expect(recorder.metadata['device'], equals('iPhone 15'));
      });
    });
  });

  group('SessionRecord', () {
    test('toJson includes all fields', () {
      final record = SessionRecord(
        sessionId: 'session-1',
        userId: 'user-1',
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2024, 1, 1, 10, 0),
        endTime: DateTime(2024, 1, 1, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 85.5,
        sets: [],
        topIssues: ['knee_over_toe'],
      );

      final json = record.toJson();

      expect(json['sessionId'], equals('session-1'));
      expect(json['userId'], equals('user-1'));
      expect(json['exerciseType'], equals('squat'));
      expect(json['totalReps'], equals(30));
      expect(json['totalSets'], equals(3));
    });

    test('toFirestoreDocument has correct structure', () {
      final record = SessionRecord(
        sessionId: 'session-1',
        userId: 'user-1',
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2024, 1, 1, 10, 0),
        endTime: DateTime(2024, 1, 1, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 85.5,
        sets: [],
        topIssues: ['knee_over_toe'],
      );

      final doc = record.toFirestoreDocument();

      expect(doc['userId'], equals('user-1'));
      expect(doc['sessionMetadata'], isA<Map>());
      expect(doc['poseData'], isA<Map>());
      expect(doc['createdAt'], isNotNull);
    });
  });

  group('RecordedFrame', () {
    test('fromEvaluation creates frame correctly', () {
      final evalResult = _createFrameResult(score: 90);

      final frame = RecordedFrame.fromEvaluation(
        evalResult,
        phase: ExercisePhase.down,
      );

      expect(frame.score, equals(90.0));
      expect(frame.phase, equals(ExercisePhase.down));
    });

    test('toJson excludes null values', () {
      final frame = RecordedFrame(
        timestamp: DateTime.now().millisecondsSinceEpoch,
        score: 80,
        phase: ExercisePhase.up,
        jointAngles: null,
        issueTypes: [],
      );

      final json = frame.toJson();

      expect(json.containsKey('jointAngles'), isFalse);
      expect(json.containsKey('issueTypes'), isFalse); // Empty list excluded
    });
  });

  group('SessionStatistics', () {
    test('empty factory returns zeros', () {
      final stats = SessionStatistics.empty();

      expect(stats.totalReps, equals(0));
      expect(stats.totalSets, equals(0));
      expect(stats.averageScore, equals(0));
    });

    test('toJson includes all fields', () {
      final stats = SessionStatistics(
        totalReps: 10,
        totalSets: 2,
        averageScore: 85.0,
        minScore: 70.0,
        maxScore: 95.0,
        scoreDistribution: {FeedbackLevel.good: 8, FeedbackLevel.excellent: 2},
        totalDuration: const Duration(minutes: 15),
        framesRecorded: 27000,
      );

      final json = stats.toJson();

      expect(json['totalReps'], equals(10));
      expect(json['scoreDistribution']['good'], equals(8));
    });
  });

  group('RecorderConfig', () {
    test('default config has reasonable values', () {
      const config = RecorderConfig();

      expect(config.maxFramesInMemory, greaterThan(0));
      expect(config.sampleRate, equals(1));
      expect(config.autoFlush, isTrue);
    });
  });
}

FrameEvaluationResult _createFrameResult({
  double score = 80,
  List<FormIssue>? issues,
}) {
  return FrameEvaluationResult(
    timestamp: DateTime.now().millisecondsSinceEpoch,
    score: score,
    level: FeedbackLevelExtension.fromScore(score),
    issues: issues ?? [],
    jointAngles: {'leftKnee': 90, 'rightKnee': 92},
  );
}

RepSummary _createRepSummary({
  required int repNumber,
  double score = 80,
  List<String>? issues,
}) {
  final now = DateTime.now().millisecondsSinceEpoch;
  return RepSummary(
    repNumber: repNumber,
    score: score,
    level: FeedbackLevelExtension.fromScore(score),
    issues: (issues ?? [])
        .map(
          (type) => FormIssue(
            issueType: type,
            message: type,
            priority: FeedbackPriority.medium,
            suggestion: '',
            affectedBodyPart: '',
            currentValue: 0,
            targetValue: 0,
            deduction: 0,
          ),
        )
        .toList(),
    startTime: now - 3000, // 3 seconds before now
    endTime: now,
  );
}

SetSummary _createSetSummary({
  required int setNumber,
  int repCount = 10,
  List<RepSummary>? reps,
}) {
  final now = DateTime.now().millisecondsSinceEpoch;
  return SetSummary(
    setNumber: setNumber,
    repCount: repCount,
    averageScore: 85,
    level: FeedbackLevelExtension.fromScore(85),
    reps: reps ?? [],
    commonIssues: [],
    startTime: now - 300000, // 5 minutes before now
    endTime: now,
  );
}
