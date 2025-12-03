// アプリルーター設定
// 認証状態を考慮したGoRouterベースのナビゲーション
//
// 同意画面チラつき防止のため、認証状態と同意状態を統合管理
// 仕様参照: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md セクション2.1
//
// @version 1.2.0
// @date 2025-12-02

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';
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
  final authNotifier = ref.read(authStateProvider.notifier);
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: _AuthConsentStateNotifier(ref),
    redirect: (context, state) {
      final isOnAuthPage = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.passwordReset ||
          state.matchedLocation == AppRoutes.recovery;
      final isOnSplash = state.matchedLocation == AppRoutes.splash;
      final isOnConsent = state.matchedLocation == AppRoutes.consent;
      final isOnOnboarding = state.matchedLocation == AppRoutes.onboarding;

      debugPrint('[Router] redirect called: location=${state.matchedLocation}, appInitState=$appInitState');

      // 別のページに移動する際にエラーをクリア
      if (authState.error != null) {
        // ビルド中に状態を変更しないようにFuture.microtaskを使用
        Future.microtask(() => authNotifier.clearError());
      }

      // 強制ログアウトの場合は即座にログイン画面へ
      if (appInitState.status == AppInitializationStatus.forceLoggedOut) {
        debugPrint('[Router] Force logout detected, redirecting to login');
        Future.microtask(() => authNotifier.clearForceLogout());
        return AppRoutes.login;
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
        return AppRoutes.splash;
      }

      // 以下、ローディング完了後の処理
      // 認証状態と同意状態が両方確定してから遷移先を決定
      // -------------------------

      // 未認証の場合のルーティング
      if (appInitState.shouldShowLogin) {
        // オンボーディング・スプラッシュ画面は認証不要なのでスキップ
        if (isOnAuthPage || isOnOnboarding) {
          return null;
        }
        // スプラッシュ画面にいる場合はスプラッシュ画面のナビゲーションに任せる
        // （初回起動チェック等を行うため）
        if (isOnSplash) {
          return null;
        }
        return AppRoutes.login;
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
        return AppRoutes.consent;
      }

      // 認証済みで同意済み（ready状態）
      if (appInitState.isReady) {
        // 認証ページ・オンボーディング・同意ページ・スプラッシュにいる場合はホームへ
        if (isOnAuthPage || isOnOnboarding || isOnConsent || isOnSplash) {
          return AppRoutes.home;
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
class _AuthConsentStateNotifier extends ChangeNotifier {
  _AuthConsentStateNotifier(this._ref) {
    _ref.listen(authStateProvider, (previous, next) {
      notifyListeners();
    });
    _ref.listen(consentStateProvider, (previous, next) {
      notifyListeners();
    });
    // Also listen to the combined initialization state for immediate updates
    _ref.listen(appInitializationProvider, (previous, next) {
      notifyListeners();
    });
  }

  // ignore: unused_field - リスナー用にrefの参照を保持するために使用されるフィールド
  final Ref _ref;
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
