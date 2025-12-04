// Onboarding Screen
// 3-page swipeable onboarding flow for first-time users
// Includes medical device disclaimer for pharmaceutical law compliance
//
// @version 1.0.0
// @date 2025-12-02
// @spec docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.2

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/onboarding/onboarding_service.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';

/// Onboarding screen with 3 pages
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Handles completing the onboarding flow
  Future<void> _completeOnboarding() async {
    final onboardingService = ref.read(onboardingServiceProvider);
    await onboardingService.completeOnboarding();
    if (mounted) {
      context.go(AppRoutes.login);
    }
  }

  /// Navigates to the next page
  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Skip button (not on last page)
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: _currentPage < 2
                    ? TextButton(
                        onPressed: _completeOnboarding,
                        child: Text(
                          'スキップ',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: colorScheme.primary,
                          ),
                        ),
                      )
                    : const SizedBox(
                        height: 48,
                      ), // Placeholder for consistent layout
              ),
            ),
            // Page content
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                children: const [
                  _OnboardingPage1(),
                  _OnboardingPage2(),
                  _OnboardingPage3(),
                ],
              ),
            ),
            // Page indicator
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: _PageIndicator(currentPage: _currentPage, pageCount: 3),
            ),
            // Navigation button
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: FilledButton(
                onPressed: _nextPage,
                child: Text(_currentPage < 2 ? '次へ' : '始める'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}

/// Page 1: Medical device disclaimer (pharmaceutical law compliance)
class _OnboardingPage1 extends StatelessWidget {
  const _OnboardingPage1();

  @override
  Widget build(BuildContext context) {
    return const _OnboardingPageContent(
      icon: Icons.health_and_safety_outlined,
      iconBackgroundColor: Color(0xFFE8F5E9),
      iconColor: Color(0xFF4CAF50),
      title: '本サービスは医療機器ではありません',
      bulletPoints: ['参考情報としてご利用ください', '医学的な判断は行いません', '最終的な判断はご自身でお願いします'],
    );
  }
}

/// Page 2: Real-time feedback feature
class _OnboardingPage2 extends StatelessWidget {
  const _OnboardingPage2();

  @override
  Widget build(BuildContext context) {
    return const _OnboardingPageContent(
      icon: Icons.camera_alt_outlined,
      iconBackgroundColor: Color(0xFFE3F2FD),
      iconColor: Color(0xFF2196F3),
      title: 'AIがあなたのフォームを確認補助',
      bulletPoints: ['カメラでフォームをチェック', '音声で参考情報を提供', '映像はデバイス内で処理'],
    );
  }
}

/// Page 3: Pricing information
class _OnboardingPage3 extends StatelessWidget {
  const _OnboardingPage3();

  @override
  Widget build(BuildContext context) {
    return const _OnboardingPageContent(
      icon: Icons.savings_outlined,
      iconBackgroundColor: Color(0xFFFFF3E0),
      iconColor: Color(0xFFFF9800),
      title: '月額500円で始められる',
      bulletPoints: ['1週間無料トライアル', 'いつでもキャンセル可能'],
    );
  }
}

/// Reusable page content widget
class _OnboardingPageContent extends StatelessWidget {
  const _OnboardingPageContent({
    required this.icon,
    required this.iconBackgroundColor,
    required this.iconColor,
    required this.title,
    required this.bulletPoints,
  });

  final IconData icon;
  final Color iconBackgroundColor;
  final Color iconColor;
  final String title;
  final List<String> bulletPoints;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon
          Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              color: iconBackgroundColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 80, color: iconColor),
          ),
          const SizedBox(height: AppSpacing.xxl),
          // Title
          Text(
            title,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          // Bullet points
          ...bulletPoints.map(
            (point) => Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    point,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Page indicator dots
class _PageIndicator extends StatelessWidget {
  const _PageIndicator({required this.currentPage, required this.pageCount});

  final int currentPage;
  final int pageCount;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        pageCount,
        (index) => AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: currentPage == index ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: currentPage == index
                ? colorScheme.primary
                : colorScheme.outlineVariant,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}
