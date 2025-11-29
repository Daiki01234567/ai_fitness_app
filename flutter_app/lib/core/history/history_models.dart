/// History Data Models
///
/// Data models for training history and analytics.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.11)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../form_analyzer/form_analyzer.dart';

/// Session history record stored in Firestore
/// Named HistorySession to avoid conflict with SessionRecord in form_analyzer
class HistorySession {
  const HistorySession({
    required this.id,
    required this.userId,
    required this.exerciseType,
    required this.startTime,
    required this.endTime,
    required this.totalReps,
    required this.totalSets,
    required this.averageScore,
    required this.sets,
    this.note,
    this.tags,
    this.bodyCondition,
  });

  final String id;
  final String userId;
  final ExerciseType exerciseType;
  final DateTime startTime;
  final DateTime endTime;
  final int totalReps;
  final int totalSets;
  final double averageScore;
  final List<HistorySetRecord> sets;
  final String? note;
  final List<String>? tags;
  final BodyCondition? bodyCondition;

  /// Calculate session duration
  Duration get duration => endTime.difference(startTime);

  /// Get the best set score
  double get bestSetScore {
    if (sets.isEmpty) return 0;
    return sets.map((s) => s.averageScore).reduce((a, b) => a > b ? a : b);
  }

  /// Get primary issues across all sets
  List<String> get primaryIssues {
    final issueCount = <String, int>{};
    for (final set in sets) {
      for (final issue in set.issues) {
        issueCount[issue] = (issueCount[issue] ?? 0) + 1;
      }
    }
    final sorted = issueCount.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return sorted.take(3).map((e) => e.key).toList();
  }

  /// Create copy with modifications
  HistorySession copyWith({
    String? id,
    String? userId,
    ExerciseType? exerciseType,
    DateTime? startTime,
    DateTime? endTime,
    int? totalReps,
    int? totalSets,
    double? averageScore,
    List<HistorySetRecord>? sets,
    String? note,
    List<String>? tags,
    BodyCondition? bodyCondition,
  }) {
    return HistorySession(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      exerciseType: exerciseType ?? this.exerciseType,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      totalReps: totalReps ?? this.totalReps,
      totalSets: totalSets ?? this.totalSets,
      averageScore: averageScore ?? this.averageScore,
      sets: sets ?? this.sets,
      note: note ?? this.note,
      tags: tags ?? this.tags,
      bodyCondition: bodyCondition ?? this.bodyCondition,
    );
  }

  /// Create from JSON (Firestore)
  factory HistorySession.fromJson(Map<String, dynamic> json) {
    return HistorySession(
      id: json['id'] as String,
      userId: json['userId'] as String,
      exerciseType: ExerciseType.values.firstWhere(
        (e) => e.name == json['exerciseType'],
        orElse: () => ExerciseType.squat,
      ),
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      totalReps: json['totalReps'] as int,
      totalSets: json['totalSets'] as int,
      averageScore: (json['averageScore'] as num).toDouble(),
      sets: (json['sets'] as List<dynamic>)
          .map((s) => HistorySetRecord.fromJson(s as Map<String, dynamic>))
          .toList(),
      note: json['note'] as String?,
      tags: (json['tags'] as List<dynamic>?)?.cast<String>(),
      bodyCondition: json['bodyCondition'] != null
          ? BodyCondition.fromJson(json['bodyCondition'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Convert to JSON (Firestore)
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'exerciseType': exerciseType.name,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'totalReps': totalReps,
      'totalSets': totalSets,
      'averageScore': averageScore,
      'sets': sets.map((s) => s.toJson()).toList(),
      'note': note,
      'tags': tags,
      'bodyCondition': bodyCondition?.toJson(),
    };
  }
}

/// Individual set record within a session
/// Named HistorySetRecord to avoid potential conflicts
class HistorySetRecord {
  const HistorySetRecord({
    required this.setNumber,
    required this.reps,
    required this.averageScore,
    required this.duration,
    required this.issues,
    this.bestRepScore,
    this.worstRepScore,
  });

  final int setNumber;
  final int reps;
  final double averageScore;
  final Duration duration;
  final List<String> issues;
  final double? bestRepScore;
  final double? worstRepScore;

  /// Create from JSON
  factory HistorySetRecord.fromJson(Map<String, dynamic> json) {
    return HistorySetRecord(
      setNumber: json['setNumber'] as int,
      reps: json['reps'] as int,
      averageScore: (json['averageScore'] as num).toDouble(),
      duration: Duration(milliseconds: json['durationMs'] as int),
      issues: (json['issues'] as List<dynamic>).cast<String>(),
      bestRepScore: (json['bestRepScore'] as num?)?.toDouble(),
      worstRepScore: (json['worstRepScore'] as num?)?.toDouble(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'setNumber': setNumber,
      'reps': reps,
      'averageScore': averageScore,
      'durationMs': duration.inMilliseconds,
      'issues': issues,
      'bestRepScore': bestRepScore,
      'worstRepScore': worstRepScore,
    };
  }
}

/// Body condition recorded with session
class BodyCondition {
  const BodyCondition({
    this.energyLevel = 3,
    this.sleepQuality = 3,
    this.muscleStiffness = 3,
    this.notes,
  });

  final int energyLevel; // 1-5
  final int sleepQuality; // 1-5
  final int muscleStiffness; // 1-5
  final String? notes;

  factory BodyCondition.fromJson(Map<String, dynamic> json) {
    return BodyCondition(
      energyLevel: json['energyLevel'] as int? ?? 3,
      sleepQuality: json['sleepQuality'] as int? ?? 3,
      muscleStiffness: json['muscleStiffness'] as int? ?? 3,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'energyLevel': energyLevel,
      'sleepQuality': sleepQuality,
      'muscleStiffness': muscleStiffness,
      'notes': notes,
    };
  }
}

/// Daily summary for calendar view
class DailySummary {
  const DailySummary({
    required this.date,
    required this.sessionCount,
    required this.totalReps,
    required this.averageScore,
    required this.exerciseTypes,
  });

  final DateTime date;
  final int sessionCount;
  final int totalReps;
  final double averageScore;
  final List<ExerciseType> exerciseTypes;

  /// Get intensity level for color coding (1-3)
  int get intensityLevel {
    if (sessionCount >= 3 || totalReps >= 50) return 3;
    if (sessionCount >= 2 || totalReps >= 25) return 2;
    return 1;
  }
}

/// Weekly statistics
class WeeklyStats {
  const WeeklyStats({
    required this.weekStart,
    required this.totalSessions,
    required this.totalReps,
    required this.totalSets,
    required this.totalDuration,
    required this.averageScore,
    required this.exerciseBreakdown,
    required this.dailySummaries,
  });

  final DateTime weekStart;
  final int totalSessions;
  final int totalReps;
  final int totalSets;
  final Duration totalDuration;
  final double averageScore;
  final Map<ExerciseType, int> exerciseBreakdown;
  final List<DailySummary> dailySummaries;

  /// Get active days count
  int get activeDays =>
      dailySummaries.where((d) => d.sessionCount > 0).length;
}

/// Monthly statistics
class MonthlyStats {
  const MonthlyStats({
    required this.year,
    required this.month,
    required this.totalSessions,
    required this.totalReps,
    required this.totalSets,
    required this.totalDuration,
    required this.averageScore,
    required this.exerciseBreakdown,
    required this.weeklyStats,
    required this.streakDays,
    required this.bestStreakDays,
  });

  final int year;
  final int month;
  final int totalSessions;
  final int totalReps;
  final int totalSets;
  final Duration totalDuration;
  final double averageScore;
  final Map<ExerciseType, int> exerciseBreakdown;
  final List<WeeklyStats> weeklyStats;
  final int streakDays;
  final int bestStreakDays;

  /// Get active days count
  int get activeDays =>
      weeklyStats.fold(0, (sum, w) => sum + w.activeDays);
}

/// Progress data point for charts
class ProgressDataPoint {
  const ProgressDataPoint({
    required this.date,
    required this.value,
    this.exerciseType,
  });

  final DateTime date;
  final double value;
  final ExerciseType? exerciseType;
}

/// Analysis period for filtering
enum AnalysisPeriod {
  week,
  month,
  threeMonths,
  year,
  custom,
}

/// History filter options
class HistoryFilter {
  const HistoryFilter({
    this.startDate,
    this.endDate,
    this.exerciseTypes,
    this.minScore,
    this.maxScore,
    this.tags,
  });

  final DateTime? startDate;
  final DateTime? endDate;
  final List<ExerciseType>? exerciseTypes;
  final double? minScore;
  final double? maxScore;
  final List<String>? tags;

  /// Check if filter is empty
  bool get isEmpty =>
      startDate == null &&
      endDate == null &&
      (exerciseTypes == null || exerciseTypes!.isEmpty) &&
      minScore == null &&
      maxScore == null &&
      (tags == null || tags!.isEmpty);

  /// Create copy with modifications
  HistoryFilter copyWith({
    DateTime? startDate,
    DateTime? endDate,
    List<ExerciseType>? exerciseTypes,
    double? minScore,
    double? maxScore,
    List<String>? tags,
  }) {
    return HistoryFilter(
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      exerciseTypes: exerciseTypes ?? this.exerciseTypes,
      minScore: minScore ?? this.minScore,
      maxScore: maxScore ?? this.maxScore,
      tags: tags ?? this.tags,
    );
  }
}

/// Exercise statistics for analytics
class ExerciseStats {
  const ExerciseStats({
    required this.exerciseType,
    required this.totalSessions,
    required this.totalReps,
    required this.averageScore,
    required this.bestScore,
    required this.scoreImprovement,
    required this.scoreHistory,
    required this.commonIssues,
  });

  final ExerciseType exerciseType;
  final int totalSessions;
  final int totalReps;
  final double averageScore;
  final double bestScore;
  final double scoreImprovement; // Percentage change from first to last 5 sessions
  final List<ProgressDataPoint> scoreHistory;
  final List<String> commonIssues;
}
