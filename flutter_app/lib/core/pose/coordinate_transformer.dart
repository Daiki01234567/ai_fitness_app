/// 座標変換器
///
/// 姿勢ランドマーク座標を座標系間で変換します。
/// カメラから画面への変換、ミラーリング、回転を処理します。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/painting.dart';

import 'pose_data.dart';
import 'pose_landmark_type.dart';

/// 姿勢ランドマーク用の座標変換器
class CoordinateTransformer {
  const CoordinateTransformer({
    required this.imageSize,
    required this.screenSize,
    this.cameraLensDirection = CameraLensDirection.front,
    this.deviceOrientation = DeviceOrientation.portraitUp,
    this.sensorOrientation = 90,
  });

  /// カメラからの元の画像サイズ
  final Size imageSize;

  /// 表示用のターゲット画面サイズ
  final Size screenSize;

  /// カメラレンズの向き（前面/背面）
  final CameraLensDirection cameraLensDirection;

  /// 現在のデバイスの向き
  final DeviceOrientation deviceOrientation;

  /// カメラセンサーの向き（度数）
  final int sensorOrientation;

  /// 座標をミラーリングするか（前面カメラ用）
  bool get shouldMirror => cameraLensDirection == CameraLensDirection.front;

  /// デバイスとセンサーの向きに基づいて回転角度を取得
  int get rotationAngle {
    final deviceRotation = _deviceOrientationToDegrees(deviceOrientation);

    if (cameraLensDirection == CameraLensDirection.front) {
      return (sensorOrientation + deviceRotation) % 360;
    } else {
      return (sensorOrientation - deviceRotation + 360) % 360;
    }
  }

  /// 単一のランドマークを画面座標に変換
  Offset transformLandmark(PoseLandmark landmark) {
    // 正規化座標は既に0.0-1.0
    var x = landmark.x;
    var y = landmark.y;

    // 必要に応じて回転を適用
    final rotatedPoint = _rotatePoint(x, y, rotationAngle);
    x = rotatedPoint.dx;
    y = rotatedPoint.dy;

    // 前面カメラ用にミラーリング
    if (shouldMirror) {
      x = 1.0 - x;
    }

    // 画面サイズにスケール
    return Offset(x * screenSize.width, y * screenSize.height);
  }

  /// 姿勢フレーム内のすべてのランドマークを変換
  Map<PoseLandmarkType, Offset> transformPoseFrame(PoseFrame frame) {
    final transformed = <PoseLandmarkType, Offset>{};

    for (final entry in frame.landmarks.entries) {
      transformed[entry.key] = transformLandmark(entry.value);
    }

    return transformed;
  }

  /// すべてのランドマークを含むバウンディングボックスを取得
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

    // パディングを追加
    final paddingX = (maxX - minX) * padding;
    final paddingY = (maxY - minY) * padding;

    return Rect.fromLTRB(
      math.max(0, minX - paddingX),
      math.max(0, minY - paddingY),
      math.min(screenSize.width, maxX + paddingX),
      math.min(screenSize.height, maxY + paddingY),
    );
  }

  /// カメラプレビュー用のアスペクト比フィットを計算
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

  /// 更新されたパラメータでコピーを作成
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

  /// 指定された角度でポイントを回転
  Offset _rotatePoint(double x, double y, int angleDegrees) {
    if (angleDegrees == 0) return Offset(x, y);

    // 座標を0.5, 0.5を中心に配置
    final cx = x - 0.5;
    final cy = y - 0.5;

    final radians = angleDegrees * math.pi / 180;
    final cosA = math.cos(radians);
    final sinA = math.sin(radians);

    // 回転
    final newX = cx * cosA - cy * sinA;
    final newY = cx * sinA + cy * cosA;

    // 元に戻す
    return Offset(newX + 0.5, newY + 0.5);
  }

  /// DeviceOrientationを度数に変換
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

/// デバイスの向き列挙型
enum DeviceOrientation {
  portraitUp,
  landscapeLeft,
  portraitDown,
  landscapeRight,
}

/// 角度計算用の拡張
extension AngleExtension on CoordinateTransformer {
  /// 3つのランドマーク間の角度を計算（度数）
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

    // ベクトルを計算
    final v1 = Offset(p1.x - v.x, p1.y - v.y);
    final v2 = Offset(p2.x - v.x, p2.y - v.y);

    // 内積を使用して角度を計算
    final dot = v1.dx * v2.dx + v1.dy * v2.dy;
    final mag1 = math.sqrt(v1.dx * v1.dx + v1.dy * v1.dy);
    final mag2 = math.sqrt(v2.dx * v2.dx + v2.dy * v2.dy);

    if (mag1 == 0 || mag2 == 0) return null;

    final cosAngle = dot / (mag1 * mag2);
    final clampedCos = cosAngle.clamp(-1.0, 1.0);
    final angleRadians = math.acos(clampedCos);

    return angleRadians * 180 / math.pi;
  }

  /// 2つのランドマーク間の距離を計算（正規化）
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

  /// ランドマークが別のランドマークより上にあるかチェック（y値が小さい）
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

  /// 2つのランドマーク間の中点を計算
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
