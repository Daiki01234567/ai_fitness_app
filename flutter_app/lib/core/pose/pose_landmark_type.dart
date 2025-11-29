/// MediaPipe Pose 33ランドマークタイプ
///
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
/// google_mlkit_pose_detection PoseLandmarkTypeにマップ
library;

/// 全33個のMediaPipe Poseランドマークを表すenum
enum PoseLandmarkType {
  // 顔のランドマーク (0-10)
  nose(0),
  leftEyeInner(1),
  leftEye(2),
  leftEyeOuter(3),
  rightEyeInner(4),
  rightEye(5),
  rightEyeOuter(6),
  leftEar(7),
  rightEar(8),
  leftMouth(9),
  rightMouth(10),

  // 上半身のランドマーク (11-22)
  leftShoulder(11),
  rightShoulder(12),
  leftElbow(13),
  rightElbow(14),
  leftWrist(15),
  rightWrist(16),
  leftPinky(17),
  rightPinky(18),
  leftIndex(19),
  rightIndex(20),
  leftThumb(21),
  rightThumb(22),

  // 下半身のランドマーク (23-32)
  leftHip(23),
  rightHip(24),
  leftKnee(25),
  rightKnee(26),
  leftAnkle(27),
  rightAnkle(28),
  leftHeel(29),
  rightHeel(30),
  leftFootIndex(31),
  rightFootIndex(32);

  const PoseLandmarkType(this.landmarkIndex);

  /// MediaPipeランドマークインデックス (0-32)
  final int landmarkIndex;

  /// インデックスからランドマークタイプを取得
  static PoseLandmarkType fromIndex(int idx) {
    return PoseLandmarkType.values.firstWhere(
      (type) => type.landmarkIndex == idx,
      orElse: () => PoseLandmarkType.nose,
    );
  }
}

/// 異なるエクササイズ用の主要ランドマークグループ
class LandmarkGroups {
  LandmarkGroups._();

  /// スクワットエクササイズ用のランドマーク
  static const squat = [
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
    PoseLandmarkType.leftKnee,
    PoseLandmarkType.rightKnee,
    PoseLandmarkType.leftAnkle,
    PoseLandmarkType.rightAnkle,
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftHeel,
    PoseLandmarkType.rightHeel,
    PoseLandmarkType.leftFootIndex,
    PoseLandmarkType.rightFootIndex,
  ];

  /// アームカールエクササイズ用のランドマーク
  static const armCurl = [
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftElbow,
    PoseLandmarkType.rightElbow,
    PoseLandmarkType.leftWrist,
    PoseLandmarkType.rightWrist,
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
  ];

  /// サイドレイズエクササイズ用のランドマーク
  static const sideRaise = [
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftElbow,
    PoseLandmarkType.rightElbow,
    PoseLandmarkType.leftWrist,
    PoseLandmarkType.rightWrist,
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
    PoseLandmarkType.nose,
  ];

  /// ショルダープレスエクササイズ用のランドマーク
  static const shoulderPress = [
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftElbow,
    PoseLandmarkType.rightElbow,
    PoseLandmarkType.leftWrist,
    PoseLandmarkType.rightWrist,
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
  ];

  /// プッシュアップエクササイズ用のランドマーク
  static const pushUp = [
    PoseLandmarkType.leftShoulder,
    PoseLandmarkType.rightShoulder,
    PoseLandmarkType.leftElbow,
    PoseLandmarkType.rightElbow,
    PoseLandmarkType.leftWrist,
    PoseLandmarkType.rightWrist,
    PoseLandmarkType.leftHip,
    PoseLandmarkType.rightHip,
    PoseLandmarkType.leftAnkle,
    PoseLandmarkType.rightAnkle,
    PoseLandmarkType.nose,
  ];
}
