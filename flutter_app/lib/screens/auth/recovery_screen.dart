// アカウント復元画面
// 削除予定のアカウントを復元するためのGDPR対応機能
//
// 仕様: FR-025 データ削除権（忘れられる権利）
// 参照: docs/tickets/015_data_export_deletion.md
//
// @version 1.0.0
// @date 2025-11-30

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/gdpr/gdpr_state.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/validators.dart';

/// Account recovery screen widget
///
/// Allows users to recover their account during the 30-day grace period
/// after requesting deletion.
class RecoveryScreen extends ConsumerStatefulWidget {
  const RecoveryScreen({super.key});

  @override
  ConsumerState<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends ConsumerState<RecoveryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _dateFormat = DateFormat('yyyy/MM/dd HH:mm');

  bool _codeSent = false;
  bool _isLoading = false;
  String? _error;
  DateTime? _recoveryDeadline;
  Timer? _countdownTimer;
  Duration _remainingTime = Duration.zero;

  @override
  void initState() {
    super.initState();
    _startCountdownTimer();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  /// Start countdown timer for recovery deadline
  void _startCountdownTimer() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_recoveryDeadline != null) {
        final remaining = _recoveryDeadline!.difference(DateTime.now());
        if (remaining.isNegative) {
          setState(() {
            _remainingTime = Duration.zero;
          });
          _countdownTimer?.cancel();
        } else {
          setState(() {
            _remainingTime = remaining;
          });
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final recoveryState = ref.watch(accountRecoveryNotifierProvider);

    // Update local state from provider
    if (recoveryState.error != null && _error != recoveryState.error) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        setState(() {
          _error = recoveryState.error;
        });
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('アカウント復元'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(AppRoutes.login),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Info card
                _buildInfoCard(context),
                const SizedBox(height: AppSpacing.lg),

                // Recovery deadline display
                if (_recoveryDeadline != null) ...[
                  _buildDeadlineCard(context),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Step indicator
                _buildStepIndicator(context),
                const SizedBox(height: AppSpacing.lg),

                // Email input (Step 1)
                _buildEmailSection(context, recoveryState),
                const SizedBox(height: AppSpacing.lg),

                // Code input (Step 2)
                if (_codeSent) ...[
                  _buildCodeSection(context, recoveryState),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Error message
                if (_error != null) ...[
                  _buildErrorMessage(context, _error!),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Action buttons
                _buildActionButtons(context, recoveryState),

                const SizedBox(height: AppSpacing.xl),

                // Help section
                _buildHelpSection(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.restore,
              size: 32,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'アカウントの復元',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '削除予定のアカウントを30日以内であれば復元できます。'
                    'メールアドレスを入力して復元コードを取得してください。',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeadlineCard(BuildContext context) {
    final isExpired =
        _remainingTime.isNegative || _remainingTime == Duration.zero;

    return Card(
      color: isExpired
          ? Theme.of(context).colorScheme.errorContainer
          : Theme.of(context).colorScheme.tertiaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Icon(
              isExpired ? Icons.timer_off : Icons.timer,
              size: 32,
              color: isExpired
                  ? Theme.of(context).colorScheme.error
                  : Theme.of(context).colorScheme.tertiary,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              isExpired ? '復元期限切れ' : '復元可能期限',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: isExpired
                    ? Theme.of(context).colorScheme.onErrorContainer
                    : Theme.of(context).colorScheme.onTertiaryContainer,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            if (!isExpired) ...[
              Text(
                _dateFormat.format(_recoveryDeadline!),
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(context).colorScheme.onTertiaryContainer,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                _formatRemainingTime(_remainingTime),
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.tertiary,
                ),
              ),
            ] else
              Text(
                'このアカウントは復元できません',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatRemainingTime(Duration duration) {
    final days = duration.inDays;
    final hours = duration.inHours.remainder(24);
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (days > 0) {
      return '$days日 $hours時間 $minutes分';
    } else if (hours > 0) {
      return '$hours時間 $minutes分 $seconds秒';
    } else {
      return '$minutes分 $seconds秒';
    }
  }

  Widget _buildStepIndicator(BuildContext context) {
    return Row(
      children: [
        _buildStep(context, 1, 'メール入力', !_codeSent),
        Expanded(
          child: Container(
            height: 2,
            color: _codeSent
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
          ),
        ),
        _buildStep(context, 2, '復元コード入力', _codeSent),
      ],
    );
  }

  Widget _buildStep(
    BuildContext context,
    int stepNumber,
    String label,
    bool isActive,
  ) {
    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
          ),
          child: Center(
            child: Text(
              '$stepNumber',
              style: TextStyle(
                color: isActive
                    ? Theme.of(context).colorScheme.onPrimary
                    : Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.5),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isActive
                ? Theme.of(context).colorScheme.primary
                : Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }

  Widget _buildEmailSection(BuildContext context, AccountRecoveryState state) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Step 1: メールアドレス',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              enabled: !_codeSent && !state.isLoading,
              decoration: const InputDecoration(
                labelText: 'メールアドレス',
                hintText: 'example@mail.com',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validator: Validators.email,
              onFieldSubmitted: (_) {
                if (!_codeSent) {
                  _requestRecoveryCode();
                }
              },
            ),
            if (_codeSent) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    size: 16,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    '復元コードを送信しました',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: state.isLoading
                        ? null
                        : () {
                            setState(() {
                              _codeSent = false;
                              _codeController.clear();
                              _error = null;
                            });
                          },
                    child: const Text('メールを変更'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCodeSection(BuildContext context, AccountRecoveryState state) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Step 2: 復元コード',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'メールに送信された6桁の復元コードを入力してください',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              enabled: !state.isLoading,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: '復元コード',
                hintText: '123456',
                prefixIcon: Icon(Icons.lock_outlined),
                counterText: '',
              ),
              style: const TextStyle(
                fontSize: 24,
                letterSpacing: 8,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '復元コードを入力してください';
                }
                if (value.length != 6) {
                  return '6桁のコードを入力してください';
                }
                return null;
              },
              onFieldSubmitted: (_) => _recoverAccount(),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'コードが届かない場合は ',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                TextButton(
                  onPressed: state.isLoading ? null : _resendCode,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 0),
                  ),
                  child: const Text('再送信', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorMessage(BuildContext context, String error) {
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
                error,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: () {
                setState(() {
                  _error = null;
                });
                ref.read(accountRecoveryNotifierProvider.notifier).clearError();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, AccountRecoveryState state) {
    if (!_codeSent) {
      // Step 1: Request recovery code
      return FilledButton(
        onPressed: state.isLoading || _isLoading ? null : _requestRecoveryCode,
        child: state.isLoading || _isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.send),
                  SizedBox(width: AppSpacing.sm),
                  Text('復元コードを送信'),
                ],
              ),
      );
    } else {
      // Step 2: Recover account
      return Column(
        children: [
          FilledButton(
            onPressed: state.isLoading || _isLoading ? null : _recoverAccount,
            child: state.isLoading || _isLoading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.restore),
                      SizedBox(width: AppSpacing.sm),
                      Text('アカウントを復元'),
                    ],
                  ),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton(
            onPressed: state.isLoading
                ? null
                : () => context.go(AppRoutes.login),
            child: const Text('キャンセル'),
          ),
        ],
      );
    }
  }

  Widget _buildHelpSection(BuildContext context) {
    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.help_outline),
        title: const Text('よくある質問'),
        children: [
          ListTile(
            title: const Text('復元コードが届かない場合'),
            subtitle: const Text(
              '迷惑メールフォルダを確認してください。それでも届かない場合は'
              'サポートにお問い合わせください。',
            ),
          ),
          ListTile(
            title: const Text('復元期限を過ぎた場合'),
            subtitle: const Text(
              '残念ながら、復元期限を過ぎたアカウントは復元できません。'
              '新しいアカウントを作成してください。',
            ),
          ),
          ListTile(
            title: const Text('復元後のデータ'),
            subtitle: const Text(
              'アカウントを復元すると、削除リクエスト前のすべてのデータが'
              '元の状態に戻ります。',
            ),
          ),
        ],
      ),
    );
  }

  /// Request recovery code via email
  Future<void> _requestRecoveryCode() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ref
          .read(accountRecoveryNotifierProvider.notifier)
          .requestRecoveryCode(_emailController.text.trim());

      if (result != null) {
        setState(() {
          _codeSent = true;
          _recoveryDeadline = result.recoveryDeadline;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Resend recovery code
  Future<void> _resendCode() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref
          .read(accountRecoveryNotifierProvider.notifier)
          .requestRecoveryCode(_emailController.text.trim());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('復元コードを再送信しました'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Recover account with verification code
  Future<void> _recoverAccount() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final success = await ref
          .read(accountRecoveryNotifierProvider.notifier)
          .recoverAccount(
            email: _emailController.text.trim(),
            code: _codeController.text.trim(),
          );

      if (success && mounted) {
        await _showRecoverySuccessDialog();
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Show recovery success dialog
  Future<void> _showRecoverySuccessDialog() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: Icon(
          Icons.check_circle,
          size: 48,
          color: Theme.of(context).colorScheme.primary,
        ),
        title: const Text('アカウントを復元しました'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('アカウントの削除がキャンセルされました。'),
            SizedBox(height: 8),
            Text('引き続きサービスをご利用いただけます。'),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.go(AppRoutes.login);
            },
            child: const Text('ログインへ'),
          ),
        ],
      ),
    );
  }
}
