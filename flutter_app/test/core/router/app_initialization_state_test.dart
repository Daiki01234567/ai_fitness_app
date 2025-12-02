// App initialization state tests
//
// Tests for the combined auth and consent state provider
// that prevents consent screen flickering.
//
// @version 1.0.0
// @date 2025-12-02

import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/router/app_initialization_state.dart';

void main() {
  group('AppInitializationState', () {
    test('isLoading returns true when auth is loading', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.loading,
        isAuthLoading: true,
        isConsentLoading: false,
      );

      expect(state.isLoading, isTrue);
    });

    test('isLoading returns true when consent is loading', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.loading,
        isAuthLoading: false,
        isConsentLoading: true,
      );

      expect(state.isLoading, isTrue);
    });

    test('isLoading returns false when both are loaded', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.ready,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      expect(state.isLoading, isFalse);
    });

    test('isReady returns true only when status is ready', () {
      const readyState = AppInitializationState(
        status: AppInitializationStatus.ready,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      const loadingState = AppInitializationState(
        status: AppInitializationStatus.loading,
        isAuthLoading: true,
        isConsentLoading: false,
      );

      expect(readyState.isReady, isTrue);
      expect(loadingState.isReady, isFalse);
    });

    test('shouldShowConsent returns true when status is needsConsent', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.needsConsent,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      expect(state.shouldShowConsent, isTrue);
    });

    test('shouldShowLogin returns true when status is unauthenticated', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.unauthenticated,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      expect(state.shouldShowLogin, isTrue);
    });

    test('shouldShowLogin returns true when status is forceLoggedOut', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.forceLoggedOut,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      expect(state.shouldShowLogin, isTrue);
    });

    test('toString returns correct representation', () {
      const state = AppInitializationState(
        status: AppInitializationStatus.ready,
        isAuthLoading: false,
        isConsentLoading: false,
      );

      expect(
        state.toString(),
        contains('AppInitializationState'),
      );
      expect(
        state.toString(),
        contains('ready'),
      );
    });
  });

  group('AppInitializationStatus', () {
    test('all status values are defined', () {
      expect(AppInitializationStatus.values.length, 5);
      expect(
        AppInitializationStatus.values,
        containsAll([
          AppInitializationStatus.loading,
          AppInitializationStatus.unauthenticated,
          AppInitializationStatus.needsConsent,
          AppInitializationStatus.ready,
          AppInitializationStatus.forceLoggedOut,
        ]),
      );
    });
  });
}
