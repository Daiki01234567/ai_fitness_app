/// Exercise Selection Screen
///
/// Allows user to select an exercise type before training.
/// Includes search and filter functionality.
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
import '../widgets/bottom_nav_bar.dart';
import 'exercise_selection_state.dart';

/// Exercise selection screen with search and filter functionality
class ExerciseSelectionScreen extends ConsumerStatefulWidget {
  const ExerciseSelectionScreen({super.key});

  @override
  ConsumerState<ExerciseSelectionScreen> createState() =>
      _ExerciseSelectionScreenState();
}

class _ExerciseSelectionScreenState
    extends ConsumerState<ExerciseSelectionScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    ref
        .read(exerciseSelectionProvider.notifier)
        .setSearchQuery(_searchController.text);
  }

  void _clearSearch() {
    _searchController.clear();
    ref.read(exerciseSelectionProvider.notifier).clearSearch();
  }

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
  Widget build(BuildContext context) {
    final state = ref.watch(exerciseSelectionProvider);

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
            // Search bar
            _SearchBar(
              controller: _searchController,
              focusNode: _searchFocusNode,
              onClear: _clearSearch,
            ),

            // Filter chips
            _FilterChips(
              selectedCategory: state.selectedCategory,
              selectedDifficulty: state.selectedDifficulty,
              onCategoryChanged: (category) {
                ref
                    .read(exerciseSelectionProvider.notifier)
                    .setCategory(category);
              },
              onDifficultyChanged: (difficulty) {
                ref
                    .read(exerciseSelectionProvider.notifier)
                    .setDifficulty(difficulty);
              },
            ),

            // Exercise list grouped by category
            Expanded(
              child: _ExerciseList(
                exercisesByCategory: state.exercisesByCategory,
                hasActiveFilters: state.hasActiveFilters,
                onClearFilters: () {
                  _clearSearch();
                  ref.read(exerciseSelectionProvider.notifier).clearFilters();
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

/// Search bar widget
class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.focusNode,
    required this.onClear,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        decoration: InputDecoration(
          hintText: '検索...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: onClear,
                  tooltip: 'クリア',
                )
              : null,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md,
          ),
        ),
        textInputAction: TextInputAction.search,
      ),
    );
  }
}

/// Filter chips widget
class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.selectedCategory,
    required this.selectedDifficulty,
    required this.onCategoryChanged,
    required this.onDifficultyChanged,
  });

  final ExerciseCategory selectedCategory;
  final ExerciseDifficulty selectedDifficulty;
  final ValueChanged<ExerciseCategory> onCategoryChanged;
  final ValueChanged<ExerciseDifficulty> onDifficultyChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Text(
            'フィルタ:',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Category filter dropdown
          _FilterDropdown<ExerciseCategory>(
            value: selectedCategory,
            items: ExerciseCategory.values,
            onChanged: onCategoryChanged,
            labelBuilder: (item) => item.displayName,
          ),

          const SizedBox(width: AppSpacing.sm),

          // Difficulty filter dropdown
          _FilterDropdown<ExerciseDifficulty>(
            value: selectedDifficulty,
            items: ExerciseDifficulty.values,
            onChanged: onDifficultyChanged,
            labelBuilder: (item) => item.displayName,
          ),
        ],
      ),
    );
  }
}

/// Generic filter dropdown widget
class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
    required this.labelBuilder,
  });

  final T value;
  final List<T> items;
  final ValueChanged<T> onChanged;
  final String Function(T) labelBuilder;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isSelected = items.indexOf(value) != 0; // First item is "all"

    return Material(
      color: isSelected
          ? colorScheme.primaryContainer
          : colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: () => _showFilterMenu(context),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                labelBuilder(value),
                style: TextStyle(
                  color: isSelected
                      ? colorScheme.onPrimaryContainer
                      : colorScheme.onSurfaceVariant,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                Icons.arrow_drop_down,
                size: 20,
                color: isSelected
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFilterMenu(BuildContext context) {
    final RenderBox button = context.findRenderObject()! as RenderBox;
    final RenderBox overlay =
        Navigator.of(context).overlay!.context.findRenderObject()! as RenderBox;
    final RelativeRect position = RelativeRect.fromRect(
      Rect.fromPoints(
        button.localToGlobal(Offset.zero, ancestor: overlay),
        button.localToGlobal(
          button.size.bottomRight(Offset.zero),
          ancestor: overlay,
        ),
      ),
      Offset.zero & overlay.size,
    );

    showMenu<T>(
      context: context,
      position: position,
      items: items.map((item) {
        return PopupMenuItem<T>(
          value: item,
          child: Row(
            children: [
              if (item == value)
                Icon(
                  Icons.check,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                )
              else
                const SizedBox(width: 18),
              const SizedBox(width: AppSpacing.sm),
              Text(labelBuilder(item)),
            ],
          ),
        );
      }).toList(),
    ).then((selected) {
      if (selected != null) {
        onChanged(selected);
      }
    });
  }
}

/// Exercise list widget with category sections
class _ExerciseList extends StatelessWidget {
  const _ExerciseList({
    required this.exercisesByCategory,
    required this.hasActiveFilters,
    required this.onClearFilters,
  });

  final Map<ExerciseCategory, List<ExerciseMetadata>> exercisesByCategory;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    if (exercisesByCategory.isEmpty) {
      return _EmptyState(
        hasActiveFilters: hasActiveFilters,
        onClearFilters: onClearFilters,
      );
    }

    // Build list items with section headers
    final List<Widget> items = [];

    // Sort categories to show bodyweight first
    final sortedCategories = exercisesByCategory.keys.toList()
      ..sort((a, b) => a.index.compareTo(b.index));

    for (final category in sortedCategories) {
      final exercises = exercisesByCategory[category]!;

      // Add section header
      items.add(_SectionHeader(category: category));

      // Add exercise cards
      for (final exercise in exercises) {
        items.add(_ExerciseCard(exercise: exercise));
      }
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      itemCount: items.length,
      itemBuilder: (context, index) => items[index],
    );
  }
}

/// Empty state when no exercises match filters
class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.hasActiveFilters,
    required this.onClearFilters,
  });

  final bool hasActiveFilters;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              '種目が見つかりません',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (hasActiveFilters) ...[
              const SizedBox(height: AppSpacing.md),
              TextButton.icon(
                onPressed: onClearFilters,
                icon: const Icon(Icons.filter_alt_off),
                label: const Text('フィルタをクリア'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Section header for category grouping
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.category});

  final ExerciseCategory category;

  String get _sectionTitle {
    switch (category) {
      case ExerciseCategory.bodyweight:
        return '自重トレーニング';
      case ExerciseCategory.dumbbell:
        return 'ダンベルトレーニング';
      case ExerciseCategory.all:
        return '全ての種目';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _sectionTitle,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Exercise card widget
class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({required this.exercise});

  final ExerciseMetadata exercise;

  IconData _getExerciseIcon() {
    switch (exercise.type) {
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

  Color _getDifficultyColor(BuildContext context) {
    switch (exercise.difficulty) {
      case ExerciseDifficulty.beginner:
        return Colors.green;
      case ExerciseDifficulty.intermediate:
        return Colors.orange;
      case ExerciseDifficulty.all:
        return Theme.of(context).colorScheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = exercise.displayName;
    final description = exercise.description;
    final bodyParts = exercise.bodyParts.join(' / ');
    final difficultyLabel = exercise.difficulty.displayName;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
      child: Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          onTap: () {
            context.goToExerciseDetail(exercise.type);
          },
          borderRadius: BorderRadius.circular(AppRadius.lg),
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
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: _getDifficultyColor(
                                context,
                              ).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(AppRadius.sm),
                            ),
                            child: Text(
                              difficultyLabel,
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
      ),
    );
  }
}
