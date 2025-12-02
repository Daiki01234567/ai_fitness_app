// 認証フォームウィジェット
// 認証画面用の再利用可能なウィジェット
//
// @version 1.0.0
// @date 2025-11-26

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// バリデーション付きカスタムテキストフィールド
class AuthTextField extends StatelessWidget {
  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.prefixIcon,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.validator,
    this.onFieldSubmitted,
    this.onChanged,
    this.enabled = true,
    this.autofillHints,
    this.inputFormatters,
    this.maxLength,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData? prefixIcon;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final String? Function(String?)? validator;
  final void Function(String)? onFieldSubmitted;
  final void Function(String)? onChanged;
  final bool enabled;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: prefixIcon != null ? Icon(prefixIcon) : null,
        counterText: '',
      ),
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      validator: validator,
      onFieldSubmitted: onFieldSubmitted,
      onChanged: onChanged,
      enabled: enabled,
      autofillHints: autofillHints,
      inputFormatters: inputFormatters,
      maxLength: maxLength,
    );
  }
}

/// 表示切替付きパスワードテキストフィールド
class PasswordTextField extends StatefulWidget {
  const PasswordTextField({
    super.key,
    required this.controller,
    this.label = 'パスワード',
    this.hint,
    this.textInputAction = TextInputAction.done,
    this.validator,
    this.onFieldSubmitted,
    this.enabled = true,
    this.autofillHints,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputAction textInputAction;
  final String? Function(String?)? validator;
  final void Function(String)? onFieldSubmitted;
  final bool enabled;
  final Iterable<String>? autofillHints;

  @override
  State<PasswordTextField> createState() => _PasswordTextFieldState();
}

class _PasswordTextFieldState extends State<PasswordTextField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        prefixIcon: const Icon(Icons.lock_outline),
        suffixIcon: IconButton(
          icon: Icon(
            _obscureText ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
          onPressed: () {
            setState(() {
              _obscureText = !_obscureText;
            });
          },
          tooltip: _obscureText ? 'パスワードを表示' : 'パスワードを非表示',
        ),
      ),
      obscureText: _obscureText,
      keyboardType: TextInputType.visiblePassword,
      textInputAction: widget.textInputAction,
      validator: widget.validator,
      onFieldSubmitted: widget.onFieldSubmitted,
      enabled: widget.enabled,
      autofillHints: widget.autofillHints,
    );
  }
}

/// インジケーター付きローディングボタン
class LoadingButton extends StatelessWidget {
  const LoadingButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
    this.style,
  });

  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;
  final IconData? icon;
  final ButtonStyle? style;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: isLoading ? null : onPressed,
      style: style,
      child: isLoading
          ? const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon),
                  const SizedBox(width: 8),
                ],
                Text(label),
              ],
            ),
    );
  }
}

/// アウトライン付きローディングボタン
class OutlinedLoadingButton extends StatelessWidget {
  const OutlinedLoadingButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
    this.style,
  });

  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;
  final IconData? icon;
  final ButtonStyle? style;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: isLoading ? null : onPressed,
      style: style,
      child: isLoading
          ? SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Theme.of(context).colorScheme.primary,
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon),
                  const SizedBox(width: 8),
                ],
                Text(label),
              ],
            ),
    );
  }
}

/// ソーシャルサインインボタン
class SocialSignInButton extends StatelessWidget {
  const SocialSignInButton({
    super.key,
    required this.onPressed,
    required this.label,
    required this.icon,
    this.isLoading = false,
    this.backgroundColor,
    this.foregroundColor,
  });

  final VoidCallback? onPressed;
  final String label;
  final Widget icon;
  final bool isLoading;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: isLoading ? null : onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: backgroundColor,
        foregroundColor: foregroundColor,
        minimumSize: const Size(double.infinity, AppSpacing.minTapTarget),
      ),
      child: isLoading
          ? SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: foregroundColor ?? Theme.of(context).colorScheme.primary,
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: icon,
                ),
                const SizedBox(width: 12),
                Text(label),
              ],
            ),
    );
  }
}

/// テキスト付き区切り線
class DividerWithText extends StatelessWidget {
  const DividerWithText({
    super.key,
    required this.text,
  });

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
        const Expanded(child: Divider()),
      ],
    );
  }
}

/// エラーメッセージカード
class ErrorMessageCard extends StatelessWidget {
  const ErrorMessageCard({
    super.key,
    required this.message,
    this.onDismiss,
  });

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.error_outline,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
              ),
            ),
            if (onDismiss != null)
              IconButton(
                onPressed: onDismiss,
                icon: Icon(
                  Icons.close,
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
                tooltip: '閉じる',
              ),
          ],
        ),
      ),
    );
  }
}

/// 成功メッセージカード
class SuccessMessageCard extends StatelessWidget {
  const SuccessMessageCard({
    super.key,
    required this.message,
    this.onDismiss,
  });

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      color: colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.check_circle_outline,
              color: colorScheme.primary,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  color: colorScheme.onPrimaryContainer,
                ),
              ),
            ),
            if (onDismiss != null)
              IconButton(
                onPressed: onDismiss,
                icon: Icon(
                  Icons.close,
                  color: colorScheme.onPrimaryContainer,
                ),
                tooltip: '閉じる',
              ),
          ],
        ),
      ),
    );
  }
}
