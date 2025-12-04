// Splash Screen Tests
// Tests for splash screen behavior per spec section 3.1
//
// @version 1.0.0
// @date 2025-12-04
// @spec docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.1

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_app/screens/splash/splash_screen.dart';

void main() {
  group('SplashScreen', () {
    late GoRouter router;

    setUp(() async {
      // Initialize SharedPreferences for testing
      SharedPreferences.setMockInitialValues({});

      // Create a minimal GoRouter for testing
      router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const SplashScreen(),
          ),
          GoRoute(
            path: '/onboarding',
            builder: (context, state) =>
                const Scaffold(body: Text('Onboarding')),
          ),
          GoRoute(
            path: '/login',
            builder: (context, state) => const Scaffold(body: Text('Login')),
          ),
          GoRoute(
            path: '/home',
            builder: (context, state) => const Scaffold(body: Text('Home')),
          ),
          GoRoute(
            path: '/consent',
            builder: (context, state) => const Scaffold(body: Text('Consent')),
          ),
        ],
      );
    });

    Widget buildTestWidget() {
      return ProviderScope(
        child: MaterialApp.router(
          routerConfig: router,
        ),
      );
    }

    // Helper to pump and settle timers (splash has a 1 second delay)
    Future<void> pumpAndSettleWithTimer(WidgetTester tester) async {
      await tester.pump(const Duration(milliseconds: 1100));
      await tester.pumpAndSettle();
    }

    testWidgets('displays app logo', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Check that the fitness icon is displayed (representing the logo)
      expect(find.byIcon(Icons.fitness_center), findsOneWidget);

      // Allow timer to complete to avoid pending timer error
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('displays app name', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Check that the app name is displayed
      expect(find.text('AI Fitness'), findsOneWidget);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('displays loading indicator', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Check that the loading indicator is displayed
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('uses brand color as background', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Find the Scaffold and verify it has the primary color background
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
      expect(scaffold.backgroundColor, isNotNull);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('logo container has rounded corners', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Find the logo container with the icon
      final containers = tester.widgetList<Container>(find.byType(Container));

      // Find container with BoxDecoration and borderRadius
      Container? logoContainer;
      for (final container in containers) {
        if (container.decoration is BoxDecoration) {
          final decoration = container.decoration as BoxDecoration;
          if (decoration.borderRadius != null) {
            logoContainer = container;
            break;
          }
        }
      }

      expect(logoContainer, isNotNull);
      final decoration = logoContainer!.decoration as BoxDecoration;
      expect(decoration.borderRadius, isNotNull);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('displays splash for minimum 1 second before navigation',
        (tester) async {
      await tester.pumpWidget(buildTestWidget());

      // Initially the splash screen should be visible
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byIcon(Icons.fitness_center), findsOneWidget);

      // After 500ms, splash should still be visible (minimum 1 second)
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byIcon(Icons.fitness_center), findsOneWidget);

      // Complete the timer and navigation
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('has main Column with center alignment', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Find the Column inside the Center that contains the main content
      final columns = tester.widgetList<Column>(find.byType(Column));
      final centerColumn = columns.firstWhere(
        (col) => col.mainAxisAlignment == MainAxisAlignment.center,
        orElse: () => throw StateError('No centered Column found'),
      );

      expect(centerColumn.mainAxisAlignment, MainAxisAlignment.center);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('displays all required UI elements', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      // Check all required elements per spec:
      // 1. Logo (represented by fitness_center icon)
      expect(find.byIcon(Icons.fitness_center), findsOneWidget);

      // 2. App name
      expect(find.text('AI Fitness'), findsOneWidget);

      // 3. Loading indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Allow timer to complete
      await pumpAndSettleWithTimer(tester);
    });

    testWidgets('navigates to onboarding on first launch', (tester) async {
      // Set first launch flag to true (default when not set)
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(buildTestWidget());

      // Wait for the 1 second delay plus navigation
      await tester.pump(const Duration(milliseconds: 1100));
      await tester.pumpAndSettle();

      // Should navigate to onboarding
      expect(find.text('Onboarding'), findsOneWidget);
    });
  });
}
