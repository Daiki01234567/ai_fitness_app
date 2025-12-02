// Application initialization state provider
//
// Combines authentication and consent state to determine app readiness.
// This prevents flickering during navigation by ensuring both states
// are fully loaded before routing decisions are made.
//
// Spec reference: docs/specs/05_v3_3.md Section 2.1
//
// @version 1.0.0
// @date 2025-12-02

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';

/// Represents the combined initialization state of the app
enum AppInitializationStatus {
  /// Still loading auth or consent state
  loading,

  /// User is not authenticated
  unauthenticated,

  /// User is authenticated but needs to accept terms
  needsConsent,

  /// User is authenticated and has accepted all terms
  ready,

  /// User was force logged out
  forceLoggedOut,
}

/// Combined app initialization state
class AppInitializationState {
  final AppInitializationStatus status;
  final bool isAuthLoading;
  final bool isConsentLoading;

  const AppInitializationState({
    required this.status,
    required this.isAuthLoading,
    required this.isConsentLoading,
  });

  /// True if any state is still loading
  bool get isLoading => isAuthLoading || isConsentLoading;

  /// True if the app is ready for normal navigation
  bool get isReady => status == AppInitializationStatus.ready;

  /// True if consent screen should be shown
  bool get shouldShowConsent => status == AppInitializationStatus.needsConsent;

  /// True if login screen should be shown
  bool get shouldShowLogin =>
      status == AppInitializationStatus.unauthenticated ||
      status == AppInitializationStatus.forceLoggedOut;

  @override
  String toString() {
    return 'AppInitializationState(status: $status, authLoading: $isAuthLoading, consentLoading: $isConsentLoading)';
  }
}

/// Provider that combines auth and consent states to determine app readiness
///
/// This provider solves the consent screen flickering issue by:
/// 1. Returning loading status until BOTH auth AND consent states are loaded
/// 2. Only then determining the appropriate navigation destination
/// 3. Ensuring atomic state transitions for smooth UX
final appInitializationProvider = Provider<AppInitializationState>((ref) {
  final authState = ref.watch(authStateProvider);
  final consentState = ref.watch(consentStateProvider);

  // Check force logout first - this takes priority
  if (authState.isForceLogout) {
    return const AppInitializationState(
      status: AppInitializationStatus.forceLoggedOut,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // Check if user is not authenticated
  if (authState.user == null && !authState.isLoading) {
    return AppInitializationState(
      status: AppInitializationStatus.unauthenticated,
      isAuthLoading: authState.isLoading,
      isConsentLoading: false, // Don't care about consent if not authenticated
    );
  }

  // User exists but auth is still loading user data
  if (authState.isLoading) {
    return AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: true,
      isConsentLoading: consentState.isLoading,
    );
  }

  // Auth is loaded, but consent state is still loading
  // This is the key fix - we wait for consent state before deciding
  if (consentState.isLoading) {
    return AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: false,
      isConsentLoading: true,
    );
  }

  // Both states are loaded - determine final status
  if (consentState.needsConsent) {
    return const AppInitializationState(
      status: AppInitializationStatus.needsConsent,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // All good - user is authenticated and has given consent
  return const AppInitializationState(
    status: AppInitializationStatus.ready,
    isAuthLoading: false,
    isConsentLoading: false,
  );
});
