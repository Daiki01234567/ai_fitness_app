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

### 信頼度閾値設定

骨格検出の品質を確保するため、ランドマークの信頼度（visibility）に基づいてフィルタリングを行います。

#### ランドマーク信頼度レベル

| 信頼度レベル | 閾値 | 用途 | 説明 |
|------------|------|------|------|
| **高信頼度** | >= 0.8 | フォーム評価に使用 | 正確な角度計算が可能、評価ロジックに利用 |
| **中信頼度** | >= 0.5 | 表示のみ | 骨格の可視化には使用するが、評価には使用しない |
| **低信頼度** | < 0.5 | 非表示 | 検出精度が低いため非表示、ユーザーに姿勢調整を促す |

#### 信頼度フィルタリング実装

```typescript
/**
 * 可視性に基づいてランドマークをフィルタリング
 * @param landmarks 検出されたランドマーク配列
 * @param threshold 信頼度閾値（デフォルト: 0.5）
 * @returns フィルタリング済みランドマーク配列
 */
function filterVisibleLandmarks(
  landmarks: PoseLandmark[],
  threshold: number = 0.5
): PoseLandmark[] {
  return landmarks.filter(landmark =>
    landmark.visibility !== undefined && landmark.visibility >= threshold
  );
}

/**
 * フォーム評価用の高信頼度ランドマークのみを取得
 * @param landmarks 検出されたランドマーク配列
 * @returns 高信頼度ランドマーク配列
 */
function getHighConfidenceLandmarks(
  landmarks: PoseLandmark[]
): PoseLandmark[] {
  return filterVisibleLandmarks(landmarks, 0.8);
}

/**
 * 特定の関節点が評価可能かチェック
 * @param landmarks ランドマーク配列
 * @param indices チェックする関節点のインデックス配列
 * @returns true: 全て高信頼度、false: 一部または全部が低信頼度
 */
function areJointsVisible(
  landmarks: PoseLandmark[],
  indices: number[]
): boolean {
  return indices.every(index => {
    const landmark = landmarks[index];
    return landmark && landmark.visibility >= 0.8;
  });
}

// 使用例: スクワット評価に必要な関節点の信頼度チェック
const requiredJoints = [
  LandmarkIndex.LEFT_HIP,
  LandmarkIndex.RIGHT_HIP,
  LandmarkIndex.LEFT_KNEE,
  LandmarkIndex.RIGHT_KNEE,
  LandmarkIndex.LEFT_ANKLE,
  LandmarkIndex.RIGHT_ANKLE,
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

### PoseDetectorクラス

```typescript
export class PoseDetector {
  // 信頼度閾値の定義
  private readonly VISIBILITY_THRESHOLD_HIGH = 0.8;  // フォーム評価用
  private readonly VISIBILITY_THRESHOLD_LOW = 0.5;   // 表示用
  private consecutiveLowConfidenceFrames = 0;
  private readonly MAX_LOW_CONFIDENCE_FRAMES = 30;   // 約1秒（30fps想定）

  async detectPose(frame: Frame): Promise<PoseDetectionResult | null> {
    try {
      const result = await this.runMediaPipePose(frame);

      if (!result || !result.landmarks) {
        return null;
      }

      // 表示用フィルタリング（信頼度 >= 0.5）
      const visibleLandmarks = result.landmarks.filter(
        (landmark) => landmark.visibility >= this.VISIBILITY_THRESHOLD_LOW
      );

      // フォーム評価用フィルタリング（信頼度 >= 0.8）
      const evaluatableLandmarks = result.landmarks.filter(
        (landmark) => landmark.visibility >= this.VISIBILITY_THRESHOLD_HIGH
      );

      // 平均信頼度の計算
      const avgConfidence = this.calculateAverageConfidence(result.landmarks);

      // 低信頼度フレームのカウント
      if (avgConfidence < this.VISIBILITY_THRESHOLD_LOW) {
        this.consecutiveLowConfidenceFrames++;

        // 連続して低信頼度が続く場合、ユーザーに警告
        if (this.consecutiveLowConfidenceFrames >= this.MAX_LOW_CONFIDENCE_FRAMES) {
          this.emitLowConfidenceWarning(avgConfidence);
        }
      } else {
        this.consecutiveLowConfidenceFrames = 0;
      }

      return {
        landmarks: visibleLandmarks,
        evaluatableLandmarks: evaluatableLandmarks,
        avgConfidence: avgConfidence,
        timestamp: Date.now(),
        fps: this.calculateFPS(),
      };
    } catch (error) {
      console.error('Pose detection error:', error);
      return null;
    }
  }

  /**
   * ランドマークの平均信頼度を計算
   */
  private calculateAverageConfidence(landmarks: Landmark[]): number {
    const sum = landmarks.reduce((acc, landmark) => acc + landmark.visibility, 0);
    return sum / landmarks.length;
  }

  /**
   * 低信頼度警告を発行
   */
  private emitLowConfidenceWarning(avgConfidence: number): void {
    console.warn(`[PoseDetector] 低信頼度が継続: ${avgConfidence.toFixed(2)}`);
    // イベントを発行してUIに通知
    // eventEmitter.emit('lowConfidence', { avgConfidence });
  }

  private calculateFPS(): number {
    // FPS計算ロジック（011で実装済み）
  }
}
```

#### 拡張されたデータ構造

```typescript
export interface PoseDetectionResult {
  landmarks: Landmark[];              // 表示用ランドマーク（信頼度 >= 0.5）
  evaluatableLandmarks: Landmark[];   // 評価用ランドマーク（信頼度 >= 0.8）
  avgConfidence: number;              // 平均信頼度
  timestamp: number;                  // タイムスタンプ
  fps: number;                        // 現在のFPS
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
