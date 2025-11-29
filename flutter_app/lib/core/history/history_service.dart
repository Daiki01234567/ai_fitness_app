/// History Service
///
/// Service for managing training history data from Firestore.
/// Reference: docs/tickets/012_history_analytics.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../form_analyzer/form_analyzer.dart';
import 'history_models.dart';

/// History service provider
final historyServiceProvider = Provider<HistoryService>((ref) {
  return HistoryService(FirebaseFirestore.instance);
});

/// Service for fetching and managing training history
class HistoryService {
  HistoryService(this._firestore);

  final FirebaseFirestore _firestore;

  /// Get sessions collection reference
  CollectionReference<Map<String, dynamic>> _sessionsRef(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('sessions');
  }

  /// Fetch session records with optional filter
  Future<List<HistorySession>> fetchSessions({
    required String userId,
    HistoryFilter? filter,
    int limit = 50,
    DocumentSnapshot? startAfter,
  }) async {
    Query<Map<String, dynamic>> query = _sessionsRef(userId)
        .orderBy('startTime', descending: true);

    // Apply date filters
    if (filter?.startDate != null) {
      query = query.where(
        'startTime',
        isGreaterThanOrEqualTo: filter!.startDate!.toIso8601String(),
      );
    }
    if (filter?.endDate != null) {
      query = query.where(
        'startTime',
        isLessThanOrEqualTo: filter!.endDate!.toIso8601String(),
      );
    }

    // Apply exercise type filter
    if (filter?.exerciseTypes != null && filter!.exerciseTypes!.isNotEmpty) {
      query = query.where(
        'exerciseType',
        whereIn: filter.exerciseTypes!.map((e) => e.name).toList(),
      );
    }

    // Apply pagination
    if (startAfter != null) {
      query = query.startAfterDocument(startAfter);
    }

    query = query.limit(limit);

    final snapshot = await query.get();
    return snapshot.docs
        .map((doc) => HistorySession.fromJson({...doc.data(), 'id': doc.id}))
        .where((session) {
          // Client-side filtering for score range
          final minScore = filter?.minScore;
          if (minScore != null && session.averageScore < minScore) {
            return false;
          }
          final maxScore = filter?.maxScore;
          if (maxScore != null && session.averageScore > maxScore) {
            return false;
          }
          return true;
        })
        .toList();
  }

  /// Fetch single session by ID
  Future<HistorySession?> fetchSession({
    required String userId,
    required String sessionId,
  }) async {
    final doc = await _sessionsRef(userId).doc(sessionId).get();
    if (!doc.exists) return null;
    return HistorySession.fromJson({...doc.data()!, 'id': doc.id});
  }

  /// Fetch sessions for a specific date
  Future<List<HistorySession>> fetchSessionsForDate({
    required String userId,
    required DateTime date,
  }) async {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    final snapshot = await _sessionsRef(userId)
        .where('startTime', isGreaterThanOrEqualTo: startOfDay.toIso8601String())
        .where('startTime', isLessThan: endOfDay.toIso8601String())
        .orderBy('startTime', descending: true)
        .get();

    return snapshot.docs
        .map((doc) => HistorySession.fromJson({...doc.data(), 'id': doc.id}))
        .toList();
  }

  /// Get daily summaries for a date range (for calendar view)
  Future<List<DailySummary>> fetchDailySummaries({
    required String userId,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    final sessions = await fetchSessions(
      userId: userId,
      filter: HistoryFilter(startDate: startDate, endDate: endDate),
      limit: 500, // Sufficient for a month
    );

    // Group by date
    final byDate = <DateTime, List<HistorySession>>{};
    for (final session in sessions) {
      final date = DateTime(
        session.startTime.year,
        session.startTime.month,
        session.startTime.day,
      );
      byDate.putIfAbsent(date, () => []).add(session);
    }

    // Create summaries
    return byDate.entries.map((entry) {
      final date = entry.key;
      final daySessions = entry.value;
      return DailySummary(
        date: date,
        sessionCount: daySessions.length,
        totalReps: daySessions.fold<int>(0, (s, session) => s + session.totalReps),
        averageScore: daySessions.isEmpty
            ? 0
            : daySessions.map((s) => s.averageScore).reduce((a, b) => a + b) /
                daySessions.length,
        exerciseTypes: daySessions.map((s) => s.exerciseType).toSet().toList(),
      );
    }).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
  }

  /// Get weekly statistics
  Future<WeeklyStats> fetchWeeklyStats({
    required String userId,
    required DateTime weekStart,
  }) async {
    final weekEnd = weekStart.add(const Duration(days: 7));
    final sessions = await fetchSessions(
      userId: userId,
      filter: HistoryFilter(startDate: weekStart, endDate: weekEnd),
      limit: 100,
    );

    final dailySummaries = await fetchDailySummaries(
      userId: userId,
      startDate: weekStart,
      endDate: weekEnd,
    );

    // Calculate exercise breakdown
    final exerciseBreakdown = <ExerciseType, int>{};
    for (final session in sessions) {
      exerciseBreakdown[session.exerciseType] =
          (exerciseBreakdown[session.exerciseType] ?? 0) + 1;
    }

    return WeeklyStats(
      weekStart: weekStart,
      totalSessions: sessions.length,
      totalReps: sessions.fold(0, (acc, s) => acc + s.totalReps),
      totalSets: sessions.fold(0, (acc, s) => acc + s.totalSets),
      totalDuration: sessions.fold(
        Duration.zero,
        (acc, s) => acc + s.duration,
      ),
      averageScore: sessions.isEmpty
          ? 0
          : sessions.map((s) => s.averageScore).reduce((a, b) => a + b) /
              sessions.length,
      exerciseBreakdown: exerciseBreakdown,
      dailySummaries: dailySummaries,
    );
  }

  /// Get monthly statistics
  Future<MonthlyStats> fetchMonthlyStats({
    required String userId,
    required int year,
    required int month,
  }) async {
    final startDate = DateTime(year, month, 1);
    final endDate = DateTime(year, month + 1, 1);

    final sessions = await fetchSessions(
      userId: userId,
      filter: HistoryFilter(startDate: startDate, endDate: endDate),
      limit: 500,
    );

    // Calculate weekly stats for the month
    final weeklyStats = <WeeklyStats>[];
    var currentWeekStart = startDate;
    while (currentWeekStart.isBefore(endDate)) {
      // Adjust to Monday if needed
      final dayOfWeek = currentWeekStart.weekday;
      final weekStart = currentWeekStart.subtract(Duration(days: dayOfWeek - 1));

      final stats = await fetchWeeklyStats(userId: userId, weekStart: weekStart);
      weeklyStats.add(stats);

      currentWeekStart = currentWeekStart.add(const Duration(days: 7));
    }

    // Calculate exercise breakdown
    final exerciseBreakdown = <ExerciseType, int>{};
    for (final session in sessions) {
      exerciseBreakdown[session.exerciseType] =
          (exerciseBreakdown[session.exerciseType] ?? 0) + 1;
    }

    // Calculate streak
    final streakInfo = _calculateStreak(sessions);

    return MonthlyStats(
      year: year,
      month: month,
      totalSessions: sessions.length,
      totalReps: sessions.fold(0, (acc, s) => acc + s.totalReps),
      totalSets: sessions.fold(0, (acc, s) => acc + s.totalSets),
      totalDuration: sessions.fold(
        Duration.zero,
        (acc, s) => acc + s.duration,
      ),
      averageScore: sessions.isEmpty
          ? 0
          : sessions.map((s) => s.averageScore).reduce((a, b) => a + b) /
              sessions.length,
      exerciseBreakdown: exerciseBreakdown,
      weeklyStats: weeklyStats,
      streakDays: streakInfo.$1,
      bestStreakDays: streakInfo.$2,
    );
  }

  /// Calculate current and best streak from sessions
  (int currentStreak, int bestStreak) _calculateStreak(List<HistorySession> sessions) {
    if (sessions.isEmpty) return (0, 0);

    // Get unique dates
    final dates = sessions
        .map((s) => DateTime(s.startTime.year, s.startTime.month, s.startTime.day))
        .toSet()
        .toList()
      ..sort((a, b) => b.compareTo(a)); // Most recent first

    if (dates.isEmpty) return (0, 0);

    // Calculate current streak
    var currentStreak = 1;
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);

    // Check if there's activity today or yesterday
    final mostRecent = dates.first;
    final daysSinceLastActivity = todayDate.difference(mostRecent).inDays;
    if (daysSinceLastActivity > 1) {
      currentStreak = 0;
    } else {
      for (var i = 0; i < dates.length - 1; i++) {
        final diff = dates[i].difference(dates[i + 1]).inDays;
        if (diff == 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate best streak
    var bestStreak = 1;
    var tempStreak = 1;
    for (var i = 0; i < dates.length - 1; i++) {
      final diff = dates[i].difference(dates[i + 1]).inDays;
      if (diff == 1) {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        tempStreak = 1;
      }
    }

    return (currentStreak, bestStreak);
  }

  /// Get exercise-specific statistics
  Future<ExerciseStats> fetchExerciseStats({
    required String userId,
    required ExerciseType exerciseType,
    AnalysisPeriod period = AnalysisPeriod.month,
  }) async {
    final now = DateTime.now();
    DateTime startDate;
    switch (period) {
      case AnalysisPeriod.week:
        startDate = now.subtract(const Duration(days: 7));
        break;
      case AnalysisPeriod.month:
        startDate = DateTime(now.year, now.month - 1, now.day);
        break;
      case AnalysisPeriod.threeMonths:
        startDate = DateTime(now.year, now.month - 3, now.day);
        break;
      case AnalysisPeriod.year:
        startDate = DateTime(now.year - 1, now.month, now.day);
        break;
      case AnalysisPeriod.custom:
        startDate = DateTime(now.year, now.month - 1, now.day);
        break;
    }

    final sessions = await fetchSessions(
      userId: userId,
      filter: HistoryFilter(
        startDate: startDate,
        exerciseTypes: [exerciseType],
      ),
      limit: 200,
    );

    if (sessions.isEmpty) {
      return ExerciseStats(
        exerciseType: exerciseType,
        totalSessions: 0,
        totalReps: 0,
        averageScore: 0,
        bestScore: 0,
        scoreImprovement: 0,
        scoreHistory: [],
        commonIssues: [],
      );
    }

    // Calculate score history
    final scoreHistory = sessions
        .map((s) => ProgressDataPoint(
              date: s.startTime,
              value: s.averageScore,
              exerciseType: exerciseType,
            ))
        .toList()
      ..sort((a, b) => a.date.compareTo(b.date));

    // Calculate improvement (comparing first 5 and last 5 sessions)
    double scoreImprovement = 0;
    if (sessions.length >= 5) {
      final sorted = sessions.toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
      final first5Avg = sorted.take(5).map((s) => s.averageScore).reduce((a, b) => a + b) / 5;
      final last5Avg = sorted.reversed.take(5).map((s) => s.averageScore).reduce((a, b) => a + b) / 5;
      scoreImprovement = ((last5Avg - first5Avg) / first5Avg) * 100;
    }

    // Collect common issues
    final issueCount = <String, int>{};
    for (final session in sessions) {
      for (final issue in session.primaryIssues) {
        issueCount[issue] = (issueCount[issue] ?? 0) + 1;
      }
    }
    final sortedIssues = issueCount.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final commonIssues = sortedIssues.take(5).map((e) => e.key).toList();

    return ExerciseStats(
      exerciseType: exerciseType,
      totalSessions: sessions.length,
      totalReps: sessions.fold(0, (acc, s) => acc + s.totalReps),
      averageScore: sessions.map((s) => s.averageScore).reduce((a, b) => a + b) /
          sessions.length,
      bestScore: sessions.map((s) => s.averageScore).reduce((a, b) => a > b ? a : b),
      scoreImprovement: scoreImprovement,
      scoreHistory: scoreHistory,
      commonIssues: commonIssues,
    );
  }

  /// Get score progress over time for all exercises
  Future<List<ProgressDataPoint>> fetchScoreProgress({
    required String userId,
    AnalysisPeriod period = AnalysisPeriod.month,
    ExerciseType? exerciseType,
  }) async {
    final now = DateTime.now();
    DateTime startDate;
    switch (period) {
      case AnalysisPeriod.week:
        startDate = now.subtract(const Duration(days: 7));
        break;
      case AnalysisPeriod.month:
        startDate = DateTime(now.year, now.month - 1, now.day);
        break;
      case AnalysisPeriod.threeMonths:
        startDate = DateTime(now.year, now.month - 3, now.day);
        break;
      case AnalysisPeriod.year:
        startDate = DateTime(now.year - 1, now.month, now.day);
        break;
      case AnalysisPeriod.custom:
        startDate = DateTime(now.year, now.month - 1, now.day);
        break;
    }

    final sessions = await fetchSessions(
      userId: userId,
      filter: HistoryFilter(
        startDate: startDate,
        exerciseTypes: exerciseType != null ? [exerciseType] : null,
      ),
      limit: 200,
    );

    return sessions
        .map((s) => ProgressDataPoint(
              date: s.startTime,
              value: s.averageScore,
              exerciseType: s.exerciseType,
            ))
        .toList()
      ..sort((a, b) => a.date.compareTo(b.date));
  }

  /// Save session note
  Future<void> saveSessionNote({
    required String userId,
    required String sessionId,
    required String note,
  }) async {
    await _sessionsRef(userId).doc(sessionId).update({'note': note});
  }

  /// Save session tags
  Future<void> saveSessionTags({
    required String userId,
    required String sessionId,
    required List<String> tags,
  }) async {
    await _sessionsRef(userId).doc(sessionId).update({'tags': tags});
  }

  /// Save body condition
  Future<void> saveBodyCondition({
    required String userId,
    required String sessionId,
    required BodyCondition condition,
  }) async {
    await _sessionsRef(userId).doc(sessionId).update({
      'bodyCondition': condition.toJson(),
    });
  }

  /// Delete session
  Future<void> deleteSession({
    required String userId,
    required String sessionId,
  }) async {
    await _sessionsRef(userId).doc(sessionId).delete();
  }
}
