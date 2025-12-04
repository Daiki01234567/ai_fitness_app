// Consent State Notifier Tests
//
// Unit tests for consent state management
//
// @version 1.0.0
// @date 2025-11-27

import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/core/consent/consent_service.dart';
import 'package:flutter_app/core/consent/consent_state_notifier.dart';

void main() {
  group('ConsentState', () {
    test('initial state has correct defaults', () {
      const state = ConsentState();

      expect(state.isLoading, true);
      expect(state.tosAccepted, false);
      expect(state.ppAccepted, false);
      expect(state.needsConsent, true);
      expect(state.needsUpdate, false);
      expect(state.error, null);
      expect(state.history, isEmpty);
    });

    test('copyWith creates new instance with updated values', () {
      const state = ConsentState();
      final updated = state.copyWith(
        isLoading: false,
        tosAccepted: true,
        ppAccepted: true,
        tosVersion: '3.2',
        ppVersion: '3.1',
        needsConsent: false,
      );

      expect(updated.isLoading, false);
      expect(updated.tosAccepted, true);
      expect(updated.ppAccepted, true);
      expect(updated.tosVersion, '3.2');
      expect(updated.ppVersion, '3.1');
      expect(updated.needsConsent, false);
    });

    test('copyWith preserves unchanged values', () {
      const state = ConsentState(
        isLoading: false,
        tosAccepted: true,
        tosVersion: '3.2',
      );
      final updated = state.copyWith(ppAccepted: true, ppVersion: '3.1');

      expect(updated.isLoading, false);
      expect(updated.tosAccepted, true);
      expect(updated.tosVersion, '3.2');
      expect(updated.ppAccepted, true);
      expect(updated.ppVersion, '3.1');
    });
  });

  group('ConsentResult', () {
    test('success result has correct properties', () {
      final result = ConsentResult(success: true, message: 'Consent recorded');

      expect(result.success, true);
      expect(result.message, 'Consent recorded');
      expect(result.error, null);
      expect(result.forceLogout, false);
    });

    test('error result has correct properties', () {
      final result = ConsentResult(
        success: false,
        error: 'Failed to record consent',
      );

      expect(result.success, false);
      expect(result.error, 'Failed to record consent');
    });

    test('forceLogout is set correctly', () {
      final result = ConsentResult(success: true, forceLogout: true);

      expect(result.forceLogout, true);
    });
  });

  group('ConsentStatus', () {
    test('fromMap parses data correctly', () {
      final map = {
        'tosAccepted': true,
        'tosAcceptedAt': '2025-01-01T00:00:00Z',
        'tosVersion': '3.2',
        'tosCurrentVersion': '3.2',
        'tosNeedsUpdate': false,
        'ppAccepted': true,
        'ppAcceptedAt': '2025-01-01T00:00:00Z',
        'ppVersion': '3.1',
        'ppCurrentVersion': '3.1',
        'ppNeedsUpdate': false,
        'allConsentsValid': true,
        'needsConsent': false,
      };

      final status = ConsentStatus.fromMap(map);

      expect(status.tosAccepted, true);
      expect(status.tosVersion, '3.2');
      expect(status.tosCurrentVersion, '3.2');
      expect(status.tosNeedsUpdate, false);
      expect(status.ppAccepted, true);
      expect(status.ppVersion, '3.1');
      expect(status.ppCurrentVersion, '3.1');
      expect(status.ppNeedsUpdate, false);
      expect(status.allConsentsValid, true);
      expect(status.needsConsent, false);
    });

    test('fromMap handles missing values with defaults', () {
      final map = <String, dynamic>{};

      final status = ConsentStatus.fromMap(map);

      expect(status.tosAccepted, false);
      expect(status.tosVersion, null);
      expect(status.tosCurrentVersion, '3.2');
      expect(status.tosNeedsUpdate, false);
      expect(status.ppAccepted, false);
      expect(status.ppVersion, null);
      expect(status.ppCurrentVersion, '3.1');
      expect(status.ppNeedsUpdate, false);
      expect(status.allConsentsValid, false);
      expect(status.needsConsent, true);
    });
  });

  group('ConsentHistoryEntry', () {
    test('fromMap parses data correctly', () {
      final map = {
        'consentType': 'tos',
        'action': 'accepted',
        'documentVersion': '3.2',
        'createdAt': '2025-01-01T00:00:00Z',
      };

      final entry = ConsentHistoryEntry.fromMap(map);

      expect(entry.consentType, 'tos');
      expect(entry.action, 'accepted');
      expect(entry.documentVersion, '3.2');
      expect(entry.createdAt, isNotNull);
    });

    test('fromMap handles missing values with defaults', () {
      final map = <String, dynamic>{};

      final entry = ConsentHistoryEntry.fromMap(map);

      expect(entry.consentType, '');
      expect(entry.action, '');
      expect(entry.documentVersion, '');
      expect(entry.createdAt, isNotNull);
    });
  });

  group('Version constants', () {
    test('current ToS version is defined', () {
      expect(currentTosVersion, isNotEmpty);
      expect(currentTosVersion, '3.2');
    });

    test('current PP version is defined', () {
      expect(currentPpVersion, isNotEmpty);
      expect(currentPpVersion, '3.1');
    });
  });
}
