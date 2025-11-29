// アプリルーター設定
// 認証状態を考慮したGoRouterベースのナビゲーション
//
// @version 1.1.0
// @date 2025-11-27

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state_notifier.dart';
import '../consent/consent_state_notifier.dart';
import '../form_analyzer/form_analyzer.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/auth/password_reset_screen.dart';
import '../../screens/home/home_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/legal/consent_screen.dart';
import '../../screens/session/pre_session_screen.dart';
import '../../screens/session/active_session_screen.dart';
import '../../screens/session/session_result_screen.dart';
import '../../screens/session/exercise_selection_screen.dart';
import '../../screens/session/exercise_detail_screen.dart';
import '../../screens/history/history_screen.dart';
import '../../screens/analytics/analytics_screen.dart';

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
  static const consent = '/consent';
}

/// ルータープロバイダー
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final consentState = ref.watch(consentStateProvider);
  final authNotifier = ref.read(authStateProvider.notifier);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: _AuthConsentStateNotifier(ref),
    redirect: (context, state) {
      final isLoading = authState.isLoading || consentState.isLoading;
      final isAuthenticated = authState.user != null;
      final needsConsent = consentState.needsConsent;
      final isOnAuthPage = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.passwordReset;
      final isOnSplash = state.matchedLocation == AppRoutes.splash;
      final isOnConsent = state.matchedLocation == AppRoutes.consent;

      // 別のページに移動する際にエラーをクリア
      if (authState.error != null) {
        // ビルド中に状態を変更しないようにFuture.microtaskを使用
        Future.microtask(() => authNotifier.clearError());
      }

      // 読み込み中はスプラッシュを表示
      if (isLoading && isOnSplash) {
        return null;
      }

      // まず強制ログアウトをチェック
      if (authState.isForceLogout) {
        // ログインへのリダイレクト後に強制ログアウトフラグをクリア
        Future.microtask(() => authNotifier.clearForceLogout());
        return AppRoutes.login;
      }

      // 読み込み完了後、スプラッシュにいる場合は認証と同意状態に基づいてリダイレクト
      if (!isLoading && isOnSplash) {
        if (!isAuthenticated) {
          return AppRoutes.login;
        }
        // 認証後に同意をチェック
        if (needsConsent) {
          return AppRoutes.consent;
        }
        return AppRoutes.home;
      }

      // 未認証で認証ページにいない場合はログインにリダイレクト
      if (!isAuthenticated && !isOnAuthPage && !isOnSplash) {
        return AppRoutes.login;
      }

      // 認証済みで認証ページにいる場合は同意をチェックしてホームへ
      if (isAuthenticated && isOnAuthPage) {
        if (needsConsent) {
          return AppRoutes.consent;
        }
        return AppRoutes.home;
      }

      // 認証済みだが同意が必要な場合は同意画面にリダイレクト
      if (isAuthenticated && needsConsent && !isOnConsent && !isOnSplash) {
        return AppRoutes.consent;
      }

      // 認証済みで同意済みかつ同意ページにいる場合はホームへ
      if (isAuthenticated && !needsConsent && isOnConsent) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      // スプラッシュ画面
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
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

  /// トレーニング（種目選択）に移動
  void goToTraining() => GoRouter.of(this).go(AppRoutes.training);

  /// 種目詳細画面に移動
  void goToExerciseDetail(ExerciseType exerciseType) =>
      GoRouter.of(this).go('${AppRoutes.trainingDetail}?exercise=${exerciseType.name}');

  /// 種目タイプ付きでトレーニングセットアップに移動
  void goToTrainingSetup(ExerciseType exerciseType) =>
      GoRouter.of(this).go('${AppRoutes.trainingSetup}?exercise=${exerciseType.name}');

  /// アクティブトレーニングに移動
  void goToActiveTraining() => GoRouter.of(this).go(AppRoutes.trainingActive);

  /// トレーニング結果に移動
  void goToTrainingResult() => GoRouter.of(this).go(AppRoutes.trainingResult);

  /// 履歴に移動
  void goToHistory() => GoRouter.of(this).go(AppRoutes.history);

  /// 分析に移動
  void goToAnalytics() => GoRouter.of(this).go(AppRoutes.analytics);
}
