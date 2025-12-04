/// Lateral Raise (Side Raise) Form Analyzer
///
/// Analyzes side raise form using MediaPipe pose landmarks.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Key evaluation points:
/// - Arm raise angle (target: 80-90°)
/// - Elbow angle (slight bend)
/// - Left-right symmetry
/// - Body sway/stability
/// - Shoulder shrug prevention
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Lateral raise specific configuration
class LateralRaiseConfig {
  const LateralRaiseConfig({
    this.targetRaiseAngle = 85.0,
    this.minRaiseAngle = 70.0,
    this.maxRaiseAngle = 100.0,
    this.optimalElbowAngle = 160.0,
    this.minElbowAngle = 140.0,
    this.maxElbowAngle = 180.0,
    this.symmetryThreshold = 0.85,
    this.bodySwayThreshold = 0.03,
    this.shoulderShrugThreshold = 0.02,
    this.downPhaseAngle = 30.0,
    this.topPhaseAngle = 70.0,
    this.upPhaseAngle = 50.0,
  });

  /// Target arm raise angle
  final double targetRaiseAngle;

  /// Minimum acceptable raise angle
  final double minRaiseAngle;

  /// Maximum raise angle (avoid going too high)
  final double maxRaiseAngle;

  /// Optimal elbow angle (slight bend)
  final double optimalElbowAngle;

  /// Minimum elbow angle
  final double minElbowAngle;

  /// Maximum elbow angle
  final double maxElbowAngle;

  /// Threshold for left-right symmetry
  final double symmetryThreshold;

  /// Threshold for body sway detection
  final double bodySwayThreshold;

  /// Threshold for shoulder shrug detection
  final double shoulderShrugThreshold;

  /// Angle threshold for down phase
  final double downPhaseAngle;

  /// Angle threshold for top phase
  final double topPhaseAngle;

  /// Angle threshold for up phase
  final double upPhaseAngle;

  static const defaultConfig = LateralRaiseConfig();
}

/// Lateral raise form analyzer implementation
class LateralRaiseAnalyzer extends BaseFormAnalyzer {
  LateralRaiseAnalyzer({super.config, LateralRaiseConfig? raiseConfig})
    : raiseConfig = raiseConfig ?? const LateralRaiseConfig();

  /// Raise-specific configuration
  final LateralRaiseConfig raiseConfig;

  /// Initial nose X position for body sway detection
  double? _noseInitialX;

  /// Initial shoulder Y positions for shrug detection
  double? _leftShoulderInitialY;
  double? _rightShoulderInitialY;

  @override
  ExerciseType get exerciseType => ExerciseType.sideRaise;

  @override
  Map<String, double> get phaseThresholds => {
    'down': raiseConfig.downPhaseAngle,
    'top': raiseConfig.topPhaseAngle,
    'up': raiseConfig.upPhaseAngle,
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
    final leftHip = frame.getLandmark(PoseLandmarkType.leftHip);
    final rightHip = frame.getLandmark(PoseLandmarkType.rightHip);
    final nose = frame.getLandmark(PoseLandmarkType.nose);

    // Initialize reference positions
    _initializeReferencePositions(
      nose: nose,
      leftShoulder: leftShoulder,
      rightShoulder: rightShoulder,
    );

    // 1. Calculate arm raise angles
    final leftRaiseAngle = _calculateArmRaiseAngle(
      leftShoulder,
      leftElbow,
      leftHip,
    );
    final rightRaiseAngle = _calculateArmRaiseAngle(
      rightShoulder,
      rightElbow,
      rightHip,
    );

    if (leftRaiseAngle != null) {
      jointAngles['leftRaise'] = getFilter('leftRaise').filter(leftRaiseAngle);
    }
    if (rightRaiseAngle != null) {
      jointAngles['rightRaise'] = getFilter(
        'rightRaise',
      ).filter(rightRaiseAngle);
    }

    // 2. Calculate elbow angles
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

    if (leftElbowAngle != null) {
      jointAngles['leftElbow'] = getFilter('leftElbow').filter(leftElbowAngle);
    }
    if (rightElbowAngle != null) {
      jointAngles['rightElbow'] = getFilter(
        'rightElbow',
      ).filter(rightElbowAngle);
    }

    // 3. Evaluate arm raise height
    final avgRaiseAngle = _getAverageRaiseAngle(jointAngles);
    if (avgRaiseAngle != null) {
      final (raiseScore, raiseIssue) = _evaluateRaiseAngle(avgRaiseAngle);
      score -= (100 - raiseScore) * 0.35;
      if (raiseIssue != null) issues.add(raiseIssue);
    }

    // 4. Evaluate elbow angle
    final avgElbowAngle = _getAverageElbowAngle(jointAngles);
    if (avgElbowAngle != null) {
      final (elbowScore, elbowIssue) = _evaluateElbowAngle(avgElbowAngle);
      score -= (100 - elbowScore) * 0.15;
      if (elbowIssue != null) issues.add(elbowIssue);
    }

    // 5. Evaluate symmetry
    if (jointAngles['leftRaise'] != null && jointAngles['rightRaise'] != null) {
      final (symmetryScore, symmetryIssue) = _evaluateSymmetry(
        jointAngles['leftRaise']!,
        jointAngles['rightRaise']!,
      );
      score -= (100 - symmetryScore) * 0.2;
      if (symmetryIssue != null) issues.add(symmetryIssue);
    }

    // 6. Evaluate body stability
    if (nose != null) {
      final (swayScore, swayIssue) = _evaluateBodySway(nose);
      score -= (100 - swayScore) * 0.15;
      if (swayIssue != null) issues.add(swayIssue);
    }

    // 7. Check for shoulder shrug
    if (leftShoulder != null) {
      final (shrugScore, shrugIssue) = _evaluateShoulderShrug(
        leftShoulder,
        'left',
      );
      score -= (100 - shrugScore) * 0.075;
      if (shrugIssue != null) issues.add(shrugIssue);
    }
    if (rightShoulder != null) {
      final (shrugScore, shrugIssue) = _evaluateShoulderShrug(
        rightShoulder,
        'right',
      );
      score -= (100 - shrugScore) * 0.075;
      if (shrugIssue != null) issues.add(shrugIssue);
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
    final avgRaiseAngle = _getAverageRaiseAngle(result.jointAngles);
    if (avgRaiseAngle == null) return currentPhase;

    final smoothedAngle = getFilter('phaseAngle').filter(avgRaiseAngle);
    final velocity = getVelocityCalc(
      'raiseAngle',
    ).calculateVelocity(smoothedAngle, frame.timestamp);

    switch (currentPhase) {
      case ExercisePhase.start:
      case ExercisePhase.bottom:
        // Start going up if angle increases
        if (smoothedAngle > phaseThresholds['up']! &&
            (velocity == null || velocity > 10)) {
          return ExercisePhase.up;
        }
        return currentPhase == ExercisePhase.start
            ? ExercisePhase.start
            : ExercisePhase.bottom;

      case ExercisePhase.up:
        // Reached top if angle is high enough
        if (smoothedAngle >= phaseThresholds['top']!) {
          return ExercisePhase.top;
        }
        // Started going down before reaching top
        if (velocity != null && velocity < -10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.up;

      case ExercisePhase.top:
        // Start going down if angle decreases
        if (velocity != null && velocity < -10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.top;

      case ExercisePhase.down:
        // Reached bottom if angle is low enough
        if (smoothedAngle <= phaseThresholds['down']!) {
          return ExercisePhase.bottom;
        }
        // Started going up before reaching bottom
        if (velocity != null && velocity > 10) {
          return ExercisePhase.up;
        }
        return ExercisePhase.down;

      default:
        return ExercisePhase.start;
    }
  }

  /// Initialize reference positions
  void _initializeReferencePositions({
    PoseLandmark? nose,
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
  }) {
    if (_noseInitialX == null && nose?.meetsMinimumThreshold == true) {
      _noseInitialX = nose!.x;
    }
    if (_leftShoulderInitialY == null &&
        leftShoulder?.meetsMinimumThreshold == true) {
      _leftShoulderInitialY = leftShoulder!.y;
    }
    if (_rightShoulderInitialY == null &&
        rightShoulder?.meetsMinimumThreshold == true) {
      _rightShoulderInitialY = rightShoulder!.y;
    }
  }

  /// Calculate arm raise angle (angle from hip to elbow relative to shoulder)
  double? _calculateArmRaiseAngle(
    PoseLandmark? shoulder,
    PoseLandmark? elbow,
    PoseLandmark? hip,
  ) {
    if (shoulder == null || elbow == null || hip == null) return null;
    if (!shoulder.meetsMinimumThreshold ||
        !elbow.meetsMinimumThreshold ||
        !hip.meetsMinimumThreshold) {
      return null;
    }
    return FormMathUtils.calculateAngle3Points(elbow, shoulder, hip);
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

  /// Get average raise angle
  double? _getAverageRaiseAngle(Map<String, double> jointAngles) {
    final left = jointAngles['leftRaise'];
    final right = jointAngles['rightRaise'];

    if (left != null && right != null) {
      return (left + right) / 2;
    }
    return left ?? right;
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

  /// Evaluate arm raise angle
  (double, FormIssue?) _evaluateRaiseAngle(double angle) {
    // Only evaluate during raise (not at rest)
    if (currentPhase == ExercisePhase.start ||
        currentPhase == ExercisePhase.bottom) {
      return (100.0, null);
    }

    // Perfect range: 80-90 degrees
    if (angle >= 80 && angle <= 90) {
      return (100.0, null);
    }

    // Good range: 70-95 degrees
    if (angle >= raiseConfig.minRaiseAngle &&
        angle <= raiseConfig.maxRaiseAngle) {
      return (90.0, null);
    }

    // Too low
    if (angle < raiseConfig.minRaiseAngle) {
      final deduction = (raiseConfig.minRaiseAngle - angle);
      return (
        (100 - deduction).clamp(50.0, 100.0),
        FormIssue(
          issueType: 'insufficient_raise',
          message: '腕をもう少し上げてください',
          priority: FeedbackPriority.medium,
          suggestion: '肩の高さまで腕を上げてください',
          affectedBodyPart: 'arms',
          currentValue: angle,
          targetValue: raiseConfig.targetRaiseAngle,
          deduction: deduction,
        ),
      );
    }

    // Too high
    if (angle > raiseConfig.maxRaiseAngle) {
      final deduction = (angle - raiseConfig.maxRaiseAngle);
      return (
        (100 - deduction).clamp(60.0, 100.0),
        FormIssue(
          issueType: 'excessive_raise',
          message: '腕を上げすぎています',
          priority: FeedbackPriority.high,
          suggestion: '肩の高さで止めてください',
          affectedBodyPart: 'arms',
          currentValue: angle,
          targetValue: raiseConfig.targetRaiseAngle,
          deduction: deduction,
        ),
      );
    }

    return (85.0, null);
  }

  /// Evaluate elbow angle
  (double, FormIssue?) _evaluateElbowAngle(double angle) {
    // Elbow should have a slight bend (not completely straight or too bent)
    if (angle >= raiseConfig.minElbowAngle &&
        angle <= raiseConfig.maxElbowAngle) {
      return (100.0, null);
    }

    // Too bent
    if (angle < raiseConfig.minElbowAngle) {
      final deduction = (raiseConfig.minElbowAngle - angle) / 2;
      return (
        (100 - deduction).clamp(60.0, 100.0),
        FormIssue(
          issueType: 'elbow_too_bent',
          message: '肘を曲げすぎています',
          priority: FeedbackPriority.medium,
          suggestion: '肘を軽く伸ばしてください',
          affectedBodyPart: 'elbow',
          currentValue: angle,
          targetValue: raiseConfig.optimalElbowAngle,
          deduction: deduction,
        ),
      );
    }

    return (90.0, null);
  }

  /// Evaluate left-right symmetry
  (double, FormIssue?) _evaluateSymmetry(double leftAngle, double rightAngle) {
    final symmetry = FormMathUtils.calculateSymmetry(leftAngle, rightAngle);

    if (symmetry >= raiseConfig.symmetryThreshold) {
      return (100.0, null);
    }

    final deduction = (raiseConfig.symmetryThreshold - symmetry) * 100;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'asymmetric_raise',
        message: '左右のバランスが崩れています',
        priority: FeedbackPriority.medium,
        suggestion: '両腕を同じ高さまで上げてください',
        affectedBodyPart: 'arms',
        currentValue: symmetry,
        targetValue: raiseConfig.symmetryThreshold,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate body sway
  (double, FormIssue?) _evaluateBodySway(PoseLandmark nose) {
    if (_noseInitialX == null) return (100.0, null);

    final sway = (nose.x - _noseInitialX!).abs();

    if (sway <= raiseConfig.bodySwayThreshold) {
      return (100.0, null);
    }

    final deduction = (sway - raiseConfig.bodySwayThreshold) * 500;
    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: 'body_sway',
        message: '体が揺れています',
        priority: FeedbackPriority.high,
        suggestion: '体幹を安定させて行ってください',
        affectedBodyPart: 'torso',
        currentValue: sway,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate shoulder shrug
  (double, FormIssue?) _evaluateShoulderShrug(
    PoseLandmark shoulder,
    String side,
  ) {
    final initialY = side == 'left'
        ? _leftShoulderInitialY
        : _rightShoulderInitialY;
    if (initialY == null) return (100.0, null);

    // Negative means shoulder raised
    final shrug = initialY - shoulder.y;

    if (shrug <= raiseConfig.shoulderShrugThreshold) {
      return (100.0, null);
    }

    final deduction = (shrug - raiseConfig.shoulderShrugThreshold) * 500;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'shoulder_shrug_$side',
        message: side == 'left' ? '左肩をすくめています' : '右肩をすくめています',
        priority: FeedbackPriority.medium,
        suggestion: '肩を下げてリラックスしてください',
        affectedBodyPart: '${side}_shoulder',
        currentValue: shrug,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  @override
  void reset() {
    super.reset();
    _noseInitialX = null;
    _leftShoulderInitialY = null;
    _rightShoulderInitialY = null;
  }
}
