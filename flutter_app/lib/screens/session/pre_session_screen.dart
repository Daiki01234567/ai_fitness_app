/// Pre-Session Screen (Camera Setup)
///
/// Displays camera preview and setup checklist before training.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.8)
///
/// Features:
/// - Camera preview with skeleton overlay
/// - Setup checklist (4 items)
/// - Auto-start countdown when all items checked
/// - Exercise info display
/// - Improved error handling with recovery options
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/camera/camera_error.dart';
import '../../core/camera/camera_service.dart';
import '../../core/router/app_router.dart';
import '../../core/pose/coordinate_transformer.dart';
import '../../core/pose/pose_session_controller.dart';
import '../../core/session/session_state.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/camera/camera_error_widget.dart';
import '../../core/widgets/pose/pose_overlay.dart';
import '../../core/widgets/pose/pose_painter.dart';
import '../../core/form_analyzer/form_analyzer.dart';

/// Pre-session screen for camera setup
class PreSessionScreen extends ConsumerStatefulWidget {
  const PreSessionScreen({
    required this.exerciseType,
    super.key,
  });

  final ExerciseType exerciseType;

  @override
  ConsumerState<PreSessionScreen> createState() => _PreSessionScreenState();
}

class _PreSessionScreenState extends ConsumerState<PreSessionScreen> {
  Timer? _countdownTimer;
  bool _isCountingDown = false;
  int _countdownValue = 3;

  @override
  void initState() {
    super.initState();
    _initializeSession();
  }

  Future<void> _initializeSession() async {
    // Initialize session state
    ref
        .read(trainingSessionProvider.notifier)
        .initializeSession(widget.exerciseType);

    // Start pose detection session
    await ref.read(poseSessionControllerProvider.notifier).startSession();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    if (_isCountingDown) return;

    setState(() {
      _isCountingDown = true;
      _countdownValue = 3;
    });

    ref.read(trainingSessionProvider.notifier).startCountdown();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownValue > 1) {
        setState(() {
          _countdownValue--;
        });
        ref.read(trainingSessionProvider.notifier).updateCountdown(_countdownValue);
      } else {
        timer.cancel();
        _navigateToActiveSession();
      }
    });
  }

  void _cancelCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _isCountingDown = false;
      _countdownValue = 3;
    });
  }

  void _navigateToActiveSession() {
    ref.read(trainingSessionProvider.notifier).startActiveSession();
    context.goToActiveTraining();
  }

  void _handleChecklistChange(String itemId, bool checked) {
    ref.read(trainingSessionProvider.notifier).setChecklistItem(itemId, checked);

    final sessionState = ref.read(trainingSessionProvider);
    if (sessionState.isSetupComplete && !_isCountingDown) {
      _startCountdown();
    } else if (!sessionState.isSetupComplete && _isCountingDown) {
      _cancelCountdown();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(trainingSessionProvider);
    final poseSessionState = ref.watch(poseSessionControllerProvider);
    final cameraState = ref.watch(cameraStateProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(poseSessionControllerProvider.notifier).stopSession();
            ref.read(trainingSessionProvider.notifier).resetSession();
            // Use goToTraining instead of pop to avoid GoError when navigation stack is empty
            context.goToTraining();
          },
        ),
        title: const Text('カメラ設定'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Camera preview section
            Expanded(
              flex: 3,
              child: _buildCameraPreview(cameraState, poseSessionState),
            ),

            // Exercise info
            if (sessionState.exerciseInfo != null)
              _buildExerciseInfo(sessionState.exerciseInfo!),

            // Checklist section
            Expanded(
              flex: 2,
              child: _buildChecklistSection(sessionState),
            ),

            // Action button
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: _buildActionButton(sessionState),
            ),
          ],
        ),
      ),
    );
  }

  /// Navigate back to the training screen
  void _goBack() {
    ref.read(poseSessionControllerProvider.notifier).stopSession();
    ref.read(trainingSessionProvider.notifier).resetSession();
    context.goToTraining();
  }

  Widget _buildCameraPreview(CameraServiceState cameraState, PoseSessionState poseState) {
    if (poseState.isInitializing) {
      return _buildLoadingState();
    }

    // Check for errors using the structured error first, then fallback to message
    if (poseState.hasError) {
      final error = poseState.error ??
          (poseState.errorMessage != null
              ? CameraError.fromMessage(poseState.errorMessage!)
              : const CameraError(
                  type: CameraErrorType.unknown,
                  message: 'エラーが発生しました',
                ));

      return CameraErrorWidget(
        error: error,
        onRetry: _initializeSession,
        onGoBack: _goBack,
      );
    }

    final controller = cameraState.controller;
    if (controller == null || !controller.value.isInitialized) {
      return _buildLoadingState();
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final imageSize = Size(
            controller.value.previewSize?.height ?? 480,
            controller.value.previewSize?.width ?? 640,
          );
          final screenSize = Size(constraints.maxWidth, constraints.maxHeight);

          return Stack(
            fit: StackFit.expand,
            children: [
              // Camera preview
              Transform.scale(
                scale: 1.0,
                child: Center(
                  child: CameraPreview(controller),
                ),
              ),

              // Skeleton overlay
              if (poseState.currentPose != null)
                CustomPaint(
                  painter: PosePainter(
                    pose: poseState.currentPose!,
                    transformer: CoordinateTransformer(
                      imageSize: imageSize,
                      screenSize: screenSize,
                      cameraLensDirection: CameraLensDirection.front,
                    ),
                    config: const PoseOverlayConfig(),
                  ),
                ),

              // Countdown overlay
              if (_isCountingDown)
                Container(
                  color: Colors.black54,
                  child: Center(
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 1.5, end: 1.0),
                      duration: const Duration(milliseconds: 800),
                      key: ValueKey(_countdownValue),
                      builder: (context, scale, child) {
                        return Transform.scale(
                          scale: scale,
                          child: Text(
                            '$_countdownValue',
                            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 120,
                                ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildExerciseInfo(ExerciseInfo info) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              info.name,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Text(
              '推奨: ${info.recommendedOrientation}',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistSection(TrainingSessionState sessionState) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '確認事項',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const Divider(),
            Expanded(
              child: ListView.builder(
                itemCount: sessionState.setupChecklist.length,
                itemBuilder: (context, index) {
                  final item = sessionState.setupChecklist[index];
                  return CheckboxListTile(
                    value: item.isChecked,
                    onChanged: (value) {
                      _handleChecklistChange(item.id, value ?? false);
                    },
                    title: Text(item.label),
                    secondary: item.canAutoDetect
                        ? Icon(
                            Icons.auto_awesome,
                            size: 20,
                            color: Theme.of(context).colorScheme.primary,
                          )
                        : null,
                    controlAffinity: ListTileControlAffinity.leading,
                    dense: true,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(TrainingSessionState sessionState) {
    if (_isCountingDown) {
      return Column(
        children: [
          Text(
            '3秒後に自動開始...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton(
            onPressed: _navigateToActiveSession,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('すぐに開始'),
          ),
        ],
      );
    }

    return FilledButton(
      onPressed: sessionState.isSetupComplete ? _navigateToActiveSession : null,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
      ),
      child: const Text('開始'),
    );
  }

  /// Build the loading state widget
  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: AppSpacing.md),
          Text(
            'カメラを起動中...',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'しばらくお待ちください',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                ),
          ),
        ],
      ),
    );
  }
}
