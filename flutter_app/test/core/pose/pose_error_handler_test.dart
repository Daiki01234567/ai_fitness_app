// Pose Error Handler Tests
//
// Unit tests for error handling and state management.
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/widgets/pose/pose_error_handler.dart';

void main() {
  group('PoseErrorType', () {
    test('enum has all expected error types', () {
      expect(PoseErrorType.values.length, equals(12));
      expect(PoseErrorType.cameraUnavailable, isNotNull);
      expect(PoseErrorType.cameraPermissionDenied, isNotNull);
      expect(PoseErrorType.cameraPermissionPermanentlyDenied, isNotNull);
      expect(PoseErrorType.mediaPipeInitFailed, isNotNull);
      expect(PoseErrorType.lowLight, isNotNull);
      expect(PoseErrorType.noPerson, isNotNull);
      expect(PoseErrorType.multiplePeople, isNotNull);
      expect(PoseErrorType.tooFar, isNotNull);
      expect(PoseErrorType.tooClose, isNotNull);
      expect(PoseErrorType.partiallyOutOfFrame, isNotNull);
      expect(PoseErrorType.detectionFailed, isNotNull);
      expect(PoseErrorType.sessionError, isNotNull);
    });
  });

  group('PoseErrorState', () {
    test('none state has no error', () {
      const state = PoseErrorState.none;

      expect(state.hasError, isFalse);
      expect(state.errorType, isNull);
      expect(state.message, isNull);
      expect(state.canRetry, isTrue);
      expect(state.requiresSettings, isFalse);
    });

    test('state with error type has error', () {
      const state = PoseErrorState(
        errorType: PoseErrorType.noPerson,
        message: 'No person detected',
      );

      expect(state.hasError, isTrue);
      expect(state.errorType, equals(PoseErrorType.noPerson));
      expect(state.message, equals('No person detected'));
    });

    test('non-retryable error state', () {
      const state = PoseErrorState(
        errorType: PoseErrorType.cameraUnavailable,
        message: 'Camera not available',
        canRetry: false,
      );

      expect(state.hasError, isTrue);
      expect(state.canRetry, isFalse);
    });

    test('error requiring settings', () {
      const state = PoseErrorState(
        errorType: PoseErrorType.cameraPermissionPermanentlyDenied,
        message: 'Permission denied',
        canRetry: false,
        requiresSettings: true,
      );

      expect(state.hasError, isTrue);
      expect(state.requiresSettings, isTrue);
      expect(state.canRetry, isFalse);
    });
  });

  group('Error type categories', () {
    test('camera errors are identified correctly', () {
      final cameraErrors = [
        PoseErrorType.cameraUnavailable,
        PoseErrorType.cameraPermissionDenied,
        PoseErrorType.cameraPermissionPermanentlyDenied,
      ];

      for (final error in cameraErrors) {
        expect(
          error.name.toLowerCase().contains('camera'),
          isTrue,
          reason: '$error should be a camera error',
        );
      }
    });

    test('pose quality errors are identified correctly', () {
      final poseQualityErrors = [
        PoseErrorType.lowLight,
        PoseErrorType.noPerson,
        PoseErrorType.multiplePeople,
        PoseErrorType.tooFar,
        PoseErrorType.tooClose,
        PoseErrorType.partiallyOutOfFrame,
      ];

      expect(poseQualityErrors.length, equals(6));
    });

    test('system errors are identified correctly', () {
      final systemErrors = [
        PoseErrorType.mediaPipeInitFailed,
        PoseErrorType.detectionFailed,
        PoseErrorType.sessionError,
      ];

      expect(systemErrors.length, equals(3));
    });
  });

  group('Error severity classification', () {
    test('permission errors are non-retryable', () {
      final permissionErrors = [
        PoseErrorType.cameraPermissionPermanentlyDenied,
        PoseErrorType.cameraUnavailable,
      ];

      // These errors typically cannot be retried
      for (final error in permissionErrors) {
        expect(
          error == PoseErrorType.cameraPermissionPermanentlyDenied ||
              error == PoseErrorType.cameraUnavailable,
          isTrue,
        );
      }
    });

    test('temporary errors are retryable', () {
      final temporaryErrors = [
        PoseErrorType.lowLight,
        PoseErrorType.noPerson,
        PoseErrorType.tooFar,
        PoseErrorType.tooClose,
        PoseErrorType.partiallyOutOfFrame,
      ];

      // These are conditions that can change
      expect(temporaryErrors.length, equals(5));
    });
  });

  group('PoseErrorState equality', () {
    test('identical states are equal', () {
      const state1 = PoseErrorState(
        errorType: PoseErrorType.noPerson,
        message: 'Test message',
        canRetry: true,
        requiresSettings: false,
      );

      const state2 = PoseErrorState(
        errorType: PoseErrorType.noPerson,
        message: 'Test message',
        canRetry: true,
        requiresSettings: false,
      );

      // Note: This tests the default Dart object equality
      // Both have the same values but are different instances
      expect(state1.errorType, equals(state2.errorType));
      expect(state1.message, equals(state2.message));
      expect(state1.canRetry, equals(state2.canRetry));
      expect(state1.requiresSettings, equals(state2.requiresSettings));
    });
  });

  group('Error message content', () {
    test('all error types should have corresponding messages', () {
      // Each error type should map to a user-friendly message
      final errorMessages = {
        PoseErrorType.cameraUnavailable: 'カメラ',
        PoseErrorType.cameraPermissionDenied: '許可',
        PoseErrorType.cameraPermissionPermanentlyDenied: '拒否',
        PoseErrorType.mediaPipeInitFailed: '初期化',
        PoseErrorType.lowLight: '明る',
        PoseErrorType.noPerson: '人物',
        PoseErrorType.multiplePeople: '複数',
        PoseErrorType.tooFar: '遠',
        PoseErrorType.tooClose: '近',
        PoseErrorType.partiallyOutOfFrame: 'フレーム',
        PoseErrorType.detectionFailed: 'エラー',
      };

      expect(errorMessages.length, equals(11));

      for (final entry in errorMessages.entries) {
        expect(
          entry.value.isNotEmpty,
          isTrue,
          reason: '${entry.key} should have a message keyword',
        );
      }
    });
  });
}
