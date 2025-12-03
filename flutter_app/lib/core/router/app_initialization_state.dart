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

  // Debug logging
  // ignore: avoid_print
  print('[AppInit] authState: user=${authState.user?.uid}, isLoading=${authState.isLoading}, isForceLogout=${authState.isForceLogout}');
  // ignore: avoid_print
  print('[AppInit] consentState: isLoading=${consentState.isLoading}, needsConsent=${consentState.needsConsent}, tosAccepted=${consentState.tosAccepted}');

  // Check force logout first - this takes priority over everything
  if (authState.isForceLogout) {
    // ignore: avoid_print
    print('[AppInit] -> forceLoggedOut');
    return const AppInitializationState(
      status: AppInitializationStatus.forceLoggedOut,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // Check if user is not authenticated - this takes priority over consent
  // User must be logged in before we care about consent status
  // This check must come BEFORE loading check to prevent flickering to consent screen
  if (authState.user == null) {
    // If still loading auth state, show loading
    if (authState.isLoading) {
      // ignore: avoid_print
      print('[AppInit] -> loading (auth loading, no user yet)');
      return const AppInitializationState(
        status: AppInitializationStatus.loading,
        isAuthLoading: true,
        isConsentLoading: false,
      );
    }
    // Auth loading complete and no user - definitely unauthenticated
    // ignore: avoid_print
    print('[AppInit] -> unauthenticated');
    return const AppInitializationState(
      status: AppInitializationStatus.unauthenticated,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // From here on, user is authenticated (authState.user != null)

  // User exists but auth is still loading user data (e.g., fetching userData from Firestore)
  if (authState.isLoading) {
    // ignore: avoid_print
    print('[AppInit] -> loading (auth loading user data)');
    return const AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: true,
      isConsentLoading: true, // Keep consent loading while auth is loading
    );
  }

  // Auth is loaded, but consent state is still loading
  // IMPORTANT: Wait for consent state to fully load before making routing decisions
  // This prevents flickering when consent listener is initializing
  if (consentState.isLoading) {
    // ignore: avoid_print
    print('[AppInit] -> loading (consent loading)');
    return const AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: false,
      isConsentLoading: true,
    );
  }

  // Both states are loaded - determine final status
  if (consentState.needsConsent) {
    // ignore: avoid_print
    print('[AppInit] -> needsConsent');
    return const AppInitializationState(
      status: AppInitializationStatus.needsConsent,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // All good - user is authenticated and has given consent
  // ignore: avoid_print
  print('[AppInit] -> ready');
  return const AppInitializationState(
    status: AppInitializationStatus.ready,
    isAuthLoading: false,
    isConsentLoading: false,
  );
});
