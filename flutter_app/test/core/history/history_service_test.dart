// History Service Unit Tests
//
// Tests for history service Firestore operations.
// Reference: docs/tickets/012_history_analytics.md
//
// Test coverage:
// - fetchSessions with various filters
// - fetchSessionsForDate
// - fetchDailySummaries aggregation
// - fetchWeeklyStats calculation
// - fetchMonthlyStats calculation
// - _calculateStreak logic (current streak, best streak)
// - fetchExerciseStats
// - saveSessionNote, saveSessionTags, saveBodyCondition
// - deleteSession
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter_test/flutter_test.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';

import 'package:flutter_app/core/history/history_models.dart';
import 'package:flutter_app/core/history/history_service.dart';
import 'package:flutter_app/core/form_analyzer/form_analyzer.dart';

void main() {
  late FakeFirebaseFirestore fakeFirestore;
  late HistoryService historyService;
  const testUserId = 'test-user-123';

  setUp(() {
    fakeFirestore = FakeFirebaseFirestore();
    historyService = HistoryService(fakeFirestore);
  });

  /// Helper function to create test session data
  Future<void> createTestSession({
    required String id,
    required String userId,
    required ExerciseType exerciseType,
    required DateTime startTime,
    required DateTime endTime,
    required int totalReps,
    required int totalSets,
    required double averageScore,
    List<Map<String, dynamic>>? sets,
    String? note,
    List<String>? tags,
  }) async {
    await fakeFirestore
        .collection('users')
        .doc(userId)
        .collection('sessions')
        .doc(id)
        .set({
      'id': id,
      'userId': userId,
      'exerciseType': exerciseType.name,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'totalReps': totalReps,
      'totalSets': totalSets,
      'averageScore': averageScore,
      'sets': sets ?? [],
      'note': note,
      'tags': tags,
    });
  }

  /// Helper to create multiple sessions for a date range
  Future<void> createSessionsForDateRange({
    required String userId,
    required DateTime startDate,
    required int days,
    bool skipDays = false,
  }) async {
    for (var i = 0; i < days; i++) {
      if (skipDays && i % 2 == 1) continue; // Skip odd days

      final date = startDate.add(Duration(days: i));
      await createTestSession(
        id: 'session-$i',
        userId: userId,
        exerciseType: i % 2 == 0 ? ExerciseType.squat : ExerciseType.armCurl,
        startTime: DateTime(date.year, date.month, date.day, 10, 0),
        endTime: DateTime(date.year, date.month, date.day, 10, 30),
        totalReps: 30 + i * 5,
        totalSets: 3,
        averageScore: 75.0 + i * 2,
        sets: [
          {
            'setNumber': 1,
            'reps': 10,
            'averageScore': 75.0 + i * 2,
            'durationMs': 300000,
            'issues': ['issue_$i'],
          }
        ],
      );
    }
  }

  group('fetchSessions', () {
    test('フィルタなしで全セッションを取得する', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 16, 10, 0),
        endTime: DateTime(2025, 1, 16, 10, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      final sessions = await historyService.fetchSessions(userId: testUserId);

      expect(sessions.length, equals(2));
    });

    test('開始日フィルタでセッションをフィルタリングする', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 10, 10, 0),
        endTime: DateTime(2025, 1, 10, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 20, 10, 0),
        endTime: DateTime(2025, 1, 20, 10, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      final sessions = await historyService.fetchSessions(
        userId: testUserId,
        filter: HistoryFilter(startDate: DateTime(2025, 1, 15)),
      );

      expect(sessions.length, equals(1));
      expect(sessions.first.id, equals('session-2'));
    });

    test('終了日フィルタでセッションをフィルタリングする', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 10, 10, 0),
        endTime: DateTime(2025, 1, 10, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 20, 10, 0),
        endTime: DateTime(2025, 1, 20, 10, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      final sessions = await historyService.fetchSessions(
        userId: testUserId,
        filter: HistoryFilter(endDate: DateTime(2025, 1, 15)),
      );

      expect(sessions.length, equals(1));
      expect(sessions.first.id, equals('session-1'));
    });

    test('種目タイプでセッションをフィルタリングする', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 16, 10, 0),
        endTime: DateTime(2025, 1, 16, 10, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      await createTestSession(
        id: 'session-3',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 17, 10, 0),
        endTime: DateTime(2025, 1, 17, 10, 30),
        totalReps: 45,
        totalSets: 5,
        averageScore: 82.0,
      );

      final sessions = await historyService.fetchSessions(
        userId: testUserId,
        filter: const HistoryFilter(exerciseTypes: [ExerciseType.squat]),
      );

      expect(sessions.length, equals(2));
      expect(sessions.every((s) => s.exerciseType == ExerciseType.squat), isTrue);
    });

    test('スコアレンジでセッションをフィルタリングする（クライアントサイド）', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 65.0, // Below min
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 16, 10, 0),
        endTime: DateTime(2025, 1, 16, 10, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0, // Within range
      );

      await createTestSession(
        id: 'session-3',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 17, 10, 0),
        endTime: DateTime(2025, 1, 17, 10, 30),
        totalReps: 45,
        totalSets: 5,
        averageScore: 95.0, // Above max
      );

      final sessions = await historyService.fetchSessions(
        userId: testUserId,
        filter: const HistoryFilter(minScore: 70.0, maxScore: 90.0),
      );

      expect(sessions.length, equals(1));
      expect(sessions.first.id, equals('session-2'));
    });

    test('リミットでセッション数を制限する', () async {
      for (var i = 0; i < 10; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 15 + i, 10, 0),
          endTime: DateTime(2025, 1, 15 + i, 10, 30),
          totalReps: 50,
          totalSets: 5,
          averageScore: 80.0 + i,
        );
      }

      final sessions = await historyService.fetchSessions(
        userId: testUserId,
        limit: 5,
      );

      expect(sessions.length, equals(5));
    });

    test('セッションがない場合空リストを返す', () async {
      final sessions = await historyService.fetchSessions(userId: testUserId);
      expect(sessions, isEmpty);
    });
  });

  group('fetchSession (single)', () {
    test('IDで単一セッションを取得する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
        note: 'Great workout!',
      );

      final session = await historyService.fetchSession(
        userId: testUserId,
        sessionId: 'session-123',
      );

      expect(session, isNotNull);
      expect(session!.id, equals('session-123'));
      expect(session.note, equals('Great workout!'));
    });

    test('存在しないセッションでnullを返す', () async {
      final session = await historyService.fetchSession(
        userId: testUserId,
        sessionId: 'non-existent',
      );

      expect(session, isNull);
    });
  });

  group('fetchSessionsForDate', () {
    test('指定日のセッションのみを取得する', () async {
      // Create sessions on different days
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 8, 0),
        endTime: DateTime(2025, 1, 15, 8, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 15, 18, 0),
        endTime: DateTime(2025, 1, 15, 18, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      await createTestSession(
        id: 'session-3',
        userId: testUserId,
        exerciseType: ExerciseType.pushUp,
        startTime: DateTime(2025, 1, 16, 10, 0),
        endTime: DateTime(2025, 1, 16, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 75.0,
      );

      final sessions = await historyService.fetchSessionsForDate(
        userId: testUserId,
        date: DateTime(2025, 1, 15),
      );

      expect(sessions.length, equals(2));
      expect(sessions.every((s) => s.startTime.day == 15), isTrue);
    });

    test('該当日にセッションがない場合空リストを返す', () async {
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      final sessions = await historyService.fetchSessionsForDate(
        userId: testUserId,
        date: DateTime(2025, 1, 20),
      );

      expect(sessions, isEmpty);
    });
  });

  group('fetchDailySummaries', () {
    test('日付範囲内のサマリーを集計する', () async {
      await createSessionsForDateRange(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        days: 7,
      );

      final summaries = await historyService.fetchDailySummaries(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        endDate: DateTime(2025, 1, 7),
      );

      expect(summaries.isNotEmpty, isTrue);
      expect(summaries.every((s) => s.sessionCount > 0), isTrue);
    });

    test('日付ごとにセッションをグループ化する', () async {
      // Two sessions on the same day
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 8, 0),
        endTime: DateTime(2025, 1, 15, 8, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: DateTime(2025, 1, 15, 18, 0),
        endTime: DateTime(2025, 1, 15, 18, 30),
        totalReps: 40,
        totalSets: 4,
        averageScore: 80.0,
      );

      final summaries = await historyService.fetchDailySummaries(
        userId: testUserId,
        startDate: DateTime(2025, 1, 15),
        endDate: DateTime(2025, 1, 15, 23, 59, 59),
      );

      expect(summaries.length, equals(1));
      expect(summaries.first.sessionCount, equals(2));
      expect(summaries.first.totalReps, equals(90));
      expect(summaries.first.exerciseTypes.length, equals(2));
    });

    test('サマリーが日付降順でソートされる', () async {
      await createSessionsForDateRange(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        days: 5,
      );

      final summaries = await historyService.fetchDailySummaries(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        endDate: DateTime(2025, 1, 5),
      );

      for (var i = 0; i < summaries.length - 1; i++) {
        expect(
          summaries[i].date.isAfter(summaries[i + 1].date) ||
              summaries[i].date.isAtSameMomentAs(summaries[i + 1].date),
          isTrue,
        );
      }
    });

    test('範囲内にセッションがない場合空リストを返す', () async {
      final summaries = await historyService.fetchDailySummaries(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        endDate: DateTime(2025, 1, 31),
      );

      expect(summaries, isEmpty);
    });
  });

  group('fetchWeeklyStats', () {
    test('週間統計を正しく計算する', () async {
      final weekStart = DateTime(2025, 1, 13); // Monday

      for (var i = 0; i < 5; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: weekStart.add(Duration(days: i, hours: 10)),
          endTime: weekStart.add(Duration(days: i, hours: 10, minutes: 30)),
          totalReps: 30 + i * 5,
          totalSets: 3,
          averageScore: 80.0 + i,
        );
      }

      final stats = await historyService.fetchWeeklyStats(
        userId: testUserId,
        weekStart: weekStart,
      );

      expect(stats.totalSessions, equals(5));
      expect(stats.weekStart, equals(weekStart));
      expect(stats.exerciseBreakdown[ExerciseType.squat], equals(5));
    });

    test('週間統計の合計レップ数を正しく計算する', () async {
      final weekStart = DateTime(2025, 1, 13);

      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: weekStart.add(const Duration(hours: 10)),
        endTime: weekStart.add(const Duration(hours: 10, minutes: 30)),
        totalReps: 30,
        totalSets: 3,
        averageScore: 80.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        startTime: weekStart.add(const Duration(days: 1, hours: 10)),
        endTime: weekStart.add(const Duration(days: 1, hours: 10, minutes: 30)),
        totalReps: 40,
        totalSets: 4,
        averageScore: 85.0,
      );

      final stats = await historyService.fetchWeeklyStats(
        userId: testUserId,
        weekStart: weekStart,
      );

      expect(stats.totalReps, equals(70));
      expect(stats.totalSets, equals(7));
    });

    test('セッションなしの週で0値を返す', () async {
      final stats = await historyService.fetchWeeklyStats(
        userId: testUserId,
        weekStart: DateTime(2025, 1, 13),
      );

      expect(stats.totalSessions, equals(0));
      expect(stats.totalReps, equals(0));
      expect(stats.totalSets, equals(0));
      expect(stats.averageScore, equals(0));
    });
  });

  group('fetchMonthlyStats', () {
    test('月間統計を正しく計算する', () async {
      // Create sessions across the month
      await createSessionsForDateRange(
        userId: testUserId,
        startDate: DateTime(2025, 1, 1),
        days: 15,
        skipDays: true,
      );

      final stats = await historyService.fetchMonthlyStats(
        userId: testUserId,
        year: 2025,
        month: 1,
      );

      expect(stats.year, equals(2025));
      expect(stats.month, equals(1));
      expect(stats.totalSessions, greaterThan(0));
    });

    test('月間統計のストリーク日数を正しく計算する', () async {
      // Create consecutive day sessions
      for (var i = 0; i < 7; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime(2025, 1, 10 + i, 10, 0),
          endTime: DateTime(2025, 1, 10 + i, 10, 30),
          totalReps: 30,
          totalSets: 3,
          averageScore: 80.0,
        );
      }

      final stats = await historyService.fetchMonthlyStats(
        userId: testUserId,
        year: 2025,
        month: 1,
      );

      expect(stats.bestStreakDays, greaterThanOrEqualTo(7));
    });
  });

  group('_calculateStreak', () {
    // Note: _calculateStreak is private, so we test it through fetchMonthlyStats

    test('空のセッションリストでストリーク0を返す', () async {
      final stats = await historyService.fetchMonthlyStats(
        userId: testUserId,
        year: 2025,
        month: 1,
      );

      expect(stats.streakDays, equals(0));
      expect(stats.bestStreakDays, equals(0));
    });

    test('連続しない日のセッションでストリーク1を返す', () async {
      // Sessions on non-consecutive days
      await createTestSession(
        id: 'session-1',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 1, 10, 0),
        endTime: DateTime(2025, 1, 1, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 80.0,
      );

      await createTestSession(
        id: 'session-2',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 5, 10, 0),
        endTime: DateTime(2025, 1, 5, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 80.0,
      );

      await createTestSession(
        id: 'session-3',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 10, 10, 0),
        endTime: DateTime(2025, 1, 10, 10, 30),
        totalReps: 30,
        totalSets: 3,
        averageScore: 80.0,
      );

      final stats = await historyService.fetchMonthlyStats(
        userId: testUserId,
        year: 2025,
        month: 1,
      );

      expect(stats.bestStreakDays, equals(1));
    });
  });

  group('fetchExerciseStats', () {
    test('種目別統計を正しく計算する', () async {
      // Create sessions for squat
      for (var i = 0; i < 5; i++) {
        await createTestSession(
          id: 'squat-session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30 + i * 5,
          totalSets: 3,
          averageScore: 75.0 + i * 3,
          sets: [
            {
              'setNumber': 1,
              'reps': 10,
              'averageScore': 75.0 + i * 3,
              'durationMs': 300000,
              'issues': ['knee_over_toe'],
            }
          ],
        );
      }

      final stats = await historyService.fetchExerciseStats(
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        period: AnalysisPeriod.month,
      );

      expect(stats.exerciseType, equals(ExerciseType.squat));
      expect(stats.totalSessions, equals(5));
      expect(stats.totalReps, greaterThan(0));
      expect(stats.averageScore, greaterThan(0));
    });

    test('スコア改善率を正しく計算する', () async {
      // Create sessions with improving scores
      for (var i = 0; i < 10; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.armCurl,
          startTime: DateTime.now().subtract(Duration(days: 10 - i)),
          endTime: DateTime.now().subtract(Duration(days: 10 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 70.0 + i * 2, // Improving from 70 to 88
          sets: [
            {
              'setNumber': 1,
              'reps': 10,
              'averageScore': 70.0 + i * 2,
              'durationMs': 300000,
              'issues': [],
            }
          ],
        );
      }

      final stats = await historyService.fetchExerciseStats(
        userId: testUserId,
        exerciseType: ExerciseType.armCurl,
        period: AnalysisPeriod.month,
      );

      expect(stats.scoreImprovement, greaterThan(0));
    });

    test('セッションがない種目で空の統計を返す', () async {
      final stats = await historyService.fetchExerciseStats(
        userId: testUserId,
        exerciseType: ExerciseType.pushUp,
        period: AnalysisPeriod.month,
      );

      expect(stats.totalSessions, equals(0));
      expect(stats.totalReps, equals(0));
      expect(stats.averageScore, equals(0));
      expect(stats.scoreImprovement, equals(0));
      expect(stats.scoreHistory, isEmpty);
      expect(stats.commonIssues, isEmpty);
    });

    test('一般的な問題を正しく抽出する', () async {
      for (var i = 0; i < 5; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 80.0,
          sets: [
            {
              'setNumber': 1,
              'reps': 10,
              'averageScore': 80.0,
              'durationMs': 300000,
              'issues': ['knee_over_toe', 'back_rounding'],
            },
            {
              'setNumber': 2,
              'reps': 10,
              'averageScore': 80.0,
              'durationMs': 300000,
              'issues': ['knee_over_toe'],
            },
          ],
        );
      }

      final stats = await historyService.fetchExerciseStats(
        userId: testUserId,
        exerciseType: ExerciseType.squat,
      );

      expect(stats.commonIssues, isNotEmpty);
      expect(stats.commonIssues.first, equals('knee_over_toe'));
    });
  });

  group('saveSessionNote', () {
    test('セッションにメモを保存する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await historyService.saveSessionNote(
        userId: testUserId,
        sessionId: 'session-123',
        note: 'Felt great today!',
      );

      final doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();

      expect(doc.data()!['note'], equals('Felt great today!'));
    });

    test('既存のメモを更新する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
        note: 'Original note',
      );

      await historyService.saveSessionNote(
        userId: testUserId,
        sessionId: 'session-123',
        note: 'Updated note',
      );

      final doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();

      expect(doc.data()!['note'], equals('Updated note'));
    });
  });

  group('saveSessionTags', () {
    test('セッションにタグを保存する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await historyService.saveSessionTags(
        userId: testUserId,
        sessionId: 'session-123',
        tags: ['morning', 'heavy', 'leg-day'],
      );

      final doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();

      expect(doc.data()!['tags'], equals(['morning', 'heavy', 'leg-day']));
    });

    test('タグを空リストで更新できる', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
        tags: ['morning', 'heavy'],
      );

      await historyService.saveSessionTags(
        userId: testUserId,
        sessionId: 'session-123',
        tags: [],
      );

      final doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();

      expect(doc.data()!['tags'], isEmpty);
    });
  });

  group('saveBodyCondition', () {
    test('セッションに体調情報を保存する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      await historyService.saveBodyCondition(
        userId: testUserId,
        sessionId: 'session-123',
        condition: const BodyCondition(
          energyLevel: 5,
          sleepQuality: 4,
          muscleStiffness: 2,
          notes: 'Slept well last night',
        ),
      );

      final doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();

      final bodyCondition = doc.data()!['bodyCondition'] as Map<String, dynamic>;
      expect(bodyCondition['energyLevel'], equals(5));
      expect(bodyCondition['sleepQuality'], equals(4));
      expect(bodyCondition['muscleStiffness'], equals(2));
      expect(bodyCondition['notes'], equals('Slept well last night'));
    });
  });

  group('deleteSession', () {
    test('セッションを削除する', () async {
      await createTestSession(
        id: 'session-123',
        userId: testUserId,
        exerciseType: ExerciseType.squat,
        startTime: DateTime(2025, 1, 15, 10, 0),
        endTime: DateTime(2025, 1, 15, 10, 30),
        totalReps: 50,
        totalSets: 5,
        averageScore: 85.0,
      );

      // Verify session exists
      var doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();
      expect(doc.exists, isTrue);

      // Delete session
      await historyService.deleteSession(
        userId: testUserId,
        sessionId: 'session-123',
      );

      // Verify session is deleted
      doc = await fakeFirestore
          .collection('users')
          .doc(testUserId)
          .collection('sessions')
          .doc('session-123')
          .get();
      expect(doc.exists, isFalse);
    });

    test('存在しないセッションの削除でエラーにならない', () async {
      // Should not throw
      await historyService.deleteSession(
        userId: testUserId,
        sessionId: 'non-existent',
      );
    });
  });

  group('fetchScoreProgress', () {
    test('スコア推移データを取得する', () async {
      for (var i = 0; i < 5; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 70.0 + i * 5,
        );
      }

      final progress = await historyService.fetchScoreProgress(
        userId: testUserId,
        period: AnalysisPeriod.week,
      );

      expect(progress, isNotEmpty);
      expect(progress.every((p) => p.value > 0), isTrue);
    });

    test('種目でフィルタリングしたスコア推移を取得する', () async {
      // Create squat sessions
      for (var i = 0; i < 3; i++) {
        await createTestSession(
          id: 'squat-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 80.0,
        );
      }

      // Create arm curl sessions
      for (var i = 0; i < 3; i++) {
        await createTestSession(
          id: 'curl-$i',
          userId: testUserId,
          exerciseType: ExerciseType.armCurl,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 85.0,
        );
      }

      final progress = await historyService.fetchScoreProgress(
        userId: testUserId,
        period: AnalysisPeriod.week,
        exerciseType: ExerciseType.squat,
      );

      expect(progress.length, equals(3));
      expect(progress.every((p) => p.exerciseType == ExerciseType.squat), isTrue);
    });

    test('日付順にソートされたデータを返す', () async {
      for (var i = 0; i < 5; i++) {
        await createTestSession(
          id: 'session-$i',
          userId: testUserId,
          exerciseType: ExerciseType.squat,
          startTime: DateTime.now().subtract(Duration(days: 5 - i)),
          endTime: DateTime.now().subtract(Duration(days: 5 - i, minutes: -30)),
          totalReps: 30,
          totalSets: 3,
          averageScore: 80.0,
        );
      }

      final progress = await historyService.fetchScoreProgress(
        userId: testUserId,
        period: AnalysisPeriod.week,
      );

      for (var i = 0; i < progress.length - 1; i++) {
        expect(
          progress[i].date.isBefore(progress[i + 1].date) ||
              progress[i].date.isAtSameMomentAs(progress[i + 1].date),
          isTrue,
        );
      }
    });
  });
}
