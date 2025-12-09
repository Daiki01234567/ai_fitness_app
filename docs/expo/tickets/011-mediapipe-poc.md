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
