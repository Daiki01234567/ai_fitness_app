/// Bicep Curl Form Analyzer
///
/// Analyzes bicep curl (arm curl) form using MediaPipe pose landmarks.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Key evaluation points:
/// - Elbow angle range (30-160°)
/// - Elbow position fixed (no swing)
/// - Shoulder stability (no raising)
/// - Momentum/swinging detection
/// - Wrist angle maintenance
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Bicep curl specific configuration
class BicepCurlConfig {
  const BicepCurlConfig({
    this.minElbowAngle = 30.0,
    this.maxElbowAngle = 160.0,
    this.targetMinAngle = 40.0,
    this.targetMaxAngle = 150.0,
    this.elbowSwingThreshold = 0.03,
    this.shoulderRaiseThreshold = 0.02,
    this.momentumThreshold = 200.0,
    this.symmetryThreshold = 0.85,
    this.downPhaseAngle = 120.0,
    this.bottomPhaseAngle = 50.0,
    this.upPhaseAngle = 140.0,
    this.detectBothArms = true,
  });

  /// Minimum elbow angle (fully contracted)
  final double minElbowAngle;

  /// Maximum elbow angle (fully extended)
  final double maxElbowAngle;

  /// Target minimum angle for good form
  final double targetMinAngle;

  /// Target maximum angle for good form
  final double targetMaxAngle;

  /// Threshold for elbow swing detection
  final double elbowSwingThreshold;

  /// Threshold for shoulder raising detection
  final double shoulderRaiseThreshold;

  /// Threshold for momentum/swinging detection (velocity)
  final double momentumThreshold;

  /// Threshold for left-right symmetry
  final double symmetryThreshold;

  /// Angle threshold for down phase
  final double downPhaseAngle;

  /// Angle threshold for bottom (contracted) phase
  final double bottomPhaseAngle;

  /// Angle threshold for up phase
  final double upPhaseAngle;

  /// Whether to detect both arms simultaneously
  final bool detectBothArms;

  static const defaultConfig = BicepCurlConfig();
}

/// Bicep curl form analyzer implementation
class BicepCurlAnalyzer extends BaseFormAnalyzer {
  BicepCurlAnalyzer({
    super.config,
    BicepCurlConfig? curlConfig,
  }) : curlConfig = curlConfig ?? const BicepCurlConfig();

  /// Curl-specific configuration
  final BicepCurlConfig curlConfig;

  /// Initial elbow X position for swing detection
  double? _leftElbowInitialX;
  double? _rightElbowInitialX;

  /// Initial shoulder Y position for raise detection
  double? _leftShoulderInitialY;
  double? _rightShoulderInitialY;

  /// Track which arm is being used
  bool _leftArmActive = true;
  bool _rightArmActive = true;

  @override
  ExerciseType get exerciseType => ExerciseType.armCurl;

  @override
  Map<String, double> get phaseThresholds => {
        'down': curlConfig.downPhaseAngle,
        'bottom': curlConfig.bottomPhaseAngle,
        'up': curlConfig.upPhaseAngle,
      };

  @override
  FrameEvaluationResult evaluateFrame(PoseFrame frame) {
    final issues = <FormIssue>[];
    final jointAngles = <String, double>{};
    var score = 100.0;

    // Get landmarks
    final leftShoulder = frame.getLandmark(PoseLandmarkType.leftShoulder);
    final rightShoulder = frame.getLandmark(PoseLandmarkType.rightShoulder);
    final leftElbow = frame.getLandmark(PoseLandmarkType.leftElbow);
    final rightElbow = frame.getLandmark(PoseLandmarkType.rightElbow);
    final leftWrist = frame.getLandmark(PoseLandmarkType.leftWrist);
    final rightWrist = frame.getLandmark(PoseLandmarkType.rightWrist);
    // Note: Hip landmarks are retrieved for future use in body stability analysis
    // but currently not actively used in the evaluation
    frame.getLandmark(PoseLandmarkType.leftHip);
    frame.getLandmark(PoseLandmarkType.rightHip);

    // Initialize reference positions on first frame
    _initializeReferencePositions(
      leftElbow: leftElbow,
      rightElbow: rightElbow,
      leftShoulder: leftShoulder,
      rightShoulder: rightShoulder,
    );

    // 1. Calculate elbow angles
    final leftElbowAngle = _calculateElbowAngle(
      leftShoulder,
      leftElbow,
      leftWrist,
    );
    final rightElbowAngle = _calculateElbowAngle(
      rightShoulder,
      rightElbow,
      rightWrist,
    );

    // Detect which arms are being used
    _detectActiveArms(leftElbowAngle, rightElbowAngle);

    if (leftElbowAngle != null && _leftArmActive) {
      jointAngles['leftElbow'] =
          getFilter('leftElbow').filter(leftElbowAngle);
    }
    if (rightElbowAngle != null && _rightArmActive) {
      jointAngles['rightElbow'] =
          getFilter('rightElbow').filter(rightElbowAngle);
    }

    // 2. Evaluate range of motion
    final avgElbowAngle = _getAverageElbowAngle(jointAngles);
    if (avgElbowAngle != null) {
      final (romScore, romIssue) = _evaluateRangeOfMotion(avgElbowAngle);
      score -= (100 - romScore) * 0.35; // 35% weight
      if (romIssue != null) issues.add(romIssue);
    }

    // 3. Check elbow position (swing)
    if (_leftArmActive && leftElbow != null) {
      final (swingScore, swingIssue) = _evaluateElbowSwing(leftElbow, 'left');
      score -= (100 - swingScore) * 0.15;
      if (swingIssue != null) issues.add(swingIssue);
    }
    if (_rightArmActive && rightElbow != null) {
      final (swingScore, swingIssue) = _evaluateElbowSwing(rightElbow, 'right');
      score -= (100 - swingScore) * 0.15;
      if (swingIssue != null) issues.add(swingIssue);
    }

    // 4. Check shoulder position
    if (_leftArmActive && leftShoulder != null) {
      final (shoulderScore, shoulderIssue) =
          _evaluateShoulderPosition(leftShoulder, 'left');
      score -= (100 - shoulderScore) * 0.1;
      if (shoulderIssue != null) issues.add(shoulderIssue);
    }
    if (_rightArmActive && rightShoulder != null) {
      final (shoulderScore, shoulderIssue) =
          _evaluateShoulderPosition(rightShoulder, 'right');
      score -= (100 - shoulderScore) * 0.1;
      if (shoulderIssue != null) issues.add(shoulderIssue);
    }

    // 5. Check for momentum/swinging
    if (avgElbowAngle != null) {
      final (momentumScore, momentumIssue) = _evaluateMomentum(
        avgElbowAngle,
        frame.timestamp,
      );
      score -= (100 - momentumScore) * 0.15;
      if (momentumIssue != null) issues.add(momentumIssue);
    }

    // 6. Check symmetry (if both arms active)
    if (_leftArmActive &&
        _rightArmActive &&
        curlConfig.detectBothArms &&
        jointAngles['leftElbow'] != null &&
        jointAngles['rightElbow'] != null) {
      final (symmetryScore, symmetryIssue) = _evaluateSymmetry(
        jointAngles['leftElbow']!,
        jointAngles['rightElbow']!,
      );
      score -= (100 - symmetryScore) * 0.1;
      if (symmetryIssue != null) issues.add(symmetryIssue);
    }

    score = score.clamp(0.0, 100.0);

    return FrameEvaluationResult(
      timestamp: frame.timestamp,
      score: score,
      level: FeedbackLevelExtension.fromScore(score),
      issues: issues,
      jointAngles: jointAngles,
    );
  }

  @override
  ExercisePhase determinePhase(PoseFrame frame, FrameEvaluationResult result) {
    final avgElbowAngle = _getAverageElbowAngle(result.jointAngles);
    if (avgElbowAngle == null) return currentPhase;

    final smoothedAngle = getFilter('phaseAngle').filter(avgElbowAngle);
    final velocity = getVelocityCalc('elbowAngle')
        .calculateVelocity(smoothedAngle, frame.timestamp);

    switch (currentPhase) {
      case ExercisePhase.start:
      case ExercisePhase.bottom:
        // Start going up (curling) if angle decreases
        if (smoothedAngle < phaseThresholds['down']! &&
            (velocity == null || velocity < -10)) {
          return ExercisePhase.up;
        }
        return currentPhase == ExercisePhase.start
            ? ExercisePhase.start
            : ExercisePhase.bottom;

      case ExercisePhase.up:
        // Reached top if angle is low enough
        if (smoothedAngle <= phaseThresholds['bottom']!) {
          return ExercisePhase.top;
        }
        // Started going down before reaching top
        if (velocity != null && velocity > 10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.up;

      case ExercisePhase.top:
        // Start going down if angle increases
        if (velocity != null && velocity > 10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.top;

      case ExercisePhase.down:
        // Reached bottom if angle is high enough
        if (smoothedAngle >= phaseThresholds['up']!) {
          return ExercisePhase.bottom;
        }
        // Started going up before reaching bottom
        if (velocity != null && velocity < -10) {
          return ExercisePhase.up;
        }
        return ExercisePhase.down;

      default:
        return ExercisePhase.start;
    }
  }

  /// Initialize reference positions for swing/raise detection
  void _initializeReferencePositions({
    PoseLandmark? leftElbow,
    PoseLandmark? rightElbow,
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
  }) {
    if (_leftElbowInitialX == null && leftElbow?.meetsMinimumThreshold == true) {
      _leftElbowInitialX = leftElbow!.x;
    }
    if (_rightElbowInitialX == null && rightElbow?.meetsMinimumThreshold == true) {
      _rightElbowInitialX = rightElbow!.x;
    }
    if (_leftShoulderInitialY == null && leftShoulder?.meetsMinimumThreshold == true) {
      _leftShoulderInitialY = leftShoulder!.y;
    }
    if (_rightShoulderInitialY == null && rightShoulder?.meetsMinimumThreshold == true) {
      _rightShoulderInitialY = rightShoulder!.y;
    }
  }

  /// Calculate elbow angle
  double? _calculateElbowAngle(
    PoseLandmark? shoulder,
    PoseLandmark? elbow,
    PoseLandmark? wrist,
  ) {
    if (shoulder == null || elbow == null || wrist == null) return null;
    if (!shoulder.meetsMinimumThreshold ||
        !elbow.meetsMinimumThreshold ||
        !wrist.meetsMinimumThreshold) {
      return null;
    }
    return FormMathUtils.calculateAngle3Points(shoulder, elbow, wrist);
  }

  /// Detect which arms are active based on movement
  void _detectActiveArms(double? leftAngle, double? rightAngle) {
    // For simplicity, assume both arms are active if both are visible
    // A more sophisticated version would track movement to detect single-arm curls
    _leftArmActive = leftAngle != null;
    _rightArmActive = rightAngle != null;
  }

  /// Get average elbow angle
  double? _getAverageElbowAngle(Map<String, double> jointAngles) {
    final left = jointAngles['leftElbow'];
    final right = jointAngles['rightElbow'];

    if (left != null && right != null) {
      return (left + right) / 2;
    }
    return left ?? right;
  }

  /// Evaluate range of motion
  (double, FormIssue?) _evaluateRangeOfMotion(double angle) {
    // During curl up phase, check for full contraction
    if (currentPhase == ExercisePhase.top ||
        currentPhase == ExercisePhase.up) {
      if (angle > curlConfig.targetMinAngle + 20) {
        final deduction = (angle - curlConfig.targetMinAngle - 20) / 2;
        return (
          (100 - deduction).clamp(60.0, 100.0),
          FormIssue(
            issueType: 'incomplete_curl',
            message: 'もう少し上まで持ち上げてください',
            priority: FeedbackPriority.medium,
            suggestion: '上腕二頭筋をしっかり収縮させてください',
            affectedBodyPart: 'elbow',
            currentValue: angle,
            targetValue: curlConfig.targetMinAngle,
            deduction: deduction,
          ),
        );
      }
    }

    // During curl down phase, check for full extension
    if (currentPhase == ExercisePhase.bottom ||
        currentPhase == ExercisePhase.down) {
      if (angle < curlConfig.targetMaxAngle - 20) {
        final deduction = (curlConfig.targetMaxAngle - 20 - angle) / 2;
        return (
          (100 - deduction).clamp(70.0, 100.0),
          FormIssue(
            issueType: 'incomplete_extension',
            message: '腕をもう少し伸ばしてください',
            priority: FeedbackPriority.low,
            suggestion: '完全に腕を伸ばしてから次のレップを始めてください',
            affectedBodyPart: 'elbow',
            currentValue: angle,
            targetValue: curlConfig.targetMaxAngle,
            deduction: deduction,
          ),
        );
      }
    }

    return (100.0, null);
  }

  /// Evaluate elbow swing (elbow should stay fixed)
  (double, FormIssue?) _evaluateElbowSwing(PoseLandmark elbow, String side) {
    final initialX = side == 'left' ? _leftElbowInitialX : _rightElbowInitialX;
    if (initialX == null) return (100.0, null);

    final swing = (elbow.x - initialX).abs();

    if (swing <= curlConfig.elbowSwingThreshold) {
      return (100.0, null);
    }

    final deduction = (swing - curlConfig.elbowSwingThreshold) * 500;
    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: 'elbow_swing_$side',
        message: side == 'left' ? '左肘が動いています' : '右肘が動いています',
        priority: FeedbackPriority.high,
        suggestion: '肘を体側に固定したまま行ってください',
        affectedBodyPart: '${side}_elbow',
        currentValue: swing,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate shoulder position (should not raise)
  (double, FormIssue?) _evaluateShoulderPosition(
    PoseLandmark shoulder,
    String side,
  ) {
    final initialY =
        side == 'left' ? _leftShoulderInitialY : _rightShoulderInitialY;
    if (initialY == null) return (100.0, null);

    // Negative means shoulder raised (Y axis inverted in image coordinates)
    final raise = initialY - shoulder.y;

    if (raise <= curlConfig.shoulderRaiseThreshold) {
      return (100.0, null);
    }

    final deduction = (raise - curlConfig.shoulderRaiseThreshold) * 500;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'shoulder_raise_$side',
        message: side == 'left' ? '左肩が上がっています' : '右肩が上がっています',
        priority: FeedbackPriority.medium,
        suggestion: '肩を下げてリラックスしてください',
        affectedBodyPart: '${side}_shoulder',
        currentValue: raise,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate momentum usage
  (double, FormIssue?) _evaluateMomentum(double angle, int timestamp) {
    final velocity =
        getVelocityCalc('momentum').calculateVelocity(angle, timestamp);

    if (velocity == null || velocity.abs() <= curlConfig.momentumThreshold) {
      return (100.0, null);
    }

    final deduction = (velocity.abs() - curlConfig.momentumThreshold) / 10;
    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: 'using_momentum',
        message: '反動を使っています',
        priority: FeedbackPriority.high,
        suggestion: 'ゆっくりコントロールして行ってください',
        affectedBodyPart: 'arm',
        currentValue: velocity.abs(),
        targetValue: curlConfig.momentumThreshold,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate symmetry between arms
  (double, FormIssue?) _evaluateSymmetry(double leftAngle, double rightAngle) {
    final symmetry = FormMathUtils.calculateSymmetry(leftAngle, rightAngle);

    if (symmetry >= curlConfig.symmetryThreshold) {
      return (100.0, null);
    }

    final deduction = (curlConfig.symmetryThreshold - symmetry) * 100;
    return (
      (100 - deduction).clamp(70.0, 100.0),
      FormIssue(
        issueType: 'asymmetric_curl',
        message: '左右のタイミングがずれています',
        priority: FeedbackPriority.low,
        suggestion: '両腕を同時に動かしてください',
        affectedBodyPart: 'arms',
        currentValue: symmetry,
        targetValue: curlConfig.symmetryThreshold,
        deduction: deduction,
      ),
    );
  }

  @override
  void reset() {
    super.reset();
    _leftElbowInitialX = null;
    _rightElbowInitialX = null;
    _leftShoulderInitialY = null;
    _rightShoulderInitialY = null;
  }
}
