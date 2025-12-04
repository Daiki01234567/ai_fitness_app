// AI Fitness App - Basic Widget Tests
//
// Basic smoke tests for the application components.
// For comprehensive tests, see individual test files in:
// - test/core/auth/
// - test/core/pose/
// - test/core/form_analyzer/
// - test/screens/
// - test/integration/

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';

import 'package:flutter_app/core/auth/auth_state_notifier.dart';
import 'package:flutter_app/screens/auth/login_screen.dart';
import 'package:flutter_app/core/theme/app_theme.dart';

import 'core/auth/mocks/mock_firebase_auth.dart';

void main() {
  group('App Smoke Tests', () {
    late MockFirebaseAuth mockAuth;
    late FakeFirebaseFirestore fakeFirestore;

    setUp(() {
      mockAuth = MockFirebaseAuth();
      fakeFirestore = FakeFirebaseFirestore();
    });

    tearDown(() {
      mockAuth.dispose();
    });

    /// Creates a testable widget with mocked providers
    Widget createTestableLoginScreen() {
      return ProviderScope(
        overrides: [
          authStateProvider.overrideWith(
            (ref) =>
                AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore),
          ),
        ],
        child: MaterialApp(
          title: 'AI Fitness',
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      );
    }

    testWidgets('LoginScreen renders correctly', (WidgetTester tester) async {
      // Build the login screen widget
      await tester.pumpWidget(createTestableLoginScreen());
      await tester.pumpAndSettle();

      // Verify that the app title is displayed
      expect(find.text('AI Fitness'), findsOneWidget);

      // Verify that core UI elements are present
      expect(find.text('ログイン'), findsOneWidget);
      expect(find.text('メールアドレス'), findsOneWidget);
      expect(find.text('パスワード'), findsOneWidget);
    });

    testWidgets('AppTheme provides correct theme data', (
      WidgetTester tester,
    ) async {
      // Verify light theme configuration
      expect(AppTheme.lightTheme.useMaterial3, isTrue);
      expect(AppTheme.lightTheme.brightness, Brightness.light);

      // Verify dark theme configuration
      expect(AppTheme.darkTheme.useMaterial3, isTrue);
      expect(AppTheme.darkTheme.brightness, Brightness.dark);
    });
  });
}
