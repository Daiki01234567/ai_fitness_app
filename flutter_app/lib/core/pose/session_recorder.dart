/// セッションレコーダー
///
/// トレーニングセッション中の姿勢検出データを記録します。
/// フレームデータ、メタデータ、およびアップロード用バッチ準備を処理します。
/// 参照: docs/specs/08_README_form_validation_logic_v3_3.md
library;

import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'pose_data.dart';
import 'pose_landmark_type.dart';

/// メモリに保持する最大フレーム数
const int kMaxFramesInMemory = 1800; // 30fpsで約60秒

/// セッション記録状態
enum RecordingState {
  /// 記録していない
  idle,

  /// 現在記録中
  recording,

  /// 記録一時停止
  paused,

  /// 記録完了、エクスポート準備完了
  completed,
}

/// 記録されたフレームデータ
class RecordedFrame {
  const RecordedFrame({
    required this.frameIndex,
    required this.timestamp,
    required this.landmarks,
    required this.processingTimeMs,
    required this.overallConfidence,
  });

  /// セッション内のフレームインデックス
  final int frameIndex;

  /// セッション開始からのタイムスタンプ（ミリ秒）
  final int timestamp;

  /// ランドマークデータ（信頼できるランドマークのみ保存）
  final Map<PoseLandmarkType, RecordedLandmark> landmarks;

  /// このフレームの処理時間（ミリ秒）
  final int processingTimeMs;

  /// このフレームの全体信頼度スコア
  final double overallConfidence;

  /// 保存/アップロード用にJSONに変換
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

  /// JSONから作成
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

/// 記録されたランドマークデータ（コンパクト形式）
class RecordedLandmark {
  const RecordedLandmark({
    required this.x,
    required this.y,
    required this.z,
    required this.likelihood,
  });

  /// X座標（正規化 0-1）
  final double x;

  /// Y座標（正規化 0-1）
  final double y;

  /// Z座標（深度）
  final double z;

  /// 信頼度スコア
  final double likelihood;

  /// JSONに変換
  Map<String, dynamic> toJson() {
    return {
      'x': x,
      'y': y,
      'z': z,
      'l': likelihood,
    };
  }

  /// JSONから作成
  factory RecordedLandmark.fromJson(Map<String, dynamic> json) {
    return RecordedLandmark(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      z: (json['z'] as num).toDouble(),
      likelihood: (json['l'] as num).toDouble(),
    );
  }

  /// PoseLandmarkから作成
  factory RecordedLandmark.fromPoseLandmark(PoseLandmark landmark) {
    return RecordedLandmark(
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      likelihood: landmark.likelihood,
    );
  }
}

/// セッションメタデータ
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

  /// 一意のセッション識別子
  final String sessionId;

  /// ユーザー識別子
  final String userId;

  /// 実行中のエクササイズの種類
  final String exerciseType;

  /// セッション開始時刻
  final DateTime startTime;

  /// セッション終了時刻
  final DateTime? endTime;

  /// デバイス情報
  final DeviceInfo? deviceInfo;

  /// 使用されたカメラ設定
  final CameraConfigInfo? cameraConfig;

  /// セッション中の平均FPS
  final double? averageFps;

  /// 記録された総フレーム数
  final int? totalFrames;

  /// ドロップされたフレーム数
  final int? droppedFrames;

  /// セッション継続時間（ミリ秒）
  int? get durationMs {
    if (endTime == null) return null;
    return endTime!.difference(startTime).inMilliseconds;
  }

  /// JSONに変換
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

  /// 更新されたコピーを作成
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

/// デバイス情報
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

/// カメラ設定情報
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

/// セッションレコーダー状態
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

/// セッションレコーダープロバイダー
final sessionRecorderProvider =
    StateNotifierProvider<SessionRecorderNotifier, SessionRecorderState>((ref) {
  return SessionRecorderNotifier();
});

/// セッションレコーダーNotifier
class SessionRecorderNotifier extends StateNotifier<SessionRecorderState> {
  SessionRecorderNotifier() : super(const SessionRecorderState());

  /// 記録されたフレーム（循環バッファ）
  final Queue<RecordedFrame> _frames = Queue<RecordedFrame>();

  /// セッション開始タイムスタンプ
  int? _sessionStartTimestamp;

  /// フレームインデックスカウンター
  int _frameIndex = 0;

  /// 記録されたすべてのフレームを取得
  List<RecordedFrame> get frames => _frames.toList();

  /// 新しいセッションの記録を開始
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

  /// 姿勢フレームを記録
  void recordFrame(PoseFrame pose) {
    if (!state.isRecording) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final timestamp = now - (_sessionStartTimestamp ?? now);

    // ランドマークを変換（信頼できるものだけを保存）
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

    // バッファに追加、満杯の場合は最古を削除
    _frames.addLast(frame);
    if (_frames.length > kMaxFramesInMemory) {
      _frames.removeFirst();
    }

    state = state.copyWith(
      frameCount: state.frameCount + 1,
      lastFrameTimestamp: timestamp,
    );
  }

  /// ドロップされたフレームを記録
  void recordDroppedFrame() {
    if (!state.isRecording) return;

    state = state.copyWith(
      droppedFrameCount: state.droppedFrameCount + 1,
    );
  }

  /// 記録を一時停止
  void pauseRecording() {
    if (!state.isRecording) return;

    state = state.copyWith(
      recordingState: RecordingState.paused,
    );

    debugPrint('SessionRecorder: Recording paused');
  }

  /// 記録を再開
  void resumeRecording() {
    if (!state.isPaused) return;

    state = state.copyWith(
      recordingState: RecordingState.recording,
    );

    debugPrint('SessionRecorder: Recording resumed');
  }

  /// 記録を停止しセッションを終了
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

  /// すべての記録データをクリア
  void clear() {
    _frames.clear();
    _frameIndex = 0;
    _sessionStartTimestamp = null;

    state = const SessionRecorderState();

    debugPrint('SessionRecorder: Cleared');
  }

  /// アップロード用にセッションデータをエクスポート
  Map<String, dynamic> exportSession() {
    if (state.metadata == null) {
      throw StateError('No session metadata available');
    }

    return {
      'metadata': state.metadata!.toJson(),
      'frames': _frames.map((f) => f.toJson()).toList(),
    };
  }

  /// 時間範囲内のフレームを取得
  List<RecordedFrame> getFramesInRange(int startMs, int endMs) {
    return _frames
        .where((f) => f.timestamp >= startMs && f.timestamp <= endMs)
        .toList();
  }

  /// 最新のNフレームを取得
  List<RecordedFrame> getLatestFrames(int count) {
    final frameList = _frames.toList();
    if (frameList.length <= count) return frameList;
    return frameList.sublist(frameList.length - count);
  }
}
