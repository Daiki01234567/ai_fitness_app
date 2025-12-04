/// Home Screen
///
/// Main app screen after authentication with dashboard display.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.6)
///
/// Displays:
/// - User greeting
/// - Today's training status (remaining/total with plan info)
/// - Training start button (large and prominent)
/// - Quick access shortcuts for exercise selection
/// - Recent sessions (latest 3)
/// - Weekly statistics (session count + average score)
/// - Free plan limits and upgrade link
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
///
/// @version 2.2.0
/// @date 2025-12-04
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/bottom_nav_bar.dart';
import 'home_state.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Load home data after the widget is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(homeStateProvider.notifier).loadHomeData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final homeState = ref.watch(homeStateProvider);
    final user = authState.user;
    final userData = authState.userData;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Fitness'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () {
              context.goToProfile();
            },
            tooltip: 'プロフィール',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(homeStateProvider.notifier).refresh(),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Welcome message card
                _buildWelcomeCard(context, user, userData),
                const SizedBox(height: AppSpacing.lg),

                // Email verification warning
                if (user != null && !user.emailVerified) ...[
                  _buildEmailVerificationWarning(context, ref),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Deletion scheduled warning
                if (authState.isDeletionScheduled) ...[
                  _buildDeletionWarning(context, ref),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Today's training status (remaining/total with plan info)
                _buildTodayTrainingCard(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Training start button (large and prominent)
                _buildTrainingStartButton(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Quick access shortcuts for exercise selection
                _buildQuickAccessSection(context),
                const SizedBox(height: AppSpacing.lg),

                // Recent sessions (latest 3)
                _buildRecentSessionsSection(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Weekly statistics (session count + average score)
                _buildWeeklyStatsCard(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Weekly progress chart
                _buildWeeklyProgressCard(context, homeState),
                const SizedBox(height: AppSpacing.md),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: const BottomNavBar(currentIndex: 0),
    );
  }

  /// Build welcome card with user greeting
  Widget _buildWelcomeCard(
    BuildContext context,
    dynamic user,
    Map<String, dynamic>? userData,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Icon(
                Icons.person,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('こんにちは！', style: Theme.of(context).textTheme.bodyMedium),
                  Text(
                    '${user?.displayName ?? userData?['displayName'] as String? ?? 'ユーザー'}さん',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
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

  /// Build email verification warning card
  Widget _buildEmailVerificationWarning(BuildContext context, WidgetRef ref) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.warning_amber_outlined,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'メールアドレスが確認されていません',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '確認メールのリンクをクリックしてください',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () {
                ref.read(authStateProvider.notifier).sendEmailVerification();
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(const SnackBar(content: Text('確認メールを再送信しました')));
              },
              child: const Text('再送信'),
            ),
          ],
        ),
      ),
    );
  }

  /// Build account deletion warning card
  Widget _buildDeletionWarning(BuildContext context, WidgetRef ref) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.delete_forever,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'アカウント削除が予定されています',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '30日後にアカウントが削除されます',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () {
                ref.read(authStateProvider.notifier).cancelAccountDeletion();
              },
              child: const Text('キャンセル'),
            ),
          ],
        ),
      ),
    );
  }

  /// Build today's training status card with usage limits
  /// Shows remaining/total for free plan, unlimited for premium
  Widget _buildTodayTrainingCard(BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);
    final isPremium = state.userPlan == UserPlan.premium;
    final remaining = state.remainingSessions;
    final limit = state.dailyLimit;
    final used = state.todayUsageCount;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.today, color: theme.colorScheme.primary, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '今日のトレーニング',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            if (state.isLoading)
              const Center(child: CircularProgressIndicator())
            else
              Column(
                children: [
                  // Progress bar for free plan
                  if (!isPremium) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: used / limit,
                        backgroundColor: theme.colorScheme.surfaceContainerHighest,
                        valueColor: AlwaysStoppedAnimation(
                          remaining > 0
                              ? theme.colorScheme.primary
                              : theme.colorScheme.error,
                        ),
                        minHeight: 12,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  // Usage display
                  Center(
                    child: isPremium
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.all_inclusive,
                                size: 36,
                                color: theme.colorScheme.primary,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Text(
                                '無制限',
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            children: [
                              RichText(
                                text: TextSpan(
                                  style: theme.textTheme.bodyLarge,
                                  children: [
                                    TextSpan(
                                      text: '残り ',
                                      style: TextStyle(
                                        color: theme.colorScheme.onSurfaceVariant,
                                      ),
                                    ),
                                    TextSpan(
                                      text: '$remaining',
                                      style: TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.bold,
                                        color: remaining > 0
                                            ? theme.colorScheme.primary
                                            : theme.colorScheme.error,
                                      ),
                                    ),
                                    TextSpan(
                                      text: ' 回 / $limit回',
                                      style: TextStyle(
                                        color: theme.colorScheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.sm,
                                  vertical: AppSpacing.xs,
                                ),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(AppRadius.sm),
                                ),
                                child: Text(
                                  '無料プラン',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                  // Upgrade prompt when limit reached
                  if (!isPremium && remaining <= 0) ...[
                    const SizedBox(height: AppSpacing.md),
                    FilledButton.tonal(
                      onPressed: () {
                        // Navigate to subscription screen
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('プレミアムプランは準備中です')),
                        );
                      },
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.star, size: 18),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            'プレミアムで無制限に',
                            style: theme.textTheme.labelLarge,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }

  /// Build weekly progress bar chart card
  Widget _buildWeeklyProgressCard(BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.bar_chart,
                  color: theme.colorScheme.primary,
                  size: 20,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '週間の進捗',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            if (state.isLoading)
              const Center(child: CircularProgressIndicator())
            else
              SizedBox(
                height: 120,
                child: _WeeklyBarChart(data: state.weeklyProgress),
              ),
          ],
        ),
      ),
    );
  }

  /// Build weekly statistics card showing session count and average score
  Widget _buildWeeklyStatsCard(BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.analytics_outlined,
                  color: theme.colorScheme.primary,
                  size: 20,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '今週の統計',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            if (state.isLoading)
              const Center(child: CircularProgressIndicator())
            else
              Row(
                children: [
                  // Weekly session count
                  Expanded(
                    child: _buildStatItem(
                      context,
                      icon: Icons.fitness_center,
                      label: 'セッション数',
                      value: '${state.weeklySessionCount}',
                      unit: '回',
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 60,
                    color: theme.colorScheme.outlineVariant,
                  ),
                  // Weekly average score
                  Expanded(
                    child: _buildStatItem(
                      context,
                      icon: Icons.star_outline,
                      label: '平均スコア',
                      value: state.weeklyAverageScore > 0
                          ? state.weeklyAverageScore.toStringAsFixed(0)
                          : '-',
                      unit: '点',
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  /// Build a single stat item for the weekly stats card
  Widget _buildStatItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
    required String unit,
  }) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Icon(
          icon,
          size: 24,
          color: theme.colorScheme.primary,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        RichText(
          text: TextSpan(
            style: theme.textTheme.bodyLarge,
            children: [
              TextSpan(
                text: value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.primary,
                ),
              ),
              TextSpan(
                text: unit,
                style: TextStyle(
                  fontSize: 14,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Build quick access section for exercise selection shortcuts
  Widget _buildQuickAccessSection(BuildContext context) {
    final theme = Theme.of(context);
    final exercises = ExerciseType.values;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.flash_on,
              color: theme.colorScheme.primary,
              size: 20,
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              'クイックアクセス',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: exercises.length,
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              final exercise = exercises[index];
              return _buildExerciseShortcut(context, exercise);
            },
          ),
        ),
      ],
    );
  }

  /// Build a single exercise shortcut button
  Widget _buildExerciseShortcut(BuildContext context, ExerciseType exercise) {
    final theme = Theme.of(context);
    final exerciseName = AnalyzerFactory.getDisplayName(exercise);
    final icon = _getExerciseIcon(exercise);

    return InkWell(
      onTap: () {
        context.goToExerciseDetail(exercise);
      },
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        width: 80,
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: theme.colorScheme.outlineVariant,
            width: 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 24,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              exerciseName,
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  /// Get icon for exercise type
  IconData _getExerciseIcon(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return Icons.accessibility_new;
      case ExerciseType.armCurl:
        return Icons.fitness_center;
      case ExerciseType.sideRaise:
        return Icons.pan_tool_outlined;
      case ExerciseType.shoulderPress:
        return Icons.keyboard_double_arrow_up;
      case ExerciseType.pushUp:
        return Icons.sports_gymnastics;
    }
  }

  /// Build recent sessions section
  Widget _buildRecentSessionsSection(
    BuildContext context,
    HomeScreenState state,
  ) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(Icons.history, color: theme.colorScheme.primary, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '直近の履歴',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: () => context.goToHistory(),
              child: const Text('すべて見る'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        if (state.isLoading)
          const Center(child: CircularProgressIndicator())
        else if (state.recentSessions.isEmpty)
          _buildEmptySessionsPlaceholder(context)
        else
          ...state.recentSessions.map((session) => _buildSessionCard(session)),
      ],
    );
  }

  /// Build empty sessions placeholder
  Widget _buildEmptySessionsPlaceholder(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          children: [
            Icon(
              Icons.fitness_center,
              size: 48,
              color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'まだトレーニング記録がありません',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'トレーニングを開始して\n記録を始めましょう！',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant.withValues(
                  alpha: 0.7,
                ),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Build session card for recent sessions
  Widget _buildSessionCard(dynamic session) {
    final theme = Theme.of(context);
    final timeFormat = DateFormat('HH:mm');
    final exerciseName = AnalyzerFactory.getDisplayName(session.exerciseType);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: InkWell(
        onTap: () {
          // Navigate to session detail if needed
          context.goToHistory();
        },
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              // Time
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    timeFormat.format(session.startTime),
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: AppSpacing.md),
              // Divider
              Container(
                width: 1,
                height: 36,
                color: theme.colorScheme.outlineVariant,
              ),
              const SizedBox(width: AppSpacing.md),
              // Exercise info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exerciseName,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      'スコア: ${session.averageScore.toStringAsFixed(0)}点 | ${session.totalReps}回',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              // Arrow
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build training start button (large and prominent)
  /// Handles free plan limit check
  Widget _buildTrainingStartButton(BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);
    final hasReachedLimit = state.hasReachedLimit;

    return FilledButton(
      onPressed: hasReachedLimit
          ? () {
              // Show upgrade dialog when limit reached
              _showUpgradeDialog(context);
            }
          : () {
              context.goToTraining();
            },
      style: FilledButton.styleFrom(
        backgroundColor: hasReachedLimit
            ? theme.colorScheme.surfaceContainerHighest
            : theme.colorScheme.primary,
        foregroundColor: hasReachedLimit
            ? theme.colorScheme.onSurfaceVariant
            : theme.colorScheme.onPrimary,
        minimumSize: const Size(double.infinity, 64),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        elevation: hasReachedLimit ? 0 : 2,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            hasReachedLimit ? Icons.lock : Icons.play_arrow,
            size: 32,
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            hasReachedLimit ? '本日の上限に達しました' : 'トレーニングを始める',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  /// Show upgrade dialog when daily limit is reached
  void _showUpgradeDialog(BuildContext context) {
    final theme = Theme.of(context);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('本日の上限に達しました'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '無料プランでは1日3回までトレーニングできます。',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'プレミアムプランにアップグレードすると、無制限でトレーニングできます。',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('閉じる'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              // TODO: Navigate to subscription screen when ready
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('プレミアムプランは準備中です')),
              );
            },
            child: const Text('アップグレード'),
          ),
        ],
      ),
    );
  }

}

/// Weekly bar chart widget for progress display
class _WeeklyBarChart extends StatelessWidget {
  const _WeeklyBarChart({required this.data});

  final List<DailySessionCount> data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (data.isEmpty) {
      return Center(
        child: Text(
          'データがありません',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      );
    }

    // Calculate max value for scaling
    final maxCount = data
        .map((d) => d.sessionCount)
        .fold(1, (a, b) => a > b ? a : b);

    return LayoutBuilder(
      builder: (context, constraints) {
        final barWidth =
            (constraints.maxWidth - 48) / 7; // 48 = padding between bars
        final maxHeight = constraints.maxHeight - 24; // 24 = label height

        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: data.map((dayData) {
            final barHeight = maxCount > 0
                ? (dayData.sessionCount / maxCount * maxHeight).clamp(
                    4.0,
                    maxHeight,
                  )
                : 4.0;
            final isToday = _isToday(dayData.date);

            return Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Session count above bar
                if (dayData.sessionCount > 0)
                  Text(
                    '${dayData.sessionCount}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: isToday
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurfaceVariant,
                      fontWeight: isToday ? FontWeight.bold : null,
                    ),
                  )
                else
                  const SizedBox(height: 14), // Placeholder for alignment
                const SizedBox(height: 4),
                // Bar
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: barWidth - 8,
                  height: barHeight,
                  decoration: BoxDecoration(
                    color: isToday
                        ? theme.colorScheme.primary
                        : theme.colorScheme.primary.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 4),
                // Day label
                Text(
                  dayData.dayLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: isToday
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurfaceVariant,
                    fontWeight: isToday ? FontWeight.bold : null,
                  ),
                ),
              ],
            );
          }).toList(),
        );
      },
    );
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }
}
