# 022 骨格検出基盤

## 概要

カメラ映像からリアルタイムで人体の骨格（33関節）を検出する機能を実装します。MediaPipe PoseとVision Cameraのフレームプロセッサを連携させて、高速な骨格検出を実現します。

## Phase

Phase 2（機能実装）

## 依存チケット

- 020: MediaPipe技術検証（PoC）
- 021: カメラ機能実装

## 要件

### 機能要件

1. **33関節の検出**
   - MediaPipe Poseで定義された33個の関節を検出
   - 各関節のx, y, z座標と信頼度（visibility）を取得
   - リアルタイムで毎フレーム処理

2. **フレームプロセッサ**
   - Vision Cameraのフレームプロセッサを使用
   - Worklet（別スレッド）でAI処理を実行
   - UIスレッドをブロックしない設計

3. **骨格データの提供**
   - 検出した骨格データをReactコンポーネントに提供
   - 型安全なデータ構造

### 非機能要件

- フレームレート: 30fps以上（最低15fps）
- 検出遅延: 100ms以下
- 信頼度しきい値: 0.7以上の関節のみ有効

## 受け入れ条件

- [ ] カメラ映像から33関節を検出できる
- [ ] 各関節のx, y, z座標が取得できる
- [ ] 各関節の信頼度（visibility）が取得できる
- [ ] 30fps以上で処理できる（最低15fps）
- [ ] UIがブロックされない（スムーズに動作）
- [ ] 骨格データがReactコンポーネントで使用できる

## 参照ドキュメント

| ドキュメント | パス | 該当セクション |
|-------------|------|----------------|
| 要件定義書 Part 4 | `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` | 2.1.2 検出できる33個の関節 |
| 要件定義書 Part 2 | `docs/expo/specs/02_要件定義書_Expo版_v1_Part2.md` | NFR-024, NFR-025 |

## 技術詳細

### 33関節のインデックス

```typescript
// MediaPipe Poseの関節インデックス
export enum PoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}
```

### データ構造

```typescript
// 1つの関節データ
export interface Landmark {
  x: number;        // 0.0 - 1.0 (画面の左端が0、右端が1)
  y: number;        // 0.0 - 1.0 (画面の上端が0、下端が1)
  z: number;        // 深度（カメラからの距離）
  visibility: number; // 0.0 - 1.0 (信頼度)
}

// 全身の骨格データ
export interface PoseData {
  landmarks: Landmark[];  // 33個の関節
  timestamp: number;      // 検出時刻
}

// フレームプロセッサの結果
export interface FrameProcessorResult {
  pose: PoseData | null;  // 検出された骨格（検出できなかった場合はnull）
  fps: number;            // 現在のフレームレート
}
```

### ディレクトリ構成

```
src/
├── features/
│   └── pose-detection/
│       ├── types/
│       │   ├── landmark.ts       # 関節の型定義
│       │   └── pose.ts           # 骨格データの型定義
│       ├── processors/
│       │   └── poseProcessor.ts  # フレームプロセッサ
│       ├── hooks/
│       │   └── usePoseDetection.ts # 骨格検出フック
│       └── index.ts
```

### フレームプロセッサの実装

```typescript
// poseProcessor.ts
import { Frame } from 'react-native-vision-camera';
import { PoseData } from '../types/pose';

// Worklet関数（別スレッドで実行）
export const processPoseFrame = (frame: Frame): PoseData | null => {
  'worklet';

  // MediaPipe Poseで骨格検出
  // (実際の実装は020の検証結果に基づく)

  return poseData;
};
```

```typescript
// usePoseDetection.ts
import { useFrameProcessor } from 'react-native-vision-camera';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

export const usePoseDetection = () => {
  const [poseData, setPoseData] = useState<PoseData | null>(null);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const pose = processPoseFrame(frame);
    runOnJS(setPoseData)(pose);
  }, []);

  return { poseData, frameProcessor };
};
```

### 信頼度フィルタリング

```typescript
// 信頼度が低い関節をフィルタリング
const VISIBILITY_THRESHOLD = 0.7;

export const filterLowConfidenceLandmarks = (landmarks: Landmark[]): Landmark[] => {
  return landmarks.map(landmark => ({
    ...landmark,
    // 信頼度が低い場合はNaNで無効化
    x: landmark.visibility >= VISIBILITY_THRESHOLD ? landmark.x : NaN,
    y: landmark.visibility >= VISIBILITY_THRESHOLD ? landmark.y : NaN,
    z: landmark.visibility >= VISIBILITY_THRESHOLD ? landmark.z : NaN,
  }));
};
```

## 注意事項

1. **Workletの制約**
   - Worklet内ではJavaScriptの一部機能が使えない
   - console.logは使えない（デバッグはrunOnJSで）
   - async/awaitは使えない

2. **メモリ管理**
   - フレームごとにオブジェクトを生成するため、GCが発生しやすい
   - オブジェクトプールを検討

3. **パフォーマンス**
   - 重い処理はフレームをスキップする
   - FPSが低下した場合の警告表示

4. **プラットフォーム差異**
   - iOS/Androidで座標系が異なる場合がある
   - 正規化（0-1）された座標を使用

## 見積もり

| 作業内容 | 見積もり時間 |
|----------|--------------|
| 型定義作成 | 2時間 |
| フレームプロセッサ基盤 | 6時間 |
| MediaPipe連携 | 8時間 |
| usePoseDetectionフック | 4時間 |
| パフォーマンス最適化 | 4時間 |
| テスト・デバッグ | 4時間 |
| **合計** | **28時間** |

## 進捗

### ステータス: 未着手

### Todo

- [ ] 型定義ファイル作成（landmark.ts, pose.ts）
- [ ] PoseLandmark enum作成
- [ ] フレームプロセッサ基盤実装
- [ ] MediaPipe/TensorFlow.js連携（020の結果に基づく）
- [ ] usePoseDetectionフック作成
- [ ] 信頼度フィルタリング実装
- [ ] FPS計測機能追加
- [ ] iOS動作確認
- [ ] Android動作確認
- [ ] パフォーマンステスト

### 作業ログ

| 日付 | 作業内容 | 担当者 |
|------|----------|--------|
| - | - | - |

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| 1.0 | 2025年12月9日 | 初版作成 |
