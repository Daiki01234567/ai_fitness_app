/// Pose Detector Service
///
/// MediaPipe Pose detection service for real-time pose estimation.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
/// Important: Camera footage is NOT sent to server (NFR-015)
library;

import 'dart:async';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart'
    as mlkit;

import 'pose_data.dart';
import 'pose_landmark_type.dart';

/// Pose detector service provider
final poseDetectorServiceProvider = Provider<PoseDetectorService>((ref) {
  return PoseDetectorService();
});

/// Pose detection state provider
final poseDetectionStateProvider =
    StateNotifierProvider<PoseDetectionStateNotifier, PoseDetectionState>((ref) {
  final service = ref.watch(poseDetectorServiceProvider);
  return PoseDetectionStateNotifier(service);
});

/// Pose detection state
class PoseDetectionState {
  const PoseDetectionState({
    this.isInitialized = false,
    this.isProcessing = false,
    this.currentPose,
    this.lastProcessingTimeMs,
    this.errorMessage,
    this.config = PoseDetectionConfig.realtime,
  });

  /// Whether the detector is initialized
  final bool isInitialized;

  /// Whether a frame is currently being processed
  final bool isProcessing;

  /// Current detected pose
  final PoseFrame? currentPose;

  /// Processing time of the last frame in milliseconds
  final int? lastProcessingTimeMs;

  /// Error message if any
  final String? errorMessage;

  /// Current configuration
  final PoseDetectionConfig config;

  /// Check if pose is detected
  bool get hasPose => currentPose?.isPoseDetected ?? false;

  /// Get overall confidence
  double get overallConfidence => currentPose?.overallConfidence ?? 0.0;

  PoseDetectionState copyWith({
    bool? isInitialized,
    bool? isProcessing,
    PoseFrame? currentPose,
    int? lastProcessingTimeMs,
    String? errorMessage,
    PoseDetectionConfig? config,
  }) {
    return PoseDetectionState(
      isInitialized: isInitialized ?? this.isInitialized,
      isProcessing: isProcessing ?? this.isProcessing,
      currentPose: currentPose ?? this.currentPose,
      lastProcessingTimeMs: lastProcessingTimeMs ?? this.lastProcessingTimeMs,
      errorMessage: errorMessage,
      config: config ?? this.config,
    );
  }
}

/// Pose detection state notifier
class PoseDetectionStateNotifier extends StateNotifier<PoseDetectionState> {
  PoseDetectionStateNotifier(this._service) : super(const PoseDetectionState());

  final PoseDetectorService _service;

  /// Initialize pose detector
  Future<bool> initialize([PoseDetectionConfig config = PoseDetectionConfig.realtime]) async {
    try {
      await _service.initialize(config);
      state = state.copyWith(
        isInitialized: true,
        config: config,
        errorMessage: null,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isInitialized: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  /// Process a camera image
  Future<PoseFrame?> processImage(CameraImage image, InputImageRotation rotation) async {
    if (!state.isInitialized || state.isProcessing) {
      return null;
    }

    state = state.copyWith(isProcessing: true);

    try {
      final startTime = DateTime.now().millisecondsSinceEpoch;
      final poseFrame = await _service.processImage(image, rotation);
      final processingTime = DateTime.now().millisecondsSinceEpoch - startTime;

      state = state.copyWith(
        isProcessing: false,
        currentPose: poseFrame,
        lastProcessingTimeMs: processingTime,
        errorMessage: null,
      );

      return poseFrame;
    } catch (e) {
      state = state.copyWith(
        isProcessing: false,
        errorMessage: e.toString(),
      );
      return null;
    }
  }

  /// Close the detector
  Future<void> close() async {
    await _service.close();
    state = const PoseDetectionState();
  }
}

/// Pose detector service
class PoseDetectorService {
  mlkit.PoseDetector? _detector;

  /// Initialize the pose detector
  Future<void> initialize([PoseDetectionConfig config = PoseDetectionConfig.realtime]) async {
    await close(); // Close existing detector if any

    final options = mlkit.PoseDetectorOptions(
      mode: config.mode == PoseDetectionMode.stream
          ? mlkit.PoseDetectionMode.stream
          : mlkit.PoseDetectionMode.single,
      model: config.model == PoseDetectionModel.accurate
          ? mlkit.PoseDetectionModel.accurate
          : mlkit.PoseDetectionModel.base,
    );

    _detector = mlkit.PoseDetector(options: options);
    debugPrint('PoseDetectorService: Initialized with config: $config');
  }

  /// Process a camera image and detect poses
  Future<PoseFrame?> processImage(
    CameraImage image,
    InputImageRotation rotation,
  ) async {
    if (_detector == null) {
      throw StateError('Pose detector not initialized');
    }

    final startTime = DateTime.now().millisecondsSinceEpoch;

    // Convert CameraImage to InputImage
    final inputImage = _convertCameraImage(image, rotation);
    if (inputImage == null) {
      return null;
    }

    // Detect poses
    final poses = await _detector!.processImage(inputImage);

    if (poses.isEmpty) {
      return PoseFrame(
        landmarks: {},
        timestamp: startTime,
        processingTimeMs: DateTime.now().millisecondsSinceEpoch - startTime,
      );
    }

    // Use the first detected pose (single person mode)
    final mlkitPose = poses.first;

    // Convert ML Kit landmarks to our format
    final landmarks = <PoseLandmarkType, PoseLandmark>{};
    for (final mlkitLandmark in mlkitPose.landmarks.values) {
      final type = PoseLandmarkType.fromIndex(mlkitLandmark.type.index);
      landmarks[type] = PoseLandmark(
        type: type,
        x: mlkitLandmark.x / image.width,
        y: mlkitLandmark.y / image.height,
        z: mlkitLandmark.z,
        likelihood: mlkitLandmark.likelihood,
      );
    }

    return PoseFrame(
      landmarks: landmarks,
      timestamp: startTime,
      processingTimeMs: DateTime.now().millisecondsSinceEpoch - startTime,
    );
  }

  /// Convert CameraImage to InputImage
  mlkit.InputImage? _convertCameraImage(
    CameraImage image,
    InputImageRotation rotation,
  ) {
    // Get rotation for ML Kit
    final mlkitRotation = _convertRotation(rotation);

    // Get image format
    final format = _getInputImageFormat(image.format.group);
    if (format == null) {
      debugPrint('PoseDetectorService: Unsupported image format: ${image.format.group}');
      return null;
    }

    // Build metadata
    final metadata = mlkit.InputImageMetadata(
      size: ui.Size(image.width.toDouble(), image.height.toDouble()),
      rotation: mlkitRotation,
      format: format,
      bytesPerRow: image.planes[0].bytesPerRow,
    );

    // Create InputImage from bytes
    return mlkit.InputImage.fromBytes(
      bytes: _concatenatePlanes(image.planes),
      metadata: metadata,
    );
  }

  /// Concatenate image planes into a single byte array
  Uint8List _concatenatePlanes(List<Plane> planes) {
    final bytes = <int>[];
    for (final plane in planes) {
      bytes.addAll(plane.bytes);
    }
    return Uint8List.fromList(bytes);
  }

  /// Convert rotation enum
  mlkit.InputImageRotation _convertRotation(InputImageRotation rotation) {
    switch (rotation) {
      case InputImageRotation.rotation0deg:
        return mlkit.InputImageRotation.rotation0deg;
      case InputImageRotation.rotation90deg:
        return mlkit.InputImageRotation.rotation90deg;
      case InputImageRotation.rotation180deg:
        return mlkit.InputImageRotation.rotation180deg;
      case InputImageRotation.rotation270deg:
        return mlkit.InputImageRotation.rotation270deg;
    }
  }

  /// Get ML Kit input image format
  mlkit.InputImageFormat? _getInputImageFormat(ImageFormatGroup group) {
    switch (group) {
      case ImageFormatGroup.nv21:
        return mlkit.InputImageFormat.nv21;
      case ImageFormatGroup.yuv420:
        return mlkit.InputImageFormat.yuv420;
      case ImageFormatGroup.bgra8888:
        return mlkit.InputImageFormat.bgra8888;
      default:
        return null;
    }
  }

  /// Close the detector and release resources
  Future<void> close() async {
    await _detector?.close();
    _detector = null;
    debugPrint('PoseDetectorService: Closed');
  }
}

/// Input image rotation enum (matches camera rotation)
enum InputImageRotation {
  rotation0deg,
  rotation90deg,
  rotation180deg,
  rotation270deg,
}
