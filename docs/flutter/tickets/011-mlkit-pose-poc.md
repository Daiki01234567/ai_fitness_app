# 011 ML Kit Pose PoC（技術検証）

## 概要

Google ML Kit Pose Detectionをcameraパッケージと連携させて、Flutter/Dartで姿勢検出が動作するかを検証するチケットです。実機でのテストを行い、パフォーマンスと精度を確認します。

この検証により、以降のカメラ機能・骨格検出・フォーム評価機能の実装が可能になります。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

flutter（フロントエンド）

## 依存チケット

- **002**: Flutter開発環境セットアップ（完了済み）

## 要件

### 機能要件

- FR-012: カメラ映像のリアルタイム処理
- FR-013: 姿勢検出機能（ML Kit Pose、33関節点）
- FR-014: フォーム評価機能の基盤

### 非機能要件

- NFR-007: データ最小化（動画保存せず、スケルトンデータのみ）
- NFR-024: FPS要件（30fps目標、15fps最低）
- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨、0.5最低）

## 受け入れ条件（Todo）

- [ ] google_mlkit_pose_detectionとcameraパッケージをインストール
- [ ] カメラプレビューが表示できることを確認
- [ ] ML Kit Pose Detectorをセットアップ
- [ ] 実機でビルドが成功することを確認（iOS/Android）
- [ ] カメラフレームをML Kitに渡し、33関節点が検出されることを確認
- [ ] 検出された関節点のx, y, z, likelihoodが取得できることを確認
- [ ] 信頼度（likelihood）が0.5以上の関節点のみをフィルタリングできることを確認
- [ ] FPSを測定し、目標30fps、最低15fpsが達成できることを確認
- [ ] 検出結果をログ出力し、データ構造を確認
- [ ] 技術検証レポートを作成（成功条件、制約事項、推奨設定を記載）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-013, FR-014
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-007, NFR-024, NFR-025
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - ML Kit Pose概要、33関節点定義
- `docs/flutter/specs/01_技術スタック_v1_0.md` - ML Kit統合方法
- `docs/flutter/specs/02_開発計画_v1_0.md` - Phase 2スケジュール

## 技術詳細

### パフォーマンス要件詳細

#### 目標FPS
- **高スペックデバイス**: 30fps（目標値）
- **中スペックデバイス**: 24fps（推奨値）
- **低スペックデバイス**: 15fps（最低保証値）

#### パフォーマンス測定方法

1. **フレーム処理時間の計測**
   - 目標: 33ms以下（30fps維持のため）
   - 計測ポイント: ML Kit処理開始から結果取得まで
   - 警告閾値: 50ms以上（処理遅延の兆候）

2. **メモリ使用量のモニタリング**
   - 上限: 200MB（アプリ全体のメモリ使用量）
   - モニタリング間隔: 5秒ごと
   - メモリリーク検出: 連続5分間で50MB以上の増加

3. **バッテリー消費率の確認**
   - 計測方法: 10分間のトレーニングセッション中のバッテリー消費量
   - 目標: 10分間で5%以下の消費
   - 記録: デバイスモデル、OS バージョン、消費率をログ記録

#### パフォーマンス最適化戦略

1. **解像度調整**
   - 基準解像度: 640x480（VGA）相当のResolutionPreset.medium
   - 中スペック端末: ResolutionPreset.lowへフォールバック（処理時間 > 40ms の場合）
   - 低スペック端末: さらに低解像度へフォールバック（処理時間 > 50ms の場合）
   - 解像度変更は動的に実行（パフォーマンスモニタリングに基づく）

2. **モデル軽量化**
   - ML Kit Pose Base版の使用（Accurate版より約30%高速）
   - モデルはGoogle Play ServicesまたはApple Frameworksから自動ダウンロード
   - 精度とのトレードオフ: Base版でも0.5以上の信頼度を確保

3. **ハードウェアアクセラレーション活用**
   - iOS: Core MLによるハードウェアアクセラレーション（自動適用）
   - Android: NNAPI（Neural Networks API）による高速化（自動適用）
   - GPU利用可否は自動判定される

4. **フレームスキップ制御**
   - 動的FPS調整アルゴリズムの実装（詳細はチケット012を参照）
   - 最大3フレーム連続スキップまで許容
   - スキップ率のログ記録（品質監視用）

### 使用するパッケージ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| google_mlkit_pose_detection | ^0.11.0+1 | ML Kit Pose検出 |
| camera | ^0.10.5+9 | カメラフレーム取得 |
| permission_handler | ^11.3.1 | カメラ権限管理 |

### ML Kit Poseの出力データ構造

```dart
// PoseLandmark構造
class PoseLandmark {
  final double x;           // 0.0 - 画像幅（ピクセル座標）
  final double y;           // 0.0 - 画像高（ピクセル座標）
  final double z;           // 任意（深度、腰の中心を0とする）
  final double likelihood;  // 0.0 - 1.0（信頼度スコア）
}

// Pose構造
class Pose {
  final Map<PoseLandmarkType, PoseLandmark> landmarks;  // 33個の関節点
}
```

### 検証コマンド

```bash
# 依存関係インストール
flutter pub get

# iOS実機で実行
flutter run -d ios

# Android実機で実行
flutter run -d android

# 静的解析
flutter analyze
```

### FPS測定方法

```dart
class FPSCounter {
  int _frameCount = 0;
  int _lastTime = DateTime.now().millisecondsSinceEpoch;

  void measureFPS() {
    _frameCount++;
    final now = DateTime.now().millisecondsSinceEpoch;
    final elapsed = now - _lastTime;

    if (elapsed >= 1000) {
      final fps = (_frameCount * 1000) ~/ elapsed;
      print('現在のFPS: $fps');
      _frameCount = 0;
      _lastTime = now;
    }
  }
}
```

### 信頼度フィルタリング

```dart
/// 可視性に基づいてランドマークをフィルタリング
Map<PoseLandmarkType, PoseLandmark> filterVisibleLandmarks(
  Map<PoseLandmarkType, PoseLandmark> landmarks,
  double threshold = 0.5,
) {
  return Map.fromEntries(
    landmarks.entries.where(
      (entry) => entry.value.likelihood >= threshold,
    ),
  );
}
```

## 見積もり

- 工数: 3日（実機テスト、パフォーマンス測定含む）
- 難易度: 中（ML Kitはパッケージとして提供されているため、Expo版より容易）

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **実機テストが必須**: シミュレータ/エミュレータでは正確なパフォーマンス測定ができない
- **Expo版との違い**: Flutter版はML Kitパッケージを使用するため、ネイティブモジュール統合が不要
- **低スペック端末対策**: FPSが15fpsを下回る場合は、フレームスキップやダウンサンプリングを検討
- **iOS/Android差異**: iOSではCore ML、AndroidではNNAPIが自動で使用されるため、プラットフォーム固有の最適化は不要

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、パフォーマンス要件詳細を追加 |
