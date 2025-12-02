// Splash Screen
// Shows loading indicator while checking auth state and first launch
// Implements navigation logic per spec section 3.1
//
// @version 2.0.0
// @date 2025-12-02
// @spec docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.1

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/consent/consent_state_notifier.dart';
import '../../core/onboarding/onboarding_service.dart';
import '../../core/router/app_router.dart';

/// Splash screen displayed during app initialization
/// Displays for 1-2 seconds as per spec
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _navigationTriggered = false;

  @override
  void initState() {
    super.initState();
    // Start navigation check after a minimum display time of 1 second
    Future.delayed(const Duration(milliseconds: 1000), () {
      if (mounted) {
        _checkNavigationState();
      }
    });
  }

  /// Check states and navigate accordingly
  /// Navigation logic per spec section 3.1:
  /// - First launch -> Onboarding
  /// - Subsequent launch + logged in -> Consent check -> Home or Consent
  /// - Subsequent launch + not logged in -> Login
  Future<void> _checkNavigationState() async {
    if (_navigationTriggered) return;

    // Check if first launch
    final onboardingService = ref.read(onboardingServiceProvider);
    final isFirstLaunch = await onboardingService.isFirstLaunch();

    if (!mounted) return;

    if (isFirstLaunch) {
      _navigationTriggered = true;
      context.go(AppRoutes.onboarding);
      return;
    }

    // Wait for auth and consent states to be loaded
    _waitForAuthAndNavigate();
  }

  /// Wait for auth state to be ready and navigate
  void _waitForAuthAndNavigate() {
    final authState = ref.read(authStateProvider);
    final consentState = ref.read(consentStateProvider);

    // If states are still loading, wait and retry
    if (authState.isLoading || consentState.isLoading) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted && !_navigationTriggered) {
          _waitForAuthAndNavigate();
        }
      });
      return;
    }

    if (_navigationTriggered || !mounted) return;
    _navigationTriggered = true;

    final isAuthenticated = authState.user != null;
    final needsConsent = consentState.needsConsent;

    if (!isAuthenticated) {
      context.go(AppRoutes.login);
    } else if (needsConsent) {
      context.go(AppRoutes.consent);
    } else {
      context.go(AppRoutes.home);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    // Spec: green brand color background
    return Scaffold(
      backgroundColor: colorScheme.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App logo
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: colorScheme.onPrimary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                Icons.fitness_center,
                size: 64,
                color: colorScheme.primary,
              ),
            ),
            const SizedBox(height: 32),
            // App name
            Text(
              'AI Fitness',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: colorScheme.onPrimary,
                  ),
            ),
            const SizedBox(height: 48),
            // Loading indicator
            CircularProgressIndicator(
              color: colorScheme.onPrimary,
            ),
          ],
        ),
      ),
    );
  }
}
