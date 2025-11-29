/// History Screen
///
/// Displays training history with calendar and list views.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.11)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/history/history_models.dart';
import '../../core/history/history_state.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/stats_card.dart';
import 'session_detail_screen.dart';

/// History screen showing training records
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_onTabChanged);

    // Load initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(historyStateProvider.notifier).loadInitialData();
    });
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) {
      final viewMode = HistoryViewMode.values[_tabController.index];
      ref.read(historyStateProvider.notifier).setViewMode(viewMode);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(historyStateProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('履歴'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: '概要'),
                  Tab(text: '日'),
                  Tab(text: '週'),
                  Tab(text: '月'),
                ],
              ),
            ],
          ),
        ),
        actions: [
          // Exercise type filter
          PopupMenuButton<ExerciseType?>(
            icon: Icon(
              Icons.filter_list,
              color: state.selectedExerciseType != null
                  ? theme.colorScheme.primary
                  : null,
            ),
            tooltip: '種目フィルタ',
            onSelected: (type) {
              ref.read(historyStateProvider.notifier).setExerciseTypeFilter(type);
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: null,
                child: Text('全て'),
              ),
              ...ExerciseType.values.map((type) => PopupMenuItem(
                    value: type,
                    child: Text(AnalyzerFactory.getDisplayName(type)),
                  )),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(historyStateProvider.notifier).refresh(),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? _buildErrorView(state.error!)
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildOverviewTab(state),
                      _buildDailyTab(state),
                      _buildWeeklyTab(state),
                      _buildMonthlyTab(state),
                    ],
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
            onPressed: () => ref.read(historyStateProvider.notifier).refresh(),
            child: const Text('再読み込み'),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewTab(HistoryScreenState state) {
    final sessions = state.sessions;
    final today = DateTime.now();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Date header
        _buildDateHeader(today, showNavigation: false),
        const SizedBox(height: 16),

        // Today's summary
        if (sessions.isNotEmpty) ...[
          _buildTodaySummary(sessions),
          const SizedBox(height: 24),
        ],

        // Session list header
        Text(
          'セッション一覧',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),

        // Sessions or empty state
        if (sessions.isEmpty)
          _buildEmptyState('今日はまだトレーニングしていません')
        else
          ...sessions.map((session) => _buildSessionCard(session)),
      ],
    );
  }

  Widget _buildDailyTab(HistoryScreenState state) {
    final sessions = state.sessions;
    final date = state.selectedDate ?? DateTime.now();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Date navigation
        _buildDateHeader(date, showNavigation: true),
        const SizedBox(height: 16),

        // Sessions
        if (sessions.isEmpty)
          _buildEmptyState('この日のトレーニング記録はありません')
        else
          ...sessions.map((session) => _buildSessionCard(session)),
      ],
    );
  }

  Widget _buildWeeklyTab(HistoryScreenState state) {
    final weeklyStats = state.weeklyStats;
    final sessions = state.sessions;
    final date = state.selectedDate ?? DateTime.now();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Week navigation
        _buildWeekHeader(date),
        const SizedBox(height: 16),

        // Weekly stats cards
        if (weeklyStats != null) ...[
          _buildWeeklyStatsSection(weeklyStats),
          const SizedBox(height: 24),
        ],

        // Score chart placeholder
        _buildScoreChart(sessions),
        const SizedBox(height: 24),

        // Sessions list
        Text(
          'セッション一覧',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),

        if (sessions.isEmpty)
          _buildEmptyState('この週のトレーニング記録はありません')
        else
          ...sessions.map((session) => _buildSessionCard(session)),
      ],
    );
  }

  Widget _buildMonthlyTab(HistoryScreenState state) {
    final monthlyStats = state.monthlyStats;
    final dailySummaries = state.dailySummaries;
    final sessions = state.sessions;
    final date = state.selectedDate ?? DateTime.now();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Month navigation
        _buildMonthHeader(date),
        const SizedBox(height: 16),

        // Calendar view
        _buildCalendarView(date, dailySummaries),
        const SizedBox(height: 24),

        // Monthly stats
        if (monthlyStats != null) ...[
          _buildMonthlyStatsSection(monthlyStats),
          const SizedBox(height: 24),
        ],

        // Score chart
        _buildScoreChart(sessions),
        const SizedBox(height: 24),

        // Sessions list
        Text(
          'セッション一覧',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),

        if (sessions.isEmpty)
          _buildEmptyState('この月のトレーニング記録はありません')
        else
          ...sessions.take(10).map((session) => _buildSessionCard(session)),

        if (sessions.length > 10)
          TextButton(
            onPressed: () {
              // TODO: Navigate to full list
            },
            child: Text('さらに${sessions.length - 10}件を表示'),
          ),
      ],
    );
  }

  Widget _buildDateHeader(DateTime date, {required bool showNavigation}) {
    final dateFormat = DateFormat('yyyy/MM/dd (E)', 'ja');
    final isToday = _isSameDay(date, DateTime.now());

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (showNavigation)
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () =>
                ref.read(historyStateProvider.notifier).previousPeriod(),
          )
        else
          const SizedBox(width: 48),
        Column(
          children: [
            Text(
              dateFormat.format(date),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (isToday)
              Text(
                '今日',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
              ),
          ],
        ),
        if (showNavigation)
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: date.isBefore(DateTime.now())
                ? () => ref.read(historyStateProvider.notifier).nextPeriod()
                : null,
          )
        else
          const SizedBox(width: 48),
      ],
    );
  }

  Widget _buildWeekHeader(DateTime date) {
    final dayOfWeek = date.weekday;
    final weekStart = date.subtract(Duration(days: dayOfWeek - 1));
    final weekEnd = weekStart.add(const Duration(days: 6));
    final dateFormat = DateFormat('MM/dd');

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left),
          onPressed: () =>
              ref.read(historyStateProvider.notifier).previousPeriod(),
        ),
        Text(
          '${dateFormat.format(weekStart)} - ${dateFormat.format(weekEnd)}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        IconButton(
          icon: const Icon(Icons.chevron_right),
          onPressed: weekEnd.isBefore(DateTime.now())
              ? () => ref.read(historyStateProvider.notifier).nextPeriod()
              : null,
        ),
      ],
    );
  }

  Widget _buildMonthHeader(DateTime date) {
    final dateFormat = DateFormat('yyyy年M月', 'ja');

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left),
          onPressed: () =>
              ref.read(historyStateProvider.notifier).previousPeriod(),
        ),
        Text(
          dateFormat.format(date),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        IconButton(
          icon: const Icon(Icons.chevron_right),
          onPressed: DateTime(date.year, date.month + 1, 1)
                  .isBefore(DateTime.now())
              ? () => ref.read(historyStateProvider.notifier).nextPeriod()
              : null,
        ),
      ],
    );
  }

  Widget _buildTodaySummary(List<HistorySession> sessions) {
    final totalReps = sessions.fold(0, (sum, s) => sum + s.totalReps);
    final avgScore = sessions.isEmpty
        ? 0.0
        : sessions.map((s) => s.averageScore).reduce((a, b) => a + b) /
            sessions.length;

    return Row(
      children: [
        Expanded(
          child: StatsCard(
            title: 'セッション数',
            value: '${sessions.length}',
            icon: Icons.fitness_center,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: StatsCard(
            title: '総レップ数',
            value: '$totalReps',
            icon: Icons.repeat,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: StatsCard(
            title: '平均スコア',
            value: avgScore.toStringAsFixed(0),
            icon: Icons.star,
            valueColor: _getScoreColor(avgScore),
          ),
        ),
      ],
    );
  }

  Widget _buildWeeklyStatsSection(WeeklyStats stats) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '週間統計',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatsCard(
                title: 'セッション',
                value: '${stats.totalSessions}',
                icon: Icons.fitness_center,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '稼働日数',
                value: '${stats.activeDays}/7',
                icon: Icons.calendar_today,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '平均スコア',
                value: stats.averageScore.toStringAsFixed(0),
                icon: Icons.trending_up,
                valueColor: _getScoreColor(stats.averageScore),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMonthlyStatsSection(MonthlyStats stats) {
    final durationStr = _formatDuration(stats.totalDuration);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '月間統計',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatsCard(
                title: 'セッション',
                value: '${stats.totalSessions}',
                icon: Icons.fitness_center,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '運動時間',
                value: durationStr,
                icon: Icons.timer,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: 'ストリーク',
                value: '${stats.streakDays}日',
                icon: Icons.local_fire_department,
                valueColor: Colors.orange,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatsCard(
                title: '総レップ数',
                value: '${stats.totalReps}',
                icon: Icons.repeat,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '総セット数',
                value: '${stats.totalSets}',
                icon: Icons.layers,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: '平均スコア',
                value: stats.averageScore.toStringAsFixed(0),
                icon: Icons.star,
                valueColor: _getScoreColor(stats.averageScore),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCalendarView(DateTime month, List<DailySummary> summaries) {
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    final startWeekday = firstDay.weekday;
    final daysInMonth = lastDay.day;

    // Create summary map
    final summaryMap = <int, DailySummary>{};
    for (final summary in summaries) {
      if (summary.date.year == month.year &&
          summary.date.month == month.month) {
        summaryMap[summary.date.day] = summary;
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Weekday headers
            Row(
              children: ['月', '火', '水', '木', '金', '土', '日']
                  .map((day) => Expanded(
                        child: Center(
                          child: Text(
                            day,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 8),
            // Calendar grid
            ...List.generate(6, (weekIndex) {
              return Row(
                children: List.generate(7, (dayIndex) {
                  final dayNumber =
                      weekIndex * 7 + dayIndex + 1 - (startWeekday - 1);
                  if (dayNumber < 1 || dayNumber > daysInMonth) {
                    return const Expanded(child: SizedBox(height: 40));
                  }

                  final summary = summaryMap[dayNumber];
                  final isToday = _isSameDay(
                    DateTime(month.year, month.month, dayNumber),
                    DateTime.now(),
                  );

                  return Expanded(
                    child: GestureDetector(
                      onTap: () {
                        ref.read(historyStateProvider.notifier).selectDate(
                              DateTime(month.year, month.month, dayNumber),
                            );
                        ref
                            .read(historyStateProvider.notifier)
                            .setViewMode(HistoryViewMode.daily);
                      },
                      child: Container(
                        height: 40,
                        margin: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: summary != null
                              ? _getIntensityColor(summary.intensityLevel)
                              : null,
                          border: isToday
                              ? Border.all(
                                  color: Theme.of(context).colorScheme.primary,
                                  width: 2,
                                )
                              : null,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(
                          child: Text(
                            '$dayNumber',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontWeight: isToday ? FontWeight.bold : null,
                                ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildScoreChart(List<HistorySession> sessions) {
    if (sessions.isEmpty) {
      return const SizedBox.shrink();
    }

    // Simple placeholder for chart - would use fl_chart in full implementation
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'スコア推移',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 150,
              child: CustomPaint(
                size: const Size(double.infinity, 150),
                painter: _SimpleChartPainter(
                  sessions.map((s) => s.averageScore).toList(),
                  Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSessionCard(HistorySession session) {
    final timeFormat = DateFormat('HH:mm');
    final exerciseName = AnalyzerFactory.getDisplayName(session.exerciseType);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () {
          // Navigate to session detail
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => SessionDetailScreen(session: session),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Time
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    timeFormat.format(session.startTime),
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  Text(
                    '${session.duration.inMinutes}分',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(width: 16),
              // Divider
              Container(
                width: 1,
                height: 40,
                color: Colors.grey.shade300,
              ),
              const SizedBox(width: 16),
              // Exercise info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exerciseName,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                    Text(
                      '${session.totalSets}セット ${session.totalReps}回',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              // Score
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: _getScoreColor(session.averageScore).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${session.averageScore.toStringAsFixed(0)}点',
                  style: TextStyle(
                    color: _getScoreColor(session.averageScore),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
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
              Icons.history,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Colors.grey.shade600,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => context.goToTraining(),
              icon: const Icon(Icons.fitness_center),
              label: const Text('トレーニングを始める'),
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

  Color _getIntensityColor(int level) {
    switch (level) {
      case 3:
        return Colors.green.shade400;
      case 2:
        return Colors.green.shade200;
      case 1:
      default:
        return Colors.green.shade100;
    }
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    if (hours > 0) {
      return '${hours}h${minutes}m';
    }
    return '$minutes分';
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

/// Simple chart painter for score visualization
class _SimpleChartPainter extends CustomPainter {
  _SimpleChartPainter(this.values, this.color);

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();

    final minVal = values.reduce((a, b) => a < b ? a : b) - 10;
    final maxVal = values.reduce((a, b) => a > b ? a : b) + 10;
    final range = maxVal - minVal;

    final stepX = size.width / (values.length - 1).clamp(1, values.length);

    // Start fill path
    fillPath.moveTo(0, size.height);

    for (var i = 0; i < values.length; i++) {
      final x = i * stepX;
      final y = size.height - ((values[i] - minVal) / range * size.height);

      if (i == 0) {
        path.moveTo(x, y);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    // Close fill path
    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);

    // Draw dots
    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    for (var i = 0; i < values.length; i++) {
      final x = i * stepX;
      final y = size.height - ((values[i] - minVal) / range * size.height);
      canvas.drawCircle(Offset(x, y), 4, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
