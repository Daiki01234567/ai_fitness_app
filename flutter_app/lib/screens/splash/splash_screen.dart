// Splash Screen
// Shows loading indicator while app initialization states are loaded
// Navigation is handled by GoRouter based on appInitializationProvider
//
// @version 2.1.0
// @date 2025-12-08
// @spec docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.1

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Splash screen displayed during app initialization
/// Navigation is handled by GoRouter redirect based on:
/// - First launch -> Onboarding
/// - Not authenticated -> Login
/// - Authenticated + needs consent -> Consent
/// - Authenticated + has consent -> Home
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  // Note: Navigation is now handled entirely by GoRouter's redirect logic
  // in app_router.dart based on appInitializationProvider state.
  // This screen simply displays the splash UI while states are loading.

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;

    debugPrint('[SplashScreen] build called');

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
            CircularProgressIndicator(color: colorScheme.onPrimary),
          ],
        ),
      ),
    );
  }
}
