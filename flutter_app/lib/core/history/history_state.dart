/// History State Management
///
/// Riverpod state management for history and analytics screens.
/// Reference: docs/tickets/012_history_analytics.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_state_notifier.dart';
import '../form_analyzer/form_analyzer.dart';
import 'history_models.dart';
import 'history_service.dart';

/// History view mode
enum HistoryViewMode {
  overview, // Today's overview
  daily,    // Single day view
  weekly,   // Weekly view with charts
  monthly,  // Monthly view with charts
}

/// History screen state
class HistoryScreenState {
  const HistoryScreenState({
    this.viewMode = HistoryViewMode.overview,
    this.sessions = const [],
    this.dailySummaries = const [],
    this.weeklyStats,
    this.monthlyStats,
    this.isLoading = false,
    this.hasMore = false,
    this.error,
    this.selectedDate,
    this.filter = const HistoryFilter(),
    this.selectedExerciseType,
  });

  final HistoryViewMode viewMode;
  final List<HistorySession> sessions;
  final List<DailySummary> dailySummaries;
  final WeeklyStats? weeklyStats;
  final MonthlyStats? monthlyStats;
  final bool isLoading;
  final bool hasMore;
  final String? error;
  final DateTime? selectedDate;
  final HistoryFilter filter;
  final ExerciseType? selectedExerciseType;

  HistoryScreenState copyWith({
    HistoryViewMode? viewMode,
    List<HistorySession>? sessions,
    List<DailySummary>? dailySummaries,
    WeeklyStats? weeklyStats,
    MonthlyStats? monthlyStats,
    bool? isLoading,
    bool? hasMore,
    String? error,
    DateTime? selectedDate,
    HistoryFilter? filter,
    ExerciseType? selectedExerciseType,
  }) {
    return HistoryScreenState(
      viewMode: viewMode ?? this.viewMode,
      sessions: sessions ?? this.sessions,
      dailySummaries: dailySummaries ?? this.dailySummaries,
      weeklyStats: weeklyStats ?? this.weeklyStats,
      monthlyStats: monthlyStats ?? this.monthlyStats,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      selectedDate: selectedDate ?? this.selectedDate,
      filter: filter ?? this.filter,
      selectedExerciseType: selectedExerciseType ?? this.selectedExerciseType,
    );
  }
}

/// History state notifier
class HistoryStateNotifier extends StateNotifier<HistoryScreenState> {
  HistoryStateNotifier(this._historyService, this._userId)
      : super(const HistoryScreenState());

  final HistoryService _historyService;
  final String _userId;

  /// Load initial data
  Future<void> loadInitialData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      // Load today's sessions (overview)
      final today = DateTime.now();
      final sessions = await _historyService.fetchSessionsForDate(
        userId: _userId,
        date: today,
      );

      // Load daily summaries for calendar (current month)
      final startOfMonth = DateTime(today.year, today.month, 1);
      final endOfMonth = DateTime(today.year, today.month + 1, 0);
      final dailySummaries = await _historyService.fetchDailySummaries(
        userId: _userId,
        startDate: startOfMonth,
        endDate: endOfMonth,
      );

      state = state.copyWith(
        sessions: sessions,
        dailySummaries: dailySummaries,
        selectedDate: today,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'データの読み込みに失敗しました: $e',
      );
    }
  }

  /// Change view mode
  Future<void> setViewMode(HistoryViewMode mode) async {
    if (state.viewMode == mode) return;

    state = state.copyWith(viewMode: mode, isLoading: true, error: null);

    try {
      switch (mode) {
        case HistoryViewMode.overview:
          await _loadOverview();
          break;
        case HistoryViewMode.daily:
          await _loadDailyView(state.selectedDate ?? DateTime.now());
          break;
        case HistoryViewMode.weekly:
          await _loadWeeklyView(state.selectedDate ?? DateTime.now());
          break;
        case HistoryViewMode.monthly:
          await _loadMonthlyView(state.selectedDate ?? DateTime.now());
          break;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'データの読み込みに失敗しました',
      );
    }
  }

  /// Select date
  Future<void> selectDate(DateTime date) async {
    state = state.copyWith(selectedDate: date, isLoading: true);

    try {
      switch (state.viewMode) {
        case HistoryViewMode.overview:
        case HistoryViewMode.daily:
          await _loadDailyView(date);
          break;
        case HistoryViewMode.weekly:
          await _loadWeeklyView(date);
          break;
        case HistoryViewMode.monthly:
          await _loadMonthlyView(date);
          break;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'データの読み込みに失敗しました',
      );
    }
  }

  /// Navigate to previous period
  Future<void> previousPeriod() async {
    final current = state.selectedDate ?? DateTime.now();
    DateTime newDate;

    switch (state.viewMode) {
      case HistoryViewMode.overview:
      case HistoryViewMode.daily:
        newDate = current.subtract(const Duration(days: 1));
        break;
      case HistoryViewMode.weekly:
        newDate = current.subtract(const Duration(days: 7));
        break;
      case HistoryViewMode.monthly:
        newDate = DateTime(current.year, current.month - 1, 1);
        break;
    }

    await selectDate(newDate);
  }

  /// Navigate to next period
  Future<void> nextPeriod() async {
    final current = state.selectedDate ?? DateTime.now();
    DateTime newDate;

    switch (state.viewMode) {
      case HistoryViewMode.overview:
      case HistoryViewMode.daily:
        newDate = current.add(const Duration(days: 1));
        break;
      case HistoryViewMode.weekly:
        newDate = current.add(const Duration(days: 7));
        break;
      case HistoryViewMode.monthly:
        newDate = DateTime(current.year, current.month + 1, 1);
        break;
    }

    // Don't navigate to future
    if (newDate.isAfter(DateTime.now())) return;

    await selectDate(newDate);
  }

  /// Apply exercise type filter
  Future<void> setExerciseTypeFilter(ExerciseType? type) async {
    state = state.copyWith(
      selectedExerciseType: type,
      filter: state.filter.copyWith(
        exerciseTypes: type != null ? [type] : null,
      ),
      isLoading: true,
    );

    try {
      await _reloadCurrentView();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'データの読み込みに失敗しました',
      );
    }
  }

  /// Load more sessions (pagination)
  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore) return;
    // Pagination implementation would go here
  }

  /// Refresh data
  Future<void> refresh() async {
    await _reloadCurrentView();
  }

  // Private helper methods

  Future<void> _loadOverview() async {
    final today = DateTime.now();
    final sessions = await _historyService.fetchSessionsForDate(
      userId: _userId,
      date: today,
    );

    state = state.copyWith(
      sessions: sessions,
      selectedDate: today,
      isLoading: false,
    );
  }

  Future<void> _loadDailyView(DateTime date) async {
    final sessions = await _historyService.fetchSessionsForDate(
      userId: _userId,
      date: date,
    );

    state = state.copyWith(
      sessions: sessions,
      selectedDate: date,
      isLoading: false,
    );
  }

  Future<void> _loadWeeklyView(DateTime date) async {
    // Get Monday of the week
    final dayOfWeek = date.weekday;
    final weekStart = date.subtract(Duration(days: dayOfWeek - 1));

    final weeklyStats = await _historyService.fetchWeeklyStats(
      userId: _userId,
      weekStart: weekStart,
    );

    // Also load sessions for the week
    final sessions = await _historyService.fetchSessions(
      userId: _userId,
      filter: HistoryFilter(
        startDate: weekStart,
        endDate: weekStart.add(const Duration(days: 7)),
        exerciseTypes: state.filter.exerciseTypes,
      ),
      limit: 100,
    );

    state = state.copyWith(
      sessions: sessions,
      weeklyStats: weeklyStats,
      selectedDate: date,
      isLoading: false,
    );
  }

  Future<void> _loadMonthlyView(DateTime date) async {
    final monthlyStats = await _historyService.fetchMonthlyStats(
      userId: _userId,
      year: date.year,
      month: date.month,
    );

    // Load sessions for the month
    final startOfMonth = DateTime(date.year, date.month, 1);
    final endOfMonth = DateTime(date.year, date.month + 1, 0);
    final sessions = await _historyService.fetchSessions(
      userId: _userId,
      filter: HistoryFilter(
        startDate: startOfMonth,
        endDate: endOfMonth,
        exerciseTypes: state.filter.exerciseTypes,
      ),
      limit: 200,
    );

    // Update daily summaries for calendar
    final dailySummaries = await _historyService.fetchDailySummaries(
      userId: _userId,
      startDate: startOfMonth,
      endDate: endOfMonth,
    );

    state = state.copyWith(
      sessions: sessions,
      monthlyStats: monthlyStats,
      dailySummaries: dailySummaries,
      selectedDate: date,
      isLoading: false,
    );
  }

  Future<void> _reloadCurrentView() async {
    state = state.copyWith(isLoading: true, error: null);

    switch (state.viewMode) {
      case HistoryViewMode.overview:
        await _loadOverview();
        break;
      case HistoryViewMode.daily:
        await _loadDailyView(state.selectedDate ?? DateTime.now());
        break;
      case HistoryViewMode.weekly:
        await _loadWeeklyView(state.selectedDate ?? DateTime.now());
        break;
      case HistoryViewMode.monthly:
        await _loadMonthlyView(state.selectedDate ?? DateTime.now());
        break;
    }
  }
}

/// History state provider
final historyStateProvider =
    StateNotifierProvider.autoDispose<HistoryStateNotifier, HistoryScreenState>((ref) {
  final authState = ref.watch(authStateProvider);
  final historyService = ref.watch(historyServiceProvider);

  final userId = authState.user?.uid ?? '';
  return HistoryStateNotifier(historyService, userId);
});

/// Analytics state for detailed analysis screens
class AnalyticsScreenState {
  const AnalyticsScreenState({
    this.period = AnalysisPeriod.month,
    this.exerciseStats = const [],
    this.scoreProgress = const [],
    this.thisWeekStats,
    this.lastWeekStats,
    this.thisMonthStats,
    this.lastMonthStats,
    this.isLoading = false,
    this.error,
  });

  final AnalysisPeriod period;
  final List<ExerciseStats> exerciseStats;
  final List<ProgressDataPoint> scoreProgress;
  final WeeklyStats? thisWeekStats;
  final WeeklyStats? lastWeekStats;
  final MonthlyStats? thisMonthStats;
  final MonthlyStats? lastMonthStats;
  final bool isLoading;
  final String? error;

  /// Get comparison change percentage
  double? get weekOverWeekChange {
    if (thisWeekStats == null || lastWeekStats == null) return null;
    if (lastWeekStats!.averageScore == 0) return null;
    return ((thisWeekStats!.averageScore - lastWeekStats!.averageScore) /
            lastWeekStats!.averageScore) *
        100;
  }

  AnalyticsScreenState copyWith({
    AnalysisPeriod? period,
    List<ExerciseStats>? exerciseStats,
    List<ProgressDataPoint>? scoreProgress,
    WeeklyStats? thisWeekStats,
    WeeklyStats? lastWeekStats,
    MonthlyStats? thisMonthStats,
    MonthlyStats? lastMonthStats,
    bool? isLoading,
    String? error,
  }) {
    return AnalyticsScreenState(
      period: period ?? this.period,
      exerciseStats: exerciseStats ?? this.exerciseStats,
      scoreProgress: scoreProgress ?? this.scoreProgress,
      thisWeekStats: thisWeekStats ?? this.thisWeekStats,
      lastWeekStats: lastWeekStats ?? this.lastWeekStats,
      thisMonthStats: thisMonthStats ?? this.thisMonthStats,
      lastMonthStats: lastMonthStats ?? this.lastMonthStats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Analytics state notifier
class AnalyticsStateNotifier extends StateNotifier<AnalyticsScreenState> {
  AnalyticsStateNotifier(this._historyService, this._userId)
      : super(const AnalyticsScreenState());

  final HistoryService _historyService;
  final String _userId;

  /// Load analytics data
  Future<void> loadAnalytics() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final now = DateTime.now();

      // Load stats for all exercise types
      final exerciseStats = <ExerciseStats>[];
      for (final type in ExerciseType.values) {
        final stats = await _historyService.fetchExerciseStats(
          userId: _userId,
          exerciseType: type,
          period: state.period,
        );
        if (stats.totalSessions > 0) {
          exerciseStats.add(stats);
        }
      }

      // Load score progress
      final scoreProgress = await _historyService.fetchScoreProgress(
        userId: _userId,
        period: state.period,
      );

      // Load weekly comparison
      final thisWeekStart = now.subtract(Duration(days: now.weekday - 1));
      final lastWeekStart = thisWeekStart.subtract(const Duration(days: 7));

      final thisWeekStats = await _historyService.fetchWeeklyStats(
        userId: _userId,
        weekStart: thisWeekStart,
      );
      final lastWeekStats = await _historyService.fetchWeeklyStats(
        userId: _userId,
        weekStart: lastWeekStart,
      );

      // Load monthly comparison
      final thisMonthStats = await _historyService.fetchMonthlyStats(
        userId: _userId,
        year: now.year,
        month: now.month,
      );
      final lastMonth = DateTime(now.year, now.month - 1, 1);
      final lastMonthStats = await _historyService.fetchMonthlyStats(
        userId: _userId,
        year: lastMonth.year,
        month: lastMonth.month,
      );

      state = state.copyWith(
        exerciseStats: exerciseStats,
        scoreProgress: scoreProgress,
        thisWeekStats: thisWeekStats,
        lastWeekStats: lastWeekStats,
        thisMonthStats: thisMonthStats,
        lastMonthStats: lastMonthStats,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: '分析データの読み込みに失敗しました: $e',
      );
    }
  }

  /// Change analysis period
  Future<void> setPeriod(AnalysisPeriod period) async {
    if (state.period == period) return;
    state = state.copyWith(period: period);
    await loadAnalytics();
  }
}

/// Analytics state provider
final analyticsStateProvider =
    StateNotifierProvider.autoDispose<AnalyticsStateNotifier, AnalyticsScreenState>((ref) {
  final authState = ref.watch(authStateProvider);
  final historyService = ref.watch(historyServiceProvider);

  final userId = authState.user?.uid ?? '';
  return AnalyticsStateNotifier(historyService, userId);
});

