/// Push-up Form Analyzer
///
/// Analyzes push-up form using MediaPipe pose landmarks.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Key evaluation points:
/// - Elbow angle (90° at bottom, full extension at top)
/// - Body alignment (plank position)
/// - Hip sag/pike detection
/// - Elbow flare angle
/// - Neck/head position
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Push-up specific configuration
class PushUpConfig {
  const PushUpConfig({
    this.bottomElbowAngle = 90.0,
    this.topElbowAngle = 170.0,
    this.elbowAngleTolerance = 15.0,
    this.bodyLineThreshold = 165.0,
    this.hipSagThreshold = 0.05,
    this.hipPikeThreshold = 0.05,
    this.elbowFlareMaxAngle = 60.0,
    this.symmetryThreshold = 0.85,
    this.downPhaseAngle = 140.0,
    this.bottomPhaseAngle = 100.0,
    this.upPhaseAngle = 160.0,
  });

  /// Target elbow angle at bottom
  final double bottomElbowAngle;

  /// Target elbow angle at top
  final double topElbowAngle;

  /// Tolerance for angle evaluation
  final double elbowAngleTolerance;

  /// Minimum body line angle (shoulder-hip-ankle should be ~180°)
  final double bodyLineThreshold;

  /// Threshold for hip sag detection
  final double hipSagThreshold;

  /// Threshold for hip pike detection
  final double hipPikeThreshold;

  /// Maximum acceptable elbow flare angle
  final double elbowFlareMaxAngle;

  /// Threshold for left-right symmetry
  final double symmetryThreshold;

  /// Angle threshold for down phase
  final double downPhaseAngle;

  /// Angle threshold for bottom phase
  final double bottomPhaseAngle;

  /// Angle threshold for up phase
  final double upPhaseAngle;

  static const defaultConfig = PushUpConfig();
}

/// Push-up form analyzer implementation
class PushUpAnalyzer extends BaseFormAnalyzer {
  PushUpAnalyzer({super.config, PushUpConfig? pushUpConfig})
    : pushUpConfig = pushUpConfig ?? const PushUpConfig();

  /// Push-up specific configuration
  final PushUpConfig pushUpConfig;

  /// Reference body line Y positions
  double? _referenceShoulderY;
  double? _referenceHipY;
  double? _referenceAnkleY;

  @override
  ExerciseType get exerciseType => ExerciseType.pushUp;

  @override
  Map<String, double> get phaseThresholds => {
    'down': pushUpConfig.downPhaseAngle,
    'bottom': pushUpConfig.bottomPhaseAngle,
    'up': pushUpConfig.upPhaseAngle,
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
    final leftAnkle = frame.getLandmark(PoseLandmarkType.leftAnkle);
    final rightAnkle = frame.getLandmark(PoseLandmarkType.rightAnkle);
    final nose = frame.getLandmark(PoseLandmarkType.nose);

    // Initialize reference positions
    _initializeReferencePositions(
      leftShoulder: leftShoulder,
      rightShoulder: rightShoulder,
      leftHip: leftHip,
      rightHip: rightHip,
      leftAnkle: leftAnkle,
      rightAnkle: rightAnkle,
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

    if (leftElbowAngle != null) {
      jointAngles['leftElbow'] = getFilter('leftElbow').filter(leftElbowAngle);
    }
    if (rightElbowAngle != null) {
      jointAngles['rightElbow'] = getFilter(
        'rightElbow',
      ).filter(rightElbowAngle);
    }

    // 2. Calculate body line angle
    final bodyLineAngle = _calculateBodyLineAngle(
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftAnkle,
      rightAnkle,
    );
    if (bodyLineAngle != null) {
      jointAngles['bodyLine'] = getFilter('bodyLine').filter(bodyLineAngle);
    }

    // 3. Evaluate elbow depth
    final avgElbowAngle = _getAverageElbowAngle(jointAngles);
    if (avgElbowAngle != null) {
      final (depthScore, depthIssue) = _evaluateDepth(avgElbowAngle);
      score -= (100 - depthScore) * 0.3;
      if (depthIssue != null) issues.add(depthIssue);
    }

    // 4. Evaluate body alignment
    if (jointAngles['bodyLine'] != null) {
      final (alignScore, alignIssue) = _evaluateBodyAlignment(
        jointAngles['bodyLine']!,
      );
      score -= (100 - alignScore) * 0.25;
      if (alignIssue != null) issues.add(alignIssue);
    }

    // 5. Check hip position (sag/pike)
    if (leftHip != null && rightHip != null) {
      final (hipScore, hipIssue) = _evaluateHipPosition(
        leftShoulder,
        rightShoulder,
        leftHip,
        rightHip,
        leftAnkle,
        rightAnkle,
      );
      score -= (100 - hipScore) * 0.2;
      if (hipIssue != null) issues.add(hipIssue);
    }

    // 6. Evaluate symmetry
    if (jointAngles['leftElbow'] != null && jointAngles['rightElbow'] != null) {
      final (symmetryScore, symmetryIssue) = _evaluateSymmetry(
        jointAngles['leftElbow']!,
        jointAngles['rightElbow']!,
      );
      score -= (100 - symmetryScore) * 0.1;
      if (symmetryIssue != null) issues.add(symmetryIssue);
    }

    // 7. Check head/neck position
    if (nose != null && leftShoulder != null && rightShoulder != null) {
      final (neckScore, neckIssue) = _evaluateNeckPosition(
        nose,
        leftShoulder,
        rightShoulder,
      );
      score -= (100 - neckScore) * 0.15;
      if (neckIssue != null) issues.add(neckIssue);
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
    final velocity = getVelocityCalc(
      'elbowAngle',
    ).calculateVelocity(smoothedAngle, frame.timestamp);

    switch (currentPhase) {
      case ExercisePhase.start:
      case ExercisePhase.top:
        // Start going down if angle decreases
        if (smoothedAngle < phaseThresholds['down']! &&
            (velocity == null || velocity < -10)) {
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
        // Started going up before reaching bottom
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
        // Started going down before reaching top
        if (velocity != null && velocity < -10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.up;

      default:
        return ExercisePhase.start;
    }
  }

  /// Initialize reference positions
  void _initializeReferencePositions({
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
    PoseLandmark? leftHip,
    PoseLandmark? rightHip,
    PoseLandmark? leftAnkle,
    PoseLandmark? rightAnkle,
  }) {
    if (_referenceShoulderY == null &&
        leftShoulder != null &&
        rightShoulder != null) {
      _referenceShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    }
    if (_referenceHipY == null && leftHip != null && rightHip != null) {
      _referenceHipY = (leftHip.y + rightHip.y) / 2;
    }
    if (_referenceAnkleY == null && leftAnkle != null && rightAnkle != null) {
      _referenceAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
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

  /// Calculate body line angle (shoulder-hip-ankle)
  double? _calculateBodyLineAngle(
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
    PoseLandmark? leftHip,
    PoseLandmark? rightHip,
    PoseLandmark? leftAnkle,
    PoseLandmark? rightAnkle,
  ) {
    if (leftShoulder == null ||
        rightShoulder == null ||
        leftHip == null ||
        rightHip == null ||
        leftAnkle == null ||
        rightAnkle == null) {
      return null;
    }

    // Calculate midpoints
    final shoulderMid = FormMathUtils.calculateMidpoint(
      leftShoulder,
      rightShoulder,
    );
    final hipMid = FormMathUtils.calculateMidpoint(leftHip, rightHip);
    final ankleMid = FormMathUtils.calculateMidpoint(leftAnkle, rightAnkle);

    // Create virtual landmarks
    final shoulder = PoseLandmark(
      type: PoseLandmarkType.nose,
      x: shoulderMid.x,
      y: shoulderMid.y,
      z: shoulderMid.z,
      likelihood: 1.0,
    );
    final hip = PoseLandmark(
      type: PoseLandmarkType.nose,
      x: hipMid.x,
      y: hipMid.y,
      z: hipMid.z,
      likelihood: 1.0,
    );
    final ankle = PoseLandmark(
      type: PoseLandmarkType.nose,
      x: ankleMid.x,
      y: ankleMid.y,
      z: ankleMid.z,
      likelihood: 1.0,
    );

    return FormMathUtils.calculateAngle3Points(shoulder, hip, ankle);
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

  /// Evaluate push-up depth
  (double, FormIssue?) _evaluateDepth(double angle) {
    // At bottom, check for proper depth
    if (currentPhase == ExercisePhase.bottom ||
        currentPhase == ExercisePhase.down) {
      if (angle >
          pushUpConfig.bottomElbowAngle + pushUpConfig.elbowAngleTolerance) {
        final deduction =
            (angle -
                pushUpConfig.bottomElbowAngle -
                pushUpConfig.elbowAngleTolerance) /
            2;
        return (
          (100 - deduction).clamp(50.0, 100.0),
          FormIssue(
            issueType: 'insufficient_depth',
            message: 'もう少し深く下がってください',
            priority: FeedbackPriority.medium,
            suggestion: '胸が床に近づくまで下がってください',
            affectedBodyPart: 'arms',
            currentValue: angle,
            targetValue: pushUpConfig.bottomElbowAngle,
            deduction: deduction,
          ),
        );
      }
    }

    // At top, check for full extension
    if (currentPhase == ExercisePhase.top || currentPhase == ExercisePhase.up) {
      if (angle <
          pushUpConfig.topElbowAngle - pushUpConfig.elbowAngleTolerance) {
        final deduction =
            (pushUpConfig.topElbowAngle -
                pushUpConfig.elbowAngleTolerance -
                angle) /
            2;
        return (
          (100 - deduction).clamp(60.0, 100.0),
          FormIssue(
            issueType: 'incomplete_extension',
            message: '腕をもっと伸ばしてください',
            priority: FeedbackPriority.low,
            suggestion: '上で腕をしっかり伸ばしてください',
            affectedBodyPart: 'arms',
            currentValue: angle,
            targetValue: pushUpConfig.topElbowAngle,
            deduction: deduction,
          ),
        );
      }
    }

    return (100.0, null);
  }

  /// Evaluate body alignment (plank position)
  (double, FormIssue?) _evaluateBodyAlignment(double bodyLineAngle) {
    // Body should be close to straight (180°)
    if (bodyLineAngle >= pushUpConfig.bodyLineThreshold) {
      return (100.0, null);
    }

    final deviation = pushUpConfig.bodyLineThreshold - bodyLineAngle;
    final deduction = deviation / 2;

    // Determine if hip is too high (pike) or too low (sag)
    final issueType = bodyLineAngle < 150 ? 'body_pike' : 'body_sag';
    final message = bodyLineAngle < 150 ? 'お尻が上がっています' : '体のラインが崩れています';
    final suggestion = bodyLineAngle < 150
        ? 'お尻を下げて体を一直線にしてください'
        : '腹筋に力を入れて体を一直線に保ってください';

    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: issueType,
        message: message,
        priority: FeedbackPriority.high,
        suggestion: suggestion,
        affectedBodyPart: 'torso',
        currentValue: bodyLineAngle,
        targetValue: 180.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate hip position
  (double, FormIssue?) _evaluateHipPosition(
    PoseLandmark? leftShoulder,
    PoseLandmark? rightShoulder,
    PoseLandmark leftHip,
    PoseLandmark rightHip,
    PoseLandmark? leftAnkle,
    PoseLandmark? rightAnkle,
  ) {
    if (_referenceShoulderY == null ||
        _referenceHipY == null ||
        _referenceAnkleY == null) {
      return (100.0, null);
    }

    final currentHipY = (leftHip.y + rightHip.y) / 2;

    // Calculate expected hip Y based on straight line from shoulder to ankle
    final expectedHipY = (_referenceShoulderY! + _referenceAnkleY!) / 2;

    final deviation = currentHipY - expectedHipY;

    // Hip too low (sag)
    if (deviation > pushUpConfig.hipSagThreshold) {
      final deduction = (deviation - pushUpConfig.hipSagThreshold) * 300;
      return (
        (100 - deduction).clamp(50.0, 100.0),
        FormIssue(
          issueType: 'hip_sag',
          message: '腰が下がっています',
          priority: FeedbackPriority.high,
          suggestion: '腹筋に力を入れて腰を上げてください',
          affectedBodyPart: 'hip',
          currentValue: deviation,
          targetValue: 0.0,
          deduction: deduction,
        ),
      );
    }

    // Hip too high (pike)
    if (deviation < -pushUpConfig.hipPikeThreshold) {
      final deduction = ((-deviation) - pushUpConfig.hipPikeThreshold) * 300;
      return (
        (100 - deduction).clamp(60.0, 100.0),
        FormIssue(
          issueType: 'hip_pike',
          message: 'お尻が上がっています',
          priority: FeedbackPriority.medium,
          suggestion: 'お尻を下げて体を一直線にしてください',
          affectedBodyPart: 'hip',
          currentValue: deviation,
          targetValue: 0.0,
          deduction: deduction,
        ),
      );
    }

    return (100.0, null);
  }

  /// Evaluate symmetry
  (double, FormIssue?) _evaluateSymmetry(double leftAngle, double rightAngle) {
    final symmetry = FormMathUtils.calculateSymmetry(leftAngle, rightAngle);

    if (symmetry >= pushUpConfig.symmetryThreshold) {
      return (100.0, null);
    }

    final deduction = (pushUpConfig.symmetryThreshold - symmetry) * 100;
    return (
      (100 - deduction).clamp(70.0, 100.0),
      FormIssue(
        issueType: 'asymmetric_pushup',
        message: '左右のバランスが崩れています',
        priority: FeedbackPriority.medium,
        suggestion: '両腕に均等に体重をかけてください',
        affectedBodyPart: 'arms',
        currentValue: symmetry,
        targetValue: pushUpConfig.symmetryThreshold,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate neck/head position
  (double, FormIssue?) _evaluateNeckPosition(
    PoseLandmark nose,
    PoseLandmark leftShoulder,
    PoseLandmark rightShoulder,
  ) {
    final shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;

    // Nose should be roughly in line with shoulders (neutral neck)
    // If nose is much lower, head is dropping
    // If nose is much higher, head is craning up
    final noseRelativeY = nose.y - shoulderMidY;

    // Head dropping too much
    if (noseRelativeY > 0.08) {
      final deduction = (noseRelativeY - 0.08) * 300;
      return (
        (100 - deduction).clamp(70.0, 100.0),
        FormIssue(
          issueType: 'head_drop',
          message: '頭が下がっています',
          priority: FeedbackPriority.low,
          suggestion: '顔を少し上げて首をまっすぐにしてください',
          affectedBodyPart: 'neck',
          currentValue: noseRelativeY,
          targetValue: 0.0,
          deduction: deduction,
        ),
      );
    }

    // Head craning up too much
    if (noseRelativeY < -0.1) {
      final deduction = ((-noseRelativeY) - 0.1) * 300;
      return (
        (100 - deduction).clamp(70.0, 100.0),
        FormIssue(
          issueType: 'head_crane',
          message: '頭を上げすぎています',
          priority: FeedbackPriority.low,
          suggestion: '床を見るようにして首をリラックスさせてください',
          affectedBodyPart: 'neck',
          currentValue: noseRelativeY,
          targetValue: 0.0,
          deduction: deduction,
        ),
      );
    }

    return (100.0, null);
  }

  @override
  void reset() {
    super.reset();
    _referenceShoulderY = null;
    _referenceHipY = null;
    _referenceAnkleY = null;
  }
}
