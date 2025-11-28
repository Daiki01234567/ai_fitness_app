/// Pose Overlay Widget
///
/// Displays skeleton visualization over camera preview.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../pose/coordinate_transformer.dart';
import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../../pose/pose_session_controller.dart';
import '../../camera/frame_rate_monitor.dart';
import 'pose_painter.dart';

/// Pose overlay configuration
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

  /// Whether to show skeleton bones
  final bool showSkeleton;

  /// Whether to show landmark points
  final bool showLandmarks;

  /// Whether to show confidence indicators
  final bool showConfidence;

  /// Whether to show debug information (FPS, processing time)
  final bool showDebugInfo;

  /// Radius of landmark circles
  final double landmarkRadius;

  /// Width of bone lines
  final double boneWidth;

  /// Color for high confidence landmarks (>= 0.7)
  final Color highConfidenceColor;

  /// Color for medium confidence landmarks (>= 0.5)
  final Color mediumConfidenceColor;

  /// Color for low confidence landmarks (< 0.5)
  final Color lowConfidenceColor;

  /// Color for skeleton bones
  final Color boneColor;

  /// Whether to enable smoothing
  final bool smoothingEnabled;

  /// Smoothing factor (0-1, higher = more smoothing)
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

/// Pose overlay configuration provider
final poseOverlayConfigProvider = StateProvider<PoseOverlayConfig>((ref) {
  return const PoseOverlayConfig();
});

/// Simplified rendering mode provider (triggered by performance fallback)
final simplifiedRenderingProvider = StateProvider<bool>((ref) {
  final frameRateState = ref.watch(frameRateMonitorProvider);
  return frameRateState.fallbackLevel == FallbackLevel.simplifiedRendering;
});

/// Pose overlay widget that displays skeleton over camera preview
class PoseOverlay extends ConsumerStatefulWidget {
  const PoseOverlay({
    required this.imageSize,
    this.config = const PoseOverlayConfig(),
    this.onPoseDetected,
    super.key,
  });

  /// Size of the camera image
  final Size imageSize;

  /// Overlay configuration
  final PoseOverlayConfig config;

  /// Callback when pose is detected
  final void Function(PoseFrame)? onPoseDetected;

  @override
  ConsumerState<PoseOverlay> createState() => _PoseOverlayState();
}

class _PoseOverlayState extends ConsumerState<PoseOverlay> {
  /// Previous pose for smoothing
  Map<PoseLandmarkType, Offset>? _previousTransformedPose;

  /// Coordinate transformer
  CoordinateTransformer? _transformer;

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(poseSessionControllerProvider);
    final frameRateState = ref.watch(frameRateMonitorProvider);
    final isSimplified = ref.watch(simplifiedRenderingProvider);

    // Get effective config (simplified if needed)
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

        // Update transformer if needed
        _transformer = CoordinateTransformer(
          imageSize: widget.imageSize,
          screenSize: screenSize,
        );

        final currentPose = sessionState.currentPose;

        // Notify callback
        if (currentPose != null && widget.onPoseDetected != null) {
          widget.onPoseDetected!(currentPose);
        }

        return Stack(
          children: [
            // Skeleton overlay
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

            // Debug info overlay
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

/// Simplified pose overlay for low-performance situations
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

/// Simple pose painter for performance-critical situations
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

    // Draw only essential bones
    final essentialBones = [
      // Torso
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.rightShoulder),
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftHip),
      (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightHip),
      (PoseLandmarkType.leftHip, PoseLandmarkType.rightHip),
      // Arms
      (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftElbow),
      (PoseLandmarkType.leftElbow, PoseLandmarkType.leftWrist),
      (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightElbow),
      (PoseLandmarkType.rightElbow, PoseLandmarkType.rightWrist),
      // Legs
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
