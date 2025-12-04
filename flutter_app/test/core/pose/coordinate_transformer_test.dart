// Coordinate Transformer Tests
//
// Unit tests for coordinate transformation logic.
import 'package:camera/camera.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/pose/coordinate_transformer.dart';
import 'package:flutter_app/core/pose/pose_data.dart';
import 'package:flutter_app/core/pose/pose_landmark_type.dart';

void main() {
  group('CoordinateTransformer', () {
    late CoordinateTransformer transformer;

    setUp(() {
      // Use sensorOrientation: 0 to disable rotation for simpler tests
      transformer = const CoordinateTransformer(
        imageSize: Size(640, 480),
        screenSize: Size(320, 240),
        sensorOrientation: 0,
      );
    });

    group('transformLandmark', () {
      test('transforms normalized coordinates to screen coordinates', () {
        final landmark = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.5,
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        final result = transformer.transformLandmark(landmark);

        // Center of screen (with mirroring for front camera default)
        expect(result.dx, closeTo(160.0, 1.0));
        expect(result.dy, closeTo(120.0, 1.0));
      });

      test('transforms top-left corner correctly', () {
        final landmark = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.0,
          y: 0.0,
          z: 0.0,
          likelihood: 0.9,
        );

        final result = transformer.transformLandmark(landmark);

        // Front camera mirrors x, so 0 becomes screenWidth
        expect(result.dx, closeTo(320.0, 1.0));
        expect(result.dy, closeTo(0.0, 1.0));
      });

      test('transforms bottom-right corner correctly', () {
        final landmark = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 1.0,
          y: 1.0,
          z: 0.0,
          likelihood: 0.9,
        );

        final result = transformer.transformLandmark(landmark);

        // Front camera mirrors x, so 1.0 becomes 0
        expect(result.dx, closeTo(0.0, 1.0));
        expect(result.dy, closeTo(240.0, 1.0));
      });

      test('back camera does not mirror', () {
        final backCameraTransformer = const CoordinateTransformer(
          imageSize: Size(640, 480),
          screenSize: Size(320, 240),
          cameraLensDirection: CameraLensDirection.back,
          sensorOrientation: 0,
        );

        final landmark = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.25, // Left side of image
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        final result = backCameraTransformer.transformLandmark(landmark);

        // Back camera doesn't mirror, so left stays left
        expect(result.dx, closeTo(80.0, 1.0)); // 0.25 * 320
      });

      test('handles 90 degree sensor rotation', () {
        // Default sensorOrientation is 90, test it explicitly
        const rotatedTransformer = CoordinateTransformer(
          imageSize: Size(640, 480),
          screenSize: Size(320, 240),
          cameraLensDirection: CameraLensDirection.front,
          sensorOrientation: 90,
        );

        // Center point should remain at center
        final centerLandmark = PoseLandmark(
          type: PoseLandmarkType.nose,
          x: 0.5,
          y: 0.5,
          z: 0.0,
          likelihood: 0.9,
        );

        final result = rotatedTransformer.transformLandmark(centerLandmark);

        // Center stays at center
        expect(result.dx, closeTo(160.0, 1.0));
        expect(result.dy, closeTo(120.0, 1.0));
      });
    });

    group('transformPoseFrame', () {
      test('transforms all landmarks in a frame', () {
        final landmarks = {
          PoseLandmarkType.nose: PoseLandmark(
            type: PoseLandmarkType.nose,
            x: 0.5,
            y: 0.3,
            z: 0.0,
            likelihood: 0.9,
          ),
          PoseLandmarkType.leftShoulder: PoseLandmark(
            type: PoseLandmarkType.leftShoulder,
            x: 0.4,
            y: 0.5,
            z: 0.0,
            likelihood: 0.85,
          ),
          PoseLandmarkType.rightShoulder: PoseLandmark(
            type: PoseLandmarkType.rightShoulder,
            x: 0.6,
            y: 0.5,
            z: 0.0,
            likelihood: 0.85,
          ),
        };

        final frame = PoseFrame(landmarks: landmarks, timestamp: 0);

        final result = transformer.transformPoseFrame(frame);

        expect(result.length, equals(3));
        expect(result.containsKey(PoseLandmarkType.nose), isTrue);
        expect(result.containsKey(PoseLandmarkType.leftShoulder), isTrue);
        expect(result.containsKey(PoseLandmarkType.rightShoulder), isTrue);
      });
    });

    group('getBoundingBox', () {
      test('calculates bounding box for landmarks', () {
        final landmarks = {
          PoseLandmarkType.nose: PoseLandmark(
            type: PoseLandmarkType.nose,
            x: 0.5,
            y: 0.2,
            z: 0.0,
            likelihood: 0.9,
          ),
          PoseLandmarkType.leftAnkle: PoseLandmark(
            type: PoseLandmarkType.leftAnkle,
            x: 0.3,
            y: 0.9,
            z: 0.0,
            likelihood: 0.8,
          ),
          PoseLandmarkType.rightAnkle: PoseLandmark(
            type: PoseLandmarkType.rightAnkle,
            x: 0.7,
            y: 0.9,
            z: 0.0,
            likelihood: 0.8,
          ),
        };

        final frame = PoseFrame(landmarks: landmarks, timestamp: 0);

        final result = transformer.getBoundingBox(frame);

        expect(result, isNotNull);
        // Bounding box should be calculated from transformed coordinates
        expect(result!.width, greaterThan(0));
        expect(result.height, greaterThan(0));
      });

      test('returns null for empty frame', () {
        final frame = PoseFrame(landmarks: {}, timestamp: 0);

        final result = transformer.getBoundingBox(frame);

        expect(result, isNull);
      });
    });

    group('getPreviewSize', () {
      test('calculates preview size with contain fit', () {
        final result = transformer.getPreviewSize(fit: BoxFit.contain);

        // Image is 640x480 (4:3), screen is 320x240 (4:3)
        // Same aspect ratio, should fill exactly
        expect(result.width, closeTo(320.0, 1.0));
        expect(result.height, closeTo(240.0, 1.0));
      });

      test('calculates preview size for different aspect ratios', () {
        final wideTransformer = const CoordinateTransformer(
          imageSize: Size(1920, 1080), // 16:9
          screenSize: Size(320, 240), // 4:3
        );

        final result = wideTransformer.getPreviewSize(fit: BoxFit.contain);

        // Width limited, height adjusted
        expect(result.width, closeTo(320.0, 1.0));
        expect(result.height, closeTo(180.0, 1.0)); // 320 * 9/16 = 180
      });
    });

    group('shouldMirror', () {
      test('returns true for front camera', () {
        const frontCameraTransformer = CoordinateTransformer(
          imageSize: Size(640, 480),
          screenSize: Size(320, 240),
          cameraLensDirection: CameraLensDirection.front,
        );

        expect(frontCameraTransformer.shouldMirror, isTrue);
      });

      test('returns false for back camera', () {
        const backCameraTransformer = CoordinateTransformer(
          imageSize: Size(640, 480),
          screenSize: Size(320, 240),
          cameraLensDirection: CameraLensDirection.back,
        );

        expect(backCameraTransformer.shouldMirror, isFalse);
      });
    });
  });

  group('AngleExtension', () {
    late CoordinateTransformer transformer;

    setUp(() {
      transformer = const CoordinateTransformer(
        imageSize: Size(640, 480),
        screenSize: Size(320, 240),
        sensorOrientation: 0,
      );
    });

    group('calculateAngle', () {
      test('calculates 90 degree angle correctly', () {
        // Create a right angle: vertical line and horizontal line
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.5,
              y: 0.0, // Top
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.leftElbow: PoseLandmark(
              type: PoseLandmarkType.leftElbow,
              x: 0.5,
              y: 0.5, // Center (vertex)
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.leftWrist: PoseLandmark(
              type: PoseLandmarkType.leftWrist,
              x: 1.0,
              y: 0.5, // Right
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final angle = transformer.calculateAngle(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.leftElbow,
          PoseLandmarkType.leftWrist,
        );

        expect(angle, isNotNull);
        expect(angle!, closeTo(90.0, 1.0));
      });

      test('calculates 180 degree angle correctly', () {
        // Create a straight line
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.0,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.leftElbow: PoseLandmark(
              type: PoseLandmarkType.leftElbow,
              x: 0.5,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.leftWrist: PoseLandmark(
              type: PoseLandmarkType.leftWrist,
              x: 1.0,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final angle = transformer.calculateAngle(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.leftElbow,
          PoseLandmarkType.leftWrist,
        );

        expect(angle, isNotNull);
        expect(angle!, closeTo(180.0, 1.0));
      });

      test('returns null when landmark is missing', () {
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.5,
              y: 0.0,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final angle = transformer.calculateAngle(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.leftElbow,
          PoseLandmarkType.leftWrist,
        );

        expect(angle, isNull);
      });

      test('returns null when landmark has low confidence', () {
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.5,
              y: 0.0,
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.leftElbow: PoseLandmark(
              type: PoseLandmarkType.leftElbow,
              x: 0.5,
              y: 0.5,
              z: 0.0,
              likelihood: 0.3, // Below threshold
            ),
            PoseLandmarkType.leftWrist: PoseLandmark(
              type: PoseLandmarkType.leftWrist,
              x: 1.0,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final angle = transformer.calculateAngle(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.leftElbow,
          PoseLandmarkType.leftWrist,
        );

        expect(angle, isNull);
      });
    });

    group('calculateDistance', () {
      test('calculates horizontal distance correctly', () {
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.0,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.rightShoulder: PoseLandmark(
              type: PoseLandmarkType.rightShoulder,
              x: 0.5,
              y: 0.5,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final distance = transformer.calculateDistance(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.rightShoulder,
        );

        expect(distance, isNotNull);
        expect(distance!, closeTo(0.5, 0.01));
      });

      test('calculates diagonal distance correctly', () {
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.0,
              y: 0.0,
              z: 0.0,
              likelihood: 0.9,
            ),
            PoseLandmarkType.rightShoulder: PoseLandmark(
              type: PoseLandmarkType.rightShoulder,
              x: 0.3,
              y: 0.4,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final distance = transformer.calculateDistance(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.rightShoulder,
        );

        expect(distance, isNotNull);
        // sqrt(0.3^2 + 0.4^2) = sqrt(0.09 + 0.16) = sqrt(0.25) = 0.5
        expect(distance!, closeTo(0.5, 0.01));
      });

      test('returns null when landmark is missing', () {
        final frame = PoseFrame(
          landmarks: {
            PoseLandmarkType.leftShoulder: PoseLandmark(
              type: PoseLandmarkType.leftShoulder,
              x: 0.0,
              y: 0.0,
              z: 0.0,
              likelihood: 0.9,
            ),
          },
          timestamp: 0,
        );

        final distance = transformer.calculateDistance(
          frame,
          PoseLandmarkType.leftShoulder,
          PoseLandmarkType.rightShoulder,
        );

        expect(distance, isNull);
      });
    });
  });
}
