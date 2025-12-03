/// カメラエラー種別定義
///
/// カメラ関連のエラーを種別化し、適切なUIメッセージとアクションを提供します。
/// 参照: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.8)
library;

import 'package:flutter/material.dart';

/// カメラエラー種別
enum CameraErrorType {
  /// カメラ権限が拒否された
  permissionDenied,

  /// カメラ権限が永続的に拒否された（設定から許可が必要）
  permissionPermanentlyDenied,

  /// デバイスにカメラがない
  noCameraAvailable,

  /// カメラが他のアプリで使用中
  cameraInUse,

  /// カメラの初期化に失敗
  initializationFailed,

  /// ポーズ検出の初期化に失敗
  poseDetectorFailed,

  /// メモリ不足
  outOfMemory,

  /// 一時的なエラー（再試行可能）
  temporaryError,

  /// 不明なエラー
  unknown,
}

/// カメラエラー情報
class CameraError {
  const CameraError({
    required this.type,
    required this.message,
    this.technicalDetails,
  });

  /// エラー種別
  final CameraErrorType type;

  /// ユーザー向けメッセージ
  final String message;

  /// 技術的詳細（デバッグ用）
  final String? technicalDetails;

  /// エラー種別からアイコンを取得
  IconData get icon {
    switch (type) {
      case CameraErrorType.permissionDenied:
      case CameraErrorType.permissionPermanentlyDenied:
        return Icons.no_photography;
      case CameraErrorType.noCameraAvailable:
        return Icons.videocam_off;
      case CameraErrorType.cameraInUse:
        return Icons.phonelink_lock;
      case CameraErrorType.initializationFailed:
      case CameraErrorType.poseDetectorFailed:
        return Icons.error_outline;
      case CameraErrorType.outOfMemory:
        return Icons.memory;
      case CameraErrorType.temporaryError:
        return Icons.refresh;
      case CameraErrorType.unknown:
        return Icons.help_outline;
    }
  }

  /// 再試行可能かどうか
  bool get canRetry {
    switch (type) {
      case CameraErrorType.permissionDenied:
      case CameraErrorType.cameraInUse:
      case CameraErrorType.initializationFailed:
      case CameraErrorType.poseDetectorFailed:
      case CameraErrorType.temporaryError:
        return true;
      case CameraErrorType.permissionPermanentlyDenied:
      case CameraErrorType.noCameraAvailable:
      case CameraErrorType.outOfMemory:
      case CameraErrorType.unknown:
        return false;
    }
  }

  /// 設定画面への誘導が必要かどうか
  bool get needsSettings {
    return type == CameraErrorType.permissionPermanentlyDenied;
  }

  /// ユーザーへの推奨アクション
  String get recommendedAction {
    switch (type) {
      case CameraErrorType.permissionDenied:
        return 'カメラへのアクセスを許可してください。';
      case CameraErrorType.permissionPermanentlyDenied:
        return '設定アプリからカメラの権限を許可してください。';
      case CameraErrorType.noCameraAvailable:
        return 'このデバイスではカメラ機能を使用できません。';
      case CameraErrorType.cameraInUse:
        return '他のアプリでカメラを使用中です。他のアプリを閉じてから再試行してください。';
      case CameraErrorType.initializationFailed:
        return 'カメラの起動に問題が発生しました。再試行してください。';
      case CameraErrorType.poseDetectorFailed:
        return 'ポーズ検出機能の準備に失敗しました。再試行してください。';
      case CameraErrorType.outOfMemory:
        return 'メモリが不足しています。他のアプリを終了してから再試行してください。';
      case CameraErrorType.temporaryError:
        return '一時的なエラーが発生しました。再試行してください。';
      case CameraErrorType.unknown:
        return '予期しないエラーが発生しました。アプリを再起動してください。';
    }
  }

  /// エラーメッセージから種別を推測
  static CameraError fromMessage(String message) {
    final lowerMessage = message.toLowerCase();

    if (lowerMessage.contains('permission') || lowerMessage.contains('権限')) {
      if (lowerMessage.contains('permanently') || lowerMessage.contains('設定')) {
        return const CameraError(
          type: CameraErrorType.permissionPermanentlyDenied,
          message: 'カメラの権限が拒否されています',
        );
      }
      return const CameraError(
        type: CameraErrorType.permissionDenied,
        message: 'カメラの権限が許可されていません',
      );
    }

    if (lowerMessage.contains('no camera') ||
        lowerMessage.contains('not available') ||
        lowerMessage.contains('カメラがありません')) {
      return const CameraError(
        type: CameraErrorType.noCameraAvailable,
        message: 'カメラが見つかりません',
      );
    }

    if (lowerMessage.contains('in use') ||
        lowerMessage.contains('busy') ||
        lowerMessage.contains('使用中')) {
      return CameraError(
        type: CameraErrorType.cameraInUse,
        message: 'カメラが他のアプリで使用中です',
        technicalDetails: message,
      );
    }

    if (lowerMessage.contains('pose') || lowerMessage.contains('detector')) {
      return CameraError(
        type: CameraErrorType.poseDetectorFailed,
        message: 'ポーズ検出の初期化に失敗しました',
        technicalDetails: message,
      );
    }

    if (lowerMessage.contains('memory') || lowerMessage.contains('メモリ')) {
      return const CameraError(
        type: CameraErrorType.outOfMemory,
        message: 'メモリ不足です',
      );
    }

    if (lowerMessage.contains('initialize') ||
        lowerMessage.contains('failed') ||
        lowerMessage.contains('初期化')) {
      return CameraError(
        type: CameraErrorType.initializationFailed,
        message: 'カメラの初期化に失敗しました',
        technicalDetails: message,
      );
    }

    // Default to temporary error if the message seems recoverable
    if (lowerMessage.contains('timeout') || lowerMessage.contains('retry')) {
      return CameraError(
        type: CameraErrorType.temporaryError,
        message: '一時的なエラーが発生しました',
        technicalDetails: message,
      );
    }

    return CameraError(
      type: CameraErrorType.unknown,
      message: 'エラーが発生しました',
      technicalDetails: message,
    );
  }

  /// カメラ権限拒否エラーを作成
  static const permissionDenied = CameraError(
    type: CameraErrorType.permissionDenied,
    message: 'カメラの権限が許可されていません',
  );

  /// カメラ権限永続的拒否エラーを作成
  static const permissionPermanentlyDenied = CameraError(
    type: CameraErrorType.permissionPermanentlyDenied,
    message: 'カメラの権限が拒否されています',
  );

  /// カメラなしエラーを作成
  static const noCameraAvailable = CameraError(
    type: CameraErrorType.noCameraAvailable,
    message: 'このデバイスにはカメラがありません',
  );

  /// カメラ使用中エラーを作成
  static const cameraInUse = CameraError(
    type: CameraErrorType.cameraInUse,
    message: 'カメラが他のアプリで使用中です',
  );

  /// 初期化失敗エラーを作成
  static const initializationFailed = CameraError(
    type: CameraErrorType.initializationFailed,
    message: 'カメラの初期化に失敗しました',
  );

  /// ポーズ検出失敗エラーを作成
  static const poseDetectorFailed = CameraError(
    type: CameraErrorType.poseDetectorFailed,
    message: 'ポーズ検出の初期化に失敗しました',
  );
}
