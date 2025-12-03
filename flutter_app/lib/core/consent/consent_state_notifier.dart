// 同意状態管理
//
// 同意ステータスのRiverpodベース状態管理。
// GDPR第7条に準拠した同意追跡。
//
// @version 1.0.0
// @date 2025-11-27

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'consent_service.dart';

part 'consent_state_notifier.freezed.dart';

/// 現在のドキュメントバージョン
const String currentTosVersion = '3.2';
const String currentPpVersion = '3.1';

/// 同意状態データクラス
@freezed
class ConsentState with _$ConsentState {
  const factory ConsentState({
    /// ローディング状態
    @Default(true) bool isLoading,

    /// エラーメッセージ
    String? error,

    /// 成功メッセージ
    String? successMessage,

    /// 利用規約同意済み
    @Default(false) bool tosAccepted,

    /// 利用規約同意日時
    DateTime? tosAcceptedAt,

    /// 利用規約バージョン
    String? tosVersion,

    /// プライバシーポリシー同意済み
    @Default(false) bool ppAccepted,

    /// プライバシーポリシー同意日時
    DateTime? ppAcceptedAt,

    /// プライバシーポリシーバージョン
    String? ppVersion,

    /// 同意が必要（利用規約またはプライバシーポリシーが未同意）
    @Default(true) bool needsConsent,

    /// 更新が必要（バージョン不一致）
    @Default(false) bool needsUpdate,

    /// 同意履歴
    @Default([]) List<ConsentHistoryEntry> history,
  }) = _ConsentState;
}

/// 同意状態Notifier
class ConsentStateNotifier extends StateNotifier<ConsentState> {
  final ConsentService _consentService;
  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;
  StreamSubscription<DocumentSnapshot>? _userSubscription;

  ConsentStateNotifier({
    ConsentService? consentService,
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _consentService = consentService ?? ConsentService(),
        _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance,
        super(const ConsentState()) {
    _init();
  }

  /// 同意状態リスナーを初期化
  void _init() {
    final user = _auth.currentUser;
    if (user != null) {
      _listenToUserConsentState(user.uid);
    } else {
      // ユーザーがログインしていない - ルーターのリダイレクトを許可するためisLoadingをfalseに設定
      state = state.copyWith(isLoading: false);
    }

    // 認証状態の変更をリッスン
    _auth.authStateChanges().listen((user) {
      if (user != null) {
        _listenToUserConsentState(user.uid);
      } else {
        _userSubscription?.cancel();
        _currentListeningUserId = null;
        // 未認証ユーザーのためにisLoading: falseで状態をリセット
        state = const ConsentState(isLoading: false);
      }
    });
  }

  /// 現在リッスン中のユーザーID
  String? _currentListeningUserId;

  /// Firestoreからユーザーの同意状態をリッスン
  void _listenToUserConsentState(String userId) {
    // Skip if already listening to the same user
    // This prevents unnecessary isLoading: true state changes that cause redirect loops
    if (_currentListeningUserId == userId && _userSubscription != null) {
      debugPrint('[ConsentState] Already listening to user $userId, skipping');
      return;
    }

    debugPrint('[ConsentState] Starting to listen for user $userId');
    _userSubscription?.cancel();
    _currentListeningUserId = userId;

    // Set loading state when starting to listen for a NEW user
    // Note: Only set isLoading if not already loading to prevent unnecessary state changes
    // that could trigger router re-evaluation and cause redirect loops
    if (!state.isLoading) {
      state = state.copyWith(isLoading: true);
    }

    _userSubscription = _firestore
        .collection('users')
        .doc(userId)
        .snapshots()
        .listen(
      (snapshot) {
        if (snapshot.exists) {
          final data = snapshot.data()!;

          final tosAccepted = data['tosAccepted'] == true;
          final ppAccepted = data['ppAccepted'] == true;
          final tosVersion = data['tosVersion'] as String?;
          final ppVersion = data['ppVersion'] as String?;

          // 更新が必要かチェック
          final tosNeedsUpdate =
              tosAccepted && tosVersion != currentTosVersion;
          final ppNeedsUpdate = ppAccepted && ppVersion != currentPpVersion;

          state = state.copyWith(
            isLoading: false,
            tosAccepted: tosAccepted,
            tosAcceptedAt: _parseTimestamp(data['tosAcceptedAt']),
            tosVersion: tosVersion,
            ppAccepted: ppAccepted,
            ppAcceptedAt: _parseTimestamp(data['ppAcceptedAt']),
            ppVersion: ppVersion,
            needsConsent: !tosAccepted || !ppAccepted,
            needsUpdate: tosNeedsUpdate || ppNeedsUpdate,
            error: null,
          );
        } else {
          // Document doesn't exist yet (newly registered user)
          // Keep loading state to wait for document creation by Cloud Function
          // The register_screen waits for document creation, so this should resolve quickly
          state = state.copyWith(
            isLoading: false,
            needsConsent: true,
            tosAccepted: false,
            ppAccepted: false,
          );
        }
      },
      onError: (error) {
        state = state.copyWith(
          isLoading: false,
          error: 'Failed to load consent status: $error',
        );
      },
    );
  }

  /// Firestoreタイムスタンプをパース
  DateTime? _parseTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  /// 利用規約の同意を記録
  Future<bool> acceptTermsOfService() async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.recordConsent(
      consentType: 'tos',
      accepted: true,
    );

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
      successMessage: result.success ? result.message : null,
    );

    return result.success;
  }

  /// プライバシーポリシーの同意を記録
  Future<bool> acceptPrivacyPolicy() async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.recordConsent(
      consentType: 'privacy_policy',
      accepted: true,
    );

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
      successMessage: result.success ? result.message : null,
    );

    return result.success;
  }

  /// 両方の同意を一度に記録
  Future<bool> acceptAllConsents() async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.recordAllConsents();

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
      successMessage: result.success ? result.message : null,
    );

    return result.success;
  }

  /// 利用規約の同意を撤回
  Future<ConsentResult> revokeTermsOfService({
    bool requestDataDeletion = false,
    String? reason,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.revokeConsent(
      consentType: 'tos',
      requestDataDeletion: requestDataDeletion,
      reason: reason,
    );

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
    );

    return result;
  }

  /// プライバシーポリシーの同意を撤回
  Future<ConsentResult> revokePrivacyPolicy({
    bool requestDataDeletion = false,
    String? reason,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.revokeConsent(
      consentType: 'privacy_policy',
      requestDataDeletion: requestDataDeletion,
      reason: reason,
    );

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
    );

    return result;
  }

  /// すべての同意を撤回
  Future<ConsentResult> revokeAllConsents({
    bool requestDataDeletion = false,
    String? reason,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _consentService.revokeAllConsents(
      requestDataDeletion: requestDataDeletion,
      reason: reason,
    );

    state = state.copyWith(
      isLoading: false,
      error: result.success ? null : result.error,
    );

    return result;
  }

  /// 同意履歴を読み込み
  Future<void> loadHistory({int limit = 20}) async {
    try {
      final history = await _consentService.getConsentHistory(limit: limit);
      state = state.copyWith(history: history);
    } catch (e) {
      state = state.copyWith(error: 'Failed to load history: $e');
    }
  }

  /// エラーをクリア
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// 成功メッセージをクリア
  void clearSuccessMessage() {
    state = state.copyWith(successMessage: null);
  }

  @override
  void dispose() {
    _userSubscription?.cancel();
    _currentListeningUserId = null;
    super.dispose();
  }
}

/// 同意状態プロバイダー
final consentStateProvider =
    StateNotifierProvider<ConsentStateNotifier, ConsentState>(
  (ref) => ConsentStateNotifier(),
);

/// 同意必要プロバイダー
final needsConsentProvider = Provider<bool>((ref) {
  return ref.watch(consentStateProvider).needsConsent;
});

/// 同意更新必要プロバイダー
final needsConsentUpdateProvider = Provider<bool>((ref) {
  return ref.watch(consentStateProvider).needsUpdate;
});

/// 同意サービスプロバイダー
final consentServiceProvider = Provider<ConsentService>((ref) {
  return ConsentService();
});
