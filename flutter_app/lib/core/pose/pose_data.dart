/// 姿勢データモデル
///
/// 姿勢検出結果のためのデータ構造。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'pose_landmark_type.dart';

/// 3D空間における単一のランドマークポイントを表す
class PoseLandmark {
  const PoseLandmark({
    required this.type,
    required this.x,
    required this.y,
    required this.z,
    required this.likelihood,
  });

  /// ランドマークの種類
  final PoseLandmarkType type;

  /// X座標（画像幅に対して正規化 0-1）
  final double x;

  /// Y座標（画像高さに対して正規化 0-1）
  final double y;

  /// Z座標（深度、腰中心に対して正規化）
  final double z;

  /// 信頼度スコア（0.0 - 1.0）
  /// 推奨閾値: 0.7、最小: 0.5
  final double likelihood;

  /// このランドマークが信頼できるかチェック
  /// 推奨閾値0.7を使用
  bool get isReliable => likelihood >= 0.7;

  /// このランドマークが最小閾値を満たすかチェック
  /// 最小閾値0.5を使用
  bool get meetsMinimumThreshold => likelihood >= 0.5;

  @override
  String toString() =>
      'PoseLandmark(${type.name}, x: ${x.toStringAsFixed(3)}, '
      'y: ${y.toStringAsFixed(3)}, z: ${z.toStringAsFixed(3)}, '
      'likelihood: ${likelihood.toStringAsFixed(2)})';

  /// オプションのパラメータオーバーライドでコピーを作成
  PoseLandmark copyWith({
    PoseLandmarkType? type,
    double? x,
    double? y,
    double? z,
    double? likelihood,
  }) {
    return PoseLandmark(
      type: type ?? this.type,
      x: x ?? this.x,
      y: y ?? this.y,
      z: z ?? this.z,
      likelihood: likelihood ?? this.likelihood,
    );
  }
}

/// 単一フレームの完全な姿勢検出結果を表す
class PoseFrame {
  const PoseFrame({
    required this.landmarks,
    required this.timestamp,
    this.processingTimeMs,
  });

  /// 検出された全ランドマーク（最大33）
  final Map<PoseLandmarkType, PoseLandmark> landmarks;

  /// フレームタイムスタンプ（ミリ秒）
  final int timestamp;

  /// このフレームの処理にかかった時間（ミリ秒）
  final int? processingTimeMs;

  /// 特定のランドマークを取得
  PoseLandmark? getLandmark(PoseLandmarkType type) => landmarks[type];

  /// 複数のランドマークを取得
  List<PoseLandmark?> getLandmarks(List<PoseLandmarkType> types) {
    return types.map((type) => landmarks[type]).toList();
  }

  /// 指定されたすべてのランドマークが信頼できるかチェック（likelihood >= 0.7）
  bool areAllReliable(List<PoseLandmarkType> types) {
    return types.every((type) {
      final landmark = landmarks[type];
      return landmark != null && landmark.isReliable;
    });
  }

  /// 指定されたすべてのランドマークが最小閾値を満たすかチェック（likelihood >= 0.5）
  bool allMeetMinimumThreshold(List<PoseLandmarkType> types) {
    return types.every((type) {
      final landmark = landmarks[type];
      return landmark != null && landmark.meetsMinimumThreshold;
    });
  }

  /// 指定されたランドマークの平均信頼度スコアを取得
  double getAverageConfidence(List<PoseLandmarkType> types) {
    if (types.isEmpty) return 0.0;

    var sum = 0.0;
    var count = 0;
    for (final type in types) {
      final landmark = landmarks[type];
      if (landmark != null) {
        sum += landmark.likelihood;
        count++;
      }
    }
    return count > 0 ? sum / count : 0.0;
  }

  /// 検出されたすべてのランドマークの全体平均信頼度を取得
  double get overallConfidence {
    if (landmarks.isEmpty) return 0.0;
    final sum = landmarks.values.fold<double>(
      0.0,
      (sum, landmark) => sum + landmark.likelihood,
    );
    return sum / landmarks.length;
  }

  /// 検出されたランドマーク数
  int get landmarkCount => landmarks.length;

  /// 信頼できるランドマーク数（likelihood >= 0.7）
  int get reliableLandmarkCount =>
      landmarks.values.where((l) => l.isReliable).length;

  /// 姿勢が検出されたかチェック（少なくともいくつかのランドマークが見つかった）
  bool get isPoseDetected => landmarks.isNotEmpty;

  @override
  String toString() =>
      'PoseFrame(landmarks: ${landmarks.length}, '
      'timestamp: $timestamp, '
      'processingTime: ${processingTimeMs}ms)';
}

/// 姿勢検出の設定
class PoseDetectionConfig {
  const PoseDetectionConfig({
    this.mode = PoseDetectionMode.stream,
    this.model = PoseDetectionModel.base,
    this.enableTracking = true,
    this.minConfidenceThreshold = 0.5,
    this.recommendedConfidenceThreshold = 0.7,
  });

  /// 検出モード（単一画像またはビデオストリーム）
  final PoseDetectionMode mode;

  /// モデルの複雑さ
  final PoseDetectionModel model;

  /// フレーム間のランドマーク追跡を有効化
  final bool enableTracking;

  /// 最小信頼度閾値（仕様では0.5）
  final double minConfidenceThreshold;

  /// 推奨信頼度閾値（仕様では0.7）
  final double recommendedConfidenceThreshold;

  /// リアルタイム検出用のデフォルト設定
  static const realtime = PoseDetectionConfig(
    mode: PoseDetectionMode.stream,
    model: PoseDetectionModel.base,
    enableTracking: true,
  );

  /// 単一画像分析用の設定
  static const singleImage = PoseDetectionConfig(
    mode: PoseDetectionMode.single,
    model: PoseDetectionModel.accurate,
    enableTracking: false,
  );
}

/// 姿勢検出モード
enum PoseDetectionMode {
  /// 単一画像モード - より正確、より遅い
  single,

  /// ストリームモード - リアルタイムビデオに最適化
  stream,
}

/// 姿勢検出モデルの複雑さ
enum PoseDetectionModel {
  /// 基本モデル - より速い、精度は低い
  base,

  /// 精密モデル - より遅い、より正確
  accurate,
}
