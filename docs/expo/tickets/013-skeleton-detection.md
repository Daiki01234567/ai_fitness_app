# 013 骨格検出基盤

## 概要

MediaPipe Poseを使用して、カメラフレームから33個の関節点（ランドマーク）を検出し、リアルタイムで骨格データを取得する基盤を実装するチケットです。この骨格データが、フォーム評価エンジンの入力データになります。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **011**: MediaPipe PoC（技術検証）
- **012**: カメラ機能実装

## 要件

### 機能要件

- FR-013: 姿勢検出機能（MediaPipe Pose、33関節点）
- FR-014: フォーム評価機能の基盤

### 非機能要件

- NFR-024: FPS要件（30fps目標、15fps最低）
- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨、0.5最低）
- NFR-007: データ最小化（スケルトンデータのみ送信）

## 受け入れ条件（Todo）

- [ ] MediaPipe Poseのモデルファイルをアプリにバンドル
- [ ] カメラフレームをMediaPipe Poseに渡す処理を実装
- [ ] 33個の関節点（x, y, z, visibility）を取得できることを確認
- [ ] 信頼度（visibility）が0.5以上の関節点のみをフィルタリング
- [ ] 検出された骨格を画面にオーバーレイ表示（デバッグ用）
- [ ] 骨格データをZustandストアに保存
- [ ] FPSを測定し、30fps以上を維持できることを確認
- [ ] 低スペック端末で15fps以上を維持できることを確認（フレームスキップ対応）
- [ ] 骨格検出が失敗した場合のエラーハンドリング（ユーザーへのフィードバック）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-013, FR-014
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-024, NFR-025, NFR-007
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - MediaPipe Pose概要、33関節点定義
- `docs/expo/specs/01_技術スタック_v1_0.md` - MediaPipe統合

## 技術詳細

### ファイル構成

```
services/
└── mediapipe/
    ├── PoseDetector.ts        # MediaPipe Poseのラッパークラス
    └── types.ts               # 関節点の型定義

store/
└── poseStore.ts               # 骨格データのZustandストア

components/
└── training/
    └── SkeletonOverlay.tsx    # 骨格のオーバーレイ表示（デバッグ用）
```

### 型定義（types.ts）

```typescript
export interface Landmark {
  x: number;        // 0.0 - 1.0（正規化されたX座標）
  y: number;        // 0.0 - 1.0（正規化されたY座標）
  z: number;        // 任意（深度、腰の中心を0とする）
  visibility: number; // 0.0 - 1.0（信頼度スコア）
}

export interface PoseDetectionResult {
  landmarks: Landmark[];  // 33個の関節点
  timestamp: number;      // フレームのタイムスタンプ
  fps: number;            // 現在のFPS
}

export enum LandmarkIndex {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  LEFT_MOUTH = 9,
  RIGHT_MOUTH = 10,
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

### PoseDetectorクラス

```typescript
export class PoseDetector {
  private visibilityThreshold: number = 0.5;

  async detectPose(frame: Frame): Promise<PoseDetectionResult | null> {
    try {
      const result = await this.runMediaPipePose(frame);

      if (!result || !result.landmarks) {
        return null;
      }

      // 信頼度でフィルタリング
      const filteredLandmarks = result.landmarks.filter(
        (landmark) => landmark.visibility >= this.visibilityThreshold
      );

      return {
        landmarks: filteredLandmarks,
        timestamp: Date.now(),
        fps: this.calculateFPS(),
      };
    } catch (error) {
      console.error('Pose detection error:', error);
      return null;
    }
  }

  private calculateFPS(): number {
    // FPS計算ロジック（011で実装済み）
  }
}
```

### Zustandストア

```typescript
interface PoseStore {
  currentPose: PoseDetectionResult | null;
  isDetecting: boolean;
  fps: number;
  updatePose: (pose: PoseDetectionResult) => void;
  startDetection: () => void;
  stopDetection: () => void;
}

export const usePoseStore = create<PoseStore>((set) => ({
  currentPose: null,
  isDetecting: false,
  fps: 0,
  updatePose: (pose) => set({ currentPose: pose, fps: pose.fps }),
  startDetection: () => set({ isDetecting: true }),
  stopDetection: () => set({ isDetecting: false, currentPose: null }),
}));
```

## 見積もり

- 工数: 3日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **MediaPipeモデルサイズ**: 約10MBのモデルファイルをバンドルする必要あり
- **パフォーマンス最適化**: フレームスキップ、ダウンサンプリングを低スペック端末で実装
- **デバッグ表示**: 開発中は骨格のオーバーレイ表示を有効にし、本番ではオフにする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
