/// Pose Error Handler
///
/// Handles and displays pose detection errors.
/// Reference: docs/specs/00_要件定義書_v3_3.md
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../camera/camera_service.dart';
import '../../camera/permission_service.dart';
import '../../pose/pose_session_controller.dart';

/// Pose detection error types
enum PoseErrorType {
  /// Camera is not available on device
  cameraUnavailable,

  /// Camera permission denied
  cameraPermissionDenied,

  /// Camera permission permanently denied
  cameraPermissionPermanentlyDenied,

  /// MediaPipe initialization failed
  mediaPipeInitFailed,

  /// Low light conditions
  lowLight,

  /// No person detected in frame
  noPerson,

  /// Multiple people detected
  multiplePeople,

  /// Person too far from camera
  tooFar,

  /// Person too close to camera
  tooClose,

  /// Person partially out of frame
  partiallyOutOfFrame,

  /// Generic detection error
  detectionFailed,

  /// Session error
  sessionError,
}

/// Pose error state
class PoseErrorState {
  const PoseErrorState({
    this.errorType,
    this.message,
    this.canRetry = true,
    this.requiresSettings = false,
  });

  final PoseErrorType? errorType;
  final String? message;
  final bool canRetry;
  final bool requiresSettings;

  bool get hasError => errorType != null;

  static const none = PoseErrorState();
}

/// Pose error state provider
final poseErrorStateProvider = StateNotifierProvider<PoseErrorNotifier, PoseErrorState>((ref) {
  return PoseErrorNotifier(ref);
});

/// Pose error state notifier
class PoseErrorNotifier extends StateNotifier<PoseErrorState> {
  PoseErrorNotifier(this._ref) : super(const PoseErrorState()) {
    // Listen to session state changes
    _ref.listen(poseSessionControllerProvider, (previous, next) {
      _checkSessionErrors(next);
    });

    // Listen to camera state changes
    _ref.listen(cameraStateProvider, (previous, next) {
      _checkCameraErrors(next);
    });

    // Listen to permission state changes
    _ref.listen(cameraPermissionStateProvider, (previous, next) {
      _checkPermissionErrors(next);
    });
  }

  final Ref _ref;

  void _checkSessionErrors(PoseSessionState sessionState) {
    if (sessionState.errorMessage != null) {
      _setError(
        PoseErrorType.sessionError,
        sessionState.errorMessage!,
      );
    } else if (state.errorType == PoseErrorType.sessionError) {
      clearError();
    }
  }

  void _checkCameraErrors(CameraServiceState cameraState) {
    if (cameraState.hasError) {
      if (cameraState.availableCameras.isEmpty) {
        _setError(
          PoseErrorType.cameraUnavailable,
          'このデバイスではカメラが利用できません',
          canRetry: false,
        );
      } else {
        _setError(
          PoseErrorType.detectionFailed,
          cameraState.errorMessage ?? 'カメラの初期化に失敗しました',
        );
      }
    }
  }

  void _checkPermissionErrors(CameraPermissionState permissionState) {
    switch (permissionState) {
      case CameraPermissionState.denied:
        _setError(
          PoseErrorType.cameraPermissionDenied,
          'カメラの許可が必要です。トレーニング機能を使用するにはカメラへのアクセスを許可してください。',
        );
        break;
      case CameraPermissionState.permanentlyDenied:
      case CameraPermissionState.restricted:
        _setError(
          PoseErrorType.cameraPermissionPermanentlyDenied,
          'カメラの許可が拒否されています。設定アプリからカメラの許可を有効にしてください。',
          canRetry: false,
          requiresSettings: true,
        );
        break;
      case CameraPermissionState.granted:
        if (state.errorType == PoseErrorType.cameraPermissionDenied ||
            state.errorType == PoseErrorType.cameraPermissionPermanentlyDenied) {
          clearError();
        }
        break;
      default:
        break;
    }
  }

  /// Set pose quality error based on detection results
  void checkPoseQuality({
    required bool isPoseDetected,
    required int reliableLandmarkCount,
    required int totalLandmarks,
    double? averageConfidence,
  }) {
    if (!isPoseDetected) {
      _setError(
        PoseErrorType.noPerson,
        'フレーム内に人物が検出されませんでした。カメラに向かって立ってください。',
      );
      return;
    }

    final detectionRate = reliableLandmarkCount / totalLandmarks;

    if (detectionRate < 0.3) {
      _setError(
        PoseErrorType.partiallyOutOfFrame,
        '体の一部がフレーム外です。カメラから少し離れてください。',
      );
      return;
    }

    if (averageConfidence != null && averageConfidence < 0.4) {
      _setError(
        PoseErrorType.lowLight,
        '検出精度が低下しています。明るい場所で撮影してください。',
      );
      return;
    }

    // Clear error if pose quality is acceptable
    if (state.hasError &&
        state.errorType != PoseErrorType.cameraPermissionDenied &&
        state.errorType != PoseErrorType.cameraPermissionPermanentlyDenied &&
        state.errorType != PoseErrorType.cameraUnavailable) {
      clearError();
    }
  }

  void _setError(
    PoseErrorType type,
    String message, {
    bool canRetry = true,
    bool requiresSettings = false,
  }) {
    state = PoseErrorState(
      errorType: type,
      message: message,
      canRetry: canRetry,
      requiresSettings: requiresSettings,
    );
  }

  /// Set a custom error
  void setError(PoseErrorType type, String message) {
    _setError(type, message);
  }

  /// Clear current error
  void clearError() {
    state = const PoseErrorState();
  }
}

/// Widget that displays pose detection errors
class PoseErrorDisplay extends ConsumerWidget {
  const PoseErrorDisplay({
    this.onRetry,
    this.onOpenSettings,
    this.compact = false,
    super.key,
  });

  /// Callback when retry button is pressed
  final VoidCallback? onRetry;

  /// Callback when open settings button is pressed
  final VoidCallback? onOpenSettings;

  /// Whether to use compact display
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final errorState = ref.watch(poseErrorStateProvider);

    if (!errorState.hasError) {
      return const SizedBox.shrink();
    }

    if (compact) {
      return _buildCompactError(context, errorState);
    }

    return _buildFullError(context, errorState);
  }

  Widget _buildCompactError(BuildContext context, PoseErrorState errorState) {
    return Container(
      margin: const EdgeInsets.all(8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _getErrorColor(errorState.errorType!).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _getErrorIcon(errorState.errorType!),
            color: Colors.white,
            size: 16,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              _getShortMessage(errorState.errorType!),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFullError(BuildContext context, PoseErrorState errorState) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _getErrorColor(errorState.errorType!),
          width: 2,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _getErrorIcon(errorState.errorType!),
            color: _getErrorColor(errorState.errorType!),
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            _getErrorTitle(errorState.errorType!),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            errorState.message ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (errorState.canRetry && onRetry != null)
                ElevatedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('再試行'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _getErrorColor(errorState.errorType!),
                  ),
                ),
              if (errorState.requiresSettings && onOpenSettings != null) ...[
                if (errorState.canRetry) const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: onOpenSettings,
                  icon: const Icon(Icons.settings),
                  label: const Text('設定を開く'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white54),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  IconData _getErrorIcon(PoseErrorType type) {
    switch (type) {
      case PoseErrorType.cameraUnavailable:
        return Icons.no_photography;
      case PoseErrorType.cameraPermissionDenied:
      case PoseErrorType.cameraPermissionPermanentlyDenied:
        return Icons.camera_alt_outlined;
      case PoseErrorType.mediaPipeInitFailed:
        return Icons.error_outline;
      case PoseErrorType.lowLight:
        return Icons.light_mode_outlined;
      case PoseErrorType.noPerson:
        return Icons.person_off;
      case PoseErrorType.multiplePeople:
        return Icons.groups;
      case PoseErrorType.tooFar:
        return Icons.zoom_in;
      case PoseErrorType.tooClose:
        return Icons.zoom_out;
      case PoseErrorType.partiallyOutOfFrame:
        return Icons.crop_free;
      case PoseErrorType.detectionFailed:
      case PoseErrorType.sessionError:
        return Icons.warning_amber;
    }
  }

  Color _getErrorColor(PoseErrorType type) {
    switch (type) {
      case PoseErrorType.cameraUnavailable:
      case PoseErrorType.cameraPermissionDenied:
      case PoseErrorType.cameraPermissionPermanentlyDenied:
      case PoseErrorType.mediaPipeInitFailed:
        return Colors.red;
      case PoseErrorType.lowLight:
      case PoseErrorType.noPerson:
      case PoseErrorType.partiallyOutOfFrame:
      case PoseErrorType.tooFar:
      case PoseErrorType.tooClose:
        return Colors.orange;
      case PoseErrorType.multiplePeople:
        return Colors.amber;
      case PoseErrorType.detectionFailed:
      case PoseErrorType.sessionError:
        return Colors.red;
    }
  }

  String _getErrorTitle(PoseErrorType type) {
    switch (type) {
      case PoseErrorType.cameraUnavailable:
        return 'カメラ利用不可';
      case PoseErrorType.cameraPermissionDenied:
        return 'カメラ許可が必要';
      case PoseErrorType.cameraPermissionPermanentlyDenied:
        return 'カメラ許可が拒否されています';
      case PoseErrorType.mediaPipeInitFailed:
        return '初期化エラー';
      case PoseErrorType.lowLight:
        return '明るさ不足';
      case PoseErrorType.noPerson:
        return '人物未検出';
      case PoseErrorType.multiplePeople:
        return '複数人検出';
      case PoseErrorType.tooFar:
        return 'カメラから遠すぎます';
      case PoseErrorType.tooClose:
        return 'カメラに近すぎます';
      case PoseErrorType.partiallyOutOfFrame:
        return 'フレーム外';
      case PoseErrorType.detectionFailed:
        return '検出エラー';
      case PoseErrorType.sessionError:
        return 'セッションエラー';
    }
  }

  String _getShortMessage(PoseErrorType type) {
    switch (type) {
      case PoseErrorType.cameraUnavailable:
        return 'カメラが利用できません';
      case PoseErrorType.cameraPermissionDenied:
      case PoseErrorType.cameraPermissionPermanentlyDenied:
        return 'カメラ許可が必要です';
      case PoseErrorType.mediaPipeInitFailed:
        return '初期化に失敗しました';
      case PoseErrorType.lowLight:
        return '明るい場所で撮影してください';
      case PoseErrorType.noPerson:
        return 'カメラに向かって立ってください';
      case PoseErrorType.multiplePeople:
        return '1人で撮影してください';
      case PoseErrorType.tooFar:
        return 'カメラに近づいてください';
      case PoseErrorType.tooClose:
        return 'カメラから離れてください';
      case PoseErrorType.partiallyOutOfFrame:
        return '全身が映るようにしてください';
      case PoseErrorType.detectionFailed:
      case PoseErrorType.sessionError:
        return 'エラーが発生しました';
    }
  }
}

/// Overlay widget that shows error on top of camera preview
class PoseErrorOverlay extends ConsumerWidget {
  const PoseErrorOverlay({
    required this.child,
    this.onRetry,
    this.onOpenSettings,
    super.key,
  });

  final Widget child;
  final VoidCallback? onRetry;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final errorState = ref.watch(poseErrorStateProvider);

    return Stack(
      children: [
        child,
        if (errorState.hasError)
          Positioned.fill(
            child: Container(
              color: Colors.black54,
              child: Center(
                child: PoseErrorDisplay(
                  onRetry: onRetry,
                  onOpenSettings: onOpenSettings,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
