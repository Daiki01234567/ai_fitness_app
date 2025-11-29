// Form Analyzer Module
//
// Provides exercise form evaluation using MediaPipe pose detection.
// Reference: docs/specs/08_README_form_validation_logic_v3_3.md
//
// Supported exercises:
// - Squat (スクワット)
// - Bicep Curl (アームカール)
// - Lateral Raise (サイドレイズ)
// - Shoulder Press (ショルダープレス)
// - Push-up (プッシュアップ)
//
// Legal notice: This is NOT a medical device.
// All feedback is for reference purposes only.
library;

// Models
export 'models/form_feedback.dart';

// Base classes
export 'base/base_analyzer.dart';

// Utilities
export 'utils/math_utils.dart';

// Factory
export 'analyzer_factory.dart';

// Analyzers
export 'analyzers/squat_analyzer.dart';
export 'analyzers/bicep_curl_analyzer.dart';
export 'analyzers/lateral_raise_analyzer.dart';
export 'analyzers/shoulder_press_analyzer.dart';
export 'analyzers/pushup_analyzer.dart';

// Services
export 'services/feedback_manager.dart';
export 'services/session_data_recorder.dart';
