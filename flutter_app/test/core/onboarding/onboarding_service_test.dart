// Onboarding Service Tests
// Tests for onboarding state management using SharedPreferences
//
// @version 1.0.0
// @date 2025-12-04

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_app/core/onboarding/onboarding_service.dart';

void main() {
  group('OnboardingService', () {
    late OnboardingService service;

    setUp(() async {
      // Initialize SharedPreferences with empty values
      SharedPreferences.setMockInitialValues({});
      service = OnboardingService();
    });

    group('isFirstLaunch', () {
      test('returns true when no flag is set (first launch)', () async {
        SharedPreferences.setMockInitialValues({});
        service = OnboardingService();

        final result = await service.isFirstLaunch();
        expect(result, isTrue);
      });

      test('returns true when flag is explicitly true', () async {
        SharedPreferences.setMockInitialValues({'isFirstLaunch': true});
        service = OnboardingService();

        final result = await service.isFirstLaunch();
        expect(result, isTrue);
      });

      test('returns false when flag is false', () async {
        SharedPreferences.setMockInitialValues({'isFirstLaunch': false});
        service = OnboardingService();

        final result = await service.isFirstLaunch();
        expect(result, isFalse);
      });
    });

    group('completeOnboarding', () {
      test('sets first launch flag to false', () async {
        SharedPreferences.setMockInitialValues({});
        service = OnboardingService();

        // Initially should be first launch
        expect(await service.isFirstLaunch(), isTrue);

        // Complete onboarding
        await service.completeOnboarding();

        // Should no longer be first launch
        expect(await service.isFirstLaunch(), isFalse);
      });

      test('persists the flag in SharedPreferences', () async {
        SharedPreferences.setMockInitialValues({});
        service = OnboardingService();

        await service.completeOnboarding();

        // Verify the flag is stored
        final prefs = await SharedPreferences.getInstance();
        expect(prefs.getBool('isFirstLaunch'), isFalse);
      });
    });

    group('resetOnboarding', () {
      test('sets first launch flag back to true', () async {
        // Start with completed onboarding
        SharedPreferences.setMockInitialValues({'isFirstLaunch': false});
        service = OnboardingService();

        // Initially should not be first launch
        expect(await service.isFirstLaunch(), isFalse);

        // Reset onboarding
        await service.resetOnboarding();

        // Should be first launch again
        expect(await service.isFirstLaunch(), isTrue);
      });

      test('persists the reset flag in SharedPreferences', () async {
        SharedPreferences.setMockInitialValues({'isFirstLaunch': false});
        service = OnboardingService();

        await service.resetOnboarding();

        // Verify the flag is stored
        final prefs = await SharedPreferences.getInstance();
        expect(prefs.getBool('isFirstLaunch'), isTrue);
      });
    });

    group('integration scenarios', () {
      test('complete onboarding flow', () async {
        SharedPreferences.setMockInitialValues({});
        service = OnboardingService();

        // First launch: should show onboarding
        expect(await service.isFirstLaunch(), isTrue);

        // User completes onboarding
        await service.completeOnboarding();

        // Second launch: should not show onboarding
        expect(await service.isFirstLaunch(), isFalse);

        // Third launch: should still not show onboarding
        expect(await service.isFirstLaunch(), isFalse);
      });

      test('reset and complete flow', () async {
        SharedPreferences.setMockInitialValues({'isFirstLaunch': false});
        service = OnboardingService();

        // User has completed onboarding before
        expect(await service.isFirstLaunch(), isFalse);

        // Reset for testing/debugging
        await service.resetOnboarding();
        expect(await service.isFirstLaunch(), isTrue);

        // Complete onboarding again
        await service.completeOnboarding();
        expect(await service.isFirstLaunch(), isFalse);
      });
    });
  });
}
