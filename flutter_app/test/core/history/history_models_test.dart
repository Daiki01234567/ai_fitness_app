// History Models Unit Tests
//
// Tests for history data models serialization and calculations.
// Reference: docs/tickets/012_history_analytics.md
//
// Test coverage:
// - HistorySession.fromJson / toJson serialization
// - HistorySession.duration calculation
// - HistorySession.bestSetScore calculation
// - HistorySession.primaryIssues extraction
// - HistorySession.copyWith functionality
// - HistorySetRecord serialization
// - DailySummary.intensityLevel calculation
// - WeeklyStats.activeDays calculation
// - MonthlyStats.activeDays calculation
// - HistoryFilter.isEmpty check
// - HistoryFilter.copyWith functionality
// - BodyCondition serialization
// - ExerciseStats model
// - ProgressDataPoint model
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/core/history/history_models.dart';
import 'package:flutter_app/core/form_analyzer/form_analyzer.dart';

void main() {
  group('HistorySession', () {
    group('duration calculation', () {
      test('duration計算が正しく動作する - 30分のセッション', () {
        final session = HistorySession(
          id: 'test-1',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 50,
          totalSets: 5,
          averageScore: 85.0,
          sets: [],
        );

        expect(session.duration, equals(const Duration(minutes: 30)));
      });

      test('duration計算が正しく動作する - 1時間15分のセッション', () {
        final session = HistorySession(
          id: 'test-2',
          userId: 'user-1',
          exerciseType: ExerciseType.armCurl,
          startTime: DateTime(2025, 1, 1, 9, 0),
          endTime: DateTime(2025, 1, 1, 10, 15),
          totalReps: 100,
          totalSets: 10,
          averageScore: 90.0,
          sets: [],
        );

        expect(session.duration, equals(const Duration(hours: 1, minutes: 15)));
      });

      test('duration計算が正しく動作する - 0分のセッション', () {
        final startTime = DateTime(2025, 1, 1, 10, 0);
        final session = HistorySession(
          id: 'test-3',
          userId: 'user-1',
          exerciseType: ExerciseType.pushUp,
          startTime: startTime,
          endTime: startTime,
          totalReps: 0,
          totalSets: 0,
          averageScore: 0,
          sets: [],
        );

        expect(session.duration, equals(Duration.zero));
      });
    });

    group('bestSetScore calculation', () {
      test('bestSetScoreが空のセットリストで0を返す', () {
        final session = HistorySession(
          id: 'test-1',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 0,
          totalSets: 0,
          averageScore: 0,
          sets: [],
        );

        expect(session.bestSetScore, equals(0));
      });

      test('bestSetScoreが単一セットで正しく計算される', () {
        final session = HistorySession(
          id: 'test-2',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 10,
          totalSets: 1,
          averageScore: 85.0,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 85.0,
              duration: Duration(minutes: 5),
              issues: [],
            ),
          ],
        );

        expect(session.bestSetScore, equals(85.0));
      });

      test('bestSetScoreが複数セットから最高スコアを返す', () {
        final session = HistorySession(
          id: 'test-3',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 30,
          totalSets: 3,
          averageScore: 82.0,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 75.0,
              duration: Duration(minutes: 5),
              issues: [],
            ),
            const HistorySetRecord(
              setNumber: 2,
              reps: 10,
              averageScore: 92.0,
              duration: Duration(minutes: 5),
              issues: [],
            ),
            const HistorySetRecord(
              setNumber: 3,
              reps: 10,
              averageScore: 79.0,
              duration: Duration(minutes: 5),
              issues: [],
            ),
          ],
        );

        expect(session.bestSetScore, equals(92.0));
      });
    });

    group('primaryIssues extraction', () {
      test('primaryIssuesが空のセットリストで空リストを返す', () {
        final session = HistorySession(
          id: 'test-1',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 0,
          totalSets: 0,
          averageScore: 0,
          sets: [],
        );

        expect(session.primaryIssues, isEmpty);
      });

      test('primaryIssuesが頻出順に最大3件を返す', () {
        final session = HistorySession(
          id: 'test-2',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 30,
          totalSets: 3,
          averageScore: 75.0,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 75.0,
              duration: Duration(minutes: 5),
              issues: ['knee_over_toe', 'back_rounding', 'shallow_squat'],
            ),
            const HistorySetRecord(
              setNumber: 2,
              reps: 10,
              averageScore: 70.0,
              duration: Duration(minutes: 5),
              issues: ['knee_over_toe', 'back_rounding'],
            ),
            const HistorySetRecord(
              setNumber: 3,
              reps: 10,
              averageScore: 80.0,
              duration: Duration(minutes: 5),
              issues: ['knee_over_toe', 'shallow_squat', 'foot_position'],
            ),
          ],
        );

        final issues = session.primaryIssues;
        expect(issues.length, equals(3));
        expect(issues[0], equals('knee_over_toe')); // 3 occurrences
        expect(issues[1], equals('back_rounding')); // 2 occurrences
        expect(issues[2], equals('shallow_squat')); // 2 occurrences
      });

      test('primaryIssuesが3件未満の場合は全て返す', () {
        final session = HistorySession(
          id: 'test-3',
          userId: 'user-1',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 1, 10, 0),
          endTime: DateTime(2025, 1, 1, 10, 30),
          totalReps: 10,
          totalSets: 1,
          averageScore: 80.0,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 80.0,
              duration: Duration(minutes: 5),
              issues: ['knee_over_toe', 'back_rounding'],
            ),
          ],
        );

        final issues = session.primaryIssues;
        expect(issues.length, equals(2));
      });
    });

    group('JSON serialization', () {
      test('toJsonとfromJsonが正しくラウンドトリップする', () {
        final original = HistorySession(
          id: 'session-123',
          userId: 'user-456',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 15, 10, 30),
          endTime: DateTime(2025, 1, 15, 11, 0),
          totalReps: 50,
          totalSets: 5,
          averageScore: 85.5,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 85.0,
              duration: Duration(minutes: 5, seconds: 30),
              issues: ['knee_over_toe'],
              bestRepScore: 92.0,
              worstRepScore: 78.0,
            ),
          ],
          note: 'Great workout!',
          tags: ['morning', 'heavy'],
          bodyCondition: const BodyCondition(
            energyLevel: 4,
            sleepQuality: 5,
            muscleStiffness: 2,
            notes: 'Feeling good',
          ),
        );

        final json = original.toJson();
        final restored = HistorySession.fromJson(json);

        expect(restored.id, equals(original.id));
        expect(restored.userId, equals(original.userId));
        expect(restored.exerciseType, equals(original.exerciseType));
        expect(restored.startTime, equals(original.startTime));
        expect(restored.endTime, equals(original.endTime));
        expect(restored.totalReps, equals(original.totalReps));
        expect(restored.totalSets, equals(original.totalSets));
        expect(restored.averageScore, equals(original.averageScore));
        expect(restored.sets.length, equals(original.sets.length));
        expect(restored.note, equals(original.note));
        expect(restored.tags, equals(original.tags));
        expect(restored.bodyCondition?.energyLevel,
            equals(original.bodyCondition?.energyLevel));
      });

      test('toJsonがnull値を正しく処理する', () {
        final session = HistorySession(
          id: 'session-123',
          userId: 'user-456',
          exerciseType: ExerciseType.armCurl,
          startTime: DateTime(2025, 1, 15, 10, 0),
          endTime: DateTime(2025, 1, 15, 10, 30),
          totalReps: 30,
          totalSets: 3,
          averageScore: 80.0,
          sets: [],
          note: null,
          tags: null,
          bodyCondition: null,
        );

        final json = session.toJson();
        expect(json['note'], isNull);
        expect(json['tags'], isNull);
        expect(json['bodyCondition'], isNull);
      });

      test('fromJsonがExerciseTypeを正しくパースする', () {
        final json = {
          'id': 'test-id',
          'userId': 'user-id',
          'exerciseType': 'armCurl',
          'startTime': '2025-01-15T10:00:00.000',
          'endTime': '2025-01-15T10:30:00.000',
          'totalReps': 30,
          'totalSets': 3,
          'averageScore': 80.0,
          'sets': [],
        };

        final session = HistorySession.fromJson(json);
        expect(session.exerciseType, equals(ExerciseType.armCurl));
      });

      test('fromJsonが不明なExerciseTypeでデフォルト値を使用する', () {
        final json = {
          'id': 'test-id',
          'userId': 'user-id',
          'exerciseType': 'unknown_exercise',
          'startTime': '2025-01-15T10:00:00.000',
          'endTime': '2025-01-15T10:30:00.000',
          'totalReps': 30,
          'totalSets': 3,
          'averageScore': 80.0,
          'sets': [],
        };

        final session = HistorySession.fromJson(json);
        expect(session.exerciseType, equals(ExerciseType.squat));
      });
    });

    group('copyWith functionality', () {
      test('copyWithが指定フィールドのみ更新する', () {
        final original = HistorySession(
          id: 'session-123',
          userId: 'user-456',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 15, 10, 0),
          endTime: DateTime(2025, 1, 15, 10, 30),
          totalReps: 50,
          totalSets: 5,
          averageScore: 85.0,
          sets: [],
          note: 'Original note',
        );

        final updated = original.copyWith(
          note: 'Updated note',
          averageScore: 90.0,
        );

        expect(updated.id, equals(original.id));
        expect(updated.userId, equals(original.userId));
        expect(updated.exerciseType, equals(original.exerciseType));
        expect(updated.note, equals('Updated note'));
        expect(updated.averageScore, equals(90.0));
      });

      test('copyWithが全フィールドを更新できる', () {
        final original = HistorySession(
          id: 'session-123',
          userId: 'user-456',
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 15, 10, 0),
          endTime: DateTime(2025, 1, 15, 10, 30),
          totalReps: 50,
          totalSets: 5,
          averageScore: 85.0,
          sets: [],
        );

        final newEndTime = DateTime(2025, 1, 15, 11, 0);
        final updated = original.copyWith(
          id: 'new-id',
          userId: 'new-user',
          exerciseType: ExerciseType.pushUp,
          endTime: newEndTime,
          totalReps: 100,
          totalSets: 10,
          averageScore: 95.0,
          sets: [
            const HistorySetRecord(
              setNumber: 1,
              reps: 10,
              averageScore: 95.0,
              duration: Duration(minutes: 5),
              issues: [],
            ),
          ],
          note: 'New note',
          tags: ['new-tag'],
          bodyCondition: const BodyCondition(energyLevel: 5),
        );

        expect(updated.id, equals('new-id'));
        expect(updated.userId, equals('new-user'));
        expect(updated.exerciseType, equals(ExerciseType.pushUp));
        expect(updated.endTime, equals(newEndTime));
        expect(updated.totalReps, equals(100));
        expect(updated.totalSets, equals(10));
        expect(updated.averageScore, equals(95.0));
        expect(updated.sets.length, equals(1));
        expect(updated.note, equals('New note'));
        expect(updated.tags, equals(['new-tag']));
        expect(updated.bodyCondition?.energyLevel, equals(5));
      });
    });
  });

  group('HistorySetRecord', () {
    group('JSON serialization', () {
      test('toJsonとfromJsonが正しくラウンドトリップする', () {
        const original = HistorySetRecord(
          setNumber: 3,
          reps: 12,
          averageScore: 88.5,
          duration: Duration(minutes: 6, seconds: 45),
          issues: ['elbow_swing', 'momentum'],
          bestRepScore: 95.0,
          worstRepScore: 80.0,
        );

        final json = original.toJson();
        final restored = HistorySetRecord.fromJson(json);

        expect(restored.setNumber, equals(original.setNumber));
        expect(restored.reps, equals(original.reps));
        expect(restored.averageScore, equals(original.averageScore));
        expect(restored.duration, equals(original.duration));
        expect(restored.issues, equals(original.issues));
        expect(restored.bestRepScore, equals(original.bestRepScore));
        expect(restored.worstRepScore, equals(original.worstRepScore));
      });

      test('toJsonがdurationをミリ秒で保存する', () {
        const record = HistorySetRecord(
          setNumber: 1,
          reps: 10,
          averageScore: 85.0,
          duration: Duration(seconds: 90),
          issues: [],
        );

        final json = record.toJson();
        expect(json['durationMs'], equals(90000));
      });

      test('fromJsonがnullのbestRepScoreとworstRepScoreを処理する', () {
        final json = {
          'setNumber': 1,
          'reps': 10,
          'averageScore': 85.0,
          'durationMs': 60000,
          'issues': <String>[],
          'bestRepScore': null,
          'worstRepScore': null,
        };

        final record = HistorySetRecord.fromJson(json);
        expect(record.bestRepScore, isNull);
        expect(record.worstRepScore, isNull);
      });
    });
  });

  group('BodyCondition', () {
    group('JSON serialization', () {
      test('toJsonとfromJsonが正しくラウンドトリップする', () {
        const original = BodyCondition(
          energyLevel: 4,
          sleepQuality: 3,
          muscleStiffness: 2,
          notes: 'Test notes',
        );

        final json = original.toJson();
        final restored = BodyCondition.fromJson(json);

        expect(restored.energyLevel, equals(original.energyLevel));
        expect(restored.sleepQuality, equals(original.sleepQuality));
        expect(restored.muscleStiffness, equals(original.muscleStiffness));
        expect(restored.notes, equals(original.notes));
      });

      test('fromJsonがデフォルト値を使用する', () {
        final json = <String, dynamic>{};

        final condition = BodyCondition.fromJson(json);
        expect(condition.energyLevel, equals(3));
        expect(condition.sleepQuality, equals(3));
        expect(condition.muscleStiffness, equals(3));
        expect(condition.notes, isNull);
      });

      test('デフォルトコンストラクタが正しいデフォルト値を持つ', () {
        const condition = BodyCondition();
        expect(condition.energyLevel, equals(3));
        expect(condition.sleepQuality, equals(3));
        expect(condition.muscleStiffness, equals(3));
        expect(condition.notes, isNull);
      });
    });
  });

  group('DailySummary', () {
    group('intensityLevel calculation', () {
      test('intensityLevelが3セッション以上でレベル3を返す', () {
        final summary = DailySummary(
          date: DateTime(2025, 1, 15),
          sessionCount: 3,
          totalReps: 20,
          averageScore: 80.0,
          exerciseTypes: [ExerciseType.squat],
        );

        expect(summary.intensityLevel, equals(3));
      });

      test('intensityLevelが50レップ以上でレベル3を返す', () {
        final summary = DailySummary(
          date: DateTime(2025, 1, 15),
          sessionCount: 1,
          totalReps: 50,
          averageScore: 80.0,
          exerciseTypes: [ExerciseType.squat],
        );

        expect(summary.intensityLevel, equals(3));
      });

      test('intensityLevelが2セッションでレベル2を返す', () {
        final summary = DailySummary(
          date: DateTime(2025, 1, 15),
          sessionCount: 2,
          totalReps: 20,
          averageScore: 80.0,
          exerciseTypes: [ExerciseType.squat, ExerciseType.armCurl],
        );

        expect(summary.intensityLevel, equals(2));
      });

      test('intensityLevelが25-49レップでレベル2を返す', () {
        final summary = DailySummary(
          date: DateTime(2025, 1, 15),
          sessionCount: 1,
          totalReps: 30,
          averageScore: 80.0,
          exerciseTypes: [ExerciseType.squat],
        );

        expect(summary.intensityLevel, equals(2));
      });

      test('intensityLevelが低強度でレベル1を返す', () {
        final summary = DailySummary(
          date: DateTime(2025, 1, 15),
          sessionCount: 1,
          totalReps: 15,
          averageScore: 80.0,
          exerciseTypes: [ExerciseType.squat],
        );

        expect(summary.intensityLevel, equals(1));
      });
    });
  });

  group('WeeklyStats', () {
    group('activeDays calculation', () {
      test('activeDaysがセッションのある日数を正しくカウントする', () {
        final stats = WeeklyStats(
          weekStart: DateTime(2025, 1, 13), // Monday
          totalSessions: 5,
          totalReps: 200,
          totalSets: 20,
          totalDuration: const Duration(hours: 2),
          averageScore: 85.0,
          exerciseBreakdown: {ExerciseType.squat: 5},
          dailySummaries: [
            DailySummary(
              date: DateTime(2025, 1, 13),
              sessionCount: 2,
              totalReps: 40,
              averageScore: 85.0,
              exerciseTypes: [ExerciseType.squat],
            ),
            DailySummary(
              date: DateTime(2025, 1, 14),
              sessionCount: 0, // Rest day
              totalReps: 0,
              averageScore: 0,
              exerciseTypes: [],
            ),
            DailySummary(
              date: DateTime(2025, 1, 15),
              sessionCount: 2,
              totalReps: 80,
              averageScore: 87.0,
              exerciseTypes: [ExerciseType.squat],
            ),
            DailySummary(
              date: DateTime(2025, 1, 17),
              sessionCount: 1,
              totalReps: 40,
              averageScore: 82.0,
              exerciseTypes: [ExerciseType.squat],
            ),
          ],
        );

        expect(stats.activeDays, equals(3));
      });

      test('activeDaysがセッションなしで0を返す', () {
        final stats = WeeklyStats(
          weekStart: DateTime(2025, 1, 13),
          totalSessions: 0,
          totalReps: 0,
          totalSets: 0,
          totalDuration: Duration.zero,
          averageScore: 0,
          exerciseBreakdown: {},
          dailySummaries: [
            DailySummary(
              date: DateTime(2025, 1, 13),
              sessionCount: 0,
              totalReps: 0,
              averageScore: 0,
              exerciseTypes: [],
            ),
          ],
        );

        expect(stats.activeDays, equals(0));
      });

      test('activeDaysが全日アクティブで正しい値を返す', () {
        final summaries = List.generate(
          7,
          (i) => DailySummary(
            date: DateTime(2025, 1, 13 + i),
            sessionCount: 1,
            totalReps: 30,
            averageScore: 85.0,
            exerciseTypes: [ExerciseType.squat],
          ),
        );

        final stats = WeeklyStats(
          weekStart: DateTime(2025, 1, 13),
          totalSessions: 7,
          totalReps: 210,
          totalSets: 21,
          totalDuration: const Duration(hours: 3, minutes: 30),
          averageScore: 85.0,
          exerciseBreakdown: {ExerciseType.squat: 7},
          dailySummaries: summaries,
        );

        expect(stats.activeDays, equals(7));
      });
    });
  });

  group('MonthlyStats', () {
    group('activeDays calculation', () {
      test('activeDaysが週間統計を集計して正しくカウントする', () {
        final stats = MonthlyStats(
          year: 2025,
          month: 1,
          totalSessions: 15,
          totalReps: 600,
          totalSets: 60,
          totalDuration: const Duration(hours: 6),
          averageScore: 82.0,
          exerciseBreakdown: {
            ExerciseType.squat: 8,
            ExerciseType.armCurl: 7,
          },
          weeklyStats: [
            WeeklyStats(
              weekStart: DateTime(2025, 1, 6),
              totalSessions: 3,
              totalReps: 120,
              totalSets: 12,
              totalDuration: const Duration(hours: 1, minutes: 30),
              averageScore: 80.0,
              exerciseBreakdown: {ExerciseType.squat: 3},
              dailySummaries: [
                DailySummary(
                  date: DateTime(2025, 1, 6),
                  sessionCount: 1,
                  totalReps: 40,
                  averageScore: 80.0,
                  exerciseTypes: [ExerciseType.squat],
                ),
                DailySummary(
                  date: DateTime(2025, 1, 8),
                  sessionCount: 2,
                  totalReps: 80,
                  averageScore: 80.0,
                  exerciseTypes: [ExerciseType.squat],
                ),
              ],
            ),
            WeeklyStats(
              weekStart: DateTime(2025, 1, 13),
              totalSessions: 4,
              totalReps: 160,
              totalSets: 16,
              totalDuration: const Duration(hours: 2),
              averageScore: 83.0,
              exerciseBreakdown: {ExerciseType.squat: 2, ExerciseType.armCurl: 2},
              dailySummaries: [
                DailySummary(
                  date: DateTime(2025, 1, 13),
                  sessionCount: 1,
                  totalReps: 40,
                  averageScore: 83.0,
                  exerciseTypes: [ExerciseType.squat],
                ),
                DailySummary(
                  date: DateTime(2025, 1, 15),
                  sessionCount: 2,
                  totalReps: 80,
                  averageScore: 84.0,
                  exerciseTypes: [ExerciseType.armCurl],
                ),
                DailySummary(
                  date: DateTime(2025, 1, 17),
                  sessionCount: 1,
                  totalReps: 40,
                  averageScore: 82.0,
                  exerciseTypes: [ExerciseType.squat],
                ),
              ],
            ),
          ],
          streakDays: 5,
          bestStreakDays: 7,
        );

        // Week 1: 2 active days, Week 2: 3 active days
        expect(stats.activeDays, equals(5));
      });

      test('activeDaysが空の週間統計で0を返す', () {
        final stats = MonthlyStats(
          year: 2025,
          month: 1,
          totalSessions: 0,
          totalReps: 0,
          totalSets: 0,
          totalDuration: Duration.zero,
          averageScore: 0,
          exerciseBreakdown: {},
          weeklyStats: [],
          streakDays: 0,
          bestStreakDays: 0,
        );

        expect(stats.activeDays, equals(0));
      });
    });
  });

  group('HistoryFilter', () {
    group('isEmpty check', () {
      test('isEmptyが全てnullでtrueを返す', () {
        const filter = HistoryFilter();
        expect(filter.isEmpty, isTrue);
      });

      test('isEmptyがstartDateが設定されている場合falseを返す', () {
        final filter = HistoryFilter(startDate: DateTime(2025, 1, 1));
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyがendDateが設定されている場合falseを返す', () {
        final filter = HistoryFilter(endDate: DateTime(2025, 1, 31));
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyがexerciseTypesが設定されている場合falseを返す', () {
        const filter = HistoryFilter(
          exerciseTypes: [ExerciseType.squat],
        );
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyが空のexerciseTypesリストでtrueを返す', () {
        const filter = HistoryFilter(exerciseTypes: []);
        expect(filter.isEmpty, isTrue);
      });

      test('isEmptyがminScoreが設定されている場合falseを返す', () {
        const filter = HistoryFilter(minScore: 70.0);
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyがmaxScoreが設定されている場合falseを返す', () {
        const filter = HistoryFilter(maxScore: 95.0);
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyがtagsが設定されている場合falseを返す', () {
        const filter = HistoryFilter(tags: ['morning']);
        expect(filter.isEmpty, isFalse);
      });

      test('isEmptyが空のtagsリストでtrueを返す', () {
        const filter = HistoryFilter(tags: []);
        expect(filter.isEmpty, isTrue);
      });
    });

    group('copyWith functionality', () {
      test('copyWithが指定フィールドのみ更新する', () {
        final original = HistoryFilter(
          startDate: DateTime(2025, 1, 1),
          endDate: DateTime(2025, 1, 31),
          exerciseTypes: const [ExerciseType.squat],
          minScore: 60.0,
        );

        final updated = original.copyWith(
          minScore: 70.0,
          maxScore: 95.0,
        );

        expect(updated.startDate, equals(original.startDate));
        expect(updated.endDate, equals(original.endDate));
        expect(updated.exerciseTypes, equals(original.exerciseTypes));
        expect(updated.minScore, equals(70.0));
        expect(updated.maxScore, equals(95.0));
      });

      test('copyWithが全フィールドを更新できる', () {
        const original = HistoryFilter();
        final newStartDate = DateTime(2025, 2, 1);
        final newEndDate = DateTime(2025, 2, 28);

        final updated = original.copyWith(
          startDate: newStartDate,
          endDate: newEndDate,
          exerciseTypes: [ExerciseType.armCurl, ExerciseType.pushUp],
          minScore: 50.0,
          maxScore: 100.0,
          tags: ['evening', 'light'],
        );

        expect(updated.startDate, equals(newStartDate));
        expect(updated.endDate, equals(newEndDate));
        expect(updated.exerciseTypes?.length, equals(2));
        expect(updated.minScore, equals(50.0));
        expect(updated.maxScore, equals(100.0));
        expect(updated.tags, equals(['evening', 'light']));
      });
    });
  });

  group('ExerciseStats', () {
    test('ExerciseStatsが正しくデータを保持する', () {
      final stats = ExerciseStats(
        exerciseType: ExerciseType.squat,
        totalSessions: 20,
        totalReps: 500,
        averageScore: 82.5,
        bestScore: 96.0,
        scoreImprovement: 15.5,
        scoreHistory: [
          ProgressDataPoint(
            date: DateTime(2025, 1, 1),
            value: 75.0,
            exerciseType: ExerciseType.squat,
          ),
          ProgressDataPoint(
            date: DateTime(2025, 1, 15),
            value: 85.0,
            exerciseType: ExerciseType.squat,
          ),
        ],
        commonIssues: ['knee_over_toe', 'back_rounding'],
      );

      expect(stats.exerciseType, equals(ExerciseType.squat));
      expect(stats.totalSessions, equals(20));
      expect(stats.totalReps, equals(500));
      expect(stats.averageScore, equals(82.5));
      expect(stats.bestScore, equals(96.0));
      expect(stats.scoreImprovement, equals(15.5));
      expect(stats.scoreHistory.length, equals(2));
      expect(stats.commonIssues.length, equals(2));
    });
  });

  group('ProgressDataPoint', () {
    test('ProgressDataPointが正しくデータを保持する', () {
      final point = ProgressDataPoint(
        date: DateTime(2025, 1, 15),
        value: 87.5,
        exerciseType: ExerciseType.armCurl,
      );

      expect(point.date, equals(DateTime(2025, 1, 15)));
      expect(point.value, equals(87.5));
      expect(point.exerciseType, equals(ExerciseType.armCurl));
    });

    test('ProgressDataPointがexerciseType nullで作成できる', () {
      final point = ProgressDataPoint(
        date: DateTime(2025, 1, 15),
        value: 85.0,
      );

      expect(point.exerciseType, isNull);
    });
  });

  group('AnalysisPeriod', () {
    test('AnalysisPeriodが全ての期間を持つ', () {
      expect(AnalysisPeriod.values.length, equals(5));
      expect(AnalysisPeriod.values, contains(AnalysisPeriod.week));
      expect(AnalysisPeriod.values, contains(AnalysisPeriod.month));
      expect(AnalysisPeriod.values, contains(AnalysisPeriod.threeMonths));
      expect(AnalysisPeriod.values, contains(AnalysisPeriod.year));
      expect(AnalysisPeriod.values, contains(AnalysisPeriod.custom));
    });
  });
}
