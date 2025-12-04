/// Session Result Screen
///
/// Displays training session results after completion.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.10)
///
/// Features:
/// - Session summary (score, reps, duration)
/// - Feedback summary
/// - Option to start another session
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session/session_state.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';

/// Session result screen
class SessionResultScreen extends ConsumerWidget {
  const SessionResultScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionState = ref.watch(trainingSessionProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              // Header
              _buildHeader(context),
              const SizedBox(height: AppSpacing.xl),

              // Summary card
              _buildSummaryCard(context, sessionState),
              const SizedBox(height: AppSpacing.lg),

              // Sets breakdown
              if (sessionState.completedSets.isNotEmpty)
                Expanded(child: _buildSetsBreakdown(context, sessionState)),

              // Action buttons
              _buildActionButtons(context, ref),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.green.withValues(alpha: 0.2),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle, size: 48, color: Colors.green),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'お疲れ様でした!',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(BuildContext context, TrainingSessionState state) {
    final totalReps = state.completedSets.fold<int>(
      0,
      (sum, set) => sum + set.reps,
    );
    final avgScore = state.completedSets.isNotEmpty
        ? state.completedSets.fold<double>(
                0,
                (sum, set) => sum + set.averageScore,
              ) /
              state.completedSets.length
        : 0.0;
    final totalDuration = state.completedSets.fold<Duration>(
      Duration.zero,
      (sum, set) => sum + set.duration,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            // Exercise name
            Text(
              state.exerciseInfo?.name ?? 'トレーニング',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const Divider(height: AppSpacing.xl),

            // Stats row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildStatColumn(
                  context,
                  icon: Icons.star,
                  label: '参考スコア',
                  value: '${avgScore.toStringAsFixed(0)}点',
                  color: _getScoreColor(avgScore),
                ),
                _buildStatColumn(
                  context,
                  icon: Icons.replay,
                  label: '合計レップ',
                  value: '$totalReps回',
                ),
                _buildStatColumn(
                  context,
                  icon: Icons.timer,
                  label: '所要時間',
                  value: _formatDuration(totalDuration),
                ),
              ],
            ),
            const Divider(height: AppSpacing.xl),

            // Sets completed
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.check_circle_outline,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '${state.completedSets.length}セット完了',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatColumn(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
    Color? color,
  }) {
    return Column(
      children: [
        Icon(icon, color: color ?? Theme.of(context).colorScheme.primary),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
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

  Widget _buildSetsBreakdown(BuildContext context, TrainingSessionState state) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'セット詳細',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const Divider(),
            Expanded(
              child: ListView.builder(
                itemCount: state.completedSets.length,
                itemBuilder: (context, index) {
                  final setData = state.completedSets[index];
                  return _buildSetRow(context, setData);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSetRow(BuildContext context, SetData setData) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          // Set number
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '${setData.setNumber}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),

          // Reps
          Expanded(child: Text('${setData.reps}回')),

          // Score
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: _getScoreColor(
                setData.averageScore,
              ).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Text(
              '${setData.averageScore.toStringAsFixed(0)}点',
              style: TextStyle(
                color: _getScoreColor(setData.averageScore),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),

          const SizedBox(width: AppSpacing.md),

          // Duration
          Text(
            _formatDuration(setData.duration),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        FilledButton(
          onPressed: () {
            ref.read(trainingSessionProvider.notifier).resetSession();
            context.go(AppRoutes.training);
          },
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: const Text('もう1セット'),
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () {
            ref.read(trainingSessionProvider.notifier).resetSession();
            context.go(AppRoutes.home);
          },
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
          child: const Text('ホームに戻る'),
        ),
      ],
    );
  }

  Color _getScoreColor(double score) {
    if (score >= 90) return Colors.green;
    if (score >= 70) return Colors.amber.shade700;
    if (score >= 50) return Colors.orange;
    return Colors.red;
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    if (minutes > 0) {
      return '$minutes分$seconds秒';
    }
    return '$seconds秒';
  }
}
