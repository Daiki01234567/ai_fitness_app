# Ticket #020: MediaPipe技術検証（PoC）

**Phase**: Phase 2 開始前（技術検証）
**期間**: 2-3週間
**優先度**: 最高
**ステータス**: 未着手
**最終更新**: 2025-12-09
**関連仕様書**:
- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` (FR-004)
- `docs/expo/specs/02_要件定義書_Expo版_v1_Part2.md` (NFR-002, NFR-043)
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md`

## 概要

Phase 2のコア機能である「フォーム確認補助（MediaPipe）」を実装する前に、Expo（React Native）環境でMediaPipeが期待通り動作するかを検証します。

**なぜこの検証が必要なの？**

MediaPipeはGoogleが開発したAI技術で、カメラ映像から人の体の関節（33箇所）を検出できます。しかし、Expo/React Nativeでの動作は技術的な課題があるため、本格的な開発を始める前に「本当に動くか」を確認する必要があります。

## 検証の目標

| 項目 | 目標値 | 説明 |
|-----|-------|------|
| フレームレート | 30fps以上 | 1秒間に30回以上、骨格を検出できること |
| iOS対応 | 動作確認 | iPhoneで問題なく動くこと |
| Android対応 | 動作確認 | Androidスマホで問題なく動くこと |
| メモリ使用量 | 安定動作 | アプリがクラッシュしないこと |

## Todo リスト

### Development Build環境の準備

Development Buildとは、Expo Goでは使えない機能（ネイティブモジュール）を使うための特別なビルド方法です。

#### 基本設定
- [ ] EAS CLI（Expo Application Services）のインストール
  ```bash
  npm install -g eas-cli
  eas login
  ```
- [ ] EASプロジェクトの初期化
  ```bash
  eas build:configure
  ```
- [ ] `eas.json` の設定
  ```json
  {
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      }
    }
  }
  ```

#### Development Buildの作成
- [ ] iOS用Development Build作成
  ```bash
  eas build --platform ios --profile development
  ```
- [ ] Android用Development Build作成
  ```bash
  eas build --platform android --profile development
  ```
- [ ] 実機へのインストール確認

### react-native-vision-cameraの導入

react-native-vision-cameraは、React Nativeでカメラを使うためのライブラリです。

#### パッケージインストール
- [ ] ライブラリのインストール
  ```bash
  npx expo install react-native-vision-camera
  ```
- [ ] Expoの設定（`app.json`）に追加
  ```json
  {
    "expo": {
      "plugins": [
        [
          "react-native-vision-camera",
          {
            "cameraPermissionText": "トレーニング中のフォーム確認補助に使用します"
          }
        ]
      ]
    }
  }
  ```

#### 基本動作確認
- [ ] カメラプレビューの表示
- [ ] 前面/背面カメラの切り替え
- [ ] フレームレート設定（30fps）

### MediaPipe統合の検証

#### 方法1: react-native-mediapipe（推奨）
- [ ] ライブラリのインストール
  ```bash
  npm install react-native-mediapipe
  ```
- [ ] Pose Landmarker（骨格検出）の初期化
- [ ] 33関節点の検出確認
- [ ] フレームレート計測

#### 方法2: VisionCameraのFrame Processor
Frame Processorは、カメラの各フレーム（画像）を処理するための仕組みです。
- [ ] Frame Processorプラグインの設定
- [ ] MediaPipe Poseモデルの読み込み
- [ ] リアルタイム処理の実装

#### 代替案: TensorFlow.js
MediaPipeが動作しない場合の代替手段です。
- [ ] TensorFlow.js + PoseNetの動作確認
- [ ] パフォーマンス比較

### パフォーマンス計測

#### フレームレート計測
- [ ] iOS実機での計測（目標: 30fps以上）
- [ ] Android実機での計測（目標: 30fps以上）
- [ ] 低スペック端末での計測（目標: 20fps以上）

#### メモリ使用量
- [ ] 長時間動作テスト（5分間）
- [ ] メモリリークの確認
- [ ] クラッシュ発生有無

#### 計測用コード例
```typescript
const [fps, setFps] = useState(0);
const frameCount = useRef(0);
const lastTime = useRef(Date.now());

const onFrame = useCallback(() => {
  frameCount.current++;
  const now = Date.now();
  const elapsed = now - lastTime.current;

  if (elapsed >= 1000) {
    setFps(frameCount.current);
    frameCount.current = 0;
    lastTime.current = now;
  }
}, []);
```

### 検証結果のドキュメント化

- [ ] 検証結果レポートの作成
  - 使用ライブラリ
  - 各プラットフォームでの動作結果
  - フレームレート実測値
  - 発生した問題と解決策
- [ ] Phase 2実装方針の決定
- [ ] 代替案の必要性判断

## 検証環境

### テスト端末

| 端末 | OS | スペック | 目的 |
|-----|----|---------|----- |
| iPhone 14 | iOS 17.x | ハイエンド | 推奨動作確認 |
| iPhone 11 | iOS 15.x | ミッドレンジ | 最低動作確認 |
| Pixel 7 | Android 14 | ハイエンド | 推奨動作確認 |
| Galaxy A52 | Android 12 | ミッドレンジ | 最低動作確認 |

### 技術スタック

| ライブラリ | バージョン | 用途 |
|-----------|----------|------|
| expo | SDK 52+ | 開発フレームワーク |
| react-native-vision-camera | 最新 | カメラアクセス |
| react-native-mediapipe | 最新 | 骨格検出 |

## 期待される成果物

1. **動作確認済みのサンプルアプリ**
   - カメラプレビュー表示
   - リアルタイム骨格検出
   - 33関節点の表示

2. **検証結果レポート**
   - 各端末でのパフォーマンス実測値
   - 技術的課題と解決策
   - 推奨実装方針

3. **Phase 2実装ガイド**
   - 採用ライブラリの決定
   - 実装手順書
   - 注意事項

## 判断基準

### 成功の条件

| 条件 | 内容 |
|-----|------|
| iOS | 30fps以上でMediaPipeが動作する |
| Android | 30fps以上でMediaPipeが動作する |
| 安定性 | 5分間のテストでクラッシュしない |

### 代替案を検討する条件

| 条件 | 対応 |
|-----|------|
| 30fps未達成 | TensorFlow.jsへの切り替えを検討 |
| 特定端末で動かない | 端末制限を検討 |
| 両方で動かない | Flutter版の検討 |

## 注意事項

- **プライバシー**: カメラ映像はデバイス内でのみ処理し、外部に送信しません
- **バッテリー消費**: 長時間のカメラ使用はバッテリーを消耗するため、最適化が必要です
- **発熱対策**: 高負荷処理が続くと端末が熱くなるため、監視が必要です

## 参考リンク

- [react-native-vision-camera](https://react-native-vision-camera.com/)
- [react-native-mediapipe](https://github.com/nickhoos/react-native-mediapipe)
- [MediaPipe Pose](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
- [TensorFlow.js Pose Detection](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
