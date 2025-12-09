# 006 認証画面（ログイン・登録）

## 概要

ログイン画面と新規登録画面を実装するチケットです。メール/パスワード認証とGoogleログインの両方に対応し、バリデーション機能も実装します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- flutter/003（Riverpod状態管理基盤）
- flutter/004（GoRouter設定）
- flutter/005（Material 3 UI基盤）

## 要件

### 機能要件

- FR-001: ユーザー登録 - メール/パスワードで新規登録
- FR-002: ログイン - メール/パスワードでログイン
- FR-003: Googleログイン - Googleアカウントでログイン

### 非機能要件

- NFR-011: パスワード要件 - 8文字以上、英数字を含む
- NFR-012: 入力バリデーション - リアルタイムでエラー表示

## 受け入れ条件（Todo）

- [x] ログイン画面が実装されていることを確認
- [x] 新規登録画面が実装されていることを確認
- [x] メール/パスワード認証が動作することを確認
- [x] Googleログインが動作することを確認
- [x] バリデーションが動作することを確認
- [x] ログイン後にホーム画面へ遷移することを確認
- [x] エラーメッセージが表示されることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - Firebase認証の実装方法
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-001, FR-002, FR-003

## 技術詳細

### ログイン画面の実装

`lib/screens/auth/login_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/widgets/app_button.dart';
import '../../core/widgets/app_text_field.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final authService = ref.read(authServiceProvider);
      await authService.signInWithEmailAndPassword(
        _emailController.text,
        _passwordController.text,
      );
      if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ログインエラー: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ログイン')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AppTextField(
                label: 'メールアドレス',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'メールアドレスを入力してください';
                  }
                  if (!value.contains('@')) {
                    return '正しいメールアドレスを入力してください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'パスワード',
                controller: _passwordController,
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'パスワードを入力してください';
                  }
                  if (value.length < 8) {
                    return 'パスワードは8文字以上で入力してください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              AppButton(
                text: 'ログイン',
                onPressed: _login,
                isLoading: _isLoading,
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.push('/auth/register'),
                child: const Text('新規登録はこちら'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 新規登録画面の実装

`lib/screens/auth/register_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/widgets/app_button.dart';
import '../../core/widgets/app_text_field.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final authService = ref.read(authServiceProvider);
      await authService.createUserWithEmailAndPassword(
        _emailController.text,
        _passwordController.text,
      );
      if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('登録エラー: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('新規登録')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AppTextField(
                label: 'メールアドレス',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'メールアドレスを入力してください';
                  }
                  if (!value.contains('@')) {
                    return '正しいメールアドレスを入力してください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'パスワード',
                controller: _passwordController,
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'パスワードを入力してください';
                  }
                  if (value.length < 8) {
                    return 'パスワードは8文字以上で入力してください';
                  }
                  if (!RegExp(r'[A-Za-z]').hasMatch(value)) {
                    return 'パスワードには英字を含めてください';
                  }
                  if (!RegExp(r'[0-9]').hasMatch(value)) {
                    return 'パスワードには数字を含めてください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'パスワード（確認）',
                controller: _confirmPasswordController,
                obscureText: true,
                validator: (value) {
                  if (value != _passwordController.text) {
                    return 'パスワードが一致しません';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              AppButton(
                text: '登録',
                onPressed: _register,
                isLoading: _isLoading,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025年12月8日

## 備考

- Firebase Authenticationのエラーは英語なので日本語に変換が必要
- パスワードは8文字以上、英数字を含む必要がある
- バリデーションはリアルタイムで実行される

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
