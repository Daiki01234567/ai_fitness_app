# 011 MediaPipe PoC（技術検証）

## 概要

MediaPipe Poseをreact-native-vision-cameraとML Kitフレームワークと連携させて、Expo/React Nativeで姿勢検出が動作するかを検証するチケットです。Development Buildを使用して、ネイティブモジュールの統合テストを行います。

この検証により、以降のカメラ機能・骨格検出・フォーム評価機能の実装が可能になります。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **002**: Expo開発環境セットアップ（完了済み）

## 要件

### 機能要件

- FR-012: カメラ映像のリアルタイム処理
- FR-013: 姿勢検出機能（MediaPipe Pose、33関節点）
- FR-014: フォーム評価機能の基盤

### 非機能要件

- NFR-007: データ最小化（動画保存せず、スケルトンデータのみ）
- NFR-024: FPS要件（30fps目標、15fps最低）
- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨、0.5最低）

## 受け入れ条件（Todo）

- [ ] react-native-vision-cameraをインストールし、カメラプレビューが表示できることを確認
- [ ] MediaPipe Poseのネイティブモジュール（iOS/Android）をセットアップ
- [ ] Development Buildを作成し、実機でビルドが成功することを確認
- [ ] カメラフレームをMediaPipeに渡し、33関節点が検出されることを確認
- [ ] 検出された関節点のx, y, z, visibilityが取得できることを確認
- [ ] 信頼度（visibility）が0.5以上の関節点のみをフィルタリングできることを確認
- [ ] FPSを測定し、目標30fps、最低15fpsが達成できることを確認
- [ ] 検出結果をログ出力し、データ構造を確認
- [ ] 技術検証レポートを作成（成功条件、制約事項、推奨設定を記載）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-013, FR-014
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-007, NFR-024, NFR-025
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - MediaPipe Pose概要、33関節点定義
- `docs/expo/specs/01_技術スタック_v1_0.md` - MediaPipe統合方法
- `docs/expo/specs/02_開発計画_v1_0.md` - Phase 2スケジュール

## 技術詳細

### パフォーマンス要件詳細

#### 目標FPS
- **高スペックデバイス**: 30fps（目標値）
- **中スペックデバイス**: 24fps（推奨値）
- **低スペックデバイス**: 15fps（最低保証値）

#### パフォーマンス測定方法

1. **フレーム処理時間の計測**
   - 目標: 33ms以下（30fps維持のため）
   - 計測ポイント: MediaPipe処理開始から結果取得まで
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
   - 基準解像度: 640x480（VGA）
   - 中スペック端末: 480x360へフォールバック（処理時間 > 40ms の場合）
   - 低スペック端末: 320x240へフォールバック（処理時間 > 50ms の場合）
   - 解像度変更は動的に実行（パフォーマンスモニタリングに基づく）

2. **モデル軽量化**
   - MediaPipe Pose Lite版の使用（Full版より約30%高速）
   - モデルファイルサイズ: 約3-5MB（Lite版）
   - 精度とのトレードオフ: Lite版でも0.5以上の信頼度を確保

3. **GPU/NPU活用**
   - ハードウェアアクセラレーションの有効化（iOS: CoreML、Android: NNAPI）
   - GPU利用可否の事前チェック
   - CPUフォールバック機能の実装

4. **フレームスキップ制御**
   - 動的FPS調整アルゴリズムの実装（詳細はチケット012を参照）
   - 最大3フレーム連続スキップまで許容
   - スキップ率のログ記録（品質監視用）

### 使用するライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| react-native-vision-camera | 最新 | カメラフレーム取得 |
| @mediapipe/tasks-vision | 最新 | MediaPipe Pose（Web用） |
| react-native-worklets-core | 最新 | フレーム処理の高速化 |

### MediaPipe Poseの出力データ構造

```typescript
interface Landmark {
  x: number;        // 0.0 - 1.0（正規化されたX座標）
  y: number;        // 0.0 - 1.0（正規化されたY座標）
  z: number;        // 任意（深度、腰の中心を0とする）
  visibility: number; // 0.0 - 1.0（信頼度スコア）
}

interface PoseDetectionResult {
  landmarks: Landmark[];  // 33個の関節点
  timestamp: number;      // フレームのタイムスタンプ
}
```

### 検証コマンド

```bash
# 依存関係インストール
npm install react-native-vision-camera @mediapipe/tasks-vision react-native-worklets-core

# Prebuild（ネイティブプロジェクト生成）
npx expo prebuild

# Development Build作成（iOS）
npx expo run:ios

# Development Build作成（Android）
npx expo run:android
```

### FPS測定方法

```typescript
let frameCount = 0;
let lastTime = Date.now();

function measureFPS() {
  frameCount++;
  const now = Date.now();
  const elapsed = now - lastTime;

  if (elapsed >= 1000) {
    const fps = Math.round((frameCount * 1000) / elapsed);
    console.log(`現在のFPS: ${fps}`);
    frameCount = 0;
    lastTime = now;
  }
}
```

### 信頼度フィルタリング

```typescript
function filterVisibleLandmarks(landmarks: Landmark[], threshold: number = 0.5): Landmark[] {
  return landmarks.filter((landmark) => landmark.visibility >= threshold);
}
```

## 見積もり

- 工数: 3日（ネイティブモジュール統合、実機テスト含む）
- 難易度: 高（ネイティブコード統合、Development Build必須）

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **Development Buildが必須**: Expo Goでは動作しないため、実機でのビルドが必要
- **ネイティブコードの知識**: iOSはSwift/Objective-C、AndroidはKotlin/Javaの知識が必要な場合がある
- **低スペック端末対策**: FPSが15fpsを下回る場合は、フレームスキップやダウンサンプリングを検討
- **技術的リスク**: MediaPipeのネイティブモジュール統合が失敗する可能性がある場合、代替案として@tensorflow/tfjs-react-nativeを検討

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
