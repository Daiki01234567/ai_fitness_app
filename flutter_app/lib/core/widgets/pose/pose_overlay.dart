/// 姿勢オーバーレイWidget
///
/// カメラプレビューの上にスケルトン可視化を表示します。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../pose/coordinate_transformer.dart';
import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../../pose/pose_session_controller.dart';
import '../../camera/frame_rate_monitor.dart';
import 'pose_painter.dart';

/// 姿勢オーバーレイ設定
class PoseOverlayConfig {
  const PoseOverlayConfig({
    this.showSkeleton = true,
    this.showLandmarks = true,
    this.showConfidence = false,
    this.showDebugInfo = false,
    this.landmarkRadius = 6.0,
    this.boneWidth = 3.0,
    this.highConfidenceColor = Colors.green,
    this.mediumConfidenceColor = Colors.yellow,
    this.lowConfidenceColor = Colors.red,
    this.boneColor = Colors.white,
    this.smoothingEnabled = true,
    this.smoothingFactor = 0.3,
  });

  /// スケルトンボーンを表示するか
  final bool showSkeleton;

  /// ランドマークポイントを表示するか
  final bool showLandmarks;

  /// 信頼度インジケーターを表示するか
  final bool showConfidence;

  /// デバッグ情報を表示するか（FPS、処理時間）
  final bool showDebugInfo;

  /// ランドマーク円の半径
  final double landmarkRadius;

  /// ボーン線の幅
  final double boneWidth;

  /// 高信頼度ランドマークの色（>= 0.7）
  final Color highConfidenceColor;

  /// 中信頼度ランドマークの色（>= 0.5）
  final Color mediumConfidenceColor;

  /// 低信頼度ランドマークの色（< 0.5）
  final Color lowConfidenceColor;

  /// スケルトンボーンの色
  final Color boneColor;

  /// スムージングを有効にするか
  final bool smoothingEnabled;

  /// スムージング係数（0-1、高いほどスムージングが強い）
  final double smoothingFactor;

  PoseOverlayConfig copyWith({
    bool? showSkeleton,
    bool? showLandmarks,
    bool? showConfidence,
    bool? showDebugInfo,
    double? landmarkRadius,
    double? boneWidth,
    Color? highConfidenceColor,
    Color? mediumConfidenceColor,
    Color? lowConfidenceColor,
    Color? boneColor,
    bool? smoothingEnabled,
    double? smoothingFactor,
  }) {
    return PoseOverlayConfig(
      showSkeleton: showSkeleton ?? this.showSkeleton,
      showLandmarks: showLandmarks ?? this.showLandmarks,
      showConfidence: showConfidence ?? this.showConfidence,
      showDebugInfo: showDebugInfo ?? this.showDebugInfo,
      landmarkRadius: landmarkRadius ?? this.landmarkRadius,
      boneWidth: boneWidth ?? this.boneWidth,
      highConfidenceColor: highConfidenceColor ?? this.highConfidenceColor,
      mediumConfidenceColor: mediumConfidenceColor ?? this.mediumConfidenceColor,
      lowConfidenceColor: lowConfidenceColor ?? this.lowConfidenceColor,
      boneColor: boneColor ?? this.boneColor,
      smoothingEnabled: smoothingEnabled ?? this.smoothingEnabled,
      smoothingFactor: smoothingFactor ?? this.smoothingFactor,
    );
  }
}

/// 姿勢オーバーレイ設定プロバイダー
final poseOverlayConfigProvider = StateProvider<PoseOverlayConfig>((ref) {
  return const PoseOverlayConfig();
});

/// 簡易描画モードプロバイダー（パフォーマンスフォールバックでトリガー）
final simplifiedRenderingProvider = StateProvider<bool>((ref) {
  final frameRateState = ref.watch(frameRateMonitorProvider);
  return frameRateState.fallbackLevel == FallbackLevel.simplifiedRendering;
});

/// カメラプレビューの上にスケルトンを表示する姿勢オーバーレイWidget
class PoseOverlay extends ConsumerStatefulWidget {
  const PoseOverlay({
    required this.imageSize,
    this.config = const PoseOverlayConfig(),
    this.onPoseDetected,
    super.key,
  });

  /// カメラ画像のサイズ
  final Size imageSize;

  /// オーバーレイ設定
  final PoseOverlayConfig config;

  /// 姿勢が検出された時のコールバック
  final void Function(PoseFrame)? onPoseDetected;

  @override
  ConsumerState<PoseOverlay> createState() => _PoseOverlayState();
}

class _PoseOverlayState extends ConsumerState<PoseOverlay> {
  /// スムージング用の前の姿勢
  Map<PoseLandmarkType, Offset>? _previousTransformedPose;

  /// 座標変換器
  CoordinateTransformer? _transformer;

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(poseSessionControllerProvider);
    final frameRateState = ref.watch(frameRateMonitorProvider);
    final isSimplified = ref.watch(simplifiedRenderingProvider);

    // 有効な設定を取得（必要に応じて簡略化）
    final effectiveConfig = isSimplified
        ? widget.config.copyWith(
            showConfidence: false,
            showDebugInfo: false,
            smoothingEnabled: false,
          )
        : widget.config;

    return LayoutBuilder(
      builder: (context, constraints) {
        final screenSize = Size(constraints.maxWidth, constraints.maxHeight);

        // 必要に応じてトランスフォーマーを更新
        _transformer = CoordinateTransformer(
          imageSize: widget.imageSize,
          screenSize: screenSize,
        );

        final currentPose = sessionState.currentPose;

        // コールバックに通知
        if (currentPose != null && widget.onPoseDetected != null) {
          widget.onPoseDetected!(currentPose);
        }

        return Stack(
          children: [
            // スケルトンオーバーレイ
            if (currentPose != null && currentPose.isPoseDetected)
              CustomPaint(
                size: screenSize,
                painter: PosePainter(
                  pose: currentPose,
                  transformer: _transformer!,
                  config: effectiveConfig,
                  previousPose: _previousTransformedPose,
                  onPoseTransformed: (transformed) {
                    if (effectiveConfig.smoothingEnabled) {
                      _previousTransformedPose = transformed;
                    }
                  },
                ),
              ),

            // デバッグ情報オーバーレイ
            if (effectiveConfig.showDebugInfo)
              Positioned(
                top: 8,
                left: 8,
                child: _buildDebugInfo(
                  frameRateState,
                  currentPose,
                  isSimplified,
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildDebugInfo(
    FrameRateState frameRateState,
    PoseFrame? currentPose,
    bool isSimplified,
  ) {
    final fpsColor = _getFpsColor(frameRateState.status);

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: fpsColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                'FPS: ${frameRateState.averageFps.toStringAsFixed(1)}',
                style: TextStyle(
                  color: fpsColor,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (currentPose != null) ...[
            const SizedBox(height: 4),
            Text(
              '処理時間: ${currentPose.processingTimeMs}ms',
              style: const TextStyle(color: Colors.white70, fontSize: 10),
            ),
            Text(
              '信頼度: ${(currentPose.overallConfidence * 100).toStringAsFixed(0)}%',
              style: const TextStyle(color: Colors.white70, fontSize: 10),
            ),
            Text(
              '検出点: ${currentPose.reliableLandmarkCount}/${currentPose.landmarks.length}',
              style: const TextStyle(color: Colors.white70, fontSize: 10),
            ),
          ],
          if (isSimplified) ...[
            const SizedBox(height: 4),
            const Text(
              '簡易描画モード',
              style: TextStyle(color: Colors.orange, fontSize: 10),
            ),
          ],
        ],
      ),
    );
  }

  Color _getFpsColor(FrameRateStatus status) {
    switch (status) {
      case FrameRateStatus.good:
        return Colors.green;
      case FrameRateStatus.acceptable:
        return Colors.lightGreen;
      case FrameRateStatus.warning:
        return Colors.orange;
      case FrameRateStatus.critical:
        return Colors.red;
    }
  }
}

/// 低パフォーマンス状況用の簡易姿勢オーバーレイ
class SimplePoseOverlay extends StatelessWidget {
  const SimplePoseOverlay({
    required this.pose,
    required this.transformer,
    this.color = Colors.white,
    super.key,
  });

  final PoseFrame pose;
  final CoordinateTransformer transformer;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (!pose.isPoseDetected) return const SizedBox.shrink();

    return CustomPaint(
      painter: SimplePosePainter(
        pose: pose,
        transformer: transformer,
        color: color,
      ),
    );
  }
}

/// パフォーマンスが重要な状況用の簡易姿勢ペインター
class SimplePosePainter extends CustomPainter {
  SimplePosePainter({
    required this.pose,
    required this.transformer,
    required this.color,
  });

  final PoseFrame pose;
  final CoordinateTransformer transformer;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    // 必須ボーンのみ描画
    final essentialBones = [
      // 胴体
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.rightShoulder),
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftHip),
      (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightHip),
      (PoseLandmarkType.leftHip, PoseLandmarkType.rightHip),
      // 腕
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftElbow),
      (PoseLandmarkType.leftElbow, PoseLandmarkType.leftWrist),
      (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightElbow),
      (PoseLandmarkType.rightElbow, PoseLandmarkType.rightWrist),
      // 脚
      (PoseLandmarkType.leftHip, PoseLandmarkType.leftKnee),
      (PoseLandmarkType.leftKnee, PoseLandmarkType.leftAnkle),
      (PoseLandmarkType.rightHip, PoseLandmarkType.rightKnee),
      (PoseLandmarkType.rightKnee, PoseLandmarkType.rightAnkle),
    ];

    for (final bone in essentialBones) {
      final start = pose.getLandmark(bone.$1);
      final end = pose.getLandmark(bone.$2);

      if (start != null && end != null &&
          start.meetsMinimumThreshold && end.meetsMinimumThreshold) {
        final startPoint = transformer.transformLandmark(start);
        final endPoint = transformer.transformLandmark(end);
        canvas.drawLine(startPoint, endPoint, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant SimplePosePainter oldDelegate) {
    return pose != oldDelegate.pose;
  }
}
