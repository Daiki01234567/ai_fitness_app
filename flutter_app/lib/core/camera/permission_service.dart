/// カメラ許可サービス
///
/// カメラ許可リクエストとステータスを管理します。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-024)
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart' as permission_handler;

/// 許可サービスプロバイダー
final permissionServiceProvider = Provider<PermissionService>((ref) {
  return PermissionService();
});

/// 許可状態プロバイダー
final cameraPermissionStateProvider =
    StateNotifierProvider<CameraPermissionNotifier, CameraPermissionState>((
      ref,
    ) {
      final service = ref.watch(permissionServiceProvider);
      return CameraPermissionNotifier(service);
    });

/// カメラ許可状態
enum CameraPermissionState {
  /// 許可状態が不明
  unknown,

  /// 許可が付与された
  granted,

  /// 許可が拒否された
  denied,

  /// 許可が永久に拒否された
  permanentlyDenied,

  /// 許可が制限されている（iOSのみ）
  restricted,

  /// 許可が限定的（iOS 14以降のみ）
  limited,
}

/// カメラ許可状態Notifier
class CameraPermissionNotifier extends StateNotifier<CameraPermissionState> {
  CameraPermissionNotifier(this._service)
    : super(CameraPermissionState.unknown);

  final PermissionService _service;

  /// 現在の許可状態をチェック
  Future<CameraPermissionState> checkPermission() async {
    state = await _service.checkCameraPermission();
    return state;
  }

  /// カメラ許可をリクエスト
  Future<CameraPermissionState> requestPermission() async {
    state = await _service.requestCameraPermission();
    return state;
  }

  /// アプリ設定を開く
  Future<bool> openSettings() async {
    return _service.openAppSettings();
  }
}

/// カメラ許可を処理するための許可サービス
class PermissionService {
  /// カメラ許可状態をチェック
  Future<CameraPermissionState> checkCameraPermission() async {
    final status = await permission_handler.Permission.camera.status;
    return _convertStatus(status);
  }

  /// カメラ許可をリクエスト
  Future<CameraPermissionState> requestCameraPermission() async {
    // まず現在の状態をチェック
    final currentStatus = await permission_handler.Permission.camera.status;

    if (currentStatus.isGranted) {
      return CameraPermissionState.granted;
    }

    if (currentStatus.isPermanentlyDenied) {
      debugPrint('PermissionService: Camera permission permanently denied');
      return CameraPermissionState.permanentlyDenied;
    }

    // 許可をリクエスト
    final newStatus = await permission_handler.Permission.camera.request();
    debugPrint('PermissionService: Camera permission result: $newStatus');

    return _convertStatus(newStatus);
  }

  /// 許可設定のためアプリ設定を開く
  Future<bool> openAppSettings() async {
    debugPrint('PermissionService: Opening app settings');
    return permission_handler.openAppSettings();
  }

  /// permission_handlerのステータスを独自のenumに変換
  CameraPermissionState _convertStatus(permission_handler.PermissionStatus status) {
    switch (status) {
      case permission_handler.PermissionStatus.granted:
        return CameraPermissionState.granted;
      case permission_handler.PermissionStatus.denied:
        return CameraPermissionState.denied;
      case permission_handler.PermissionStatus.permanentlyDenied:
        return CameraPermissionState.permanentlyDenied;
      case permission_handler.PermissionStatus.restricted:
        return CameraPermissionState.restricted;
      case permission_handler.PermissionStatus.limited:
        return CameraPermissionState.limited;
      case permission_handler.PermissionStatus.provisional:
        return CameraPermissionState.granted;
    }
  }
}

/// CameraPermissionStateの拡張メソッド
extension CameraPermissionStateExtension on CameraPermissionState {
  /// 許可がカメラ使用を許可しているか
  bool get isGranted => this == CameraPermissionState.granted;

  /// 許可が拒否されたか
  bool get isDenied =>
      this == CameraPermissionState.denied ||
      this == CameraPermissionState.permanentlyDenied;

  /// ユーザーが許可を付与するために設定に行く必要があるか
  bool get requiresSettings =>
      this == CameraPermissionState.permanentlyDenied ||
      this == CameraPermissionState.restricted;

  /// 許可状態に対するユーザーフレンドリーなメッセージを取得
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
