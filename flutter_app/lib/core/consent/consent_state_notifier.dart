/// Consent State Management
///
/// Riverpod-based state management for consent status.
/// GDPR Article 7 compliant consent tracking.
///
/// @version 1.0.0
/// @date 2025-11-27

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'consent_service.dart';

part 'consent_state_notifier.freezed.dart';

/// Current document versions
const String currentTosVersion = '3.2';
const String currentPpVersion = '3.1';

/// Consent state data class
@freezed
class ConsentState with _$ConsentState {
  const factory ConsentState({
    /// Loading state
    @Default(true) bool isLoading,

    /// Error message
    String? error,

    /// Success message
    String? successMessage,

    /// ToS accepted
    @Default(false) bool tosAccepted,

    /// ToS accepted date
    DateTime? tosAcceptedAt,

    /// ToS version
    String? tosVersion,

    /// PP accepted
    @Default(false) bool ppAccepted,

    /// PP accepted date
    DateTime? ppAcceptedAt,

    /// PP version
    String? ppVersion,

    /// Needs consent (either ToS or PP not accepted)
    @Default(true) bool needsConsent,

    /// Needs update (version mismatch)
    @Default(false) bool needsUpdate,

    /// Consent history
    @Default([]) List<ConsentHistoryEntry> history,
  }) = _ConsentState;
}

/// Consent state notifier
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

  /// Initialize consent state listener
  void _init() {
    final user = _auth.currentUser;
    if (user != null) {
      _listenToUserConsentState(user.uid);
    } else {
      // No user logged in - set isLoading to false to allow router redirect
      state = state.copyWith(isLoading: false);
    }

    // Listen for auth state changes
    _auth.authStateChanges().listen((user) {
      if (user != null) {
        _listenToUserConsentState(user.uid);
      } else {
        _userSubscription?.cancel();
        // Reset state with isLoading: false for unauthenticated users
        state = const ConsentState(isLoading: false);
      }
    });
  }

  /// Listen to user consent state from Firestore
  void _listenToUserConsentState(String userId) {
    _userSubscription?.cancel();

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

          // Check if update needed
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
          state = state.copyWith(
            isLoading: false,
            needsConsent: true,
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

  /// Parse Firestore timestamp
  DateTime? _parseTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  /// Record consent for ToS
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

  /// Record consent for Privacy Policy
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

  /// Record both consents at once
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

  /// Revoke consent for ToS
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

  /// Revoke consent for Privacy Policy
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

  /// Revoke all consents
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

  /// Load consent history
  Future<void> loadHistory({int limit = 20}) async {
    try {
      final history = await _consentService.getConsentHistory(limit: limit);
      state = state.copyWith(history: history);
    } catch (e) {
      state = state.copyWith(error: 'Failed to load history: $e');
    }
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// Clear success message
  void clearSuccessMessage() {
    state = state.copyWith(successMessage: null);
  }

  @override
  void dispose() {
    _userSubscription?.cancel();
    super.dispose();
  }
}

/// Consent state provider
final consentStateProvider =
    StateNotifierProvider<ConsentStateNotifier, ConsentState>(
  (ref) => ConsentStateNotifier(),
);

/// Needs consent provider
final needsConsentProvider = Provider<bool>((ref) {
  return ref.watch(consentStateProvider).needsConsent;
});

/// Needs update provider
final needsConsentUpdateProvider = Provider<bool>((ref) {
  return ref.watch(consentStateProvider).needsUpdate;
});

/// Consent service provider
final consentServiceProvider = Provider<ConsentService>((ref) {
  return ConsentService();
});
