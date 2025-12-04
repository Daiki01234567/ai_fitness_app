/// Bottom Navigation Bar Widget
///
/// Shared bottom navigation bar for main app screens.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 1.2)
///
/// 4-tab navigation:
/// - ホーム (Home)
/// - トレーニング (Training)
/// - 履歴 (History)
/// - プロフィール (Profile)
///
/// Legal notice: This is NOT a medical device.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';

/// Provider for tracking the current bottom navigation index
/// Used to sync navigation state across screens
final bottomNavIndexProvider = StateProvider<int>((ref) => 0);

/// Bottom navigation bar with 4 tabs
class BottomNavBar extends StatelessWidget {
  const BottomNavBar({super.key, required this.currentIndex});

  /// Current selected tab index (0-3)
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: (index) => _onItemTapped(context, index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'ホーム',
        ),
        NavigationDestination(
          icon: Icon(Icons.fitness_center_outlined),
          selectedIcon: Icon(Icons.fitness_center),
          label: 'トレーニング',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: '履歴',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'プロフィール',
        ),
      ],
    );
  }

  void _onItemTapped(BuildContext context, int index) {
    if (index == currentIndex) return;

    switch (index) {
      case 0:
        context.go(AppRoutes.home);
        break;
      case 1:
        context.go(AppRoutes.training);
        break;
      case 2:
        context.go(AppRoutes.history);
        break;
      case 3:
        context.go(AppRoutes.profile);
        break;
    }
  }
}

/// Helper extension to determine current nav index from route
extension NavIndexExtension on String {
  /// Get navigation bar index from route path
  int get navIndex {
    if (startsWith(AppRoutes.home)) return 0;
    if (startsWith(AppRoutes.training)) return 1;
    if (startsWith(AppRoutes.history)) return 2;
    if (startsWith(AppRoutes.profile)) return 3;
    return 0; // Default to home
  }
}
