/// Pose Lifecycle Observer
///
/// Manages pose session lifecycle based on app state.
/// Handles background/foreground transitions for battery optimization.
/// Reference: docs/specs/00_要件定義書_v3_3.md (NFR-035)
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../camera/camera_config.dart';
import 'pose_session_controller.dart';

/// Lifecycle observer provider
final poseLifecycleObserverProvider = Provider<PoseLifecycleObserver>((ref) {
  final sessionController = ref.watch(poseSessionControllerProvider.notifier);
  return PoseLifecycleObserver(sessionController);
});

/// Power save mode state provider
final powerSaveModeProvider = StateProvider<bool>((ref) => false);

/// Pose lifecycle observer that handles app lifecycle events
class PoseLifecycleObserver with WidgetsBindingObserver {
  PoseLifecycleObserver(this._sessionController);

  final PoseSessionController _sessionController;

  /// Whether session was active before going to background
  bool _wasActiveBeforeBackground = false;

  /// Whether the observer is registered
  bool _isRegistered = false;

  /// Register the observer with WidgetsBinding
  void register() {
    if (_isRegistered) return;
    WidgetsBinding.instance.addObserver(this);
    _isRegistered = true;
    debugPrint('PoseLifecycleObserver: Registered');
  }

  /// Unregister the observer
  void unregister() {
    if (!_isRegistered) return;
    WidgetsBinding.instance.removeObserver(this);
    _isRegistered = false;
    debugPrint('PoseLifecycleObserver: Unregistered');
  }

  /// Enable or disable power save mode
  void setPowerSaveMode(bool enabled) {
    debugPrint('PoseLifecycleObserver: Power save mode: $enabled');

    if (enabled) {
      // If session is active, apply power saving measures
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
        // App is being terminated or hidden, stop session completely
        _handleAppDetached();
        break;
    }
  }

  /// Handle app going to background
  void _handleGoingToBackground() {
    if (_sessionController.isSessionActive) {
      _wasActiveBeforeBackground = true;
      _sessionController.pauseSession();
      debugPrint('PoseLifecycleObserver: Session paused due to background');
    } else {
      _wasActiveBeforeBackground = false;
    }
  }

  /// Handle app returning to foreground
  void _handleReturningToForeground() {
    if (_wasActiveBeforeBackground) {
      _sessionController.resumeSession();
      _wasActiveBeforeBackground = false;
      debugPrint('PoseLifecycleObserver: Session resumed after foreground');
    }
  }

  /// Handle app being detached
  void _handleAppDetached() {
    _wasActiveBeforeBackground = false;
    _sessionController.stopSession();
    debugPrint('PoseLifecycleObserver: Session stopped due to app detach');
  }

  /// Apply power save mode optimizations
  void _applyPowerSaveMode() {
    // Power save mode can reduce processing by:
    // 1. Skipping more frames
    // 2. Using lower resolution
    // 3. Reducing detection frequency

    // This is handled through the fallback mechanism
    // by treating power save as a performance issue
    debugPrint('PoseLifecycleObserver: Applying power save optimizations');
  }
}

/// Widget that automatically manages pose lifecycle
class PoseLifecycleWidget extends ConsumerStatefulWidget {
  const PoseLifecycleWidget({
    required this.child,
    super.key,
  });

  final Widget child;

  @override
  ConsumerState<PoseLifecycleWidget> createState() => _PoseLifecycleWidgetState();
}

class _PoseLifecycleWidgetState extends ConsumerState<PoseLifecycleWidget> {
  @override
  void initState() {
    super.initState();
    // Register lifecycle observer after build
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
    // Watch power save mode and apply it
    final powerSaveMode = ref.watch(powerSaveModeProvider);
    ref.read(poseLifecycleObserverProvider).setPowerSaveMode(powerSaveMode);

    return widget.child;
  }
}

/// Extension for battery-aware session control
extension BatteryAwareSessionExtension on PoseSessionController {
  /// Start session with battery awareness
  Future<bool> startSessionBatteryAware({
    required bool isPowerSaveMode,
  }) async {
    // If power save mode is on, start with lower quality
    if (isPowerSaveMode) {
      return startSession(config: CameraConfig.lowQuality);
    }
    return startSession();
  }
}
