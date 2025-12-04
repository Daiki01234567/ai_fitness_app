/// Form Analysis View
///
/// Detailed form analysis widget with trends, error patterns, and correlations.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/00_要件定義書_v3_3.md (FR-028~FR-030)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/history/history_models.dart';
import '../../core/history/history_service.dart';
import '../../core/theme/app_theme.dart';

/// Form analysis state
class FormAnalysisState {
  const FormAnalysisState({
    this.selectedExercise,
    this.sessions = const [],
    this.isLoading = false,
    this.error,
    this.trendData = const [],
    this.errorPatterns = const [],
    this.timePatterns = const {},
    this.fatigueAnalysis,
    this.repsCorrelation,
  });

  final ExerciseType? selectedExercise;
  final List<HistorySession> sessions;
  final bool isLoading;
  final String? error;
  final List<TrendDataPoint> trendData;
  final List<ErrorPattern> errorPatterns;
  final Map<String, double> timePatterns; // morning, afternoon, evening
  final FatigueAnalysis? fatigueAnalysis;
  final CorrelationAnalysis? repsCorrelation;

  FormAnalysisState copyWith({
    ExerciseType? selectedExercise,
    List<HistorySession>? sessions,
    bool? isLoading,
    String? error,
    List<TrendDataPoint>? trendData,
    List<ErrorPattern>? errorPatterns,
    Map<String, double>? timePatterns,
    FatigueAnalysis? fatigueAnalysis,
    CorrelationAnalysis? repsCorrelation,
  }) {
    return FormAnalysisState(
      selectedExercise: selectedExercise ?? this.selectedExercise,
      sessions: sessions ?? this.sessions,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      trendData: trendData ?? this.trendData,
      errorPatterns: errorPatterns ?? this.errorPatterns,
      timePatterns: timePatterns ?? this.timePatterns,
      fatigueAnalysis: fatigueAnalysis ?? this.fatigueAnalysis,
      repsCorrelation: repsCorrelation ?? this.repsCorrelation,
    );
  }
}

/// Trend data point for charts
class TrendDataPoint {
  const TrendDataPoint({
    required this.date,
    required this.score,
    this.improvementRate,
  });

  final DateTime date;
  final double score;
  final double? improvementRate;
}

/// Error pattern analysis result
class ErrorPattern {
  const ErrorPattern({
    required this.issue,
    required this.count,
    required this.percentage,
    this.trend = 'stable', // improving, stable, worsening
  });

  final String issue;
  final int count;
  final double percentage;
  final String trend;
}

/// Fatigue analysis within session
class FatigueAnalysis {
  const FatigueAnalysis({
    required this.avgFirstSetScore,
    required this.avgLastSetScore,
    required this.degradationPercentage,
    required this.recommendation,
  });

  final double avgFirstSetScore;
  final double avgLastSetScore;
  final double degradationPercentage;
  final String recommendation;
}

/// Correlation analysis
class CorrelationAnalysis {
  const CorrelationAnalysis({
    required this.label,
    required this.correlation,
    required this.description,
  });

  final String label;
  final double correlation; // -1 to 1
  final String description;
}

/// Form analysis state notifier
class FormAnalysisNotifier extends StateNotifier<FormAnalysisState> {
  FormAnalysisNotifier(this._historyService, this._userId)
    : super(const FormAnalysisState());

  final HistoryService _historyService;
  final String _userId;

  /// Load analysis data for selected exercise
  Future<void> loadAnalysis(ExerciseType exercise) async {
    state = state.copyWith(
      selectedExercise: exercise,
      isLoading: true,
      error: null,
    );

    try {
      // Fetch sessions for last 3 months
      final startDate = DateTime.now().subtract(const Duration(days: 90));
      final sessions = await _historyService.fetchSessions(
        userId: _userId,
        filter: HistoryFilter(startDate: startDate, exerciseTypes: [exercise]),
        limit: 200,
      );

      if (sessions.isEmpty) {
        state = state.copyWith(
          sessions: [],
          isLoading: false,
          error: 'データがありません',
        );
        return;
      }

      // Sort by date
      sessions.sort((a, b) => a.startTime.compareTo(b.startTime));

      // Analyze data
      final trendData = _analyzeTrend(sessions);
      final errorPatterns = _analyzeErrorPatterns(sessions);
      final timePatterns = _analyzeTimePatterns(sessions);
      final fatigueAnalysis = _analyzeFatigue(sessions);
      final repsCorrelation = _analyzeRepsCorrelation(sessions);

      state = state.copyWith(
        sessions: sessions,
        trendData: trendData,
        errorPatterns: errorPatterns,
        timePatterns: timePatterns,
        fatigueAnalysis: fatigueAnalysis,
        repsCorrelation: repsCorrelation,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: '分析データの読み込みに失敗しました');
    }
  }

  List<TrendDataPoint> _analyzeTrend(List<HistorySession> sessions) {
    if (sessions.isEmpty) return [];

    final points = <TrendDataPoint>[];
    double? previousScore;

    for (final session in sessions) {
      double? improvementRate;
      if (previousScore != null && previousScore > 0) {
        improvementRate =
            ((session.averageScore - previousScore) / previousScore) * 100;
      }

      points.add(
        TrendDataPoint(
          date: session.startTime,
          score: session.averageScore,
          improvementRate: improvementRate,
        ),
      );

      previousScore = session.averageScore;
    }

    return points;
  }

  List<ErrorPattern> _analyzeErrorPatterns(List<HistorySession> sessions) {
    if (sessions.isEmpty) return [];

    // Count all issues
    final issueCounts = <String, int>{};
    final recentIssueCounts = <String, int>{}; // Last 10 sessions

    final recent = sessions.length > 10
        ? sessions.sublist(sessions.length - 10)
        : sessions;
    final older = sessions.length > 20
        ? sessions.sublist(0, sessions.length - 10)
        : sessions;

    for (final session in sessions) {
      for (final issue in session.primaryIssues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }
    }

    for (final session in recent) {
      for (final issue in session.primaryIssues) {
        recentIssueCounts[issue] = (recentIssueCounts[issue] ?? 0) + 1;
      }
    }

    // Calculate percentages and trends
    final patterns = <ErrorPattern>[];
    final sorted = issueCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    for (var i = 0; i < sorted.length.clamp(0, 5); i++) {
      final entry = sorted[i];
      final percentage = (entry.value / sessions.length) * 100;

      // Determine trend
      String trend = 'stable';
      if (sessions.length >= 10) {
        final recentCount = recentIssueCounts[entry.key] ?? 0;
        final recentPct = recentCount / recent.length;
        final olderCount = issueCounts[entry.key]! - recentCount;
        final olderPct = older.isNotEmpty ? olderCount / older.length : 0.0;

        if (recentPct < olderPct - 0.1) {
          trend = 'improving';
        } else if (recentPct > olderPct + 0.1) {
          trend = 'worsening';
        }
      }

      patterns.add(
        ErrorPattern(
          issue: entry.key,
          count: entry.value,
          percentage: percentage,
          trend: trend,
        ),
      );
    }

    return patterns;
  }

  Map<String, double> _analyzeTimePatterns(List<HistorySession> sessions) {
    if (sessions.isEmpty) return {};

    final morningScores = <double>[];
    final afternoonScores = <double>[];
    final eveningScores = <double>[];

    for (final session in sessions) {
      final hour = session.startTime.hour;
      if (hour < 12) {
        morningScores.add(session.averageScore);
      } else if (hour < 17) {
        afternoonScores.add(session.averageScore);
      } else {
        eveningScores.add(session.averageScore);
      }
    }

    double avg(List<double> list) {
      if (list.isEmpty) return 0;
      return list.reduce((a, b) => a + b) / list.length;
    }

    return {
      'morning': avg(morningScores),
      'afternoon': avg(afternoonScores),
      'evening': avg(eveningScores),
    };
  }

  FatigueAnalysis? _analyzeFatigue(List<HistorySession> sessions) {
    if (sessions.isEmpty) return null;

    // Analyze score degradation within sessions
    final firstSetScores = <double>[];
    final lastSetScores = <double>[];

    for (final session in sessions) {
      if (session.sets.length >= 2) {
        firstSetScores.add(session.sets.first.averageScore);
        lastSetScores.add(session.sets.last.averageScore);
      }
    }

    if (firstSetScores.isEmpty) return null;

    final avgFirst =
        firstSetScores.reduce((a, b) => a + b) / firstSetScores.length;
    final avgLast =
        lastSetScores.reduce((a, b) => a + b) / lastSetScores.length;
    final degradation = avgFirst > 0
        ? ((avgFirst - avgLast) / avgFirst) * 100
        : 0.0;

    String recommendation;
    if (degradation > 15) {
      recommendation = 'セット間の休息時間を増やすか、セット数を減らすことを検討してください。';
    } else if (degradation > 5) {
      recommendation = '軽度の疲労による劣化が見られます。休息時間を意識しましょう。';
    } else if (degradation < -5) {
      recommendation = 'ウォームアップが不十分な可能性があります。最初のセットを意識しましょう。';
    } else {
      recommendation = 'セット間のフォーム維持が良好です。この調子を続けましょう。';
    }

    return FatigueAnalysis(
      avgFirstSetScore: avgFirst,
      avgLastSetScore: avgLast,
      degradationPercentage: degradation,
      recommendation: recommendation,
    );
  }

  CorrelationAnalysis? _analyzeRepsCorrelation(List<HistorySession> sessions) {
    if (sessions.length < 5) return null;

    // Calculate correlation between total reps and average score
    final reps = sessions.map((s) => s.totalReps.toDouble()).toList();
    final scores = sessions.map((s) => s.averageScore).toList();

    final correlation = _calculateCorrelation(reps, scores);

    String description;
    if (correlation > 0.5) {
      description = 'レップ数が増えるとスコアも向上する傾向があります。';
    } else if (correlation < -0.5) {
      description = 'レップ数が多いとスコアが低下する傾向があります。質を維持しながら量を調整しましょう。';
    } else if (correlation > 0.2) {
      description = 'レップ数とスコアに弱い正の相関があります。';
    } else if (correlation < -0.2) {
      description = 'レップ数とスコアに弱い負の相関があります。';
    } else {
      description = 'レップ数とスコアに明確な相関は見られません。';
    }

    return CorrelationAnalysis(
      label: 'レップ数 vs スコア',
      correlation: correlation,
      description: description,
    );
  }

  double _calculateCorrelation(List<double> x, List<double> y) {
    if (x.length != y.length || x.isEmpty) return 0;

    final n = x.length;
    final meanX = x.reduce((a, b) => a + b) / n;
    final meanY = y.reduce((a, b) => a + b) / n;

    double numerator = 0;
    double denomX = 0;
    double denomY = 0;

    for (var i = 0; i < n; i++) {
      final dx = x[i] - meanX;
      final dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    final denom = math.sqrt(denomX * denomY);
    if (denom == 0) return 0;

    return numerator / denom;
  }
}

/// Form analysis provider
final formAnalysisProvider =
    StateNotifierProvider.autoDispose<FormAnalysisNotifier, FormAnalysisState>((
      ref,
    ) {
      final historyService = ref.watch(historyServiceProvider);
      final authState = ref.watch(authStateProvider);
      final userId = authState.user?.uid ?? '';
      return FormAnalysisNotifier(historyService, userId);
    });

/// Form Analysis View widget
class FormAnalysisView extends ConsumerStatefulWidget {
  const FormAnalysisView({super.key, this.initialExercise});

  final ExerciseType? initialExercise;

  @override
  ConsumerState<FormAnalysisView> createState() => _FormAnalysisViewState();
}

class _FormAnalysisViewState extends ConsumerState<FormAnalysisView> {
  ExerciseType _selectedExercise = ExerciseType.squat;

  @override
  void initState() {
    super.initState();
    _selectedExercise = widget.initialExercise ?? ExerciseType.squat;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(formAnalysisProvider.notifier).loadAnalysis(_selectedExercise);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(formAnalysisProvider);
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Exercise selector
        _buildExerciseSelector(theme),
        const SizedBox(height: 16),

        if (state.isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(),
            ),
          )
        else if (state.error != null)
          _buildErrorState(state.error!, theme)
        else if (state.sessions.isEmpty)
          _buildEmptyState(theme)
        else ...[
          // Score Trend Section
          _buildTrendSection(state, theme),
          const SizedBox(height: 24),

          // Error Patterns Section
          _buildErrorPatternsSection(state, theme),
          const SizedBox(height: 24),

          // Time of Day Section
          _buildTimePatternSection(state, theme),
          const SizedBox(height: 24),

          // Fatigue Analysis Section
          if (state.fatigueAnalysis != null)
            _buildFatigueSection(state.fatigueAnalysis!, theme),
          const SizedBox(height: 24),

          // Correlation Section
          if (state.repsCorrelation != null)
            _buildCorrelationSection(state.repsCorrelation!, theme),

          // Legal disclaimer
          const SizedBox(height: 32),
          _buildDisclaimer(theme),
        ],
      ],
    );
  }

  Widget _buildExerciseSelector(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Text(
              '種目選択:',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButton<ExerciseType>(
                value: _selectedExercise,
                isExpanded: true,
                underline: const SizedBox.shrink(),
                items: ExerciseType.values.map((type) {
                  return DropdownMenuItem(
                    value: type,
                    child: Text(AnalyzerFactory.getDisplayName(type)),
                  );
                }).toList(),
                onChanged: (type) {
                  if (type != null) {
                    setState(() {
                      _selectedExercise = type;
                    });
                    ref.read(formAnalysisProvider.notifier).loadAnalysis(type);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendSection(FormAnalysisState state, ThemeData theme) {
    // Calculate plateau detection
    bool isPlateauing = false;
    double avgImprovement = 0;

    if (state.trendData.length >= 5) {
      final recent = state.trendData.sublist(state.trendData.length - 5);
      final improvements = recent
          .where((p) => p.improvementRate != null)
          .map((p) => p.improvementRate!.abs())
          .toList();

      if (improvements.isNotEmpty) {
        avgImprovement =
            improvements.reduce((a, b) => a + b) / improvements.length;
        isPlateauing = avgImprovement < 2.0;
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'フォーム改善トレンド',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (isPlateauing)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'プラトー検出',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Custom chart
            SizedBox(
              height: 200,
              child: CustomPaint(
                size: const Size(double.infinity, 200),
                painter: _TrendChartPainter(
                  state.trendData,
                  theme.colorScheme.primary,
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Stats row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatItem(
                  '初回スコア',
                  state.trendData.isNotEmpty
                      ? '${state.trendData.first.score.toStringAsFixed(0)}点'
                      : '-',
                  theme,
                ),
                _buildStatItem(
                  '最新スコア',
                  state.trendData.isNotEmpty
                      ? '${state.trendData.last.score.toStringAsFixed(0)}点'
                      : '-',
                  theme,
                ),
                _buildStatItem(
                  '改善率',
                  state.trendData.length >= 2
                      ? '${((state.trendData.last.score - state.trendData.first.score) / state.trendData.first.score * 100).toStringAsFixed(1)}%'
                      : '-',
                  theme,
                  valueColor:
                      state.trendData.length >= 2 &&
                          state.trendData.last.score >
                              state.trendData.first.score
                      ? AppColors.scoreExcellent
                      : null,
                ),
              ],
            ),

            if (isPlateauing) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.lightbulb_outline,
                      color: Colors.orange.shade800,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'スコアが停滞しています。フォームの細部を見直すか、新しいアプローチを試してみましょう。',
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildErrorPatternsSection(FormAnalysisState state, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'エラーパターン分析',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'よくある間違いTop5',
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 16),

            if (state.errorPatterns.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '特に目立ったエラーパターンは検出されませんでした',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.grey.shade500,
                    ),
                  ),
                ),
              )
            else
              ...state.errorPatterns.map(
                (pattern) => _buildErrorPatternItem(pattern, theme),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorPatternItem(ErrorPattern pattern, ThemeData theme) {
    IconData trendIcon;
    Color trendColor;

    switch (pattern.trend) {
      case 'improving':
        trendIcon = Icons.trending_down;
        trendColor = AppColors.scoreExcellent;
        break;
      case 'worsening':
        trendIcon = Icons.trending_up;
        trendColor = AppColors.scorePoor;
        break;
      default:
        trendIcon = Icons.trending_flat;
        trendColor = Colors.grey;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              pattern.issue,
              style: theme.textTheme.bodyMedium,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 3,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: pattern.percentage / 100,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation(
                  _getPercentageColor(pattern.percentage),
                ),
                minHeight: 8,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 50,
            child: Text(
              '${pattern.percentage.toStringAsFixed(0)}%',
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 4),
          Icon(trendIcon, size: 16, color: trendColor),
        ],
      ),
    );
  }

  Color _getPercentageColor(double percentage) {
    if (percentage >= 50) return AppColors.scorePoor;
    if (percentage >= 30) return AppColors.scoreAverage;
    if (percentage >= 15) return AppColors.scoreGood;
    return AppColors.scoreExcellent;
  }

  Widget _buildTimePatternSection(FormAnalysisState state, ThemeData theme) {
    final patterns = state.timePatterns;
    if (patterns.isEmpty) return const SizedBox.shrink();

    final morning = patterns['morning'] ?? 0;
    final afternoon = patterns['afternoon'] ?? 0;
    final evening = patterns['evening'] ?? 0;

    String recommendation = '';
    double bestTime = 0;
    String bestLabel = '';

    if (morning > afternoon && morning > evening && morning > 0) {
      bestTime = morning;
      bestLabel = '午前中';
    } else if (afternoon > morning && afternoon > evening && afternoon > 0) {
      bestTime = afternoon;
      bestLabel = '午後';
    } else if (evening > 0) {
      bestTime = evening;
      bestLabel = '夕方以降';
    }

    if (bestTime > 0) {
      recommendation = '$bestLabelのトレーニングでベストパフォーマンスが出る傾向があります。';
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '時間帯別傾向',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildTimeBlock('午前', morning, Icons.wb_sunny_outlined, theme),
                _buildTimeBlock('午後', afternoon, Icons.wb_sunny, theme),
                _buildTimeBlock(
                  '夕方',
                  evening,
                  Icons.nights_stay_outlined,
                  theme,
                ),
              ],
            ),

            if (recommendation.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer.withValues(
                    alpha: 0.3,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.schedule,
                      color: theme.colorScheme.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        recommendation,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTimeBlock(
    String label,
    double score,
    IconData icon,
    ThemeData theme,
  ) {
    return Column(
      children: [
        Icon(icon, size: 24, color: theme.colorScheme.primary),
        const SizedBox(height: 4),
        Text(label, style: theme.textTheme.bodySmall),
        const SizedBox(height: 4),
        Text(
          score > 0 ? '${score.toStringAsFixed(0)}点' : '-',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: score > 0 ? _getScoreColor(score) : Colors.grey,
          ),
        ),
      ],
    );
  }

  Widget _buildFatigueSection(FatigueAnalysis analysis, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '疲労による劣化分析',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatItem(
                  '最初のセット平均',
                  '${analysis.avgFirstSetScore.toStringAsFixed(1)}点',
                  theme,
                ),
                Icon(
                  analysis.degradationPercentage > 0
                      ? Icons.arrow_forward
                      : Icons.arrow_back,
                  color: Colors.grey,
                ),
                _buildStatItem(
                  '最後のセット平均',
                  '${analysis.avgLastSetScore.toStringAsFixed(1)}点',
                  theme,
                ),
              ],
            ),

            const SizedBox(height: 12),

            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: _getDegradationColor(
                    analysis.degradationPercentage,
                  ).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '劣化率: ${analysis.degradationPercentage.toStringAsFixed(1)}%',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: _getDegradationColor(analysis.degradationPercentage),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: Colors.blue.shade800,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      analysis.recommendation,
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getDegradationColor(double degradation) {
    if (degradation > 15) return AppColors.scorePoor;
    if (degradation > 5) return AppColors.scoreAverage;
    return AppColors.scoreExcellent;
  }

  Widget _buildCorrelationSection(
    CorrelationAnalysis analysis,
    ThemeData theme,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '相関分析',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            // Correlation visualization
            Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      Text(analysis.label, style: theme.textTheme.bodyMedium),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 20,
                        child: CustomPaint(
                          size: const Size(double.infinity, 20),
                          painter: _CorrelationBarPainter(
                            analysis.correlation,
                            theme.colorScheme.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('-1', style: theme.textTheme.bodySmall),
                          Text('0', style: theme.textTheme.bodySmall),
                          Text('+1', style: theme.textTheme.bodySmall),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Text(
                  analysis.correlation.toStringAsFixed(2),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: _getCorrelationColor(analysis.correlation),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            Text(analysis.description, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }

  Color _getCorrelationColor(double correlation) {
    if (correlation > 0.3) return AppColors.scoreExcellent;
    if (correlation < -0.3) return AppColors.scorePoor;
    return Colors.grey;
  }

  Widget _buildStatItem(
    String label,
    String value,
    ThemeData theme, {
    Color? valueColor,
  }) {
    return Column(
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: Colors.grey.shade600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(String error, ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(error, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                ref
                    .read(formAnalysisProvider.notifier)
                    .loadAnalysis(_selectedExercise);
              },
              child: const Text('再読み込み'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(
              Icons.analytics_outlined,
              size: 48,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'この種目のトレーニングデータがありません',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDisclaimer(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'このアプリは医療機器ではありません。フォーム分析は参考情報としてご利用ください。',
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getScoreColor(double score) {
    if (score >= 80) return AppColors.scoreExcellent;
    if (score >= 60) return AppColors.scoreGood;
    if (score >= 40) return AppColors.scoreAverage;
    return AppColors.scorePoor;
  }
}

/// Custom painter for trend chart
class _TrendChartPainter extends CustomPainter {
  _TrendChartPainter(this.dataPoints, this.color);

  final List<TrendDataPoint> dataPoints;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (dataPoints.isEmpty) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..style = PaintingStyle.fill;

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1;

    // Draw grid
    for (var i = 0; i <= 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Calculate bounds
    final scores = dataPoints.map((d) => d.score).toList();
    final minScore = (scores.reduce((a, b) => a < b ? a : b) - 5).clamp(
      0.0,
      100.0,
    );
    final maxScore = (scores.reduce((a, b) => a > b ? a : b) + 5).clamp(
      0.0,
      100.0,
    );
    final range = maxScore - minScore;

    if (range == 0) return;

    final path = Path();
    final fillPath = Path();
    final stepX = dataPoints.length > 1
        ? size.width / (dataPoints.length - 1)
        : size.width;

    fillPath.moveTo(0, size.height);

    for (var i = 0; i < dataPoints.length; i++) {
      final x = i * stepX;
      final y =
          size.height -
          ((dataPoints[i].score - minScore) / range * size.height);

      if (i == 0) {
        path.moveTo(x, y);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);

    // Draw dots
    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    for (var i = 0; i < dataPoints.length; i++) {
      final x = i * stepX;
      final y =
          size.height -
          ((dataPoints[i].score - minScore) / range * size.height);
      canvas.drawCircle(Offset(x, y), 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

/// Custom painter for correlation bar
class _CorrelationBarPainter extends CustomPainter {
  _CorrelationBarPainter(this.correlation, this.color);

  final double correlation;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()
      ..color = Colors.grey.shade300
      ..style = PaintingStyle.fill;

    final indicatorPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Draw background bar
    final bgRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      const Radius.circular(4),
    );
    canvas.drawRRect(bgRect, bgPaint);

    // Draw center line
    final centerX = size.width / 2;
    canvas.drawLine(
      Offset(centerX, 0),
      Offset(centerX, size.height),
      Paint()
        ..color = Colors.grey.shade500
        ..strokeWidth = 2,
    );

    // Draw correlation indicator
    final indicatorWidth = size.width / 2 * correlation.abs();
    final indicatorX = correlation >= 0 ? centerX : centerX - indicatorWidth;

    final indicatorRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(indicatorX, 2, indicatorWidth, size.height - 4),
      const Radius.circular(2),
    );
    canvas.drawRRect(indicatorRect, indicatorPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
