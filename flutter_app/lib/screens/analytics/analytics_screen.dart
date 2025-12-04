/// Analytics Screen
///
/// Displays detailed training analytics and progress charts.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/history/history_models.dart';
import '../../core/history/history_state.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/stats_card.dart';
import '../widgets/bottom_nav_bar.dart';

/// Analytics dashboard screen
class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsStateProvider.notifier).loadAnalytics();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(analyticsStateProvider);
    // ignore: unused_local_variable
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('分析'),
        actions: [
          // Period selector
          PopupMenuButton<AnalysisPeriod>(
            icon: const Icon(Icons.date_range),
            tooltip: '期間選択',
            onSelected: (period) {
              ref.read(analyticsStateProvider.notifier).setPeriod(period);
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: AnalysisPeriod.week,
                child: Row(
                  children: [
                    if (state.period == AnalysisPeriod.week)
                      const Icon(Icons.check, size: 18),
                    const SizedBox(width: 8),
                    const Text('週'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: AnalysisPeriod.month,
                child: Row(
                  children: [
                    if (state.period == AnalysisPeriod.month)
                      const Icon(Icons.check, size: 18),
                    const SizedBox(width: 8),
                    const Text('月'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: AnalysisPeriod.threeMonths,
                child: Row(
                  children: [
                    if (state.period == AnalysisPeriod.threeMonths)
                      const Icon(Icons.check, size: 18),
                    const SizedBox(width: 8),
                    const Text('3ヶ月'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: AnalysisPeriod.year,
                child: Row(
                  children: [
                    if (state.period == AnalysisPeriod.year)
                      const Icon(Icons.check, size: 18),
                    const SizedBox(width: 8),
                    const Text('年'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
          ? _buildErrorView(state.error!)
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(analyticsStateProvider.notifier).loadAnalytics(),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Overview section
                    _buildOverviewSection(state),
                    const SizedBox(height: 24),

                    // Weekly comparison
                    if (state.thisWeekStats != null)
                      _buildWeeklyComparisonSection(state),
                    const SizedBox(height: 24),

                    // Score progress chart
                    _buildScoreProgressSection(state),
                    const SizedBox(height: 24),

                    // Exercise breakdown
                    if (state.exerciseStats.isNotEmpty)
                      _buildExerciseBreakdownSection(state),
                    const SizedBox(height: 24),

                    // Exercise details
                    if (state.exerciseStats.isNotEmpty)
                      _buildExerciseDetailsSection(state),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
      bottomNavigationBar: const BottomNavBar(currentIndex: 2),
    );
  }

  Widget _buildErrorView(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 16),
          Text(error),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () =>
                ref.read(analyticsStateProvider.notifier).loadAnalytics(),
            child: const Text('再読み込み'),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewSection(AnalyticsScreenState state) {
    final thisWeek = state.thisWeekStats;
    final thisMonth = state.thisMonthStats;

    if (thisWeek == null && thisMonth == null) {
      return _buildEmptyState('分析データがありません');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '概要ダッシュボード',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),

        // Main stats row
        Row(
          children: [
            Expanded(
              child: LargeStatsCard(
                title: '今週の実績',
                value: '${thisWeek?.totalSessions ?? 0}',
                subtitle: 'セッション',
                icon: Icons.fitness_center,
                progress: thisWeek != null
                    ? (thisWeek.activeDays / 7).clamp(0.0, 1.0)
                    : 0,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LargeStatsCard(
                title: '今週のスコア',
                value: thisWeek?.averageScore.toStringAsFixed(0) ?? '-',
                subtitle: '平均',
                icon: Icons.star,
                valueColor: _getScoreColor(thisWeek?.averageScore ?? 0),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Secondary stats
        Row(
          children: [
            Expanded(
              child: StatsCard(
                title: '月間セッション',
                value: '${thisMonth?.totalSessions ?? 0}',
                icon: Icons.calendar_month,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: 'ストリーク',
                value: '${thisMonth?.streakDays ?? 0}日',
                icon: Icons.local_fire_department,
                valueColor: Colors.orange,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '総レップ数',
                value: '${thisMonth?.totalReps ?? 0}',
                icon: Icons.repeat,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildWeeklyComparisonSection(AnalyticsScreenState state) {
    final thisWeek = state.thisWeekStats!;
    final lastWeek = state.lastWeekStats;
    final change = state.weekOverWeekChange;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '週間比較',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Comparison header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('先週'),
                    if (change != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: change >= 0
                              ? Colors.green.shade50
                              : Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              change >= 0
                                  ? Icons.trending_up
                                  : Icons.trending_down,
                              size: 16,
                              color: change >= 0 ? Colors.green : Colors.red,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${change >= 0 ? '+' : ''}${change.toStringAsFixed(1)}%',
                              style: TextStyle(
                                color: change >= 0 ? Colors.green : Colors.red,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const Text('今週'),
                  ],
                ),
                const SizedBox(height: 16),

                // Comparison bars
                _buildComparisonBar(
                  '平均スコア',
                  lastWeek?.averageScore ?? 0,
                  thisWeek.averageScore,
                  100,
                ),
                const SizedBox(height: 12),
                _buildComparisonBar(
                  'セッション数',
                  (lastWeek?.totalSessions ?? 0).toDouble(),
                  thisWeek.totalSessions.toDouble(),
                  14, // Max 2 per day
                ),
                const SizedBox(height: 12),
                _buildComparisonBar(
                  'アクティブ日',
                  (lastWeek?.activeDays ?? 0).toDouble(),
                  thisWeek.activeDays.toDouble(),
                  7,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildComparisonBar(
    String label,
    double lastValue,
    double thisValue,
    double maxValue,
  ) {
    // ignore: unused_local_variable
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: Colors.grey.shade600,
          ),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            // Last week value
            SizedBox(
              width: 40,
              child: Text(
                lastValue.toStringAsFixed(0),
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.right,
              ),
            ),
            const SizedBox(width: 8),
            // Bar
            Expanded(
              child: Stack(
                children: [
                  // Background
                  Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  // Last week (left side)
                  FractionallySizedBox(
                    widthFactor: 0.5,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: FractionallySizedBox(
                        widthFactor: (lastValue / maxValue).clamp(0.0, 1.0),
                        child: Container(
                          height: 8,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade400,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  ),
                  // This week (right side)
                  FractionallySizedBox(
                    widthFactor: 0.5,
                    alignment: Alignment.centerRight,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: (thisValue / maxValue).clamp(0.0, 1.0),
                        child: Container(
                          height: 8,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // This week value
            SizedBox(
              width: 40,
              child: Text(
                thisValue.toStringAsFixed(0),
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildScoreProgressSection(AnalyticsScreenState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'スコア推移',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: state.scoreProgress.isEmpty
                ? SizedBox(
                    height: 150,
                    child: Center(
                      child: Text(
                        'データがありません',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ),
                  )
                : SizedBox(
                    height: 200,
                    child: CustomPaint(
                      size: const Size(double.infinity, 200),
                      painter: _ScoreProgressPainter(
                        state.scoreProgress,
                        Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildExerciseBreakdownSection(AnalyticsScreenState state) {
    final stats = state.exerciseStats;
    final totalSessions = stats.fold(0, (sum, s) => sum + s.totalSessions);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '種目別内訳',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: stats.map((exerciseStat) {
                final percentage = totalSessions > 0
                    ? (exerciseStat.totalSessions / totalSessions * 100)
                    : 0.0;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 100,
                        child: Text(
                          AnalyzerFactory.getDisplayName(
                            exerciseStat.exerciseType,
                          ),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: percentage / 100,
                            backgroundColor: Colors.grey.shade200,
                            valueColor: AlwaysStoppedAnimation(
                              _getExerciseColor(exerciseStat.exerciseType),
                            ),
                            minHeight: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 50,
                        child: Text(
                          '${percentage.toStringAsFixed(0)}%',
                          style: Theme.of(context).textTheme.bodySmall,
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildExerciseDetailsSection(AnalyticsScreenState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '種目別詳細',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ...state.exerciseStats.map((stat) => _buildExerciseCard(stat)),
      ],
    );
  }

  Widget _buildExerciseCard(ExerciseStats stat) {
    final exerciseName = AnalyzerFactory.getDisplayName(stat.exerciseType);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: _getExerciseColor(
            stat.exerciseType,
          ).withValues(alpha: 0.1),
          child: Icon(
            _getExerciseIcon(stat.exerciseType),
            color: _getExerciseColor(stat.exerciseType),
          ),
        ),
        title: Text(exerciseName),
        subtitle: Text(
          '${stat.totalSessions}セッション・平均${stat.averageScore.toStringAsFixed(0)}点',
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Stats row
                Row(
                  children: [
                    Expanded(
                      child: _buildMiniStat(
                        'ベストスコア',
                        '${stat.bestScore.toStringAsFixed(0)}点',
                        _getScoreColor(stat.bestScore),
                      ),
                    ),
                    Expanded(
                      child: _buildMiniStat(
                        '総レップ数',
                        '${stat.totalReps}回',
                        null,
                      ),
                    ),
                    Expanded(
                      child: _buildMiniStat(
                        '改善率',
                        '${stat.scoreImprovement >= 0 ? '+' : ''}${stat.scoreImprovement.toStringAsFixed(1)}%',
                        stat.scoreImprovement >= 0 ? Colors.green : Colors.red,
                      ),
                    ),
                  ],
                ),

                // Common issues
                if (stat.commonIssues.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'よくある改善ポイント',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: stat.commonIssues
                        .map(
                          (issue) => Chip(
                            label: Text(
                              issue,
                              style: const TextStyle(fontSize: 12),
                            ),
                            backgroundColor: Colors.orange.shade50,
                            padding: EdgeInsets.zero,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color? color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: Colors.grey.shade600),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.analytics_outlined,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: Colors.grey.shade600),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Color _getScoreColor(double score) {
    if (score >= 80) return AppColors.scoreExcellent;
    if (score >= 60) return AppColors.scoreGood;
    if (score >= 40) return AppColors.scoreAverage;
    return AppColors.scorePoor;
  }

  Color _getExerciseColor(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return Colors.blue;
      case ExerciseType.armCurl:
        return Colors.purple;
      case ExerciseType.sideRaise:
        return Colors.teal;
      case ExerciseType.shoulderPress:
        return Colors.orange;
      case ExerciseType.pushUp:
        return Colors.red;
    }
  }

  IconData _getExerciseIcon(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return Icons.accessibility_new;
      case ExerciseType.armCurl:
        return Icons.fitness_center;
      case ExerciseType.sideRaise:
        return Icons.pan_tool;
      case ExerciseType.shoulderPress:
        return Icons.upload;
      case ExerciseType.pushUp:
        return Icons.sports_gymnastics;
    }
  }
}

/// Custom painter for score progress chart
class _ScoreProgressPainter extends CustomPainter {
  _ScoreProgressPainter(this.dataPoints, this.color);

  final List<ProgressDataPoint> dataPoints;
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

    // Draw grid lines
    for (var i = 0; i <= 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Calculate min/max for scaling
    final values = dataPoints.map((d) => d.value).toList();
    final minVal = (values.reduce((a, b) => a < b ? a : b) - 10).clamp(
      0.0,
      100.0,
    );
    final maxVal = (values.reduce((a, b) => a > b ? a : b) + 10).clamp(
      0.0,
      100.0,
    );
    final range = maxVal - minVal;

    if (range == 0) return;

    final path = Path();
    final fillPath = Path();
    final stepX =
        size.width / (dataPoints.length - 1).clamp(1, dataPoints.length);

    fillPath.moveTo(0, size.height);

    for (var i = 0; i < dataPoints.length; i++) {
      final x = i * stepX;
      final y =
          size.height - ((dataPoints[i].value - minVal) / range * size.height);

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
          size.height - ((dataPoints[i].value - minVal) / range * size.height);
      canvas.drawCircle(Offset(x, y), 4, dotPaint);
    }

    // Draw labels
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    // Y-axis labels
    for (var i = 0; i <= 4; i++) {
      final value = minVal + (range * (4 - i) / 4);
      textPainter.text = TextSpan(
        text: value.toStringAsFixed(0),
        style: TextStyle(color: Colors.grey.shade600, fontSize: 10),
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(
          -textPainter.width - 4,
          size.height * i / 4 - textPainter.height / 2,
        ),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
