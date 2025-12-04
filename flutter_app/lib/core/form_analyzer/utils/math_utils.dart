/// Mathematical Utilities for Form Analysis
///
/// Common math functions for angle calculation, vector operations,
/// and signal processing.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:math' as math;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';

/// 2D Vector class for basic operations
class Vector2D {
  const Vector2D(this.x, this.y);

  final double x;
  final double y;

  /// Create from two landmarks (2D projection)
  factory Vector2D.fromLandmarks(PoseLandmark from, PoseLandmark to) {
    return Vector2D(to.x - from.x, to.y - from.y);
  }

  /// Vector magnitude (length)
  double get magnitude => math.sqrt(x * x + y * y);

  /// Normalize this vector
  Vector2D get normalized {
    final mag = magnitude;
    if (mag == 0) return const Vector2D(0, 0);
    return Vector2D(x / mag, y / mag);
  }

  /// Dot product with another vector
  double dot(Vector2D other) => x * other.x + y * other.y;

  /// Cross product (2D returns scalar z-component)
  double cross(Vector2D other) => x * other.y - y * other.x;

  /// Add two vectors
  Vector2D operator +(Vector2D other) => Vector2D(x + other.x, y + other.y);

  /// Subtract two vectors
  Vector2D operator -(Vector2D other) => Vector2D(x - other.x, y - other.y);

  /// Scale vector
  Vector2D operator *(double scalar) => Vector2D(x * scalar, y * scalar);

  /// Angle in radians
  double get angle => math.atan2(y, x);

  @override
  String toString() => 'Vector2D($x, $y)';
}

/// 3D Vector class for 3D operations
class Vector3D {
  const Vector3D(this.x, this.y, this.z);

  final double x;
  final double y;
  final double z;

  /// Create from landmark
  factory Vector3D.fromLandmark(PoseLandmark landmark) {
    return Vector3D(landmark.x, landmark.y, landmark.z);
  }

  /// Create from two landmarks
  factory Vector3D.fromLandmarks(PoseLandmark from, PoseLandmark to) {
    return Vector3D(to.x - from.x, to.y - from.y, to.z - from.z);
  }

  /// Vector magnitude
  double get magnitude => math.sqrt(x * x + y * y + z * z);

  /// Normalize this vector
  Vector3D get normalized {
    final mag = magnitude;
    if (mag == 0) return const Vector3D(0, 0, 0);
    return Vector3D(x / mag, y / mag, z / mag);
  }

  /// Dot product
  double dot(Vector3D other) => x * other.x + y * other.y + z * other.z;

  /// Cross product
  Vector3D cross(Vector3D other) {
    return Vector3D(
      y * other.z - z * other.y,
      z * other.x - x * other.z,
      x * other.y - y * other.x,
    );
  }

  /// Subtract
  Vector3D operator -(Vector3D other) =>
      Vector3D(x - other.x, y - other.y, z - other.z);

  /// Add
  Vector3D operator +(Vector3D other) =>
      Vector3D(x + other.x, y + other.y, z + other.z);

  @override
  String toString() => 'Vector3D($x, $y, $z)';
}

/// Math utilities for form analysis
class FormMathUtils {
  FormMathUtils._();

  /// Calculate angle between three points (in degrees)
  /// The angle is measured at the middle point (b)
  ///
  /// Example: For elbow angle, a=shoulder, b=elbow, c=wrist
  static double calculateAngle3Points(
    PoseLandmark a,
    PoseLandmark b,
    PoseLandmark c,
  ) {
    final vectorBA = Vector2D(a.x - b.x, a.y - b.y);
    final vectorBC = Vector2D(c.x - b.x, c.y - b.y);

    final dot = vectorBA.dot(vectorBC);
    final magBA = vectorBA.magnitude;
    final magBC = vectorBC.magnitude;

    if (magBA == 0 || magBC == 0) return 0;

    // Clamp to avoid floating point errors
    final cosAngle = (dot / (magBA * magBC)).clamp(-1.0, 1.0);
    return math.acos(cosAngle) * 180 / math.pi;
  }

  /// Calculate 3D angle between three points
  static double calculateAngle3Points3D(
    PoseLandmark a,
    PoseLandmark b,
    PoseLandmark c,
  ) {
    final vectorBA = Vector3D.fromLandmarks(b, a);
    final vectorBC = Vector3D.fromLandmarks(b, c);

    final dot = vectorBA.dot(vectorBC);
    final magBA = vectorBA.magnitude;
    final magBC = vectorBC.magnitude;

    if (magBA == 0 || magBC == 0) return 0;

    final cosAngle = (dot / (magBA * magBC)).clamp(-1.0, 1.0);
    return math.acos(cosAngle) * 180 / math.pi;
  }

  /// Calculate distance between two landmarks
  static double calculateDistance(PoseLandmark a, PoseLandmark b) {
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    return math.sqrt(dx * dx + dy * dy);
  }

  /// Calculate 3D distance between two landmarks
  static double calculateDistance3D(PoseLandmark a, PoseLandmark b) {
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    final dz = a.z - b.z;
    return math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /// Calculate the vertical angle of a limb (relative to vertical axis)
  /// Returns 0 when vertical, 90 when horizontal
  static double calculateVerticalAngle(PoseLandmark upper, PoseLandmark lower) {
    final dx = lower.x - upper.x;
    final dy = lower.y - upper.y;
    return math.atan2(dx.abs(), dy.abs()) * 180 / math.pi;
  }

  /// Calculate horizontal angle of a limb (relative to horizontal)
  /// Returns 0 when horizontal, 90 when vertical
  static double calculateHorizontalAngle(
    PoseLandmark left,
    PoseLandmark right,
  ) {
    final dx = right.x - left.x;
    final dy = right.y - left.y;
    return math.atan2(dy.abs(), dx.abs()) * 180 / math.pi;
  }

  /// Calculate midpoint between two landmarks
  static ({double x, double y, double z}) calculateMidpoint(
    PoseLandmark a,
    PoseLandmark b,
  ) {
    return (x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2);
  }

  /// Check if a point is in front of a line (2D)
  /// Useful for knee-over-toe detection
  /// Returns positive if in front, negative if behind
  static double signedDistanceToLine(
    PoseLandmark point,
    PoseLandmark lineStart,
    PoseLandmark lineEnd,
  ) {
    // Direction vector of the line
    final dx = lineEnd.x - lineStart.x;
    final dy = lineEnd.y - lineStart.y;

    // Normal vector (perpendicular)
    final nx = -dy;
    final ny = dx;
    final mag = math.sqrt(nx * nx + ny * ny);

    if (mag == 0) return 0;

    // Vector from line start to point
    final px = point.x - lineStart.x;
    final py = point.y - lineStart.y;

    // Signed distance
    return (px * nx + py * ny) / mag;
  }

  /// Check left-right symmetry between two values
  /// Returns 0-1 where 1 is perfect symmetry
  static double calculateSymmetry(double leftValue, double rightValue) {
    final max = math.max(leftValue.abs(), rightValue.abs());
    if (max == 0) return 1.0;
    final diff = (leftValue - rightValue).abs();
    return 1.0 - (diff / max).clamp(0.0, 1.0);
  }

  /// Convert degrees to radians
  static double toRadians(double degrees) => degrees * math.pi / 180;

  /// Convert radians to degrees
  static double toDegrees(double radians) => radians * 180 / math.pi;

  /// Clamp a value between min and max
  static double clamp(double value, double min, double max) {
    return value.clamp(min, max);
  }

  /// Linear interpolation
  static double lerp(double a, double b, double t) {
    return a + (b - a) * t;
  }

  /// Map a value from one range to another
  static double mapRange(
    double value,
    double inMin,
    double inMax,
    double outMin,
    double outMax,
  ) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }
}

/// Moving average filter for smoothing values
class MovingAverageFilter {
  MovingAverageFilter({this.windowSize = 5});

  final int windowSize;
  final List<double> _values = [];

  /// Add a new value and get the filtered result
  double filter(double value) {
    _values.add(value);
    if (_values.length > windowSize) {
      _values.removeAt(0);
    }
    return _values.reduce((a, b) => a + b) / _values.length;
  }

  /// Current average value
  double get current {
    if (_values.isEmpty) return 0;
    return _values.reduce((a, b) => a + b) / _values.length;
  }

  /// Reset the filter
  void reset() => _values.clear();

  /// Check if filter has enough samples
  bool get isWarmedUp => _values.length >= windowSize;
}

/// Outlier removal using interquartile range
class OutlierRemover {
  OutlierRemover({this.iqrMultiplier = 1.5});

  final double iqrMultiplier;

  /// Remove outliers from a list of values
  List<double> removeOutliers(List<double> values) {
    if (values.length < 4) return values;

    final sorted = List<double>.from(values)..sort();
    final q1 = sorted[(sorted.length * 0.25).floor()];
    final q3 = sorted[(sorted.length * 0.75).floor()];
    final iqr = q3 - q1;
    final lowerBound = q1 - iqrMultiplier * iqr;
    final upperBound = q3 + iqrMultiplier * iqr;

    return values.where((v) => v >= lowerBound && v <= upperBound).toList();
  }

  /// Check if a value is an outlier
  bool isOutlier(double value, List<double> context) {
    if (context.length < 4) return false;

    final sorted = List<double>.from(context)..sort();
    final q1 = sorted[(sorted.length * 0.25).floor()];
    final q3 = sorted[(sorted.length * 0.75).floor()];
    final iqr = q3 - q1;

    return value < q1 - iqrMultiplier * iqr || value > q3 + iqrMultiplier * iqr;
  }
}

/// Velocity calculator from position changes
class VelocityCalculator {
  double? _lastPosition;
  int? _lastTimestamp;

  /// Calculate velocity from new position
  /// Returns velocity in units per second
  double? calculateVelocity(double position, int timestampMs) {
    if (_lastPosition == null || _lastTimestamp == null) {
      _lastPosition = position;
      _lastTimestamp = timestampMs;
      return null;
    }

    final dt = (timestampMs - _lastTimestamp!) / 1000.0; // Convert to seconds
    if (dt <= 0) return null;

    final velocity = (position - _lastPosition!) / dt;

    _lastPosition = position;
    _lastTimestamp = timestampMs;

    return velocity;
  }

  /// Reset the calculator
  void reset() {
    _lastPosition = null;
    _lastTimestamp = null;
  }
}

/// Acceleration calculator from velocity changes
class AccelerationCalculator {
  final VelocityCalculator _velocityCalc = VelocityCalculator();
  double? _lastVelocity;
  int? _lastTimestamp;

  /// Calculate acceleration from position
  /// Returns acceleration in units per second squared
  double? calculateAcceleration(double position, int timestampMs) {
    final velocity = _velocityCalc.calculateVelocity(position, timestampMs);
    if (velocity == null) return null;

    if (_lastVelocity == null || _lastTimestamp == null) {
      _lastVelocity = velocity;
      _lastTimestamp = timestampMs;
      return null;
    }

    final dt = (timestampMs - _lastTimestamp!) / 1000.0;
    if (dt <= 0) return null;

    final acceleration = (velocity - _lastVelocity!) / dt;

    _lastVelocity = velocity;
    _lastTimestamp = timestampMs;

    return acceleration;
  }

  /// Reset the calculator
  void reset() {
    _velocityCalc.reset();
    _lastVelocity = null;
    _lastTimestamp = null;
  }
}

/// Helper class for exercise-specific calculations
class ExerciseCalculations {
  ExerciseCalculations._();

  /// Calculate knee angle for squat
  static double? calculateKneeAngle(PoseFrame frame, {bool left = true}) {
    final hip = frame.getLandmark(
      left ? PoseLandmarkType.leftHip : PoseLandmarkType.rightHip,
    );
    final knee = frame.getLandmark(
      left ? PoseLandmarkType.leftKnee : PoseLandmarkType.rightKnee,
    );
    final ankle = frame.getLandmark(
      left ? PoseLandmarkType.leftAnkle : PoseLandmarkType.rightAnkle,
    );

    if (hip == null || knee == null || ankle == null) return null;
    if (!hip.meetsMinimumThreshold ||
        !knee.meetsMinimumThreshold ||
        !ankle.meetsMinimumThreshold) {
      return null;
    }

    return FormMathUtils.calculateAngle3Points(hip, knee, ankle);
  }

  /// Calculate elbow angle for arm curl
  static double? calculateElbowAngle(PoseFrame frame, {bool left = true}) {
    final shoulder = frame.getLandmark(
      left ? PoseLandmarkType.leftShoulder : PoseLandmarkType.rightShoulder,
    );
    final elbow = frame.getLandmark(
      left ? PoseLandmarkType.leftElbow : PoseLandmarkType.rightElbow,
    );
    final wrist = frame.getLandmark(
      left ? PoseLandmarkType.leftWrist : PoseLandmarkType.rightWrist,
    );

    if (shoulder == null || elbow == null || wrist == null) return null;
    if (!shoulder.meetsMinimumThreshold ||
        !elbow.meetsMinimumThreshold ||
        !wrist.meetsMinimumThreshold) {
      return null;
    }

    return FormMathUtils.calculateAngle3Points(shoulder, elbow, wrist);
  }

  /// Calculate arm raise angle (for side raise)
  static double? calculateArmRaiseAngle(PoseFrame frame, {bool left = true}) {
    final shoulder = frame.getLandmark(
      left ? PoseLandmarkType.leftShoulder : PoseLandmarkType.rightShoulder,
    );
    final elbow = frame.getLandmark(
      left ? PoseLandmarkType.leftElbow : PoseLandmarkType.rightElbow,
    );
    final hip = frame.getLandmark(
      left ? PoseLandmarkType.leftHip : PoseLandmarkType.rightHip,
    );

    if (shoulder == null || elbow == null || hip == null) return null;
    if (!shoulder.meetsMinimumThreshold ||
        !elbow.meetsMinimumThreshold ||
        !hip.meetsMinimumThreshold) {
      return null;
    }

    return FormMathUtils.calculateAngle3Points(elbow, shoulder, hip);
  }

  /// Calculate hip angle (for body alignment)
  static double? calculateHipAngle(PoseFrame frame, {bool left = true}) {
    final shoulder = frame.getLandmark(
      left ? PoseLandmarkType.leftShoulder : PoseLandmarkType.rightShoulder,
    );
    final hip = frame.getLandmark(
      left ? PoseLandmarkType.leftHip : PoseLandmarkType.rightHip,
    );
    final knee = frame.getLandmark(
      left ? PoseLandmarkType.leftKnee : PoseLandmarkType.rightKnee,
    );

    if (shoulder == null || hip == null || knee == null) return null;
    if (!shoulder.meetsMinimumThreshold ||
        !hip.meetsMinimumThreshold ||
        !knee.meetsMinimumThreshold) {
      return null;
    }

    return FormMathUtils.calculateAngle3Points(shoulder, hip, knee);
  }
}
