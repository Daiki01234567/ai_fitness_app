/// Session Recorder
///
/// Records pose detection data during training sessions.
/// Handles frame data, metadata, and batch preparation for upload.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'pose_data.dart';
import 'pose_landmark_type.dart';

/// Maximum number of frames to keep in memory
const int kMaxFramesInMemory = 1800; // ~60 seconds at 30fps

/// Session recording state
enum RecordingState {
  /// Not recording
  idle,

  /// Currently recording
  recording,

  /// Recording paused
  paused,

  /// Recording completed, ready for export
  completed,
}

/// Recorded frame data
class RecordedFrame {
  const RecordedFrame({
    required this.frameIndex,
    required this.timestamp,
    required this.landmarks,
    required this.processingTimeMs,
    required this.overallConfidence,
  });

  /// Frame index in the session
  final int frameIndex;

  /// Timestamp in milliseconds since session start
  final int timestamp;

  /// Landmark data (only reliable landmarks are stored)
  final Map<PoseLandmarkType, RecordedLandmark> landmarks;

  /// Processing time for this frame in milliseconds
  final int processingTimeMs;

  /// Overall confidence score for this frame
  final double overallConfidence;

  /// Convert to JSON for storage/upload
  Map<String, dynamic> toJson() {
    return {
      'frameIndex': frameIndex,
      'timestamp': timestamp,
      'landmarks': landmarks.map(
        (key, value) => MapEntry(key.index.toString(), value.toJson()),
      ),
      'processingTimeMs': processingTimeMs,
      'overallConfidence': overallConfidence,
    };
  }

  /// Create from JSON
  factory RecordedFrame.fromJson(Map<String, dynamic> json) {
    final landmarksJson = json['landmarks'] as Map<String, dynamic>;
    final landmarks = <PoseLandmarkType, RecordedLandmark>{};

    for (final entry in landmarksJson.entries) {
      final index = int.parse(entry.key);
      final type = PoseLandmarkType.values[index];
      landmarks[type] = RecordedLandmark.fromJson(
        entry.value as Map<String, dynamic>,
      );
    }

    return RecordedFrame(
      frameIndex: json['frameIndex'] as int,
      timestamp: json['timestamp'] as int,
      landmarks: landmarks,
      processingTimeMs: json['processingTimeMs'] as int,
      overallConfidence: (json['overallConfidence'] as num).toDouble(),
    );
  }
}

/// Recorded landmark data (compact format)
class RecordedLandmark {
  const RecordedLandmark({
    required this.x,
    required this.y,
    required this.z,
    required this.likelihood,
  });

  /// X coordinate (normalized 0-1)
  final double x;

  /// Y coordinate (normalized 0-1)
  final double y;

  /// Z coordinate (depth)
  final double z;

  /// Confidence score
  final double likelihood;

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'x': x,
      'y': y,
      'z': z,
      'l': likelihood,
    };
  }

  /// Create from JSON
  factory RecordedLandmark.fromJson(Map<String, dynamic> json) {
    return RecordedLandmark(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      z: (json['z'] as num).toDouble(),
      likelihood: (json['l'] as num).toDouble(),
    );
  }

  /// Create from PoseLandmark
  factory RecordedLandmark.fromPoseLandmark(PoseLandmark landmark) {
    return RecordedLandmark(
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      likelihood: landmark.likelihood,
    );
  }
}

/// Session metadata
class SessionMetadata {
  const SessionMetadata({
    required this.sessionId,
    required this.userId,
    required this.exerciseType,
    required this.startTime,
    this.endTime,
    this.deviceInfo,
    this.cameraConfig,
    this.averageFps,
    this.totalFrames,
    this.droppedFrames,
  });

  /// Unique session identifier
  final String sessionId;

  /// User identifier
  final String userId;

  /// Type of exercise being performed
  final String exerciseType;

  /// Session start time
  final DateTime startTime;

  /// Session end time
  final DateTime? endTime;

  /// Device information
  final DeviceInfo? deviceInfo;

  /// Camera configuration used
  final CameraConfigInfo? cameraConfig;

  /// Average FPS during session
  final double? averageFps;

  /// Total frames recorded
  final int? totalFrames;

  /// Number of dropped frames
  final int? droppedFrames;

  /// Session duration in milliseconds
  int? get durationMs {
    if (endTime == null) return null;
    return endTime!.difference(startTime).inMilliseconds;
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'userId': userId,
      'exerciseType': exerciseType,
      'startTime': startTime.toIso8601String(),
      if (endTime != null) 'endTime': endTime!.toIso8601String(),
      if (deviceInfo != null) 'deviceInfo': deviceInfo!.toJson(),
      if (cameraConfig != null) 'cameraConfig': cameraConfig!.toJson(),
      if (averageFps != null) 'averageFps': averageFps,
      if (totalFrames != null) 'totalFrames': totalFrames,
      if (droppedFrames != null) 'droppedFrames': droppedFrames,
    };
  }

  /// Create updated copy
  SessionMetadata copyWith({
    DateTime? endTime,
    double? averageFps,
    int? totalFrames,
    int? droppedFrames,
  }) {
    return SessionMetadata(
      sessionId: sessionId,
      userId: userId,
      exerciseType: exerciseType,
      startTime: startTime,
      endTime: endTime ?? this.endTime,
      deviceInfo: deviceInfo,
      cameraConfig: cameraConfig,
      averageFps: averageFps ?? this.averageFps,
      totalFrames: totalFrames ?? this.totalFrames,
      droppedFrames: droppedFrames ?? this.droppedFrames,
    );
  }
}

/// Device information
class DeviceInfo {
  const DeviceInfo({
    required this.platform,
    this.model,
    this.osVersion,
  });

  final String platform;
  final String? model;
  final String? osVersion;

  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
      if (model != null) 'model': model,
      if (osVersion != null) 'osVersion': osVersion,
    };
  }
}

/// Camera configuration information
class CameraConfigInfo {
  const CameraConfigInfo({
    required this.resolution,
    required this.targetFps,
  });

  final String resolution;
  final int targetFps;

  Map<String, dynamic> toJson() {
    return {
      'resolution': resolution,
      'targetFps': targetFps,
    };
  }
}

/// Session recorder state
class SessionRecorderState {
  const SessionRecorderState({
    this.recordingState = RecordingState.idle,
    this.metadata,
    this.frameCount = 0,
    this.droppedFrameCount = 0,
    this.lastFrameTimestamp,
  });

  final RecordingState recordingState;
  final SessionMetadata? metadata;
  final int frameCount;
  final int droppedFrameCount;
  final int? lastFrameTimestamp;

  bool get isRecording => recordingState == RecordingState.recording;
  bool get isPaused => recordingState == RecordingState.paused;
  bool get isCompleted => recordingState == RecordingState.completed;

  SessionRecorderState copyWith({
    RecordingState? recordingState,
    SessionMetadata? metadata,
    int? frameCount,
    int? droppedFrameCount,
    int? lastFrameTimestamp,
  }) {
    return SessionRecorderState(
      recordingState: recordingState ?? this.recordingState,
      metadata: metadata ?? this.metadata,
      frameCount: frameCount ?? this.frameCount,
      droppedFrameCount: droppedFrameCount ?? this.droppedFrameCount,
      lastFrameTimestamp: lastFrameTimestamp ?? this.lastFrameTimestamp,
    );
  }
}

/// Session recorder provider
final sessionRecorderProvider =
    StateNotifierProvider<SessionRecorderNotifier, SessionRecorderState>((ref) {
  return SessionRecorderNotifier();
});

/// Session recorder notifier
class SessionRecorderNotifier extends StateNotifier<SessionRecorderState> {
  SessionRecorderNotifier() : super(const SessionRecorderState());

  /// Recorded frames (circular buffer)
  final Queue<RecordedFrame> _frames = Queue<RecordedFrame>();

  /// Session start timestamp
  int? _sessionStartTimestamp;

  /// Frame index counter
  int _frameIndex = 0;

  /// Get all recorded frames
  List<RecordedFrame> get frames => _frames.toList();

  /// Start recording a new session
  void startRecording({
    required String sessionId,
    required String userId,
    required String exerciseType,
    DeviceInfo? deviceInfo,
    CameraConfigInfo? cameraConfig,
  }) {
    if (state.isRecording) {
      debugPrint('SessionRecorder: Already recording, ignoring start');
      return;
    }

    _frames.clear();
    _frameIndex = 0;
    _sessionStartTimestamp = DateTime.now().millisecondsSinceEpoch;

    final metadata = SessionMetadata(
      sessionId: sessionId,
      userId: userId,
      exerciseType: exerciseType,
      startTime: DateTime.now(),
      deviceInfo: deviceInfo,
      cameraConfig: cameraConfig,
    );

    state = SessionRecorderState(
      recordingState: RecordingState.recording,
      metadata: metadata,
      frameCount: 0,
      droppedFrameCount: 0,
    );

    debugPrint('SessionRecorder: Started recording session $sessionId');
  }

  /// Record a pose frame
  void recordFrame(PoseFrame pose) {
    if (!state.isRecording) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final timestamp = now - (_sessionStartTimestamp ?? now);

    // Convert landmarks (only store reliable ones)
    final landmarks = <PoseLandmarkType, RecordedLandmark>{};
    for (final entry in pose.landmarks.entries) {
      if (entry.value.meetsMinimumThreshold) {
        landmarks[entry.key] = RecordedLandmark.fromPoseLandmark(entry.value);
      }
    }

    final frame = RecordedFrame(
      frameIndex: _frameIndex++,
      timestamp: timestamp,
      landmarks: landmarks,
      processingTimeMs: pose.processingTimeMs ?? 0,
      overallConfidence: pose.overallConfidence,
    );

    // Add to buffer, remove oldest if full
    _frames.addLast(frame);
    if (_frames.length > kMaxFramesInMemory) {
      _frames.removeFirst();
    }

    state = state.copyWith(
      frameCount: state.frameCount + 1,
      lastFrameTimestamp: timestamp,
    );
  }

  /// Record a dropped frame
  void recordDroppedFrame() {
    if (!state.isRecording) return;

    state = state.copyWith(
      droppedFrameCount: state.droppedFrameCount + 1,
    );
  }

  /// Pause recording
  void pauseRecording() {
    if (!state.isRecording) return;

    state = state.copyWith(
      recordingState: RecordingState.paused,
    );

    debugPrint('SessionRecorder: Recording paused');
  }

  /// Resume recording
  void resumeRecording() {
    if (!state.isPaused) return;

    state = state.copyWith(
      recordingState: RecordingState.recording,
    );

    debugPrint('SessionRecorder: Recording resumed');
  }

  /// Stop recording and finalize session
  void stopRecording({double? averageFps}) {
    if (state.recordingState == RecordingState.idle) return;

    final updatedMetadata = state.metadata?.copyWith(
      endTime: DateTime.now(),
      averageFps: averageFps,
      totalFrames: state.frameCount,
      droppedFrames: state.droppedFrameCount,
    );

    state = state.copyWith(
      recordingState: RecordingState.completed,
      metadata: updatedMetadata,
    );

    debugPrint(
      'SessionRecorder: Recording stopped. '
      'Frames: ${state.frameCount}, Dropped: ${state.droppedFrameCount}',
    );
  }

  /// Clear all recorded data
  void clear() {
    _frames.clear();
    _frameIndex = 0;
    _sessionStartTimestamp = null;

    state = const SessionRecorderState();

    debugPrint('SessionRecorder: Cleared');
  }

  /// Export session data for upload
  Map<String, dynamic> exportSession() {
    if (state.metadata == null) {
      throw StateError('No session metadata available');
    }

    return {
      'metadata': state.metadata!.toJson(),
      'frames': _frames.map((f) => f.toJson()).toList(),
    };
  }

  /// Get frames within a time range
  List<RecordedFrame> getFramesInRange(int startMs, int endMs) {
    return _frames
        .where((f) => f.timestamp >= startMs && f.timestamp <= endMs)
        .toList();
  }

  /// Get the latest N frames
  List<RecordedFrame> getLatestFrames(int count) {
    final frameList = _frames.toList();
    if (frameList.length <= count) return frameList;
    return frameList.sublist(frameList.length - count);
  }
}
