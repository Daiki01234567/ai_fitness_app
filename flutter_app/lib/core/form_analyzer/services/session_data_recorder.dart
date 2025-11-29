/// Session Data Recorder
///
/// Records and manages training session data for form evaluation.
/// Reference: docs/specs/06_データ処理記録_ROPA_v1_0.md (Section 8)
/// Reference: docs/specs/02_Firestoreデータベース設計書_v3_3.md
///
/// Key features:
/// - Frame-by-frame evaluation recording
/// - Rep and set summary aggregation
/// - Statistics calculation
/// - Firestore integration (via repository pattern)
/// - Memory-efficient data handling
///
/// Data flow:
/// 1. Record frame evaluations during exercise
/// 2. Aggregate into rep summaries on rep completion
/// 3. Aggregate into set summary on set completion
/// 4. Generate session summary on session end
/// 5. Persist to Firestore (delegated to repository)
///
/// Legal notice: This is NOT a medical device.
/// All recorded data is for reference purposes only.
library;

import 'dart:async';

import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';

/// Configuration for data recording
class RecorderConfig {
  const RecorderConfig({
    this.maxFramesInMemory = 1800, // ~1 minute at 30fps
    this.sampleRate = 1, // Record every frame
    this.recordJointAngles = true,
    this.recordIssues = true,
    this.autoFlush = true,
    this.flushThreshold = 900, // ~30 seconds
  });

  /// Maximum frames to keep in memory
  final int maxFramesInMemory;

  /// Sample rate (1 = every frame, 2 = every other frame, etc.)
  final int sampleRate;

  /// Whether to record joint angles
  final bool recordJointAngles;

  /// Whether to record form issues
  final bool recordIssues;

  /// Whether to auto-flush old data
  final bool autoFlush;

  /// Number of frames before auto-flush
  final int flushThreshold;
}

/// Recorded frame data (minimal storage)
class RecordedFrame {
  const RecordedFrame({
    required this.timestamp,
    required this.score,
    required this.phase,
    this.jointAngles,
    this.issueTypes,
  });

  /// Timestamp in milliseconds
  final int timestamp;
  final double score;
  final ExercisePhase phase;
  final Map<String, double>? jointAngles;
  final List<String>? issueTypes;

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp,
      'score': score,
      'phase': phase.name,
      if (jointAngles != null) 'jointAngles': jointAngles,
      if (issueTypes != null && issueTypes!.isNotEmpty)
        'issueTypes': issueTypes,
    };
  }

  factory RecordedFrame.fromEvaluation(
    FrameEvaluationResult result, {
    required ExercisePhase phase,
    bool recordJointAngles = true,
    bool recordIssues = true,
  }) {
    return RecordedFrame(
      timestamp: result.timestamp,
      score: result.score,
      phase: phase,
      jointAngles: recordJointAngles ? result.jointAngles : null,
      issueTypes:
          recordIssues ? result.issues.map((i) => i.issueType).toList() : null,
    );
  }
}

/// Recorded rep data
class RecordedRep {
  RecordedRep({
    required this.repNumber,
    required this.startTime,
    required this.endTime,
    required this.score,
    required this.level,
    required this.issues,
    this.minScore,
    this.maxScore,
  });

  final int repNumber;
  /// Start timestamp in milliseconds
  final int startTime;
  /// End timestamp in milliseconds
  final int endTime;
  final double score;
  final FeedbackLevel level;
  final List<String> issues;
  final double? minScore;
  final double? maxScore;

  /// Duration in milliseconds
  int get durationMs => endTime - startTime;

  Map<String, dynamic> toJson() {
    return {
      'repNumber': repNumber,
      'startTime': startTime,
      'endTime': endTime,
      'durationMs': durationMs,
      'score': score,
      'level': level.name,
      'issues': issues,
      if (minScore != null) 'minScore': minScore,
      if (maxScore != null) 'maxScore': maxScore,
    };
  }

  factory RecordedRep.fromSummary(RepSummary summary) {
    return RecordedRep(
      repNumber: summary.repNumber,
      startTime: summary.startTime,
      endTime: summary.endTime,
      score: summary.score,
      level: summary.level,
      issues: summary.issues.map((i) => i.issueType).toList(),
      minScore: summary.minAngle,
      maxScore: summary.maxAngle,
    );
  }
}

/// Recorded set data
class RecordedSet {
  RecordedSet({
    required this.setNumber,
    required this.startTime,
    required this.endTime,
    required this.repCount,
    required this.averageScore,
    required this.reps,
    required this.commonIssues,
  });

  final int setNumber;
  /// Start timestamp in milliseconds
  final int startTime;
  /// End timestamp in milliseconds
  final int endTime;
  final int repCount;
  final double averageScore;
  final List<RecordedRep> reps;
  final List<String> commonIssues;

  /// Duration in milliseconds
  int get durationMs => endTime - startTime;

  Map<String, dynamic> toJson() {
    return {
      'setNumber': setNumber,
      'startTime': startTime,
      'endTime': endTime,
      'durationMs': durationMs,
      'repCount': repCount,
      'averageScore': averageScore,
      'reps': reps.map((r) => r.toJson()).toList(),
      'commonIssues': commonIssues,
    };
  }

  factory RecordedSet.fromSummary(SetSummary summary) {
    return RecordedSet(
      setNumber: summary.setNumber,
      startTime: summary.startTime,
      endTime: summary.endTime,
      repCount: summary.repCount,
      averageScore: summary.averageScore,
      reps: summary.reps.map((r) => RecordedRep.fromSummary(r)).toList(),
      commonIssues: summary.commonIssues.map((i) => i.issueType).toList(),
    );
  }
}

/// Complete session record
class SessionRecord {
  SessionRecord({
    required this.sessionId,
    required this.userId,
    required this.exerciseType,
    required this.startTime,
    required this.endTime,
    required this.totalReps,
    required this.totalSets,
    required this.averageScore,
    required this.sets,
    required this.topIssues,
    this.scoreDistribution,
    this.metadata,
  });

  final String sessionId;
  final String userId;
  final ExerciseType exerciseType;
  final DateTime startTime;
  final DateTime endTime;
  final int totalReps;
  final int totalSets;
  final double averageScore;
  final List<RecordedSet> sets;
  final List<String> topIssues;
  final Map<FeedbackLevel, int>? scoreDistribution;
  final Map<String, dynamic>? metadata;

  Duration get duration => endTime.difference(startTime);

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'userId': userId,
      'exerciseType': exerciseType.name,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'duration': duration.inMilliseconds,
      'totalReps': totalReps,
      'totalSets': totalSets,
      'averageScore': averageScore,
      'sets': sets.map((s) => s.toJson()).toList(),
      'topIssues': topIssues,
      if (scoreDistribution != null)
        'scoreDistribution':
            scoreDistribution!.map((k, v) => MapEntry(k.name, v)),
      if (metadata != null) 'metadata': metadata,
    };
  }

  /// Convert to Firestore-compatible format (for Sessions collection)
  Map<String, dynamic> toFirestoreDocument() {
    return {
      'userId': userId,
      'exerciseType': exerciseType.name,
      'startTime': startTime,
      'endTime': endTime,
      'durationSeconds': duration.inSeconds,
      'sessionMetadata': {
        'totalReps': totalReps,
        'totalSets': totalSets,
        'averageFormScore': averageScore,
        'topIssues': topIssues,
        'setCount': sets.length,
        'scoreDistribution':
            scoreDistribution?.map((k, v) => MapEntry(k.name, v)),
      },
      'poseData': {
        'frameCount': _calculateTotalFrames(),
        'fps': 30, // Target FPS
        'sets': sets.map((s) {
          return {
            'setNumber': s.setNumber,
            'repCount': s.repCount,
            'averageScore': s.averageScore,
            'reps': s.reps.map((r) {
              return {
                'repNumber': r.repNumber,
                'score': r.score,
                'durationMs': r.durationMs,
                'issues': r.issues,
              };
            }).toList(),
          };
        }).toList(),
      },
      'createdAt': DateTime.now(),
      'updatedAt': DateTime.now(),
    };
  }

  int _calculateTotalFrames() {
    int totalMs = 0;
    for (final set in sets) {
      for (final rep in set.reps) {
        totalMs += rep.durationMs;
      }
    }
    return (totalMs / 1000 * 30).round(); // Estimate at 30fps
  }
}

/// Abstract repository interface for session persistence
abstract class SessionRepository {
  /// Save session record to persistent storage
  Future<void> saveSession(SessionRecord record);

  /// Get session by ID
  Future<SessionRecord?> getSession(String sessionId);

  /// Get sessions for user
  Future<List<SessionRecord>> getUserSessions(
    String userId, {
    int limit = 20,
    DateTime? startAfter,
  });

  /// Delete session
  Future<void> deleteSession(String sessionId);
}

/// Callback for session events
typedef SessionEventCallback = void Function(SessionEvent event);

/// Session event types
enum SessionEventType {
  frameRecorded,
  repCompleted,
  setCompleted,
  sessionEnded,
  dataFlushed,
}

/// Session event
class SessionEvent {
  const SessionEvent({
    required this.type,
    this.data,
  });

  final SessionEventType type;
  final dynamic data;
}

/// Records and manages training session data
class SessionDataRecorder {
  SessionDataRecorder({
    required this.sessionId,
    required this.userId,
    required this.exerciseType,
    this.repository,
    RecorderConfig? config,
  }) : config = config ?? const RecorderConfig();

  final String sessionId;
  final String userId;
  final ExerciseType exerciseType;
  final SessionRepository? repository;
  final RecorderConfig config;

  /// Recorded frames for current rep
  final List<RecordedFrame> _currentRepFrames = [];

  /// Recorded reps for current set
  final List<RecordedRep> _currentSetReps = [];

  /// Recorded sets for session
  final List<RecordedSet> _recordedSets = [];

  /// Session start time
  DateTime? _sessionStartTime;

  /// Current set number
  int _currentSetNumber = 1;

  /// Current rep number within set
  int _currentRepNumber = 0;

  /// Frame counter for sampling
  int _frameCounter = 0;

  /// Total frames recorded
  int _totalFramesRecorded = 0;

  /// Statistics tracking
  final Map<FeedbackLevel, int> _scoreDistribution = {};

  /// Event callback
  SessionEventCallback? onEvent;

  /// Whether recording is active
  bool _isRecording = false;

  /// Session metadata
  Map<String, dynamic> metadata = {};

  /// Start recording session
  void startSession() {
    _sessionStartTime = DateTime.now();
    _isRecording = true;
    _resetCurrentRep();
  }

  /// Record frame evaluation
  void recordFrame(FrameEvaluationResult result, ExercisePhase phase) {
    if (!_isRecording) return;

    _frameCounter++;

    // Apply sample rate
    if (_frameCounter % config.sampleRate != 0) return;

    // Create recorded frame
    final frame = RecordedFrame.fromEvaluation(
      result,
      phase: phase,
      recordJointAngles: config.recordJointAngles,
      recordIssues: config.recordIssues,
    );

    _currentRepFrames.add(frame);
    _totalFramesRecorded++;

    // Update score distribution
    _updateScoreDistribution(result.level);

    // Auto-flush if needed
    if (config.autoFlush && _currentRepFrames.length >= config.flushThreshold) {
      _flushOldFrames();
    }

    _emitEvent(SessionEventType.frameRecorded, frame);
  }

  /// Record rep completion
  void recordRepCompleted(RepSummary summary) {
    if (!_isRecording) return;

    _currentRepNumber++;

    final recordedRep = RecordedRep.fromSummary(summary);
    _currentSetReps.add(recordedRep);

    _resetCurrentRep();

    _emitEvent(SessionEventType.repCompleted, recordedRep);
  }

  /// Record set completion
  void recordSetCompleted(SetSummary summary) {
    if (!_isRecording) return;

    final recordedSet = RecordedSet.fromSummary(summary);
    _recordedSets.add(recordedSet);

    _currentSetNumber++;
    _currentRepNumber = 0;
    _currentSetReps.clear();

    _emitEvent(SessionEventType.setCompleted, recordedSet);
  }

  /// End session and generate final record
  Future<SessionRecord> endSession() async {
    _isRecording = false;

    final sessionRecord = _createSessionRecord();

    // Save to repository if available
    if (repository != null) {
      await repository!.saveSession(sessionRecord);
    }

    _emitEvent(SessionEventType.sessionEnded, sessionRecord);

    return sessionRecord;
  }

  /// Cancel session without saving
  void cancelSession() {
    _isRecording = false;
    _currentRepFrames.clear();
    _currentSetReps.clear();
    _recordedSets.clear();
  }

  /// Get current session statistics
  SessionStatistics getStatistics() {
    final allReps = <RecordedRep>[];
    for (final set in _recordedSets) {
      allReps.addAll(set.reps);
    }
    allReps.addAll(_currentSetReps);

    final totalDuration = _sessionStartTime != null
        ? DateTime.now().difference(_sessionStartTime!)
        : Duration.zero;

    if (allReps.isEmpty) {
      // Return statistics with frame data even if no reps completed
      return SessionStatistics(
        totalReps: 0,
        totalSets: 0,
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        scoreDistribution: Map.from(_scoreDistribution),
        totalDuration: totalDuration,
        framesRecorded: _totalFramesRecorded,
      );
    }

    final scores = allReps.map((r) => r.score).toList();
    final totalScore = scores.reduce((a, b) => a + b);

    return SessionStatistics(
      totalReps: allReps.length,
      totalSets: _recordedSets.length + (_currentSetReps.isNotEmpty ? 1 : 0),
      averageScore: totalScore / scores.length,
      minScore: scores.reduce((a, b) => a < b ? a : b),
      maxScore: scores.reduce((a, b) => a > b ? a : b),
      scoreDistribution: Map.from(_scoreDistribution),
      totalDuration: totalDuration,
      framesRecorded: _totalFramesRecorded,
    );
  }

  /// Get most common issues
  List<String> getMostCommonIssues({int limit = 5}) {
    final issueCounts = <String, int>{};

    for (final set in _recordedSets) {
      for (final rep in set.reps) {
        for (final issue in rep.issues) {
          issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
        }
      }
    }

    for (final rep in _currentSetReps) {
      for (final issue in rep.issues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }
    }

    final sorted = issueCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(limit).map((e) => e.key).toList();
  }

  /// Create final session record
  SessionRecord _createSessionRecord() {
    // Include current set if it has reps
    final allSets = List<RecordedSet>.from(_recordedSets);
    if (_currentSetReps.isNotEmpty) {
      allSets.add(RecordedSet(
        setNumber: _currentSetNumber,
        startTime: _currentSetReps.first.startTime,
        endTime: _currentSetReps.last.endTime,
        repCount: _currentSetReps.length,
        averageScore: _calculateAverageScore(_currentSetReps),
        reps: List.from(_currentSetReps),
        commonIssues: _getCommonIssuesFromReps(_currentSetReps),
      ));
    }

    final totalReps = allSets.fold<int>(0, (sum, set) => sum + set.repCount);
    final totalScore = allSets.fold<double>(
        0, (sum, set) => sum + set.averageScore * set.repCount);

    return SessionRecord(
      sessionId: sessionId,
      userId: userId,
      exerciseType: exerciseType,
      startTime: _sessionStartTime ?? DateTime.now(),
      endTime: DateTime.now(),
      totalReps: totalReps,
      totalSets: allSets.length,
      averageScore: totalReps > 0 ? totalScore / totalReps : 0,
      sets: allSets,
      topIssues: getMostCommonIssues(),
      scoreDistribution: Map.from(_scoreDistribution),
      metadata: metadata,
    );
  }

  /// Reset current rep data
  void _resetCurrentRep() {
    _currentRepFrames.clear();
  }

  /// Flush old frames to free memory
  void _flushOldFrames() {
    if (_currentRepFrames.length <= config.flushThreshold) return;

    // Keep only recent frames
    final keepCount = config.flushThreshold ~/ 2;
    _currentRepFrames.removeRange(0, _currentRepFrames.length - keepCount);

    _emitEvent(SessionEventType.dataFlushed, null);
  }

  /// Update score distribution
  void _updateScoreDistribution(FeedbackLevel level) {
    _scoreDistribution[level] = (_scoreDistribution[level] ?? 0) + 1;
  }

  /// Calculate average score from reps
  double _calculateAverageScore(List<RecordedRep> reps) {
    if (reps.isEmpty) return 0;
    final total = reps.fold<double>(0, (sum, rep) => sum + rep.score);
    return total / reps.length;
  }

  /// Get common issues from reps
  List<String> _getCommonIssuesFromReps(List<RecordedRep> reps) {
    final issueCounts = <String, int>{};
    for (final rep in reps) {
      for (final issue in rep.issues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }
    }

    final sorted = issueCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(3).map((e) => e.key).toList();
  }

  /// Emit session event
  void _emitEvent(SessionEventType type, dynamic data) {
    onEvent?.call(SessionEvent(type: type, data: data));
  }

  /// Check if recording is active
  bool get isRecording => _isRecording;

  /// Get current rep number
  int get currentRepNumber => _currentRepNumber;

  /// Get current set number
  int get currentSetNumber => _currentSetNumber;

  /// Get total frames recorded
  int get totalFramesRecorded => _totalFramesRecorded;
}

/// Session statistics snapshot
class SessionStatistics {
  const SessionStatistics({
    required this.totalReps,
    required this.totalSets,
    required this.averageScore,
    required this.minScore,
    required this.maxScore,
    required this.scoreDistribution,
    required this.totalDuration,
    required this.framesRecorded,
  });

  factory SessionStatistics.empty() {
    return const SessionStatistics(
      totalReps: 0,
      totalSets: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      scoreDistribution: {},
      totalDuration: Duration.zero,
      framesRecorded: 0,
    );
  }

  final int totalReps;
  final int totalSets;
  final double averageScore;
  final double minScore;
  final double maxScore;
  final Map<FeedbackLevel, int> scoreDistribution;
  final Duration totalDuration;
  final int framesRecorded;

  Map<String, dynamic> toJson() {
    return {
      'totalReps': totalReps,
      'totalSets': totalSets,
      'averageScore': averageScore,
      'minScore': minScore,
      'maxScore': maxScore,
      'scoreDistribution':
          scoreDistribution.map((k, v) => MapEntry(k.name, v)),
      'totalDurationMs': totalDuration.inMilliseconds,
      'framesRecorded': framesRecorded,
    };
  }
}
