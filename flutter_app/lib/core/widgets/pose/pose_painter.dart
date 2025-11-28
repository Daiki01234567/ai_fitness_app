/// Pose Painter
///
/// Custom painter for drawing skeleton landmarks and bones.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../pose/coordinate_transformer.dart';
import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import 'pose_overlay.dart';

/// Skeleton bone connections
class SkeletonBones {
  SkeletonBones._();

  /// All bone connections for full skeleton
  static const List<(PoseLandmarkType, PoseLandmarkType)> all = [
    // Face
    (PoseLandmarkType.leftEar, PoseLandmarkType.leftEye),
    (PoseLandmarkType.leftEye, PoseLandmarkType.nose),
    (PoseLandmarkType.nose, PoseLandmarkType.rightEye),
    (PoseLandmarkType.rightEye, PoseLandmarkType.rightEar),

    // Torso
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.rightShoulder),
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftHip),
    (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightHip),
    (PoseLandmarkType.leftHip, PoseLandmarkType.rightHip),

    // Left arm
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftElbow),
    (PoseLandmarkType.leftElbow, PoseLandmarkType.leftWrist),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftPinky),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftIndex),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftThumb),
    (PoseLandmarkType.leftPinky, PoseLandmarkType.leftIndex),

    // Right arm
    (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightElbow),
    (PoseLandmarkType.rightElbow, PoseLandmarkType.rightWrist),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightPinky),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightIndex),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightThumb),
    (PoseLandmarkType.rightPinky, PoseLandmarkType.rightIndex),

    // Left leg
    (PoseLandmarkType.leftHip, PoseLandmarkType.leftKnee),
    (PoseLandmarkType.leftKnee, PoseLandmarkType.leftAnkle),
    (PoseLandmarkType.leftAnkle, PoseLandmarkType.leftHeel),
    (PoseLandmarkType.leftAnkle, PoseLandmarkType.leftFootIndex),
    (PoseLandmarkType.leftHeel, PoseLandmarkType.leftFootIndex),

    // Right leg
    (PoseLandmarkType.rightHip, PoseLandmarkType.rightKnee),
    (PoseLandmarkType.rightKnee, PoseLandmarkType.rightAnkle),
    (PoseLandmarkType.rightAnkle, PoseLandmarkType.rightHeel),
    (PoseLandmarkType.rightAnkle, PoseLandmarkType.rightFootIndex),
    (PoseLandmarkType.rightHeel, PoseLandmarkType.rightFootIndex),
  ];

  /// Essential bones only (for simplified rendering)
  static const List<(PoseLandmarkType, PoseLandmarkType)> essential = [
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
}

/// Custom painter for pose skeleton
class PosePainter extends CustomPainter {
  PosePainter({
    required this.pose,
    required this.transformer,
    required this.config,
    this.previousPose,
    this.onPoseTransformed,
  });

  final PoseFrame pose;
  final CoordinateTransformer transformer;
  final PoseOverlayConfig config;
  final Map<PoseLandmarkType, Offset>? previousPose;
  final void Function(Map<PoseLandmarkType, Offset>)? onPoseTransformed;

  @override
  void paint(Canvas canvas, Size size) {
    if (!pose.isPoseDetected) return;

    // Transform all landmarks
    final transformedLandmarks = _transformAndSmooth();

    // Notify callback
    onPoseTransformed?.call(transformedLandmarks);

    // Draw bones first (so landmarks appear on top)
    if (config.showSkeleton) {
      _drawBones(canvas, transformedLandmarks);
    }

    // Draw landmarks
    if (config.showLandmarks) {
      _drawLandmarks(canvas, transformedLandmarks);
    }
  }

  Map<PoseLandmarkType, Offset> _transformAndSmooth() {
    final transformed = <PoseLandmarkType, Offset>{};

    for (final entry in pose.landmarks.entries) {
      var point = transformer.transformLandmark(entry.value);

      // Apply smoothing if enabled and we have previous data
      if (config.smoothingEnabled && previousPose != null) {
        final previousPoint = previousPose![entry.key];
        if (previousPoint != null) {
          point = Offset(
            _lerp(previousPoint.dx, point.dx, 1 - config.smoothingFactor),
            _lerp(previousPoint.dy, point.dy, 1 - config.smoothingFactor),
          );
        }
      }

      transformed[entry.key] = point;
    }

    return transformed;
  }

  double _lerp(double a, double b, double t) {
    return a + (b - a) * t;
  }

  void _drawBones(Canvas canvas, Map<PoseLandmarkType, Offset> landmarks) {
    final bonePaint = Paint()
      ..color = config.boneColor
      ..strokeWidth = config.boneWidth
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final bone in SkeletonBones.all) {
      final startLandmark = pose.getLandmark(bone.$1);
      final endLandmark = pose.getLandmark(bone.$2);

      if (startLandmark == null || endLandmark == null) continue;
      if (!startLandmark.meetsMinimumThreshold || !endLandmark.meetsMinimumThreshold) continue;

      final startPoint = landmarks[bone.$1];
      final endPoint = landmarks[bone.$2];

      if (startPoint == null || endPoint == null) continue;

      // Apply gradient based on confidence
      if (config.showConfidence) {
        bonePaint.shader = ui.Gradient.linear(
          startPoint,
          endPoint,
          [
            _getConfidenceColor(startLandmark.likelihood),
            _getConfidenceColor(endLandmark.likelihood),
          ],
        );
      }

      canvas.drawLine(startPoint, endPoint, bonePaint);
    }
  }

  void _drawLandmarks(Canvas canvas, Map<PoseLandmarkType, Offset> landmarks) {
    for (final entry in pose.landmarks.entries) {
      final landmark = entry.value;
      final point = landmarks[entry.key];

      if (point == null) continue;
      if (!landmark.meetsMinimumThreshold) continue;

      final color = config.showConfidence
          ? _getConfidenceColor(landmark.likelihood)
          : config.highConfidenceColor;

      // Draw outer circle (border)
      final outerPaint = Paint()
        ..color = Colors.black.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawCircle(point, config.landmarkRadius + 1, outerPaint);

      // Draw inner circle (fill)
      final innerPaint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;
      canvas.drawCircle(point, config.landmarkRadius, innerPaint);

      // Draw confidence text if enabled
      if (config.showConfidence && landmark.isReliable) {
        _drawConfidenceText(canvas, point, landmark.likelihood);
      }
    }
  }

  void _drawConfidenceText(Canvas canvas, Offset point, double confidence) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: '${(confidence * 100).toInt()}',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 8,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        point.dx - textPainter.width / 2,
        point.dy + config.landmarkRadius + 2,
      ),
    );
  }

  Color _getConfidenceColor(double confidence) {
    if (confidence >= 0.7) {
      return config.highConfidenceColor;
    } else if (confidence >= 0.5) {
      return config.mediumConfidenceColor;
    } else {
      return config.lowConfidenceColor;
    }
  }

  @override
  bool shouldRepaint(covariant PosePainter oldDelegate) {
    return pose != oldDelegate.pose ||
        config != oldDelegate.config ||
        previousPose != oldDelegate.previousPose;
  }
}

/// Painter for highlighting specific landmarks (e.g., for exercise feedback)
class HighlightPainter extends CustomPainter {
  HighlightPainter({
    required this.landmarks,
    required this.transformer,
    required this.pose,
    this.color = Colors.blue,
    this.pulseAnimation,
  });

  final List<PoseLandmarkType> landmarks;
  final CoordinateTransformer transformer;
  final PoseFrame pose;
  final Color color;
  final Animation<double>? pulseAnimation;

  @override
  void paint(Canvas canvas, Size size) {
    final baseRadius = 12.0;
    final radius = pulseAnimation != null
        ? baseRadius + (pulseAnimation!.value * 4)
        : baseRadius;

    final paint = Paint()
      ..color = color.withValues(alpha: 0.6)
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;

    for (final landmarkType in landmarks) {
      final landmark = pose.getLandmark(landmarkType);
      if (landmark == null || !landmark.meetsMinimumThreshold) continue;

      final point = transformer.transformLandmark(landmark);

      // Draw glow effect
      final glowPaint = Paint()
        ..color = color.withValues(alpha: 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
      canvas.drawCircle(point, radius + 4, glowPaint);

      // Draw highlight circle
      canvas.drawCircle(point, radius, paint);
      canvas.drawCircle(point, radius, strokePaint);
    }
  }

  @override
  bool shouldRepaint(covariant HighlightPainter oldDelegate) {
    return pose != oldDelegate.pose ||
        landmarks != oldDelegate.landmarks ||
        pulseAnimation?.value != oldDelegate.pulseAnimation?.value;
  }
}

/// Painter for drawing angle indicators
class AnglePainter extends CustomPainter {
  AnglePainter({
    required this.vertex,
    required this.point1,
    required this.point2,
    required this.angle,
    this.color = Colors.cyan,
    this.showValue = true,
  });

  final Offset vertex;
  final Offset point1;
  final Offset point2;
  final double angle;
  final Color color;
  final bool showValue;

  @override
  void paint(Canvas canvas, Size size) {
    // Draw arc
    final arcPaint = Paint()
      ..color = color.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final radius = 30.0;
    final startAngle = (point1 - vertex).direction;
    final sweepAngle = angle * 3.14159 / 180;

    final path = Path()
      ..moveTo(vertex.dx, vertex.dy)
      ..arcTo(
        Rect.fromCircle(center: vertex, radius: radius),
        startAngle,
        sweepAngle,
        false,
      )
      ..close();

    canvas.drawPath(path, arcPaint);

    // Draw arc border
    final borderPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    canvas.drawArc(
      Rect.fromCircle(center: vertex, radius: radius),
      startAngle,
      sweepAngle,
      false,
      borderPaint,
    );

    // Draw angle value
    if (showValue) {
      final textPainter = TextPainter(
        text: TextSpan(
          text: '${angle.toInt()}°',
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();

      // Position text outside the arc
      final textAngle = startAngle + sweepAngle / 2;
      final textRadius = radius + 15;
      final textOffset = Offset(
        vertex.dx + textRadius * cosine(textAngle) - textPainter.width / 2,
        vertex.dy + textRadius * sine(textAngle) - textPainter.height / 2,
      );

      textPainter.paint(canvas, textOffset);
    }
  }

  double cosine(double radians) => radians.isNaN ? 0 :
      (radians >= 0 ? 1 : -1) * (1 - (radians * radians / 2));
  double sine(double radians) => radians.isNaN ? 0 : radians;

  @override
  bool shouldRepaint(covariant AnglePainter oldDelegate) {
    return vertex != oldDelegate.vertex ||
        point1 != oldDelegate.point1 ||
        point2 != oldDelegate.point2 ||
        angle != oldDelegate.angle;
  }
}
