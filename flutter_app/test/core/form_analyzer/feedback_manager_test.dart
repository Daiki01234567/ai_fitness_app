// Feedback Manager Tests
//
// Unit tests for real-time feedback delivery service.
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/form_analyzer/services/feedback_manager.dart';
import 'package:flutter_app/core/form_analyzer/models/form_feedback.dart';

void main() {
  group('FeedbackManager', () {
    late FeedbackManager manager;
    late MockTtsService mockTts;

    setUp(() {
      mockTts = MockTtsService();
      manager = FeedbackManager(ttsService: mockTts);
    });

    tearDown(() async {
      await manager.dispose();
    });

    group('initialization', () {
      test('initializes TTS service', () async {
        await manager.initialize();
        expect(await mockTts.isAvailable(), isTrue);
      });

      test('throws when starting without initialization', () {
        expect(() => manager.start(), throwsA(isA<StateError>()));
      });
    });

    group('configuration', () {
      test('applies speech rate from config', () async {
        final config = FeedbackConfig(speechRate: 1.5);
        manager = FeedbackManager(ttsService: mockTts, config: config);
        await manager.initialize();

        expect(mockTts.rate, equals(1.5));
      });

      test('applies volume from config', () async {
        final config = FeedbackConfig(volume: 0.8);
        manager = FeedbackManager(ttsService: mockTts, config: config);
        await manager.initialize();

        expect(mockTts.volume, equals(0.8));
      });

      test('updates config dynamically', () async {
        await manager.initialize();
        manager.start();

        final newConfig = FeedbackConfig(speechRate: 2.0, volume: 0.5);
        await manager.updateConfig(newConfig);

        expect(mockTts.rate, equals(2.0));
        expect(mockTts.volume, equals(0.5));
      });
    });

    group('processFrameResult', () {
      test('updates visual feedback', () async {
        await manager.initialize();
        manager.start();

        var receivedIssues = <FormIssue>[];
        manager.onVisualFeedbackUpdate = (issues) {
          receivedIssues = issues;
        };

        final result = _createFrameResult([
          _createIssue('test_issue', FeedbackPriority.high),
        ]);

        manager.processFrameResult(result);

        expect(receivedIssues.length, equals(1));
        expect(receivedIssues[0].issueType, equals('test_issue'));
      });

      test('does not process when not active', () async {
        await manager.initialize();
        // Not calling start()

        var receivedIssues = <FormIssue>[];
        manager.onVisualFeedbackUpdate = (issues) {
          receivedIssues = issues;
        };

        final result = _createFrameResult([
          _createIssue('test_issue', FeedbackPriority.high),
        ]);

        manager.processFrameResult(result);

        expect(receivedIssues, isEmpty);
      });

      test('respects priority threshold for voice feedback', () {
        fakeAsync((async) {
          final config = FeedbackConfig(
            priorityThreshold: FeedbackPriority.high,
            minFeedbackInterval: Duration.zero,
          );
          manager = FeedbackManager(ttsService: mockTts, config: config);

          // Initialize synchronously for fake async
          manager.initialize();
          async.flushMicrotasks();

          manager.start();

          // Low priority should not be queued (high threshold = only critical and high)
          final result = _createFrameResult([
            _createIssue('low_priority', FeedbackPriority.low),
          ]);

          manager.processFrameResult(result);

          // Advance time to allow queue processing
          async.elapse(const Duration(seconds: 2));

          expect(mockTts.spokenTexts, isEmpty);

          manager.dispose();
        });
      });
    });

    group('voice feedback', () {
      test('prefixes message with 参考:', () {
        fakeAsync((async) {
          final config = FeedbackConfig(minFeedbackInterval: Duration.zero);
          manager = FeedbackManager(ttsService: mockTts, config: config);
          manager.initialize();
          async.flushMicrotasks();

          manager.start();

          final result = _createFrameResult([
            _createIssue('test', FeedbackPriority.high, message: 'テストメッセージ'),
          ]);

          manager.processFrameResult(result);

          // Advance time to trigger queue processing (timer fires every 500ms)
          async.elapse(const Duration(seconds: 1));

          expect(mockTts.spokenTexts.isNotEmpty, isTrue);
          expect(mockTts.spokenTexts.first.startsWith('参考:'), isTrue);

          manager.dispose();
        });
      });

      test('respects minimum interval between voice feedback', () {
        fakeAsync((async) {
          final config = FeedbackConfig(
            minFeedbackInterval: const Duration(seconds: 5),
          );
          manager = FeedbackManager(ttsService: mockTts, config: config);
          manager.initialize();
          async.flushMicrotasks();

          manager.start();

          // First feedback
          manager.processFrameResult(
            _createFrameResult([_createIssue('issue1', FeedbackPriority.high)]),
          );

          // Process queue
          async.elapse(const Duration(seconds: 1));

          // Second feedback immediately after
          manager.processFrameResult(
            _createFrameResult([_createIssue('issue2', FeedbackPriority.high)]),
          );

          // Advance time but less than minFeedbackInterval
          async.elapse(const Duration(seconds: 2));

          // Should only have spoken once due to interval
          expect(mockTts.spokenTexts.length, equals(1));

          manager.dispose();
        });
      });

      test('prioritizes high priority issues', () {
        fakeAsync((async) {
          final config = FeedbackConfig(minFeedbackInterval: Duration.zero);
          manager = FeedbackManager(ttsService: mockTts, config: config);
          manager.initialize();
          async.flushMicrotasks();

          manager.start();

          // Add low and high priority together
          manager.processFrameResult(
            _createFrameResult([
              _createIssue('low', FeedbackPriority.low, message: 'low'),
              _createIssue('high', FeedbackPriority.high, message: 'high'),
            ]),
          );

          // Process queue
          async.elapse(const Duration(seconds: 1));

          // High priority should be spoken first
          expect(mockTts.spokenTexts.isNotEmpty, isTrue);
          expect(mockTts.spokenTexts.first.contains('high'), isTrue);

          manager.dispose();
        });
      });
    });

    group('notifyRepCompleted', () {
      test('triggers rep callback', () async {
        await manager.initialize();
        manager.start();

        int? receivedRep;
        double? receivedScore;
        manager.onRepCompleted = (rep, score) {
          receivedRep = rep;
          receivedScore = score;
        };

        manager.notifyRepCompleted(5, 85.0);

        expect(receivedRep, equals(5));
        expect(receivedScore, equals(85.0));
      });
    });

    group('stop', () {
      test('clears pending feedback', () async {
        await manager.initialize();
        manager.start();

        manager.processFrameResult(
          _createFrameResult([_createIssue('test', FeedbackPriority.high)]),
        );

        await manager.stop();

        expect(manager.currentIssues, isEmpty);
        expect(manager.isActive, isFalse);
      });
    });

    group('FeedbackConfig', () {
      test('copyWith creates new config with updated values', () {
        const original = FeedbackConfig();
        final updated = original.copyWith(
          voiceFeedbackEnabled: false,
          speechRate: 1.5,
        );

        expect(updated.voiceFeedbackEnabled, isFalse);
        expect(updated.speechRate, equals(1.5));
        expect(updated.visualFeedbackEnabled, isTrue); // Unchanged
      });
    });

    group('FeedbackItem', () {
      test('generates voice message with prefix', () {
        final issue = _createIssue(
          'test',
          FeedbackPriority.high,
          message: 'テストメッセージ',
        );
        final item = FeedbackItem(issue: issue, timestamp: DateTime.now());

        expect(item.voiceMessage, equals('参考: テストメッセージ'));
      });
    });
  });

  group('MockTtsService', () {
    test('tracks spoken texts', () async {
      final tts = MockTtsService();
      await tts.initialize();
      await tts.speak('Hello');
      await tts.speak('World');

      expect(tts.spokenTexts, equals(['Hello', 'World']));
    });

    test('tracks rate and volume settings', () async {
      final tts = MockTtsService();
      await tts.initialize();
      await tts.setRate(1.5);
      await tts.setVolume(0.7);

      expect(tts.rate, equals(1.5));
      expect(tts.volume, equals(0.7));
    });
  });
}

FormIssue _createIssue(
  String type,
  FeedbackPriority priority, {
  String message = 'テストメッセージ',
}) {
  return FormIssue(
    issueType: type,
    message: message,
    priority: priority,
    suggestion: 'テスト提案',
    affectedBodyPart: 'test',
    currentValue: 0,
    targetValue: 0,
    deduction: 10,
  );
}

FrameEvaluationResult _createFrameResult(List<FormIssue> issues) {
  return FrameEvaluationResult(
    timestamp: DateTime.now().millisecondsSinceEpoch,
    score: 80,
    level: FeedbackLevel.good,
    issues: issues,
    jointAngles: {},
  );
}
