/// Exercise Selection State Tests
///
/// Unit tests for exercise selection state management
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.7)

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter_app/core/form_analyzer/base/base_analyzer.dart';
import 'package:flutter_app/screens/session/exercise_selection_state.dart';

void main() {
  group('ExerciseMetadata', () {
    test('all exercises have correct category assignments', () {
      // Bodyweight exercises
      final bodyweightExercises = allExercises
          .where((e) => e.category == ExerciseCategory.bodyweight)
          .toList();
      expect(bodyweightExercises.length, 2);
      expect(
        bodyweightExercises.map((e) => e.type).toList(),
        containsAll([ExerciseType.squat, ExerciseType.pushUp]),
      );

      // Dumbbell exercises
      final dumbbellExercises = allExercises
          .where((e) => e.category == ExerciseCategory.dumbbell)
          .toList();
      expect(dumbbellExercises.length, 3);
      expect(
        dumbbellExercises.map((e) => e.type).toList(),
        containsAll([
          ExerciseType.armCurl,
          ExerciseType.sideRaise,
          ExerciseType.shoulderPress,
        ]),
      );
    });

    test('all exercises have correct difficulty assignments', () {
      // Beginner exercises
      final beginnerExercises = allExercises
          .where((e) => e.difficulty == ExerciseDifficulty.beginner)
          .toList();
      expect(beginnerExercises.length, 3);
      expect(
        beginnerExercises.map((e) => e.type).toList(),
        containsAll([
          ExerciseType.squat,
          ExerciseType.pushUp,
          ExerciseType.armCurl,
        ]),
      );

      // Intermediate exercises
      final intermediateExercises = allExercises
          .where((e) => e.difficulty == ExerciseDifficulty.intermediate)
          .toList();
      expect(intermediateExercises.length, 2);
      expect(
        intermediateExercises.map((e) => e.type).toList(),
        containsAll([ExerciseType.sideRaise, ExerciseType.shoulderPress]),
      );
    });

    test('exercise metadata provides display information', () {
      final squatMetadata = allExercises.firstWhere(
        (e) => e.type == ExerciseType.squat,
      );

      expect(squatMetadata.displayName, isNotEmpty);
      expect(squatMetadata.description, isNotEmpty);
      expect(squatMetadata.bodyParts, isNotEmpty);
    });
  });

  group('ExerciseSelectionState', () {
    test('initial state has no filters', () {
      const state = ExerciseSelectionState();

      expect(state.searchQuery, isEmpty);
      expect(state.selectedCategory, ExerciseCategory.all);
      expect(state.selectedDifficulty, ExerciseDifficulty.all);
      expect(state.hasActiveFilters, isFalse);
    });

    test('filteredExercises returns all exercises when no filters', () {
      const state = ExerciseSelectionState();

      expect(state.filteredExercises.length, allExercises.length);
    });

    test('search query filters by exercise name', () {
      const state = ExerciseSelectionState(searchQuery: 'スクワット');

      expect(state.filteredExercises.length, 1);
      expect(state.filteredExercises.first.type, ExerciseType.squat);
    });

    test('search query filters by body parts', () {
      const state = ExerciseSelectionState(searchQuery: '肩');

      // Shoulder related exercises
      expect(state.filteredExercises, isNotEmpty);
      expect(
        state.filteredExercises.every(
          (e) => e.bodyParts.any((part) => part.contains('肩')),
        ),
        isTrue,
      );
    });

    test('search is case insensitive', () {
      const state1 = ExerciseSelectionState(searchQuery: 'アームカール');
      const state2 = ExerciseSelectionState(searchQuery: 'アームカール');

      expect(state1.filteredExercises.length, state2.filteredExercises.length);
    });

    test('category filter works correctly', () {
      const bodyweightState = ExerciseSelectionState(
        selectedCategory: ExerciseCategory.bodyweight,
      );
      expect(bodyweightState.filteredExercises.length, 2);
      expect(
        bodyweightState.filteredExercises.every(
          (e) => e.category == ExerciseCategory.bodyweight,
        ),
        isTrue,
      );

      const dumbbellState = ExerciseSelectionState(
        selectedCategory: ExerciseCategory.dumbbell,
      );
      expect(dumbbellState.filteredExercises.length, 3);
      expect(
        dumbbellState.filteredExercises.every(
          (e) => e.category == ExerciseCategory.dumbbell,
        ),
        isTrue,
      );
    });

    test('difficulty filter works correctly', () {
      const beginnerState = ExerciseSelectionState(
        selectedDifficulty: ExerciseDifficulty.beginner,
      );
      expect(beginnerState.filteredExercises.length, 3);
      expect(
        beginnerState.filteredExercises.every(
          (e) => e.difficulty == ExerciseDifficulty.beginner,
        ),
        isTrue,
      );

      const intermediateState = ExerciseSelectionState(
        selectedDifficulty: ExerciseDifficulty.intermediate,
      );
      expect(intermediateState.filteredExercises.length, 2);
      expect(
        intermediateState.filteredExercises.every(
          (e) => e.difficulty == ExerciseDifficulty.intermediate,
        ),
        isTrue,
      );
    });

    test('multiple filters combine correctly', () {
      const state = ExerciseSelectionState(
        selectedCategory: ExerciseCategory.dumbbell,
        selectedDifficulty: ExerciseDifficulty.beginner,
      );

      // Only arm curl is dumbbell + beginner
      expect(state.filteredExercises.length, 1);
      expect(state.filteredExercises.first.type, ExerciseType.armCurl);
    });

    test('search with filters combines correctly', () {
      const state = ExerciseSelectionState(
        searchQuery: 'プレス',
        selectedCategory: ExerciseCategory.dumbbell,
      );

      expect(state.filteredExercises.length, 1);
      expect(state.filteredExercises.first.type, ExerciseType.shoulderPress);
    });

    test('exercisesByCategory groups exercises correctly', () {
      const state = ExerciseSelectionState();

      final grouped = state.exercisesByCategory;

      expect(grouped.containsKey(ExerciseCategory.bodyweight), isTrue);
      expect(grouped.containsKey(ExerciseCategory.dumbbell), isTrue);
      expect(grouped[ExerciseCategory.bodyweight]!.length, 2);
      expect(grouped[ExerciseCategory.dumbbell]!.length, 3);
    });

    test('hasActiveFilters returns true when filters are applied', () {
      const stateWithSearch = ExerciseSelectionState(searchQuery: 'test');
      expect(stateWithSearch.hasActiveFilters, isTrue);

      const stateWithCategory = ExerciseSelectionState(
        selectedCategory: ExerciseCategory.bodyweight,
      );
      expect(stateWithCategory.hasActiveFilters, isTrue);

      const stateWithDifficulty = ExerciseSelectionState(
        selectedDifficulty: ExerciseDifficulty.beginner,
      );
      expect(stateWithDifficulty.hasActiveFilters, isTrue);
    });

    test('copyWith creates new state with updated values', () {
      const original = ExerciseSelectionState();

      final updated = original.copyWith(searchQuery: 'test');

      expect(updated.searchQuery, 'test');
      expect(updated.selectedCategory, original.selectedCategory);
      expect(updated.selectedDifficulty, original.selectedDifficulty);
    });
  });

  group('ExerciseSelectionNotifier', () {
    test('setSearchQuery updates state', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(exerciseSelectionProvider.notifier);

      notifier.setSearchQuery('test');

      final state = container.read(exerciseSelectionProvider);
      expect(state.searchQuery, 'test');
    });

    test('setCategory updates state', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(exerciseSelectionProvider.notifier);

      notifier.setCategory(ExerciseCategory.bodyweight);

      final state = container.read(exerciseSelectionProvider);
      expect(state.selectedCategory, ExerciseCategory.bodyweight);
    });

    test('setDifficulty updates state', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(exerciseSelectionProvider.notifier);

      notifier.setDifficulty(ExerciseDifficulty.intermediate);

      final state = container.read(exerciseSelectionProvider);
      expect(state.selectedDifficulty, ExerciseDifficulty.intermediate);
    });

    test('clearFilters resets all filters', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(exerciseSelectionProvider.notifier);

      // Apply filters
      notifier.setSearchQuery('test');
      notifier.setCategory(ExerciseCategory.bodyweight);
      notifier.setDifficulty(ExerciseDifficulty.beginner);

      // Clear filters
      notifier.clearFilters();

      final state = container.read(exerciseSelectionProvider);
      expect(state.searchQuery, isEmpty);
      expect(state.selectedCategory, ExerciseCategory.all);
      expect(state.selectedDifficulty, ExerciseDifficulty.all);
    });

    test('clearSearch only clears search query', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(exerciseSelectionProvider.notifier);

      // Apply filters
      notifier.setSearchQuery('test');
      notifier.setCategory(ExerciseCategory.bodyweight);

      // Clear search only
      notifier.clearSearch();

      final state = container.read(exerciseSelectionProvider);
      expect(state.searchQuery, isEmpty);
      expect(state.selectedCategory, ExerciseCategory.bodyweight);
    });
  });

  group('ExerciseCategory enum', () {
    test('has correct display names', () {
      expect(ExerciseCategory.all.displayName, '全て');
      expect(ExerciseCategory.bodyweight.displayName, '自重');
      expect(ExerciseCategory.dumbbell.displayName, 'ダンベル');
    });
  });

  group('ExerciseDifficulty enum', () {
    test('has correct display names', () {
      expect(ExerciseDifficulty.all.displayName, '全て');
      expect(ExerciseDifficulty.beginner.displayName, '初級');
      expect(ExerciseDifficulty.intermediate.displayName, '中級');
    });
  });
}
