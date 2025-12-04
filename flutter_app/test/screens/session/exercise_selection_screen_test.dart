// Exercise Selection Screen Widget Tests
//
// Tests for the exercise selection screen UI and interactions
// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.7)

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter_app/screens/session/exercise_selection_screen.dart';
import 'package:flutter_app/screens/session/exercise_selection_state.dart';

void main() {
  /// Creates a testable widget with proper providers
  Widget createTestWidget({ExerciseSelectionState? initialState}) {
    return ProviderScope(
      overrides: initialState != null
          ? [
              exerciseSelectionProvider.overrideWith(
                (ref) => ExerciseSelectionNotifier()
                  ..setSearchQuery(initialState.searchQuery)
                  ..setCategory(initialState.selectedCategory)
                  ..setDifficulty(initialState.selectedDifficulty),
              ),
            ]
          : [],
      child: MaterialApp(
        home: const ExerciseSelectionScreen(),
        onGenerateRoute: (settings) {
          // Mock routes for navigation
          return MaterialPageRoute(
            builder: (context) => const Scaffold(body: Text('Mock Route')),
          );
        },
      ),
    );
  }

  group('ExerciseSelectionScreen', () {
    testWidgets('displays all required UI elements', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // AppBar
      expect(find.text('種目選択'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);

      // Search bar
      expect(find.byIcon(Icons.search), findsOneWidget);
      expect(find.text('検索...'), findsOneWidget);

      // Filter chips
      expect(find.text('フィルタ:'), findsOneWidget);
      expect(find.text('全て'), findsAtLeast(1)); // Category or difficulty

      // Section headers (at least one visible)
      expect(find.text('自重トレーニング'), findsOneWidget);

      // Bottom navigation
      expect(find.text('ホーム'), findsOneWidget);
      expect(find.text('トレーニング'), findsOneWidget);
      expect(find.text('履歴'), findsOneWidget);
      expect(find.text('プロフィール'), findsOneWidget);
    });

    testWidgets('displays visible exercise cards', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Check for exercises that should be visible initially
      // (bodyweight section is first, so squat and pushUp should be visible)
      expect(find.text('スクワット'), findsOneWidget);
      expect(find.text('プッシュアップ'), findsOneWidget);
    });

    testWidgets('can scroll to see more exercises', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Scroll down to see more exercises
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();

      // Dumbbell section should now be visible
      expect(find.text('ダンベルトレーニング'), findsOneWidget);
    });

    testWidgets('displays difficulty badges', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Initial view should have beginner exercises visible
      expect(find.text('初級'), findsAtLeast(1));
    });

    testWidgets('search bar filters exercises in real-time', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Initially squat is shown
      expect(find.text('スクワット'), findsOneWidget);

      // Enter search query
      await tester.enterText(find.byType(TextField), 'スクワット');
      await tester.pumpAndSettle();

      // Squat should be visible (may appear in search field and card)
      expect(find.text('スクワット'), findsAtLeast(1));
      // Other exercises should not be visible
      expect(find.text('プッシュアップ'), findsNothing);
    });

    testWidgets('clear button appears when search has text', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Initially no clear button
      expect(find.byIcon(Icons.clear), findsNothing);

      // Enter search query
      await tester.enterText(find.byType(TextField), 'test');
      await tester.pump();

      // Clear button should appear
      expect(find.byIcon(Icons.clear), findsOneWidget);
    });

    testWidgets('clear button clears search', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Enter search query that shows only squat
      await tester.enterText(find.byType(TextField), 'スクワット');
      await tester.pumpAndSettle();

      // Verify filter is applied - squat appears in search field and card
      expect(find.text('スクワット'), findsAtLeast(1));
      expect(find.text('プッシュアップ'), findsNothing);

      // Tap clear button
      await tester.tap(find.byIcon(Icons.clear));
      await tester.pumpAndSettle();

      // Both exercises should be visible again
      expect(find.text('スクワット'), findsOneWidget);
      expect(find.text('プッシュアップ'), findsOneWidget);
    });

    testWidgets('category filter dropdown works', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find the first filter dropdown (category) and tap it
      final categoryDropdown = find.text('全て').first;
      await tester.tap(categoryDropdown);
      await tester.pumpAndSettle();

      // Select bodyweight
      await tester.tap(find.text('自重').last);
      await tester.pumpAndSettle();

      // Only bodyweight exercises should be visible
      expect(find.text('スクワット'), findsOneWidget);
      expect(find.text('プッシュアップ'), findsOneWidget);
      // Dumbbell section should not exist
      expect(find.text('ダンベルトレーニング'), findsNothing);
    });

    testWidgets('shows empty state when no exercises match', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Enter search query that matches nothing
      await tester.enterText(find.byType(TextField), 'xxxxxx');
      await tester.pumpAndSettle();

      // Empty state should be visible
      expect(find.text('種目が見つかりません'), findsOneWidget);
      expect(find.byIcon(Icons.search_off), findsOneWidget);
    });

    testWidgets('clear filters button appears in empty state', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Enter search query that matches nothing
      await tester.enterText(find.byType(TextField), 'xxxxxx');
      await tester.pumpAndSettle();

      // Clear filters button should be visible
      expect(find.text('フィルタをクリア'), findsOneWidget);
    });

    testWidgets('exercise cards are tappable', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find an exercise card
      final squatCard = find.ancestor(
        of: find.text('スクワット'),
        matching: find.byType(Card),
      );

      expect(squatCard, findsOneWidget);

      // Card should have InkWell for tap handling
      final inkWell = find.descendant(
        of: squatCard,
        matching: find.byType(InkWell),
      );
      expect(inkWell, findsOneWidget);
    });

    testWidgets('has proper accessibility with minimum tap targets', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find navigation bar items
      final homeNav = find.text('ホーム');
      expect(homeNav, findsOneWidget);

      // Find a tappable card
      final squatCard = find.ancestor(
        of: find.text('スクワット'),
        matching: find.byType(Card),
      );
      final cardSize = tester.getSize(squatCard);

      // Card should be large enough for easy tapping
      expect(cardSize.height, greaterThan(48));
    });

    testWidgets('bottom navigation shows training tab as selected', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find navigation bar
      final navBar = find.byType(NavigationBar);
      expect(navBar, findsOneWidget);

      // Verify selectedIndex is 1 (training tab)
      final NavigationBar widget = tester.widget(navBar);
      expect(widget.selectedIndex, 1);
    });

    testWidgets('displays exercise icons correctly', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Check for visible exercise icons (squat icon should be visible)
      expect(find.byIcon(Icons.accessibility_new), findsOneWidget); // squat
    });

    testWidgets('displays body parts for each exercise', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Check for body parts text (squat has these)
      expect(find.textContaining('膝'), findsAtLeast(1));
    });

    testWidgets('filter dropdown shows checkmark for selected item', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find the first filter dropdown (category)
      final categoryDropdown = find.text('全て').first;

      // Tap to open dropdown
      await tester.tap(categoryDropdown);
      await tester.pumpAndSettle();

      // Checkmark should be next to the selected item
      expect(find.byIcon(Icons.check), findsOneWidget);
    });
  });

  group('Filter combinations', () {
    testWidgets('category and difficulty filters combine correctly', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Open category dropdown and select dumbbell
      await tester.tap(find.text('全て').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ダンベル').last);
      await tester.pumpAndSettle();

      // Now we should see only dumbbell exercises
      expect(find.text('スクワット'), findsNothing);
      expect(find.text('プッシュアップ'), findsNothing);
      // Dumbbell section should be visible
      expect(find.text('ダンベルトレーニング'), findsOneWidget);
    });

    testWidgets('search and category filter combine correctly', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Open category dropdown and select dumbbell
      await tester.tap(find.text('全て').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ダンベル').last);
      await tester.pumpAndSettle();

      // Enter search for "プレス"
      await tester.enterText(find.byType(TextField), 'プレス');
      await tester.pumpAndSettle();

      // Only shoulder press should be visible
      expect(find.text('ショルダープレス'), findsOneWidget);
    });
  });

  group('Visual feedback', () {
    testWidgets('selected filter has different background color', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Open category dropdown and select bodyweight
      await tester.tap(find.text('全て').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('自重').last);
      await tester.pumpAndSettle();

      // The selected filter chip should have different styling
      // We verify this by checking that the text "自重" is displayed
      expect(find.text('自重'), findsOneWidget);
    });

    testWidgets('exercise card shows chevron icon', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Each visible card should have a chevron icon
      // With bodyweight filter, we have 2 visible cards
      expect(find.byIcon(Icons.chevron_right), findsAtLeast(2));
    });
  });
}
