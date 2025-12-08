// アプリルーター設定
// 認証状態を考慮したGoRouterベースのナビゲーション
//
// 同意画面チラつき防止のため、認証状態と同意状態を統合管理
// 仕様参照: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md セクション2.1
//
// @version 1.2.0
// @date 2025-12-02

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';
import '../onboarding/onboarding_service.dart';
import 'app_initialization_state.dart';
import '../form_analyzer/form_analyzer.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/auth/password_reset_screen.dart';
import '../../screens/home/home_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/onboarding/onboarding_screen.dart';
import '../../screens/legal/consent_screen.dart';
import '../../screens/session/pre_session_screen.dart';
import '../../screens/session/active_session_screen.dart';
import '../../screens/session/session_result_screen.dart';
import '../../screens/session/exercise_selection_screen.dart';
import '../../screens/session/exercise_detail_screen.dart';
import '../../screens/history/history_screen.dart';
import '../../screens/analytics/analytics_screen.dart';
import '../../screens/settings/data_export_screen.dart';
import '../../screens/settings/account_deletion_screen.dart';
import '../../screens/settings/settings_screen.dart';
import '../../screens/auth/recovery_screen.dart';

/// Debug logging flag for router - set to false to disable verbose logs
const bool _kEnableRouterLogging = false;

/// Debounce duration for router refresh notifications (milliseconds)
const int _kRefreshDebounceDurationMs = 50;

/// ルートパス
class AppRoutes {
  AppRoutes._();

  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const passwordReset = '/password-reset';
  static const home = '/home';
  static const training = '/training';
  static const trainingDetail = '/training/detail';
  static const trainingSetup = '/training/setup';
  static const trainingActive = '/training/active';
  static const trainingResult = '/training/result';
  static const history = '/history';
  static const analytics = '/analytics';
  static const profile = '/profile';
  static const settings = '/settings';
  static const settingsExport = '/settings/export';
  static const settingsDeletion = '/settings/deletion';
  static const consent = '/consent';
  static const recovery = '/auth/recovery';
  static const onboarding = '/onboarding';
}

/// ルータープロバイダー
///
/// 同意画面チラつき防止のため、appInitializationProviderを使用して
/// 認証状態と同意状態が両方ロード完了するまでスプラッシュ画面を維持
///
/// 仕様参照: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md セクション2.1
final appRouterProvider = Provider<GoRouter>((ref) {
  // Use the combined initialization state to prevent consent screen flickering
  final appInitState = ref.watch(appInitializationProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: _AuthConsentStateNotifier(ref),
    redirect: (context, state) {
      final currentLocation = state.matchedLocation;
      final isOnAuthPage = currentLocation == AppRoutes.login ||
          currentLocation == AppRoutes.register ||
          currentLocation == AppRoutes.passwordReset ||
          currentLocation == AppRoutes.recovery;
      final isOnSplash = currentLocation == AppRoutes.splash;
      final isOnConsent = currentLocation == AppRoutes.consent;
      final isOnOnboarding = currentLocation == AppRoutes.onboarding;

      if (_kEnableRouterLogging && kDebugMode) {
        debugPrint('[Router] redirect called: location=$currentLocation, appInitState=$appInitState');
      }

      // Helper function to prevent redirect loop by checking if target equals current location
      String? safeRedirect(String target) {
        if (target == currentLocation) {
          if (_kEnableRouterLogging && kDebugMode) {
            debugPrint('[Router] Skipping redirect to same location: $target');
          }
          return null;
        }
        return target;
      }

      // 強制ログアウトの場合は即座にログイン画面へ
      if (appInitState.status == AppInitializationStatus.forceLoggedOut) {
        // 既にログイン画面にいる場合はnullを返してループを防止
        if (isOnAuthPage) {
          return null;
        }
        if (_kEnableRouterLogging && kDebugMode) {
          debugPrint('[Router] Force logout detected, redirecting to login');
        }
        return safeRedirect(AppRoutes.login);
      }

      // ローディング中の場合（認証状態または同意状態がまだ読み込み中）
      // これがチラつき防止の核心部分
      if (appInitState.isLoading) {
        // スプラッシュ画面にいる場合はそのまま維持
        if (isOnSplash) {
          return null;
        }
        // 認証ページにいる場合は維持（ローディング中でも操作可能にする）
        // 登録完了後のローディング中もここで維持される
        if (isOnAuthPage) {
          return null;
        }
        // オンボーディング中は維持
        if (isOnOnboarding) {
          return null;
        }
        // 同意画面にいる場合も維持（同意処理中）
        if (isOnConsent) {
          return null;
        }
        // 他のページにいる場合はスプラッシュへリダイレクト
        // これにより認証・同意状態が確定するまで待機
        return safeRedirect(AppRoutes.splash);
      }

      // 以下、ローディング完了後の処理
      // 認証状態と同意状態が両方確定してから遷移先を決定
      // -------------------------

      // 初回起動の場合はオンボーディングへ
      if (appInitState.shouldShowOnboarding) {
        // オンボーディングにいる場合はそのまま維持
        if (isOnOnboarding) {
          return null;
        }
        if (_kEnableRouterLogging && kDebugMode) {
          debugPrint('[Router] First launch, redirecting to onboarding from $currentLocation');
        }
        return safeRedirect(AppRoutes.onboarding);
      }

      // 未認証の場合のルーティング
      if (appInitState.shouldShowLogin) {
        // 認証ページにいる場合はそのまま維持
        if (isOnAuthPage) {
          return null;
        }
        // オンボーディングにいる場合はそのまま維持（オンボーディング完了後にログインへ）
        if (isOnOnboarding) {
          return null;
        }
        // スプラッシュ画面または他のページからログイン画面へリダイレクト
        if (_kEnableRouterLogging && kDebugMode) {
          debugPrint('[Router] Unauthenticated user, redirecting to login from $currentLocation');
        }
        return safeRedirect(AppRoutes.login);
      }

      // 認証済みだが同意が必要な場合
      if (appInitState.shouldShowConsent) {
        // 同意画面にいる場合はそのまま維持
        if (isOnConsent) {
          return null;
        }
        // スプラッシュ画面にいる場合も同意画面にリダイレクト
        // （スプラッシュ画面のナビゲーションが競合するのを防ぐ）
        // 認証ページ・オンボーディングからも同意画面へ
        return safeRedirect(AppRoutes.consent);
      }

      // 認証済みで同意済み（ready状態）
      if (appInitState.isReady) {
        // 認証ページ・オンボーディング・同意ページ・スプラッシュにいる場合はホームへ
        if (isOnAuthPage || isOnOnboarding || isOnConsent || isOnSplash) {
          return safeRedirect(AppRoutes.home);
        }
        // その他のページはそのまま維持
        return null;
      }

      return null;
    },
    routes: [
      // スプラッシュ画面
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),

      // オンボーディング画面（初回起動時のみ表示）
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),

      // 認証ルート
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
      GoRoute(
        path: AppRoutes.recovery,
        builder: (context, state) => const RecoveryScreen(),
      ),

      // 同意画面
      GoRoute(
        path: AppRoutes.consent,
        builder: (context, state) => const ConsentScreen(),
      ),

      // メインアプリルート
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (context, state) => const ProfileScreen(),
      ),

      // トレーニングルート
      GoRoute(
        path: AppRoutes.training,
        builder: (context, state) => const ExerciseSelectionScreen(),
      ),
      GoRoute(
        path: AppRoutes.trainingDetail,
        builder: (context, state) {
          final exerciseTypeStr = state.uri.queryParameters['exercise'];
          final exerciseType = exerciseTypeStr != null
              ? ExerciseType.values.firstWhere(
                  (e) => e.name == exerciseTypeStr,
                  orElse: () => ExerciseType.squat,
                )
              : ExerciseType.squat;
          return ExerciseDetailScreen(exerciseType: exerciseType);
        },
      ),
      GoRoute(
        path: AppRoutes.trainingSetup,
        builder: (context, state) {
          final exerciseTypeStr = state.uri.queryParameters['exercise'];
          final exerciseType = exerciseTypeStr != null
              ? ExerciseType.values.firstWhere(
                  (e) => e.name == exerciseTypeStr,
                  orElse: () => ExerciseType.squat,
                )
              : ExerciseType.squat;
          return PreSessionScreen(exerciseType: exerciseType);
        },
      ),
      GoRoute(
        path: AppRoutes.trainingActive,
        builder: (context, state) => const ActiveSessionScreen(),
      ),
      GoRoute(
        path: AppRoutes.trainingResult,
        builder: (context, state) => const SessionResultScreen(),
      ),

      // 履歴・分析ルート
      GoRoute(
        path: AppRoutes.history,
        builder: (context, state) => const HistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.analytics,
        builder: (context, state) => const AnalyticsScreen(),
      ),

      // 設定ルート（GDPR対応）
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.settingsExport,
        builder: (context, state) => const DataExportScreen(),
      ),
      GoRoute(
        path: AppRoutes.settingsDeletion,
        builder: (context, state) => const AccountDeletionScreen(),
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

/// ルーター更新のために認証と同意状態の変更をリッスンするヘルパークラス
///
/// Note: appInitializationProviderは既にauthStateProviderとconsentStateProviderに
/// 依存しているため、ここでは直接リッスンしない。直接リッスンすると
/// 1つの状態変化で複数回notifyListeners()が呼ばれ、リダイレクトループの原因となる。
///
/// 無限ループ防止:
/// 1. 状態が実際に変化した場合のみnotifyListeners()を呼び出す
/// 2. debounce処理で連続した通知を抑制
/// 3. ルーティング判断に関係ない状態変化は無視
class _AuthConsentStateNotifier extends ChangeNotifier {
  _AuthConsentStateNotifier(this._ref) {
    _ref.listen(authStateProvider, (previous, next) {
      // Only notify if routing-relevant state actually changed
      // Ignore changes to error messages, email verification, etc.
      final shouldNotify = previous?.user?.uid != next.user?.uid ||
          previous?.isForceLogout != next.isForceLogout ||
          // Only care about isLoading transition to false (loading complete)
          (previous?.isLoading == true && next.isLoading == false) ||
          // Only care about isInitialized transition to true (first init)
          (previous?.isInitialized == false && next.isInitialized == true);

      if (shouldNotify) {
        _scheduleNotification('auth');
      }
    });
    _ref.listen(consentStateProvider, (previous, next) {
      // Only notify if routing-relevant state actually changed
      final shouldNotify =
          // Only care about isLoading transition to false (loading complete)
          (previous?.isLoading == true && next.isLoading == false) ||
          // Consent requirement change
          previous?.needsConsent != next.needsConsent;

      if (shouldNotify) {
        _scheduleNotification('consent');
      }
    });
    // isFirstLaunchProvider の変化もリッスン（オンボーディング完了時のナビゲーション用）
    _ref.listen(isFirstLaunchProvider, (previous, next) {
      // AsyncValue の状態が変化した場合のみ通知
      final prevValue = previous?.valueOrNull;
      final nextValue = next.valueOrNull;
      final prevIsLoading = previous?.isLoading ?? true;
      final nextIsLoading = next.isLoading;

      // Only care about loading complete or value change
      final shouldNotify = (prevIsLoading && !nextIsLoading) ||
          (prevValue != nextValue && !nextIsLoading);

      if (shouldNotify) {
        _scheduleNotification('onboarding');
      }
    });
  }

  // ignore: unused_field - リスナー用にrefの参照を保持するために使用されるフィールド
  final Ref _ref;

  /// Pending notification flag to implement debounce
  bool _notificationPending = false;

  /// Schedule a debounced notification to prevent rapid successive refreshes
  void _scheduleNotification(String source) {
    if (_notificationPending) {
      // Already have a pending notification, skip
      if (_kEnableRouterLogging && kDebugMode) {
        debugPrint('[RouterNotifier] Skipping notification from $source (already pending)');
      }
      return;
    }

    _notificationPending = true;

    if (_kEnableRouterLogging && kDebugMode) {
      debugPrint('[RouterNotifier] Scheduling notification from $source');
    }

    // Use Future.delayed for debounce instead of Timer for simplicity
    Future.delayed(Duration(milliseconds: _kRefreshDebounceDurationMs), () {
      _notificationPending = false;
      if (_kEnableRouterLogging && kDebugMode) {
        debugPrint('[RouterNotifier] Executing notification from $source');
      }
      notifyListeners();
    });
  }
}

/// ナビゲーション便利機能の拡張
extension GoRouterExtension on BuildContext {
  /// ログインに移動
  void goToLogin() => GoRouter.of(this).go(AppRoutes.login);

  /// 新規登録に移動
  void goToRegister() => GoRouter.of(this).go(AppRoutes.register);

  /// パスワードリセットに移動
  void goToPasswordReset() => GoRouter.of(this).go(AppRoutes.passwordReset);

  /// 同意画面に移動
  void goToConsent() => GoRouter.of(this).go(AppRoutes.consent);

  /// ホームに移動
  void goToHome() => GoRouter.of(this).go(AppRoutes.home);

  /// プロフィールに移動
  void goToProfile() => GoRouter.of(this).go(AppRoutes.profile);

  /// 設定に移動
  void goToSettings() => GoRouter.of(this).go(AppRoutes.settings);

  /// トレーニング（種目選択）に移動
  void goToTraining() => GoRouter.of(this).go(AppRoutes.training);

  /// 種目詳細画面に移動
  void goToExerciseDetail(ExerciseType exerciseType) => GoRouter.of(this)
      .go('${AppRoutes.trainingDetail}?exercise=${exerciseType.name}');

  /// 種目タイプ付きでトレーニングセットアップに移動
  void goToTrainingSetup(ExerciseType exerciseType) => GoRouter.of(this)
      .go('${AppRoutes.trainingSetup}?exercise=${exerciseType.name}');

  /// アクティブトレーニングに移動
  void goToActiveTraining() => GoRouter.of(this).go(AppRoutes.trainingActive);

  /// トレーニング結果に移動
  void goToTrainingResult() => GoRouter.of(this).go(AppRoutes.trainingResult);

  /// 履歴に移動
  void goToHistory() => GoRouter.of(this).go(AppRoutes.history);

  /// 分析に移動
  void goToAnalytics() => GoRouter.of(this).go(AppRoutes.analytics);

  /// データエクスポートに移動
  void goToDataExport() => GoRouter.of(this).go(AppRoutes.settingsExport);

  /// アカウント削除に移動
  void goToAccountDeletion() => GoRouter.of(this).go(AppRoutes.settingsDeletion);

  /// アカウント復元に移動
  void goToAccountRecovery() => GoRouter.of(this).go(AppRoutes.recovery);

  /// オンボーディングに移動
  void goToOnboarding() => GoRouter.of(this).go(AppRoutes.onboarding);
}
