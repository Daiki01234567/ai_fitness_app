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
    final state = ref.watch(historyStateProvider);
    final selectedDate = state.selectedDate;

    final firstDayOfMonth = DateTime(month.year, month.month, 1);
    final lastDayOfMonth = DateTime(month.year, month.month + 1, 0);
    final daysInMonth = lastDayOfMonth.day;

    // Calculate first day offset (Monday = 1, Sunday = 7)
    // For Monday-start calendar, Monday offset = 0, Sunday offset = 6
    final firstDayWeekday = firstDayOfMonth.weekday;
    final startOffset = firstDayWeekday - 1; // Monday = 0, Sunday = 6

    // Calculate days from previous month to show
    final prevMonth = DateTime(month.year, month.month - 1);
    final daysInPrevMonth = DateTime(prevMonth.year, prevMonth.month + 1, 0).day;

    // Create summary map for current month
    final summaryMap = <int, DailySummary>{};
    for (final summary in summaries) {
      if (summary.date.year == month.year &&
          summary.date.month == month.month) {
        summaryMap[summary.date.day] = summary;
      }
    }

    // Calculate total cells needed (up to 6 weeks)
    final totalCells = startOffset + daysInMonth;
    final numRows = ((totalCells + 6) ~/ 7).clamp(5, 6);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Weekday headers with weekend color distinction
            Row(
              children: [
                _buildWeekdayHeader('月', false),
                _buildWeekdayHeader('火', false),
                _buildWeekdayHeader('水', false),
                _buildWeekdayHeader('木', false),
                _buildWeekdayHeader('金', false),
                _buildWeekdayHeader('土', true, isSaturday: true),
                _buildWeekdayHeader('日', true, isSunday: true),
              ],
            ),
            const SizedBox(height: 8),
            // Calendar grid
            ...List.generate(numRows, (weekIndex) {
              return Row(
                children: List.generate(7, (dayIndex) {
                  final cellIndex = weekIndex * 7 + dayIndex;
                  final dayOffset = cellIndex - startOffset;

                  // Determine which month and day this cell represents
                  DateTime cellDate;
                  bool isCurrentMonth;

                  if (dayOffset < 0) {
                    // Previous month
                    final prevMonthDay = daysInPrevMonth + dayOffset + 1;
                    cellDate = DateTime(prevMonth.year, prevMonth.month, prevMonthDay);
                    isCurrentMonth = false;
                  } else if (dayOffset >= daysInMonth) {
                    // Next month
                    final nextMonthDay = dayOffset - daysInMonth + 1;
                    final nextMonth = DateTime(month.year, month.month + 1);
                    cellDate = DateTime(nextMonth.year, nextMonth.month, nextMonthDay);
                    isCurrentMonth = false;
                  } else {
                    // Current month
                    cellDate = DateTime(month.year, month.month, dayOffset + 1);
                    isCurrentMonth = true;
                  }

                  // Skip cells beyond the 6th row if not needed
                  if (!isCurrentMonth && weekIndex >= 5 && dayOffset >= daysInMonth) {
                    // Check if we need this row
                    final firstCellOfRow = weekIndex * 7 - startOffset;
                    if (firstCellOfRow >= daysInMonth) {
                      return const Expanded(child: SizedBox(height: 44));
                    }
                  }

                  final summary = isCurrentMonth ? summaryMap[cellDate.day] : null;
                  final isToday = _isSameDay(cellDate, DateTime.now());
                  final isSelected = selectedDate != null && _isSameDay(cellDate, selectedDate);
                  final isWeekend = dayIndex >= 5;

                  return Expanded(
                    child: _buildCalendarDay(
                      date: cellDate,
                      isCurrentMonth: isCurrentMonth,
                      isToday: isToday,
                      isSelected: isSelected,
                      isWeekend: isWeekend,
                      summary: summary,
                      onTap: () => _onCalendarDateTap(cellDate),
                    ),
                  );
                }),
              );
            }),
            // Intensity legend
            const SizedBox(height: 16),
            _buildIntensityLegend(),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekdayHeader(String day, bool isWeekend, {bool isSaturday = false, bool isSunday = false}) {
    Color? textColor;
    if (isSunday) {
      textColor = Colors.red.shade400;
    } else if (isSaturday) {
      textColor = Colors.blue.shade400;
    }

    return Expanded(
      child: Center(
        child: Text(
          day,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
        ),
      ),
    );
  }

  Widget _buildCalendarDay({
    required DateTime date,
    required bool isCurrentMonth,
    required bool isToday,
    required bool isSelected,
    required bool isWeekend,
    required DailySummary? summary,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);

    // Background color based on training intensity (GitHub contribution style)
    Color? backgroundColor;
    if (summary != null && isCurrentMonth) {
      backgroundColor = _getIntensityColor(summary.intensityLevel);
    }

    // Text color
    Color textColor;
    if (!isCurrentMonth) {
      textColor = Colors.grey.shade400;
    } else if (isSelected) {
      textColor = theme.colorScheme.onPrimary;
    } else if (summary != null && summary.intensityLevel >= 2) {
      textColor = Colors.white;
    } else {
      textColor = theme.textTheme.bodyMedium?.color ?? Colors.black;
    }

    // Border and decoration
    BoxDecoration decoration;
    if (isSelected && isCurrentMonth) {
      decoration = BoxDecoration(
        color: theme.colorScheme.primary,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.primary.withValues(alpha: 0.3),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      );
    } else if (isToday && isCurrentMonth) {
      decoration = BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: theme.colorScheme.primary,
          width: 2,
        ),
      );
    } else {
      decoration = BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          splashColor: theme.colorScheme.primary.withValues(alpha: 0.2),
          highlightColor: theme.colorScheme.primary.withValues(alpha: 0.1),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            height: 40,
            decoration: decoration,
            child: Center(
              child: Text(
                '${date.day}',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: isToday || isSelected ? FontWeight.bold : FontWeight.normal,
                  color: textColor,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIntensityLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '活動量: ',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
        ),
        const SizedBox(width: 8),
        _buildLegendItem('なし', null),
        const SizedBox(width: 4),
        _buildLegendItem('少', 1),
        const SizedBox(width: 4),
        _buildLegendItem('中', 2),
        const SizedBox(width: 4),
        _buildLegendItem('多', 3),
      ],
    );
  }

  Widget _buildLegendItem(String label, int? level) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: level != null ? _getIntensityColor(level) : Colors.grey.shade200,
            borderRadius: BorderRadius.circular(3),
            border: level == null
                ? Border.all(color: Colors.grey.shade400, width: 0.5)
                : null,
          ),
        ),
        const SizedBox(width: 2),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.grey.shade600,
              ),
        ),
      ],
    );
  }

  void _onCalendarDateTap(DateTime date) {
    // Update selected date
    ref.read(historyStateProvider.notifier).selectDate(date);

    // Switch to daily tab
    ref.read(historyStateProvider.notifier).setViewMode(HistoryViewMode.daily);

    // Animate tab controller to daily tab (index 1)
    _tabController.animateTo(1);
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

  /// Get intensity color for GitHub contribution graph style display
  /// Level 0: No activity (transparent/white)
  /// Level 1: Light activity (light green)
  /// Level 2: Medium activity (medium green)
  /// Level 3: High activity (dark green)
  Color _getIntensityColor(int level) {
    switch (level) {
      case 3:
        return const Color(0xFF216E39); // Dark green - high activity
      case 2:
        return const Color(0xFF30A14E); // Medium green - medium activity
      case 1:
        return const Color(0xFF9BE9A8); // Light green - light activity
      case 0:
      default:
        return const Color(0xFFEBEDF0); // Very light gray - no activity
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
