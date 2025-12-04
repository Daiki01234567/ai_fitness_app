// 同意管理サービス
//
// 利用規約とプライバシーポリシーの同意操作を処理します。
// GDPR第7条に準拠した同意管理。
//
// @version 1.0.0
// @date 2025-11-27

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// 同意操作の結果
class ConsentResult {
  final bool success;
  final String? message;
  final String? error;
  final bool forceLogout;

  ConsentResult({
    required this.success,
    this.message,
    this.error,
    this.forceLogout = false,
  });
}

/// 同意ステータスデータ
class ConsentStatus {
  final bool tosAccepted;
  final DateTime? tosAcceptedAt;
  final String? tosVersion;
  final String tosCurrentVersion;
  final bool tosNeedsUpdate;
  final bool ppAccepted;
  final DateTime? ppAcceptedAt;
  final String? ppVersion;
  final String ppCurrentVersion;
  final bool ppNeedsUpdate;
  final bool allConsentsValid;
  final bool needsConsent;

  ConsentStatus({
    required this.tosAccepted,
    this.tosAcceptedAt,
    this.tosVersion,
    required this.tosCurrentVersion,
    required this.tosNeedsUpdate,
    required this.ppAccepted,
    this.ppAcceptedAt,
    this.ppVersion,
    required this.ppCurrentVersion,
    required this.ppNeedsUpdate,
    required this.allConsentsValid,
    required this.needsConsent,
  });

  factory ConsentStatus.fromMap(Map<String, dynamic> data) {
    return ConsentStatus(
      tosAccepted: data['tosAccepted'] ?? false,
      tosAcceptedAt: data['tosAcceptedAt'] != null
          ? DateTime.parse(data['tosAcceptedAt'])
          : null,
      tosVersion: data['tosVersion'],
      tosCurrentVersion: data['tosCurrentVersion'] ?? '3.2',
      tosNeedsUpdate: data['tosNeedsUpdate'] ?? false,
      ppAccepted: data['ppAccepted'] ?? false,
      ppAcceptedAt: data['ppAcceptedAt'] != null
          ? DateTime.parse(data['ppAcceptedAt'])
          : null,
      ppVersion: data['ppVersion'],
      ppCurrentVersion: data['ppCurrentVersion'] ?? '3.1',
      ppNeedsUpdate: data['ppNeedsUpdate'] ?? false,
      allConsentsValid: data['allConsentsValid'] ?? false,
      needsConsent: data['needsConsent'] ?? true,
    );
  }
}

/// 同意履歴エントリ
class ConsentHistoryEntry {
  final String consentType;
  final String action;
  final String documentVersion;
  final DateTime createdAt;

  ConsentHistoryEntry({
    required this.consentType,
    required this.action,
    required this.documentVersion,
    required this.createdAt,
  });

  factory ConsentHistoryEntry.fromMap(Map<String, dynamic> data) {
    return ConsentHistoryEntry(
      consentType: data['consentType'] ?? '',
      action: data['action'] ?? '',
      documentVersion: data['documentVersion'] ?? '',
      createdAt: data['createdAt'] != null
          ? DateTime.parse(data['createdAt'])
          : DateTime.now(),
    );
  }
}

/// 同意管理サービス
class ConsentService {
  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;

  ConsentService({FirebaseFunctions? functions, FirebaseAuth? auth})
    : _functions =
          functions ?? FirebaseFunctions.instanceFor(region: 'asia-northeast1'),
      _auth = auth ?? FirebaseAuth.instance;

  /// ユーザーが認証されているかチェック
  bool get _isAuthenticated => _auth.currentUser != null;

  /// 現在の同意ステータスを取得
  Future<ConsentStatus> getConsentStatus({bool includeHistory = false}) async {
    if (!_isAuthenticated) {
      throw Exception('認証が必要です');
    }

    try {
      final callable = _functions.httpsCallable('getConsentStatus');
      final result = await callable.call({'includeHistory': includeHistory});

      final data = result.data as Map<String, dynamic>;

      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Failed to get consent status');
      }

      return ConsentStatus.fromMap(data['status'] as Map<String, dynamic>);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(_getErrorMessage(e));
    }
  }

  /// 同意履歴を取得
  Future<List<ConsentHistoryEntry>> getConsentHistory({int limit = 10}) async {
    if (!_isAuthenticated) {
      throw Exception('認証が必要です');
    }

    try {
      final callable = _functions.httpsCallable('getConsentStatus');
      final result = await callable.call({
        'includeHistory': true,
        'historyLimit': limit,
      });

      final data = result.data as Map<String, dynamic>;

      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Failed to get consent history');
      }

      final historyData = data['history'] as List<dynamic>? ?? [];
      return historyData
          .map((e) => ConsentHistoryEntry.fromMap(e as Map<String, dynamic>))
          .toList();
    } on FirebaseFunctionsException catch (e) {
      throw Exception(_getErrorMessage(e));
    }
  }

  /// 同意受諾を記録
  Future<ConsentResult> recordConsent({
    required String consentType,
    required bool accepted,
  }) async {
    if (!_isAuthenticated) {
      return ConsentResult(success: false, error: '認証が必要です');
    }

    try {
      final callable = _functions.httpsCallable('recordConsent');
      final result = await callable.call({
        'consentType': consentType,
        'accepted': accepted,
      });

      final data = result.data as Map<String, dynamic>;

      return ConsentResult(
        success: data['success'] == true,
        message: data['message'],
      );
    } on FirebaseFunctionsException catch (e) {
      return ConsentResult(success: false, error: _getErrorMessage(e));
    }
  }

  /// 利用規約とプライバシーポリシーの同意を一度に記録
  Future<ConsentResult> recordAllConsents() async {
    // 利用規約の同意を記録
    final tosResult = await recordConsent(consentType: 'tos', accepted: true);

    if (!tosResult.success) {
      return tosResult;
    }

    // プライバシーポリシーの同意を記録
    final ppResult = await recordConsent(
      consentType: 'privacy_policy',
      accepted: true,
    );

    return ppResult;
  }

  /// 同意を撤回
  Future<ConsentResult> revokeConsent({
    required String consentType,
    bool requestDataDeletion = false,
    String? reason,
  }) async {
    if (!_isAuthenticated) {
      return ConsentResult(success: false, error: '認証が必要です');
    }

    try {
      final callable = _functions.httpsCallable('revokeConsent');
      final result = await callable.call({
        'consentType': consentType,
        'requestDataDeletion': requestDataDeletion,
        if (reason != null) 'reason': reason,
      });

      final data = result.data as Map<String, dynamic>;

      return ConsentResult(
        success: data['success'] == true,
        message: data['message'],
        forceLogout: data['forceLogout'] == true,
      );
    } on FirebaseFunctionsException catch (e) {
      return ConsentResult(success: false, error: _getErrorMessage(e));
    }
  }

  /// すべての同意を撤回
  Future<ConsentResult> revokeAllConsents({
    bool requestDataDeletion = false,
    String? reason,
  }) async {
    return revokeConsent(
      consentType: 'all',
      requestDataDeletion: requestDataDeletion,
      reason: reason,
    );
  }

  /// FirebaseFunctionsExceptionからエラーメッセージを取得
  String _getErrorMessage(FirebaseFunctionsException e) {
    switch (e.code) {
      case 'unauthenticated':
        return '認証が必要です';
      case 'permission-denied':
        return 'アクセスが拒否されました';
      case 'not-found':
        return 'データが見つかりません';
      case 'invalid-argument':
        return e.message ?? '入力が無効です';
      case 'failed-precondition':
        return e.message ?? '操作を実行できません';
      default:
        return e.message ?? 'エラーが発生しました';
    }
  }
}
