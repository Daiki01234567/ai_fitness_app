// Onboarding Screen Tests
// Tests for onboarding screen behavior per spec section 3.2
//
// @version 1.0.0
// @date 2025-12-04
// @spec docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.2

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_app/screens/onboarding/onboarding_screen.dart';

void main() {
  group('OnboardingScreen', () {
    setUp(() async {
      // Initialize SharedPreferences for testing
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('displays 3 pages', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Check that PageView is present
      expect(find.byType(PageView), findsOneWidget);
    });

    testWidgets('displays page 1 content - medical disclaimer', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Check page 1 content - medical device disclaimer
      expect(find.text('本サービスは医療機器ではありません'), findsOneWidget);
      expect(find.text('参考情報としてご利用ください'), findsOneWidget);
      expect(find.text('医学的な判断は行いません'), findsOneWidget);
      expect(find.text('最終的な判断はご自身でお願いします'), findsOneWidget);
    });

    testWidgets('displays skip button on page 1', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Check that skip button is present on first page
      expect(find.text('スキップ'), findsOneWidget);
    });

    testWidgets('displays next button on page 1', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Check that next button shows correct text
      expect(find.text('次へ'), findsOneWidget);
    });

    testWidgets('can swipe to page 2', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 2
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check page 2 content - AI form check
      expect(find.text('AIがあなたのフォームを確認補助'), findsOneWidget);
      expect(find.text('カメラでフォームをチェック'), findsOneWidget);
      expect(find.text('音声で参考情報を提供'), findsOneWidget);
      expect(find.text('映像はデバイス内で処理'), findsOneWidget);
    });

    testWidgets('displays skip button on page 2', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 2
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check that skip button is present on second page
      expect(find.text('スキップ'), findsOneWidget);
    });

    testWidgets('can swipe to page 3', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 2
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Swipe to page 3
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check page 3 content - pricing
      expect(find.text('月額500円で始められる'), findsOneWidget);
      expect(find.text('1週間無料トライアル'), findsOneWidget);
      expect(find.text('いつでもキャンセル可能'), findsOneWidget);
    });

    testWidgets('page 3 shows start button instead of next', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 3
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check that start button is shown
      expect(find.text('始める'), findsOneWidget);
      expect(find.text('次へ'), findsNothing);
    });

    testWidgets('page 3 does not show skip button', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 3
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check that skip button is not shown on last page
      expect(find.text('スキップ'), findsNothing);
    });

    testWidgets('next button navigates to next page', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Tap next button
      await tester.tap(find.text('次へ'));
      await tester.pumpAndSettle();

      // Verify we're on page 2
      expect(find.text('AIがあなたのフォームを確認補助'), findsOneWidget);
    });

    testWidgets('displays page indicator dots', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Find AnimatedContainer widgets used for page indicators
      // There should be 3 dots
      final animatedContainers = find.byType(AnimatedContainer);
      expect(animatedContainers, findsNWidgets(3));
    });

    testWidgets('page indicator updates on page change', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Get initial state of indicators
      final initialIndicators = tester.widgetList<AnimatedContainer>(
        find.byType(AnimatedContainer),
      ).toList();

      // First indicator should be wider (active)
      expect(initialIndicators[0].constraints?.maxWidth, 24);
      expect(initialIndicators[1].constraints?.maxWidth, 8);
      expect(initialIndicators[2].constraints?.maxWidth, 8);

      // Swipe to page 2
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Check updated indicators
      final updatedIndicators = tester.widgetList<AnimatedContainer>(
        find.byType(AnimatedContainer),
      ).toList();

      // Second indicator should now be wider (active)
      expect(updatedIndicators[0].constraints?.maxWidth, 8);
      expect(updatedIndicators[1].constraints?.maxWidth, 24);
      expect(updatedIndicators[2].constraints?.maxWidth, 8);
    });

    testWidgets('has correct icon on page 1', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      expect(find.byIcon(Icons.health_and_safety_outlined), findsOneWidget);
    });

    testWidgets('has correct icon on page 2', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 2
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.camera_alt_outlined), findsOneWidget);
    });

    testWidgets('has correct icon on page 3', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnboardingScreen(),
          ),
        ),
      );

      // Swipe to page 3
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.savings_outlined), findsOneWidget);
    });
  });
}
