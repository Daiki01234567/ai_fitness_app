/// Shoulder Press Form Analyzer
///
/// Analyzes shoulder press form using MediaPipe pose landmarks.
/// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
///
/// Key evaluation points:
/// - Elbow angle (90° at bottom, full extension at top)
/// - Press path (vertical trajectory)
/// - Left-right balance
/// - Lower back arch prevention
/// - Full range of motion
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import '../../pose/pose_data.dart';
import '../../pose/pose_landmark_type.dart';
import '../base/base_analyzer.dart';
import '../models/form_feedback.dart';
import '../utils/math_utils.dart';

/// Shoulder press specific configuration
class ShoulderPressConfig {
  const ShoulderPressConfig({
    this.bottomElbowAngle = 90.0,
    this.topElbowAngle = 170.0,
    this.elbowAngleTolerance = 15.0,
    this.verticalityThreshold = 0.1,
    this.symmetryThreshold = 0.85,
    this.backArchThreshold = 0.04,
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

  /// Threshold for vertical path deviation
  final double verticalityThreshold;

  /// Threshold for left-right symmetry
  final double symmetryThreshold;

  /// Threshold for lower back arch detection
  final double backArchThreshold;

  /// Angle threshold for down phase
  final double downPhaseAngle;

  /// Angle threshold for bottom phase
  final double bottomPhaseAngle;

  /// Angle threshold for up phase
  final double upPhaseAngle;

  static const defaultConfig = ShoulderPressConfig();
}

/// Shoulder press form analyzer implementation
class ShoulderPressAnalyzer extends BaseFormAnalyzer {
  ShoulderPressAnalyzer({
    super.config,
    ShoulderPressConfig? pressConfig,
  }) : pressConfig = pressConfig ?? const ShoulderPressConfig();

  /// Press-specific configuration
  final ShoulderPressConfig pressConfig;

  /// Initial wrist X positions for verticality tracking
  double? _leftWristInitialX;
  double? _rightWristInitialX;

  /// Initial hip Y position for back arch detection
  double? _hipInitialY;

  @override
  ExerciseType get exerciseType => ExerciseType.shoulderPress;

  @override
  Map<String, double> get phaseThresholds => {
        'down': pressConfig.downPhaseAngle,
        'bottom': pressConfig.bottomPhaseAngle,
        'up': pressConfig.upPhaseAngle,
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

    // Initialize reference positions
    _initializeReferencePositions(
      leftWrist: leftWrist,
      rightWrist: rightWrist,
      leftHip: leftHip,
      rightHip: rightHip,
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
      jointAngles['rightElbow'] = getFilter('rightElbow').filter(rightElbowAngle);
    }

    // 2. Evaluate elbow angle (range of motion)
    final avgElbowAngle = _getAverageElbowAngle(jointAngles);
    if (avgElbowAngle != null) {
      final (romScore, romIssue) = _evaluateRangeOfMotion(avgElbowAngle);
      score -= (100 - romScore) * 0.35;
      if (romIssue != null) issues.add(romIssue);
    }

    // 3. Evaluate press path verticality
    if (leftWrist != null) {
      final (leftVertScore, leftVertIssue) =
          _evaluateVerticality(leftWrist, 'left');
      score -= (100 - leftVertScore) * 0.1;
      if (leftVertIssue != null) issues.add(leftVertIssue);
    }
    if (rightWrist != null) {
      final (rightVertScore, rightVertIssue) =
          _evaluateVerticality(rightWrist, 'right');
      score -= (100 - rightVertScore) * 0.1;
      if (rightVertIssue != null) issues.add(rightVertIssue);
    }

    // 4. Evaluate symmetry
    if (jointAngles['leftElbow'] != null &&
        jointAngles['rightElbow'] != null) {
      final (symmetryScore, symmetryIssue) = _evaluateSymmetry(
        jointAngles['leftElbow']!,
        jointAngles['rightElbow']!,
      );
      score -= (100 - symmetryScore) * 0.2;
      if (symmetryIssue != null) issues.add(symmetryIssue);
    }

    // 5. Evaluate wrist height balance
    if (leftWrist != null && rightWrist != null) {
      final (heightScore, heightIssue) =
          _evaluateWristHeightBalance(leftWrist, rightWrist);
      score -= (100 - heightScore) * 0.1;
      if (heightIssue != null) issues.add(heightIssue);
    }

    // 6. Check for back arch
    if (leftHip != null && rightHip != null) {
      final (archScore, archIssue) = _evaluateBackArch(leftHip, rightHip);
      score -= (100 - archScore) * 0.15;
      if (archIssue != null) issues.add(archIssue);
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
        // Start pressing up if angle increases
        if (smoothedAngle > phaseThresholds['bottom']! &&
            (velocity == null || velocity > 10)) {
          return ExercisePhase.up;
        }
        return currentPhase == ExercisePhase.start
            ? ExercisePhase.start
            : ExercisePhase.bottom;

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

      case ExercisePhase.top:
        // Start lowering if angle decreases
        if (velocity != null && velocity < -10) {
          return ExercisePhase.down;
        }
        return ExercisePhase.top;

      case ExercisePhase.down:
        // Reached bottom if angle is low enough
        if (smoothedAngle <= phaseThresholds['bottom']!) {
          return ExercisePhase.bottom;
        }
        // Started pressing up before reaching bottom
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
    PoseLandmark? leftWrist,
    PoseLandmark? rightWrist,
    PoseLandmark? leftHip,
    PoseLandmark? rightHip,
  }) {
    if (_leftWristInitialX == null &&
        leftWrist?.meetsMinimumThreshold == true) {
      _leftWristInitialX = leftWrist!.x;
    }
    if (_rightWristInitialX == null &&
        rightWrist?.meetsMinimumThreshold == true) {
      _rightWristInitialX = rightWrist!.x;
    }
    if (_hipInitialY == null && leftHip != null && rightHip != null) {
      final hipMid = FormMathUtils.calculateMidpoint(leftHip, rightHip);
      _hipInitialY = hipMid.y;
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
    // At top, check for full extension
    if (currentPhase == ExercisePhase.top || currentPhase == ExercisePhase.up) {
      if (angle < pressConfig.topElbowAngle - pressConfig.elbowAngleTolerance) {
        final deduction =
            (pressConfig.topElbowAngle - pressConfig.elbowAngleTolerance - angle) / 2;
        return (
          (100 - deduction).clamp(60.0, 100.0),
          FormIssue(
            issueType: 'incomplete_press',
            message: '腕をもう少し伸ばしてください',
            priority: FeedbackPriority.medium,
            suggestion: '頭上で腕をしっかり伸ばしてください',
            affectedBodyPart: 'arms',
            currentValue: angle,
            targetValue: pressConfig.topElbowAngle,
            deduction: deduction,
          ),
        );
      }
    }

    // At bottom, check for proper depth
    if (currentPhase == ExercisePhase.bottom ||
        currentPhase == ExercisePhase.down) {
      if (angle > pressConfig.bottomElbowAngle + pressConfig.elbowAngleTolerance) {
        final deduction =
            (angle - pressConfig.bottomElbowAngle - pressConfig.elbowAngleTolerance) / 2;
        return (
          (100 - deduction).clamp(70.0, 100.0),
          FormIssue(
            issueType: 'insufficient_depth',
            message: 'もう少し下げてください',
            priority: FeedbackPriority.low,
            suggestion: '肘が90度になるまで下げてください',
            affectedBodyPart: 'arms',
            currentValue: angle,
            targetValue: pressConfig.bottomElbowAngle,
            deduction: deduction,
          ),
        );
      }
    }

    return (100.0, null);
  }

  /// Evaluate press path verticality
  (double, FormIssue?) _evaluateVerticality(PoseLandmark wrist, String side) {
    final initialX =
        side == 'left' ? _leftWristInitialX : _rightWristInitialX;
    if (initialX == null) return (100.0, null);

    final deviation = (wrist.x - initialX).abs();

    if (deviation <= pressConfig.verticalityThreshold) {
      return (100.0, null);
    }

    final deduction = (deviation - pressConfig.verticalityThreshold) * 300;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'press_path_deviation_$side',
        message: side == 'left' ? '左腕の軌道がずれています' : '右腕の軌道がずれています',
        priority: FeedbackPriority.medium,
        suggestion: '真っ直ぐ上に押し上げてください',
        affectedBodyPart: '${side}_arm',
        currentValue: deviation,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate symmetry
  (double, FormIssue?) _evaluateSymmetry(double leftAngle, double rightAngle) {
    final symmetry = FormMathUtils.calculateSymmetry(leftAngle, rightAngle);

    if (symmetry >= pressConfig.symmetryThreshold) {
      return (100.0, null);
    }

    final deduction = (pressConfig.symmetryThreshold - symmetry) * 100;
    return (
      (100 - deduction).clamp(60.0, 100.0),
      FormIssue(
        issueType: 'asymmetric_press',
        message: '左右のバランスが崩れています',
        priority: FeedbackPriority.medium,
        suggestion: '両腕を同時に押し上げてください',
        affectedBodyPart: 'arms',
        currentValue: symmetry,
        targetValue: pressConfig.symmetryThreshold,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate wrist height balance
  (double, FormIssue?) _evaluateWristHeightBalance(
    PoseLandmark leftWrist,
    PoseLandmark rightWrist,
  ) {
    final heightDiff = (leftWrist.y - rightWrist.y).abs();

    if (heightDiff <= 0.05) {
      return (100.0, null);
    }

    final deduction = (heightDiff - 0.05) * 500;
    final lowerSide = leftWrist.y > rightWrist.y ? 'left' : 'right';
    return (
      (100 - deduction).clamp(70.0, 100.0),
      FormIssue(
        issueType: 'uneven_height',
        message: lowerSide == 'left' ? '左手が下がっています' : '右手が下がっています',
        priority: FeedbackPriority.low,
        suggestion: '両手を同じ高さまで上げてください',
        affectedBodyPart: 'wrists',
        currentValue: heightDiff,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  /// Evaluate back arch
  (double, FormIssue?) _evaluateBackArch(
    PoseLandmark leftHip,
    PoseLandmark rightHip,
  ) {
    if (_hipInitialY == null) return (100.0, null);

    final hipMid = FormMathUtils.calculateMidpoint(leftHip, rightHip);
    // Positive means hip moved forward (back arching)
    final arch = _hipInitialY! - hipMid.y;

    if (arch <= pressConfig.backArchThreshold) {
      return (100.0, null);
    }

    final deduction = (arch - pressConfig.backArchThreshold) * 500;
    return (
      (100 - deduction).clamp(50.0, 100.0),
      FormIssue(
        issueType: 'back_arch',
        message: '腰が反っています',
        priority: FeedbackPriority.high,
        suggestion: '腹筋に力を入れて腰を安定させてください',
        affectedBodyPart: 'lower_back',
        currentValue: arch,
        targetValue: 0.0,
        deduction: deduction,
      ),
    );
  }

  @override
  void reset() {
    super.reset();
    _leftWristInitialX = null;
    _rightWristInitialX = null;
    _hipInitialY = null;
  }
}
