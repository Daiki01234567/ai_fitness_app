/// Exercise Selection Screen
///
/// Allows user to select an exercise type before training.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.7)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../home/home_screen.dart';

/// Exercise selection screen
class ExerciseSelectionScreen extends ConsumerWidget {
  const ExerciseSelectionScreen({super.key});

  void _navigateToTab(BuildContext context, WidgetRef ref, int index) {
    ref.read(bottomNavIndexProvider.notifier).state = index;
    switch (index) {
      case 0:
        context.goToHome();
        break;
      case 1:
        // Already on training tab
        break;
      case 2:
        context.goToHistory();
        break;
      case 3:
        context.goToProfile();
        break;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.goToHome(),
        ),
        title: const Text('種目選択'),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header section
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(
                'トレーニングを選択してください',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),

            // Exercise cards
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: ExerciseType.values.length,
                itemBuilder: (context, index) {
                  final exerciseType = ExerciseType.values[index];
                  return _ExerciseCard(exerciseType: exerciseType);
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1, // Training tab is selected
        onDestinationSelected: (index) => _navigateToTab(context, ref, index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'ホーム',
          ),
          NavigationDestination(
            icon: Icon(Icons.fitness_center_outlined),
            selectedIcon: Icon(Icons.fitness_center),
            label: 'トレーニング',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: '履歴',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'プロフィール',
          ),
        ],
      ),
    );
  }
}

/// Exercise card widget
class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({required this.exerciseType});

  final ExerciseType exerciseType;

  IconData _getExerciseIcon() {
    switch (exerciseType) {
      case ExerciseType.squat:
        return Icons.accessibility_new;
      case ExerciseType.armCurl:
        return Icons.fitness_center;
      case ExerciseType.sideRaise:
        return Icons.open_with;
      case ExerciseType.shoulderPress:
        return Icons.arrow_upward;
      case ExerciseType.pushUp:
        return Icons.horizontal_rule;
    }
  }

  String _getDifficultyLabel() {
    switch (exerciseType) {
      case ExerciseType.squat:
      case ExerciseType.armCurl:
      case ExerciseType.pushUp:
        return '初級';
      case ExerciseType.sideRaise:
      case ExerciseType.shoulderPress:
        return '中級';
    }
  }

  Color _getDifficultyColor(BuildContext context) {
    switch (exerciseType) {
      case ExerciseType.squat:
      case ExerciseType.armCurl:
      case ExerciseType.pushUp:
        return Colors.green;
      case ExerciseType.sideRaise:
      case ExerciseType.shoulderPress:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = AnalyzerFactory.getDisplayName(exerciseType);
    final description = AnalyzerFactory.getDescription(exerciseType);
    final bodyParts = AnalyzerFactory.getKeyBodyParts(exerciseType).join('・');

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: InkWell(
        onTap: () {
          // Navigate to exercise detail screen instead of directly to setup
          context.goToExerciseDetail(exerciseType);
        },
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              // Icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  _getExerciseIcon(),
                  size: 28,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.md),

              // Text content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: _getDifficultyColor(context).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                          ),
                          child: Text(
                            _getDifficultyLabel(),
                            style: TextStyle(
                              color: _getDifficultyColor(context),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      bodyParts,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),

              // Arrow
              const SizedBox(width: AppSpacing.sm),
              Icon(
                Icons.chevron_right,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
