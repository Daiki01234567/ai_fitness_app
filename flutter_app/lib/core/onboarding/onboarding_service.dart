// Onboarding Service
// Manages first launch flag using SharedPreferences
//
// @version 1.0.0
// @date 2025-12-02

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Key for storing the first launch flag
const String _isFirstLaunchKey = 'isFirstLaunch';

/// Provider for the onboarding service
final onboardingServiceProvider = Provider<OnboardingService>((ref) {
  return OnboardingService();
});

/// Provider for the first launch state
/// Returns true if this is the first app launch, false otherwise
final isFirstLaunchProvider = FutureProvider<bool>((ref) async {
  final service = ref.read(onboardingServiceProvider);
  return service.isFirstLaunch();
});

/// Service to manage onboarding state
class OnboardingService {
  /// Checks if this is the first launch of the app
  /// Returns true if first launch, false otherwise
  Future<bool> isFirstLaunch() async {
    final prefs = await SharedPreferences.getInstance();
    // If key doesn't exist, it's the first launch (defaults to true)
    return prefs.getBool(_isFirstLaunchKey) ?? true;
  }

  /// Marks the onboarding as complete
  /// Sets the first launch flag to false
  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isFirstLaunchKey, false);
  }

  /// Resets the onboarding state (for testing/debugging)
  /// Sets the first launch flag back to true
  Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isFirstLaunchKey, true);
  }
}
