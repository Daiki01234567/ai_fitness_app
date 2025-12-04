/// Squat Form Analyzer
///
/// Analyzes squat form using MediaPipe pose landmarks.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Key evaluation points:
/// - Knee angle (target: 90°)
/// - Knee over toe check
/// - Back angle (forward lean)
/// - Heel lift detection
/// - Left-right symmetry
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Squat-specific configuration
class SquatConfig {
  const SquatConfig({
    this.targetKneeAngle = 90.0,
    this.minKneeAngle = 70.0,
    this.maxKneeAngle = 140.0,
    this.kneeAngleTolerance = 15.0,
    this.maxForwardLean = 45.0,
    this.optimalForwardLean = 30.0,
    this.minForwardLean = 15.0,
    this.symmetryThreshold = 0.85,
    this.kneeOverToeThreshold = 0.05,
    this.heelLiftThreshold = 0.02,
    this.downPhaseAngle = 140.0,
    this.bottomPhaseAngle = 100.0,
    this.upPhaseAngle = 160.0,
  });

  /// Target knee angle at bottom of squat
  final double targetKneeAngle;

  /// Minimum acceptable knee angle
  final double minKneeAngle;

  /// Maximum knee angle (standing)
  final double maxKneeAngle;

  /// Tolerance for knee angle scoring
  final double kneeAngleTolerance;

  /// Maximum acceptable forward lean angle
  final double maxForwardLean;

  /// Optimal forward lean angle
  final double optimalForwardLean;

  /// Minimum forward lean angle
  final double minForwardLean;

  /// Threshold for left-right symmetry (0-1)
  final double symmetryThreshold;

  /// Threshold for knee over toe detection
  final double kneeOverToeThreshold;

  /// Threshold for heel lift detection
  final double heelLiftThreshold;

  /// Knee angle threshold for down phase
  final double downPhaseAngle;

  /// Knee angle threshold for bottom phase
  final double bottomPhaseAngle;

  /// Knee angle threshold for up phase
  final double upPhaseAngle;

  static const defaultConfig = SquatConfig();
}

/// Squat form analyzer implementation
class SquatAnalyzer extends BaseFormAnalyzer {
  SquatAnalyzer({super.config, SquatConfig? squatConfig})
    : squatConfig = squatConfig ?? const SquatConfig();

  /// Squat-specific configuration
  final SquatConfig squatConfig;

  /// Track min knee angle for current rep
  double? _minKneeAngleInRep;

  @override
  ExerciseType get exerciseType => ExerciseType.squat;

  @override
  Map<String, double> get phaseThresholds => {
    'down': squatConfig.downPhaseAngle,
    'bottom': squatConfig.bottomPhaseAngle,
    'up': squatConfig.upPhaseAngle,
  };

  @override
  FrameEvaluationResult evaluateFrame(PoseFrame frame) {
    final issues = <FormIssue>[];
    final jointAngles = <String, double>{};
    var score = 100.0;

    // Get required landmarks
    final leftHip = frame.getLandmark(PoseLandmarkType.leftHip);
    final rightHip = frame.getLandmark(PoseLandmarkType.rightHip);
    final leftKnee = frame.getLandmark(PoseLandmarkType.leftKnee);
    final rightKnee = frame.getLandmark(PoseLandmarkType.rightKnee);
    final leftAnkle = frame.getLandmark(PoseLandmarkType.leftAnkle);
    final rightAnkle = frame.getLandmark(PoseLandmarkType.rightAnkle);
    final leftShoulder = frame.getLandmark(PoseLandmarkType.leftShoulder);
    final rightShoulder = frame.getLandmark(PoseLandmarkType.rightShoulder);
    final leftHeel = frame.getLandmark(PoseLandmarkType.leftHeel);
    final rightHeel = frame.getLandmark(PoseLandmarkType.rightHeel);
    final leftFootIndex = frame.getLandmark(PoseLandmarkType.leftFootIndex);
    final rightFootIndex = frame.getLandmark(PoseLandmarkType.rightFootIndex);

    // 1. Calculate knee angles
    final leftKneeAngle = _calculateKneeAngle(leftHip, leftKnee, leftAnkle);
    final rightKneeAngle = _calculateKneeAngle(rightHip, rightKnee, rightAnkle);

    if (leftKneeAngle != null) {
      jointAngles['leftKnee'] = getFilter('leftKnee').filter(leftKneeAngle);
    }
    if (rightKneeAngle != null) {
      jointAngles['rightKnee'] = getFilter('rightKnee').filter(rightKneeAngle);
    }

    // Evaluate knee depth
    final avgKneeAngle = _getAverageKneeAngle(jointAngles);
    if (avgKneeAngle != null) {
      final (kneeScore, kneeIssue) = _evaluateKneeAngle(avgKneeAngle);
      score -= (100 - kneeScore) * 0.4; // 40% weight for knee angle
      if (kneeIssue != null) issues.add(kneeIssue);

      // Track minimum angle for rep
      if (_minKneeAngleInRep == null || avgKneeAngle < _minKneeAngleInRep!) {
        _minKneeAngleInRep = avgKneeAngle;
      }
    }

    // 2. Check left-right symmetry
    if (leftKneeAngle != null && rightKneeAngle != null) {
      final (symmetryScore, symmetryIssue) = _evaluateSymmetry(
        leftKneeAngle,
        rightKneeAngle,
      );
      score -= (100 - symmetryScore) * 0.15; // 15% weight for symmetry
      if (symmetryIssue != null) issues.add(symmetryIssue);
    }

    // 3. Check knee over toe
    if (leftKnee != null && leftAnkle != null && leftFootIndex != null) {
      final (leftKotScore, leftKotIssue) = _evaluateKneeOverToe(
        leftKnee,
        leftAnkle,
        leftFootIndex,
        'left',
      );
      if (leftKotIssue != null) {
        score -= (100 - leftKotScore) * 0.1; // 10% weight
        issues.add(leftKotIssue);
      }
    }
    if (rightKnee != null && rightAnkle != null && rightFootIndex != null) {
      final (rightKotScore, rightKotIssue) = _evaluateKneeOverToe(
        rightKnee,
        rightAnkle,
        rightFootIndex,
        'right',
      );
      if (rightKotIssue != null) {
        score -= (100 - rightKotScore) * 0.1;
        issues.add(rightKotIssue);
      }
    }

    // 4. Check back angle (forward lean)
    final backAngle = _calculateBackAngle(
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
    );
    if (backAngle != null) {
      jointAngles['backAngle'] = getFilter('backAngle').filter(backAngle);
      final (backScore, backIssue) = _evaluateBackAngle(
        jointAngles['backAngle']!,
      );
      score -= (100 - backScore) * 0.15; // 15% weight
      if (backIssue != null) issues.add(backIssue);
    }

    // 5. Check heel lift
    if (leftHeel != null && leftFootIndex != null) {
      final (leftHeelScore, leftHeelIssue) = _evaluateHeelLift(
        leftHeel,
        leftFootIndex,
        'left',
      );
      if (leftHeelIssue != null) {
        score -= (100 - leftHeelScore) * 0.05;
        issues.add(leftHeelIssue);
      }
    }
    if (rightHeel != null && rightFootIndex != null) {
      final (rightHeelScore, rightHeelIssue) = _evaluateHeelLift(
        rightHeel,
        rightFootIndex,
        'right',
      );
      if (rightHeelIssue != null) {
        score -= (100 - rightHeelScore) * 0.05;
        issues.add(rightHeelIssue);
      }
    }

    // Clamp score
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
    final avgKneeAngle = _getAverageKneeAngle(result.jointAngles);
    if (avgKneeAngle == null) return currentPhase;

    final smoothedAngle = getFilter('phaseAngle').filter(avgKneeAngle);

    // Calculate velocity to determine direction
    final velocity = getVelocityCalc(
      'kneeAngle',
    ).calculateVelocity(smoothedAngle, frame.timestamp);

    // State machine logic
    switch (currentPhase) {
      case ExercisePhase.start:
      case ExercisePhase.top:
        // Start going down if angle decreases significantly
        if (smoothedAngle < phaseThresholds['down']! &&
            (velocity == null || velocity < -10)) {
          _minKneeAngleInRep = null; // Reset for new rep
          return ExercisePhase.down;
        }
        return currentPhase == ExercisePhase.start
            ? ExercisePhase.start
            : ExercisePhase.top;

      case ExercisePhase.down:
        // Reached bottom if angle is low enough
        if (smoothedAngle <= phaseThresholds['bottom']!) {
          return ExercisePhase.bottom;
        }
        // Going back up before reaching bottom
        if (velocity != null && velocity > 10) {
          return ExercisePhase.up;
        }
        return ExercisePhase.down;

      case ExercisePhase.bottom:
        // Start going up if angle increases
        if (velocity != null && velocity > 10) {
          return ExercisePhase.up;
        }
        return ExercisePhase.bottom;

      case ExercisePhase.up:
        // Reached top if angle is high enough
        if (smoothedAngle >= phaseThresholds['up']!) {
          return ExercisePhase.top;
        }
        // Going back down
        if (velocity != null && velocity < -10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.up;

      default:
        return ExercisePhase.start;
    }
  }

  /// Calculate knee angle from hip, knee, ankle landmarks
  double? _calculateKneeAngle(
    PoseLandmark? hip,
    PoseLandmark? knee,
    PoseLandmark? ankle,
  ) {
    if (hip == null || knee == null || ankle == null) return null;
    if (!hip.meetsMinimumThreshold ||
        !knee.meetsMinimumThreshold ||
        !ankle.meetsMinimumThreshold) {
      return null;
    }
    return FormMathUtils.calculateAngle3Points(hip, knee, ankle);
  }

  /// Get average knee angle from both sides
  double? _getAverageKneeAngle(Map<String, double> jointAngles) {
    final left = jointAngles['leftKnee'];
    final right = jointAngles['rightKnee'];

    if (left != null && right != null) {
      return (left + right) / 2;
    }
    return left ?? right;
  }

  /// Evaluate knee angle and return score and issue
  (double, FormIssue?) _evaluateKneeAngle(double angle) {
    // Only evaluate during descent/bottom phases
    if (currentPhase == ExercisePhase.start ||
        currentPhase == ExercisePhase.top) {
      return (100.0, null);
    }

    // Perfect score range: 85-95 degrees
    if (angle >= 85 && angle <= 95) {
      return (100.0, null);
    }

    // Good range: 80-100 degrees
    if (angle >= 80 && angle <= 100) {
      return (90.0, null);
    }

    // Not deep enough
    if (angle > squatConfig.targetKneeAngle + squatConfig.kneeAngleTolerance) {
      final deduction =
          (angle -
              squatConfig.targetKneeAngle -
              squatConfig.kneeAngleTolerance) /
          2;
      return (
        (100 - deduction).clamp(50.0, 100.0),
        FormIssue(
          issueType: 'insufficient_depth',
          message: 'もう少し深くしゃがんでください',
          priority: FeedbackPriority.medium,
          suggestion: '膝が90度になるまで腰を落としてください',
          affectedBodyPart: 'knee',
          currentValue: angle,
          targetValue: squatConfig.targetKneeAngle,
          deduction: deduction,
        ),
      );
    }

    // Too deep (potential injury risk)
    if (angle < squatConfig.minKneeAngle) {
      final deduction = (squatConfig.minKneeAngle - angle) / 2;
      return (
        (100 - deduction).clamp(60.0, 100.0),
        FormIssue(
          issueType: 'excessive_depth',
          message: '深くしゃがみすぎています',
          priority: FeedbackPriority.high,
          suggestion: '膝が90度程度になる深さで止めてください',
          affectedBodyPart: 'knee',
          currentValue: angle,
          targetValue: squatConfig.targetKneeAngle,
          deduction: deduction,
        ),
      );
    }

    return (85.0, null);
  }

  /// Evaluate left-right symmetry
  (double, FormIssue?) _evaluateSymmetry(double leftAngle, double rightAngle) {
    final symmetry = FormMathUtils.calculateSymmetry(leftAngle, rightAngle);

    if (symmetry >= squatConfig.symmetryThreshold) {
      return (100.0, null);
    }

    final deduction = (squatConfig.symmetryThreshold - symmetry) * 100;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'asymmetric_squat',
        message: '左右のバランスが崩れています',
        priority: FeedbackPriority.medium,
        suggestion: '両脚に均等に体重をかけてください',
        affectedBodyPart: 'legs',
        currentValue: symmetry,
        targetValue: squatConfig.symmetryThreshold,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate knee over toe position
  (double, FormIssue?) _evaluateKneeOverToe(
    PoseLandmark knee,
    PoseLandmark ankle,
    PoseLandmark footIndex,
    String side,
  ) {
    // Only check during deep squat
    if (currentPhase != ExercisePhase.bottom &&
        currentPhase != ExercisePhase.down) {
      return (100.0, null);
    }

    // Check if knee is in front of toes
    final toeX = footIndex.x;
    final kneeX = knee.x;

    // Positive means knee is in front of toes
    final overAmount = kneeX - toeX;

    if (overAmount <= squatConfig.kneeOverToeThreshold) {
      return (100.0, null);
    }

    final deduction = (overAmount - squatConfig.kneeOverToeThreshold) * 500;
    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: 'knee_over_toe_$side',
        message: side == 'left' ? '左膝がつま先より前に出ています' : '右膝がつま先より前に出ています',
        priority: FeedbackPriority.high,
        suggestion: '膝がつま先を超えないように意識してください',
        affectedBodyPart: '${side}_knee',
        currentValue: overAmount,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Calculate back angle (forward lean)
  double? _calculateBackAngle(
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
    PoseLandmark? leftHip,
    PoseLandmark? rightHip,
  ) {
    if (leftShoulder == null ||
        rightShoulder == null ||
        leftHip == null ||
        rightHip == null) {
      return null;
    }

    // Calculate midpoints
    final shoulderMid = FormMathUtils.calculateMidpoint(
      leftShoulder,
      rightShoulder,
    );
    final hipMid = FormMathUtils.calculateMidpoint(leftHip, rightHip);

    // Create virtual landmarks for angle calculation
    final shoulderLandmark = PoseLandmark(
      type: PoseLandmarkType.nose, // Dummy type
      x: shoulderMid.x,
      y: shoulderMid.y,
      z: shoulderMid.z,
      likelihood: 1.0,
    );
    final hipLandmark = PoseLandmark(
      type: PoseLandmarkType.nose,
      x: hipMid.x,
      y: hipMid.y,
      z: hipMid.z,
      likelihood: 1.0,
    );

    // Calculate vertical angle (0 = vertical, 90 = horizontal)
    return FormMathUtils.calculateVerticalAngle(shoulderLandmark, hipLandmark);
  }

  /// Evaluate back angle
  (double, FormIssue?) _evaluateBackAngle(double angle) {
    // Only evaluate during squat (not standing)
    if (currentPhase == ExercisePhase.start ||
        currentPhase == ExercisePhase.top) {
      return (100.0, null);
    }

    // Good range: 15-35 degrees
    if (angle >= squatConfig.minForwardLean &&
        angle <= squatConfig.optimalForwardLean + 5) {
      return (100.0, null);
    }

    // Too upright
    if (angle < squatConfig.minForwardLean) {
      final deduction = (squatConfig.minForwardLean - angle);
      return (
        (100 - deduction).clamp(70.0, 100.0),
        FormIssue(
          issueType: 'too_upright',
          message: '上体が起きすぎています',
          priority: FeedbackPriority.low,
          suggestion: '少し前傾姿勢を取ってください',
          affectedBodyPart: 'back',
          currentValue: angle,
          targetValue: squatConfig.optimalForwardLean,
          deduction: deduction,
        ),
      );
    }

    // Too much forward lean
    if (angle > squatConfig.maxForwardLean) {
      final deduction = (angle - squatConfig.maxForwardLean);
      return (
        (100 - deduction).clamp(60.0, 100.0),
        FormIssue(
          issueType: 'excessive_forward_lean',
          message: '前傾しすぎています',
          priority: FeedbackPriority.high,
          suggestion: '胸を張って上体を起こしてください',
          affectedBodyPart: 'back',
          currentValue: angle,
          targetValue: squatConfig.optimalForwardLean,
          deduction: deduction,
        ),
      );
    }

    return (90.0, null);
  }

  /// Evaluate heel lift
  (double, FormIssue?) _evaluateHeelLift(
    PoseLandmark heel,
    PoseLandmark footIndex,
    String side,
  ) {
    // Only check during squat
    if (currentPhase == ExercisePhase.start ||
        currentPhase == ExercisePhase.top) {
      return (100.0, null);
    }

    // Compare heel and toe Y positions
    // If heel is significantly higher than toe, it's lifted
    final heelLift = footIndex.y - heel.y;

    if (heelLift <= squatConfig.heelLiftThreshold) {
      return (100.0, null);
    }

    final deduction = (heelLift - squatConfig.heelLiftThreshold) * 1000;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'heel_lift_$side',
        message: side == 'left' ? '左かかとが浮いています' : '右かかとが浮いています',
        priority: FeedbackPriority.medium,
        suggestion: 'かかとを床につけたまま行ってください',
        affectedBodyPart: '${side}_heel',
        currentValue: heelLift,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  @override
  void reset() {
    super.reset();
    _minKneeAngleInRep = null;
  }
}
