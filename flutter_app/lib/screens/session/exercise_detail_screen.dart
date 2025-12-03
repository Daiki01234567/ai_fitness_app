/// Exercise Detail Screen
///
/// Displays exercise details, previous records, and goal setting before training.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.7)
///
/// Features:
/// - Exercise demonstration image/GIF
/// - Recommended camera orientation
/// - Previous session records
/// - Target reps input
/// - Navigation to camera setup
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/router/app_router.dart';
import '../../core/session/session_state.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/bottom_nav_bar.dart';

/// Exercise detail screen
class ExerciseDetailScreen extends ConsumerStatefulWidget {
  const ExerciseDetailScreen({
    required this.exerciseType,
    super.key,
  });

  final ExerciseType exerciseType;

  @override
  ConsumerState<ExerciseDetailScreen> createState() =>
      _ExerciseDetailScreenState();
}

class _ExerciseDetailScreenState extends ConsumerState<ExerciseDetailScreen> {
  final _targetRepsController = TextEditingController(text: '10');
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _targetRepsController.dispose();
    super.dispose();
  }

  String _getRecommendedOrientation() {
    switch (widget.exerciseType) {
      case ExerciseType.squat:
      case ExerciseType.pushUp:
        return '横向き';
      case ExerciseType.armCurl:
      case ExerciseType.sideRaise:
      case ExerciseType.shoulderPress:
        return '正面';
    }
  }

  List<String> _getOrientationHints() {
    switch (widget.exerciseType) {
      case ExerciseType.squat:
        return ['正面: 姿勢確認', '横向き: 深さ確認'];
      case ExerciseType.pushUp:
        return ['横向き: 肘の角度確認', '正面: 左右対称確認'];
      case ExerciseType.armCurl:
        return ['正面: 左右対称確認', '横向き: 肘の固定確認'];
      case ExerciseType.sideRaise:
        return ['正面: 腕の挙上確認', '横向き: 体幹の安定確認'];
      case ExerciseType.shoulderPress:
        return ['正面: 左右対称確認', '横向き: 肘の軌道確認'];
    }
  }

  IconData _getExerciseIcon() {
    switch (widget.exerciseType) {
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

  void _startTraining() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final targetReps = int.tryParse(_targetRepsController.text) ?? 10;

    // Update session config with target reps
    ref.read(trainingSessionProvider.notifier).initializeSession(
          widget.exerciseType,
          config: SessionConfig(
            exerciseType: widget.exerciseType,
            targetReps: targetReps,
          ),
        );

    // Navigate to camera setup
    context.goToTrainingSetup(widget.exerciseType);
  }

  void _navigateToTab(int index) {
    ref.read(bottomNavIndexProvider.notifier).state = index;
    switch (index) {
      case 0:
        context.goToHome();
        break;
      case 1:
        context.goToTraining();
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
  Widget build(BuildContext context) {
    final exerciseName = AnalyzerFactory.getDisplayName(widget.exerciseType);
    final description = AnalyzerFactory.getDescription(widget.exerciseType);
    final bodyParts = AnalyzerFactory.getKeyBodyParts(widget.exerciseType);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.goToTraining(),
        ),
        title: Text(exerciseName),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Exercise demonstration placeholder
                _buildExerciseDemo(context),
                const SizedBox(height: AppSpacing.lg),

                // Exercise description
                _buildDescriptionSection(context, description, bodyParts),
                const SizedBox(height: AppSpacing.lg),

                // Recommended orientation
                _buildOrientationSection(context),
                const SizedBox(height: AppSpacing.lg),

                // Previous record
                _buildPreviousRecordSection(context),
                const SizedBox(height: AppSpacing.lg),

                // Target reps input
                _buildTargetRepsSection(context),
                const SizedBox(height: AppSpacing.xl),

                // Start button
                FilledButton(
                  onPressed: _startTraining,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_arrow),
                      SizedBox(width: AppSpacing.sm),
                      Text(
                        '開始する',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1, // Training tab is selected
        onDestinationSelected: _navigateToTab,
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

  /// Build exercise demonstration section
  Widget _buildExerciseDemo(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: Theme.of(context).colorScheme.primaryContainer,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _getExerciseIcon(),
                size: 64,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                '動作イメージ',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '(準備中)',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onPrimaryContainer
                          .withValues(alpha: 0.7),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build description section
  Widget _buildDescriptionSection(
    BuildContext context,
    String description,
    List<String> bodyParts,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          description,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: bodyParts.map((part) {
            return Chip(
              label: Text(part),
              backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
              labelStyle: TextStyle(
                color: Theme.of(context).colorScheme.onSecondaryContainer,
                fontSize: 12,
              ),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              padding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
            );
          }).toList(),
        ),
      ],
    );
  }

  /// Build recommended orientation section
  Widget _buildOrientationSection(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.screen_rotation,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '推奨向き',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _getRecommendedOrientation() == '横向き'
                        ? Icons.stay_current_landscape
                        : Icons.stay_current_portrait,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    _getRecommendedOrientation(),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            ...(_getOrientationHints().map((hint) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Row(
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        size: 16,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        hint,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ))),
          ],
        ),
      ),
    );
  }

  /// Build previous record section (mock data for now)
  Widget _buildPreviousRecordSection(BuildContext context) {
    // TODO: Fetch actual previous record from Firestore
    // For now, using mock data - will be replaced with actual data fetch
    const hasPreviousRecord = true; // Mock: assume there is a previous record

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.history,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '前回の記録',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const Divider(),
            if (hasPreviousRecord) ...[
              Text(
                '2024/11/22',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _buildRecordItem(
                      context,
                      icon: Icons.repeat,
                      label: 'レップ数',
                      value: '10回',
                    ),
                  ),
                  Expanded(
                    child: _buildRecordItem(
                      context,
                      icon: Icons.star,
                      label: '参考スコア',
                      value: '85点',
                    ),
                  ),
                ],
              ),
            ] else
              // ignore: dead_code - will be shown when hasPreviousRecord is false (future feature)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Center(
                  child: Text(
                    'まだ記録がありません',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Build a single record item
  Widget _buildRecordItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: AppSpacing.xs),
        Text(
          '$label: ',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
      ],
    );
  }

  /// Build target reps input section
  Widget _buildTargetRepsSection(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.flag,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '今回の目標',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const Divider(),
            TextFormField(
              controller: _targetRepsController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: InputDecoration(
                labelText: 'レップ数 (回)',
                hintText: '例: 10、15、20',
                prefixIcon: const Icon(Icons.repeat),
                suffixText: '回',
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'レップ数を入力してください';
                }
                final reps = int.tryParse(value);
                if (reps == null || reps < 1) {
                  return '1以上の数字を入力してください';
                }
                if (reps > 100) {
                  return '100以下の数字を入力してください';
                }
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '例: 10、15、20',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
