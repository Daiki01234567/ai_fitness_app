/// App Router Configuration
/// GoRouter-based navigation with auth state handling
///
/// @version 1.0.0
/// @date 2025-11-26

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state_notifier.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/auth/password_reset_screen.dart';
import '../../screens/home/home_screen.dart';
import '../../screens/splash/splash_screen.dart';

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

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: _AuthStateNotifier(ref),
    redirect: (context, state) {
      final isLoading = authState.isLoading;
      final isAuthenticated = authState.user != null;
      final isOnAuthPage = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.passwordReset;
      final isOnSplash = state.matchedLocation == AppRoutes.splash;

      // Show splash while loading
      if (isLoading && isOnSplash) {
        return null;
      }

      // If loading is done and on splash, redirect based on auth state
      if (!isLoading && isOnSplash) {
        return isAuthenticated ? AppRoutes.home : AppRoutes.login;
      }

      // If not authenticated and not on auth page, redirect to login
      if (!isAuthenticated && !isOnAuthPage && !isOnSplash) {
        return AppRoutes.login;
      }

      // If authenticated and on auth page, redirect to home
      if (isAuthenticated && isOnAuthPage) {
        return AppRoutes.home;
      }

      // Check for force logout
      if (authState.isForceLogout) {
        return AppRoutes.login;
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

      // Main app routes
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeScreen(),
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

/// Helper class to listen to auth state changes for router refresh
class _AuthStateNotifier extends ChangeNotifier {
  _AuthStateNotifier(this._ref) {
    _ref.listen(authStateProvider, (_, __) {
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

  /// Navigate to home
  void goToHome() => GoRouter.of(this).go(AppRoutes.home);
}
