/// Home Screen State Management
///
/// Riverpod state management for home screen dashboard.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.6)
///
/// Displays:
/// - Today's session count
/// - Weekly progress (7-day bar chart data)
/// - Recent sessions (latest 2)
/// - User plan and usage limits
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/history/history_models.dart';
import '../../core/history/history_service.dart';

/// Daily session count for weekly chart
class DailySessionCount {
  const DailySessionCount({
    required this.date,
    required this.sessionCount,
    required this.dayLabel,
  });

  final DateTime date;
  final int sessionCount;
  final String dayLabel;
}

/// User plan type
enum UserPlan { free, premium }

/// Home screen state
class HomeScreenState {
  const HomeScreenState({
    this.todaySessionCount = 0,
    this.weeklyProgress = const [],
    this.recentSessions = const [],
    this.userPlan = UserPlan.free,
    this.dailyLimit = 3,
    this.todayUsageCount = 0,
    this.isLoading = false,
    this.error,
    this.weeklySessionCount = 0,
    this.weeklyAverageScore = 0.0,
  });

  /// Number of sessions completed today
  final int todaySessionCount;

  /// Weekly progress data (7 days)
  final List<DailySessionCount> weeklyProgress;

  /// Most recent 3 sessions
  final List<HistorySession> recentSessions;

  /// User's current plan
  final UserPlan userPlan;

  /// Daily session limit for free plan
  final int dailyLimit;

  /// Today's usage count
  final int todayUsageCount;

  /// Loading state
  final bool isLoading;

  /// Error message
  final String? error;

  /// Total session count for this week
  final int weeklySessionCount;

  /// Average score for this week
  final double weeklyAverageScore;

  /// Remaining sessions for free plan
  int get remainingSessions => dailyLimit - todayUsageCount;

  /// Whether user has reached daily limit
  bool get hasReachedLimit =>
      userPlan == UserPlan.free && todayUsageCount >= dailyLimit;

  /// Whether to show upgrade prompt
  bool get shouldShowUpgradePrompt => userPlan == UserPlan.free;

  HomeScreenState copyWith({
    int? todaySessionCount,
    List<DailySessionCount>? weeklyProgress,
    List<HistorySession>? recentSessions,
    UserPlan? userPlan,
    int? dailyLimit,
    int? todayUsageCount,
    bool? isLoading,
    String? error,
    int? weeklySessionCount,
    double? weeklyAverageScore,
  }) {
    return HomeScreenState(
      todaySessionCount: todaySessionCount ?? this.todaySessionCount,
      weeklyProgress: weeklyProgress ?? this.weeklyProgress,
      recentSessions: recentSessions ?? this.recentSessions,
      userPlan: userPlan ?? this.userPlan,
      dailyLimit: dailyLimit ?? this.dailyLimit,
      todayUsageCount: todayUsageCount ?? this.todayUsageCount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      weeklySessionCount: weeklySessionCount ?? this.weeklySessionCount,
      weeklyAverageScore: weeklyAverageScore ?? this.weeklyAverageScore,
    );
  }
}

/// Home state notifier
class HomeStateNotifier extends StateNotifier<HomeScreenState> {
  HomeStateNotifier(this._historyService, this._userId, this._userData)
    : super(const HomeScreenState()) {
    _initializeUserPlan();
  }

  final HistoryService _historyService;
  final String _userId;
  final Map<String, dynamic>? _userData;

  /// Initialize user plan from Firestore data
  void _initializeUserPlan() {
    if (_userData == null) return;

    final subscriptionStatus =
        _userData['subscriptionStatus'] as String? ?? 'free';
    final dailyUsageCount = _userData['dailyUsageCount'] as int? ?? 0;

    final userPlan =
        subscriptionStatus == 'active' || subscriptionStatus == 'premium'
        ? UserPlan.premium
        : UserPlan.free;

    state = state.copyWith(
      userPlan: userPlan,
      todayUsageCount: dailyUsageCount,
    );
  }

  /// Load home screen data
  Future<void> loadHomeData() async {
    if (_userId.isEmpty) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);

      // Load today's sessions
      final todaySessions = await _historyService.fetchSessionsForDate(
        userId: _userId,
        date: today,
      );

      // Load weekly data (past 7 days)
      final weeklyProgress = await _loadWeeklyProgress(today);

      // Calculate weekly statistics
      final weeklyStats = _calculateWeeklyStats(weeklyProgress);

      // Load recent sessions (latest 3)
      final recentSessions = await _historyService.fetchSessions(
        userId: _userId,
        limit: 3,
      );

      // Calculate weekly average score from recent sessions within this week
      final weekStart = today.subtract(Duration(days: today.weekday - 1));
      final weeklyAverageScore = await _calculateWeeklyAverageScore(weekStart);

      state = state.copyWith(
        todaySessionCount: todaySessions.length,
        weeklyProgress: weeklyProgress,
        recentSessions: recentSessions,
        weeklySessionCount: weeklyStats,
        weeklyAverageScore: weeklyAverageScore,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'データの読み込みに失敗しました: $e');
    }
  }

  /// Calculate total weekly session count from progress data
  int _calculateWeeklyStats(List<DailySessionCount> weeklyProgress) {
    return weeklyProgress.fold(0, (sum, day) => sum + day.sessionCount);
  }

  /// Calculate weekly average score
  Future<double> _calculateWeeklyAverageScore(DateTime weekStart) async {
    try {
      final weekEnd = weekStart.add(const Duration(days: 7));
      final weeklySessions = await _historyService.fetchSessions(
        userId: _userId,
        filter: HistoryFilter(startDate: weekStart, endDate: weekEnd),
        limit: 100,
      );

      if (weeklySessions.isEmpty) return 0.0;

      final totalScore = weeklySessions.fold<double>(
        0.0,
        (sum, session) => sum + session.averageScore,
      );
      return totalScore / weeklySessions.length;
    } catch (e) {
      return 0.0;
    }
  }

  /// Load weekly progress data for bar chart
  Future<List<DailySessionCount>> _loadWeeklyProgress(DateTime today) async {
    final weeklyProgress = <DailySessionCount>[];
    final dayLabels = ['月', '火', '水', '木', '金', '土', '日'];

    // Get dates for past 7 days (starting from today's weekday to show full week)
    final dayOfWeek = today.weekday; // 1 = Monday, 7 = Sunday
    final weekStart = today.subtract(Duration(days: dayOfWeek - 1));

    // Fetch daily summaries for the week
    final startDate = weekStart;
    final endDate = weekStart.add(const Duration(days: 7));

    final dailySummaries = await _historyService.fetchDailySummaries(
      userId: _userId,
      startDate: startDate,
      endDate: endDate,
    );

    // Create summary map for quick lookup
    final summaryMap = <int, DailySummary>{};
    for (final summary in dailySummaries) {
      summaryMap[summary.date.weekday] = summary;
    }

    // Build weekly progress list
    for (var i = 0; i < 7; i++) {
      final date = weekStart.add(Duration(days: i));
      final weekday = date.weekday; // 1-7
      final summary = summaryMap[weekday];

      weeklyProgress.add(
        DailySessionCount(
          date: date,
          sessionCount: summary?.sessionCount ?? 0,
          dayLabel: dayLabels[i],
        ),
      );
    }

    return weeklyProgress;
  }

  /// Refresh home data
  Future<void> refresh() async {
    await loadHomeData();
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// Home state provider
final homeStateProvider =
    StateNotifierProvider.autoDispose<HomeStateNotifier, HomeScreenState>((
      ref,
    ) {
      final authState = ref.watch(authStateProvider);
      final historyService = ref.watch(historyServiceProvider);

      final userId = authState.user?.uid ?? '';
      final userData = authState.userData;

      return HomeStateNotifier(historyService, userId, userData);
    });
