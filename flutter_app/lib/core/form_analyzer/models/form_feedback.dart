/// Form Feedback Models
///
/// Data structures for exercise form evaluation feedback.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

/// Feedback level based on form score
enum FeedbackLevel {
  /// Excellent form (90-100%)
  excellent,

  /// Good form (70-89%)
  good,

  /// Fair form - needs some improvement (50-69%)
  fair,

  /// Needs significant improvement (<50%)
  needsImprovement,
}

/// Extension methods for FeedbackLevel
extension FeedbackLevelExtension on FeedbackLevel {
  /// Get the minimum score for this level
  int get minScore {
    return switch (this) {
      FeedbackLevel.excellent => 90,
      FeedbackLevel.good => 70,
      FeedbackLevel.fair => 50,
      FeedbackLevel.needsImprovement => 0,
    };
  }

  /// Get the maximum score for this level
  int get maxScore {
    return switch (this) {
      FeedbackLevel.excellent => 100,
      FeedbackLevel.good => 89,
      FeedbackLevel.fair => 69,
      FeedbackLevel.needsImprovement => 49,
    };
  }

  /// Get display name in Japanese
  String get displayName {
    return switch (this) {
      FeedbackLevel.excellent => '素晴らしい',
      FeedbackLevel.good => '良好',
      FeedbackLevel.fair => '改善の余地あり',
      FeedbackLevel.needsImprovement => '確認してください',
    };
  }

  /// Get color code for UI
  String get colorHex {
    return switch (this) {
      FeedbackLevel.excellent => '#4CAF50', // Green
      FeedbackLevel.good => '#8BC34A', // Light Green
      FeedbackLevel.fair => '#FF9800', // Orange
      FeedbackLevel.needsImprovement => '#F44336', // Red
    };
  }

  /// Create FeedbackLevel from score
  static FeedbackLevel fromScore(double score) {
    if (score >= 90) return FeedbackLevel.excellent;
    if (score >= 70) return FeedbackLevel.good;
    if (score >= 50) return FeedbackLevel.fair;
    return FeedbackLevel.needsImprovement;
  }
}

/// Type of feedback to provide
enum FeedbackType {
  /// Real-time alert during exercise
  realTimeAlert,

  /// Summary at end of set
  setSummary,

  /// Detailed analysis at session end
  sessionDetail,
}

/// Priority level for feedback messages
enum FeedbackPriority {
  /// Critical - safety concern
  critical,

  /// High - significant form issue
  high,

  /// Medium - moderate improvement needed
  medium,

  /// Low - minor suggestion
  low,
}

/// Represents a single form issue detected
class FormIssue {
  const FormIssue({
    required this.issueType,
    required this.message,
    required this.priority,
    this.suggestion,
    this.affectedBodyPart,
    this.currentValue,
    this.targetValue,
    this.deduction = 0,
  });

  /// Type of issue (e.g., 'knee_over_toe', 'elbow_swing')
  final String issueType;

  /// Human-readable message describing the issue
  final String message;

  /// Priority level of this issue
  final FeedbackPriority priority;

  /// Suggestion for improvement
  final String? suggestion;

  /// Body part affected (e.g., 'knee', 'elbow')
  final String? affectedBodyPart;

  /// Current measured value
  final double? currentValue;

  /// Target/expected value
  final double? targetValue;

  /// Points deducted from score for this issue
  final double deduction;

  @override
  String toString() => 'FormIssue($issueType: $message)';
}

/// Result of evaluating a single frame
class FrameEvaluationResult {
  const FrameEvaluationResult({
    required this.timestamp,
    required this.score,
    required this.level,
    required this.issues,
    this.jointAngles = const {},
    this.isRepComplete = false,
    this.currentPhase,
  });

  /// Timestamp of the evaluated frame
  final int timestamp;

  /// Overall score for this frame (0-100)
  final double score;

  /// Feedback level based on score
  final FeedbackLevel level;

  /// List of issues detected in this frame
  final List<FormIssue> issues;

  /// Calculated joint angles for this frame
  final Map<String, double> jointAngles;

  /// Whether a rep was completed on this frame
  final bool isRepComplete;

  /// Current exercise phase (e.g., 'down', 'up', 'hold')
  final String? currentPhase;

  /// Check if frame has critical issues
  bool get hasCriticalIssues =>
      issues.any((i) => i.priority == FeedbackPriority.critical);

  /// Check if frame has any issues
  bool get hasIssues => issues.isNotEmpty;

  @override
  String toString() =>
      'FrameEvaluation(score: ${score.toStringAsFixed(1)}, '
      'issues: ${issues.length}, phase: $currentPhase)';
}

/// Summary of a completed rep
class RepSummary {
  const RepSummary({
    required this.repNumber,
    required this.score,
    required this.level,
    required this.issues,
    required this.startTime,
    required this.endTime,
    this.minAngle,
    this.maxAngle,
    this.tempo,
  });

  /// Rep number in the set (1-based)
  final int repNumber;

  /// Score for this rep (0-100)
  final double score;

  /// Feedback level
  final FeedbackLevel level;

  /// Aggregated issues for this rep
  final List<FormIssue> issues;

  /// Start timestamp
  final int startTime;

  /// End timestamp
  final int endTime;

  /// Minimum angle reached during the rep
  final double? minAngle;

  /// Maximum angle reached during the rep
  final double? maxAngle;

  /// Tempo in seconds per rep
  final double? tempo;

  /// Duration of this rep in milliseconds
  int get durationMs => endTime - startTime;

  @override
  String toString() =>
      'RepSummary(#$repNumber, score: ${score.toStringAsFixed(1)}, '
      'duration: ${durationMs}ms)';
}

/// Summary of a completed set
class SetSummary {
  const SetSummary({
    required this.setNumber,
    required this.repCount,
    required this.averageScore,
    required this.level,
    required this.reps,
    required this.startTime,
    required this.endTime,
    this.commonIssues = const [],
  });

  /// Set number in the session (1-based)
  final int setNumber;

  /// Number of reps completed
  final int repCount;

  /// Average score across all reps
  final double averageScore;

  /// Overall feedback level
  final FeedbackLevel level;

  /// Individual rep summaries
  final List<RepSummary> reps;

  /// Start timestamp
  final int startTime;

  /// End timestamp
  final int endTime;

  /// Most common issues across the set
  final List<FormIssue> commonIssues;

  /// Duration of this set in milliseconds
  int get durationMs => endTime - startTime;

  /// Best rep score
  double get bestScore =>
      reps.isEmpty ? 0 : reps.map((r) => r.score).reduce((a, b) => a > b ? a : b);

  /// Worst rep score
  double get worstScore =>
      reps.isEmpty ? 0 : reps.map((r) => r.score).reduce((a, b) => a < b ? a : b);

  /// Score consistency (standard deviation)
  double get scoreConsistency {
    if (reps.isEmpty) return 0;
    final avg = averageScore;
    final variance = reps.map((r) => (r.score - avg) * (r.score - avg)).fold<double>(
      0,
      (sum, v) => sum + v,
    ) / reps.length;
    return variance > 0 ? (variance as num).toDouble() : 0;
  }

  @override
  String toString() =>
      'SetSummary(#$setNumber, reps: $repCount, avgScore: ${averageScore.toStringAsFixed(1)})';
}

/// Complete session summary for an exercise
class SessionSummary {
  const SessionSummary({
    required this.exerciseType,
    required this.setCount,
    required this.totalReps,
    required this.averageScore,
    required this.level,
    required this.sets,
    required this.startTime,
    required this.endTime,
    this.topIssues = const [],
    this.improvementAreas = const [],
  });

  /// Type of exercise performed
  final String exerciseType;

  /// Number of sets completed
  final int setCount;

  /// Total reps across all sets
  final int totalReps;

  /// Overall average score
  final double averageScore;

  /// Overall feedback level
  final FeedbackLevel level;

  /// Individual set summaries
  final List<SetSummary> sets;

  /// Session start timestamp
  final int startTime;

  /// Session end timestamp
  final int endTime;

  /// Top issues to focus on
  final List<FormIssue> topIssues;

  /// Suggested improvement areas
  final List<String> improvementAreas;

  /// Total session duration in milliseconds
  int get durationMs => endTime - startTime;

  /// Best set score
  double get bestSetScore =>
      sets.isEmpty ? 0 : sets.map((s) => s.averageScore).reduce((a, b) => a > b ? a : b);

  @override
  String toString() =>
      'SessionSummary($exerciseType, sets: $setCount, '
      'totalReps: $totalReps, avgScore: ${averageScore.toStringAsFixed(1)})';
}

/// Real-time feedback message
class FeedbackMessage {
  const FeedbackMessage({
    required this.message,
    required this.priority,
    required this.type,
    this.issueType,
    this.timestamp,
  });

  /// The feedback message text
  final String message;

  /// Priority of this message
  final FeedbackPriority priority;

  /// Type of feedback
  final FeedbackType type;

  /// Related issue type
  final String? issueType;

  /// When this message was generated
  final int? timestamp;

  @override
  String toString() => 'Feedback($priority: $message)';
}
