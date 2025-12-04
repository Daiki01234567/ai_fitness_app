/// 姿勢ライフサイクルオブザーバー
///
/// アプリ状態に基づいて姿勢セッションのライフサイクルを管理します。
/// バッテリー最適化のためのバックグラウンド/フォアグラウンド遷移を処理します。
/// 参照: docs/specs/00_要件定義書_v3_3.md (NFR-035)
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../camera/camera_config.dart';
import 'pose_session_controller.dart';

/// ライフサイクルオブザーバープロバイダー
final poseLifecycleObserverProvider = Provider<PoseLifecycleObserver>((ref) {
  final sessionController = ref.watch(poseSessionControllerProvider.notifier);
  return PoseLifecycleObserver(sessionController);
});

/// 省電力モード状態プロバイダー
final powerSaveModeProvider = StateProvider<bool>((ref) => false);

/// アプリライフサイクルイベントを処理する姿勢ライフサイクルオブザーバー
class PoseLifecycleObserver with WidgetsBindingObserver {
  PoseLifecycleObserver(this._sessionController);

  final PoseSessionController _sessionController;

  /// バックグラウンドに移行する前にセッションがアクティブだったか
  bool _wasActiveBeforeBackground = false;

  /// オブザーバーが登録されているか
  bool _isRegistered = false;

  /// WidgetsBindingにオブザーバーを登録
  void register() {
    if (_isRegistered) return;
    WidgetsBinding.instance.addObserver(this);
    _isRegistered = true;
    debugPrint('PoseLifecycleObserver: Registered');
  }

  /// オブザーバーの登録を解除
  void unregister() {
    if (!_isRegistered) return;
    WidgetsBinding.instance.removeObserver(this);
    _isRegistered = false;
    debugPrint('PoseLifecycleObserver: Unregistered');
  }

  /// 省電力モードを有効化または無効化
  void setPowerSaveMode(bool enabled) {
    debugPrint('PoseLifecycleObserver: Power save mode: $enabled');

    if (enabled) {
      // セッションがアクティブな場合、省電力対策を適用
      _applyPowerSaveMode();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    debugPrint('PoseLifecycleObserver: App lifecycle state changed to: $state');

    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        _handleGoingToBackground();
        break;

      case AppLifecycleState.resumed:
        _handleReturningToForeground();
        break;

      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        // アプリが終了または非表示になっている、セッションを完全に停止
        _handleAppDetached();
        break;
    }
  }

  /// アプリがバックグラウンドに移行する処理
  void _handleGoingToBackground() {
    if (_sessionController.isSessionActive) {
      _wasActiveBeforeBackground = true;
      _sessionController.pauseSession();
      debugPrint('PoseLifecycleObserver: Session paused due to background');
    } else {
      _wasActiveBeforeBackground = false;
    }
  }

  /// アプリがフォアグラウンドに戻る処理
  void _handleReturningToForeground() {
    if (_wasActiveBeforeBackground) {
      _sessionController.resumeSession();
      _wasActiveBeforeBackground = false;
      debugPrint('PoseLifecycleObserver: Session resumed after foreground');
    }
  }

  /// アプリが切り離される処理
  void _handleAppDetached() {
    _wasActiveBeforeBackground = false;
    _sessionController.stopSession();
    debugPrint('PoseLifecycleObserver: Session stopped due to app detach');
  }

  /// 省電力モード最適化を適用
  void _applyPowerSaveMode() {
    // 省電力モードは以下で処理を削減できる:
    // 1. より多くのフレームをスキップ
    // 2. より低い解像度を使用
    // 3. 検出頻度を下げる

    // これはフォールバックメカニズムを通じて処理される
    // 省電力をパフォーマンス問題として扱う
    debugPrint('PoseLifecycleObserver: Applying power save optimizations');
  }
}

/// 姿勢ライフサイクルを自動管理するWidget
class PoseLifecycleWidget extends ConsumerStatefulWidget {
  const PoseLifecycleWidget({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<PoseLifecycleWidget> createState() =>
      _PoseLifecycleWidgetState();
}

class _PoseLifecycleWidgetState extends ConsumerState<PoseLifecycleWidget> {
  @override
  void initState() {
    super.initState();
    // ビルド後にライフサイクルオブザーバーを登録
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(poseLifecycleObserverProvider).register();
    });
  }

  @override
  void dispose() {
    ref.read(poseLifecycleObserverProvider).unregister();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 省電力モードを監視して適用
    final powerSaveMode = ref.watch(powerSaveModeProvider);
    ref.read(poseLifecycleObserverProvider).setPowerSaveMode(powerSaveMode);

    return widget.child;
  }
}

/// バッテリーを考慮したセッション制御用の拡張
extension BatteryAwareSessionExtension on PoseSessionController {
  /// バッテリーを考慮してセッションを開始
  Future<bool> startSessionBatteryAware({required bool isPowerSaveMode}) async {
    // 省電力モードがオンの場合、低品質で開始
    if (isPowerSaveMode) {
      return startSession(config: CameraConfig.lowQuality);
    }
    return startSession();
  }
}
