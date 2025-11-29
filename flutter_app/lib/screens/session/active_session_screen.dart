/// Active Session Screen (Training Execution)
///
/// Displays real-time training with pose detection and feedback.
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (3.9)
///
/// Features:
/// - Camera preview with skeleton overlay
/// - Real-time rep counting and score display
/// - Form feedback display
/// - Session controls (pause, stop, audio toggle)
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/camera/camera_service.dart';
import '../../core/pose/coordinate_transformer.dart';
import '../../core/pose/pose_session_controller.dart';
import '../../core/session/session_state.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/pose/pose_overlay.dart';
import '../../core/widgets/pose/pose_painter.dart';
import '../../core/form_analyzer/form_analyzer.dart';

/// Active session screen for training execution
class ActiveSessionScreen extends ConsumerStatefulWidget {
  const ActiveSessionScreen({super.key});

  @override
  ConsumerState<ActiveSessionScreen> createState() => _ActiveSessionScreenState();
}

class _ActiveSessionScreenState extends ConsumerState<ActiveSessionScreen> {
  late BaseFormAnalyzer _analyzer;
  bool _isAudioEnabled = true;
  Timer? _sessionTimer;
  Duration _sessionDuration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _initializeAnalyzer();
    _startSessionTimer();
  }

  void _initializeAnalyzer() {
    final sessionState = ref.read(trainingSessionProvider);
    if (sessionState.config != null) {
      _analyzer = AnalyzerFactory.create(sessionState.config!.exerciseType);
    }
  }

  void _startSessionTimer() {
    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() {
        _sessionDuration = _sessionDuration + const Duration(seconds: 1);
      });
    });
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    super.dispose();
  }

  void _handlePoseUpdate() {
    final poseState = ref.read(poseSessionControllerProvider);
    final currentPose = poseState.currentPose;

    if (currentPose != null) {
      final result = _analyzer.analyze(currentPose);
      ref.read(trainingSessionProvider.notifier).updateEvaluation(result.frameResult);
      ref.read(trainingSessionProvider.notifier).setRepCount(_analyzer.repCount);
    }
  }

  void _showStopConfirmDialog() {
    showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('トレーニングを終了しますか？'),
        content: const Text('現在のセッションデータは保存されます。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('キャンセル'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop(true);
              _endSession();
            },
            child: const Text('終了'),
          ),
        ],
      ),
    );
  }

  void _endSession() {
    ref.read(poseSessionControllerProvider.notifier).stopSession();
    ref.read(trainingSessionProvider.notifier).endSession();
    context.go('/training/result');
  }

  void _togglePause() {
    final sessionState = ref.read(trainingSessionProvider);
    if (sessionState.phase == SessionPhase.paused) {
      ref.read(trainingSessionProvider.notifier).resumeSession();
      ref.read(poseSessionControllerProvider.notifier).resumeSession();
    } else {
      ref.read(trainingSessionProvider.notifier).pauseSession();
      ref.read(poseSessionControllerProvider.notifier).pauseSession();
    }
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.toString().padLeft(2, '0');
    final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(trainingSessionProvider);
    final poseSessionState = ref.watch(poseSessionControllerProvider);
    final cameraState = ref.watch(cameraStateProvider);

    // Process pose updates
    ref.listen<PoseSessionState>(poseSessionControllerProvider, (previous, next) {
      if (next.currentPose != previous?.currentPose) {
        _handlePoseUpdate();
      }
    });

    final isPaused = sessionState.phase == SessionPhase.paused;

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            // Camera preview with skeleton
            _buildCameraView(cameraState, poseSessionState),

            // Top bar with exercise name and close button
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildTopBar(sessionState),
            ),

            // Progress and stats overlay
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomOverlay(sessionState),
            ),

            // Pause overlay
            if (isPaused) _buildPauseOverlay(),
          ],
        ),
      ),
    );
  }

  Widget _buildCameraView(CameraServiceState cameraState, PoseSessionState poseState) {
    final controller = cameraState.controller;
    if (controller == null || !controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }

    return LayoutBuilder(
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
            Center(
              child: CameraPreview(controller),
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
          ],
        );
      },
    );
  }

  Widget _buildTopBar(TrainingSessionState sessionState) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.7),
            Colors.transparent,
          ],
        ),
      ),
      child: Row(
        children: [
          // Exercise name
          Expanded(
            child: Text(
              sessionState.exerciseInfo?.name ?? '',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),

          // Timer
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: Colors.black45,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Text(
              _formatDuration(_sessionDuration),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),

          const SizedBox(width: AppSpacing.sm),

          // Close button
          IconButton(
            onPressed: _showStopConfirmDialog,
            icon: const Icon(Icons.close, color: Colors.white),
            style: IconButton.styleFrom(
              backgroundColor: Colors.black45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomOverlay(TrainingSessionState sessionState) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.8),
            Colors.transparent,
          ],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress bar
          _buildProgressBar(sessionState),
          const SizedBox(height: AppSpacing.md),

          // Stats row
          _buildStatsRow(sessionState),
          const SizedBox(height: AppSpacing.md),

          // Feedback section
          _buildFeedbackSection(sessionState),
          const SizedBox(height: AppSpacing.md),

          // Control buttons
          _buildControlButtons(sessionState),
        ],
      ),
    );
  }

  Widget _buildProgressBar(TrainingSessionState sessionState) {
    final config = sessionState.config;
    final progress = config != null
        ? (sessionState.currentReps / config.targetReps).clamp(0.0, 1.0)
        : 0.0;

    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: Colors.white24,
            valueColor: AlwaysStoppedAnimation<Color>(
              _getProgressColor(progress),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'レップ数: ${sessionState.currentReps} / ${config?.targetReps ?? 0}回',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Color _getProgressColor(double progress) {
    if (progress >= 0.8) return Colors.green;
    if (progress >= 0.5) return Colors.amber;
    return Theme.of(context).colorScheme.primary;
  }

  Widget _buildStatsRow(TrainingSessionState sessionState) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildStatItem(
          icon: Icons.replay,
          label: 'セット',
          value: '${sessionState.currentSet}/${sessionState.config?.targetSets ?? 0}',
        ),
        _buildStatItem(
          icon: Icons.star,
          label: '参考スコア',
          value: '${sessionState.currentScore.toStringAsFixed(0)}点',
          color: _getScoreColor(sessionState.currentScore),
        ),
      ],
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
    Color? color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: Colors.black45,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Icon(icon, color: color ?? Colors.white, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  color: color ?? Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getScoreColor(double score) {
    if (score >= 90) return Colors.green;
    if (score >= 70) return Colors.amber;
    if (score >= 50) return Colors.orange;
    return Colors.red;
  }

  Widget _buildFeedbackSection(TrainingSessionState sessionState) {
    if (sessionState.currentIssues.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.green.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green),
            SizedBox(width: AppSpacing.sm),
            Text(
              '良いフォームです',
              style: TextStyle(color: Colors.white),
            ),
          ],
        ),
      );
    }

    // Show highest priority issue
    final topIssue = sessionState.currentIssues.first;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: _getIssueColor(topIssue.priority).withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Icon(
            _getIssueIcon(topIssue.priority),
            color: _getIssueColor(topIssue.priority),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '参考情報',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                  ),
                ),
                Text(
                  topIssue.message,
                  style: const TextStyle(color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getIssueColor(FeedbackPriority priority) {
    switch (priority) {
      case FeedbackPriority.critical:
        return Colors.red;
      case FeedbackPriority.high:
        return Colors.orange;
      case FeedbackPriority.medium:
        return Colors.amber;
      case FeedbackPriority.low:
        return Colors.blue;
    }
  }

  IconData _getIssueIcon(FeedbackPriority priority) {
    switch (priority) {
      case FeedbackPriority.critical:
        return Icons.warning;
      case FeedbackPriority.high:
        return Icons.error_outline;
      case FeedbackPriority.medium:
        return Icons.info_outline;
      case FeedbackPriority.low:
        return Icons.lightbulb_outline;
    }
  }

  Widget _buildControlButtons(TrainingSessionState sessionState) {
    final isPaused = sessionState.phase == SessionPhase.paused;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        // Audio toggle
        IconButton(
          onPressed: () {
            setState(() {
              _isAudioEnabled = !_isAudioEnabled;
            });
          },
          icon: Icon(
            _isAudioEnabled ? Icons.volume_up : Icons.volume_off,
            color: Colors.white,
          ),
          style: IconButton.styleFrom(
            backgroundColor: Colors.black45,
            padding: const EdgeInsets.all(AppSpacing.md),
          ),
        ),

        // Pause/Resume button
        FilledButton.icon(
          onPressed: _togglePause,
          icon: Icon(isPaused ? Icons.play_arrow : Icons.pause),
          label: Text(isPaused ? '再開' : '一時停止'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.md,
            ),
          ),
        ),

        // Complete set button
        IconButton(
          onPressed: () {
            ref.read(trainingSessionProvider.notifier).completeSet();
            _handleSetComplete();
          },
          icon: const Icon(Icons.check, color: Colors.white),
          style: IconButton.styleFrom(
            backgroundColor: Colors.green,
            padding: const EdgeInsets.all(AppSpacing.md),
          ),
        ),
      ],
    );
  }

  void _handleSetComplete() {
    final sessionState = ref.read(trainingSessionProvider);

    if (sessionState.phase == SessionPhase.completed) {
      // All sets completed
      context.go('/training/result');
    } else if (sessionState.phase == SessionPhase.rest) {
      // Show rest screen or dialog
      _showRestDialog(sessionState.restTimeRemaining);
    }
  }

  void _showRestDialog(int restSeconds) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => RestDialog(
        restDurationSeconds: restSeconds,
        onComplete: () {
          Navigator.of(context).pop();
          ref.read(trainingSessionProvider.notifier).startNextSet();
          _analyzer.reset();
        },
        onSkip: () {
          Navigator.of(context).pop();
          ref.read(trainingSessionProvider.notifier).startNextSet();
          _analyzer.reset();
        },
      ),
    );
  }

  Widget _buildPauseOverlay() {
    return Container(
      color: Colors.black.withValues(alpha: 0.7),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.pause_circle_filled,
              size: 80,
              color: Colors.white,
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              '一時停止中',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton.icon(
              onPressed: _togglePause,
              icon: const Icon(Icons.play_arrow),
              label: const Text('再開'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xl,
                  vertical: AppSpacing.md,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextButton(
              onPressed: _showStopConfirmDialog,
              child: const Text(
                'トレーニングを終了',
                style: TextStyle(color: Colors.white70),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rest dialog between sets
class RestDialog extends StatefulWidget {
  const RestDialog({
    required this.restDurationSeconds,
    required this.onComplete,
    required this.onSkip,
    super.key,
  });

  final int restDurationSeconds;
  final VoidCallback onComplete;
  final VoidCallback onSkip;

  @override
  State<RestDialog> createState() => _RestDialogState();
}

class _RestDialogState extends State<RestDialog> {
  late int _remainingSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.restDurationSeconds;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        timer.cancel();
        widget.onComplete();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatSeconds(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('休憩時間'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _formatSeconds(_remainingSeconds),
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          LinearProgressIndicator(
            value: _remainingSeconds / widget.restDurationSeconds,
          ),
          const SizedBox(height: AppSpacing.lg),
          const Text(
            '次のセットの準備をしましょう',
            textAlign: TextAlign.center,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: widget.onSkip,
          child: const Text('スキップ'),
        ),
      ],
    );
  }
}
