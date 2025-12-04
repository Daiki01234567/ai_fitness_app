/// 姿勢ペインター
///
/// スケルトンランドマークとボーンを描画するためのカスタムペインター。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../pose/coordinate_transformer.dart';
import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import 'pose_overlay.dart';

/// スケルトンボーン接続
class SkeletonBones {
  SkeletonBones._();

  /// 全スケルトン用の全ボーン接続
  static const List<(PoseLandmarkType, PoseLandmarkType)> all = [
    // 顔
    (PoseLandmarkType.leftEar, PoseLandmarkType.leftEye),
    (PoseLandmarkType.leftEye, PoseLandmarkType.nose),
    (PoseLandmarkType.nose, PoseLandmarkType.rightEye),
    (PoseLandmarkType.rightEye, PoseLandmarkType.rightEar),

    // 胴体
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.rightShoulder),
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftHip),
    (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightHip),
    (PoseLandmarkType.leftHip, PoseLandmarkType.rightHip),

    // 左腕
    (PoseLandmarkType.leftShoulder, PoseLandmarkType.leftElbow),
    (PoseLandmarkType.leftElbow, PoseLandmarkType.leftWrist),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftPinky),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftIndex),
    (PoseLandmarkType.leftWrist, PoseLandmarkType.leftThumb),
    (PoseLandmarkType.leftPinky, PoseLandmarkType.leftIndex),

    // 右腕
    (PoseLandmarkType.rightShoulder, PoseLandmarkType.rightElbow),
    (PoseLandmarkType.rightElbow, PoseLandmarkType.rightWrist),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightPinky),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightIndex),
    (PoseLandmarkType.rightWrist, PoseLandmarkType.rightThumb),
    (PoseLandmarkType.rightPinky, PoseLandmarkType.rightIndex),

    // 左脚
    (PoseLandmarkType.leftHip, PoseLandmarkType.leftKnee),
    (PoseLandmarkType.leftKnee, PoseLandmarkType.leftAnkle),
    (PoseLandmarkType.leftAnkle, PoseLandmarkType.leftHeel),
    (PoseLandmarkType.leftAnkle, PoseLandmarkType.leftFootIndex),
    (PoseLandmarkType.leftHeel, PoseLandmarkType.leftFootIndex),

    // 右脚
    (PoseLandmarkType.rightHip, PoseLandmarkType.rightKnee),
    (PoseLandmarkType.rightKnee, PoseLandmarkType.rightAnkle),
    (PoseLandmarkType.rightAnkle, PoseLandmarkType.rightHeel),
    (PoseLandmarkType.rightAnkle, PoseLandmarkType.rightFootIndex),
    (PoseLandmarkType.rightHeel, PoseLandmarkType.rightFootIndex),
  ];

  /// 必須ボーンのみ（簡易描画用）
  static const List<(PoseLandmarkType, PoseLandmarkType)> essential = [
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
}

/// 姿勢スケルトン用のカスタムペインター
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

    // すべてのランドマークを変換
    final transformedLandmarks = _transformAndSmooth();

    // コールバックに通知
    onPoseTransformed?.call(transformedLandmarks);

    // まずボーンを描画（ランドマークが上に表示されるように）
    if (config.showSkeleton) {
      _drawBones(canvas, transformedLandmarks);
    }

    // ランドマークを描画
    if (config.showLandmarks) {
      _drawLandmarks(canvas, transformedLandmarks);
    }
  }

  Map<PoseLandmarkType, Offset> _transformAndSmooth() {
    final transformed = <PoseLandmarkType, Offset>{};

    for (final entry in pose.landmarks.entries) {
      var point = transformer.transformLandmark(entry.value);

      // スムージングが有効で前のデータがあれば適用
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
      if (!startLandmark.meetsMinimumThreshold ||
          !endLandmark.meetsMinimumThreshold) {
        continue;
      }

      final startPoint = landmarks[bone.$1];
      final endPoint = landmarks[bone.$2];

      if (startPoint == null || endPoint == null) continue;

      // 信頼度に基づいてグラデーションを適用
      if (config.showConfidence) {
        bonePaint.shader = ui.Gradient.linear(startPoint, endPoint, [
          _getConfidenceColor(startLandmark.likelihood),
          _getConfidenceColor(endLandmark.likelihood),
        ]);
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

      // 外側の円を描画（境界線）
      final outerPaint = Paint()
        ..color = Colors.black.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawCircle(point, config.landmarkRadius + 1, outerPaint);

      // 内側の円を描画（塗りつぶし）
      final innerPaint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;
      canvas.drawCircle(point, config.landmarkRadius, innerPaint);

      // 有効な場合は信頼度テキストを描画
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

/// 特定のランドマークを強調表示するためのペインター（例：エクササイズフィードバック用）
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

      // グローエフェクトを描画
      final glowPaint = Paint()
        ..color = color.withValues(alpha: 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
      canvas.drawCircle(point, radius + 4, glowPaint);

      // ハイライト円を描画
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

/// 角度インジケーターを描画するためのペインター
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
    // 弧を描画
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

    // 弧の境界線を描画
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

    // 角度値を描画
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

      // テキストを弧の外側に配置
      final textAngle = startAngle + sweepAngle / 2;
      final textRadius = radius + 15;
      final textOffset = Offset(
        vertex.dx + textRadius * cosine(textAngle) - textPainter.width / 2,
        vertex.dy + textRadius * sine(textAngle) - textPainter.height / 2,
      );

      textPainter.paint(canvas, textOffset);
    }
  }

  double cosine(double radians) => radians.isNaN
      ? 0
      : (radians >= 0 ? 1 : -1) * (1 - (radians * radians / 2));
  double sine(double radians) => radians.isNaN ? 0 : radians;

  @override
  bool shouldRepaint(covariant AnglePainter oldDelegate) {
    return vertex != oldDelegate.vertex ||
        point1 != oldDelegate.point1 ||
        point2 != oldDelegate.point2 ||
        angle != oldDelegate.angle;
  }
}
