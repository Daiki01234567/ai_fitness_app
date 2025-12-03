// データエクスポート画面
// GDPR対応のデータポータビリティ機能
//
// 仕様: FR-026 データポータビリティ
// 参照: docs/tickets/015_data_export_deletion.md
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/gdpr/gdpr_models.dart';
import '../../core/gdpr/gdpr_state.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/bottom_nav_bar.dart';

/// Data export screen widget
class DataExportScreen extends ConsumerStatefulWidget {
  const DataExportScreen({super.key});

  @override
  ConsumerState<DataExportScreen> createState() => _DataExportScreenState();
}

class _DataExportScreenState extends ConsumerState<DataExportScreen> {
  final _dateFormat = DateFormat('yyyy/MM/dd HH:mm');

  @override
  void initState() {
    super.initState();
    // Reset state when screen opens
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(exportRequestNotifierProvider.notifier).reset();
    });
  }

  @override
  Widget build(BuildContext context) {
    final exportState = ref.watch(exportRequestNotifierProvider);
    final exportRequests = ref.watch(exportRequestsProvider);
    final currentIndex = ref.watch(bottomNavIndexProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('データエクスポート'),
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
              // Information card
              _buildInfoCard(context),
              const SizedBox(height: AppSpacing.lg),

              // Export format selection
              _buildSectionTitle(context, 'エクスポート形式'),
              _buildFormatSelection(context, exportState),
              const SizedBox(height: AppSpacing.lg),

              // Export scope selection
              _buildSectionTitle(context, 'エクスポート範囲'),
              _buildScopeSelection(context, exportState),
              const SizedBox(height: AppSpacing.lg),

              // Date range picker (if dateRange selected)
              if (exportState.selectedScopeType == ExportScopeType.dateRange)
                _buildDateRangePicker(context, exportState),

              // Error message
              if (exportState.error != null) ...[
                _buildErrorMessage(context, exportState.error!),
                const SizedBox(height: AppSpacing.md),
              ],

              // Submit button
              _buildSubmitButton(context, exportState),
              const SizedBox(height: AppSpacing.xl),

              // Past requests section
              _buildSectionTitle(context, '過去のリクエスト'),
              exportRequests.when(
                data: (requests) => _buildRequestsList(context, requests),
                loading: () => const Center(
                  child: CircularProgressIndicator(),
                ),
                error: (error, _) => Text(
                  'エラー: $error',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
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

  Widget _buildInfoCard(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(
              Icons.info_outline,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'データポータビリティ',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'GDPRに基づき、あなたのデータを機械可読形式でダウンロードできます。処理には最大72時間かかる場合があります。',
                    style: TextStyle(
                      fontSize: 12,
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

  Widget _buildFormatSelection(
    BuildContext context,
    ExportRequestState state,
  ) {
    return Card(
      child: Column(
        children: [
          RadioListTile<ExportFormat>(
            title: const Text('JSON (推奨)'),
            subtitle: const Text('プログラムで処理しやすい形式'),
            value: ExportFormat.json,
            // ignore: deprecated_member_use
            groupValue: state.selectedFormat,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref.read(exportRequestNotifierProvider.notifier).setFormat(value);
              }
            },
          ),
          const Divider(height: 1),
          RadioListTile<ExportFormat>(
            title: const Text('CSV'),
            subtitle: const Text('表計算ソフトで開ける形式'),
            value: ExportFormat.csv,
            // ignore: deprecated_member_use
            groupValue: state.selectedFormat,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref.read(exportRequestNotifierProvider.notifier).setFormat(value);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildScopeSelection(
    BuildContext context,
    ExportRequestState state,
  ) {
    return Card(
      child: Column(
        children: [
          RadioListTile<ExportScopeType>(
            title: const Text('全データ'),
            subtitle: const Text('すべてのトレーニング記録をエクスポート'),
            value: ExportScopeType.all,
            // ignore: deprecated_member_use
            groupValue: state.selectedScopeType,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref.read(exportRequestNotifierProvider.notifier).setScopeType(value);
              }
            },
          ),
          const Divider(height: 1),
          RadioListTile<ExportScopeType>(
            title: const Text('期間指定'),
            subtitle: const Text('指定した期間のデータのみ'),
            value: ExportScopeType.dateRange,
            // ignore: deprecated_member_use
            groupValue: state.selectedScopeType,
            // ignore: deprecated_member_use
            onChanged: (value) {
              if (value != null) {
                ref.read(exportRequestNotifierProvider.notifier).setScopeType(value);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDateRangePicker(
    BuildContext context,
    ExportRequestState state,
  ) {
    return Column(
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_today),
            title: const Text('開始日'),
            subtitle: Text(
              state.startDate != null
                  ? DateFormat('yyyy/MM/dd').format(state.startDate!)
                  : '選択してください',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: state.startDate ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (date != null) {
                ref
                    .read(exportRequestNotifierProvider.notifier)
                    .setDateRange(date, state.endDate);
              }
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_today),
            title: const Text('終了日'),
            subtitle: Text(
              state.endDate != null
                  ? DateFormat('yyyy/MM/dd').format(state.endDate!)
                  : '選択してください',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: state.endDate ?? DateTime.now(),
                firstDate: state.startDate ?? DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (date != null) {
                ref
                    .read(exportRequestNotifierProvider.notifier)
                    .setDateRange(state.startDate, date);
              }
            },
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
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
                ref.read(exportRequestNotifierProvider.notifier).clearError();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton(BuildContext context, ExportRequestState state) {
    return FilledButton(
      onPressed: state.isLoading
          ? null
          : () async {
              final success = await ref
                  .read(exportRequestNotifierProvider.notifier)
                  .submitRequest();

              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('エクスポートリクエストを送信しました'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            },
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
                Icon(Icons.download),
                SizedBox(width: AppSpacing.sm),
                Text('エクスポートをリクエスト'),
              ],
            ),
    );
  }

  Widget _buildRequestsList(
    BuildContext context,
    List<ExportRequest> requests,
  ) {
    if (requests.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: Column(
              children: [
                Icon(
                  Icons.inbox_outlined,
                  size: 48,
                  color: Theme.of(context).colorScheme.outline,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '過去のリクエストはありません',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: requests.length,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final request = requests[index];
          return _buildRequestItem(context, request);
        },
      ),
    );
  }

  Widget _buildRequestItem(BuildContext context, ExportRequest request) {
    final statusColor = _getStatusColor(context, request.status);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: statusColor.withValues(alpha: 0.2),
        child: Icon(
          _getStatusIcon(request.status),
          color: statusColor,
          size: 20,
        ),
      ),
      title: Text(
        '${request.format.name.toUpperCase()} エクスポート',
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_dateFormat.format(request.requestedAt)),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  request.statusText,
                  style: TextStyle(
                    fontSize: 10,
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (request.expiresAt != null &&
                  request.status == ExportStatus.completed) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '有効期限: ${DateFormat('MM/dd HH:mm').format(request.expiresAt!)}',
                  style: TextStyle(
                    fontSize: 10,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
      trailing: request.canDownload
          ? IconButton(
              icon: Icon(
                Icons.download,
                color: Theme.of(context).colorScheme.primary,
              ),
              onPressed: () => _downloadExport(context, request),
            )
          : null,
      isThreeLine: true,
    );
  }

  Color _getStatusColor(BuildContext context, ExportStatus status) {
    switch (status) {
      case ExportStatus.pending:
        return Colors.orange;
      case ExportStatus.processing:
        return Colors.blue;
      case ExportStatus.completed:
        return Colors.green;
      case ExportStatus.failed:
        return Theme.of(context).colorScheme.error;
      case ExportStatus.expired:
        return Theme.of(context).colorScheme.outline;
    }
  }

  IconData _getStatusIcon(ExportStatus status) {
    switch (status) {
      case ExportStatus.pending:
        return Icons.schedule;
      case ExportStatus.processing:
        return Icons.sync;
      case ExportStatus.completed:
        return Icons.check_circle;
      case ExportStatus.failed:
        return Icons.error;
      case ExportStatus.expired:
        return Icons.timer_off;
    }
  }

  Future<void> _downloadExport(
    BuildContext context,
    ExportRequest request,
  ) async {
    if (request.downloadUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ダウンロードURLが見つかりません'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // In a real app, this would open the URL or trigger a download
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('ダウンロード: ${request.downloadUrl}'),
      ),
    );
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
