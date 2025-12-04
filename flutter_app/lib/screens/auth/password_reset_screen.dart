// Password Reset Screen
// Send password reset email
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

class PasswordResetScreen extends ConsumerStatefulWidget {
  const PasswordResetScreen({super.key});

  @override
  ConsumerState<PasswordResetScreen> createState() =>
      _PasswordResetScreenState();
}

class _PasswordResetScreenState extends ConsumerState<PasswordResetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _emailSent = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleResetPassword() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    await ref
        .read(authStateProvider.notifier)
        .sendPasswordResetEmail(_emailController.text.trim());

    // Check if the request was successful (no error or success message)
    final authState = ref.read(authStateProvider);
    if (authState.error?.contains('送信しました') == true) {
      setState(() {
        _emailSent = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(AppRoutes.login),
        ),
        title: const Text('パスワードリセット'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: _emailSent
                  ? _buildSuccessView()
                  : _buildFormView(authState),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFormView(AuthState authState) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Icon
          Icon(
            Icons.lock_reset,
            size: 64,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.lg),

          // Title
          Text(
            'パスワードをお忘れですか？',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),

          // Description
          Text(
            '登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),

          // Error/Success message
          if (authState.error != null &&
              !authState.error!.contains('送信しました')) ...[
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
            textInputAction: TextInputAction.done,
            validator: EmailValidator.validate,
            onFieldSubmitted: (_) => _handleResetPassword(),
            enabled: !authState.isLoading,
            autofillHints: const [AutofillHints.email],
          ),
          const SizedBox(height: AppSpacing.lg),

          // Reset button
          LoadingButton(
            onPressed: _handleResetPassword,
            label: 'リセットメールを送信',
            isLoading: authState.isLoading,
          ),
          const SizedBox(height: AppSpacing.lg),

          // Back to login link
          TextButton(
            onPressed: authState.isLoading
                ? null
                : () => context.go(AppRoutes.login),
            child: const Text('ログイン画面に戻る'),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Success icon
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: colorScheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.mark_email_read_outlined,
            size: 40,
            color: colorScheme.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Title
        Text(
          'メールを送信しました',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.md),

        // Description
        Text(
          '${_emailController.text} 宛にパスワードリセット用のメールを送信しました。\n\nメール内のリンクをクリックして、新しいパスワードを設定してください。',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xl),

        // Info card
        Card(
          color: colorScheme.surfaceContainerHighest,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: colorScheme.onSurfaceVariant),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'メールが届かない場合は、迷惑メールフォルダをご確認ください。',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        // Return to login button
        FilledButton(
          onPressed: () => context.go(AppRoutes.login),
          child: const Text('ログイン画面に戻る'),
        ),
        const SizedBox(height: AppSpacing.md),

        // Resend button
        OutlinedButton(
          onPressed: () {
            setState(() {
              _emailSent = false;
            });
          },
          child: const Text('別のメールアドレスで送信'),
        ),
      ],
    );
  }
}
