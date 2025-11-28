/// Coordinate Transformer
///
/// Transforms pose landmark coordinates between coordinate systems.
/// Handles camera-to-screen conversion, mirroring, and rotation.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/painting.dart';

import 'pose_data.dart';
import 'pose_landmark_type.dart';

/// Coordinate transformer for pose landmarks
class CoordinateTransformer {
  const CoordinateTransformer({
    required this.imageSize,
    required this.screenSize,
    this.cameraLensDirection = CameraLensDirection.front,
    this.deviceOrientation = DeviceOrientation.portraitUp,
    this.sensorOrientation = 90,
  });

  /// Original image size from camera
  final Size imageSize;

  /// Target screen size for display
  final Size screenSize;

  /// Camera lens direction (front/back)
  final CameraLensDirection cameraLensDirection;

  /// Current device orientation
  final DeviceOrientation deviceOrientation;

  /// Camera sensor orientation in degrees
  final int sensorOrientation;

  /// Whether to mirror coordinates (for front camera)
  bool get shouldMirror => cameraLensDirection == CameraLensDirection.front;

  /// Get rotation angle based on device and sensor orientation
  int get rotationAngle {
    final deviceRotation = _deviceOrientationToDegrees(deviceOrientation);

    if (cameraLensDirection == CameraLensDirection.front) {
      return (sensorOrientation + deviceRotation) % 360;
    } else {
      return (sensorOrientation - deviceRotation + 360) % 360;
    }
  }

  /// Transform a single landmark to screen coordinates
  Offset transformLandmark(PoseLandmark landmark) {
    // Normalized coordinates are already 0.0-1.0
    var x = landmark.x;
    var y = landmark.y;

    // Apply rotation if needed
    final rotatedPoint = _rotatePoint(x, y, rotationAngle);
    x = rotatedPoint.dx;
    y = rotatedPoint.dy;

    // Mirror for front camera
    if (shouldMirror) {
      x = 1.0 - x;
    }

    // Scale to screen size
    return Offset(x * screenSize.width, y * screenSize.height);
  }

  /// Transform all landmarks in a pose frame
  Map<PoseLandmarkType, Offset> transformPoseFrame(PoseFrame frame) {
    final transformed = <PoseLandmarkType, Offset>{};

    for (final entry in frame.landmarks.entries) {
      transformed[entry.key] = transformLandmark(entry.value);
    }

    return transformed;
  }

  /// Get the bounding box containing all landmarks
  Rect? getBoundingBox(PoseFrame frame, {double padding = 0.1}) {
    if (frame.landmarks.isEmpty) return null;

    final transformedPoints = transformPoseFrame(frame);
    if (transformedPoints.isEmpty) return null;

    var minX = double.infinity;
    var minY = double.infinity;
    var maxX = double.negativeInfinity;
    var maxY = double.negativeInfinity;

    for (final point in transformedPoints.values) {
      minX = math.min(minX, point.dx);
      minY = math.min(minY, point.dy);
      maxX = math.max(maxX, point.dx);
      maxY = math.max(maxY, point.dy);
    }

    // Add padding
    final paddingX = (maxX - minX) * padding;
    final paddingY = (maxY - minY) * padding;

    return Rect.fromLTRB(
      math.max(0, minX - paddingX),
      math.max(0, minY - paddingY),
      math.min(screenSize.width, maxX + paddingX),
      math.min(screenSize.height, maxY + paddingY),
    );
  }

  /// Calculate aspect ratio fit for camera preview
  Size getPreviewSize({BoxFit fit = BoxFit.cover}) {
    final imageAspectRatio = imageSize.width / imageSize.height;
    final screenAspectRatio = screenSize.width / screenSize.height;

    switch (fit) {
      case BoxFit.cover:
        if (imageAspectRatio > screenAspectRatio) {
          return Size(
            screenSize.height * imageAspectRatio,
            screenSize.height,
          );
        } else {
          return Size(
            screenSize.width,
            screenSize.width / imageAspectRatio,
          );
        }
      case BoxFit.contain:
        if (imageAspectRatio > screenAspectRatio) {
          return Size(
            screenSize.width,
            screenSize.width / imageAspectRatio,
          );
        } else {
          return Size(
            screenSize.height * imageAspectRatio,
            screenSize.height,
          );
        }
      default:
        return screenSize;
    }
  }

  /// Create a copy with updated parameters
  CoordinateTransformer copyWith({
    Size? imageSize,
    Size? screenSize,
    CameraLensDirection? cameraLensDirection,
    DeviceOrientation? deviceOrientation,
    int? sensorOrientation,
  }) {
    return CoordinateTransformer(
      imageSize: imageSize ?? this.imageSize,
      screenSize: screenSize ?? this.screenSize,
      cameraLensDirection: cameraLensDirection ?? this.cameraLensDirection,
      deviceOrientation: deviceOrientation ?? this.deviceOrientation,
      sensorOrientation: sensorOrientation ?? this.sensorOrientation,
    );
  }

  /// Rotate a point by the given angle
  Offset _rotatePoint(double x, double y, int angleDegrees) {
    if (angleDegrees == 0) return Offset(x, y);

    // Center the coordinates around 0.5, 0.5
    final cx = x - 0.5;
    final cy = y - 0.5;

    final radians = angleDegrees * math.pi / 180;
    final cosA = math.cos(radians);
    final sinA = math.sin(radians);

    // Rotate
    final newX = cx * cosA - cy * sinA;
    final newY = cx * sinA + cy * cosA;

    // Move back
    return Offset(newX + 0.5, newY + 0.5);
  }

  /// Convert DeviceOrientation to degrees
  int _deviceOrientationToDegrees(DeviceOrientation orientation) {
    switch (orientation) {
      case DeviceOrientation.portraitUp:
        return 0;
      case DeviceOrientation.landscapeLeft:
        return 90;
      case DeviceOrientation.portraitDown:
        return 180;
      case DeviceOrientation.landscapeRight:
        return 270;
    }
  }
}

/// Device orientation enum
enum DeviceOrientation {
  portraitUp,
  landscapeLeft,
  portraitDown,
  landscapeRight,
}

/// Extension for angle calculations
extension AngleExtension on CoordinateTransformer {
  /// Calculate angle between three landmarks (in degrees)
  double? calculateAngle(
    PoseFrame frame,
    PoseLandmarkType point1,
    PoseLandmarkType vertex,
    PoseLandmarkType point2,
  ) {
    final p1 = frame.getLandmark(point1);
    final v = frame.getLandmark(vertex);
    final p2 = frame.getLandmark(point2);

    if (p1 == null || v == null || p2 == null) return null;
    if (!p1.meetsMinimumThreshold ||
        !v.meetsMinimumThreshold ||
        !p2.meetsMinimumThreshold) {
      return null;
    }

    // Calculate vectors
    final v1 = Offset(p1.x - v.x, p1.y - v.y);
    final v2 = Offset(p2.x - v.x, p2.y - v.y);

    // Calculate angle using dot product
    final dot = v1.dx * v2.dx + v1.dy * v2.dy;
    final mag1 = math.sqrt(v1.dx * v1.dx + v1.dy * v1.dy);
    final mag2 = math.sqrt(v2.dx * v2.dx + v2.dy * v2.dy);

    if (mag1 == 0 || mag2 == 0) return null;

    final cosAngle = dot / (mag1 * mag2);
    final clampedCos = cosAngle.clamp(-1.0, 1.0);
    final angleRadians = math.acos(clampedCos);

    return angleRadians * 180 / math.pi;
  }

  /// Calculate distance between two landmarks (normalized)
  double? calculateDistance(
    PoseFrame frame,
    PoseLandmarkType point1,
    PoseLandmarkType point2,
  ) {
    final p1 = frame.getLandmark(point1);
    final p2 = frame.getLandmark(point2);

    if (p1 == null || p2 == null) return null;
    if (!p1.meetsMinimumThreshold || !p2.meetsMinimumThreshold) return null;

    final dx = p2.x - p1.x;
    final dy = p2.y - p1.y;
    return math.sqrt(dx * dx + dy * dy);
  }

  /// Check if a landmark is above another (smaller y value)
  bool? isAbove(
    PoseFrame frame,
    PoseLandmarkType upper,
    PoseLandmarkType lower,
  ) {
    final p1 = frame.getLandmark(upper);
    final p2 = frame.getLandmark(lower);

    if (p1 == null || p2 == null) return null;
    if (!p1.meetsMinimumThreshold || !p2.meetsMinimumThreshold) return null;

    return p1.y < p2.y;
  }

  /// Calculate midpoint between two landmarks
  Offset? getMidpoint(
    PoseFrame frame,
    PoseLandmarkType point1,
    PoseLandmarkType point2,
  ) {
    final p1 = frame.getLandmark(point1);
    final p2 = frame.getLandmark(point2);

    if (p1 == null || p2 == null) return null;
    if (!p1.meetsMinimumThreshold || !p2.meetsMinimumThreshold) return null;

    return Offset((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }
}
