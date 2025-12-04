/// カメラサービス
///
/// カメラの初期化、ストリーミング、ライフサイクルを管理します。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-024, NFR-025, NFR-035)
/// 重要: カメラ映像はサーバーに送信されません (NFR-015)
library;

import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import 'camera_config.dart';
import 'camera_error.dart';

/// カメラサービスプロバイダー
final cameraServiceProvider = Provider<CameraService>((ref) {
  return CameraService();
});

/// カメラ状態プロバイダー
final cameraStateProvider =
    StateNotifierProvider<CameraStateNotifier, CameraServiceState>((ref) {
      final cameraService = ref.watch(cameraServiceProvider);
      return CameraStateNotifier(cameraService);
    });

/// カメラサービス状態
class CameraServiceState {
  const CameraServiceState({
    this.state = CameraState.uninitialized,
    this.controller,
    this.currentConfig,
    this.availableCameras = const [],
    this.errorMessage,
    this.error,
  });

  final CameraState state;
  final CameraController? controller;
  final CameraConfig? currentConfig;
  final List<CameraDescription> availableCameras;
  final String? errorMessage;
  final CameraError? error;

  bool get isReady => state == CameraState.ready;
  bool get isInitializing => state == CameraState.initializing;
  bool get hasError => state == CameraState.error;

  CameraServiceState copyWith({
    CameraState? state,
    CameraController? controller,
    CameraConfig? currentConfig,
    List<CameraDescription>? availableCameras,
    String? errorMessage,
    CameraError? error,
  }) {
    return CameraServiceState(
      state: state ?? this.state,
      controller: controller ?? this.controller,
      currentConfig: currentConfig ?? this.currentConfig,
      availableCameras: availableCameras ?? this.availableCameras,
      errorMessage: errorMessage,
      error: error,
    );
  }
}

/// カメラ状態Notifier
class CameraStateNotifier extends StateNotifier<CameraServiceState> {
  CameraStateNotifier(this._cameraService) : super(const CameraServiceState());

  final CameraService _cameraService;
  StreamSubscription<CameraImage>? _imageStreamSubscription;

  /// オプション設定でカメラを初期化
  Future<bool> initialize({
    CameraConfig config = CameraConfig.highQuality,
    CameraLensDirection direction = CameraLensDirection.front,
  }) async {
    state = state.copyWith(state: CameraState.initializing);

    try {
      // Check camera permission first
      final permissionStatus = await Permission.camera.status;
      if (!permissionStatus.isGranted) {
        // Request permission if not granted
        final requestResult = await Permission.camera.request();
        if (!requestResult.isGranted) {
          final error = requestResult.isPermanentlyDenied
              ? CameraError.permissionPermanentlyDenied
              : CameraError.permissionDenied;
          state = state.copyWith(
            state: CameraState.error,
            errorMessage: error.message,
            error: error,
          );
          debugPrint('CameraStateNotifier: Camera permission denied');
          return false;
        }
      }

      final cameras = await _cameraService.getAvailableCameras();
      if (cameras.isEmpty) {
        state = state.copyWith(
          state: CameraState.error,
          errorMessage: CameraError.noCameraAvailable.message,
          error: CameraError.noCameraAvailable,
        );
        debugPrint('CameraStateNotifier: No cameras available');
        return false;
      }

      state = state.copyWith(availableCameras: cameras);

      // Select camera based on direction preference
      final cameraDirection = direction == CameraLensDirection.front
          ? CameraLensDirection.front
          : CameraLensDirection.back;

      final selectedCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == cameraDirection,
        orElse: () => cameras.first,
      );

      final controller = await _cameraService.initializeCamera(
        selectedCamera,
        config,
      );

      if (controller != null) {
        state = state.copyWith(
          state: CameraState.ready,
          controller: controller,
          currentConfig: config,
          errorMessage: null,
          error: null,
        );
        return true;
      } else {
        state = state.copyWith(
          state: CameraState.error,
          errorMessage: CameraError.initializationFailed.message,
          error: CameraError.initializationFailed,
        );
        return false;
      }
    } catch (e) {
      final errorMessage = e.toString();
      final error = CameraError.fromMessage(errorMessage);
      state = state.copyWith(
        state: CameraState.error,
        errorMessage: error.message,
        error: error,
      );
      debugPrint('CameraStateNotifier: Initialization error: $errorMessage');
      return false;
    }
  }

  /// 姿勢検出用の画像ストリームを開始
  Future<void> startImageStream(void Function(CameraImage) onImage) async {
    final controller = state.controller;
    if (controller == null || !controller.value.isInitialized) {
      return;
    }

    if (controller.value.isStreamingImages) {
      return;
    }

    await controller.startImageStream(onImage);
  }

  /// 画像ストリームを停止
  Future<void> stopImageStream() async {
    final controller = state.controller;
    if (controller == null || !controller.value.isStreamingImages) {
      return;
    }

    await controller.stopImageStream();
    _imageStreamSubscription?.cancel();
    _imageStreamSubscription = null;
  }

  /// カメラを一時停止
  Future<void> pause() async {
    await stopImageStream();
    state = state.copyWith(state: CameraState.paused);
  }

  /// カメラを再開
  Future<void> resume() async {
    if (state.controller != null) {
      state = state.copyWith(state: CameraState.ready);
    }
  }

  /// 現在のカメラ方向を取得
  CameraLensDirection? get currentDirection {
    final controller = state.controller;
    if (controller == null) return null;
    return controller.description.lensDirection;
  }

  /// フロント/バックカメラを切り替え
  Future<bool> switchCamera() async {
    final controller = state.controller;
    if (controller == null || !controller.value.isInitialized) {
      debugPrint('CameraStateNotifier: Cannot switch - camera not initialized');
      return false;
    }

    // Determine target direction
    final currentDir = controller.description.lensDirection;
    final targetDirection = currentDir == CameraLensDirection.front
        ? CameraLensDirection.back
        : CameraLensDirection.front;

    // Check if target camera is available
    final cameras = state.availableCameras;
    final targetCamera = cameras.where(
      (camera) => camera.lensDirection == targetDirection,
    ).firstOrNull;

    if (targetCamera == null) {
      debugPrint(
        'CameraStateNotifier: Cannot switch - target camera not available',
      );
      return false;
    }

    final currentConfig = state.currentConfig ?? CameraConfig.highQuality;

    // Set state to initializing while switching
    state = state.copyWith(state: CameraState.initializing);

    try {
      // Stop current controller
      await stopImageStream();
      await controller.dispose();

      // Initialize new camera
      final newController = await _cameraService.initializeCamera(
        targetCamera,
        currentConfig,
      );

      if (newController != null) {
        state = state.copyWith(
          state: CameraState.ready,
          controller: newController,
          errorMessage: null,
          error: null,
        );
        debugPrint(
          'CameraStateNotifier: Switched to ${targetDirection.name} camera',
        );
        return true;
      } else {
        state = state.copyWith(
          state: CameraState.error,
          errorMessage: CameraError.initializationFailed.message,
          error: CameraError.initializationFailed,
        );
        return false;
      }
    } catch (e) {
      final errorMessage = e.toString();
      state = state.copyWith(
        state: CameraState.error,
        errorMessage: errorMessage,
        error: CameraError.fromMessage(errorMessage),
      );
      debugPrint('CameraStateNotifier: Switch camera error: $errorMessage');
      return false;
    }
  }

  /// フォールバック設定を適用（低解像度/FPS）
  Future<bool> applyFallback() async {
    final currentConfig = state.currentConfig;
    if (currentConfig == null) return false;

    final fallbackConfig = currentConfig.fallback;
    if (fallbackConfig == null) {
      // これ以上のフォールバックは利用不可
      return false;
    }

    debugPrint(
      'CameraService: Applying fallback from $currentConfig to $fallbackConfig',
    );

    // 現在のコントローラーを破棄
    await disposeCamera();

    // フォールバック設定で再初期化
    return initialize(
      config: fallbackConfig,
      direction: CameraLensDirection.front,
    );
  }

  /// カメラリソースを破棄
  Future<void> disposeCamera() async {
    await stopImageStream();
    await state.controller?.dispose();
    state = state.copyWith(state: CameraState.disposed, controller: null);
  }

  @override
  void dispose() {
    disposeCamera();
    super.dispose();
  }
}

/// 低レベルカメラ操作用のカメラサービス
class CameraService {
  List<CameraDescription>? _cachedCameras;

  /// デバイスで利用可能なカメラを取得
  Future<List<CameraDescription>> getAvailableCameras() async {
    if (_cachedCameras != null) {
      return _cachedCameras!;
    }

    try {
      _cachedCameras = await availableCameras();
      return _cachedCameras!;
    } catch (e) {
      debugPrint('CameraService: Failed to get cameras: $e');
      return [];
    }
  }

  /// 指定された設定でカメラを初期化
  Future<CameraController?> initializeCamera(
    CameraDescription camera,
    CameraConfig config,
  ) async {
    final controller = CameraController(
      camera,
      config.resolution,
      enableAudio: config.enableAudio,
      imageFormatGroup: ImageFormatGroup.nv21, // ML処理に効率的なフォーマット
    );

    try {
      await controller.initialize();

      // パフォーマンス向上のためフォーカスモードを固定
      if (controller.value.isInitialized) {
        await controller.setFocusMode(FocusMode.auto);
        await controller.setExposureMode(ExposureMode.auto);
      }

      debugPrint('CameraService: Camera initialized with $config');
      return controller;
    } catch (e) {
      debugPrint('CameraService: Failed to initialize camera: $e');
      await controller.dispose();
      return null;
    }
  }
}
