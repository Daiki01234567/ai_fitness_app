# 013 姿勢検出基盤

## 概要

Google ML Kit Pose Detectionを使用して、カメラフレームから33個の関節点（ランドマーク）を検出し、リアルタイムで骨格データを取得する基盤を実装するチケットです。この骨格データが、フォーム評価エンジンの入力データになります。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

flutter（フロントエンド）

## 依存チケット

- **011**: ML Kit Pose PoC（技術検証）
- **012**: カメラ機能実装

## 要件

### 機能要件

- FR-013: 姿勢検出機能（ML Kit Pose、33関節点）
- FR-014: フォーム評価機能の基盤

### 非機能要件

- NFR-024: FPS要件（30fps目標、15fps最低）
- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨、0.5最低）
- NFR-007: データ最小化（スケルトンデータのみ送信）

## 受け入れ条件（Todo）

- [ ] ML Kit Pose Detectorを初期化する処理を実装
- [ ] カメラフレームをML Kit Poseに渡す処理を実装
- [ ] 33個の関節点（x, y, z, likelihood）を取得できることを確認
- [ ] 信頼度（likelihood）が0.5以上の関節点のみをフィルタリング
- [ ] 検出された骨格を画面にオーバーレイ表示（デバッグ用）
- [ ] 骨格データをRiverpodプロバイダーに保存
- [ ] FPSを測定し、30fps以上を維持できることを確認
- [ ] 低スペック端末で15fps以上を維持できることを確認（フレームスキップ対応）
- [ ] 骨格検出が失敗した場合のエラーハンドリング（ユーザーへのフィードバック）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-013, FR-014
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-024, NFR-025, NFR-007
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - ML Kit Pose概要、33関節点定義
- `docs/flutter/specs/01_技術スタック_v1_0.md` - ML Kit統合

## 技術詳細

### ファイル構成

```
lib/
├── services/
│   └── pose/
│       ├── pose_detector_service.dart  # ML Kit Poseのラッパークラス
│       └── pose_types.dart             # 関節点の型定義
├── providers/
│   └── pose_provider.dart              # 骨格データのRiverpodプロバイダー
└── widgets/
    └── training/
        └── skeleton_overlay.dart       # 骨格のオーバーレイ表示（デバッグ用）
```

### 型定義（pose_types.dart）

```dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

part 'pose_types.freezed.dart';

/// 姿勢検出結果
@freezed
class PoseDetectionResult with _$PoseDetectionResult {
  const factory PoseDetectionResult({
    required Map<PoseLandmarkType, PoseLandmark> landmarks,  // 全ランドマーク
    required Map<PoseLandmarkType, PoseLandmark> visibleLandmarks,  // 表示用（信頼度 >= 0.5）
    required Map<PoseLandmarkType, PoseLandmark> evaluatableLandmarks,  // 評価用（信頼度 >= 0.8）
    required double avgConfidence,  // 平均信頼度
    required DateTime timestamp,    // タイムスタンプ
    required double fps,            // 現在のFPS
  }) = _PoseDetectionResult;
}

/// FPS計測結果
@freezed
class FPSMetrics with _$FPSMetrics {
  const factory FPSMetrics({
    required double currentFPS,
    required double averageFPS,
    required int totalFrames,
    required int skippedFrames,
  }) = _FPSMetrics;
}
```

### 信頼度閾値設定

骨格検出の品質を確保するため、ランドマークの信頼度（likelihood）に基づいてフィルタリングを行います。

#### ランドマーク信頼度レベル

| 信頼度レベル | 閾値 | 用途 | 説明 |
|------------|------|------|------|
| **高信頼度** | >= 0.8 | フォーム評価に使用 | 正確な角度計算が可能、評価ロジックに利用 |
| **中信頼度** | >= 0.5 | 表示のみ | 骨格の可視化には使用するが、評価には使用しない |
| **低信頼度** | < 0.5 | 非表示 | 検出精度が低いため非表示、ユーザーに姿勢調整を促す |

#### 信頼度フィルタリング実装

```dart
/// 可視性に基づいてランドマークをフィルタリング
Map<PoseLandmarkType, PoseLandmark> filterVisibleLandmarks(
  Map<PoseLandmarkType, PoseLandmark> landmarks,
  double threshold,
) {
  return Map.fromEntries(
    landmarks.entries.where(
      (entry) => entry.value.likelihood >= threshold,
    ),
  );
}

/// フォーム評価用の高信頼度ランドマークのみを取得
Map<PoseLandmarkType, PoseLandmark> getHighConfidenceLandmarks(
  Map<PoseLandmarkType, PoseLandmark> landmarks,
) {
  return filterVisibleLandmarks(landmarks, 0.8);
}

/// 特定の関節点が評価可能かチェック
bool areJointsVisible(
  Map<PoseLandmarkType, PoseLandmark> landmarks,
  List<PoseLandmarkType> types,
) {
  return types.every((type) {
    final landmark = landmarks[type];
    return landmark != null && landmark.likelihood >= 0.8;
  });
}

// 使用例: スクワット評価に必要な関節点の信頼度チェック
final requiredJoints = [
  PoseLandmarkType.leftHip,
  PoseLandmarkType.rightHip,
  PoseLandmarkType.leftKnee,
  PoseLandmarkType.rightKnee,
  PoseLandmarkType.leftAnkle,
  PoseLandmarkType.rightAnkle,
];

if (!areJointsVisible(landmarks, requiredJoints)) {
  // ユーザーに姿勢調整を促すメッセージを表示
  showFeedback('全身が映るように調整してください');
}
```

#### ユーザーフィードバック戦略

低信頼度ランドマークが検出された場合、以下のフィードバックをユーザーに提供します:

1. **全身が映っていない場合**
   - メッセージ: 「全身が映るようにカメラを調整してください」
   - 条件: 下半身（腰、膝、足首）の信頼度 < 0.5

2. **照明が不足している場合**
   - メッセージ: 「明るい場所に移動してください」
   - 条件: 全体的に信頼度が低い（平均 < 0.6）

3. **カメラが遠すぎる/近すぎる場合**
   - メッセージ: 「カメラとの距離を調整してください」
   - 条件: 身体の一部のみが高信頼度

4. **動きが速すぎる場合**
   - メッセージ: 「ゆっくりとした動作で行ってください」
   - 条件: フレーム間の信頼度変動が大きい

### PoseDetectorServiceクラス

```dart
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import 'package:camera/camera.dart';
import 'pose_types.dart';

class PoseDetectorService {
  // 信頼度閾値の定義
  static const double _visibilityThresholdHigh = 0.8;  // フォーム評価用
  static const double _visibilityThresholdLow = 0.5;   // 表示用

  late final PoseDetector _detector;
  int _consecutiveLowConfidenceFrames = 0;
  static const int _maxLowConfidenceFrames = 30;   // 約1秒（30fps想定）

  // FPS計測
  int _frameCount = 0;
  int _lastFPSTime = DateTime.now().millisecondsSinceEpoch;
  double _currentFPS = 0.0;

  PoseDetectorService() {
    _detector = PoseDetector(
      options: PoseDetectorOptions(
        mode: PoseDetectionMode.stream,  // リアルタイム検出
        model: PoseDetectionModel.base,  // 基本モデル（高速）
      ),
    );
  }

  /// 姿勢を検出
  Future<PoseDetectionResult?> detectPose(InputImage inputImage) async {
    try {
      final poses = await _detector.processImage(inputImage);

      if (poses.isEmpty) {
        return null;
      }

      final pose = poses.first;
      final landmarks = pose.landmarks;

      // 表示用フィルタリング（信頼度 >= 0.5）
      final visibleLandmarks = filterVisibleLandmarks(
        landmarks,
        _visibilityThresholdLow,
      );

      // フォーム評価用フィルタリング（信頼度 >= 0.8）
      final evaluatableLandmarks = filterVisibleLandmarks(
        landmarks,
        _visibilityThresholdHigh,
      );

      // 平均信頼度の計算
      final avgConfidence = _calculateAverageConfidence(landmarks);

      // 低信頼度フレームのカウント
      if (avgConfidence < _visibilityThresholdLow) {
        _consecutiveLowConfidenceFrames++;

        // 連続して低信頼度が続く場合、ユーザーに警告
        if (_consecutiveLowConfidenceFrames >= _maxLowConfidenceFrames) {
          _emitLowConfidenceWarning(avgConfidence);
        }
      } else {
        _consecutiveLowConfidenceFrames = 0;
      }

      // FPS計測
      _measureFPS();

      return PoseDetectionResult(
        landmarks: landmarks,
        visibleLandmarks: visibleLandmarks,
        evaluatableLandmarks: evaluatableLandmarks,
        avgConfidence: avgConfidence,
        timestamp: DateTime.now(),
        fps: _currentFPS,
      );
    } catch (e) {
      print('姿勢検出エラー: $e');
      return null;
    }
  }

  /// ランドマークの平均信頼度を計算
  double _calculateAverageConfidence(
    Map<PoseLandmarkType, PoseLandmark> landmarks,
  ) {
    if (landmarks.isEmpty) return 0.0;

    final sum = landmarks.values.fold<double>(
      0.0,
      (sum, landmark) => sum + landmark.likelihood,
    );
    return sum / landmarks.length;
  }

  /// 低信頼度警告を発行
  void _emitLowConfidenceWarning(double avgConfidence) {
    print('[PoseDetector] 低信頼度が継続: ${avgConfidence.toFixed(2)}');
    // イベントを発行してUIに通知
    // TODO: Riverpodプロバイダーに通知
  }

  /// FPSを計測
  void _measureFPS() {
    _frameCount++;
    final now = DateTime.now().millisecondsSinceEpoch;
    final elapsed = now - _lastFPSTime;

    if (elapsed >= 1000) {
      _currentFPS = (_frameCount * 1000) / elapsed;
      _frameCount = 0;
      _lastFPSTime = now;
    }
  }

  /// リソースを解放
  void dispose() {
    _detector.close();
  }
}

extension on double {
  String toFixed(int decimals) => toStringAsFixed(decimals);
}
```

### Riverpodプロバイダー

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'pose_types.dart';
import 'pose_detector_service.dart';

/// 姿勢検出サービスのプロバイダー
final poseDetectorServiceProvider = Provider<PoseDetectorService>((ref) {
  final service = PoseDetectorService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// 現在の姿勢検出結果のプロバイダー
final currentPoseProvider = StateProvider<PoseDetectionResult?>((ref) => null);

/// 検出中フラグのプロバイダー
final isDetectingProvider = StateProvider<bool>((ref) => false);

/// FPSメトリクスのプロバイダー
final fpsMetricsProvider = StateProvider<FPSMetrics>((ref) {
  return const FPSMetrics(
    currentFPS: 0.0,
    averageFPS: 0.0,
    totalFrames: 0,
    skippedFrames: 0,
  );
});
```

### 骨格オーバーレイ表示（デバッグ用）

```dart
import 'package:flutter/material.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import 'pose_types.dart';

class SkeletonOverlay extends CustomPainter {
  final PoseDetectionResult? poseResult;

  SkeletonOverlay(this.poseResult);

  @override
  void paint(Canvas canvas, Size size) {
    if (poseResult == null) return;

    final paint = Paint()
      ..color = Colors.green
      ..strokeWidth = 4
      ..style = PaintingStyle.fill;

    // 各関節を点で描画
    for (final landmark in poseResult!.visibleLandmarks.values) {
      canvas.drawCircle(
        Offset(landmark.x, landmark.y),
        6,
        paint,
      );
    }

    // 骨格の線を描画
    final linePaint = Paint()
      ..color = Colors.greenAccent
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    _drawLine(canvas, linePaint, poseResult!.visibleLandmarks,
      PoseLandmarkType.leftShoulder, PoseLandmarkType.rightShoulder);
    _drawLine(canvas, linePaint, poseResult!.visibleLandmarks,
      PoseLandmarkType.leftShoulder, PoseLandmarkType.leftElbow);
    _drawLine(canvas, linePaint, poseResult!.visibleLandmarks,
      PoseLandmarkType.leftElbow, PoseLandmarkType.leftWrist);
    // 他の関節も同様に描画...
  }

  void _drawLine(
    Canvas canvas,
    Paint paint,
    Map<PoseLandmarkType, PoseLandmark> landmarks,
    PoseLandmarkType from,
    PoseLandmarkType to,
  ) {
    final fromLandmark = landmarks[from];
    final toLandmark = landmarks[to];

    if (fromLandmark != null && toLandmark != null) {
      canvas.drawLine(
        Offset(fromLandmark.x, fromLandmark.y),
        Offset(toLandmark.x, toLandmark.y),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(SkeletonOverlay oldDelegate) => true;
}
```

## 見積もり

- 工数: 3日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **ML Kitモデル**: Google Play Services（Android）またはML Kit SDK（iOS）から自動ダウンロード
- **パフォーマンス最適化**: フレームスキップ、解像度調整を低スペック端末で実装
- **デバッグ表示**: 開発中は骨格のオーバーレイ表示を有効にし、本番ではオフにする
- **Expo版との違い**: Flutter版はML Kitパッケージを使用するため、データ構造が若干異なる（likelihood vs visibility）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、信頼度閾値設定を追加 |
