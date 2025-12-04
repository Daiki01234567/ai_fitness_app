// LoginScreen Widget Tests
//
// Tests for the login screen UI and validation
// Uses mocked providers to avoid Firebase initialization

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';

import 'package:flutter_app/core/auth/auth_state_notifier.dart';
import 'package:flutter_app/screens/auth/login_screen.dart';

import '../../core/auth/mocks/mock_firebase_auth.dart';

void main() {
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
  Widget createTestWidget() {
    return ProviderScope(
      overrides: [
        authStateProvider.overrideWith(
          (ref) => AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore),
        ),
      ],
      child: const MaterialApp(home: LoginScreen()),
    );
  }

  group('LoginScreen', () {
    testWidgets('displays login form elements', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Verify UI elements are present
      expect(find.text('AI Fitness'), findsOneWidget);
      expect(find.text('ログインしてトレーニングを始めましょう'), findsOneWidget);
      expect(find.text('メールアドレス'), findsOneWidget);
      expect(find.text('パスワード'), findsOneWidget);
      expect(find.text('ログイン'), findsOneWidget);
      expect(find.text('パスワードをお忘れですか？'), findsOneWidget);
      expect(find.text('Googleでログイン'), findsOneWidget);
      expect(find.text('Appleでログイン'), findsOneWidget);
      expect(find.text('新規登録'), findsOneWidget);
    });

    testWidgets('shows validation errors for empty fields', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Tap login button without entering data
      await tester.tap(find.text('ログイン'));
      await tester.pumpAndSettle();

      // Verify validation errors
      expect(find.text('メールアドレスを入力してください'), findsOneWidget);
      expect(find.text('パスワードを入力してください'), findsOneWidget);
    });

    testWidgets('shows validation error for invalid email', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Enter invalid email
      await tester.enterText(find.byType(TextFormField).first, 'invalid-email');
      await tester.enterText(find.byType(TextFormField).at(1), 'password123');

      // Tap login button
      await tester.tap(find.text('ログイン'));
      await tester.pumpAndSettle();

      // Verify email validation error
      expect(find.text('メールアドレスの形式が正しくありません'), findsOneWidget);
    });

    testWidgets('has minimum tap target size for accessibility', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Find the login button
      final loginButton = find.widgetWithText(FilledButton, 'ログイン');
      expect(loginButton, findsOneWidget);

      // Verify button size is at least 48dp
      final buttonBox = tester.getSize(loginButton);
      expect(buttonBox.height, greaterThanOrEqualTo(48));
    });
  });
}
