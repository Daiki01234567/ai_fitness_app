/// App Router Configuration
/// GoRouter-based navigation with auth state handling
///
/// @version 1.1.0
/// @date 2025-11-27

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/auth/password_reset_screen.dart';
import '../../screens/home/home_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/legal/consent_screen.dart';

/// Route paths
class AppRoutes {
  AppRoutes._();

  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const passwordReset = '/password-reset';
  static const home = '/home';
  static const training = '/training';
  static const history = '/history';
  static const profile = '/profile';
  static const settings = '/settings';
  static const consent = '/consent';
}

/// Router provider
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final consentState = ref.watch(consentStateProvider);
  final authNotifier = ref.read(authStateProvider.notifier);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: _AuthConsentStateNotifier(ref),
    redirect: (context, state) {
      final isLoading = authState.isLoading || consentState.isLoading;
      final isAuthenticated = authState.user != null;
      final needsConsent = consentState.needsConsent;
      final isOnAuthPage = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.passwordReset;
      final isOnSplash = state.matchedLocation == AppRoutes.splash;
      final isOnConsent = state.matchedLocation == AppRoutes.consent;

      // Clear error when navigating to a different page
      if (authState.error != null) {
        // Use Future.microtask to avoid modifying state during build
        Future.microtask(() => authNotifier.clearError());
      }

      // Show splash while loading
      if (isLoading && isOnSplash) {
        return null;
      }

      // Check for force logout first
      if (authState.isForceLogout) {
        return AppRoutes.login;
      }

      // If loading is done and on splash, redirect based on auth and consent state
      if (!isLoading && isOnSplash) {
        if (!isAuthenticated) {
          return AppRoutes.login;
        }
        // Check consent after authentication
        if (needsConsent) {
          return AppRoutes.consent;
        }
        return AppRoutes.home;
      }

      // If not authenticated and not on auth page, redirect to login
      if (!isAuthenticated && !isOnAuthPage && !isOnSplash) {
        return AppRoutes.login;
      }

      // If authenticated and on auth page, check consent then go home
      if (isAuthenticated && isOnAuthPage) {
        if (needsConsent) {
          return AppRoutes.consent;
        }
        return AppRoutes.home;
      }

      // If authenticated but needs consent, redirect to consent screen
      if (isAuthenticated && needsConsent && !isOnConsent && !isOnSplash) {
        return AppRoutes.consent;
      }

      // If authenticated with consent and on consent page, go to home
      if (isAuthenticated && !needsConsent && isOnConsent) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      // Splash screen
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),

      // Auth routes
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.passwordReset,
        builder: (context, state) => const PasswordResetScreen(),
      ),

      // Consent screen
      GoRoute(
        path: AppRoutes.consent,
        builder: (context, state) => const ConsentScreen(),
      ),

      // Main app routes
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              'ページが見つかりません',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              state.uri.toString(),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go(AppRoutes.home),
              child: const Text('ホームに戻る'),
            ),
          ],
        ),
      ),
    ),
  );
});

/// Helper class to listen to auth and consent state changes for router refresh
class _AuthConsentStateNotifier extends ChangeNotifier {
  _AuthConsentStateNotifier(this._ref) {
    _ref.listen(authStateProvider, (_, __) {
      notifyListeners();
    });
    _ref.listen(consentStateProvider, (_, __) {
      notifyListeners();
    });
  }

  final Ref _ref;
}

/// Extension for navigation convenience
extension GoRouterExtension on BuildContext {
  /// Navigate to login
  void goToLogin() => GoRouter.of(this).go(AppRoutes.login);

  /// Navigate to register
  void goToRegister() => GoRouter.of(this).go(AppRoutes.register);

  /// Navigate to password reset
  void goToPasswordReset() => GoRouter.of(this).go(AppRoutes.passwordReset);

  /// Navigate to consent
  void goToConsent() => GoRouter.of(this).go(AppRoutes.consent);

  /// Navigate to home
  void goToHome() => GoRouter.of(this).go(AppRoutes.home);

  /// Navigate to profile
  void goToProfile() => GoRouter.of(this).go(AppRoutes.profile);
}
