/// Base Form Analyzer
///
/// Abstract base class for all exercise-specific form analyzers.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Exercise phase state for state machine
enum ExercisePhase {
  /// Initial/starting position
  start,

  /// Going down (eccentric for squat, curl down phase, etc.)
  down,

  /// At the bottom position
  bottom,

  /// Going up (concentric)
  up,

  /// At the top position
  top,

  /// Holding position
  hold,

  /// Rest between reps
  rest,
}

/// Exercise type enumeration
enum ExerciseType {
  squat('squat', 'スクワット'),
  armCurl('armcurl', 'アームカール'),
  sideRaise('sideraise', 'サイドレイズ'),
  shoulderPress('shoulderpress', 'ショルダープレス'),
  pushUp('pushup', 'プッシュアップ');

  const ExerciseType(this.id, this.displayName);

  final String id;
  final String displayName;

  /// Get landmark group for this exercise
  List<PoseLandmarkType> get requiredLandmarks {
    return switch (this) {
      ExerciseType.squat => LandmarkGroups.squat,
      ExerciseType.armCurl => LandmarkGroups.armCurl,
      ExerciseType.sideRaise => LandmarkGroups.sideRaise,
      ExerciseType.shoulderPress => LandmarkGroups.shoulderPress,
      ExerciseType.pushUp => LandmarkGroups.pushUp,
    };
  }
}

/// Configuration for form analyzer
class AnalyzerConfig {
  const AnalyzerConfig({
    this.minConfidenceThreshold = 0.5,
    this.recommendedConfidenceThreshold = 0.7,
    this.smoothingWindowSize = 5,
    this.minRepDurationMs = 500,
    this.maxRepDurationMs = 10000,
    this.feedbackIntervalMs = 3000,
    this.enableVoiceFeedback = true,
    this.strictMode = false,
  });

  /// Minimum confidence to process landmarks
  final double minConfidenceThreshold;

  /// Recommended confidence for reliable analysis
  final double recommendedConfidenceThreshold;

  /// Window size for smoothing filters
  final int smoothingWindowSize;

  /// Minimum rep duration in milliseconds
  final int minRepDurationMs;

  /// Maximum rep duration in milliseconds
  final int maxRepDurationMs;

  /// Minimum interval between voice feedback
  final int feedbackIntervalMs;

  /// Enable voice feedback
  final bool enableVoiceFeedback;

  /// Strict mode (more sensitive to form issues)
  final bool strictMode;

  /// Default configuration
  static const defaultConfig = AnalyzerConfig();
}

/// Result of form analysis
class AnalysisResult {
  const AnalysisResult({
    required this.frameResult,
    required this.currentPhase,
    required this.repCount,
    this.setCount = 1,
    this.feedbackMessages = const [],
    this.isProcessing = false,
    this.lowConfidenceWarning = false,
  });

  /// Frame evaluation result
  final FrameEvaluationResult frameResult;

  /// Current exercise phase
  final ExercisePhase currentPhase;

  /// Current rep count
  final int repCount;

  /// Current set count
  final int setCount;

  /// Feedback messages to display/speak
  final List<FeedbackMessage> feedbackMessages;

  /// Whether processing is in progress
  final bool isProcessing;

  /// Warning about low landmark confidence
  final bool lowConfidenceWarning;
}

/// Abstract base class for exercise form analyzers
abstract class BaseFormAnalyzer {
  BaseFormAnalyzer({AnalyzerConfig? config})
    : config = config ?? const AnalyzerConfig() {
    _initFilters();
  }

  /// Configuration for this analyzer
  final AnalyzerConfig config;

  /// Current exercise phase
  ExercisePhase _currentPhase = ExercisePhase.start;

  /// Rep counter
  int _repCount = 0;

  /// Set counter
  int _setCount = 1;

  /// Rep summaries for current set
  final List<RepSummary> _repSummaries = [];

  /// Set summaries for current session
  final List<SetSummary> _setSummaries = [];

  /// Current rep start time
  int? _repStartTime;

  /// Frame scores for current rep
  final List<double> _currentRepScores = [];

  /// Issues for current rep
  final List<FormIssue> _currentRepIssues = [];

  /// Last feedback timestamp (for rate limiting)
  int _lastFeedbackTime = 0;

  /// Moving average filters for smoothing
  final Map<String, MovingAverageFilter> _filters = {};

  /// Velocity calculators
  final Map<String, VelocityCalculator> _velocityCalcs = {};

  /// Exercise type for this analyzer
  ExerciseType get exerciseType;

  /// Required landmarks for this exercise
  List<PoseLandmarkType> get requiredLandmarks =>
      exerciseType.requiredLandmarks;

  /// Current phase getter
  ExercisePhase get currentPhase => _currentPhase;

  /// Current rep count getter
  int get repCount => _repCount;

  /// Current set count getter
  int get setCount => _setCount;

  /// Initialize smoothing filters
  void _initFilters() {
    // Subclasses can override to add specific filters
  }

  /// Get or create a moving average filter
  MovingAverageFilter getFilter(String key) {
    return _filters.putIfAbsent(
      key,
      () => MovingAverageFilter(windowSize: config.smoothingWindowSize),
    );
  }

  /// Get or create a velocity calculator
  VelocityCalculator getVelocityCalc(String key) {
    return _velocityCalcs.putIfAbsent(key, VelocityCalculator.new);
  }

  /// Analyze a single pose frame
  AnalysisResult analyze(PoseFrame frame) {
    // Check landmark confidence
    final hasMinConfidence = frame.allMeetMinimumThreshold(requiredLandmarks);
    final hasRecommendedConfidence = frame.areAllReliable(requiredLandmarks);

    if (!hasMinConfidence) {
      return AnalysisResult(
        frameResult: FrameEvaluationResult(
          timestamp: frame.timestamp,
          score: 0,
          level: FeedbackLevel.needsImprovement,
          issues: [
            const FormIssue(
              issueType: 'low_confidence',
              message: '姿勢を検出できません。カメラに全身が映るように調整してください。',
              priority: FeedbackPriority.critical,
            ),
          ],
          currentPhase: _currentPhase.name,
        ),
        currentPhase: _currentPhase,
        repCount: _repCount,
        setCount: _setCount,
        lowConfidenceWarning: true,
      );
    }

    // Perform exercise-specific analysis
    final frameResult = evaluateFrame(frame);

    // Update phase based on analysis
    final newPhase = determinePhase(frame, frameResult);
    _handlePhaseTransition(
      _currentPhase,
      newPhase,
      frame.timestamp,
      frameResult,
    );
    _currentPhase = newPhase;

    // Track scores and issues for current rep
    _currentRepScores.add(frameResult.score);
    _currentRepIssues.addAll(frameResult.issues);

    // Generate feedback messages
    final messages = _generateFeedback(frameResult, frame.timestamp);

    return AnalysisResult(
      frameResult: frameResult.copyWith(currentPhase: _currentPhase.name),
      currentPhase: _currentPhase,
      repCount: _repCount,
      setCount: _setCount,
      feedbackMessages: messages,
      lowConfidenceWarning: !hasRecommendedConfidence,
    );
  }

  /// Evaluate a single frame - to be implemented by subclasses
  FrameEvaluationResult evaluateFrame(PoseFrame frame);

  /// Determine current exercise phase - to be implemented by subclasses
  ExercisePhase determinePhase(PoseFrame frame, FrameEvaluationResult result);

  /// Get exercise-specific threshold for phase transitions
  /// Returns map of phase transitions and their angle thresholds
  Map<String, double> get phaseThresholds;

  /// Handle phase transitions and rep counting
  void _handlePhaseTransition(
    ExercisePhase oldPhase,
    ExercisePhase newPhase,
    int timestamp,
    FrameEvaluationResult result,
  ) {
    if (oldPhase == newPhase) return;

    // Start of new rep
    if (oldPhase == ExercisePhase.start && newPhase == ExercisePhase.down) {
      _repStartTime = timestamp;
      _currentRepScores.clear();
      _currentRepIssues.clear();
    }

    // Check for rep completion
    if (_isRepComplete(oldPhase, newPhase)) {
      _completeRep(timestamp, result);
    }
  }

  /// Check if a rep was completed based on phase transition
  bool _isRepComplete(ExercisePhase oldPhase, ExercisePhase newPhase) {
    // Most exercises: down -> bottom -> up -> top/start = 1 rep
    return (oldPhase == ExercisePhase.up &&
            (newPhase == ExercisePhase.top ||
                newPhase == ExercisePhase.start)) ||
        (oldPhase == ExercisePhase.top && newPhase == ExercisePhase.down);
  }

  /// Complete a rep and record summary
  void _completeRep(int timestamp, FrameEvaluationResult result) {
    final repDuration = _repStartTime != null ? timestamp - _repStartTime! : 0;

    // Validate rep duration
    if (repDuration < config.minRepDurationMs ||
        repDuration > config.maxRepDurationMs) {
      // Invalid rep - too fast or too slow, reset
      _currentRepScores.clear();
      _currentRepIssues.clear();
      return;
    }

    _repCount++;

    // Calculate average score for this rep
    final avgScore = _currentRepScores.isEmpty
        ? 0.0
        : _currentRepScores.reduce((a, b) => a + b) / _currentRepScores.length;

    // Aggregate issues (remove duplicates)
    final uniqueIssues = <String, FormIssue>{};
    for (final issue in _currentRepIssues) {
      uniqueIssues.putIfAbsent(issue.issueType, () => issue);
    }

    final repSummary = RepSummary(
      repNumber: _repCount,
      score: avgScore,
      level: FeedbackLevelExtension.fromScore(avgScore),
      issues: uniqueIssues.values.toList(),
      startTime: _repStartTime ?? timestamp,
      endTime: timestamp,
      tempo: repDuration / 1000.0,
    );

    _repSummaries.add(repSummary);

    // Clear for next rep
    _currentRepScores.clear();
    _currentRepIssues.clear();
    _repStartTime = null;
  }

  /// Generate feedback messages (with rate limiting)
  List<FeedbackMessage> _generateFeedback(
    FrameEvaluationResult result,
    int timestamp,
  ) {
    final messages = <FeedbackMessage>[];

    // Critical issues always generate feedback
    final criticalIssues = result.issues
        .where((i) => i.priority == FeedbackPriority.critical)
        .toList();

    for (final issue in criticalIssues) {
      messages.add(
        FeedbackMessage(
          message: issue.suggestion ?? issue.message,
          priority: issue.priority,
          type: FeedbackType.realTimeAlert,
          issueType: issue.issueType,
          timestamp: timestamp,
        ),
      );
    }

    // Rate limit other feedback
    if (timestamp - _lastFeedbackTime < config.feedbackIntervalMs) {
      return messages;
    }

    // High priority issues
    final highIssues = result.issues
        .where((i) => i.priority == FeedbackPriority.high)
        .take(1)
        .toList();

    for (final issue in highIssues) {
      messages.add(
        FeedbackMessage(
          message: issue.suggestion ?? issue.message,
          priority: issue.priority,
          type: FeedbackType.realTimeAlert,
          issueType: issue.issueType,
          timestamp: timestamp,
        ),
      );
      _lastFeedbackTime = timestamp;
    }

    return messages;
  }

  /// Complete current set
  SetSummary completeSet() {
    final avgScore = _repSummaries.isEmpty
        ? 0.0
        : _repSummaries.map((r) => r.score).reduce((a, b) => a + b) /
              _repSummaries.length;

    // Find common issues
    final issueCounts = <String, int>{};
    for (final rep in _repSummaries) {
      for (final issue in rep.issues) {
        issueCounts[issue.issueType] = (issueCounts[issue.issueType] ?? 0) + 1;
      }
    }

    final commonIssues = issueCounts.entries
        .where((e) => e.value >= _repSummaries.length / 2)
        .map(
          (e) => _repSummaries
              .expand((r) => r.issues)
              .firstWhere((i) => i.issueType == e.key),
        )
        .toList();

    final setSummary = SetSummary(
      setNumber: _setCount,
      repCount: _repCount,
      averageScore: avgScore,
      level: FeedbackLevelExtension.fromScore(avgScore),
      reps: List.from(_repSummaries),
      startTime: _repSummaries.isEmpty ? 0 : _repSummaries.first.startTime,
      endTime: _repSummaries.isEmpty ? 0 : _repSummaries.last.endTime,
      commonIssues: commonIssues,
    );

    _setSummaries.add(setSummary);
    _setCount++;
    _repCount = 0;
    _repSummaries.clear();

    return setSummary;
  }

  /// Get session summary
  SessionSummary getSessionSummary() {
    // Include current set if has reps
    if (_repSummaries.isNotEmpty) {
      completeSet();
    }

    final totalReps = _setSummaries.fold<int>(0, (sum, s) => sum + s.repCount);
    final avgScore = _setSummaries.isEmpty
        ? 0.0
        : _setSummaries.map((s) => s.averageScore).reduce((a, b) => a + b) /
              _setSummaries.length;

    // Find top issues across session
    final issueCounts = <String, int>{};
    for (final set in _setSummaries) {
      for (final issue in set.commonIssues) {
        issueCounts[issue.issueType] = (issueCounts[issue.issueType] ?? 0) + 1;
      }
    }

    final topIssues = issueCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final topIssueList = topIssues.take(3).map((e) {
      return _setSummaries
          .expand((s) => s.commonIssues)
          .firstWhere((i) => i.issueType == e.key);
    }).toList();

    return SessionSummary(
      exerciseType: exerciseType.id,
      setCount: _setSummaries.length,
      totalReps: totalReps,
      averageScore: avgScore,
      level: FeedbackLevelExtension.fromScore(avgScore),
      sets: List.from(_setSummaries),
      startTime: _setSummaries.isEmpty ? 0 : _setSummaries.first.startTime,
      endTime: _setSummaries.isEmpty ? 0 : _setSummaries.last.endTime,
      topIssues: topIssueList,
      improvementAreas: topIssueList
          .map((i) => i.suggestion ?? i.message)
          .toList(),
    );
  }

  /// Reset analyzer state
  void reset() {
    _currentPhase = ExercisePhase.start;
    _repCount = 0;
    _setCount = 1;
    _repSummaries.clear();
    _setSummaries.clear();
    _currentRepScores.clear();
    _currentRepIssues.clear();
    _repStartTime = null;
    _lastFeedbackTime = 0;

    for (final filter in _filters.values) {
      filter.reset();
    }
    for (final calc in _velocityCalcs.values) {
      calc.reset();
    }
  }
}

/// Extension to add copyWith to FrameEvaluationResult
extension FrameEvaluationResultExtension on FrameEvaluationResult {
  FrameEvaluationResult copyWith({
    int? timestamp,
    double? score,
    FeedbackLevel? level,
    List<FormIssue>? issues,
    Map<String, double>? jointAngles,
    bool? isRepComplete,
    String? currentPhase,
  }) {
    return FrameEvaluationResult(
      timestamp: timestamp ?? this.timestamp,
      score: score ?? this.score,
      level: level ?? this.level,
      issues: issues ?? this.issues,
      jointAngles: jointAngles ?? this.jointAngles,
      isRepComplete: isRepComplete ?? this.isRepComplete,
      currentPhase: currentPhase ?? this.currentPhase,
    );
  }
}
