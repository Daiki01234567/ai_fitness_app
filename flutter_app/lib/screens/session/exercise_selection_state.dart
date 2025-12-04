/// Exercise Selection State
///
/// State management for the exercise selection screen with search and filter functionality.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.7)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/form_analyzer/base/base_analyzer.dart';
import '../../core/form_analyzer/analyzer_factory.dart';

/// Exercise category for filtering
enum ExerciseCategory {
  all('全て'),
  bodyweight('自重'),
  dumbbell('ダンベル');

  const ExerciseCategory(this.displayName);
  final String displayName;
}

/// Exercise difficulty for filtering
enum ExerciseDifficulty {
  all('全て'),
  beginner('初級'),
  intermediate('中級');

  const ExerciseDifficulty(this.displayName);
  final String displayName;
}

/// Exercise metadata with category and difficulty information
class ExerciseMetadata {
  const ExerciseMetadata({
    required this.type,
    required this.category,
    required this.difficulty,
  });

  final ExerciseType type;
  final ExerciseCategory category;
  final ExerciseDifficulty difficulty;

  /// Get display name from AnalyzerFactory
  String get displayName => AnalyzerFactory.getDisplayName(type);

  /// Get description from AnalyzerFactory
  String get description => AnalyzerFactory.getDescription(type);

  /// Get key body parts from AnalyzerFactory
  List<String> get bodyParts => AnalyzerFactory.getKeyBodyParts(type);
}

/// All exercises with their metadata
/// Reference: Task specification for category/difficulty classification
const List<ExerciseMetadata> allExercises = [
  // Bodyweight exercises
  ExerciseMetadata(
    type: ExerciseType.squat,
    category: ExerciseCategory.bodyweight,
    difficulty: ExerciseDifficulty.beginner,
  ),
  ExerciseMetadata(
    type: ExerciseType.pushUp,
    category: ExerciseCategory.bodyweight,
    difficulty: ExerciseDifficulty.beginner,
  ),
  // Dumbbell exercises
  ExerciseMetadata(
    type: ExerciseType.armCurl,
    category: ExerciseCategory.dumbbell,
    difficulty: ExerciseDifficulty.beginner,
  ),
  ExerciseMetadata(
    type: ExerciseType.sideRaise,
    category: ExerciseCategory.dumbbell,
    difficulty: ExerciseDifficulty.intermediate,
  ),
  ExerciseMetadata(
    type: ExerciseType.shoulderPress,
    category: ExerciseCategory.dumbbell,
    difficulty: ExerciseDifficulty.intermediate,
  ),
];

/// State for exercise selection screen
class ExerciseSelectionState {
  const ExerciseSelectionState({
    this.searchQuery = '',
    this.selectedCategory = ExerciseCategory.all,
    this.selectedDifficulty = ExerciseDifficulty.all,
  });

  final String searchQuery;
  final ExerciseCategory selectedCategory;
  final ExerciseDifficulty selectedDifficulty;

  /// Get filtered exercises based on current filters
  List<ExerciseMetadata> get filteredExercises {
    return allExercises.where((exercise) {
      // Apply search filter
      if (searchQuery.isNotEmpty) {
        final query = searchQuery.toLowerCase();
        final nameMatch = exercise.displayName.toLowerCase().contains(query);
        final bodyPartsMatch = exercise.bodyParts.any(
          (part) => part.toLowerCase().contains(query),
        );
        if (!nameMatch && !bodyPartsMatch) {
          return false;
        }
      }

      // Apply category filter
      if (selectedCategory != ExerciseCategory.all &&
          exercise.category != selectedCategory) {
        return false;
      }

      // Apply difficulty filter
      if (selectedDifficulty != ExerciseDifficulty.all &&
          exercise.difficulty != selectedDifficulty) {
        return false;
      }

      return true;
    }).toList();
  }

  /// Get exercises grouped by category for sectioned display
  Map<ExerciseCategory, List<ExerciseMetadata>> get exercisesByCategory {
    final exercises = filteredExercises;
    final grouped = <ExerciseCategory, List<ExerciseMetadata>>{};

    for (final exercise in exercises) {
      final category = exercise.category;
      if (!grouped.containsKey(category)) {
        grouped[category] = [];
      }
      grouped[category]!.add(exercise);
    }

    return grouped;
  }

  /// Check if any filters are active
  bool get hasActiveFilters =>
      searchQuery.isNotEmpty ||
      selectedCategory != ExerciseCategory.all ||
      selectedDifficulty != ExerciseDifficulty.all;

  ExerciseSelectionState copyWith({
    String? searchQuery,
    ExerciseCategory? selectedCategory,
    ExerciseDifficulty? selectedDifficulty,
  }) {
    return ExerciseSelectionState(
      searchQuery: searchQuery ?? this.searchQuery,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      selectedDifficulty: selectedDifficulty ?? this.selectedDifficulty,
    );
  }
}

/// State notifier for exercise selection
class ExerciseSelectionNotifier extends StateNotifier<ExerciseSelectionState> {
  ExerciseSelectionNotifier() : super(const ExerciseSelectionState());

  /// Update search query
  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  /// Update category filter
  void setCategory(ExerciseCategory category) {
    state = state.copyWith(selectedCategory: category);
  }

  /// Update difficulty filter
  void setDifficulty(ExerciseDifficulty difficulty) {
    state = state.copyWith(selectedDifficulty: difficulty);
  }

  /// Clear all filters
  void clearFilters() {
    state = const ExerciseSelectionState();
  }

  /// Clear search query only
  void clearSearch() {
    state = state.copyWith(searchQuery: '');
  }
}

/// Provider for exercise selection state
final exerciseSelectionProvider =
    StateNotifierProvider<ExerciseSelectionNotifier, ExerciseSelectionState>(
      (ref) => ExerciseSelectionNotifier(),
    );
