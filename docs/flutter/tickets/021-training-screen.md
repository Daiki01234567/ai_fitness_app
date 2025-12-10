# 021 トレーニング実行画面

## 概要

トレーニングを実行するメイン画面を実装するチケットです。カメラプレビュー、骨格検出のオーバーレイ表示、リアルタイムのフォーム評価フィードバック、レップカウント、セット管理などを含みます。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 012: カメラ機能実装
- 013: 骨格検出基盤
- 020: メニュー選択画面

## 要件

### 機能要件

- FR-009: ユーザーは5種目のいずれかを選択してトレーニングを開始できる
- FR-010: リアルタイムでフォームが評価され、フィードバックが表示される
- FR-011: レップ数が自動的にカウントされる
- FR-012: セット間の休憩タイマー機能がある

### 非機能要件

- NFR-024: 姿勢検出は30fpsで動作する（低スペックデバイスは15fps以上）
- NFR-025: カメラプレビューの遅延は200ms以内

## 受け入れ条件（Todo）

- [ ] カメラプレビューが全画面で表示される
- [ ] 骨格検出結果が半透明のオーバーレイで描画される
- [ ] 選択した種目の評価ロジックが実行される
- [ ] リアルタイムでフォームスコア（0-100点）が表示される
- [ ] レップ数が自動的にカウントされて画面に表示される
- [ ] セット完了後に休憩タイマーが自動的に開始される
- [ ] トレーニング中断ボタンがある
- [ ] トレーニング終了後、結果画面（022）に遷移する
- [ ] 低スペックデバイスで15fps以上を維持できることを確認
- [ ] メモリリークがないことを確認（長時間実行テスト）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-009, FR-010, FR-011, FR-012
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-024, NFR-025
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - 評価アルゴリズム

## 技術詳細

### 画面構成

```dart
// lib/screens/training/training_screen.dart
class TrainingScreen extends ConsumerStatefulWidget {
  final ExerciseType exerciseType;

  @override
  ConsumerState<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends ConsumerState<TrainingScreen> {
  late CameraController _cameraController;
  late PoseDetector _poseDetector;
  late FormEvaluator _formEvaluator;

  int _repCount = 0;
  int _currentSet = 1;
  double _formScore = 0.0;
  String _feedback = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // カメラプレビュー（全画面）
          CameraPreview(_cameraController),

          // 骨格オーバーレイ
          CustomPaint(
            painter: PosePainter(poses: _currentPoses),
          ),

          // UI オーバーレイ
          SafeArea(
            child: Column(
              children: [
                // ヘッダー（種目名、中断ボタン）
                _buildHeader(),

                Spacer(),

                // メトリクス表示
                _buildMetrics(),

                // フィードバックメッセージ
                _buildFeedback(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

### カメラとML Kitの統合

```dart
// カメラフレーム処理
void _processCameraImage(CameraImage image) async {
  if (_isProcessing) return;
  _isProcessing = true;

  try {
    // InputImageに変換
    final inputImage = _convertToInputImage(image);

    // 姿勢検出
    final poses = await _poseDetector.processImage(inputImage);

    if (poses.isNotEmpty) {
      // フォーム評価
      final result = _formEvaluator.evaluate(poses.first);

      setState(() {
        _currentPoses = poses;
        _formScore = result.score;
        _feedback = result.feedback;

        // レップカウント更新
        if (result.repCompleted) {
          _repCount++;
          _onRepCompleted();
        }
      });
    }
  } finally {
    _isProcessing = false;
  }
}
```

### メトリクス表示

```dart
Widget _buildMetrics() {
  return Container(
    padding: EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.black.withOpacity(0.5),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      children: [
        // レップカウント
        Text(
          'レップ: $_repCount',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),

        SizedBox(height: 8),

        // セット表示
        Text(
          'セット: $_currentSet / 3',
          style: TextStyle(fontSize: 18, color: Colors.white70),
        ),

        SizedBox(height: 8),

        // フォームスコア
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('フォーム: ', style: TextStyle(color: Colors.white70)),
            Text(
              '${_formScore.toInt()}点',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: _getScoreColor(_formScore),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

Color _getScoreColor(double score) {
  if (score >= 80) return Colors.green;
  if (score >= 60) return Colors.orange;
  return Colors.red;
}
```

### 休憩タイマー

```dart
void _startRestTimer() {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => RestTimerDialog(
      duration: Duration(seconds: 60),
      onComplete: () {
        Navigator.of(context).pop();
        _startNextSet();
      },
    ),
  );
}

class RestTimerDialog extends StatefulWidget {
  final Duration duration;
  final VoidCallback onComplete;

  // ... タイマー実装
}
```

### 状態管理（Riverpod）

```dart
// lib/providers/training_provider.dart
@riverpod
class TrainingSession extends _$TrainingSession {
  @override
  TrainingSessionState build() {
    return TrainingSessionState.initial();
  }

  void updateMetrics({
    required int repCount,
    required int currentSet,
    required double formScore,
  }) {
    state = state.copyWith(
      repCount: repCount,
      currentSet: currentSet,
      formScore: formScore,
    );
  }

  void completeSet() {
    // セット完了処理
  }

  Future<void> endSession() async {
    // セッション終了、Firestoreに保存
  }
}
```

### パフォーマンス最適化

```dart
// フレームスキップ制御
class FrameThrottler {
  final int targetFps;
  DateTime? _lastProcessTime;

  FrameThrottler(this.targetFps);

  bool shouldProcess() {
    final now = DateTime.now();
    if (_lastProcessTime == null) {
      _lastProcessTime = now;
      return true;
    }

    final elapsed = now.difference(_lastProcessTime!);
    final minInterval = Duration(milliseconds: 1000 ~/ targetFps);

    if (elapsed >= minInterval) {
      _lastProcessTime = now;
      return true;
    }

    return false;
  }
}
```

## 見積もり

- 工数: 5日
- 難易度: 高（リアルタイム処理、複雑なUI）

## 進捗

- [ ] 未着手

## 完了日

未定

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（Flutter/Dart）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → ML Kit → 骨格座標取得（33関節点）
2. フロントエンド: フォーム評価ロジック実行（Dart）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

### 重要な設計原則
- **プライバシーファースト**: カメラ映像は絶対にサーバーに送信しない
- **リアルタイム処理**: 30fps（最低15fps）でフレーム単位の評価を実行
- **オフライン対応**: ネットワーク不要でトレーニング可能（結果保存時のみオンライン）

### 評価ロジックの実装について
- 各種目の評価ロジック（角度計算、レップカウントなど）はFlutter側で実装
- TypeScript版（`docs/common/specs/06_フォーム評価ロジック_v1_0.md`）をDartに移植
- Expo版のチケット014-019を参考に、Dart版の評価ロジックを実装

## 備考

- カメラ権限はチケット012で実装済み
- 姿勢検出の基盤はチケット013で実装済み
- 各種目の評価ロジック（Dart版）は別途実装が必要（Expo版のチケット014-019を参考）
- 音声フィードバックはチケット023で実装（オプション）
- セッション結果の保存はチケット022で実装

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
