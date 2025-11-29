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

import 'camera_config.dart';

/// カメラサービスプロバイダー
final cameraServiceProvider = Provider<CameraService>((ref) {
  return CameraService();
});

/// カメラ状態プロバイダー
final cameraStateProvider = StateNotifierProvider<CameraStateNotifier, CameraServiceState>((ref) {
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
  });

  final CameraState state;
  final CameraController? controller;
  final CameraConfig? currentConfig;
  final List<CameraDescription> availableCameras;
  final String? errorMessage;

  bool get isReady => state == CameraState.ready;
  bool get isInitializing => state == CameraState.initializing;
  bool get hasError => state == CameraState.error;

  CameraServiceState copyWith({
    CameraState? state,
    CameraController? controller,
    CameraConfig? currentConfig,
    List<CameraDescription>? availableCameras,
    String? errorMessage,
  }) {
    return CameraServiceState(
      state: state ?? this.state,
      controller: controller ?? this.controller,
      currentConfig: currentConfig ?? this.currentConfig,
      availableCameras: availableCameras ?? this.availableCameras,
      errorMessage: errorMessage,
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
      final cameras = await _cameraService.getAvailableCameras();
      if (cameras.isEmpty) {
        state = state.copyWith(
          state: CameraState.error,
          errorMessage: 'No cameras available on this device',
        );
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
        );
        return true;
      } else {
        state = state.copyWith(
          state: CameraState.error,
          errorMessage: 'Failed to initialize camera',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        state: CameraState.error,
        errorMessage: e.toString(),
      );
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

  /// フォールバック設定を適用（低解像度/FPS）
  Future<bool> applyFallback() async {
    final currentConfig = state.currentConfig;
    if (currentConfig == null) return false;

    final fallbackConfig = currentConfig.fallback;
    if (fallbackConfig == null) {
      // これ以上のフォールバックは利用不可
      return false;
    }

    debugPrint('CameraService: Applying fallback from $currentConfig to $fallbackConfig');

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
    state = state.copyWith(
      state: CameraState.disposed,
      controller: null,
    );
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
