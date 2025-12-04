/// Feedback Manager Service
///
/// Manages real-time feedback delivery during exercise sessions.
/// Reference: docs/specs/00_要件定義書_v3_3.md (FR-005)
///
/// Key features:
/// - Text-to-Speech feedback with "参考:" prefix (legal requirement)
/// - 3-second minimum interval between voice feedback
/// - Priority-based feedback queue
/// - Visual feedback overlay management
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'dart:async';
import 'dart:collection';

import '../models/form_feedback.dart';

/// Abstract interface for Text-to-Speech functionality
abstract class TtsService {
  /// Initialize TTS engine
  Future<void> initialize();

  /// Speak the given text
  Future<void> speak(String text);

  /// Stop any ongoing speech
  Future<void> stop();

  /// Set speech rate (0.5 - 2.0)
  Future<void> setRate(double rate);

  /// Set volume (0.0 - 1.0)
  Future<void> setVolume(double volume);

  /// Check if TTS is available
  Future<bool> isAvailable();

  /// Dispose resources
  Future<void> dispose();
}

/// Feedback delivery configuration
class FeedbackConfig {
  const FeedbackConfig({
    this.voiceFeedbackEnabled = true,
    this.visualFeedbackEnabled = true,
    this.minFeedbackInterval = const Duration(seconds: 3),
    this.maxQueueSize = 10,
    this.speechRate = 1.0,
    this.volume = 1.0,
    this.priorityThreshold = FeedbackPriority.medium,
  });

  /// Whether voice feedback is enabled
  final bool voiceFeedbackEnabled;

  /// Whether visual feedback is enabled
  final bool visualFeedbackEnabled;

  /// Minimum interval between voice feedback
  final Duration minFeedbackInterval;

  /// Maximum number of pending feedback items
  final int maxQueueSize;

  /// Speech rate (0.5 - 2.0)
  final double speechRate;

  /// Volume (0.0 - 1.0)
  final double volume;

  /// Minimum priority for voice feedback
  final FeedbackPriority priorityThreshold;

  FeedbackConfig copyWith({
    bool? voiceFeedbackEnabled,
    bool? visualFeedbackEnabled,
    Duration? minFeedbackInterval,
    int? maxQueueSize,
    double? speechRate,
    double? volume,
    FeedbackPriority? priorityThreshold,
  }) {
    return FeedbackConfig(
      voiceFeedbackEnabled: voiceFeedbackEnabled ?? this.voiceFeedbackEnabled,
      visualFeedbackEnabled:
          visualFeedbackEnabled ?? this.visualFeedbackEnabled,
      minFeedbackInterval: minFeedbackInterval ?? this.minFeedbackInterval,
      maxQueueSize: maxQueueSize ?? this.maxQueueSize,
      speechRate: speechRate ?? this.speechRate,
      volume: volume ?? this.volume,
      priorityThreshold: priorityThreshold ?? this.priorityThreshold,
    );
  }
}

/// Feedback item with priority and timing information
class FeedbackItem {
  FeedbackItem({
    required this.issue,
    required this.timestamp,
    this.delivered = false,
  });

  final FormIssue issue;
  final DateTime timestamp;
  bool delivered;

  /// Get the voice message with required prefix
  /// Legal requirement: Must prefix with "参考:" (reference)
  String get voiceMessage => '参考: ${issue.message}';

  /// Get visual display message
  String get visualMessage => issue.message;
}

/// Callback for visual feedback updates
typedef VisualFeedbackCallback = void Function(List<FormIssue> currentIssues);

/// Callback for rep completion
typedef RepCompletedCallback = void Function(int repNumber, double score);

/// Manages feedback delivery during exercise sessions
class FeedbackManager {
  FeedbackManager({this.ttsService, FeedbackConfig? config})
    : config = config ?? const FeedbackConfig();

  /// TTS service (optional - can be null for visual-only feedback)
  final TtsService? ttsService;

  /// Configuration
  FeedbackConfig config;

  /// Priority queue for pending feedback
  final Queue<FeedbackItem> _feedbackQueue = Queue<FeedbackItem>();

  /// Last voice feedback time
  DateTime? _lastVoiceFeedbackTime;

  /// Current issues being displayed
  final List<FormIssue> _currentIssues = [];

  /// Recently spoken issue types (to avoid repetition)
  final Map<String, DateTime> _recentlySpoken = {};

  /// Timer for processing feedback queue
  Timer? _queueTimer;

  /// Visual feedback callback
  VisualFeedbackCallback? onVisualFeedbackUpdate;

  /// Rep completed callback
  RepCompletedCallback? onRepCompleted;

  /// Whether the manager is initialized
  bool _initialized = false;

  /// Whether the manager is active
  bool _active = false;

  /// Initialize the feedback manager
  Future<void> initialize() async {
    if (_initialized) return;

    if (ttsService != null) {
      await ttsService!.initialize();
      await ttsService!.setRate(config.speechRate);
      await ttsService!.setVolume(config.volume);
    }

    _initialized = true;
  }

  /// Start processing feedback
  void start() {
    if (!_initialized) {
      throw StateError(
        'FeedbackManager not initialized. Call initialize() first.',
      );
    }

    _active = true;
    _startQueueTimer();
  }

  /// Stop processing feedback
  Future<void> stop() async {
    _active = false;
    _queueTimer?.cancel();
    _queueTimer = null;

    if (ttsService != null) {
      await ttsService!.stop();
    }

    _feedbackQueue.clear();
    _currentIssues.clear();
    _recentlySpoken.clear();
  }

  /// Process frame evaluation result
  void processFrameResult(FrameEvaluationResult result) {
    if (!_active) return;

    // Update visual feedback
    _updateVisualFeedback(result.issues);

    // Queue voice feedback for high-priority issues
    for (final issue in result.issues) {
      if (_shouldQueueForVoice(issue)) {
        _queueFeedback(issue);
      }
    }
  }

  /// Notify rep completion
  void notifyRepCompleted(int repNumber, double score) {
    if (!_active) return;

    onRepCompleted?.call(repNumber, score);

    // Queue voice feedback for rep completion
    if (config.voiceFeedbackEnabled) {
      final message = _getRepCompletionMessage(repNumber, score);
      _queueCustomVoiceFeedback(message, FeedbackPriority.low);
    }
  }

  /// Update configuration
  Future<void> updateConfig(FeedbackConfig newConfig) async {
    config = newConfig;

    if (ttsService != null) {
      await ttsService!.setRate(config.speechRate);
      await ttsService!.setVolume(config.volume);
    }
  }

  /// Dispose resources
  Future<void> dispose() async {
    await stop();

    if (ttsService != null) {
      await ttsService!.dispose();
    }

    _initialized = false;
  }

  /// Update visual feedback display
  void _updateVisualFeedback(List<FormIssue> issues) {
    if (!config.visualFeedbackEnabled) return;

    _currentIssues.clear();
    _currentIssues.addAll(issues);

    onVisualFeedbackUpdate?.call(List.unmodifiable(_currentIssues));
  }

  /// Check if issue should be queued for voice feedback
  bool _shouldQueueForVoice(FormIssue issue) {
    if (!config.voiceFeedbackEnabled) return false;

    // Check priority threshold
    // Lower index = higher priority (critical=0, high=1, medium=2, low=3)
    // Only queue if issue priority is at least as high as threshold
    if (issue.priority.index > config.priorityThreshold.index) {
      return false;
    }

    // Check if recently spoken
    final lastSpoken = _recentlySpoken[issue.issueType];
    if (lastSpoken != null) {
      final elapsed = DateTime.now().difference(lastSpoken);
      // Don't repeat same issue type within 10 seconds
      if (elapsed.inSeconds < 10) {
        return false;
      }
    }

    return true;
  }

  /// Queue feedback for voice delivery
  void _queueFeedback(FormIssue issue) {
    // Check queue size limit
    if (_feedbackQueue.length >= config.maxQueueSize) {
      // Remove lowest priority item
      _removeLowPriorityItem();
    }

    _feedbackQueue.add(FeedbackItem(issue: issue, timestamp: DateTime.now()));
  }

  /// Queue custom voice feedback message
  void _queueCustomVoiceFeedback(String message, FeedbackPriority priority) {
    final customIssue = FormIssue(
      issueType: 'custom_feedback',
      message: message,
      priority: priority,
      suggestion: '',
      affectedBodyPart: '',
      currentValue: 0,
      targetValue: 0,
      deduction: 0,
    );

    _queueFeedback(customIssue);
  }

  /// Remove lowest priority item from queue
  void _removeLowPriorityItem() {
    if (_feedbackQueue.isEmpty) return;

    FeedbackItem? lowestPriority;
    for (final item in _feedbackQueue) {
      // Higher index = lower priority (critical=0, high=1, medium=2, low=3)
      if (lowestPriority == null ||
          item.issue.priority.index > lowestPriority.issue.priority.index) {
        lowestPriority = item;
      }
    }

    if (lowestPriority != null) {
      _feedbackQueue.remove(lowestPriority);
    }
  }

  /// Start timer for processing feedback queue
  void _startQueueTimer() {
    _queueTimer?.cancel();
    _queueTimer = Timer.periodic(
      const Duration(milliseconds: 500),
      (_) => _processQueue(),
    );
  }

  /// Process the feedback queue
  Future<void> _processQueue() async {
    if (!_active || _feedbackQueue.isEmpty) return;

    // Check minimum interval
    if (_lastVoiceFeedbackTime != null) {
      final elapsed = DateTime.now().difference(_lastVoiceFeedbackTime!);
      if (elapsed < config.minFeedbackInterval) {
        return;
      }
    }

    // Get highest priority undelivered item
    final item = _getHighestPriorityItem();
    if (item == null) return;

    // Deliver voice feedback
    await _deliverVoiceFeedback(item);
  }

  /// Get highest priority undelivered item
  FeedbackItem? _getHighestPriorityItem() {
    FeedbackItem? highest;
    for (final item in _feedbackQueue) {
      if (!item.delivered) {
        // Lower index = higher priority (critical=0, high=1, medium=2, low=3)
        if (highest == null ||
            item.issue.priority.index < highest.issue.priority.index) {
          highest = item;
        }
      }
    }
    return highest;
  }

  /// Deliver voice feedback
  Future<void> _deliverVoiceFeedback(FeedbackItem item) async {
    if (ttsService == null) return;

    try {
      await ttsService!.speak(item.voiceMessage);
      item.delivered = true;
      _lastVoiceFeedbackTime = DateTime.now();
      _recentlySpoken[item.issue.issueType] = DateTime.now();

      // Remove delivered items
      _feedbackQueue.removeWhere((i) => i.delivered);
    } catch (e) {
      // Log error but don't crash
      // TODO: Add proper logging
    }
  }

  /// Get rep completion message based on score
  String _getRepCompletionMessage(int repNumber, double score) {
    if (score >= 90) {
      return '$repNumber回目、とても良いフォームです';
    } else if (score >= 70) {
      return '$repNumber回目、良いペースです';
    } else if (score >= 50) {
      return '$repNumber回目、フォームを確認してください';
    } else {
      return '$repNumber回目、ゆっくりとフォームを意識してください';
    }
  }

  /// Get current visual feedback issues
  List<FormIssue> get currentIssues => List.unmodifiable(_currentIssues);

  /// Check if voice feedback is available
  bool get isVoiceAvailable => ttsService != null && _initialized;

  /// Check if manager is active
  bool get isActive => _active;
}

/// Mock TTS service for testing
class MockTtsService implements TtsService {
  final List<String> spokenTexts = [];
  bool _initialized = false;
  double _rate = 1.0;
  double _volume = 1.0;

  @override
  Future<void> initialize() async {
    _initialized = true;
  }

  @override
  Future<void> speak(String text) async {
    spokenTexts.add(text);
  }

  @override
  Future<void> stop() async {
    // No-op for mock
  }

  @override
  Future<void> setRate(double rate) async {
    _rate = rate;
  }

  @override
  Future<void> setVolume(double volume) async {
    _volume = volume;
  }

  @override
  Future<bool> isAvailable() async {
    return _initialized;
  }

  @override
  Future<void> dispose() async {
    _initialized = false;
  }

  double get rate => _rate;
  double get volume => _volume;
}
