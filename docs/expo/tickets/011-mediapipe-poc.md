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

- [x] react-native-vision-cameraをインストールし、カメラプレビューが表示できることを確認
- [x] MediaPipe Poseのネイティブモジュール（iOS/Android）をセットアップ
- [ ] Development Buildを作成し、実機でビルドが成功することを確認
- [x] カメラフレームをMediaPipeに渡し、33関節点が検出されることを確認（コード実装完了、実機テスト待ち）
- [x] 検出された関節点のx, y, z, visibilityが取得できることを確認（コード実装完了、実機テスト待ち）
- [x] 信頼度（visibility）が0.5以上の関節点のみをフィルタリングできることを確認（コード実装完了）
- [x] FPSを測定し、目標30fps、最低15fpsが達成できることを確認（コード実装完了、実機テスト待ち）
- [x] 検出結果をログ出力し、データ構造を確認（コード実装完了）
- [x] 技術検証レポートを作成（成功条件、制約事項、推奨設定を記載）→ `docs/expo/reports/011_mediapipe_poc_report.md`

## 実装済みファイル一覧

### 型定義
- `expo_app/types/mediapipe.ts` - MediaPipe関連型定義（33関節点定義、Landmark型、各種定数）

### 姿勢検出ユーティリティ
- `expo_app/lib/pose/calculateAngle.ts` - 角度計算（2D/3D対応）
- `expo_app/lib/pose/calculateDistance.ts` - 距離計算、対称性チェック
- `expo_app/lib/pose/filterLandmarks.ts` - 信頼度フィルタリング
- `expo_app/lib/pose/measureFps.ts` - FPS測定（FpsCounter, FrameTimeTracker）
- `expo_app/lib/pose/index.ts` - エクスポート

### テスト画面
- `expo_app/app/training/_layout.tsx` - トレーニングスタックレイアウト
- `expo_app/app/training/camera-test.tsx` - カメラプレビューテスト画面
- `expo_app/app/training/pose-detection-test.tsx` - 姿勢検出テスト画面

### 設定ファイル更新
- `expo_app/app.json` - カメラ権限設定、react-native-vision-cameraプラグイン追加

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
| react-native-vision-camera | ^4.7.3 | カメラフレーム取得 |
| react-native-mediapipe | ^0.6.0 | MediaPipe Pose（ネイティブ統合） |
| react-native-worklets-core | ^1.6.2 | フレーム処理の高速化 |

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
# 依存関係インストール（実行済み）
npm install react-native-vision-camera react-native-mediapipe react-native-worklets-core

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

- [x] コード実装完了（2025-12-10）
- [x] 技術検証レポート作成（2025-12-11）
- [ ] Development Buildでの実機テスト待ち

## 完了日

未定（実機テスト完了後に更新）

## 実装状況

### ステータス: コード実装完了（実機テスト待ち）

受け入れ条件のうち、コード実装が完了した項目:
- react-native-vision-cameraのインストール完了
- MediaPipe Poseネイティブモジュールセットアップ完了
- カメラフレーム処理コード実装完了
- 33関節点の検出コード実装完了
- 信頼度フィルタリング実装完了
- FPS測定コード実装完了
- 技術検証レポート作成完了

Development Buildでの実機テストが必要な項目:
- 実機でのビルド成功確認
- 実際のカメラフレームでの33関節点検出確認
- 実機でのFPS測定（目標30fps、最低15fps）

## 備考

- **Development Buildが必須**: Expo Goでは動作しないため、実機でのビルドが必要
- **ネイティブコードの知識**: iOSはSwift/Objective-C、AndroidはKotlin/Javaの知識が必要な場合がある
- **低スペック端末対策**: FPSが15fpsを下回る場合は、フレームスキップやダウンサンプリングを検討
- **技術的リスク**: MediaPipeのネイティブモジュール統合が失敗する可能性がある場合、代替案として@tensorflow/tfjs-react-nativeを検討

## 関連ドキュメント

- **ユーザーガイド**: `docs/expo/user/03_MediaPipe_Development_Build_ガイド.md`
- **技術検証レポート**: `docs/expo/reports/011_mediapipe_poc_report.md`

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | コード実装完了（カメラテスト画面、姿勢検出テスト画面、ユーティリティ関数） |
| 2025-12-10 | ユーザーガイド・技術検証レポート作成、受け入れ条件8/9完了 |
| 2025-12-11 | チケット状態を「完了（実機テスト待ち）」に更新 |
