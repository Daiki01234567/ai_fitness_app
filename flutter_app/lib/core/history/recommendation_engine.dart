/// Recommendation Engine
///
/// Intelligent recommendation service for training optimization.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/00_要件定義書_v3_3.md (FR-028~FR-030)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
/// Recommendations are suggestions based on training data patterns
/// and should not be considered medical or professional fitness advice.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../form_analyzer/form_analyzer.dart';
import 'history_models.dart';
import 'history_service.dart';

/// Recommendation type categories
enum RecommendationType {
  /// Next workout menu suggestion
  nextWorkout,

  /// Load adjustment advice
  loadAdjustment,

  /// Rest day suggestion
  restDay,

  /// Form improvement focus
  formImprovement,

  /// Supplementary exercise suggestion
  supplementaryExercise,

  /// Stretch recommendation
  stretchRecommendation,

  /// Goal setting assistance
  goalSetting,
}

/// Load adjustment direction
enum LoadAdjustment {
  /// Increase intensity
  increase,

  /// Maintain current level
  maintain,

  /// Decrease intensity
  decrease,
}

/// Single recommendation item
class Recommendation {
  const Recommendation({
    required this.type,
    required this.title,
    required this.description,
    this.exerciseType,
    this.priority = 1,
    this.reason,
    this.actionable = true,
  });

  final RecommendationType type;
  final String title;
  final String description;
  final ExerciseType? exerciseType;
  final int priority; // 1 = highest
  final String? reason;
  final bool actionable;

  Recommendation copyWith({
    RecommendationType? type,
    String? title,
    String? description,
    ExerciseType? exerciseType,
    int? priority,
    String? reason,
    bool? actionable,
  }) {
    return Recommendation(
      type: type ?? this.type,
      title: title ?? this.title,
      description: description ?? this.description,
      exerciseType: exerciseType ?? this.exerciseType,
      priority: priority ?? this.priority,
      reason: reason ?? this.reason,
      actionable: actionable ?? this.actionable,
    );
  }
}

/// Goal suggestion with milestone
class GoalSuggestion {
  const GoalSuggestion({
    required this.exerciseType,
    required this.currentScore,
    required this.targetScore,
    required this.estimatedDays,
    required this.milestones,
  });

  final ExerciseType exerciseType;
  final double currentScore;
  final double targetScore;
  final int estimatedDays;
  final List<GoalMilestone> milestones;
}

/// Goal milestone marker
class GoalMilestone {
  const GoalMilestone({
    required this.score,
    required this.label,
    required this.estimatedDays,
  });

  final double score;
  final String label;
  final int estimatedDays;
}

/// Training load analysis result
class LoadAnalysisResult {
  const LoadAnalysisResult({
    required this.adjustment,
    required this.reason,
    required this.currentWeekSessions,
    required this.currentWeekReps,
    required this.previousWeekSessions,
    required this.previousWeekReps,
    this.overtrainingRisk = false,
  });

  final LoadAdjustment adjustment;
  final String reason;
  final int currentWeekSessions;
  final int currentWeekReps;
  final int previousWeekSessions;
  final int previousWeekReps;
  final bool overtrainingRisk;
}

/// Recommendation engine service
class RecommendationEngine {
  RecommendationEngine(this._historyService);

  final HistoryService _historyService;

  // Thresholds and configuration
  static const int _minSessionsForRecommendation = 3;
  static const int _restDaySessionThreshold = 5; // Max sessions before rest
  static const int _restDayConsecutiveThreshold = 4; // Consecutive days
  static const double _plateauThreshold = 2.0; // Score change < 2% = plateau
  static const double _excellentScoreThreshold = 85.0;
  static const double _goodScoreThreshold = 70.0;
  static const double _fairScoreThreshold = 50.0;

  /// Get all recommendations for user
  Future<List<Recommendation>> getRecommendations({
    required String userId,
  }) async {
    final recommendations = <Recommendation>[];

    try {
      // Fetch recent data
      final now = DateTime.now();
      final weekAgo = now.subtract(const Duration(days: 7));
      final twoWeeksAgo = now.subtract(const Duration(days: 14));

      final recentSessions = await _historyService.fetchSessions(
        userId: userId,
        filter: HistoryFilter(startDate: weekAgo),
        limit: 50,
      );

      final previousWeekSessions = await _historyService.fetchSessions(
        userId: userId,
        filter: HistoryFilter(startDate: twoWeeksAgo, endDate: weekAgo),
        limit: 50,
      );

      if (recentSessions.isEmpty && previousWeekSessions.isEmpty) {
        // First-time user
        recommendations.add(const Recommendation(
          type: RecommendationType.nextWorkout,
          title: 'トレーニングを始めましょう',
          description: 'スクワットから始めることをお勧めします。基本的な動作を学びながら、下半身全体を鍛えられます。',
          exerciseType: ExerciseType.squat,
          priority: 1,
        ));
        return recommendations;
      }

      // Check for rest day recommendation
      final restDayRec = await _analyzeRestNeed(recentSessions, userId);
      if (restDayRec != null) {
        recommendations.add(restDayRec);
      }

      // Load adjustment analysis
      final loadAnalysis = _analyzeLoad(recentSessions, previousWeekSessions);
      recommendations.add(_createLoadRecommendation(loadAnalysis));

      // Next workout recommendation
      final nextWorkoutRec = _getNextWorkoutRecommendation(recentSessions);
      recommendations.add(nextWorkoutRec);

      // Form improvement recommendations
      final formRecs = await _getFormImprovementRecommendations(userId, recentSessions);
      recommendations.addAll(formRecs);

      // Supplementary exercise recommendations
      final suppRecs = _getSupplementaryRecommendations(recentSessions);
      recommendations.addAll(suppRecs);

      // Sort by priority
      recommendations.sort((a, b) => a.priority.compareTo(b.priority));

      return recommendations;
    } catch (e) {
      // Return safe default on error
      return [
        const Recommendation(
          type: RecommendationType.nextWorkout,
          title: '次のトレーニング',
          description: '前回のトレーニングを参考に、無理のない範囲で継続しましょう。',
          priority: 1,
        ),
      ];
    }
  }

  /// Analyze if rest is needed
  Future<Recommendation?> _analyzeRestNeed(
    List<HistorySession> recentSessions,
    String userId,
  ) async {
    if (recentSessions.isEmpty) return null;

    // Count consecutive training days
    final today = DateTime.now();
    final dates = recentSessions
        .map((s) => DateTime(s.startTime.year, s.startTime.month, s.startTime.day))
        .toSet()
        .toList()
      ..sort((a, b) => b.compareTo(a));

    var consecutiveDays = 0;
    for (var i = 0; i < dates.length; i++) {
      final expectedDate = DateTime(today.year, today.month, today.day)
          .subtract(Duration(days: i));
      if (dates.any((d) =>
          d.year == expectedDate.year &&
          d.month == expectedDate.month &&
          d.day == expectedDate.day)) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    // Check for overtraining signs
    final weekSessions = recentSessions.length;

    // Score declining trend in recent sessions?
    bool decliningTrend = false;
    if (recentSessions.length >= 3) {
      final sorted = recentSessions.toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
      final first3 = sorted.take(3).map((s) => s.averageScore).toList();
      final last3 = sorted.reversed.take(3).map((s) => s.averageScore).toList();
      final first3Avg = first3.reduce((a, b) => a + b) / 3;
      final last3Avg = last3.reduce((a, b) => a + b) / 3;
      decliningTrend = last3Avg < first3Avg - 5; // 5 point drop
    }

    if (consecutiveDays >= _restDayConsecutiveThreshold ||
        (weekSessions >= _restDaySessionThreshold && decliningTrend)) {
      return Recommendation(
        type: RecommendationType.restDay,
        title: '休息日のすすめ',
        description: consecutiveDays >= _restDayConsecutiveThreshold
            ? '$consecutiveDays日連続でトレーニングを行っています。筋肉の回復のため、今日は休息日にすることをお勧めします。'
            : '今週は$weekSessions回のセッションを行い、スコアが下降傾向にあります。体を休めることで、パフォーマンスが向上する可能性があります。',
        priority: 1,
        reason: '過度なトレーニングは怪我のリスクを高め、パフォーマンス低下の原因になります。',
        actionable: false,
      );
    }

    return null;
  }

  /// Analyze training load
  LoadAnalysisResult _analyzeLoad(
    List<HistorySession> currentWeek,
    List<HistorySession> previousWeek,
  ) {
    final currentSessions = currentWeek.length;
    final currentReps = currentWeek.fold(0, (acc, s) => acc + s.totalReps);
    final previousSessions = previousWeek.length;
    final previousReps = previousWeek.fold(0, (acc, s) => acc + s.totalReps);

    LoadAdjustment adjustment;
    String reason;
    bool overtrainingRisk = false;

    // Calculate averages
    final currentAvgScore = currentWeek.isEmpty
        ? 0.0
        : currentWeek.map((s) => s.averageScore).reduce((a, b) => a + b) /
            currentWeek.length;
    final double previousAvgScore = previousWeek.isEmpty
        ? 0.0
        : previousWeek.map((s) => s.averageScore).reduce((a, b) => a + b) /
            previousWeek.length;

    if (currentSessions == 0 && previousSessions == 0) {
      adjustment = LoadAdjustment.maintain;
      reason = 'トレーニングデータが不足しています。まずは継続を目指しましょう。';
    } else if (currentSessions < previousSessions * 0.5) {
      // Significant decrease in activity
      adjustment = LoadAdjustment.increase;
      reason = '先週と比べてトレーニング頻度が減少しています。可能であれば頻度を上げましょう。';
    } else if (currentReps > previousReps * 1.5 && currentAvgScore < previousAvgScore - 5) {
      // Volume up but performance down = potential overtraining
      adjustment = LoadAdjustment.decrease;
      reason = 'トレーニング量が増えていますが、パフォーマンスが低下傾向にあります。回復に注力しましょう。';
      overtrainingRisk = true;
    } else if (currentAvgScore >= _excellentScoreThreshold && currentSessions >= 3) {
      // Excellent performance, can progress
      adjustment = LoadAdjustment.increase;
      reason = '素晴らしいパフォーマンスです！徐々に負荷を上げていきましょう。';
    } else if (currentAvgScore < _fairScoreThreshold) {
      // Performance needs improvement
      adjustment = LoadAdjustment.maintain;
      reason = 'フォームの質を優先し、現在の負荷を維持しながら技術を磨きましょう。';
    } else {
      adjustment = LoadAdjustment.maintain;
      reason = '現在のペースは良好です。このまま継続しましょう。';
    }

    return LoadAnalysisResult(
      adjustment: adjustment,
      reason: reason,
      currentWeekSessions: currentSessions,
      currentWeekReps: currentReps,
      previousWeekSessions: previousSessions,
      previousWeekReps: previousReps,
      overtrainingRisk: overtrainingRisk,
    );
  }

  /// Create load recommendation from analysis
  Recommendation _createLoadRecommendation(LoadAnalysisResult analysis) {
    final title = switch (analysis.adjustment) {
      LoadAdjustment.increase => '負荷を上げましょう',
      LoadAdjustment.maintain => '現在の負荷を維持',
      LoadAdjustment.decrease => '負荷を下げましょう',
    };

    return Recommendation(
      type: RecommendationType.loadAdjustment,
      title: title,
      description: analysis.reason,
      priority: analysis.overtrainingRisk ? 1 : 3,
      reason: '今週: ${analysis.currentWeekSessions}セッション/${analysis.currentWeekReps}レップ、'
          '先週: ${analysis.previousWeekSessions}セッション/${analysis.previousWeekReps}レップ',
    );
  }

  /// Get next workout recommendation
  Recommendation _getNextWorkoutRecommendation(List<HistorySession> recentSessions) {
    if (recentSessions.isEmpty) {
      return const Recommendation(
        type: RecommendationType.nextWorkout,
        title: '次回のトレーニング',
        description: 'スクワットから始めてみましょう。全身を使う基本種目です。',
        exerciseType: ExerciseType.squat,
        priority: 2,
      );
    }

    // Count exercise frequency
    final exerciseCounts = <ExerciseType, int>{};
    final exerciseScores = <ExerciseType, List<double>>{};

    for (final session in recentSessions) {
      exerciseCounts[session.exerciseType] =
          (exerciseCounts[session.exerciseType] ?? 0) + 1;
      exerciseScores.putIfAbsent(session.exerciseType, () => [])
          .add(session.averageScore);
    }

    // Find least practiced exercise
    ExerciseType? suggestedExercise;
    var minCount = 999;

    for (final type in ExerciseType.values) {
      final count = exerciseCounts[type] ?? 0;
      if (count < minCount) {
        minCount = count;
        suggestedExercise = type;
      }
    }

    // Or find exercise with lowest average score
    ExerciseType? weakestExercise;
    var lowestAvg = 100.0;

    for (final entry in exerciseScores.entries) {
      final avg = entry.value.reduce((a, b) => a + b) / entry.value.length;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakestExercise = entry.key;
      }
    }

    // Prioritize least practiced if never done, else weakest
    final recommended = minCount == 0 ? suggestedExercise : weakestExercise;
    final exerciseName = recommended != null
        ? AnalyzerFactory.getDisplayName(recommended)
        : 'スクワット';

    String description;
    if (minCount == 0 && suggestedExercise != null) {
      description = '$exerciseNameはまだ試していません。新しい種目にチャレンジしてみましょう！';
    } else if (lowestAvg < _goodScoreThreshold && weakestExercise != null) {
      description = '$exerciseNameのスコアが他の種目より低めです。集中的に練習することでフォームを改善できます。';
    } else {
      // Most recent exercise type - suggest variation
      final lastExercise = recentSessions.first.exerciseType;
      final different = ExerciseType.values.where((e) => e != lastExercise).first;
      final differentName = AnalyzerFactory.getDisplayName(different);
      description = '前回は${AnalyzerFactory.getDisplayName(lastExercise)}を行いました。$differentNameで違う筋肉群を鍛えましょう。';
      return Recommendation(
        type: RecommendationType.nextWorkout,
        title: '次回のおすすめ: $differentName',
        description: description,
        exerciseType: different,
        priority: 2,
      );
    }

    return Recommendation(
      type: RecommendationType.nextWorkout,
      title: '次回のおすすめ: $exerciseName',
      description: description,
      exerciseType: recommended,
      priority: 2,
    );
  }

  /// Get form improvement recommendations
  Future<List<Recommendation>> _getFormImprovementRecommendations(
    String userId,
    List<HistorySession> recentSessions,
  ) async {
    final recommendations = <Recommendation>[];

    // Get exercise stats for each type practiced
    final exerciseTypes = recentSessions.map((s) => s.exerciseType).toSet();

    for (final type in exerciseTypes) {
      try {
        final stats = await _historyService.fetchExerciseStats(
          userId: userId,
          exerciseType: type,
          period: AnalysisPeriod.month,
        );

        if (stats.totalSessions < _minSessionsForRecommendation) continue;

        // Check for plateau
        final isPlateauing = stats.scoreImprovement.abs() < _plateauThreshold &&
            stats.totalSessions >= 5;

        if (isPlateauing && stats.averageScore < _excellentScoreThreshold) {
          recommendations.add(Recommendation(
            type: RecommendationType.formImprovement,
            title: '${AnalyzerFactory.getDisplayName(type)}のプラトー',
            description: 'スコアの改善が停滞しています。フォームの細部に注目し、'
                '${stats.commonIssues.isNotEmpty ? stats.commonIssues.first : "動作の質"}を意識してみましょう。',
            exerciseType: type,
            priority: 3,
            reason: '過去${stats.totalSessions}セッションで改善率: '
                '${stats.scoreImprovement.toStringAsFixed(1)}%',
          ));
        }

        // Add specific issue recommendations
        if (stats.commonIssues.isNotEmpty) {
          recommendations.add(Recommendation(
            type: RecommendationType.formImprovement,
            title: '${AnalyzerFactory.getDisplayName(type)}の改善ポイント',
            description: '「${stats.commonIssues.first}」が頻繁に検出されています。'
                'この点を意識してトレーニングを行いましょう。',
            exerciseType: type,
            priority: 4,
          ));
        }
      } catch (e) {
        // Skip on error
        continue;
      }
    }

    return recommendations;
  }

  /// Get supplementary exercise recommendations
  List<Recommendation> _getSupplementaryRecommendations(
    List<HistorySession> recentSessions,
  ) {
    final recommendations = <Recommendation>[];

    // Map of exercises to their supplementary recommendations
    const supplementaryExercises = <ExerciseType, Map<String, String>>{
      ExerciseType.squat: {
        'title': 'カーフレイズ',
        'description': 'ふくらはぎを強化することで、スクワットの安定性が向上します。壁に手をついて行うと安全です。',
      },
      ExerciseType.armCurl: {
        'title': 'リストカール',
        'description': '前腕を鍛えることで、グリップ力が向上しカール動作が安定します。',
      },
      ExerciseType.shoulderPress: {
        'title': 'フロントレイズ',
        'description': '前部三角筋を強化することで、ショルダープレスの挙上力が向上します。',
      },
      ExerciseType.sideRaise: {
        'title': 'シュラッグ',
        'description': '僧帽筋上部を鍛えることで、サイドレイズでの肩の安定性が向上します。',
      },
      ExerciseType.pushUp: {
        'title': 'プランク',
        'description': '体幹を強化することで、プッシュアップ中のボディラインが維持しやすくなります。',
      },
    };

    // Find most practiced exercise and suggest its supplement
    if (recentSessions.isNotEmpty) {
      final exerciseCounts = <ExerciseType, int>{};
      for (final session in recentSessions) {
        exerciseCounts[session.exerciseType] =
            (exerciseCounts[session.exerciseType] ?? 0) + 1;
      }

      final mostPracticed = exerciseCounts.entries
          .reduce((a, b) => a.value > b.value ? a : b)
          .key;

      final supplement = supplementaryExercises[mostPracticed];
      if (supplement != null) {
        recommendations.add(Recommendation(
          type: RecommendationType.supplementaryExercise,
          title: '補助エクササイズ: ${supplement['title']}',
          description: supplement['description']!,
          priority: 5,
          reason: '${AnalyzerFactory.getDisplayName(mostPracticed)}を頻繁に行っているため',
        ));
      }
    }

    // Add stretch recommendation
    recommendations.add(const Recommendation(
      type: RecommendationType.stretchRecommendation,
      title: 'ストレッチの推奨',
      description: 'トレーニング後は必ずストレッチを行いましょう。筋肉の回復を促進し、柔軟性を維持できます。',
      priority: 6,
    ));

    return recommendations;
  }

  /// Get goal suggestions based on current performance
  Future<List<GoalSuggestion>> getGoalSuggestions({
    required String userId,
  }) async {
    final suggestions = <GoalSuggestion>[];

    for (final type in ExerciseType.values) {
      try {
        final stats = await _historyService.fetchExerciseStats(
          userId: userId,
          exerciseType: type,
          period: AnalysisPeriod.month,
        );

        if (stats.totalSessions < _minSessionsForRecommendation) continue;

        // Calculate realistic target
        final currentScore = stats.averageScore;
        double targetScore;

        if (currentScore < 60) {
          targetScore = 70; // First milestone
        } else if (currentScore < 75) {
          targetScore = 80; // Good level
        } else if (currentScore < 85) {
          targetScore = 90; // Excellent level
        } else {
          targetScore = 95; // Master level
        }

        // Estimate days based on improvement rate
        final dailyImprovement = stats.scoreImprovement > 0
            ? stats.scoreImprovement / 30 // Per day
            : 0.5; // Default assumption
        final scoreGap = targetScore - currentScore;
        final estimatedDays = dailyImprovement > 0
            ? (scoreGap / dailyImprovement).ceil()
            : 60; // Default 2 months

        // Create milestones
        final milestones = <GoalMilestone>[];
        final step = (targetScore - currentScore) / 3;

        for (var i = 1; i <= 3; i++) {
          final milestoneScore = currentScore + (step * i);
          milestones.add(GoalMilestone(
            score: milestoneScore,
            label: i == 3 ? '目標達成！' : 'ステップ$i',
            estimatedDays: (estimatedDays * i / 3).ceil(),
          ));
        }

        suggestions.add(GoalSuggestion(
          exerciseType: type,
          currentScore: currentScore,
          targetScore: targetScore,
          estimatedDays: estimatedDays.clamp(7, 180), // 1 week to 6 months
          milestones: milestones,
        ));
      } catch (e) {
        continue;
      }
    }

    return suggestions;
  }
}

/// Recommendation engine provider
final recommendationEngineProvider = Provider<RecommendationEngine>((ref) {
  final historyService = ref.watch(historyServiceProvider);
  return RecommendationEngine(historyService);
});

/// Recommendations state provider
final recommendationsProvider =
    FutureProvider.autoDispose.family<List<Recommendation>, String>(
  (ref, userId) async {
    final engine = ref.watch(recommendationEngineProvider);
    return engine.getRecommendations(userId: userId);
  },
);

/// Goal suggestions provider
final goalSuggestionsProvider =
    FutureProvider.autoDispose.family<List<GoalSuggestion>, String>(
  (ref, userId) async {
    final engine = ref.watch(recommendationEngineProvider);
    return engine.getGoalSuggestions(userId: userId);
  },
);
