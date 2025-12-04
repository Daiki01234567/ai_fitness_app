/// カメラエラー表示ウィジェット
///
/// カメラ関連のエラーを適切なUIで表示し、回復オプションを提供します。
/// 参照: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.8)
library;

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../camera/camera_error.dart';
import '../../theme/app_theme.dart';

/// カメラエラー表示ウィジェット
class CameraErrorWidget extends StatelessWidget {
  const CameraErrorWidget({
    required this.error,
    required this.onRetry,
    required this.onGoBack,
    super.key,
  });

  /// エラー情報
  final CameraError error;

  /// 再試行コールバック
  final VoidCallback onRetry;

  /// 戻るコールバック
  final VoidCallback onGoBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Error icon
            _buildErrorIcon(colorScheme),
            const SizedBox(height: AppSpacing.lg),

            // Error title
            Text(
              _getErrorTitle(),
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),

            // Error message
            Text(
              error.message,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),

            // Recommended action
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.lightbulb_outline,
                    color: colorScheme.primary,
                    size: 20,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      error.recommendedAction,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Action buttons
            _buildActionButtons(context, colorScheme),

            // Support contact for initialization failures
            if (_shouldShowSupportContact()) ...[
              const SizedBox(height: AppSpacing.lg),
              _buildSupportContactSection(context, colorScheme),
            ],
          ],
        ),
      ),
    );
  }

  /// Whether to show support contact section
  bool _shouldShowSupportContact() {
    return error.type == CameraErrorType.initializationFailed ||
        error.type == CameraErrorType.poseDetectorFailed ||
        error.type == CameraErrorType.unknown;
  }

  /// Build support contact section
  Widget _buildSupportContactSection(
    BuildContext context,
    ColorScheme colorScheme,
  ) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: colorScheme.outlineVariant,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.support_agent,
                color: colorScheme.primary,
                size: 20,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'お困りの場合',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '問題が解決しない場合は、サポートまでお問い合わせください。',
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(
                Icons.email_outlined,
                color: colorScheme.onSurfaceVariant,
                size: 16,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                'support@aifitness.app',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorIcon(ColorScheme colorScheme) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: colorScheme.errorContainer.withValues(alpha: 0.3),
        shape: BoxShape.circle,
      ),
      child: Icon(error.icon, size: 48, color: colorScheme.error),
    );
  }

  String _getErrorTitle() {
    switch (error.type) {
      case CameraErrorType.permissionDenied:
      case CameraErrorType.permissionPermanentlyDenied:
        return 'カメラの権限が必要です';
      case CameraErrorType.noCameraAvailable:
        return 'カメラが見つかりません';
      case CameraErrorType.cameraInUse:
        return 'カメラを使用できません';
      case CameraErrorType.initializationFailed:
        return 'カメラの起動に失敗しました';
      case CameraErrorType.poseDetectorFailed:
        return 'ポーズ検出を開始できません';
      case CameraErrorType.outOfMemory:
        return 'メモリ不足です';
      case CameraErrorType.temporaryError:
        return '一時的なエラー';
      case CameraErrorType.unknown:
        return 'エラーが発生しました';
    }
  }

  Widget _buildActionButtons(BuildContext context, ColorScheme colorScheme) {
    return Column(
      children: [
        // Primary action button
        if (error.needsSettings)
          FilledButton.icon(
            onPressed: _openAppSettings,
            icon: const Icon(Icons.settings),
            label: const Text('設定を開く'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          )
        else if (error.canRetry)
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('再試行'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          ),

        const SizedBox(height: AppSpacing.md),

        // Secondary action - go back
        OutlinedButton.icon(
          onPressed: onGoBack,
          icon: const Icon(Icons.arrow_back),
          label: const Text('前の画面に戻る'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
        ),

        // Settings button (if can retry but also might need settings)
        if (error.canRetry &&
            error.type == CameraErrorType.permissionDenied) ...[
          const SizedBox(height: AppSpacing.md),
          TextButton.icon(
            onPressed: _openAppSettings,
            icon: const Icon(Icons.settings_outlined),
            label: const Text('設定で権限を確認'),
          ),
        ],
      ],
    );
  }

  Future<void> _openAppSettings() async {
    await openAppSettings();
  }
}

/// カメラエラー詳細ダイアログ
class CameraErrorDetailsDialog extends StatelessWidget {
  const CameraErrorDetailsDialog({required this.error, super.key});

  final CameraError error;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('エラーの詳細'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildDetailRow(context, 'エラー種別', error.type.name),
            const SizedBox(height: AppSpacing.sm),
            _buildDetailRow(context, 'メッセージ', error.message),
            if (error.technicalDetails != null) ...[
              const SizedBox(height: AppSpacing.sm),
              _buildDetailRow(context, '技術的詳細', error.technicalDetails!),
            ],
            const SizedBox(height: AppSpacing.md),
            _buildDetailRow(context, '再試行可能', error.canRetry ? 'はい' : 'いいえ'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('閉じる'),
        ),
      ],
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: textTheme.labelSmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        Text(value, style: textTheme.bodyMedium),
      ],
    );
  }
}
