/// Pose Data Models
///
/// Data structures for pose detection results.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'pose_landmark_type.dart';

/// Represents a single landmark point in 3D space
class PoseLandmark {
  const PoseLandmark({
    required this.type,
    required this.x,
    required this.y,
    required this.z,
    required this.likelihood,
  });

  /// The type of landmark
  final PoseLandmarkType type;

  /// X coordinate (normalized 0-1 relative to image width)
  final double x;

  /// Y coordinate (normalized 0-1 relative to image height)
  final double y;

  /// Z coordinate (depth, normalized relative to hip center)
  final double z;

  /// Confidence score (0.0 - 1.0)
  /// Recommended threshold: 0.7, minimum: 0.5
  final double likelihood;

  /// Check if this landmark is reliable
  /// Uses recommended threshold of 0.7
  bool get isReliable => likelihood >= 0.7;

  /// Check if this landmark meets minimum threshold
  /// Uses minimum threshold of 0.5
  bool get meetsMinimumThreshold => likelihood >= 0.5;

  @override
  String toString() =>
      'PoseLandmark(${type.name}, x: ${x.toStringAsFixed(3)}, '
      'y: ${y.toStringAsFixed(3)}, z: ${z.toStringAsFixed(3)}, '
      'likelihood: ${likelihood.toStringAsFixed(2)})';

  /// Create a copy with optional parameter overrides
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

/// Represents a complete pose detection result for a single frame
class PoseFrame {
  const PoseFrame({
    required this.landmarks,
    required this.timestamp,
    this.processingTimeMs,
  });

  /// All detected landmarks (up to 33)
  final Map<PoseLandmarkType, PoseLandmark> landmarks;

  /// Frame timestamp in milliseconds
  final int timestamp;

  /// Time taken to process this frame in milliseconds
  final int? processingTimeMs;

  /// Get a specific landmark
  PoseLandmark? getLandmark(PoseLandmarkType type) => landmarks[type];

  /// Get multiple landmarks
  List<PoseLandmark?> getLandmarks(List<PoseLandmarkType> types) {
    return types.map((type) => landmarks[type]).toList();
  }

  /// Check if all specified landmarks are reliable (likelihood >= 0.7)
  bool areAllReliable(List<PoseLandmarkType> types) {
    return types.every((type) {
      final landmark = landmarks[type];
      return landmark != null && landmark.isReliable;
    });
  }

  /// Check if all specified landmarks meet minimum threshold (likelihood >= 0.5)
  bool allMeetMinimumThreshold(List<PoseLandmarkType> types) {
    return types.every((type) {
      final landmark = landmarks[type];
      return landmark != null && landmark.meetsMinimumThreshold;
    });
  }

  /// Get average confidence score for specified landmarks
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

  /// Get overall average confidence for all detected landmarks
  double get overallConfidence {
    if (landmarks.isEmpty) return 0.0;
    final sum = landmarks.values.fold<double>(
      0.0,
      (sum, landmark) => sum + landmark.likelihood,
    );
    return sum / landmarks.length;
  }

  /// Number of landmarks detected
  int get landmarkCount => landmarks.length;

  /// Number of reliable landmarks (likelihood >= 0.7)
  int get reliableLandmarkCount =>
      landmarks.values.where((l) => l.isReliable).length;

  /// Check if pose was detected (at least some landmarks found)
  bool get isPoseDetected => landmarks.isNotEmpty;

  @override
  String toString() =>
      'PoseFrame(landmarks: ${landmarks.length}, '
      'timestamp: $timestamp, '
      'processingTime: ${processingTimeMs}ms)';
}

/// Configuration for pose detection
class PoseDetectionConfig {
  const PoseDetectionConfig({
    this.mode = PoseDetectionMode.stream,
    this.model = PoseDetectionModel.base,
    this.enableTracking = true,
    this.minConfidenceThreshold = 0.5,
    this.recommendedConfidenceThreshold = 0.7,
  });

  /// Detection mode (single image or video stream)
  final PoseDetectionMode mode;

  /// Model complexity
  final PoseDetectionModel model;

  /// Enable landmark tracking across frames
  final bool enableTracking;

  /// Minimum confidence threshold (0.5 per spec)
  final double minConfidenceThreshold;

  /// Recommended confidence threshold (0.7 per spec)
  final double recommendedConfidenceThreshold;

  /// Default configuration for real-time detection
  static const realtime = PoseDetectionConfig(
    mode: PoseDetectionMode.stream,
    model: PoseDetectionModel.base,
    enableTracking: true,
  );

  /// Configuration for single image analysis
  static const singleImage = PoseDetectionConfig(
    mode: PoseDetectionMode.single,
    model: PoseDetectionModel.accurate,
    enableTracking: false,
  );
}

/// Pose detection mode
enum PoseDetectionMode {
  /// Single image mode - more accurate, slower
  single,

  /// Stream mode - optimized for real-time video
  stream,
}

/// Pose detection model complexity
enum PoseDetectionModel {
  /// Base model - faster, less accurate
  base,

  /// Accurate model - slower, more accurate
  accurate,
}
