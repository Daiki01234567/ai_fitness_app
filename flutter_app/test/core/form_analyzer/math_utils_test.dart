// Math Utils Tests
//
// Unit tests for form analyzer math utilities.
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/form_analyzer/utils/math_utils.dart';
import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';

void main() {
  group('Vector2D', () {
    test('calculates magnitude correctly', () {
      final v = Vector2D(3, 4);
      expect(v.magnitude, equals(5.0));
    });

    test('normalizes vector correctly', () {
      final v = Vector2D(3, 4);
      final normalized = v.normalized;
      expect(normalized.magnitude, closeTo(1.0, 0.0001));
    });

    test('calculates dot product correctly', () {
      final v1 = Vector2D(1, 0);
      final v2 = Vector2D(0, 1);
      expect(v1.dot(v2), equals(0.0)); // Perpendicular
    });

    test('handles zero vector normalization', () {
      final v = Vector2D(0, 0);
      final normalized = v.normalized;
      expect(normalized.x, equals(0.0));
      expect(normalized.y, equals(0.0));
    });
  });

  group('Vector3D', () {
    test('calculates magnitude correctly', () {
      final v = Vector3D(1, 2, 2);
      expect(v.magnitude, equals(3.0));
    });

    test('calculates cross product correctly', () {
      final v1 = Vector3D(1, 0, 0);
      final v2 = Vector3D(0, 1, 0);
      final cross = v1.cross(v2);
      expect(cross.x, equals(0.0));
      expect(cross.y, equals(0.0));
      expect(cross.z, equals(1.0));
    });
  });

  group('FormMathUtils', () {
    group('calculateAngle3Points', () {
      test('calculates 90 degree angle correctly', () {
        final p1 = _createLandmark(PoseLandmarkType.leftShoulder, 0, 0);
        final p2 = _createLandmark(PoseLandmarkType.leftElbow, 0, 1);
        final p3 = _createLandmark(PoseLandmarkType.leftWrist, 1, 1);

        final angle = FormMathUtils.calculateAngle3Points(p1, p2, p3);
        expect(angle, closeTo(90.0, 1.0));
      });

      test('calculates 180 degree angle correctly', () {
        final p1 = _createLandmark(PoseLandmarkType.leftShoulder, 0, 0);
        final p2 = _createLandmark(PoseLandmarkType.leftElbow, 1, 0);
        final p3 = _createLandmark(PoseLandmarkType.leftWrist, 2, 0);

        final angle = FormMathUtils.calculateAngle3Points(p1, p2, p3);
        expect(angle, closeTo(180.0, 1.0));
      });
    });

    group('calculateDistance', () {
      test('calculates distance correctly', () {
        final p1 = _createLandmark(PoseLandmarkType.leftHip, 0, 0);
        final p2 = _createLandmark(PoseLandmarkType.rightHip, 3, 4);

        final distance = FormMathUtils.calculateDistance(p1, p2);
        expect(distance, equals(5.0));
      });

      test('returns zero for same point', () {
        final p1 = _createLandmark(PoseLandmarkType.leftHip, 1, 1);

        final distance = FormMathUtils.calculateDistance(p1, p1);
        expect(distance, equals(0.0));
      });
    });

    group('calculateMidpoint', () {
      test('calculates midpoint correctly', () {
        final p1 = _createLandmark(PoseLandmarkType.leftHip, 0, 0);
        final p2 = _createLandmark(PoseLandmarkType.rightHip, 2, 4);

        final midpoint = FormMathUtils.calculateMidpoint(p1, p2);
        expect(midpoint.x, equals(1.0));
        expect(midpoint.y, equals(2.0));
      });
    });

    group('calculateSymmetry', () {
      test('returns 1.0 for equal values', () {
        final symmetry = FormMathUtils.calculateSymmetry(100, 100);
        expect(symmetry, equals(1.0));
      });

      test('returns correct ratio for different values', () {
        final symmetry = FormMathUtils.calculateSymmetry(80, 100);
        expect(symmetry, closeTo(0.8, 0.01));
      });

      test('handles zero values', () {
        final symmetry = FormMathUtils.calculateSymmetry(0, 100);
        expect(symmetry, equals(0.0));
      });

      test('handles both zero values', () {
        final symmetry = FormMathUtils.calculateSymmetry(0, 0);
        expect(symmetry, equals(1.0)); // Both equal, so symmetric
      });
    });

    group('angle conversion', () {
      test('converts degrees to radians', () {
        final radians = FormMathUtils.toRadians(180);
        expect(radians, closeTo(3.14159, 0.001));
      });

      test('converts radians to degrees', () {
        final degrees = FormMathUtils.toDegrees(3.14159);
        expect(degrees, closeTo(180, 0.1));
      });
    });
  });

  group('MovingAverageFilter', () {
    test('returns input for single value', () {
      final filter = MovingAverageFilter(windowSize: 5);
      final result = filter.filter(100);
      expect(result, equals(100.0));
    });

    test('calculates moving average correctly', () {
      final filter = MovingAverageFilter(windowSize: 3);
      filter.filter(10);
      filter.filter(20);
      final result = filter.filter(30);
      expect(result, equals(20.0)); // (10 + 20 + 30) / 3
    });

    test('maintains window size', () {
      final filter = MovingAverageFilter(windowSize: 2);
      filter.filter(10);
      filter.filter(20);
      final result = filter.filter(30);
      expect(result, equals(25.0)); // (20 + 30) / 2
    });

    test('reset clears buffer', () {
      final filter = MovingAverageFilter(windowSize: 3);
      filter.filter(100);
      filter.filter(100);
      filter.reset();
      final result = filter.filter(50);
      expect(result, equals(50.0));
    });

    test('isWarmedUp returns correct state', () {
      final filter = MovingAverageFilter(windowSize: 3);
      expect(filter.isWarmedUp, isFalse);
      filter.filter(10);
      filter.filter(20);
      expect(filter.isWarmedUp, isFalse);
      filter.filter(30);
      expect(filter.isWarmedUp, isTrue);
    });
  });

  group('VelocityCalculator', () {
    test('returns null for first value', () {
      final calc = VelocityCalculator();
      final velocity = calc.calculateVelocity(100, 0);
      expect(velocity, isNull);
    });

    test('calculates positive velocity correctly', () {
      final calc = VelocityCalculator();

      calc.calculateVelocity(0, 0);
      final velocity = calc.calculateVelocity(100, 1000); // 1 second later

      expect(velocity, equals(100.0)); // 100 units per second
    });

    test('calculates negative velocity correctly', () {
      final calc = VelocityCalculator();

      calc.calculateVelocity(100, 0);
      final velocity = calc.calculateVelocity(0, 1000);

      expect(velocity, equals(-100.0));
    });

    test('reset clears state', () {
      final calc = VelocityCalculator();

      calc.calculateVelocity(0, 0);
      calc.reset();
      final velocity = calc.calculateVelocity(100, 1000);

      expect(velocity, isNull);
    });
  });

  group('ExerciseCalculations', () {
    test('calculates knee angle from frame', () {
      final frame = _createPoseFrame({
        PoseLandmarkType.leftHip: (0.5, 0.3),
        PoseLandmarkType.leftKnee: (0.5, 0.5),
        PoseLandmarkType.leftAnkle: (0.5, 0.7),
      });

      final angle = ExerciseCalculations.calculateKneeAngle(frame);
      expect(angle, closeTo(180.0, 1.0)); // Straight leg
    });

    test('calculates elbow angle from frame', () {
      final frame = _createPoseFrame({
        PoseLandmarkType.leftShoulder: (0.3, 0.3),
        PoseLandmarkType.leftElbow: (0.3, 0.5),
        PoseLandmarkType.leftWrist: (0.5, 0.5),
      });

      final angle = ExerciseCalculations.calculateElbowAngle(frame);
      expect(angle, closeTo(90.0, 1.0)); // Right angle
    });

    test('returns null for missing landmarks', () {
      final frame = _createPoseFrame({});
      final angle = ExerciseCalculations.calculateKneeAngle(frame);
      expect(angle, isNull);
    });
  });

  group('OutlierRemover', () {
    test('removes outliers from list', () {
      final remover = OutlierRemover();
      final values = [10.0, 12.0, 11.0, 10.0, 100.0, 11.0, 10.0, 12.0];
      final cleaned = remover.removeOutliers(values);

      expect(cleaned, isNot(contains(100.0)));
      expect(cleaned.length, lessThan(values.length));
    });

    test('keeps all values when no outliers', () {
      final remover = OutlierRemover();
      final values = [10.0, 11.0, 12.0, 10.0, 11.0];
      final cleaned = remover.removeOutliers(values);

      expect(cleaned.length, equals(values.length));
    });

    test('returns original for small lists', () {
      final remover = OutlierRemover();
      final values = [10.0, 100.0];
      final cleaned = remover.removeOutliers(values);

      expect(cleaned.length, equals(values.length));
    });
  });
}

/// Helper function to create a landmark
PoseLandmark _createLandmark(
  PoseLandmarkType type,
  double x,
  double y, {
  double z = 0,
  double likelihood = 0.9,
}) {
  return PoseLandmark(
    type: type,
    x: x,
    y: y,
    z: z,
    likelihood: likelihood,
  );
}

/// Helper function to create a pose frame
PoseFrame _createPoseFrame(Map<PoseLandmarkType, (double, double)> positions) {
  final landmarks = <PoseLandmarkType, PoseLandmark>{};
  for (final entry in positions.entries) {
    landmarks[entry.key] = PoseLandmark(
      type: entry.key,
      x: entry.value.$1,
      y: entry.value.$2,
      z: 0,
      likelihood: 0.9,
    );
  }
  return PoseFrame(
    landmarks: landmarks,
    timestamp: 0,
  );
}
