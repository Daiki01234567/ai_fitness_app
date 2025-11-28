/// Pose Session Controller
///
/// Integrates camera, pose detection, and frame rate monitoring.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-035)
/// Important: Camera footage is NOT sent to server (NFR-015)
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

/// Pose session controller provider
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

/// Pose session state
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

  /// Whether the session is active
  final bool isActive;

  /// Whether the session is initializing
  final bool isInitializing;

  /// Current detected pose
  final PoseFrame? currentPose;

  /// Error message if any
  final String? errorMessage;

  /// Session start time
  final DateTime? sessionStartTime;

  /// Total frames processed in this session
  final int totalFramesProcessed;

  /// Current camera configuration
  final CameraConfig currentConfig;

  /// Duration of the session
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

/// Pose session controller
class PoseSessionController extends StateNotifier<PoseSessionState> {
  PoseSessionController({
    required CameraStateNotifier cameraStateNotifier,
    required PoseDetectionStateNotifier poseDetectionNotifier,
    required FrameRateMonitorNotifier frameRateMonitor,
  })  : _cameraStateNotifier = cameraStateNotifier,
        _poseDetectionNotifier = poseDetectionNotifier,
        _frameRateMonitor = frameRateMonitor,
        super(const PoseSessionState()) {
    // Set up fallback callback
    _frameRateMonitor.onFallbackNeeded = _handleFallback;
  }

  final CameraStateNotifier _cameraStateNotifier;
  final PoseDetectionStateNotifier _poseDetectionNotifier;
  final FrameRateMonitorNotifier _frameRateMonitor;

  bool _isProcessingFrame = false;

  /// Whether the session is currently active
  bool get isSessionActive => state.isActive;

  /// Start a pose detection session
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
      // Initialize pose detector
      final poseInitialized = await _poseDetectionNotifier.initialize();
      if (!poseInitialized) {
        state = state.copyWith(
          isInitializing: false,
          errorMessage: 'Failed to initialize pose detector',
        );
        return false;
      }

      // Initialize camera
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

      // Start image stream
      await _cameraStateNotifier.startImageStream(_processFrame);

      // Reset frame rate monitor
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

  /// Process a camera frame
  void _processFrame(CameraImage image) {
    // Skip if already processing (to maintain frame rate)
    if (_isProcessingFrame || !state.isActive) {
      _frameRateMonitor.recordDroppedFrame();
      return;
    }

    _isProcessingFrame = true;

    // Determine rotation based on camera orientation
    final rotation = _getImageRotation();

    // Process frame asynchronously
    _poseDetectionNotifier.processImage(image, rotation).then((poseFrame) {
      if (poseFrame != null) {
        // Record frame for FPS calculation
        _frameRateMonitor.recordFrame(poseFrame.timestamp);

        // Update state with new pose
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

  /// Get image rotation based on device orientation
  InputImageRotation _getImageRotation() {
    // For front camera, we typically need 270 degree rotation
    // This may need adjustment based on device and camera orientation
    return InputImageRotation.rotation270deg;
  }

  /// Handle performance fallback
  void _handleFallback(FallbackLevel level) {
    debugPrint('PoseSessionController: Handling fallback level: $level');

    switch (level) {
      case FallbackLevel.none:
        // No action needed
        break;

      case FallbackLevel.reducedResolution:
        // Apply camera fallback (reduced resolution)
        _applyConfigFallback();
        break;

      case FallbackLevel.reducedFps:
        // Camera already handles FPS through config
        _applyConfigFallback();
        break;

      case FallbackLevel.simplifiedRendering:
        // This is handled by the UI layer
        debugPrint('PoseSessionController: Simplified rendering requested');
        break;
    }
  }

  /// Apply camera configuration fallback
  Future<void> _applyConfigFallback() async {
    final currentConfig = state.currentConfig;
    final fallbackConfig = currentConfig.fallback;

    if (fallbackConfig == null) {
      debugPrint('PoseSessionController: No more fallback configurations available');
      return;
    }

    debugPrint('PoseSessionController: Applying fallback config: $fallbackConfig');

    // Pause current session
    await pauseSession();

    // Re-initialize with fallback config
    final success = await _cameraStateNotifier.applyFallback();
    if (success) {
      state = state.copyWith(currentConfig: fallbackConfig);

      // Resume session
      await resumeSession();
    }
  }

  /// Pause the session
  Future<void> pauseSession() async {
    if (!state.isActive) return;

    await _cameraStateNotifier.stopImageStream();
    state = state.copyWith(isActive: false);
    debugPrint('PoseSessionController: Session paused');
  }

  /// Resume the session
  Future<void> resumeSession() async {
    if (state.isActive) return;

    await _cameraStateNotifier.startImageStream(_processFrame);
    state = state.copyWith(isActive: true);
    debugPrint('PoseSessionController: Session resumed');
  }

  /// Stop the session
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
