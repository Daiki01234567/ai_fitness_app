// Application initialization state provider
//
// Combines authentication, consent, and onboarding state to determine app readiness.
// This prevents flickering during navigation by ensuring all states
// are fully loaded before routing decisions are made.
//
// Spec reference: docs/specs/05_v3_3.md Section 2.1
//
// @version 1.1.0
// @date 2025-12-08

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';
import '../onboarding/onboarding_service.dart';

/// Debug logging flag - set to false to disable verbose logs
const bool _kEnableVerboseLogging = false;

/// Represents the combined initialization state of the app
enum AppInitializationStatus {
  /// Still loading auth, consent, or onboarding state
  loading,

  /// First launch - show onboarding
  firstLaunch,

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
  final bool isOnboardingLoading;

  const AppInitializationState({
    required this.status,
    required this.isAuthLoading,
    required this.isConsentLoading,
    this.isOnboardingLoading = false,
  });

  /// True if any state is still loading
  bool get isLoading => isAuthLoading || isConsentLoading || isOnboardingLoading;

  /// True if the app is ready for normal navigation
  bool get isReady => status == AppInitializationStatus.ready;

  /// True if consent screen should be shown
  bool get shouldShowConsent => status == AppInitializationStatus.needsConsent;

  /// True if login screen should be shown
  bool get shouldShowLogin =>
      status == AppInitializationStatus.unauthenticated ||
      status == AppInitializationStatus.forceLoggedOut;

  /// True if onboarding should be shown (first launch)
  bool get shouldShowOnboarding => status == AppInitializationStatus.firstLaunch;

  @override
  String toString() {
    return 'AppInitializationState(status: $status, authLoading: $isAuthLoading, consentLoading: $isConsentLoading, onboardingLoading: $isOnboardingLoading)';
  }
}

/// Provider that combines auth, consent, and onboarding states to determine app readiness
///
/// This provider solves the consent screen flickering issue by:
/// 1. Returning loading status until all states are loaded
/// 2. Checking first launch FIRST before other states
/// 3. Only then determining the appropriate navigation destination
/// 4. Ensuring atomic state transitions for smooth UX
final appInitializationProvider = Provider<AppInitializationState>((ref) {
  final authState = ref.watch(authStateProvider);
  final consentState = ref.watch(consentStateProvider);
  final isFirstLaunchAsync = ref.watch(isFirstLaunchProvider);

  // Debug logging - only when verbose logging is enabled
  if (_kEnableVerboseLogging && kDebugMode) {
    debugPrint(
      '[AppInit] authState: user=${authState.user?.uid}, isLoading=${authState.isLoading}, isForceLogout=${authState.isForceLogout}',
    );
    debugPrint(
      '[AppInit] consentState: isLoading=${consentState.isLoading}, needsConsent=${consentState.needsConsent}, tosAccepted=${consentState.tosAccepted}',
    );
    debugPrint('[AppInit] isFirstLaunchAsync: $isFirstLaunchAsync');
  }

  // Check force logout first - this takes priority over everything
  if (authState.isForceLogout) {
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> forceLoggedOut');
    }
    return const AppInitializationState(
      status: AppInitializationStatus.forceLoggedOut,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // Check first launch state - this must be checked early
  final isFirstLaunch = isFirstLaunchAsync.when(
    data: (value) => value,
    loading: () => null, // null means still loading
    error: (_, __) => false, // assume not first launch on error
  );

  // If first launch state is still loading, wait
  if (isFirstLaunch == null) {
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> loading (first launch check)');
    }
    return AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: authState.isLoading,
      isConsentLoading: false,
      isOnboardingLoading: true,
    );
  }

  // If this is the first launch, go to onboarding regardless of auth state
  if (isFirstLaunch) {
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> firstLaunch');
    }
    return const AppInitializationState(
      status: AppInitializationStatus.firstLaunch,
      isAuthLoading: false,
      isConsentLoading: false,
      isOnboardingLoading: false,
    );
  }

  // Not first launch - now check auth state

  // Check if user is not authenticated - this takes priority over consent
  // User must be logged in before we care about consent status
  // This check must come BEFORE loading check to prevent flickering to consent screen
  if (authState.user == null) {
    // If auth state is not initialized yet (first Firebase Auth callback not received)
    // or still loading, show loading
    if (!authState.isInitialized || authState.isLoading) {
      if (_kEnableVerboseLogging && kDebugMode) {
        debugPrint('[AppInit] -> loading (auth not initialized or loading, no user yet)');
      }
      return const AppInitializationState(
        status: AppInitializationStatus.loading,
        isAuthLoading: true,
        isConsentLoading: false,
      );
    }
    // Auth initialized and loading complete and no user - definitely unauthenticated
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> unauthenticated');
    }
    return const AppInitializationState(
      status: AppInitializationStatus.unauthenticated,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // From here on, user is authenticated (authState.user != null)

  // User exists but auth is still loading user data (e.g., fetching userData from Firestore)
  if (authState.isLoading) {
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> loading (auth loading user data)');
    }
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
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> loading (consent loading)');
    }
    return const AppInitializationState(
      status: AppInitializationStatus.loading,
      isAuthLoading: false,
      isConsentLoading: true,
    );
  }

  // Both states are loaded - determine final status
  if (consentState.needsConsent) {
    if (_kEnableVerboseLogging && kDebugMode) {
      debugPrint('[AppInit] -> needsConsent');
    }
    return const AppInitializationState(
      status: AppInitializationStatus.needsConsent,
      isAuthLoading: false,
      isConsentLoading: false,
    );
  }

  // All good - user is authenticated and has given consent
  if (_kEnableVerboseLogging && kDebugMode) {
    debugPrint('[AppInit] -> ready');
  }
  return const AppInitializationState(
    status: AppInitializationStatus.ready,
    isAuthLoading: false,
    isConsentLoading: false,
  );
});
