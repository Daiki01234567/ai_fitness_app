/// Camera Permission Service
///
/// Manages camera permission requests and status.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-024)
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

/// Permission service provider
final permissionServiceProvider = Provider<PermissionService>((ref) {
  return PermissionService();
});

/// Permission state provider
final cameraPermissionStateProvider =
    StateNotifierProvider<CameraPermissionNotifier, CameraPermissionState>((ref) {
  final service = ref.watch(permissionServiceProvider);
  return CameraPermissionNotifier(service);
});

/// Camera permission state
enum CameraPermissionState {
  /// Permission status is unknown
  unknown,

  /// Permission has been granted
  granted,

  /// Permission has been denied
  denied,

  /// Permission has been permanently denied
  permanentlyDenied,

  /// Permission is restricted (iOS only)
  restricted,

  /// Permission is limited (iOS 14+ only)
  limited,
}

/// Camera permission state notifier
class CameraPermissionNotifier extends StateNotifier<CameraPermissionState> {
  CameraPermissionNotifier(this._service) : super(CameraPermissionState.unknown);

  final PermissionService _service;

  /// Check current permission status
  Future<CameraPermissionState> checkPermission() async {
    state = await _service.checkCameraPermission();
    return state;
  }

  /// Request camera permission
  Future<CameraPermissionState> requestPermission() async {
    state = await _service.requestCameraPermission();
    return state;
  }

  /// Open app settings
  Future<bool> openSettings() async {
    return _service.openAppSettings();
  }
}

/// Permission service for handling camera permissions
class PermissionService {
  /// Check camera permission status
  Future<CameraPermissionState> checkCameraPermission() async {
    final status = await Permission.camera.status;
    return _convertStatus(status);
  }

  /// Request camera permission
  Future<CameraPermissionState> requestCameraPermission() async {
    // First check current status
    final currentStatus = await Permission.camera.status;

    if (currentStatus.isGranted) {
      return CameraPermissionState.granted;
    }

    if (currentStatus.isPermanentlyDenied) {
      debugPrint('PermissionService: Camera permission permanently denied');
      return CameraPermissionState.permanentlyDenied;
    }

    // Request permission
    final newStatus = await Permission.camera.request();
    debugPrint('PermissionService: Camera permission result: $newStatus');

    return _convertStatus(newStatus);
  }

  /// Open app settings for permission configuration
  Future<bool> openAppSettings() async {
    debugPrint('PermissionService: Opening app settings');
    return openAppSettings();
  }

  /// Convert permission_handler status to our enum
  CameraPermissionState _convertStatus(PermissionStatus status) {
    switch (status) {
      case PermissionStatus.granted:
        return CameraPermissionState.granted;
      case PermissionStatus.denied:
        return CameraPermissionState.denied;
      case PermissionStatus.permanentlyDenied:
        return CameraPermissionState.permanentlyDenied;
      case PermissionStatus.restricted:
        return CameraPermissionState.restricted;
      case PermissionStatus.limited:
        return CameraPermissionState.limited;
      case PermissionStatus.provisional:
        return CameraPermissionState.granted;
    }
  }
}

/// Extension methods for CameraPermissionState
extension CameraPermissionStateExtension on CameraPermissionState {
  /// Whether permission allows camera usage
  bool get isGranted => this == CameraPermissionState.granted;

  /// Whether permission was denied
  bool get isDenied =>
      this == CameraPermissionState.denied ||
      this == CameraPermissionState.permanentlyDenied;

  /// Whether user needs to go to settings to grant permission
  bool get requiresSettings =>
      this == CameraPermissionState.permanentlyDenied ||
      this == CameraPermissionState.restricted;

  /// Get user-friendly message for permission state
  String get message {
    switch (this) {
      case CameraPermissionState.unknown:
        return 'カメラの許可が必要です';
      case CameraPermissionState.granted:
        return 'カメラの使用が許可されています';
      case CameraPermissionState.denied:
        return 'カメラの許可が拒否されました。トレーニング機能を使用するにはカメラの許可が必要です。';
      case CameraPermissionState.permanentlyDenied:
        return 'カメラの許可が拒否されています。設定アプリからカメラの許可を有効にしてください。';
      case CameraPermissionState.restricted:
        return 'カメラの使用が制限されています。デバイスの設定を確認してください。';
      case CameraPermissionState.limited:
        return 'カメラの許可が制限されています。';
    }
  }
}
