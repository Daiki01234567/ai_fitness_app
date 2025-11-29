/// 姿勢セッションコントローラー
///
/// カメラ、姿勢検出、フレームレート監視を統合します。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-035)
/// 重要: カメラ映像はサーバーに送信されません (NFR-015)
library;

import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../camera/camera_config.dart';
import '../camera/camera_service.dart';
import '../camera/frame_rate_monitor.dart';
import 'pose_data.dart';
import 'pose_detector_service.dart';

/// 姿勢セッションコントローラープロバイダー
final poseSessionControllerProvider =
    StateNotifierProvider<PoseSessionController, PoseSessionState>((ref) {
  final cameraStateNotifier = ref.watch(cameraStateProvider.notifier);
  final poseDetectionNotifier = ref.watch(poseDetectionStateProvider.notifier);
  final frameRateMonitor = ref.watch(frameRateMonitorProvider.notifier);

  return PoseSessionController(
    cameraStateNotifier: cameraStateNotifier,
    poseDetectionNotifier: poseDetectionNotifier,
    frameRateMonitor: frameRateMonitor,
  );
});

/// 姿勢セッション状態
class PoseSessionState {
  const PoseSessionState({
    this.isActive = false,
    this.isInitializing = false,
    this.currentPose,
    this.errorMessage,
    this.sessionStartTime,
    this.totalFramesProcessed = 0,
    this.currentConfig = CameraConfig.highQuality,
  });

  /// セッションがアクティブかどうか
  final bool isActive;

  /// セッションが初期化中かどうか
  final bool isInitializing;

  /// 現在検出された姿勢
  final PoseFrame? currentPose;

  /// エラーメッセージ（ある場合）
  final String? errorMessage;

  /// セッション開始時刻
  final DateTime? sessionStartTime;

  /// このセッションで処理された総フレーム数
  final int totalFramesProcessed;

  /// 現在のカメラ設定
  final CameraConfig currentConfig;

  /// セッションの継続時間
  Duration? get sessionDuration {
    if (sessionStartTime == null) return null;
    return DateTime.now().difference(sessionStartTime!);
  }

  PoseSessionState copyWith({
    bool? isActive,
    bool? isInitializing,
    PoseFrame? currentPose,
    String? errorMessage,
    DateTime? sessionStartTime,
    int? totalFramesProcessed,
    CameraConfig? currentConfig,
  }) {
    return PoseSessionState(
      isActive: isActive ?? this.isActive,
      isInitializing: isInitializing ?? this.isInitializing,
      currentPose: currentPose ?? this.currentPose,
      errorMessage: errorMessage,
      sessionStartTime: sessionStartTime ?? this.sessionStartTime,
      totalFramesProcessed: totalFramesProcessed ?? this.totalFramesProcessed,
      currentConfig: currentConfig ?? this.currentConfig,
    );
  }
}

/// 姿勢セッションコントローラー
class PoseSessionController extends StateNotifier<PoseSessionState> {
  PoseSessionController({
    required CameraStateNotifier cameraStateNotifier,
    required PoseDetectionStateNotifier poseDetectionNotifier,
    required FrameRateMonitorNotifier frameRateMonitor,
  })  : _cameraStateNotifier = cameraStateNotifier,
        _poseDetectionNotifier = poseDetectionNotifier,
        _frameRateMonitor = frameRateMonitor,
        super(const PoseSessionState()) {
    // フォールバックコールバックを設定
    _frameRateMonitor.onFallbackNeeded = _handleFallback;
  }

  final CameraStateNotifier _cameraStateNotifier;
  final PoseDetectionStateNotifier _poseDetectionNotifier;
  final FrameRateMonitorNotifier _frameRateMonitor;

  bool _isProcessingFrame = false;

  /// セッションが現在アクティブかどうか
  bool get isSessionActive => state.isActive;

  /// 姿勢検出セッションを開始
  Future<bool> startSession({
    CameraConfig config = CameraConfig.highQuality,
  }) async {
    if (state.isActive || state.isInitializing) {
      return false;
    }

    state = state.copyWith(
      isInitializing: true,
      errorMessage: null,
    );

    try {
      // 姿勢検出器を初期化
      final poseInitialized = await _poseDetectionNotifier.initialize();
      if (!poseInitialized) {
        state = state.copyWith(
          isInitializing: false,
          errorMessage: 'Failed to initialize pose detector',
        );
        return false;
      }

      // カメラを初期化
      final cameraInitialized = await _cameraStateNotifier.initialize(
        config: config,
        direction: CameraLensDirection.front,
      );

      if (!cameraInitialized) {
        state = state.copyWith(
          isInitializing: false,
          errorMessage: 'Failed to initialize camera',
        );
        return false;
      }

      // 画像ストリームを開始
      await _cameraStateNotifier.startImageStream(_processFrame);

      // フレームレートモニターをリセット
      _frameRateMonitor.reset();

      state = state.copyWith(
        isActive: true,
        isInitializing: false,
        sessionStartTime: DateTime.now(),
        currentConfig: config,
      );

      debugPrint('PoseSessionController: Session started with config: $config');
      return true;
    } catch (e) {
      state = state.copyWith(
        isInitializing: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  /// カメラフレームを処理
  void _processFrame(CameraImage image) {
    // 既に処理中の場合はスキップ（フレームレートを維持するため）
    if (_isProcessingFrame || !state.isActive) {
      _frameRateMonitor.recordDroppedFrame();
      return;
    }

    _isProcessingFrame = true;

    // カメラの向きに基づいて回転を決定
    final rotation = _getImageRotation();

    // フレームを非同期で処理
    _poseDetectionNotifier.processImage(image, rotation).then((poseFrame) {
      if (poseFrame != null) {
        // FPS計算用にフレームを記録
        _frameRateMonitor.recordFrame(poseFrame.timestamp);

        // 新しい姿勢で状態を更新
        state = state.copyWith(
          currentPose: poseFrame,
          totalFramesProcessed: state.totalFramesProcessed + 1,
        );
      }
      _isProcessingFrame = false;
    }).catchError((e) {
      debugPrint('PoseSessionController: Frame processing error: $e');
      _isProcessingFrame = false;
    });
  }

  /// デバイスの向きに基づいて画像回転を取得
  InputImageRotation _getImageRotation() {
    // 前面カメラでは通常270度回転が必要
    // デバイスとカメラの向きに応じて調整が必要な場合あり
    return InputImageRotation.rotation270deg;
  }

  /// パフォーマンスフォールバックを処理
  void _handleFallback(FallbackLevel level) {
    debugPrint('PoseSessionController: Handling fallback level: $level');

    switch (level) {
      case FallbackLevel.none:
        // アクション不要
        break;

      case FallbackLevel.reducedResolution:
        // カメラフォールバックを適用（解像度低下）
        _applyConfigFallback();
        break;

      case FallbackLevel.reducedFps:
        // カメラは既に設定を通じてFPSを処理
        _applyConfigFallback();
        break;

      case FallbackLevel.simplifiedRendering:
        // これはUIレイヤーで処理される
        debugPrint('PoseSessionController: Simplified rendering requested');
        break;
    }
  }

  /// カメラ設定フォールバックを適用
  Future<void> _applyConfigFallback() async {
    final currentConfig = state.currentConfig;
    final fallbackConfig = currentConfig.fallback;

    if (fallbackConfig == null) {
      debugPrint('PoseSessionController: No more fallback configurations available');
      return;
    }

    debugPrint('PoseSessionController: Applying fallback config: $fallbackConfig');

    // 現在のセッションを一時停止
    await pauseSession();

    // フォールバック設定で再初期化
    final success = await _cameraStateNotifier.applyFallback();
    if (success) {
      state = state.copyWith(currentConfig: fallbackConfig);

      // セッションを再開
      await resumeSession();
    }
  }

  /// セッションを一時停止
  Future<void> pauseSession() async {
    if (!state.isActive) return;

    await _cameraStateNotifier.stopImageStream();
    state = state.copyWith(isActive: false);
    debugPrint('PoseSessionController: Session paused');
  }

  /// セッションを再開
  Future<void> resumeSession() async {
    if (state.isActive) return;

    await _cameraStateNotifier.startImageStream(_processFrame);
    state = state.copyWith(isActive: true);
    debugPrint('PoseSessionController: Session resumed');
  }

  /// セッションを停止
  Future<void> stopSession() async {
    await _cameraStateNotifier.stopImageStream();
    await _cameraStateNotifier.disposeCamera();
    await _poseDetectionNotifier.close();

    final summary = _frameRateMonitor.getPerformanceSummary();
    debugPrint('PoseSessionController: Session stopped\n$summary');

    state = const PoseSessionState();
  }

  @override
  void dispose() {
    stopSession();
    super.dispose();
  }
}
