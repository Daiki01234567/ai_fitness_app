/// Home Screen
///
/// Main app screen after authentication with dashboard display.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.6)
///
/// Displays:
/// - User greeting
/// - Today's session count (large display)
/// - Weekly progress bar chart (7 days)
/// - Recent sessions (latest 2)
/// - Training start button
/// - Free plan limits and upgrade link
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
///
/// @version 2.1.0
/// @date 2025-12-03
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

                // Today's session count
                _buildTodaySessionCard(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Weekly progress chart
                _buildWeeklyProgressCard(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Recent sessions
                _buildRecentSessionsSection(context, homeState),
                const SizedBox(height: AppSpacing.lg),

                // Training start button
                _buildTrainingStartButton(context),
                const SizedBox(height: AppSpacing.lg),

                // Free plan limit display
                if (homeState.shouldShowUpgradePrompt) ...[
                  _buildPlanLimitCard(context, homeState),
                  const SizedBox(height: AppSpacing.md),
                ],
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
                  Text(
                    'こんにちは！',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  Text(
                    '${user?.displayName ?? userData?['displayName'] as String? ?? 'ユーザー'}さん',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
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
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('確認メールを再送信しました'),
                  ),
                );
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

  /// Build today's session count card with large number display
  Widget _buildTodaySessionCard(BuildContext context, HomeScreenState state) {
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
                  Icons.today,
                  color: theme.colorScheme.primary,
                  size: 20,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '今日のセッション',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: state.isLoading
                  ? const CircularProgressIndicator()
                  : Column(
                      children: [
                        Text(
                          '${state.todaySessionCount}',
                          style: theme.textTheme.displayLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                        Text(
                          '回',
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
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

  /// Build recent sessions section
  Widget _buildRecentSessionsSection(
      BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(
                  Icons.history,
                  color: theme.colorScheme.primary,
                  size: 20,
                ),
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
                color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
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

  /// Build training start button
  Widget _buildTrainingStartButton(BuildContext context) {
    return FilledButton(
      onPressed: () {
        context.goToTraining();
      },
      style: FilledButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
        minimumSize: const Size(double.infinity, 56),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.play_arrow, size: 28),
          SizedBox(width: AppSpacing.sm),
          Text(
            'トレーニング開始',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  /// Build free plan limit display card
  Widget _buildPlanLimitCard(BuildContext context, HomeScreenState state) {
    final theme = Theme.of(context);
    final remaining = state.remainingSessions;
    final limit = state.dailyLimit;
    final used = state.todayUsageCount;

    return Card(
      color: theme.colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.info_outline,
                  size: 16,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  '無料プラン: 残り $remaining回/$limit回',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: used / limit,
                backgroundColor: theme.colorScheme.outlineVariant,
                valueColor: AlwaysStoppedAnimation(
                  remaining > 0 ? theme.colorScheme.primary : theme.colorScheme.error,
                ),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextButton(
              onPressed: () {
                // Navigate to subscription screen
                // TODO: Implement when subscription screen is ready
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('プレミアムプランは準備中です'),
                  ),
                );
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.star,
                    size: 16,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'プレミアムにアップグレード',
                    style: TextStyle(
                      color: theme.colorScheme.primary,
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
    final maxCount = data.map((d) => d.sessionCount).fold(1, (a, b) => a > b ? a : b);

    return LayoutBuilder(
      builder: (context, constraints) {
        final barWidth = (constraints.maxWidth - 48) / 7; // 48 = padding between bars
        final maxHeight = constraints.maxHeight - 24; // 24 = label height

        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: data.map((dayData) {
            final barHeight = maxCount > 0
                ? (dayData.sessionCount / maxCount * maxHeight).clamp(4.0, maxHeight)
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
