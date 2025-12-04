/// Report Generator
///
/// Service for generating training reports (weekly, monthly).
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/00_要件定義書_v3_3.md (FR-028~FR-030)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
/// Reports provide informational summaries of training data.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../form_analyzer/form_analyzer.dart';
import 'history_models.dart';
import 'history_service.dart';

/// Report type
enum ReportType {
  /// Weekly summary report
  weekly,

  /// Monthly detailed report
  monthly,

  /// Custom period report
  custom,
}

/// Report section for structured output
class ReportSection {
  const ReportSection({
    required this.title,
    required this.content,
    this.type = 'text',
    this.data,
  });

  final String title;
  final String content;
  final String type; // 'text', 'stats', 'list', 'chart_data'
  final Map<String, dynamic>? data;

  Map<String, dynamic> toJson() => {
    'title': title,
    'content': content,
    'type': type,
    'data': data,
  };
}

/// Generated report
class TrainingReport {
  const TrainingReport({
    required this.type,
    required this.title,
    required this.period,
    required this.generatedAt,
    required this.sections,
    required this.summary,
    this.nextWeekGoals = const [],
    this.highlights = const [],
  });

  final ReportType type;
  final String title;
  final String period;
  final DateTime generatedAt;
  final List<ReportSection> sections;
  final String summary;
  final List<String> nextWeekGoals;
  final List<String> highlights;

  /// Convert to formatted text
  String toFormattedText() {
    final buffer = StringBuffer();
    final dateFormat = DateFormat('yyyy/MM/dd HH:mm');

    buffer.writeln('=' * 50);
    buffer.writeln(title);
    buffer.writeln('期間: $period');
    buffer.writeln('生成日時: ${dateFormat.format(generatedAt)}');
    buffer.writeln('=' * 50);
    buffer.writeln();

    // Summary
    buffer.writeln('【概要】');
    buffer.writeln(summary);
    buffer.writeln();

    // Highlights
    if (highlights.isNotEmpty) {
      buffer.writeln('【今期のハイライト】');
      for (final highlight in highlights) {
        buffer.writeln('  * $highlight');
      }
      buffer.writeln();
    }

    // Sections
    for (final section in sections) {
      buffer.writeln('-' * 30);
      buffer.writeln('【${section.title}】');
      buffer.writeln(section.content);
      buffer.writeln();
    }

    // Goals
    if (nextWeekGoals.isNotEmpty) {
      buffer.writeln('-' * 30);
      buffer.writeln('【次週の目標】');
      for (var i = 0; i < nextWeekGoals.length; i++) {
        buffer.writeln('  ${i + 1}. ${nextWeekGoals[i]}');
      }
      buffer.writeln();
    }

    buffer.writeln('=' * 50);
    buffer.writeln();
    buffer.writeln('※このレポートはトレーニング記録の参考情報です。');
    buffer.writeln('※医療的なアドバイスではありません。');

    return buffer.toString();
  }

  /// Convert to structured JSON for future PDF export
  Map<String, dynamic> toJson() => {
    'type': type.name,
    'title': title,
    'period': period,
    'generatedAt': generatedAt.toIso8601String(),
    'summary': summary,
    'highlights': highlights,
    'sections': sections.map((s) => s.toJson()).toList(),
    'nextWeekGoals': nextWeekGoals,
  };
}

/// Report generator service
class ReportGenerator {
  ReportGenerator(this._historyService);

  final HistoryService _historyService;

  /// Generate weekly report
  Future<TrainingReport> generateWeeklyReport({
    required String userId,
    DateTime? weekStart,
  }) async {
    final start = weekStart ?? _getWeekStart(DateTime.now());
    final end = start.add(const Duration(days: 7));

    // Fetch data
    final sessions = await _historyService.fetchSessions(
      userId: userId,
      filter: HistoryFilter(startDate: start, endDate: end),
      limit: 100,
    );

    final weeklyStats = await _historyService.fetchWeeklyStats(
      userId: userId,
      weekStart: start,
    );

    // Generate sections
    final sections = <ReportSection>[];

    // Training volume section
    sections.add(_generateVolumeSection(sessions, weeklyStats));

    // Performance section
    sections.add(_generatePerformanceSection(sessions));

    // Exercise breakdown section
    sections.add(_generateExerciseBreakdownSection(sessions));

    // Issues section
    sections.add(_generateIssuesSection(sessions));

    // Generate summary
    final summary = _generateWeeklySummary(sessions, weeklyStats);

    // Generate highlights
    final highlights = _generateHighlights(sessions, weeklyStats);

    // Generate goals
    final goals = _generateNextWeekGoals(sessions, weeklyStats);

    final dateFormat = DateFormat('M/d');
    return TrainingReport(
      type: ReportType.weekly,
      title: '週次トレーニングレポート',
      period:
          '${dateFormat.format(start)} - ${dateFormat.format(end.subtract(const Duration(days: 1)))}',
      generatedAt: DateTime.now(),
      sections: sections,
      summary: summary,
      highlights: highlights,
      nextWeekGoals: goals,
    );
  }

  /// Generate monthly report
  Future<TrainingReport> generateMonthlyReport({
    required String userId,
    int? year,
    int? month,
  }) async {
    final now = DateTime.now();
    final targetYear = year ?? now.year;
    final targetMonth = month ?? now.month;

    final start = DateTime(targetYear, targetMonth, 1);
    final end = DateTime(targetYear, targetMonth + 1, 1);

    // Fetch data
    final sessions = await _historyService.fetchSessions(
      userId: userId,
      filter: HistoryFilter(startDate: start, endDate: end),
      limit: 500,
    );

    final monthlyStats = await _historyService.fetchMonthlyStats(
      userId: userId,
      year: targetYear,
      month: targetMonth,
    );

    // Generate sections
    final sections = <ReportSection>[];

    // Overall stats section
    sections.add(_generateMonthlyOverviewSection(monthlyStats));

    // Volume trends section
    sections.add(_generateVolumeTrendsSection(monthlyStats));

    // Performance trends section
    sections.add(_generatePerformanceTrendsSection(sessions, monthlyStats));

    // Exercise analysis section
    sections.add(_generateExerciseAnalysisSection(sessions));

    // Progress section
    sections.add(_generateProgressSection(sessions));

    // Detailed issues section
    sections.add(_generateDetailedIssuesSection(sessions));

    // Generate summary
    final summary = _generateMonthlySummary(sessions, monthlyStats);

    // Generate highlights
    final highlights = _generateMonthlyHighlights(sessions, monthlyStats);

    return TrainingReport(
      type: ReportType.monthly,
      title: '月次トレーニングレポート',
      period: '$targetYear年$targetMonth月',
      generatedAt: DateTime.now(),
      sections: sections,
      summary: summary,
      highlights: highlights,
      nextWeekGoals: [], // Monthly report doesn't have weekly goals
    );
  }

  // Private helper methods

  DateTime _getWeekStart(DateTime date) {
    final dayOfWeek = date.weekday;
    return DateTime(
      date.year,
      date.month,
      date.day,
    ).subtract(Duration(days: dayOfWeek - 1));
  }

  ReportSection _generateVolumeSection(
    List<HistorySession> sessions,
    WeeklyStats stats,
  ) {
    final totalMinutes = stats.totalDuration.inMinutes;
    final avgSessionMinutes = sessions.isEmpty
        ? 0
        : totalMinutes ~/ sessions.length;

    final content =
        '''
トレーニング回数: ${sessions.length}回
総レップ数: ${stats.totalReps}回
総セット数: ${stats.totalSets}セット
総トレーニング時間: $totalMinutes分
平均セッション時間: $avgSessionMinutes分
アクティブ日数: ${stats.activeDays}日
''';

    return ReportSection(
      title: 'トレーニングボリューム',
      content: content,
      type: 'stats',
      data: {
        'sessions': sessions.length,
        'totalReps': stats.totalReps,
        'totalSets': stats.totalSets,
        'totalMinutes': totalMinutes,
        'activeDays': stats.activeDays,
      },
    );
  }

  ReportSection _generatePerformanceSection(List<HistorySession> sessions) {
    if (sessions.isEmpty) {
      return const ReportSection(
        title: 'パフォーマンス',
        content: 'この期間のセッションデータがありません。',
      );
    }

    final scores = sessions.map((s) => s.averageScore).toList();
    final avgScore = scores.reduce((a, b) => a + b) / scores.length;
    final maxScore = scores.reduce((a, b) => a > b ? a : b);
    final minScore = scores.reduce((a, b) => a < b ? a : b);

    // Calculate trend
    String trend = '横ばい';
    if (sessions.length >= 3) {
      final sorted = sessions.toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
      final firstHalf = sorted.take(sorted.length ~/ 2).toList();
      final secondHalf = sorted.skip(sorted.length ~/ 2).toList();

      final firstAvg =
          firstHalf.map((s) => s.averageScore).reduce((a, b) => a + b) /
          firstHalf.length;
      final secondAvg =
          secondHalf.map((s) => s.averageScore).reduce((a, b) => a + b) /
          secondHalf.length;

      if (secondAvg > firstAvg + 3) {
        trend = '上昇傾向';
      } else if (secondAvg < firstAvg - 3) {
        trend = '下降傾向';
      }
    }

    final content =
        '''
平均フォームスコア: ${avgScore.toStringAsFixed(1)}点
最高スコア: ${maxScore.toStringAsFixed(1)}点
最低スコア: ${minScore.toStringAsFixed(1)}点
スコアの傾向: $trend
''';

    return ReportSection(
      title: 'パフォーマンス',
      content: content,
      type: 'stats',
      data: {
        'avgScore': avgScore,
        'maxScore': maxScore,
        'minScore': minScore,
        'trend': trend,
      },
    );
  }

  ReportSection _generateExerciseBreakdownSection(
    List<HistorySession> sessions,
  ) {
    if (sessions.isEmpty) {
      return const ReportSection(title: '種目別内訳', content: 'データがありません。');
    }

    final breakdown = <ExerciseType, List<HistorySession>>{};
    for (final session in sessions) {
      breakdown.putIfAbsent(session.exerciseType, () => []).add(session);
    }

    final buffer = StringBuffer();
    final data = <String, dynamic>{};

    for (final entry in breakdown.entries) {
      final name = AnalyzerFactory.getDisplayName(entry.key);
      final count = entry.value.length;
      final avgScore =
          entry.value.map((s) => s.averageScore).reduce((a, b) => a + b) /
          entry.value.length;
      final totalReps = entry.value.fold(0, (sum, s) => sum + s.totalReps);

      buffer.writeln('$name:');
      buffer.writeln('  セッション数: $count回');
      buffer.writeln('  平均スコア: ${avgScore.toStringAsFixed(1)}点');
      buffer.writeln('  総レップ数: $totalReps回');

      data[entry.key.name] = {
        'sessions': count,
        'avgScore': avgScore,
        'totalReps': totalReps,
      };
    }

    return ReportSection(
      title: '種目別内訳',
      content: buffer.toString(),
      type: 'stats',
      data: data,
    );
  }

  ReportSection _generateIssuesSection(List<HistorySession> sessions) {
    if (sessions.isEmpty) {
      return const ReportSection(title: '改善ポイント', content: 'データがありません。');
    }

    // Collect all issues
    final issueCounts = <String, int>{};
    for (final session in sessions) {
      for (final issue in session.primaryIssues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }
    }

    if (issueCounts.isEmpty) {
      return const ReportSection(
        title: '改善ポイント',
        content: '特に目立った改善点は検出されませんでした。',
      );
    }

    final sorted = issueCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final buffer = StringBuffer();
    buffer.writeln('頻出する改善ポイント:');

    for (var i = 0; i < sorted.length.clamp(0, 5); i++) {
      final entry = sorted[i];
      final percentage = (entry.value / sessions.length * 100).toStringAsFixed(
        0,
      );
      buffer.writeln(
        '  ${i + 1}. ${entry.key} (${entry.value}回検出, $percentage%)',
      );
    }

    return ReportSection(
      title: '改善ポイント',
      content: buffer.toString(),
      type: 'list',
      data: {
        'issues': sorted
            .take(5)
            .map((e) => {'issue': e.key, 'count': e.value})
            .toList(),
      },
    );
  }

  ReportSection _generateMonthlyOverviewSection(MonthlyStats stats) {
    final totalHours = stats.totalDuration.inMinutes / 60;

    final content =
        '''
総セッション数: ${stats.totalSessions}回
総レップ数: ${stats.totalReps}回
総セット数: ${stats.totalSets}セット
総トレーニング時間: ${totalHours.toStringAsFixed(1)}時間
平均フォームスコア: ${stats.averageScore.toStringAsFixed(1)}点
アクティブ日数: ${stats.activeDays}日
現在のストリーク: ${stats.streakDays}日
月間ベストストリーク: ${stats.bestStreakDays}日
''';

    return ReportSection(
      title: '月間サマリー',
      content: content,
      type: 'stats',
      data: {
        'totalSessions': stats.totalSessions,
        'totalReps': stats.totalReps,
        'totalSets': stats.totalSets,
        'totalHours': totalHours,
        'averageScore': stats.averageScore,
        'activeDays': stats.activeDays,
        'streakDays': stats.streakDays,
        'bestStreakDays': stats.bestStreakDays,
      },
    );
  }

  ReportSection _generateVolumeTrendsSection(MonthlyStats stats) {
    if (stats.weeklyStats.isEmpty) {
      return const ReportSection(title: 'ボリューム推移', content: 'データがありません。');
    }

    final buffer = StringBuffer();
    final dateFormat = DateFormat('M/d');

    for (var i = 0; i < stats.weeklyStats.length; i++) {
      final week = stats.weeklyStats[i];
      final weekEnd = week.weekStart.add(const Duration(days: 6));
      buffer.writeln(
        'Week ${i + 1} (${dateFormat.format(week.weekStart)}〜${dateFormat.format(weekEnd)}):',
      );
      buffer.writeln('  セッション: ${week.totalSessions}回');
      buffer.writeln('  レップ: ${week.totalReps}回');
      buffer.writeln('  平均スコア: ${week.averageScore.toStringAsFixed(1)}点');
    }

    return ReportSection(
      title: 'ボリューム推移',
      content: buffer.toString(),
      type: 'chart_data',
      data: {
        'weeks': stats.weeklyStats
            .map(
              (w) => {
                'weekStart': w.weekStart.toIso8601String(),
                'sessions': w.totalSessions,
                'reps': w.totalReps,
                'avgScore': w.averageScore,
              },
            )
            .toList(),
      },
    );
  }

  ReportSection _generatePerformanceTrendsSection(
    List<HistorySession> sessions,
    MonthlyStats stats,
  ) {
    if (sessions.isEmpty) {
      return const ReportSection(title: 'パフォーマンス推移', content: 'データがありません。');
    }

    final sorted = sessions.toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));

    // Calculate improvement
    double improvement = 0;
    if (sorted.length >= 5) {
      final first5 = sorted.take(5).map((s) => s.averageScore).toList();
      final last5 = sorted.reversed.take(5).map((s) => s.averageScore).toList();
      final firstAvg = first5.reduce((a, b) => a + b) / 5;
      final lastAvg = last5.reduce((a, b) => a + b) / 5;
      improvement = lastAvg - firstAvg;
    }

    final improvementText = improvement > 0
        ? '+${improvement.toStringAsFixed(1)}点の改善'
        : improvement < 0
        ? '${improvement.toStringAsFixed(1)}点の変動'
        : '変動なし';

    final content =
        '''
月初スコア: ${sorted.first.averageScore.toStringAsFixed(1)}点
月末スコア: ${sorted.last.averageScore.toStringAsFixed(1)}点
改善幅: $improvementText
''';

    return ReportSection(
      title: 'パフォーマンス推移',
      content: content,
      type: 'stats',
      data: {
        'firstScore': sorted.first.averageScore,
        'lastScore': sorted.last.averageScore,
        'improvement': improvement,
      },
    );
  }

  ReportSection _generateExerciseAnalysisSection(
    List<HistorySession> sessions,
  ) {
    if (sessions.isEmpty) {
      return const ReportSection(title: '種目別分析', content: 'データがありません。');
    }

    final analysis = <ExerciseType, Map<String, dynamic>>{};

    for (final type in ExerciseType.values) {
      final typeSessions = sessions
          .where((s) => s.exerciseType == type)
          .toList();
      if (typeSessions.isEmpty) continue;

      final scores = typeSessions.map((s) => s.averageScore).toList();
      final avgScore = scores.reduce((a, b) => a + b) / scores.length;
      final bestScore = scores.reduce((a, b) => a > b ? a : b);

      // Calculate improvement
      double improvement = 0;
      if (typeSessions.length >= 3) {
        final sorted = typeSessions.toList()
          ..sort((a, b) => a.startTime.compareTo(b.startTime));
        improvement = sorted.last.averageScore - sorted.first.averageScore;
      }

      analysis[type] = {
        'sessions': typeSessions.length,
        'avgScore': avgScore,
        'bestScore': bestScore,
        'improvement': improvement,
        'issues': typeSessions
            .expand((s) => s.primaryIssues)
            .toSet()
            .take(3)
            .toList(),
      };
    }

    final buffer = StringBuffer();

    for (final entry in analysis.entries) {
      final name = AnalyzerFactory.getDisplayName(entry.key);
      final data = entry.value;

      buffer.writeln('$name:');
      buffer.writeln('  セッション数: ${data['sessions']}回');
      buffer.writeln(
        '  平均スコア: ${(data['avgScore'] as double).toStringAsFixed(1)}点',
      );
      buffer.writeln(
        '  ベストスコア: ${(data['bestScore'] as double).toStringAsFixed(1)}点',
      );

      final improvement = data['improvement'] as double;
      if (improvement != 0) {
        buffer.writeln(
          '  月間改善: ${improvement >= 0 ? '+' : ''}${improvement.toStringAsFixed(1)}点',
        );
      }

      final issues = data['issues'] as List;
      if (issues.isNotEmpty) {
        buffer.writeln('  主な課題: ${issues.join(', ')}');
      }

      buffer.writeln();
    }

    return ReportSection(
      title: '種目別分析',
      content: buffer.toString(),
      type: 'stats',
      data: analysis.map((k, v) => MapEntry(k.name, v)),
    );
  }

  ReportSection _generateProgressSection(List<HistorySession> sessions) {
    if (sessions.length < 5) {
      return const ReportSection(
        title: '進捗評価',
        content: 'より詳細な分析には5回以上のセッションが必要です。',
      );
    }

    final sorted = sessions.toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));

    // Compare first and last 5 sessions
    final first5 = sorted.take(5).toList();
    final last5 = sorted.reversed.take(5).toList();

    final first5Avg =
        first5.map((s) => s.averageScore).reduce((a, b) => a + b) / 5;
    final last5Avg =
        last5.map((s) => s.averageScore).reduce((a, b) => a + b) / 5;

    final first5Reps = first5.fold<int>(0, (sum, s) => sum + s.totalReps);
    final last5Reps = last5.fold<int>(0, (sum, s) => sum + s.totalReps);

    final scoreChange = last5Avg - first5Avg;
    final repsChange = last5Reps - first5Reps;

    String evaluation;
    if (scoreChange > 5 && repsChange > 0) {
      evaluation = '素晴らしい進歩です！スコアとボリュームの両方が向上しています。';
    } else if (scoreChange > 3) {
      evaluation = 'フォームの質が向上しています。この調子で続けましょう。';
    } else if (repsChange > 10) {
      evaluation = 'トレーニング量が増加しています。フォームの質も維持できています。';
    } else if (scoreChange < -3) {
      evaluation = 'スコアが低下傾向にあります。休息を取るか、フォームを再確認することをお勧めします。';
    } else {
      evaluation = '安定したパフォーマンスを維持しています。新しい刺激を加えてみるのも良いでしょう。';
    }

    final content =
        '''
月初5セッション平均スコア: ${first5Avg.toStringAsFixed(1)}点
月末5セッション平均スコア: ${last5Avg.toStringAsFixed(1)}点
スコア変化: ${scoreChange >= 0 ? '+' : ''}${scoreChange.toStringAsFixed(1)}点

月初5セッション総レップ数: $first5Reps回
月末5セッション総レップ数: $last5Reps回
ボリューム変化: ${repsChange >= 0 ? '+' : ''}$repsChange回

【評価】
$evaluation
''';

    return ReportSection(
      title: '進捗評価',
      content: content,
      type: 'stats',
      data: {
        'first5Avg': first5Avg,
        'last5Avg': last5Avg,
        'scoreChange': scoreChange,
        'first5Reps': first5Reps,
        'last5Reps': last5Reps,
        'repsChange': repsChange,
        'evaluation': evaluation,
      },
    );
  }

  ReportSection _generateDetailedIssuesSection(List<HistorySession> sessions) {
    // Group issues by exercise type
    final issuesByExercise = <ExerciseType, Map<String, int>>{};

    for (final session in sessions) {
      issuesByExercise.putIfAbsent(session.exerciseType, () => {});

      for (final issue in session.primaryIssues) {
        issuesByExercise[session.exerciseType]![issue] =
            (issuesByExercise[session.exerciseType]![issue] ?? 0) + 1;
      }
    }

    final buffer = StringBuffer();

    for (final entry in issuesByExercise.entries) {
      if (entry.value.isEmpty) continue;

      final name = AnalyzerFactory.getDisplayName(entry.key);
      buffer.writeln('$name:');

      final sorted = entry.value.entries.toList()
        ..sort((a, b) => b.value.compareTo(a.value));

      for (var i = 0; i < sorted.length.clamp(0, 3); i++) {
        buffer.writeln('  - ${sorted[i].key} (${sorted[i].value}回)');
      }

      buffer.writeln();
    }

    if (buffer.isEmpty) {
      return const ReportSection(
        title: '種目別改善ポイント',
        content: '特に目立った改善点は検出されませんでした。',
      );
    }

    return ReportSection(
      title: '種目別改善ポイント',
      content: buffer.toString(),
      type: 'list',
      data: issuesByExercise.map((k, v) => MapEntry(k.name, v)),
    );
  }

  String _generateWeeklySummary(
    List<HistorySession> sessions,
    WeeklyStats stats,
  ) {
    if (sessions.isEmpty) {
      return 'この週はトレーニングがありませんでした。来週は少しずつでも始めてみましょう。';
    }

    final avgScore = stats.averageScore;
    String performance;

    if (avgScore >= 85) {
      performance = '素晴らしいパフォーマンスを維持しています';
    } else if (avgScore >= 70) {
      performance = '良好なフォームでトレーニングができています';
    } else if (avgScore >= 50) {
      performance = 'フォームの改善余地があります';
    } else {
      performance = 'フォームの見直しをお勧めします';
    }

    return '今週は${sessions.length}回のセッションを行い、'
        '合計${stats.totalReps}レップを達成しました。'
        '平均フォームスコアは${avgScore.toStringAsFixed(1)}点で、$performance。';
  }

  String _generateMonthlySummary(
    List<HistorySession> sessions,
    MonthlyStats stats,
  ) {
    if (sessions.isEmpty) {
      return 'この月はトレーニングがありませんでした。次月は目標を設定して始めてみましょう。';
    }

    final avgScore = stats.averageScore;
    final consistency = stats.activeDays >= 12
        ? '高い'
        : stats.activeDays >= 8
        ? '中程度の'
        : '低い';

    return '今月は${stats.totalSessions}回のセッション、'
        '${stats.activeDays}日のアクティブ日を記録しました。'
        '総レップ数${stats.totalReps}回、平均スコア${avgScore.toStringAsFixed(1)}点で、'
        '$consistency継続性でトレーニングを行いました。'
        '最長ストリークは${stats.bestStreakDays}日でした。';
  }

  List<String> _generateHighlights(
    List<HistorySession> sessions,
    WeeklyStats stats,
  ) {
    final highlights = <String>[];

    if (sessions.isEmpty) return highlights;

    // Best session
    final best = sessions.reduce(
      (a, b) => a.averageScore > b.averageScore ? a : b,
    );
    final dateFormat = DateFormat('M/d');
    highlights.add(
      'ベストセッション: ${dateFormat.format(best.startTime)} - '
      '${AnalyzerFactory.getDisplayName(best.exerciseType)} '
      '${best.averageScore.toStringAsFixed(0)}点',
    );

    // Highest volume day
    final byDate = <DateTime, int>{};
    for (final s in sessions) {
      final date = DateTime(
        s.startTime.year,
        s.startTime.month,
        s.startTime.day,
      );
      byDate[date] = (byDate[date] ?? 0) + s.totalReps;
    }

    if (byDate.isNotEmpty) {
      final maxEntry = byDate.entries.reduce(
        (a, b) => a.value > b.value ? a : b,
      );
      highlights.add(
        '最高ボリューム: ${dateFormat.format(maxEntry.key)} - '
        '${maxEntry.value}レップ',
      );
    }

    // Streak
    if (stats.activeDays >= 3) {
      highlights.add('アクティブ日数: ${stats.activeDays}日/7日');
    }

    return highlights;
  }

  List<String> _generateMonthlyHighlights(
    List<HistorySession> sessions,
    MonthlyStats stats,
  ) {
    final highlights = <String>[];

    if (sessions.isEmpty) return highlights;

    // Best session
    final best = sessions.reduce(
      (a, b) => a.averageScore > b.averageScore ? a : b,
    );
    final dateFormat = DateFormat('M/d');
    highlights.add(
      '月間ベストセッション: ${dateFormat.format(best.startTime)} - '
      '${best.averageScore.toStringAsFixed(0)}点',
    );

    // Best streak
    if (stats.bestStreakDays >= 3) {
      highlights.add('月間ベストストリーク: ${stats.bestStreakDays}日連続');
    }

    // Most practiced exercise
    final exerciseCounts = <ExerciseType, int>{};
    for (final s in sessions) {
      exerciseCounts[s.exerciseType] =
          (exerciseCounts[s.exerciseType] ?? 0) + 1;
    }

    if (exerciseCounts.isNotEmpty) {
      final mostPracticed = exerciseCounts.entries.reduce(
        (a, b) => a.value > b.value ? a : b,
      );
      highlights.add(
        '最多種目: ${AnalyzerFactory.getDisplayName(mostPracticed.key)} '
        '(${mostPracticed.value}回)',
      );
    }

    // Consistency
    highlights.add(
      '継続率: ${(stats.activeDays / 30 * 100).toStringAsFixed(0)}% '
      '(${stats.activeDays}日)',
    );

    return highlights;
  }

  List<String> _generateNextWeekGoals(
    List<HistorySession> sessions,
    WeeklyStats stats,
  ) {
    final goals = <String>[];

    if (sessions.isEmpty) {
      goals.add('まずは週2回のトレーニングを目指しましょう');
      goals.add('スクワットから始めることをお勧めします');
      return goals;
    }

    // Frequency goal
    if (stats.activeDays < 3) {
      goals.add('週${stats.activeDays + 1}日以上のトレーニングを目指す');
    } else {
      goals.add('週${stats.activeDays}日のペースを維持する');
    }

    // Score goal
    final avgScore = stats.averageScore;
    if (avgScore < 70) {
      goals.add('平均スコア70点以上を目指す');
    } else if (avgScore < 85) {
      goals.add('平均スコア${(avgScore + 5).toStringAsFixed(0)}点以上を目指す');
    } else {
      goals.add('高いスコアを維持しながらボリュームを増やす');
    }

    // Issue focus
    final allIssues = sessions.expand((s) => s.primaryIssues).toList();
    if (allIssues.isNotEmpty) {
      final issueCounts = <String, int>{};
      for (final issue in allIssues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }

      final topIssue = issueCounts.entries.reduce(
        (a, b) => a.value > b.value ? a : b,
      );
      goals.add('「${topIssue.key}」の改善に注力する');
    }

    return goals;
  }
}

/// Report generator provider
final reportGeneratorProvider = Provider<ReportGenerator>((ref) {
  final historyService = ref.watch(historyServiceProvider);
  return ReportGenerator(historyService);
});

/// Weekly report provider
final weeklyReportProvider = FutureProvider.autoDispose
    .family<TrainingReport, String>((ref, userId) async {
      final generator = ref.watch(reportGeneratorProvider);
      return generator.generateWeeklyReport(userId: userId);
    });

/// Monthly report provider
final monthlyReportProvider = FutureProvider.autoDispose
    .family<TrainingReport, ({String userId, int year, int month})>((
      ref,
      params,
    ) async {
      final generator = ref.watch(reportGeneratorProvider);
      return generator.generateMonthlyReport(
        userId: params.userId,
        year: params.year,
        month: params.month,
      );
    });
