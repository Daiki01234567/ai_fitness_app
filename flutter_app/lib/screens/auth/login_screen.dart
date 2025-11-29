// Login Screen
// Email/password authentication with social login options
//
// @version 1.0.0
// @date 2025-11-26

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/auth_widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isGoogleLoading = false;
  bool _isAppleLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    await ref.read(authStateProvider.notifier).signInWithEmailAndPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isGoogleLoading = true);

    try {
      // TODO: Implement Google Sign In using auth_service.dart
      // await ref.read(authServiceProvider).signInWithGoogle();

      // For now, show not implemented message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Googleログインは準備中です')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isGoogleLoading = false);
      }
    }
  }

  Future<void> _handleAppleSignIn() async {
    setState(() => _isAppleLoading = true);

    try {
      // TODO: Implement Apple Sign In using auth_service.dart
      // await ref.read(authServiceProvider).signInWithApple();

      // For now, show not implemented message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Appleログインは準備中です')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isAppleLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo and title
                    _buildHeader(context),
                    const SizedBox(height: AppSpacing.xxl),

                    // Error message
                    if (authState.error != null) ...[
                      ErrorMessageCard(
                        message: authState.error!,
                        onDismiss: () {
                          ref.read(authStateProvider.notifier).clearError();
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // Email field
                    AuthTextField(
                      controller: _emailController,
                      label: 'メールアドレス',
                      hint: 'example@email.com',
                      prefixIcon: Icons.email_outlined,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      validator: EmailValidator.validate,
                      enabled: !authState.isLoading,
                      autofillHints: const [AutofillHints.email],
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Password field
                    PasswordTextField(
                      controller: _passwordController,
                      validator: PasswordValidator.validate,
                      onFieldSubmitted: (_) => _handleLogin(),
                      enabled: !authState.isLoading,
                      autofillHints: const [AutofillHints.password],
                    ),
                    const SizedBox(height: AppSpacing.sm),

                    // Forgot password link
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: authState.isLoading
                            ? null
                            : () => context.go(AppRoutes.passwordReset),
                        child: const Text('パスワードをお忘れですか？'),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Login button
                    LoadingButton(
                      onPressed: _handleLogin,
                      label: 'ログイン',
                      isLoading: authState.isLoading,
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    // Divider
                    const DividerWithText(text: 'または'),
                    const SizedBox(height: AppSpacing.lg),

                    // Social login buttons
                    SocialSignInButton(
                      onPressed: _handleGoogleSignIn,
                      label: 'Googleでログイン',
                      icon: Icon(
                        Icons.g_mobiledata,
                        size: 24,
                        color: colorScheme.onSurface,
                      ),
                      isLoading: _isGoogleLoading,
                    ),
                    const SizedBox(height: AppSpacing.sm),

                    SocialSignInButton(
                      onPressed: _handleAppleSignIn,
                      label: 'Appleでログイン',
                      icon: Icon(
                        Icons.apple,
                        size: 24,
                        color: colorScheme.onSurface,
                      ),
                      isLoading: _isAppleLoading,
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // Register link
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'アカウントをお持ちでない方は',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        TextButton(
                          onPressed: authState.isLoading
                              ? null
                              : () => context.go(AppRoutes.register),
                          child: const Text('新規登録'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      children: [
        // App logo
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Icon(
            Icons.fitness_center,
            size: 40,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'AI Fitness',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'ログインしてトレーニングを始めましょう',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}
