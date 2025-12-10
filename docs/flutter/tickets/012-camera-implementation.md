# 012 カメラ機能実装

## 概要

cameraパッケージを使用して、カメラプレビュー、権限管理、フロント/リアカメラ切り替え機能を実装するチケットです。ML Kit統合の基盤となるカメラ機能を完成させます。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

flutter（フロントエンド）

## 依存チケット

- **011**: ML Kit Pose PoC（技術検証）

## 要件

### 機能要件

- FR-012: カメラ映像のリアルタイム処理
- FR-013: 姿勢検出機能の基盤

### 非機能要件

- NFR-007: データ最小化（動画保存せず、フレームのみ処理）
- NFR-024: FPS要件（30fps目標）
- NFR-026: ユーザビリティ（直感的な操作）

## 受け入れ条件（Todo）

- [ ] カメラ権限をリクエストする機能を実装
- [ ] 権限が拒否された場合、設定画面へ誘導する機能を実装
- [ ] カメラプレビューを全画面で表示する機能を実装
- [ ] フロント/リアカメラを切り替えるボタンを実装
- [ ] カメラプレビューの向き（縦/横）に対応
- [ ] startImageStreamを使用し、フレームを取得できることを確認
- [ ] カメラエラーハンドリング（カメラが使用できない場合のエラー表示）
- [ ] iOSとAndroidの両方で動作することを確認
- [ ] カメラウィジェットを作成し、再利用可能にする

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-013
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-007, NFR-024, NFR-026
- `docs/flutter/specs/01_技術スタック_v1_0.md` - cameraパッケージ
- `docs/flutter/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - トレーニング実行画面

## 技術詳細

### ウィジェット配置

```
lib/
└── widgets/
    └── training/
        └── camera_view.dart     # カメラプレビューウィジェット
```

### カメラ権限の確認

```dart
import 'package:permission_handler/permission_handler.dart';

/// カメラ権限をリクエスト
Future<bool> requestCameraPermission() async {
  final status = await Permission.camera.request();

  if (status.isDenied || status.isPermanentlyDenied) {
    // 設定画面へ誘導
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('カメラ権限が必要です'),
        content: const Text('トレーニング機能を使用するには、カメラへのアクセスを許可してください。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () {
              openAppSettings();
              Navigator.pop(context);
            },
            child: const Text('設定を開く'),
          ),
        ],
      ),
    );
    return false;
  }

  return status.isGranted;
}
```

### カメラプレビューの実装

```dart
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';

class CameraView extends StatefulWidget {
  const CameraView({super.key});

  @override
  State<CameraView> createState() => _CameraViewState();
}

class _CameraViewState extends State<CameraView> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  int _selectedCameraIndex = 0;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    // 利用可能なカメラを取得
    _cameras = await availableCameras();
    if (_cameras.isEmpty) return;

    // 初期カメラ（背面カメラ優先）
    _selectedCameraIndex = _cameras.indexWhere(
      (camera) => camera.lensDirection == CameraLensDirection.back,
    );
    if (_selectedCameraIndex == -1) _selectedCameraIndex = 0;

    // カメラコントローラを作成
    _controller = CameraController(
      _cameras[_selectedCameraIndex],
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.bgra8888,
    );

    // 初期化
    await _controller!.initialize();
    setState(() {});
  }

  /// カメラを切り替え
  Future<void> _switchCamera() async {
    if (_cameras.length <= 1) return;

    // 現在のカメラを停止
    await _controller?.dispose();

    // 次のカメラを選択
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;

    // 新しいカメラコントローラを作成
    _controller = CameraController(
      _cameras[_selectedCameraIndex],
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.bgra8888,
    );

    await _controller!.initialize();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }

    return Stack(
      children: [
        // カメラプレビュー
        CameraPreview(_controller!),

        // カメラ切り替えボタン
        Positioned(
          bottom: 20,
          right: 20,
          child: FloatingActionButton(
            onPressed: _switchCamera,
            child: const Icon(Icons.flip_camera_ios),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
}
```

### フレーム処理の開始

```dart
/// カメラのフレームストリームを開始
Future<void> startImageStream(void Function(CameraImage) onImage) async {
  if (_controller == null || !_controller!.value.isInitialized) {
    throw Exception('カメラが初期化されていません');
  }

  await _controller!.startImageStream(onImage);
}

/// カメラのフレームストリームを停止
Future<void> stopImageStream() async {
  if (_controller == null) return;
  await _controller!.stopImageStream();
}
```

## フレームスキップ制御

### アルゴリズム概要

フレームスキップ制御により、デバイスの処理能力に応じて動的にFPSを調整し、安定したパフォーマンスを実現します。

#### 基本アルゴリズム

```dart
/// フレームスキップ制御クラス
/// デバイスの処理能力に応じて動的にFPSを調整
class FrameSkipController {
  int _lastProcessedTime = 0;
  int _targetInterval = (1000 / 30).round(); // 30fps = 33.3ms間隔
  int _consecutiveSkips = 0;
  static const int _maxConsecutiveSkips = 3;

  /// フレームを処理すべきかどうかを判定
  /// @param currentTime 現在のタイムスタンプ（ミリ秒）
  /// @returns true: 処理する、false: スキップする
  bool shouldProcessFrame(int currentTime) {
    final elapsed = currentTime - _lastProcessedTime;

    // 目標インターバルを超えた場合、または連続スキップが上限に達した場合
    if (elapsed >= _targetInterval || _consecutiveSkips >= _maxConsecutiveSkips) {
      _lastProcessedTime = currentTime;
      _consecutiveSkips = 0;
      return true;
    }

    // スキップ
    _consecutiveSkips++;
    return false;
  }

  /// 動的FPS調整
  /// ML Kit処理時間に応じてターゲットFPSを調整
  /// @param processingTime ML Kit処理にかかった時間（ミリ秒）
  void adjustTargetFPS(int processingTime) {
    if (processingTime > 50) {
      // 処理が重い場合は15fpsに落とす
      _targetInterval = (1000 / 15).round(); // 66.7ms
      print('[FrameSkip] FPS調整: 15fps（処理時間: ${processingTime}ms）');
    } else if (processingTime > 33) {
      // やや重い場合は24fpsに
      _targetInterval = (1000 / 24).round(); // 41.7ms
      print('[FrameSkip] FPS調整: 24fps（処理時間: ${processingTime}ms）');
    } else {
      // 正常時は30fps
      _targetInterval = (1000 / 30).round(); // 33.3ms
    }
  }

  /// スキップ率の取得（デバッグ用）
  double getSkipRate() {
    // 実装は省略（フレーム総数とスキップ数から計算）
    return 0.0;
  }
}
```

#### 使用例

```dart
final frameSkipController = FrameSkipController();
bool _isProcessing = false;

void _processFrame(CameraImage image) async {
  final currentTime = DateTime.now().millisecondsSinceEpoch;

  // フレームをスキップすべきかチェック
  if (!frameSkipController.shouldProcessFrame(currentTime)) {
    return; // このフレームはスキップ
  }

  // 処理中の場合もスキップ
  if (_isProcessing) return;
  _isProcessing = true;

  try {
    // ML Kit処理（時間計測）
    final startTime = DateTime.now().millisecondsSinceEpoch;
    final poseResult = await detectPose(image);
    final processingTime = DateTime.now().millisecondsSinceEpoch - startTime;

    // 処理時間に応じてFPSを動的調整
    frameSkipController.adjustTargetFPS(processingTime);

    // 結果をストアに保存
    updatePoseStore(poseResult);
  } finally {
    _isProcessing = false;
  }
}
```

### 実装上の注意点

1. **フレームドロップ時のUI更新**
   - フレームをスキップしても、UI（カメラプレビュー、FPS表示など）は継続して更新すること
   - ユーザーにはカメラが停止しているように見えないようにする

2. **連続フレームスキップの制限**
   - 最大3フレーム連続スキップまで（約100ms）
   - それ以上スキップすると、フォーム評価の精度が低下する
   - 3フレームスキップ後は、必ず次のフレームを処理する

3. **スキップ率のログ記録**
   - 品質監視のため、スキップ率をログに記録
   - 1分ごとに集計し、以下の情報を記録:
     ```dart
     class FrameSkipMetrics {
       final int totalFrames;        // 総フレーム数
       final int skippedFrames;      // スキップしたフレーム数
       final double skipRate;        // スキップ率（0.0 - 1.0）
       final double averageFPS;      // 平均FPS
       final int currentTargetFPS;   // 現在のターゲットFPS
       final String deviceModel;     // デバイスモデル
       final DateTime timestamp;     // タイムスタンプ
     }
     ```

4. **パフォーマンスモニタリング**
   - FPS低下の原因を特定するため、以下を記録:
     - ML Kit処理時間
     - フレーム解像度
     - メモリ使用量
     - CPU使用率（可能な場合）

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **権限管理**: iOSはInfo.plist、AndroidはAndroidManifest.xmlに権限を追加する必要あり
- **パフォーマンス**: startImageStreamは頻繁に呼ばれるため、処理を軽量に保つこと
- **Expo版との違い**: FlutterのcameraパッケージはReact Native Vision Cameraとほぼ同等の機能を提供

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、フレームスキップ制御アルゴリズムを追加 |
