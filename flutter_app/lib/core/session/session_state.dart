/// Session State Management
///
/// Manages the state of training sessions using Riverpod.
/// Reference: docs/tickets/011_training_session_screens.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../form_analyzer/form_analyzer.dart';
import '../pose/pose_data.dart';

part 'session_state.freezed.dart';

/// Session phase enum
enum SessionPhase {
  /// Initial phase - selecting exercise
  idle,

  /// Pre-session setup (camera positioning)
  setup,

  /// Countdown before start
  countdown,

  /// Active training
  active,

  /// Rest between sets
  rest,

  /// Session paused
  paused,

  /// Session completed
  completed,
}

/// Checklist item for pre-session setup
@freezed
class SetupChecklistItem with _$SetupChecklistItem {
  const factory SetupChecklistItem({
    required String id,
    required String label,
    required bool isChecked,
    required bool canAutoDetect,
  }) = _SetupChecklistItem;
}

/// Exercise info for display
@freezed
class ExerciseInfo with _$ExerciseInfo {
  const factory ExerciseInfo({
    required ExerciseType type,
    required String name,
    required String description,
    required String recommendedOrientation,
    required String targetBodyParts,
  }) = _ExerciseInfo;

  /// Create from ExerciseType
  factory ExerciseInfo.fromType(ExerciseType type) {
    String orientation;
    switch (type) {
      case ExerciseType.squat:
      case ExerciseType.pushUp:
        orientation = '横向き';
        break;
      case ExerciseType.armCurl:
      case ExerciseType.sideRaise:
      case ExerciseType.shoulderPress:
        orientation = '正面';
        break;
    }

    return ExerciseInfo(
      type: type,
      name: AnalyzerFactory.getDisplayName(type),
      description: AnalyzerFactory.getDescription(type),
      recommendedOrientation: orientation,
      targetBodyParts: AnalyzerFactory.getKeyBodyParts(type).join('・'),
    );
  }
}

/// Training session configuration
@freezed
class SessionConfig with _$SessionConfig {
  const factory SessionConfig({
    required ExerciseType exerciseType,
    @Default(10) int targetReps,
    @Default(3) int targetSets,
    @Default(60) int restDurationSeconds,
    @Default(true) bool enableVoiceFeedback,
    @Default(true) bool enableVisualFeedback,
  }) = _SessionConfig;
}

/// Current set data
@freezed
class SetData with _$SetData {
  const factory SetData({
    required int setNumber,
    required int reps,
    required double averageScore,
    required Duration duration,
    required List<FormIssue> issues,
  }) = _SetData;
}

/// Training session state
@freezed
class TrainingSessionState with _$TrainingSessionState {
  const factory TrainingSessionState({
    // Phase
    @Default(SessionPhase.idle) SessionPhase phase,

    // Configuration
    SessionConfig? config,
    ExerciseInfo? exerciseInfo,

    // Setup checklist
    @Default([]) List<SetupChecklistItem> setupChecklist,

    // Countdown
    @Default(3) int countdownValue,

    // Current session data
    @Default(1) int currentSet,
    @Default(0) int currentReps,
    @Default(0.0) double currentScore,
    @Default([]) List<FormIssue> currentIssues,

    // Timing
    DateTime? sessionStartTime,
    DateTime? setStartTime,
    @Default(0) int restTimeRemaining,

    // Real-time pose data
    PoseFrame? currentPose,
    FrameEvaluationResult? currentEvaluation,

    // Completed sets
    @Default([]) List<SetData> completedSets,

    // Error handling
    String? errorMessage,
  }) = _TrainingSessionState;

  const TrainingSessionState._();

  /// Get progress percentage for current set (0.0 - 1.0)
  double get setProgress {
    if (config == null || config!.targetReps == 0) return 0.0;
    return (currentReps / config!.targetReps).clamp(0.0, 1.0);
  }

  /// Get total progress percentage (0.0 - 1.0)
  double get totalProgress {
    if (config == null || config!.targetSets == 0) return 0.0;
    final completedProgress = completedSets.length / config!.targetSets;
    final currentSetProgress = setProgress / config!.targetSets;
    return (completedProgress + currentSetProgress).clamp(0.0, 1.0);
  }

  /// Get session duration
  Duration get sessionDuration {
    if (sessionStartTime == null) return Duration.zero;
    return DateTime.now().difference(sessionStartTime!);
  }

  /// Check if all setup items are checked
  bool get isSetupComplete =>
      setupChecklist.isNotEmpty &&
      setupChecklist.every((item) => item.isChecked);
}

/// Session state notifier
class TrainingSessionNotifier extends StateNotifier<TrainingSessionState> {
  TrainingSessionNotifier() : super(const TrainingSessionState());

  /// Initialize session with exercise type
  void initializeSession(ExerciseType exerciseType, {SessionConfig? config}) {
    state = TrainingSessionState(
      phase: SessionPhase.setup,
      config: config ??
          SessionConfig(
            exerciseType: exerciseType,
          ),
      exerciseInfo: ExerciseInfo.fromType(exerciseType),
      setupChecklist: _createDefaultChecklist(),
    );
  }

  /// Create default setup checklist
  List<SetupChecklistItem> _createDefaultChecklist() {
    return [
      const SetupChecklistItem(
        id: 'full_body',
        label: '全身が映っていますか？',
        isChecked: false,
        canAutoDetect: true,
      ),
      const SetupChecklistItem(
        id: 'brightness',
        label: '明るさは十分ですか？',
        isChecked: false,
        canAutoDetect: true,
      ),
      const SetupChecklistItem(
        id: 'background',
        label: '背景はシンプルですか？',
        isChecked: false,
        canAutoDetect: false,
      ),
      const SetupChecklistItem(
        id: 'distance',
        label: 'カメラから1.5-2.5m離れていますか？',
        isChecked: false,
        canAutoDetect: true,
      ),
    ];
  }

  /// Update session config
  void updateConfig(SessionConfig config) {
    state = state.copyWith(config: config);
  }

  /// Toggle checklist item
  void toggleChecklistItem(String id) {
    final updatedList = state.setupChecklist.map((item) {
      if (item.id == id) {
        return item.copyWith(isChecked: !item.isChecked);
      }
      return item;
    }).toList();

    state = state.copyWith(setupChecklist: updatedList);
  }

  /// Set checklist item checked state
  void setChecklistItem(String id, bool checked) {
    final updatedList = state.setupChecklist.map((item) {
      if (item.id == id) {
        return item.copyWith(isChecked: checked);
      }
      return item;
    }).toList();

    state = state.copyWith(setupChecklist: updatedList);
  }

  /// Start countdown
  void startCountdown() {
    state = state.copyWith(
      phase: SessionPhase.countdown,
      countdownValue: 3,
    );
  }

  /// Update countdown value
  void updateCountdown(int value) {
    state = state.copyWith(countdownValue: value);
  }

  /// Start active session
  void startActiveSession() {
    state = state.copyWith(
      phase: SessionPhase.active,
      sessionStartTime: DateTime.now(),
      setStartTime: DateTime.now(),
      currentSet: 1,
      currentReps: 0,
      currentScore: 0.0,
      currentIssues: [],
    );
  }

  /// Update pose frame
  void updatePoseFrame(PoseFrame pose) {
    state = state.copyWith(currentPose: pose);
  }

  /// Update evaluation result
  void updateEvaluation(FrameEvaluationResult evaluation) {
    state = state.copyWith(
      currentEvaluation: evaluation,
      currentScore: evaluation.score.toDouble(),
      currentIssues: evaluation.issues,
    );
  }

  /// Increment rep count
  void incrementReps() {
    state = state.copyWith(currentReps: state.currentReps + 1);
  }

  /// Set rep count (from analyzer)
  void setRepCount(int count) {
    state = state.copyWith(currentReps: count);
  }

  /// Pause session
  void pauseSession() {
    state = state.copyWith(phase: SessionPhase.paused);
  }

  /// Resume session
  void resumeSession() {
    state = state.copyWith(phase: SessionPhase.active);
  }

  /// Complete current set and start rest
  void completeSet() {
    final setData = SetData(
      setNumber: state.currentSet,
      reps: state.currentReps,
      averageScore: state.currentScore,
      duration: state.setStartTime != null
          ? DateTime.now().difference(state.setStartTime!)
          : Duration.zero,
      issues: List.from(state.currentIssues),
    );

    final updatedSets = [...state.completedSets, setData];

    // Check if all sets are complete
    if (state.config != null && updatedSets.length >= state.config!.targetSets) {
      state = state.copyWith(
        phase: SessionPhase.completed,
        completedSets: updatedSets,
      );
    } else {
      // Start rest period
      state = state.copyWith(
        phase: SessionPhase.rest,
        completedSets: updatedSets,
        restTimeRemaining: state.config?.restDurationSeconds ?? 60,
      );
    }
  }

  /// Update rest time
  void updateRestTime(int secondsRemaining) {
    state = state.copyWith(restTimeRemaining: secondsRemaining);
  }

  /// Start next set
  void startNextSet() {
    state = state.copyWith(
      phase: SessionPhase.active,
      currentSet: state.currentSet + 1,
      currentReps: 0,
      currentScore: 0.0,
      currentIssues: [],
      setStartTime: DateTime.now(),
    );
  }

  /// End session
  void endSession() {
    state = state.copyWith(phase: SessionPhase.completed);
  }

  /// Reset session
  void resetSession() {
    state = const TrainingSessionState();
  }

  /// Set error message
  void setError(String message) {
    state = state.copyWith(errorMessage: message);
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(errorMessage: null);
  }
}

/// Training session provider
final trainingSessionProvider =
    StateNotifierProvider<TrainingSessionNotifier, TrainingSessionState>((ref) {
  return TrainingSessionNotifier();
});
