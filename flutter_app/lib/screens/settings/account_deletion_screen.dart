// アカウント削除画面
// GDPR対応のデータ削除機能
//
// 仕様: FR-025 データ削除権（忘れられる権利）
// 参照: docs/tickets/015_data_export_deletion.md
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/gdpr/gdpr_models.dart';
import '../../core/gdpr/gdpr_state.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../home/home_screen.dart';

/// Account deletion screen widget
class AccountDeletionScreen extends ConsumerStatefulWidget {
  const AccountDeletionScreen({super.key});

  @override
  ConsumerState<AccountDeletionScreen> createState() =>
      _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends ConsumerState<AccountDeletionScreen> {
  final _reasonController = TextEditingController();
  final _dateFormat = DateFormat('yyyy/MM/dd');

  @override
  void initState() {
    super.initState();
    // Load current deletion status
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(deletionRequestNotifierProvider.notifier).loadCurrentStatus();
    });
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deletionState = ref.watch(deletionRequestNotifierProvider);
    final authState = ref.watch(authStateProvider);
    final currentIndex = ref.watch(bottomNavIndexProvider);

    // Check if deletion is already scheduled
    final hasPendingDeletion = deletionState.currentRequest != null &&
        (deletionState.currentRequest!.status == DeletionStatus.scheduled ||
            deletionState.currentRequest!.status == DeletionStatus.pending);

    return Scaffold(
      appBar: AppBar(
        title: const Text('アカウント削除'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(AppRoutes.profile),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Warning card
              _buildWarningCard(context),
              const SizedBox(height: AppSpacing.lg),

              // Show recovery UI if deletion is pending
              if (hasPendingDeletion) ...[
                _buildPendingDeletionCard(
                  context,
                  deletionState.currentRequest!,
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildRecoveryButton(context, deletionState),
              ] else ...[
                // Deletion options
                _buildSectionTitle(context, '削除オプション'),
                _buildDeletionOptions(context, deletionState),
                const SizedBox(height: AppSpacing.lg),

                // Data to be deleted
                _buildSectionTitle(context, '削除されるデータ'),
                _buildDataList(context),
                const SizedBox(height: AppSpacing.lg),

                // Reason input (optional)
                _buildSectionTitle(context, '削除理由（任意）'),
                _buildReasonInput(context),
                const SizedBox(height: AppSpacing.lg),

                // Confirmation checkbox
                _buildConfirmationCheckbox(context, deletionState),
                const SizedBox(height: AppSpacing.md),

                // Error message
                if (deletionState.error != null) ...[
                  _buildErrorMessage(context, deletionState.error!),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Submit button
                _buildDeleteButton(context, deletionState),
              ],

              // Deletion warning from auth state
              if (authState.isDeletionScheduled &&
                  !hasPendingDeletion) ...[
                const SizedBox(height: AppSpacing.lg),
                _buildLegacyDeletionWarning(context, ref),
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          ref.read(bottomNavIndexProvider.notifier).state = index;
          _navigateToTab(context, index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'ホーム',
          ),
          NavigationDestination(
            icon: Icon(Icons.fitness_center_outlined),
            selectedIcon: Icon(Icons.fitness_center),
            label: 'トレーニング',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: '履歴',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'プロフィール',
          ),
        ],
      ),
    );
  }

  Widget _buildWarningCard(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.warning_amber,
              size: 32,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '注意',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'アカウントを削除すると、すべてのデータが失われます。この操作は取り消せない場合があります。',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onErrorContainer,
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

  Widget _buildPendingDeletionCard(
    BuildContext context,
    DeletionRequest request,
  ) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Icon(
              Icons.schedule,
              size: 48,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'アカウント削除が予定されています',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '削除予定日: ${_dateFormat.format(request.scheduledAt)}',
              style: TextStyle(
                fontSize: 16,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '残り ${request.daysUntilDeletion} 日',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.error,
              ),
            ),
            if (request.canStillRecover) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                '削除予定日までにキャンセルすることで、アカウントを復元できます。',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRecoveryButton(
    BuildContext context,
    DeletionRequestState state,
  ) {
    if (state.currentRequest?.canStillRecover != true) {
      return const SizedBox.shrink();
    }

    return FilledButton(
      onPressed: state.isLoading
          ? null
          : () => _showCancelConfirmDialog(context),
      style: FilledButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.primary,
      ),
      child: state.isLoading
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
                Text('アカウントを復元する'),
              ],
            ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
      ),
    );
  }

  Widget _buildDeletionOptions(
    BuildContext context,
    DeletionRequestState state,
  ) {
    return Card(
      child: Column(
        children: [
          RadioListTile<DeletionType>(
            title: const Text('30日後に削除（復元可能）'),
            subtitle: const Text('猶予期間中はいつでもキャンセル可能'),
            value: DeletionType.soft,
            // ignore: deprecated_member_use
            groupValue: state.selectedType,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref
                    .read(deletionRequestNotifierProvider.notifier)
                    .setType(value);
              }
            },
          ),
          const Divider(height: 1),
          RadioListTile<DeletionType>(
            title: Text(
              '即時削除（復元不可）',
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
            subtitle: Text(
              '全データが即座に削除されます',
              style: TextStyle(
                color: Theme.of(context).colorScheme.error.withValues(alpha: 0.8),
              ),
            ),
            value: DeletionType.hard,
            // ignore: deprecated_member_use
            groupValue: state.selectedType,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref
                    .read(deletionRequestNotifierProvider.notifier)
                    .setType(value);
              }
            },
            activeColor: Theme.of(context).colorScheme.error,
          ),
        ],
      ),
    );
  }

  Widget _buildDataList(BuildContext context) {
    final items = [
      ('プロフィール情報', 'アカウント設定、表示名など'),
      ('トレーニング履歴', 'すべてのセッション記録'),
      ('設定データ', 'アプリ設定、同意状態'),
    ];

    return Card(
      child: Column(
        children: items.map((item) {
          return ListTile(
            leading: Icon(
              Icons.delete_outline,
              color: Theme.of(context).colorScheme.error,
            ),
            title: Text(item.$1),
            subtitle: Text(item.$2),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildReasonInput(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: TextField(
          controller: _reasonController,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'サービス改善のため、削除理由をお聞かせください',
            border: OutlineInputBorder(),
          ),
          onChanged: (value) {
            ref
                .read(deletionRequestNotifierProvider.notifier)
                .setReason(value.isEmpty ? null : value);
          },
        ),
      ),
    );
  }

  Widget _buildConfirmationCheckbox(
    BuildContext context,
    DeletionRequestState state,
  ) {
    return Card(
      child: CheckboxListTile(
        title: Text(
          state.selectedType == DeletionType.hard
              ? '即時削除を理解し、同意します'
              : '30日後の削除を理解し、同意します',
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          state.selectedType == DeletionType.hard
              ? 'すべてのデータが即座に削除されることを理解しています'
              : '猶予期間後に全データが削除されることを理解しています',
        ),
        value: state.confirmed,
        onChanged: (value) {
          ref
              .read(deletionRequestNotifierProvider.notifier)
              .setConfirmed(value ?? false);
        },
        controlAffinity: ListTileControlAffinity.leading,
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
                ref
                    .read(deletionRequestNotifierProvider.notifier)
                    .clearError();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeleteButton(
    BuildContext context,
    DeletionRequestState state,
  ) {
    final isHardDelete = state.selectedType == DeletionType.hard;

    return FilledButton(
      onPressed: (state.isLoading || !state.confirmed)
          ? null
          : () => _showDeleteConfirmDialog(context, isHardDelete),
      style: FilledButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.error,
        foregroundColor: Theme.of(context).colorScheme.onError,
      ),
      child: state.isLoading
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
              children: [
                const Icon(Icons.delete_forever),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  isHardDelete ? '今すぐ削除する' : 'アカウントを削除する',
                ),
              ],
            ),
    );
  }

  Widget _buildLegacyDeletionWarning(BuildContext context, WidgetRef ref) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Row(
              children: [
                Icon(
                  Icons.info_outline,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    '以前のリクエストで削除が予定されています',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: () async {
                await ref
                    .read(authStateProvider.notifier)
                    .cancelAccountDeletion();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('削除をキャンセルしました'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              },
              child: const Text('削除をキャンセル'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDeleteConfirmDialog(
    BuildContext context,
    bool isHardDelete,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              Icons.warning,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: AppSpacing.sm),
            const Text('最終確認'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isHardDelete
                  ? 'アカウントを今すぐ削除しますか？'
                  : 'アカウントの削除を予約しますか？',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.md),
            if (isHardDelete)
              Text(
                'この操作は取り消せません。すべてのデータが即座に削除されます。',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                ),
              )
            else
              const Text('30日後にすべてのデータが削除されます。期間中はキャンセル可能です。'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(isHardDelete ? '今すぐ削除' : '削除を予約'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final success = await ref
          .read(deletionRequestNotifierProvider.notifier)
          .submitRequest();

      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isHardDelete
                  ? 'アカウントを削除しました'
                  : 'アカウント削除を予約しました',
            ),
            backgroundColor: Colors.green,
          ),
        );

        if (isHardDelete) {
          // Sign out and navigate to login after hard delete
          await ref.read(authStateProvider.notifier).signOut();
          if (context.mounted) {
            context.go(AppRoutes.login);
          }
        }
      }
    }
  }

  Future<void> _showCancelConfirmDialog(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('削除をキャンセル'),
        content: const Text('アカウントの削除をキャンセルして、通常の利用を続けますか？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('戻る'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(dialogContext).colorScheme.primary,
            ),
            child: const Text('キャンセルする'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final success = await ref
          .read(deletionRequestNotifierProvider.notifier)
          .cancelRequest();

      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('アカウント削除をキャンセルしました'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  void _navigateToTab(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.goToHome();
        break;
      case 1:
        context.goToTraining();
        break;
      case 2:
        context.goToHistory();
        break;
      case 3:
        context.goToProfile();
        break;
    }
  }
}
