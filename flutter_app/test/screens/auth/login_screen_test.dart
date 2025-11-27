import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter_app/screens/auth/login_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('displays login form elements', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

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
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      // Tap login button without entering data
      await tester.tap(find.text('ログイン'));
      await tester.pumpAndSettle();

      // Verify validation errors
      expect(find.text('メールアドレスを入力してください'), findsOneWidget);
      expect(find.text('パスワードを入力してください'), findsOneWidget);
    });

    testWidgets('shows validation error for invalid email', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      // Enter invalid email
      await tester.enterText(find.byType(TextFormField).first, 'invalid-email');
      await tester.enterText(find.byType(TextFormField).at(1), 'password123');

      // Tap login button
      await tester.tap(find.text('ログイン'));
      await tester.pumpAndSettle();

      // Verify email validation error
      expect(find.text('メールアドレスの形式が正しくありません'), findsOneWidget);
    });

    testWidgets('has minimum tap target size for accessibility', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      // Find the login button
      final loginButton = find.widgetWithText(FilledButton, 'ログイン');
      expect(loginButton, findsOneWidget);

      // Verify button size is at least 48dp
      final buttonBox = tester.getSize(loginButton);
      expect(buttonBox.height, greaterThanOrEqualTo(48));
    });
  });
}
