/// Home State Tests
///
/// Tests for home screen state management.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.6)
///
/// Legal notice: This is NOT a medical device.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/screens/home/home_state.dart';

void main() {
  group('HomeScreenState', () {
    test('should have default values', () {
      const state = HomeScreenState();

      expect(state.todaySessionCount, 0);
      expect(state.weeklyProgress, isEmpty);
      expect(state.recentSessions, isEmpty);
      expect(state.userPlan, UserPlan.free);
      expect(state.dailyLimit, 3);
      expect(state.todayUsageCount, 0);
      expect(state.isLoading, false);
      expect(state.error, isNull);
    });

    test('remainingSessions should calculate correctly', () {
      const state = HomeScreenState(
        dailyLimit: 3,
        todayUsageCount: 1,
      );

      expect(state.remainingSessions, 2);
    });

    test('hasReachedLimit should be true when usage equals limit', () {
      const state = HomeScreenState(
        userPlan: UserPlan.free,
        dailyLimit: 3,
        todayUsageCount: 3,
      );

      expect(state.hasReachedLimit, true);
    });

    test('hasReachedLimit should be false for premium users', () {
      const state = HomeScreenState(
        userPlan: UserPlan.premium,
        dailyLimit: 3,
        todayUsageCount: 10,
      );

      expect(state.hasReachedLimit, false);
    });

    test('shouldShowUpgradePrompt should be true only for free plan', () {
      const freeState = HomeScreenState(userPlan: UserPlan.free);
      const premiumState = HomeScreenState(userPlan: UserPlan.premium);

      expect(freeState.shouldShowUpgradePrompt, true);
      expect(premiumState.shouldShowUpgradePrompt, false);
    });

    test('copyWith should update specified fields', () {
      const original = HomeScreenState(
        todaySessionCount: 0,
        userPlan: UserPlan.free,
      );

      final updated = original.copyWith(
        todaySessionCount: 5,
        userPlan: UserPlan.premium,
      );

      expect(updated.todaySessionCount, 5);
      expect(updated.userPlan, UserPlan.premium);
    });

    test('copyWith should preserve unspecified fields', () {
      const original = HomeScreenState(
        todaySessionCount: 3,
        dailyLimit: 5,
        userPlan: UserPlan.free,
      );

      final updated = original.copyWith(todaySessionCount: 10);

      expect(updated.todaySessionCount, 10);
      expect(updated.dailyLimit, 5);
      expect(updated.userPlan, UserPlan.free);
    });
  });

  group('DailySessionCount', () {
    test('should store date, count, and label', () {
      final date = DateTime(2025, 12, 3);

      final count = DailySessionCount(
        date: date,
        sessionCount: 5,
        dayLabel: '水',
      );

      expect(count.date, date);
      expect(count.sessionCount, 5);
      expect(count.dayLabel, '水');
    });
  });

  group('UserPlan', () {
    test('should have free and premium values', () {
      expect(UserPlan.values, contains(UserPlan.free));
      expect(UserPlan.values, contains(UserPlan.premium));
      expect(UserPlan.values.length, 2);
    });
  });
}
