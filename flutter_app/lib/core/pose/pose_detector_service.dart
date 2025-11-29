/// 姿勢検出サービス
///
/// リアルタイム姿勢推定用のMediaPipe Pose検出サービス。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
/// 重要: カメラ映像はサーバーに送信されません (NFR-015)
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

/// 姿勢検出サービスプロバイダー
final poseDetectorServiceProvider = Provider<PoseDetectorService>((ref) {
  return PoseDetectorService();
});

/// 姿勢検出状態プロバイダー
final poseDetectionStateProvider =
    StateNotifierProvider<PoseDetectionStateNotifier, PoseDetectionState>((ref) {
  final service = ref.watch(poseDetectorServiceProvider);
  return PoseDetectionStateNotifier(service);
});

/// 姿勢検出状態
class PoseDetectionState {
  const PoseDetectionState({
    this.isInitialized = false,
    this.isProcessing = false,
    this.currentPose,
    this.lastProcessingTimeMs,
    this.errorMessage,
    this.config = PoseDetectionConfig.realtime,
  });

  /// 検出器が初期化されているか
  final bool isInitialized;

  /// フレームが現在処理中かどうか
  final bool isProcessing;

  /// 現在検出された姿勢
  final PoseFrame? currentPose;

  /// 最後のフレームの処理時間（ミリ秒）
  final int? lastProcessingTimeMs;

  /// エラーメッセージ（ある場合）
  final String? errorMessage;

  /// 現在の設定
  final PoseDetectionConfig config;

  /// 姿勢が検出されたかチェック
  bool get hasPose => currentPose?.isPoseDetected ?? false;

  /// 全体信頼度を取得
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

/// 姿勢検出状態Notifier
class PoseDetectionStateNotifier extends StateNotifier<PoseDetectionState> {
  PoseDetectionStateNotifier(this._service) : super(const PoseDetectionState());

  final PoseDetectorService _service;

  /// 姿勢検出器を初期化
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

  /// カメラ画像を処理
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

  /// 検出器を閉じる
  Future<void> close() async {
    await _service.close();
    state = const PoseDetectionState();
  }
}

/// 姿勢検出サービス
class PoseDetectorService {
  mlkit.PoseDetector? _detector;

  /// 姿勢検出器を初期化
  Future<void> initialize([PoseDetectionConfig config = PoseDetectionConfig.realtime]) async {
    await close(); // 既存の検出器があれば閉じる

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

  /// カメラ画像を処理し姿勢を検出
  Future<PoseFrame?> processImage(
    CameraImage image,
    InputImageRotation rotation,
  ) async {
    if (_detector == null) {
      throw StateError('Pose detector not initialized');
    }

    final startTime = DateTime.now().millisecondsSinceEpoch;

    // CameraImageをInputImageに変換
    final inputImage = _convertCameraImage(image, rotation);
    if (inputImage == null) {
      return null;
    }

    // 姿勢を検出
    final poses = await _detector!.processImage(inputImage);

    if (poses.isEmpty) {
      return PoseFrame(
        landmarks: {},
        timestamp: startTime,
        processingTimeMs: DateTime.now().millisecondsSinceEpoch - startTime,
      );
    }

    // 最初に検出された姿勢を使用（単一人物モード）
    final mlkitPose = poses.first;

    // ML Kitランドマークを独自フォーマットに変換
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

  /// CameraImageをInputImageに変換
  mlkit.InputImage? _convertCameraImage(
    CameraImage image,
    InputImageRotation rotation,
  ) {
    // ML Kit用の回転を取得
    final mlkitRotation = _convertRotation(rotation);

    // 画像フォーマットを取得
    final format = _getInputImageFormat(image.format.group);
    if (format == null) {
      debugPrint('PoseDetectorService: Unsupported image format: ${image.format.group}');
      return null;
    }

    // メタデータを構築
    final metadata = mlkit.InputImageMetadata(
      size: ui.Size(image.width.toDouble(), image.height.toDouble()),
      rotation: mlkitRotation,
      format: format,
      bytesPerRow: image.planes[0].bytesPerRow,
    );

    // バイトからInputImageを作成
    return mlkit.InputImage.fromBytes(
      bytes: _concatenatePlanes(image.planes),
      metadata: metadata,
    );
  }

  /// 画像プレーンを単一のバイト配列に連結
  Uint8List _concatenatePlanes(List<Plane> planes) {
    final bytes = <int>[];
    for (final plane in planes) {
      bytes.addAll(plane.bytes);
    }
    return Uint8List.fromList(bytes);
  }

  /// 回転enumを変換
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

  /// ML Kit入力画像フォーマットを取得
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

  /// 検出器を閉じてリソースを解放
  Future<void> close() async {
    await _detector?.close();
    _detector = null;
    debugPrint('PoseDetectorService: Closed');
  }
}

/// 入力画像回転enum（カメラ回転に一致）
enum InputImageRotation {
  rotation0deg,
  rotation90deg,
  rotation180deg,
  rotation270deg,
}
